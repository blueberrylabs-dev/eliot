//! Les environnements HDRI d'un design (étape 6, lot 3) : une image panoramique en lumière vraie
//! (Radiance `.hdr`), importée du poste ou venue de Poly Haven, qui éclaire un objet 3D et se
//! reflète dans ses matières. Elle entre dans les ressources comme une image : original rangé une
//! fois (empreinte SHA-256), copie de 2048 × 1024 px au plus que la fenêtre charge (règle 5),
//! aperçu et miniature en PNG, la lumière ramenée à l'écran (ton de Reinhard).
//!
//! Rangement : `originaux/<empreinte>.hdr`, `copies/<empreinte>.hdr` (si l'original est plus
//! grand), `apercus/<empreinte>.png` (512 px de large), `miniatures/<empreinte>.png` (256 px),
//! `infos/<empreinte>.json`.

use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

use image::codecs::hdr::{HdrDecoder, HdrEncoder};
use image::{DynamicImage, Rgb, Rgb32FImage, RgbImage};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::fichiers::ecrire_atomiquement;
use crate::images::{self, Credit, Ressource};

/// Le plus grand côté de la copie que la fenêtre charge (une panoramique 2:1 : 2048 × 1024).
pub const COTE_COPIE: u32 = 2048;
/// Le plus gros fichier accepté.
pub const TAILLE_MAX: u64 = 300 * 1024 * 1024;
const COTE_APERCU: u32 = 512;

#[derive(Debug, thiserror::Error)]
pub enum ErreurEnvironnement {
    #[error("lecture impossible : {0}")]
    Lecture(#[from] std::io::Error),
    #[error("{0}")]
    Format(String),
    #[error("fichier trop gros : {0} Mo, au plus {max} Mo", max = TAILLE_MAX / 1024 / 1024)]
    TropGros(u64),
    #[error("{0}")]
    Image(#[from] images::ErreurImage),
}

/// Ce que la fenêtre sait d'un environnement, rangé avec la ressource.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InfosEnvironnement3d {
    /// `hdr` (Radiance).
    pub format: String,
    /// L'extension de la copie chargée par la fenêtre, ou `original`.
    pub copie: String,
}

/// Un fichier Radiance : il commence par « #?RADIANCE » ou « #?RGBE ».
pub fn est_hdr(octets: &[u8]) -> bool {
    octets.starts_with(b"#?RADIANCE") || octets.starts_with(b"#?RGBE")
}

pub fn est_un_environnement(chemin: &Path) -> bool {
    chemin.extension().is_some_and(|e| e.eq_ignore_ascii_case("hdr"))
}

fn format_err(texte: impl Into<String>) -> ErreurEnvironnement {
    ErreurEnvironnement::Format(texte.into())
}

fn decoder(octets: &[u8]) -> Result<Rgb32FImage, ErreurEnvironnement> {
    let decodeur = HdrDecoder::new(Cursor::new(octets)).map_err(|e| format_err(format!("HDR illisible ({e})")))?;
    let image = DynamicImage::from_decoder(decodeur).map_err(|e| format_err(format!("HDR illisible ({e})")))?;
    Ok(image.to_rgb32f())
}

/// La panoramique ramenée à `largeur` px de large : chaque pixel est la moyenne de la zone
/// qu'il couvre (pas de valeur négative, et la lumière au-delà de 1 est gardée, ce que les
/// réductions d'`image` ne font pas pour des pixels en virgule flottante).
fn reduire(image: &Rgb32FImage, largeur: u32) -> Rgb32FImage {
    if image.width() <= largeur {
        return image.clone();
    }
    let (l, h) = (image.width(), image.height());
    let hauteur = ((h as f64) * largeur as f64 / l as f64).round().max(1.0) as u32;
    let bornes = |i: u32, n: u32, total: u32| {
        let a = (i as u64 * total as u64 / n as u64) as u32;
        let b = (((i + 1) as u64 * total as u64).div_ceil(n as u64) as u32).clamp(a + 1, total);
        (a, b)
    };
    Rgb32FImage::from_fn(largeur, hauteur, |x, y| {
        let (x0, x1) = bornes(x, largeur, l);
        let (y0, y1) = bornes(y, hauteur, h);
        let mut somme = [0f64; 3];
        for yy in y0..y1 {
            for xx in x0..x1 {
                let p = image.get_pixel(xx, yy);
                for k in 0..3 {
                    somme[k] += p[k] as f64;
                }
            }
        }
        let n = ((x1 - x0) * (y1 - y0)) as f64;
        Rgb([(somme[0] / n) as f32, (somme[1] / n) as f32, (somme[2] / n) as f32])
    })
}

/// La lumière vraie ramenée à l'écran : exposition réglée sur la luminance moyenne (en
/// logarithme), ton de Reinhard, puis sRGB.
pub fn vers_ecran(image: &Rgb32FImage) -> RgbImage {
    let lum = |p: &Rgb<f32>| (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]).max(0.0);
    let n = (image.width() as f64 * image.height() as f64).max(1.0);
    let moyenne_log = (image.pixels().map(|p| (1e-4 + lum(p) as f64).ln()).sum::<f64>() / n).exp();
    let exposition = (0.18 / moyenne_log.max(1e-4)) as f32;
    let srgb = |c: f32| {
        let c = c.clamp(0.0, 1.0);
        let v = if c <= 0.003_130_8 { 12.92 * c } else { 1.055 * c.powf(1.0 / 2.4) - 0.055 };
        (v * 255.0).round() as u8
    };
    RgbImage::from_fn(image.width(), image.height(), |x, y| {
        let p = image.get_pixel(x, y);
        let c = |v: f32| {
            let e = (v * exposition).max(0.0);
            srgb(e / (1.0 + e))
        };
        Rgb([c(p[0]), c(p[1]), c(p[2])])
    })
}

fn ecrire_infos(dossier: &Path, ressource: &Ressource) -> Result<(), ErreurEnvironnement> {
    let infos = serde_json::to_vec_pretty(ressource).map_err(|e| format_err(e.to_string()))?;
    ecrire_atomiquement(&dossier.join("infos").join(format!("{}.json", ressource.id)), &infos)?;
    Ok(())
}

/// Importe un environnement à partir de ses octets. Le même déjà importé n'est pas refait.
pub fn importer(octets: &[u8], nom: &str, dossier: &Path) -> Result<Ressource, ErreurEnvironnement> {
    if octets.len() as u64 > TAILLE_MAX {
        return Err(ErreurEnvironnement::TropGros(octets.len() as u64 / 1024 / 1024));
    }
    if !est_hdr(octets) {
        return Err(format_err(format!("« {nom} » n'est pas un environnement HDRI reconnu (fichier Radiance .hdr)")));
    }
    let id: String = Sha256::digest(octets).iter().map(|o| format!("{o:02x}")).collect();
    if let Ok(deja) = images::infos(dossier, &id) {
        if deja.environnement3d.is_some() {
            return Ok(Ressource { nom: nom.to_string(), ..deja });
        }
    }
    let image = decoder(octets)?;
    for sous_dossier in ["originaux", "copies", "apercus", "miniatures", "infos"] {
        fs::create_dir_all(dossier.join(sous_dossier))?;
    }
    ecrire_atomiquement(&dossier.join("originaux").join(format!("{id}.hdr")), octets)?;
    let mut infos = InfosEnvironnement3d { format: "hdr".into(), copie: "original".into() };
    if image.width() > COTE_COPIE {
        let petite = reduire(&image, COTE_COPIE);
        let mut sortie = Vec::new();
        let pixels: Vec<Rgb<f32>> = petite.pixels().copied().collect();
        HdrEncoder::new(&mut sortie).encode(&pixels, petite.width() as usize, petite.height() as usize).map_err(|e| format_err(format!("copie impossible ({e})")))?;
        ecrire_atomiquement(&dossier.join("copies").join(format!("{id}.hdr")), &sortie)?;
        infos.copie = "hdr".into();
    }
    let apercu = DynamicImage::ImageRgb8(vers_ecran(&reduire(&image, COTE_APERCU)));
    let miniature = images::reduire(&apercu, images::COTE_MINIATURE)?;
    ecrire_atomiquement(&dossier.join("apercus").join(format!("{id}.png")), &images::encoder(&apercu, true)?)?;
    ecrire_atomiquement(&dossier.join("miniatures").join(format!("{id}.png")), &images::encoder(&miniature, true)?)?;
    let ressource = Ressource {
        id,
        nom: nom.to_string(),
        largeur: image.width(),
        hauteur: image.height(),
        transparence: false,
        format_apercu: "png".into(),
        credit: None,
        video: None,
        son: None,
        modele3d: None,
        environnement3d: Some(infos),
    };
    ecrire_infos(dossier, &ressource)?;
    Ok(ressource)
}

/// Importe un environnement depuis un fichier du poste.
pub fn importer_fichier(chemin: &Path, dossier: &Path) -> Result<Ressource, ErreurEnvironnement> {
    let taille = fs::metadata(chemin)?.len();
    if taille > TAILLE_MAX {
        return Err(ErreurEnvironnement::TropGros(taille / 1024 / 1024));
    }
    let nom = chemin.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    importer(&fs::read(chemin)?, &nom, dossier)
}

/// Importe un environnement venu d'une banque, avec son crédit et son nom.
pub fn importer_avec_credit(chemin: &Path, nom: &str, dossier: &Path, credit: Credit) -> Result<Ressource, ErreurEnvironnement> {
    let mut r = importer(&fs::read(chemin)?, nom, dossier)?;
    r.credit = Some(credit);
    r.nom = nom.to_string();
    ecrire_infos(dossier, &r)?;
    Ok(r)
}

/// Le fichier que la fenêtre charge : la copie, ou l'original quand ils ne diffèrent pas.
pub fn chemin_copie(dossier: &Path, ressource: &Ressource) -> Option<PathBuf> {
    let infos = ressource.environnement3d.as_ref()?;
    Some(if infos.copie == "original" {
        dossier.join("originaux").join(format!("{}.hdr", ressource.id))
    } else {
        dossier.join("copies").join(format!("{}.{}", ressource.id, infos.copie))
    })
}

/// Les fichiers en plus de l'original, de l'aperçu et de la miniature (copier d'un design à
/// l'autre).
pub fn fichiers_en_plus(dossier: &Path, ressource: &Ressource) -> Vec<PathBuf> {
    match &ressource.environnement3d {
        Some(infos) if infos.copie != "original" => vec![dossier.join("copies").join(format!("{}.{}", ressource.id, infos.copie))],
        _ => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dossier_de_test(nom: &str) -> PathBuf {
        let dossier = std::env::temp_dir().join(format!("eliot-env3d-{nom}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dossier);
        fs::create_dir_all(&dossier).unwrap();
        dossier
    }

    /// Une panoramique d'essai : un ciel bleu, un sol brun, un soleil très lumineux.
    fn panoramique(l: u32) -> Vec<u8> {
        let h = l / 2;
        let pixels: Vec<Rgb<f32>> = (0..h)
            .flat_map(|y| {
                (0..l).map(move |x| {
                    let soleil = (x as i64 - (l / 4) as i64).pow(2) + (y as i64 - (h / 4) as i64).pow(2) < ((l / 64).max(2) as i64).pow(2);
                    if soleil {
                        Rgb([400.0, 380.0, 350.0])
                    } else if y < h / 2 {
                        Rgb([0.3, 0.5, 1.2])
                    } else {
                        Rgb([0.25, 0.18, 0.1])
                    }
                })
            })
            .collect();
        let mut sortie = Vec::new();
        HdrEncoder::new(&mut sortie).encode(&pixels, l as usize, h as usize).unwrap();
        sortie
    }

    #[test]
    fn un_hdri_entre_avec_sa_copie_reduite_et_son_apercu() {
        let dossier = dossier_de_test("import");
        let octets = panoramique(4096);
        assert!(est_hdr(&octets));
        let r = importer(&octets, "ciel.hdr", &dossier).unwrap();
        assert_eq!((r.largeur, r.hauteur), (4096, 2048));
        let infos = r.environnement3d.clone().unwrap();
        assert_eq!(infos.copie, "hdr");
        let copie = fs::read(chemin_copie(&dossier, &r).unwrap()).unwrap();
        let petite = decoder(&copie).unwrap();
        assert_eq!((petite.width(), petite.height()), (2048, 1024));
        // Le soleil reste très lumineux dans la copie (la lumière vraie est gardée).
        assert!(petite.pixels().any(|p| p[0] > 50.0));
        let apercu = image::open(dossier.join("apercus").join(format!("{}.png", r.id))).unwrap().to_rgb8();
        assert_eq!(apercu.dimensions(), (512, 256));
        // Le ciel est bleu, le sol brun, à l'écran.
        let ciel = apercu.get_pixel(400, 40);
        let sol = apercu.get_pixel(400, 220);
        assert!(ciel[2] > ciel[0] + 30, "{ciel:?}");
        assert!(sol[0] > sol[2], "{sol:?}");
        assert!(dossier.join("miniatures").join(format!("{}.png", r.id)).exists());
        // Le même fichier n'est pas refait ; une petite panoramique n'a pas de copie.
        assert_eq!(importer(&octets, "encore.hdr", &dossier).unwrap().id, r.id);
        let petit = importer(&panoramique(256), "petit.hdr", &dossier).unwrap();
        assert_eq!(petit.environnement3d.unwrap().copie, "original");
        // Un fichier qui n'est pas un HDR est refusé.
        assert!(importer(b"pas une image", "faux.hdr", &dossier).is_err());
        let _ = fs::remove_dir_all(&dossier);
    }
}
