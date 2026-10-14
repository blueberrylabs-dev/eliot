//! Polices du poste (étape 3) : la liste des polices installées sur la machine, et la copie
//! d'une police dans le design qui s'en sert, pour qu'il se recompose à l'identique sur une
//! autre machine (BRIEF § 6, « Deux postes »).
//!
//! Les polices de la bibliothèque (Google Fonts) ne passent pas par ici : elles sont servies à
//! la fenêtre avec l'application. Ici, seulement ce qui vient du système ou d'un design.

use std::collections::BTreeMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::fichiers::{ecrire_atomiquement, nettoyer_nom};

/// Sous-dossier des ressources d'un design où vivent ses polices copiées.
pub const DOSSIER_POLICES: &str = "polices";

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct FichierPolice {
    /// Chemin complet (polices du poste) ou nom du fichier (polices d'un design).
    pub chemin: String,
    /// `normal` ou `italic`.
    pub style: String,
    pub poids: u16,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct PoliceInstallee {
    pub famille: String,
    pub fichiers: Vec<FichierPolice>,
}

const EXTENSIONS: [&str; 2] = ["ttf", "otf"];

fn extension_acceptee(chemin: &Path) -> bool {
    chemin
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
}

/// Regroupe les fontes d'une base par famille (nom anglais, le plus courant), fichiers TTF et
/// OTF seulement : ce sont ceux que la fenêtre sait charger un par un.
fn regrouper(base: &fontdb::Database, chemin_affiche: impl Fn(&Path) -> String) -> Vec<PoliceInstallee> {
    let mut familles: BTreeMap<String, Vec<FichierPolice>> = BTreeMap::new();
    for face in base.faces() {
        let fontdb::Source::File(chemin) = &face.source else { continue };
        // Largeur normale seulement : une variante étroite (« Condensed ») porterait le même
        // nom de famille, le même poids et le même style, et prendrait la place de la normale.
        if !extension_acceptee(chemin) || face.index != 0 || face.stretch != fontdb::Stretch::Normal {
            continue;
        }
        let Some((famille, _)) = face.families.first() else { continue };
        let fichier = FichierPolice {
            chemin: chemin_affiche(chemin),
            style: if face.style == fontdb::Style::Normal { "normal".into() } else { "italic".into() },
            poids: face.weight.0,
        };
        let liste = familles.entry(famille.clone()).or_default();
        if !liste.contains(&fichier) {
            liste.push(fichier);
        }
    }
    familles
        .into_iter()
        .map(|(famille, mut fichiers)| {
            fichiers.sort_by(|a, b| (a.style.as_str(), a.poids).cmp(&(b.style.as_str(), b.poids)));
            PoliceInstallee { famille, fichiers }
        })
        .collect()
}

/// Les polices installées sur le poste (dossiers du système et de l'utilisateur).
pub fn lister_poste() -> Vec<PoliceInstallee> {
    let mut base = fontdb::Database::new();
    base.load_system_fonts();
    regrouper(&base, |c| c.to_string_lossy().into_owned())
}

/// Les polices copiées dans un design (`ressources/polices/`).
pub fn lister_design(dossier_ressources: &Path) -> Vec<PoliceInstallee> {
    let dossier = dossier_ressources.join(DOSSIER_POLICES);
    let mut base = fontdb::Database::new();
    if dossier.is_dir() {
        base.load_fonts_dir(&dossier);
    }
    regrouper(&base, |c| c.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default())
}

/// Lit une police du poste. Seuls les fichiers que `lister_poste` a montrés se lisent :
/// l'interface ne peut pas s'en servir pour lire n'importe quel fichier du disque.
pub fn lire_poste(chemin: &str, connues: &[PoliceInstallee]) -> io::Result<Vec<u8>> {
    let permis = connues.iter().flat_map(|p| &p.fichiers).any(|f| f.chemin == chemin);
    if !permis {
        return Err(io::Error::new(io::ErrorKind::PermissionDenied, "police inconnue du poste"));
    }
    fs::read(chemin)
}

/// Un nom de fichier de police acceptable dans un design : pas de chemin, une extension connue.
fn nom_de_fichier_valide(nom: &str) -> bool {
    !nom.is_empty() && !nom.contains(['/', '\\']) && !nom.starts_with('.') && extension_acceptee(Path::new(nom))
}

/// Lit une police copiée dans un design.
pub fn lire_design(dossier_ressources: &Path, fichier: &str) -> io::Result<Vec<u8>> {
    if !nom_de_fichier_valide(fichier) {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "nom de fichier de police refusé"));
    }
    fs::read(dossier_ressources.join(DOSSIER_POLICES).join(fichier))
}

/// Copie une police du poste dans un design. Le même fichier n'est copié qu'une fois ; un autre
/// fichier du même nom reçoit un suffixe. Renvoie le nom du fichier dans le design.
pub fn copier_dans_design(source: &Path, dossier_ressources: &Path) -> io::Result<String> {
    let octets = fs::read(source)?;
    let dossier = dossier_ressources.join(DOSSIER_POLICES);
    fs::create_dir_all(&dossier)?;
    let extension = source.extension().and_then(|e| e.to_str()).unwrap_or("ttf").to_ascii_lowercase();
    let base = nettoyer_nom(&source.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default());
    for n in 1.. {
        let nom = if n == 1 { format!("{base}.{extension}") } else { format!("{base}_{n}.{extension}") };
        let cible: PathBuf = dossier.join(&nom);
        match fs::read(&cible) {
            Ok(existant) if existant == octets => return Ok(nom),
            Ok(_) => continue,
            Err(e) if e.kind() == io::ErrorKind::NotFound => {
                ecrire_atomiquement(&cible, &octets)?;
                return Ok(nom);
            }
            Err(e) => return Err(e),
        }
    }
    unreachable!()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dossier_de_test(nom: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("eliot-polices-{nom}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    /// Une police du système, s'il y en a une (les machines de test en ont toujours).
    fn une_police_du_poste() -> Option<(PoliceInstallee, Vec<PoliceInstallee>)> {
        let liste = lister_poste();
        liste.iter().find(|p| p.fichiers.iter().any(|f| f.chemin.ends_with(".ttf"))).cloned().map(|p| (p, liste))
    }

    #[test]
    fn les_polices_du_poste_se_listent_et_se_lisent() {
        let Some((police, toutes)) = une_police_du_poste() else { return };
        let octets = lire_poste(&police.fichiers[0].chemin, &toutes).unwrap();
        assert!(octets.len() > 1000);
        assert!(lire_poste("/etc/passwd", &toutes).is_err(), "un fichier hors de la liste est refusé");
    }

    #[test]
    fn une_police_copiee_dans_un_design_y_reste_une_fois() {
        let Some((police, _)) = une_police_du_poste() else { return };
        let ressources = dossier_de_test("copie");
        let source = Path::new(&police.fichiers[0].chemin);
        let nom = copier_dans_design(source, &ressources).unwrap();
        assert_eq!(copier_dans_design(source, &ressources).unwrap(), nom, "même fichier, même nom, pas de doublon");
        assert_eq!(fs::read_dir(ressources.join(DOSSIER_POLICES)).unwrap().count(), 1);
        let liste = lister_design(&ressources);
        assert_eq!(liste.len(), 1);
        assert_eq!(liste[0].famille, police.famille);
        assert_eq!(lire_design(&ressources, &nom).unwrap(), fs::read(source).unwrap());
        assert!(lire_design(&ressources, "../document.json").is_err());
        fs::remove_dir_all(&ressources).unwrap();
    }
}
