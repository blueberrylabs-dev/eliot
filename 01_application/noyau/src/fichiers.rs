//! Écriture sûre des fichiers : noms nettoyés, jamais d'écrasement silencieux, jamais de
//! fichier à moitié écrit.

use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const LONGUEUR_MAX: usize = 120;

/// Nettoie un nom de fichier proposé par l'interface : garde lettres (accents compris),
/// chiffres, `-`, `_` et `.`, remplace les espaces par `_`, retire tout le reste.
/// Jamais de point au début (fichier caché) ni de nom vide.
pub fn nettoyer_nom(brut: &str) -> String {
    let mut propre: String = brut
        .chars()
        .filter_map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' {
                Some(c)
            } else if c.is_whitespace() {
                Some('_')
            } else {
                None
            }
        })
        .collect();
    propre = propre.trim_start_matches('.').to_string();
    if propre.chars().count() > LONGUEUR_MAX {
        propre = propre.chars().take(LONGUEUR_MAX).collect();
    }
    if propre.is_empty() { "eliot".to_string() } else { propre }
}

/// Premier chemin libre de la forme `base.ext`, `base_2.ext`, `base_3.ext`…
pub fn chemin_libre(dossier: &Path, base: &str, extension: &str) -> PathBuf {
    let premier = dossier.join(format!("{base}.{extension}"));
    if !premier.exists() {
        return premier;
    }
    (2..)
        .map(|n| dossier.join(format!("{base}_{n}.{extension}")))
        .find(|chemin| !chemin.exists())
        .expect("une suite infinie finit par trouver un nom libre")
}

/// Écrit dans un fichier temporaire caché du même dossier, force l'écriture sur le disque,
/// puis renomme. Un plantage en cours de route laisse au pire un fichier temporaire, jamais
/// une cible tronquée.
pub fn ecrire_atomiquement(cible: &Path, octets: &[u8]) -> io::Result<()> {
    let dossier = cible
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "chemin sans dossier"))?;
    let nom = cible
        .file_name()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "chemin sans nom de fichier"))?
        .to_string_lossy();
    let marque = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let temporaire = dossier.join(format!(".{nom}.eliot-{}-{marque}", std::process::id()));

    let resultat = (|| {
        let mut fichier = File::create(&temporaire)?;
        fichier.write_all(octets)?;
        fichier.sync_all()?;
        fs::rename(&temporaire, cible)
    })();
    if resultat.is_err() {
        let _ = fs::remove_file(&temporaire);
    }
    resultat
}

/// Un nom temporaire caché, dans le même dossier que la cible (le renommage reste atomique).
pub fn chemin_temporaire(cible: &Path) -> io::Result<PathBuf> {
    let dossier = cible
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "chemin sans dossier"))?;
    let nom = cible
        .file_name()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "chemin sans nom de fichier"))?
        .to_string_lossy();
    let marque = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    Ok(dossier.join(format!(".{nom}.eliot-{}-{marque}", std::process::id())))
}

/// Copie un fichier, même très gros (une vidéo), sans le charger en mémoire : copie vers un
/// temporaire du dossier cible, écriture forcée sur le disque, puis renommage.
pub fn copier_atomiquement(source: &Path, cible: &Path) -> io::Result<()> {
    let temporaire = chemin_temporaire(cible)?;
    let resultat = (|| {
        fs::copy(source, &temporaire)?;
        File::open(&temporaire)?.sync_all()?;
        fs::rename(&temporaire, cible)
    })();
    if resultat.is_err() {
        let _ = fs::remove_file(&temporaire);
    }
    resultat
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dossier_de_test(nom: &str) -> PathBuf {
        let dossier = std::env::temp_dir().join(format!("eliot-test-{nom}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dossier);
        fs::create_dir_all(&dossier).unwrap();
        dossier
    }

    #[test]
    fn le_nom_est_nettoye() {
        assert_eq!(nettoyer_nom("Promo été 2026"), "Promo_été_2026");
        assert_eq!(nettoyer_nom("../../etc/passwd"), "etcpasswd");
        assert_eq!(nettoyer_nom("...cache"), "cache");
        assert_eq!(nettoyer_nom("/\u{0}"), "eliot");
        assert_eq!(nettoyer_nom(&"a".repeat(300)).len(), LONGUEUR_MAX);
    }

    #[test]
    fn un_nom_pris_recoit_un_suffixe() {
        let dossier = dossier_de_test("libre");
        assert_eq!(chemin_libre(&dossier, "visuel", "png"), dossier.join("visuel.png"));
        fs::write(dossier.join("visuel.png"), b"x").unwrap();
        fs::write(dossier.join("visuel_2.png"), b"x").unwrap();
        assert_eq!(chemin_libre(&dossier, "visuel", "png"), dossier.join("visuel_3.png"));
        fs::remove_dir_all(&dossier).unwrap();
    }

    #[test]
    fn l_ecriture_atomique_ne_laisse_aucun_temporaire() {
        let dossier = dossier_de_test("atomique");
        let cible = dossier.join("sortie.png");
        ecrire_atomiquement(&cible, b"contenu").unwrap();
        assert_eq!(fs::read(&cible).unwrap(), b"contenu");
        let restes: Vec<_> = fs::read_dir(&dossier).unwrap().flatten().collect();
        assert_eq!(restes.len(), 1, "seul le fichier final doit rester");
        fs::remove_dir_all(&dossier).unwrap();
    }
}
