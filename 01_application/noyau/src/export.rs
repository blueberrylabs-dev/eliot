//! Écriture d'un rendu exporté : format vérifié, dossier par défaut ou chemin choisi, nom
//! daté, écriture atomique (BRIEF, règle 8).

use std::fs;
use std::path::{Path, PathBuf};

use thiserror::Error;

use crate::fichiers::{chemin_libre, ecrire_atomiquement, nettoyer_nom};

#[derive(Debug, Error)]
pub enum ErreurExport {
    #[error("format inconnu : « {0} » (attendu : png, jpeg ou pdf)")]
    FormatInconnu(String),
    #[error("le contenu reçu n'est pas un fichier {0}")]
    ContenuNonConforme(&'static str),
    #[error("le dossier de destination n'existe pas : {0}")]
    DossierAbsent(PathBuf),
    #[error("écriture impossible : {0}")]
    Ecriture(#[from] std::io::Error),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Format {
    Png,
    Jpeg,
    Pdf,
}

impl Format {
    pub fn depuis_nom(nom: &str) -> Result<Self, ErreurExport> {
        match nom.to_ascii_lowercase().as_str() {
            "png" => Ok(Self::Png),
            "jpeg" | "jpg" => Ok(Self::Jpeg),
            "pdf" => Ok(Self::Pdf),
            autre => Err(ErreurExport::FormatInconnu(autre.to_string())),
        }
    }

    pub fn extension(self) -> &'static str {
        match self {
            Self::Png => "png",
            Self::Jpeg => "jpg",
            Self::Pdf => "pdf",
        }
    }

    fn libelle(self) -> &'static str {
        match self {
            Self::Png => "PNG",
            Self::Jpeg => "JPEG",
            Self::Pdf => "PDF",
        }
    }

    /// Extensions acceptées pour un chemin choisi par l'utilisateur.
    fn extensions_acceptees(self) -> &'static [&'static str] {
        match self {
            Self::Png => &["png"],
            Self::Jpeg => &["jpg", "jpeg"],
            Self::Pdf => &["pdf"],
        }
    }

    /// Les premiers octets doivent correspondre au format annoncé.
    pub fn signature_valide(self, octets: &[u8]) -> bool {
        match self {
            Self::Png => octets.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]),
            Self::Jpeg => octets.starts_with(&[0xFF, 0xD8, 0xFF]),
            Self::Pdf => octets.starts_with(b"%PDF-"),
        }
    }
}

/// Décide où écrire : le chemin choisi dans « Enregistrer sous » (extension corrigée si
/// besoin, écrasement accepté puisque le dialogue l'a confirmé), sinon le dossier par
/// défaut avec un nom libre.
pub fn chemin_de_sortie(
    format: Format,
    dossier_par_defaut: &Path,
    nom_suggere: &str,
    chemin_choisi: Option<&Path>,
) -> Result<PathBuf, ErreurExport> {
    if let Some(chemin) = chemin_choisi {
        let dossier = chemin.parent().map(Path::to_path_buf).unwrap_or_default();
        if !dossier.is_dir() {
            return Err(ErreurExport::DossierAbsent(dossier));
        }
        let extension = chemin
            .extension()
            .map(|e| e.to_string_lossy().to_ascii_lowercase())
            .unwrap_or_default();
        if format.extensions_acceptees().contains(&extension.as_str()) {
            return Ok(chemin.to_path_buf());
        }
        let mut corrige = chemin.as_os_str().to_owned();
        corrige.push(".");
        corrige.push(format.extension());
        return Ok(PathBuf::from(corrige));
    }
    fs::create_dir_all(dossier_par_defaut)?;
    Ok(chemin_libre(dossier_par_defaut, &nettoyer_nom(nom_suggere), format.extension()))
}

/// Vérifie puis écrit un rendu. Renvoie le chemin réellement écrit.
pub fn exporter(
    octets: &[u8],
    format: Format,
    dossier_par_defaut: &Path,
    nom_suggere: &str,
    chemin_choisi: Option<&Path>,
) -> Result<PathBuf, ErreurExport> {
    if !format.signature_valide(octets) {
        return Err(ErreurExport::ContenuNonConforme(format.libelle()));
    }
    let cible = chemin_de_sortie(format, dossier_par_defaut, nom_suggere, chemin_choisi)?;
    ecrire_atomiquement(&cible, octets)?;
    Ok(cible)
}

#[cfg(test)]
mod tests {
    use super::*;

    const PNG_MINIMAL: &[u8] = &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0];

    fn dossier_de_test(nom: &str) -> PathBuf {
        let dossier = std::env::temp_dir().join(format!("eliot-export-{nom}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dossier);
        dossier
    }

    #[test]
    fn les_signatures_sont_reconnues() {
        assert!(Format::Png.signature_valide(PNG_MINIMAL));
        assert!(Format::Jpeg.signature_valide(&[0xFF, 0xD8, 0xFF, 0xE0]));
        assert!(Format::Pdf.signature_valide(b"%PDF-1.7"));
        assert!(!Format::Png.signature_valide(&[0xFF, 0xD8, 0xFF]));
        assert!(!Format::Jpeg.signature_valide(b"<html>"));
    }

    #[test]
    fn un_contenu_non_conforme_est_refuse_sans_rien_ecrire() {
        let dossier = dossier_de_test("refus");
        let erreur = exporter(b"<html>", Format::Png, &dossier, "x", None).unwrap_err();
        assert!(matches!(erreur, ErreurExport::ContenuNonConforme("PNG")));
        assert!(!dossier.exists());
    }

    #[test]
    fn le_dossier_par_defaut_est_cree_et_jamais_ecrase() {
        let dossier = dossier_de_test("defaut");
        let premier = exporter(PNG_MINIMAL, Format::Png, &dossier, "2026-10-14_120000_eliot", None).unwrap();
        let second = exporter(PNG_MINIMAL, Format::Png, &dossier, "2026-10-14_120000_eliot", None).unwrap();
        assert_eq!(premier.file_name().unwrap(), "2026-10-14_120000_eliot.png");
        assert_eq!(second.file_name().unwrap(), "2026-10-14_120000_eliot_2.png");
        fs::remove_dir_all(&dossier).unwrap();
    }

    #[test]
    fn le_chemin_choisi_recoit_la_bonne_extension() {
        let dossier = dossier_de_test("choisi");
        fs::create_dir_all(&dossier).unwrap();
        let sortie = chemin_de_sortie(Format::Jpeg, Path::new("/inutile"), "x", Some(&dossier.join("affiche"))).unwrap();
        assert_eq!(sortie, dossier.join("affiche.jpg"));
        let sortie = chemin_de_sortie(Format::Jpeg, Path::new("/inutile"), "x", Some(&dossier.join("affiche.JPEG"))).unwrap();
        assert_eq!(sortie, dossier.join("affiche.JPEG"));
        let absent = chemin_de_sortie(Format::Png, Path::new("/inutile"), "x", Some(&dossier.join("nulle_part/a.png")));
        assert!(matches!(absent, Err(ErreurExport::DossierAbsent(_))));
        fs::remove_dir_all(&dossier).unwrap();
    }
}
