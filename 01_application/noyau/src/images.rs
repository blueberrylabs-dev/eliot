//! Import des images : empreinte, original rangé une seule fois, image redressée selon
//! l'appareil photo, aperçu (2560 px au plus) et miniature (256 px) pour l'interface. Les
//! vidéos (étape 4, `videos.rs`) sont rangées au même endroit, avec quelques fichiers de plus,
//! et les sons aussi (lot 5, `sons.rs`), sans aperçu ni miniature.
//!
//! Rangement dans le dossier des ressources :
//! `originaux/<empreinte>.<ext>`, `apercus/<empreinte>.(jpg|png)`,
//! `miniatures/<empreinte>.(jpg|png)`, `infos/<empreinte>.json` ; pour une vidéo, aussi
//! `copies/`, `vignettes/` et `ondes/` ; pour un son, `copies/` et `ondes/` seulement.

use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

use fast_image_resize::{FilterType, IntoImageView, ResizeAlg, ResizeOptions, Resizer};
use image::codecs::jpeg::JpegEncoder;
use image::codecs::png::PngEncoder;
use image::{DynamicImage, ImageDecoder, ImageEncoder, ImageReader};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

use crate::fichiers::ecrire_atomiquement;
use crate::sons::{self, InfosSon};
use crate::videos::{self, InfosVideo};

pub const COTE_APERCU: u32 = 2560;
pub const COTE_MINIATURE: u32 = 256;
const QUALITE_JPEG: u8 = 88;

#[derive(Debug, Error)]
pub enum ErreurImage {
    #[error("lecture impossible : {0}")]
    Lecture(#[from] std::io::Error),
    #[error("format d'image non reconnu ou non pris en charge")]
    FormatInconnu,
    #[error("image illisible : {0}")]
    Decodage(String),
    #[error("réduction impossible : {0}")]
    Reduction(String),
    #[error("identifiant de ressource invalide")]
    IdentifiantInvalide,
}

/// Ce que l'interface reçoit : jamais l'image elle-même, seulement de quoi la désigner.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Ressource {
    /// Empreinte SHA-256 du fichier d'origine, en hexadécimal.
    pub id: String,
    pub nom: String,
    /// Dimensions après redressement.
    pub largeur: u32,
    pub hauteur: u32,
    pub transparence: bool,
    /// Extension de l'aperçu et de la miniature : `jpg` ou `png` (si transparence).
    pub format_apercu: String,
    /// D'où vient l'image quand elle n'est pas d'Alexandre (photo Pixabay : auteur et lien).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub credit: Option<Credit>,
    /// Pour une vidéo (étape 4) : durée, son, copie d'aperçu, vignettes. Absent pour une image.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub video: Option<InfosVideo>,
    /// Pour un son (lot 5) : durée, copie d'écoute, niveau. Ni dimensions, ni aperçu.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub son: Option<InfosSon>,
    /// Pour un modèle 3D (étape 6) : format, copie de la fenêtre, animations, matières.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub modele3d: Option<crate::modeles3d::InfosModele3d>,
    /// Pour un environnement HDRI (étape 6, lot 3) : format, copie de la fenêtre.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub environnement3d: Option<crate::environnements3d::InfosEnvironnement3d>,
}

/// Le crédit d'une image, d'une vidéo ou d'un son venus d'une banque (BRIEF, règle 12).
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Credit {
    /// `Pixabay`, `Pexels`, `Freesound`, `Poly Haven`, `Sketchfab`, `Kenney`.
    pub source: String,
    pub auteur: String,
    /// La page de la photo ou du son sur le site d'origine.
    pub lien: String,
    /// La page de l'auteur sur le site d'origine (Pexels : celle du photographe, que ses règles
    /// demandent de citer).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lien_auteur: Option<String>,
    /// Un son de Freesound : sa licence (`CC0 1.0`, `CC BY 4.0`) et son titre.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub licence: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub titre: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Genre {
    Original,
    Apercu,
    Miniature,
    /// Vidéo : la copie d'aperçu jouée dans la fenêtre ; son : la copie d'écoute.
    Copie,
    /// Vidéo : la bande des vignettes de la frise.
    Vignettes,
    /// Vidéo avec du son, ou son : la forme d'onde (JSON).
    Onde,
}

fn empreinte(octets: &[u8]) -> String {
    let somme = Sha256::digest(octets);
    somme.iter().map(|o| format!("{o:02x}")).collect()
}

/// Un identifiant venant de l'interface doit être une empreinte, rien d'autre : il sert à
/// construire un chemin, il ne doit pas pouvoir en sortir.
pub fn identifiant_valide(id: &str) -> bool {
    id.len() == 64 && id.bytes().all(|o| o.is_ascii_hexdigit() && !o.is_ascii_uppercase())
}

/// Récrit la fiche d'une ressource (un crédit ajouté après l'import).
pub fn enregistrer_infos(dossier: &Path, ressource: &Ressource) -> Result<(), ErreurImage> {
    if !identifiant_valide(&ressource.id) {
        return Err(ErreurImage::IdentifiantInvalide);
    }
    let infos = serde_json::to_vec_pretty(ressource).map_err(|e| ErreurImage::Decodage(e.to_string()))?;
    ecrire_atomiquement(&chemin_infos(dossier, &ressource.id), &infos)?;
    Ok(())
}

fn chemin_infos(dossier: &Path, id: &str) -> PathBuf {
    dossier.join("infos").join(format!("{id}.json"))
}

/// Les informations d'une ressource déjà importée (dimensions, vidéo).
pub fn infos(dossier: &Path, id: &str) -> Result<Ressource, ErreurImage> {
    if !identifiant_valide(id) {
        return Err(ErreurImage::IdentifiantInvalide);
    }
    serde_json::from_slice(&fs::read(chemin_infos(dossier, id))?).map_err(|e| ErreurImage::Decodage(e.to_string()))
}

/// Chemin d'un fichier rangé, pour une ressource déjà importée.
pub fn chemin_ressource(dossier: &Path, id: &str, genre: Genre) -> Result<PathBuf, ErreurImage> {
    if !identifiant_valide(id) {
        return Err(ErreurImage::IdentifiantInvalide);
    }
    let infos: Ressource = serde_json::from_slice(&fs::read(chemin_infos(dossier, id))?)
        .map_err(|e| ErreurImage::Decodage(e.to_string()))?;
    let video = || infos.video.as_ref().ok_or(ErreurImage::IdentifiantInvalide);
    if let Some(son) = &infos.son {
        return match genre {
            Genre::Copie => Ok(dossier.join("copies").join(format!("{id}.{}", son.copie))),
            Genre::Onde => Ok(dossier.join("ondes").join(format!("{id}.json"))),
            Genre::Original => original(dossier, id),
            Genre::Apercu | Genre::Miniature | Genre::Vignettes => Err(ErreurImage::IdentifiantInvalide),
        };
    }
    if infos.environnement3d.is_some() {
        return match genre {
            Genre::Copie => crate::environnements3d::chemin_copie(dossier, &infos).ok_or(ErreurImage::IdentifiantInvalide),
            Genre::Original => original(dossier, id),
            Genre::Apercu => Ok(dossier.join("apercus").join(format!("{id}.png"))),
            Genre::Miniature => Ok(dossier.join("miniatures").join(format!("{id}.png"))),
            Genre::Vignettes | Genre::Onde => Err(ErreurImage::IdentifiantInvalide),
        };
    }
    if infos.modele3d.is_some() {
        return match genre {
            Genre::Copie => crate::modeles3d::chemin_copie(dossier, &infos).ok_or(ErreurImage::IdentifiantInvalide),
            Genre::Original => original(dossier, id),
            Genre::Apercu => Ok(dossier.join("apercus").join(format!("{id}.png"))),
            Genre::Miniature => Ok(dossier.join("miniatures").join(format!("{id}.png"))),
            Genre::Vignettes | Genre::Onde => Err(ErreurImage::IdentifiantInvalide),
        };
    }
    Ok(match genre {
        Genre::Copie => dossier.join("copies").join(format!("{id}.{}", video()?.copie)),
        Genre::Vignettes => {
            video()?;
            dossier.join("vignettes").join(format!("{id}.jpg"))
        }
        Genre::Onde => {
            if !video()?.son {
                return Err(ErreurImage::IdentifiantInvalide);
            }
            dossier.join("ondes").join(format!("{id}.json"))
        }
        Genre::Apercu => dossier.join("apercus").join(format!("{id}.{}", infos.format_apercu)),
        Genre::Miniature => dossier.join("miniatures").join(format!("{id}.{}", infos.format_apercu)),
        Genre::Original => original(dossier, id)?,
    })
}

fn original(dossier: &Path, id: &str) -> Result<PathBuf, ErreurImage> {
    fs::read_dir(dossier.join("originaux"))?
        .flatten()
        .map(|e| e.path())
        .find(|p| p.file_stem().is_some_and(|s| s == id))
        .ok_or(ErreurImage::IdentifiantInvalide)
}

/// Décode en appliquant l'orientation enregistrée par l'appareil photo (EXIF).
pub(crate) fn decoder_redresse(octets: &[u8]) -> Result<DynamicImage, ErreurImage> {
    let lecteur = ImageReader::new(Cursor::new(octets))
        .with_guessed_format()
        .map_err(ErreurImage::Lecture)?;
    let mut decodeur = lecteur.into_decoder().map_err(|e| ErreurImage::Decodage(e.to_string()))?;
    let orientation = decodeur.orientation().map_err(|e| ErreurImage::Decodage(e.to_string()))?;
    let mut image = DynamicImage::from_decoder(decodeur).map_err(|e| ErreurImage::Decodage(e.to_string()))?;
    image.apply_orientation(orientation);
    Ok(image)
}

/// Réduit pour que le grand côté ne dépasse pas `cote` (jamais d'agrandissement).
pub(crate) fn reduire(image: &DynamicImage, cote: u32) -> Result<DynamicImage, ErreurImage> {
    let (l, h) = (image.width(), image.height());
    if l.max(h) <= cote {
        return Ok(image.clone());
    }
    let echelle = cote as f64 / l.max(h) as f64;
    let (nl, nh) = (((l as f64) * echelle).round().max(1.0) as u32, ((h as f64) * echelle).round().max(1.0) as u32);
    let type_pixel = image.pixel_type().ok_or_else(|| ErreurImage::Reduction("type de pixel".into()))?;
    let mut sortie = fast_image_resize::images::Image::new(nl, nh, type_pixel);
    let options = ResizeOptions::new().resize_alg(ResizeAlg::Convolution(FilterType::Lanczos3));
    Resizer::new()
        .resize(image, &mut sortie, &options)
        .map_err(|e| ErreurImage::Reduction(e.to_string()))?;
    let tampon = sortie.into_vec();
    let resultat = if image.color().has_alpha() {
        image::RgbaImage::from_raw(nl, nh, tampon).map(DynamicImage::ImageRgba8)
    } else {
        image::RgbImage::from_raw(nl, nh, tampon).map(DynamicImage::ImageRgb8)
    };
    resultat.ok_or_else(|| ErreurImage::Reduction("tampon de taille inattendue".into()))
}

pub(crate) fn encoder(image: &DynamicImage, png: bool) -> Result<Vec<u8>, ErreurImage> {
    let mut sortie = Vec::new();
    let resultat = if png {
        let rgba = image.to_rgba8();
        PngEncoder::new(&mut sortie).write_image(rgba.as_raw(), rgba.width(), rgba.height(), image::ExtendedColorType::Rgba8)
    } else {
        let rgb = image.to_rgb8();
        JpegEncoder::new_with_quality(&mut sortie, QUALITE_JPEG).encode(rgb.as_raw(), rgb.width(), rgb.height(), image::ExtendedColorType::Rgb8)
    };
    resultat.map_err(|e| ErreurImage::Decodage(e.to_string()))?;
    Ok(sortie)
}

/// Importe une image à partir de ses octets. Si la même image a déjà été importée, rien
/// n'est recalculé : on relit ses informations.
pub fn importer(octets: &[u8], nom: &str, dossier: &Path) -> Result<Ressource, ErreurImage> {
    let id = empreinte(octets);
    if let Ok(texte) = fs::read(chemin_infos(dossier, &id)) {
        if let Ok(mut deja) = serde_json::from_slice::<Ressource>(&texte) {
            deja.nom = nom.to_string();
            return Ok(deja);
        }
    }

    let format = image::guess_format(octets).map_err(|_| ErreurImage::FormatInconnu)?;
    let extension = format.extensions_str().first().copied().unwrap_or("img");
    let image = decoder_redresse(octets)?;
    // Une image en niveaux de gris ou en 16 bits est ramenée à 8 bits par canal.
    let transparence = image.color().has_alpha();
    let image = if transparence {
        DynamicImage::ImageRgba8(image.to_rgba8())
    } else {
        DynamicImage::ImageRgb8(image.to_rgb8())
    };
    let format_apercu = if transparence { "png" } else { "jpg" };

    let apercu = reduire(&image, COTE_APERCU)?;
    let miniature = reduire(&apercu, COTE_MINIATURE)?;

    for sous_dossier in ["originaux", "apercus", "miniatures", "infos"] {
        fs::create_dir_all(dossier.join(sous_dossier))?;
    }
    ecrire_atomiquement(&dossier.join("originaux").join(format!("{id}.{extension}")), octets)?;
    ecrire_atomiquement(&dossier.join("apercus").join(format!("{id}.{format_apercu}")), &encoder(&apercu, transparence)?)?;
    ecrire_atomiquement(&dossier.join("miniatures").join(format!("{id}.{format_apercu}")), &encoder(&miniature, transparence)?)?;

    let ressource = Ressource {
        id: id.clone(),
        nom: nom.to_string(),
        largeur: image.width(),
        hauteur: image.height(),
        transparence,
        format_apercu: format_apercu.to_string(),
        credit: None,
        video: None,
        son: None,
        modele3d: None,
        environnement3d: None,
    };
    let infos = serde_json::to_vec_pretty(&ressource).map_err(|e| ErreurImage::Decodage(e.to_string()))?;
    ecrire_atomiquement(&chemin_infos(dossier, &id), &infos)?;
    Ok(ressource)
}

/// Importe une image venue d'une banque d'images et garde son crédit avec elle.
pub fn importer_avec_credit(octets: &[u8], nom: &str, dossier: &Path, credit: Credit) -> Result<Ressource, ErreurImage> {
    let mut ressource = importer(octets, nom, dossier)?;
    ressource.credit = Some(credit);
    let infos = serde_json::to_vec_pretty(&ressource).map_err(|e| ErreurImage::Decodage(e.to_string()))?;
    ecrire_atomiquement(&chemin_infos(dossier, &ressource.id), &infos)?;
    Ok(ressource)
}

pub fn importer_fichier(chemin: &Path, dossier: &Path) -> Result<Ressource, ErreurImage> {
    let octets = fs::read(chemin)?;
    let nom = chemin.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    importer(&octets, &nom, dossier)
}

/// Plusieurs images à la fois, une par cœur disponible.
pub fn importer_plusieurs(chemins: &[PathBuf], dossier: &Path) -> Vec<Result<Ressource, ErreurImage>> {
    chemins.par_iter().map(|c| importer_fichier(c, dossier)).collect()
}

/// Les images rangées dans un dossier de ressources, la plus récemment importée d'abord.
pub fn lister(dossier: &Path) -> Vec<Ressource> {
    let Ok(entrees) = fs::read_dir(dossier.join("infos")) else { return Vec::new() };
    let mut liste: Vec<(std::time::SystemTime, Ressource)> = entrees
        .flatten()
        .filter_map(|entree| {
            let chemin = entree.path();
            let id = chemin.file_stem()?.to_string_lossy().into_owned();
            if !identifiant_valide(&id) || chemin.extension().is_none_or(|e| e != "json") {
                return None;
            }
            let ressource: Ressource = serde_json::from_slice(&fs::read(&chemin).ok()?).ok()?;
            let date = entree.metadata().and_then(|m| m.modified()).unwrap_or(std::time::UNIX_EPOCH);
            Some((date, ressource))
        })
        .collect();
    liste.sort_by(|a, b| b.0.cmp(&a.0));
    liste.into_iter().map(|(_, r)| r).collect()
}

fn copier_atomiquement(source: &Path, cible: &Path) -> Result<(), ErreurImage> {
    if cible.exists() {
        return Ok(());
    }
    ecrire_atomiquement(cible, &fs::read(source)?)?;
    Ok(())
}

/// Copie des images d'un dossier de ressources vers un autre (coller entre deux designs),
/// vidéos et sons compris. Une ressource déjà présente dans la cible n'est pas recopiée.
pub fn copier(source: &Path, cible: &Path, ids: &[String]) -> Result<Vec<Ressource>, ErreurImage> {
    for sous_dossier in ["originaux", "apercus", "miniatures", "infos", "copies", "vignettes", "ondes", "masques"] {
        fs::create_dir_all(cible.join(sous_dossier))?;
    }
    let mut copiees = Vec::new();
    for id in ids {
        let original = chemin_ressource(source, id, Genre::Original)?;
        let infos: Ressource = serde_json::from_slice(&fs::read(chemin_infos(source, id))?)
            .map_err(|e| ErreurImage::Decodage(e.to_string()))?;
        let nom_original = original.file_name().expect("fichier nommé");
        copier_atomiquement(&original, &cible.join("originaux").join(nom_original))?;
        // Un son n'a ni aperçu ni miniature ; un modèle 3D peut ne pas encore avoir la sienne.
        let genres: &[Genre] = if infos.son.is_some() { &[] } else { &[Genre::Apercu, Genre::Miniature] };
        for genre in genres {
            let depuis = chemin_ressource(source, id, *genre)?;
            if infos.modele3d.is_some() && !depuis.exists() {
                continue;
            }
            let relatif = depuis.strip_prefix(source).expect("sous la source");
            copier_atomiquement(&depuis, &cible.join(relatif))?;
        }
        // Une vidéo emporte sa copie d'aperçu, ses vignettes et sa forme d'onde ; un son, sa
        // copie d'écoute et sa forme d'onde ; une photo détourée, ses masques (lot 7).
        for depuis in videos::fichiers_en_plus(source, &infos)
            .into_iter()
            .chain(sons::fichiers_en_plus(source, &infos))
            .chain(crate::detourage::masques_de(source, id))
            .chain(crate::modeles3d::fichiers_en_plus(source, &infos))
            .chain(crate::environnements3d::fichiers_en_plus(source, &infos))
        {
            let relatif = depuis.strip_prefix(source).expect("sous la source");
            copier_atomiquement(&depuis, &cible.join(relatif))?;
        }
        copier_atomiquement(&chemin_infos(source, id), &chemin_infos(cible, id))?;
        copiees.push(infos);
    }
    Ok(copiees)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dossier_de_test(nom: &str) -> PathBuf {
        let dossier = std::env::temp_dir().join(format!("eliot-images-{nom}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dossier);
        dossier
    }

    fn jpeg(l: u32, h: u32) -> Vec<u8> {
        let image = DynamicImage::ImageRgb8(image::RgbImage::from_fn(l, h, |x, y| image::Rgb([(x % 256) as u8, (y % 256) as u8, 90])));
        encoder(&image, false).unwrap()
    }

    #[test]
    fn une_photo_de_banque_garde_son_credit() {
        let dossier = dossier_de_test("credit");
        let credit = Credit { source: "Pixabay".into(), auteur: "Anne".into(), lien: "https://pixabay.com/photos/chat-11/".into(), ..Credit::default() };
        let r = importer_avec_credit(&jpeg(64, 48), "pixabay-chat-11.jpg", &dossier, credit.clone()).unwrap();
        assert_eq!(r.credit.as_ref(), Some(&credit));
        assert_eq!(lister(&dossier)[0].credit.as_ref(), Some(&credit), "le crédit est rangé avec l'image");
        // Une image sans crédit n'écrit pas de champ vide.
        let simple = importer(&jpeg(32, 32), "a.jpg", &dossier).unwrap();
        let infos = fs::read_to_string(chemin_infos(&dossier, &simple.id)).unwrap();
        assert!(!infos.contains("credit"), "{infos}");
        fs::remove_dir_all(&dossier).unwrap();
    }

    #[test]
    fn une_grande_photo_donne_un_apercu_de_2560_px_et_une_miniature() {
        let dossier = dossier_de_test("grande");
        let r = importer(&jpeg(4000, 3000), "photo.jpg", &dossier).unwrap();
        assert_eq!((r.largeur, r.hauteur), (4000, 3000));
        assert!(!r.transparence);
        assert!(identifiant_valide(&r.id));
        let apercu = image::open(chemin_ressource(&dossier, &r.id, Genre::Apercu).unwrap()).unwrap();
        assert_eq!((apercu.width(), apercu.height()), (2560, 1920));
        let miniature = image::open(chemin_ressource(&dossier, &r.id, Genre::Miniature).unwrap()).unwrap();
        assert_eq!(miniature.width().max(miniature.height()), 256);
        assert!(chemin_ressource(&dossier, &r.id, Genre::Original).unwrap().exists());
        fs::remove_dir_all(&dossier).unwrap();
    }

    #[test]
    fn la_meme_image_n_est_rangee_qu_une_fois() {
        let dossier = dossier_de_test("double");
        let octets = jpeg(300, 200);
        let a = importer(&octets, "a.jpg", &dossier).unwrap();
        let b = importer(&octets, "b.jpg", &dossier).unwrap();
        assert_eq!(a.id, b.id);
        assert_eq!(b.nom, "b.jpg");
        assert_eq!(fs::read_dir(dossier.join("originaux")).unwrap().count(), 1);
        fs::remove_dir_all(&dossier).unwrap();
    }

    #[test]
    fn la_transparence_est_gardee_en_png() {
        let dossier = dossier_de_test("transparence");
        let image = DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(100, 50, image::Rgba([10, 20, 30, 0])));
        let r = importer(&encoder(&image, true).unwrap(), "logo.png", &dossier).unwrap();
        assert!(r.transparence);
        assert_eq!(r.format_apercu, "png");
        let apercu = image::open(chemin_ressource(&dossier, &r.id, Genre::Apercu).unwrap()).unwrap();
        assert!(apercu.color().has_alpha());
        fs::remove_dir_all(&dossier).unwrap();
    }

    #[test]
    fn l_orientation_de_l_appareil_photo_est_appliquee() {
        // Fichier synthétique de 40 x 20 marqué « orientation 6 » : redressé, 20 x 40.
        let dossier = dossier_de_test("orientation");
        let octets = fs::read(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/donnees/oriente_6.jpg")).unwrap();
        let r = importer(&octets, "oriente.jpg", &dossier).unwrap();
        assert_eq!((r.largeur, r.hauteur), (20, 40));
        fs::remove_dir_all(&dossier).unwrap();
    }

    #[test]
    fn un_identifiant_douteux_est_refuse() {
        let dossier = dossier_de_test("douteux");
        assert!(matches!(chemin_ressource(&dossier, "../../etc/passwd", Genre::Apercu), Err(ErreurImage::IdentifiantInvalide)));
        assert!(!identifiant_valide(&"A".repeat(64)));
    }

    #[test]
    fn les_images_se_listent_et_se_copient_d_un_design_a_l_autre() {
        let (a, b) = (dossier_de_test("copie-a"), dossier_de_test("copie-b"));
        let r1 = importer(&jpeg(300, 200), "un.jpg", &a).unwrap();
        let r2 = importer(&jpeg(200, 300), "deux.jpg", &a).unwrap();
        let ids: Vec<String> = lister(&a).into_iter().map(|r| r.id).collect();
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&r1.id) && ids.contains(&r2.id));

        let copiees = copier(&a, &b, std::slice::from_ref(&r2.id)).unwrap();
        assert_eq!(copiees[0].id, r2.id);
        assert!(chemin_ressource(&b, &r2.id, Genre::Original).unwrap().exists());
        assert!(chemin_ressource(&b, &r2.id, Genre::Apercu).unwrap().exists());
        assert_eq!(lister(&b).len(), 1);
        // Recopier ne fait rien de plus ; un identifiant douteux est refusé.
        copier(&a, &b, std::slice::from_ref(&r2.id)).unwrap();
        assert!(copier(&a, &b, &["../x".to_string()]).is_err());
        fs::remove_dir_all(&a).unwrap();
        fs::remove_dir_all(&b).unwrap();
    }

    #[test]
    fn un_fichier_qui_n_est_pas_une_image_est_refuse() {
        let dossier = dossier_de_test("texte");
        assert!(matches!(importer(b"bonjour", "x.txt", &dossier), Err(ErreurImage::FormatInconnu)));
    }
}
