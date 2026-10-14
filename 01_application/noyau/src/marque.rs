//! Le kit de marque (étape 3) : un seul kit, rangé comme un design dans
//! `~/Documents/Eliot/Marque/kit/`. Le fichier `marque.json` garde le nom, les couleurs et les
//! polices ; les logos sont des images du dossier `ressources/`, importées comme celles d'un
//! design et copiées dans chaque design qui s'en sert.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde_json::{Value, json};

use crate::fichiers::ecrire_atomiquement;

pub const ID_KIT: &str = "kit";
const FICHIER: &str = "marque.json";
/// Un kit tient en quelques Ko ; on refuse un fichier démesuré.
const TAILLE_MAX: usize = 512 * 1024;

#[derive(Debug, thiserror::Error)]
pub enum ErreurMarque {
    #[error("kit de marque illisible : {0}")]
    Illisible(String),
    #[error("kit de marque trop gros")]
    TropGros,
    #[error(transparent)]
    Disque(#[from] io::Error),
}

/// Le kit d'un compte neuf : rien à part un nom.
pub fn kit_vide() -> Value {
    json!({ "version": 1, "nom": "Ma marque", "couleurs": [], "polices": {}, "logos": [] })
}

/// Le dossier des logos du kit (créé au besoin), rangé comme celui d'un design.
pub fn dossier_ressources(dossier_kit: &Path) -> Result<PathBuf, ErreurMarque> {
    let dossier = dossier_kit.join("ressources");
    fs::create_dir_all(&dossier)?;
    Ok(dossier)
}

fn chemin(dossier_kit: &Path) -> PathBuf {
    dossier_kit.join(FICHIER)
}

/// Lit le kit. Absent : le kit vide. Abîmé : une erreur, le fichier n'est pas touché.
pub fn lire(dossier_kit: &Path) -> Result<Value, ErreurMarque> {
    let octets = match fs::read(chemin(dossier_kit)) {
        Ok(o) => o,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(kit_vide()),
        Err(e) => return Err(e.into()),
    };
    let valeur: Value = serde_json::from_slice(&octets).map_err(|e| ErreurMarque::Illisible(e.to_string()))?;
    if !valeur.is_object() {
        return Err(ErreurMarque::Illisible("un objet JSON est attendu".into()));
    }
    Ok(valeur)
}

/// Enregistre le kit (écriture atomique). L'interface envoie l'objet entier.
pub fn enregistrer(dossier_kit: &Path, kit: &Value) -> Result<(), ErreurMarque> {
    if !kit.is_object() {
        return Err(ErreurMarque::Illisible("un objet JSON est attendu".into()));
    }
    let octets = serde_json::to_vec_pretty(kit).map_err(|e| ErreurMarque::Illisible(e.to_string()))?;
    if octets.len() > TAILLE_MAX {
        return Err(ErreurMarque::TropGros);
    }
    fs::create_dir_all(dossier_kit)?;
    ecrire_atomiquement(&chemin(dossier_kit), &octets)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn le_kit_se_lit_s_enregistre_et_refuse_un_fichier_abime() {
        let d = std::env::temp_dir().join(format!("eliot-marque-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        assert_eq!(lire(&d).unwrap(), kit_vide(), "pas encore de kit : le kit vide");
        assert!(dossier_ressources(&d).unwrap().is_dir(), "le dossier des logos se crée sans design autour");
        let kit = json!({ "version": 1, "nom": "Nimeria", "couleurs": [{ "valeur": "#1f6feb" }], "polices": { "titre": { "famille": "Anton" } }, "logos": [] });
        enregistrer(&d, &kit).unwrap();
        assert_eq!(lire(&d).unwrap(), kit);
        assert!(enregistrer(&d, &json!([1, 2])).is_err(), "un tableau n'est pas un kit");
        fs::write(chemin(&d), b"{ pas du json").unwrap();
        assert!(matches!(lire(&d), Err(ErreurMarque::Illisible(_))));
        let enorme = json!({ "nom": "x".repeat(TAILLE_MAX) });
        assert!(matches!(enregistrer(&d, &enorme), Err(ErreurMarque::TropGros)));
        assert_eq!(fs::read(chemin(&d)).unwrap(), b"{ pas du json", "un refus n'écrit rien");
        fs::remove_dir_all(&d).unwrap();
    }
}
