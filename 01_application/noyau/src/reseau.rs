//! Les téléchargements des banques 3D (étape 6, lot 3 : Poly Haven, Sketchfab) : une demande à
//! une API, un fichier écrit sur le disque sans tout garder en mémoire, une taille bornée, une
//! adresse dont l'origine est vérifiée. Un message d'erreur ne contient jamais une clé : chaque
//! client passe la sienne à `masquer`.

use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Component, Path};
use std::time::{Duration, SystemTime};

/// Ce qui se présente aux banques : le nom d'Eliot (Poly Haven demande un User-Agent propre à
/// l'application).
pub const AGENT: &str = "Eliot/0.1 (editeur graphique local)";

#[derive(Debug, thiserror::Error)]
pub enum ErreurReseau {
    #[error("injoignable : {0}")]
    Reseau(String),
    #[error("demande refusée (code {0})")]
    Refus(u16),
    #[error("fichier trop lourd (plus de {0} Mo)")]
    TropLourd(u64),
    #[error("adresse refusée : elle ne vient pas de la banque")]
    AdresseRefusee,
    #[error("fichier incomplet : {recu} octets reçus sur {attendu}")]
    Incomplet { recu: u64, attendu: u64 },
    #[error(transparent)]
    Disque(#[from] std::io::Error),
}

/// Un client HTTPS pour une banque : délai d'une minute, le nom d'Eliot.
pub fn agent() -> ureq::Agent {
    ureq::Agent::config_builder().timeout_global(Some(Duration::from_secs(120))).user_agent(AGENT).build().into()
}

/// L'adresse commence par une des origines permises.
pub fn permise(adresse: &str, origines: &[String]) -> Result<(), ErreurReseau> {
    if origines.iter().any(|o| adresse.starts_with(o.as_str())) { Ok(()) } else { Err(ErreurReseau::AdresseRefusee) }
}

/// Une demande (GET) et sa réponse entière en mémoire, `limite` octets au plus.
pub fn lire(agent: &ureq::Agent, adresse: &str, entetes: &[(&str, String)], limite: u64, masquer: &dyn Fn(String) -> String) -> Result<Vec<u8>, ErreurReseau> {
    let mut demande = agent.get(adresse);
    for (nom, valeur) in entetes {
        demande = demande.header(*nom, valeur.as_str());
    }
    let mut reponse = match demande.call() {
        Ok(r) => r,
        Err(ureq::Error::StatusCode(code)) => return Err(ErreurReseau::Refus(code)),
        Err(e) => return Err(ErreurReseau::Reseau(masquer(e.to_string()))),
    };
    reponse.body_mut().with_config().limit(limite).read_to_vec().map_err(|e| ErreurReseau::Reseau(masquer(e.to_string())))
}

/// Télécharge `adresse` dans `cible` par morceaux ; `avancement` reçoit la part reçue quand la
/// taille est connue. `attendu` : la taille annoncée par la banque, vérifiée à la fin.
pub fn lire_vers(agent: &ureq::Agent, adresse: &str, cible: &Path, limite: u64, attendu: Option<u64>, avancement: &mut dyn FnMut(f32), masquer: &dyn Fn(String) -> String) -> Result<u64, ErreurReseau> {
    let mut reponse = match agent.get(adresse).call() {
        Ok(r) => r,
        Err(ureq::Error::StatusCode(code)) => return Err(ErreurReseau::Refus(code)),
        Err(e) => return Err(ErreurReseau::Reseau(masquer(e.to_string()))),
    };
    let taille = reponse.body().content_length().or(attendu);
    if taille.is_some_and(|n| n > limite) {
        return Err(ErreurReseau::TropLourd(limite / 1024 / 1024));
    }
    let mut lecteur = reponse.body_mut().with_config().limit(limite).reader();
    if let Some(dossier) = cible.parent() {
        fs::create_dir_all(dossier)?;
    }
    let mut fichier = File::create(cible)?;
    let mut tampon = vec![0u8; 256 * 1024];
    let mut recu: u64 = 0;
    loop {
        let n = lecteur.read(&mut tampon).map_err(|e| ErreurReseau::Reseau(masquer(e.to_string())))?;
        if n == 0 {
            break;
        }
        fichier.write_all(&tampon[..n])?;
        recu += n as u64;
        if let Some(total) = taille.filter(|t| *t > 0) {
            avancement((recu as f32 / total as f32).min(1.0));
        }
    }
    fichier.sync_all()?;
    if let Some(a) = attendu.filter(|a| *a > 0 && *a != recu) {
        return Err(ErreurReseau::Incomplet { recu, attendu: a });
    }
    avancement(1.0);
    Ok(recu)
}

/// Un fichier du cache plus jeune que `duree`.
pub fn frais(chemin: &Path, duree: Duration) -> bool {
    fs::metadata(chemin)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|date| SystemTime::now().duration_since(date).ok())
        .is_some_and(|age| age < duree)
}

/// Un chemin relatif sûr (cité par une banque) : ni absolu, ni « .. ».
pub fn chemin_sur(relatif: &str) -> bool {
    let p = Path::new(relatif);
    !relatif.is_empty() && p.components().all(|c| matches!(c, Component::Normal(_) | Component::CurDir))
}

/// Retire de `dossier` les fichiers plus vieux que `duree` (pas les sous-dossiers) ; le nombre
/// de fichiers retirés.
pub fn nettoyer(dossier: &Path, duree: Duration) -> usize {
    let Ok(entrees) = fs::read_dir(dossier) else { return 0 };
    entrees
        .flatten()
        .filter(|e| e.file_type().is_ok_and(|t| t.is_file()) && !frais(&e.path(), duree) && fs::remove_file(e.path()).is_ok())
        .count()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn un_chemin_cite_par_une_banque_reste_dans_son_dossier() {
        assert!(chemin_sur("textures/bois_1k.jpg"));
        assert!(chemin_sur("scene.gltf"));
        assert!(!chemin_sur("../secret"));
        assert!(!chemin_sur("/etc/passwd"));
        assert!(!chemin_sur("textures/../../x"));
        assert!(!chemin_sur(""));
        assert!(permise("https://dl.polyhaven.org/file/x", &["https://dl.polyhaven.org/".into()]).is_ok());
        assert!(permise("https://ailleurs.example/x", &["https://dl.polyhaven.org/".into()]).is_err());
    }
}
