//! L'export d'une page depuis le document (étape 5, lot 1) : le noyau rend lui-même la page,
//! décrite en calques par la fenêtre comme pour le film (`src/export/calques.ts`), avec les
//! originaux des photos et des vidéos et les mêmes fichiers de police (règle 7 : l'export ne
//! dépend pas de l'écran).
//!
//! - Image : PNG, JPEG ou WebP, de 0,1 à 8 fois la taille de la page (la fenêtre propose ×1 à
//!   ×4, ou 150 et 300 dpi pour une affiche A4 de 2480 × 3508 px, 300 dpi à ×1). Le rendu est
//!   celui d'une image du film (`montage.rs`), au pixel près ; le WebP passe par l'encodeur
//!   libwebp du `ffmpeg` du système.
//! - SVG : la page en un seul document, chaque calque à sa place, puis relu et réécrit par
//!   `usvg` : les textes deviennent des tracés et les photos sont dedans. Il s'ouvre partout
//!   tel quel, sans les polices.
//! - PDF : toutes les pages en un fichier, par `krilla` (MIT ou Apache-2.0) : formes et textes
//!   restent vectoriels, les textes se sélectionnent (polices incluses, réduites aux lettres
//!   employées), les photos JPEG passent sans être recompressées. Une page A4 ou A5 (à 300 dpi)
//!   prend la taille du papier ; une autre compte 96 pixels par pouce.
//!
//! Le PDF et le SVG posent chaque élément à sa place à l'instant demandé, le texte au repos :
//! ni effets lettre par lettre, ni volets (ce qui ne se voit que pendant la lecture).

use std::collections::HashMap;
use std::fmt::Write as _;
use std::fs;
use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Arc;

use base64::Engine;
use resvg::usvg;
use serde::Deserialize;
use thiserror::Error;

use crate::export::{self, ErreurExport, Format};
use crate::images::{self, Genre};
use crate::labo;
use crate::montage::{self, Affine, Calque, DescriptionPage, ErreurMontage, FaceEliot, PoliceCalques};

#[derive(Debug, Error)]
pub enum ErreurRendu {
    #[error("{0}")]
    Montage(#[from] ErreurMontage),
    #[error("taille de l'image : {0}")]
    Taille(String),
    #[error("encodage : {0}")]
    Encodage(String),
    #[error("ffmpeg : {0} (commande 2 du CLAUDE.md)")]
    Ffmpeg(String),
    #[error("photo {0} : {1}")]
    Photo(String, String),
    #[error("SVG : {0}")]
    Svg(String),
    #[error("PDF : {0}")]
    Pdf(String),
    #[error("lecture : {0}")]
    Lecture(#[from] std::io::Error),
    #[error("{0}")]
    Export(#[from] ErreurExport),
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FormatImage {
    Png,
    Jpeg,
    Webp,
}

fn un() -> f64 {
    1.0
}

/// Ce que l'interface demande pour une image.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptionsImage {
    pub format: FormatImage,
    /// De 0,1 à 8 : une page de 1080 px à × 2 donne 2160 px.
    #[serde(default = "un")]
    pub echelle: f64,
    /// PNG et WebP : sans le fond de la page.
    #[serde(default)]
    pub transparent: bool,
    /// Une page vidéo : l'instant de la page (ms) ; une page fixe : 0.
    #[serde(default)]
    pub instant: f64,
}

/// Le plus grand côté d'une image exportée, et son nombre de pixels au plus (400 Mo en mémoire).
pub const COTE_MAX: u32 = 12_000;
pub const PIXELS_MAX: u64 = 100_000_000;
pub const QUALITE_JPEG: u8 = 92;
pub const QUALITE_WEBP: u8 = 90;

/// La taille de l'image en pixels.
pub fn taille(description: &DescriptionPage, echelle: f64) -> Result<(u32, u32), ErreurRendu> {
    if !(echelle.is_finite() && (0.1..=8.0).contains(&echelle)) {
        return Err(ErreurRendu::Taille(format!("échelle {echelle} hors de 0,1 à 8")));
    }
    let l = (description.largeur * echelle).round().max(1.0) as u64;
    let h = (description.hauteur * echelle).round().max(1.0) as u64;
    if l > COTE_MAX as u64 || h > COTE_MAX as u64 || l * h > PIXELS_MAX {
        return Err(ErreurRendu::Taille(format!("{l} × {h} pixels : au plus {COTE_MAX} de côté et {} millions de pixels", PIXELS_MAX / 1_000_000)));
    }
    Ok((l as u32, h as u32))
}

/// La page en image, encodée.
pub fn image(description: &DescriptionPage, o: &OptionsImage, dossier_ressources: &Path) -> Result<Vec<u8>, ErreurRendu> {
    let (l, h) = taille(description, o.echelle)?;
    let transparent = o.transparent && o.format != FormatImage::Jpeg;
    let pixmap = montage::rendre_instant(description, l, h, o.instant, transparent, dossier_ressources)?;
    match o.format {
        FormatImage::Png => pixmap.encode_png().map_err(|e| ErreurRendu::Encodage(e.to_string())),
        FormatImage::Jpeg => {
            // Pixels prémultipliés posés sur du blanc : c + (255 - a).
            let rgb: Vec<u8> = pixmap.data().chunks_exact(4).flat_map(|p| [p[0].saturating_add(255 - p[3]), p[1].saturating_add(255 - p[3]), p[2].saturating_add(255 - p[3])]).collect();
            let mut sortie = Vec::new();
            image::codecs::jpeg::JpegEncoder::new_with_quality(&mut sortie, QUALITE_JPEG)
                .encode(&rgb, l, h, image::ExtendedColorType::Rgb8)
                .map_err(|e| ErreurRendu::Encodage(e.to_string()))?;
            Ok(sortie)
        }
        FormatImage::Webp => {
            let rgba: Vec<u8> = pixmap.pixels().iter().flat_map(|p| {
                let c = p.demultiply();
                [c.red(), c.green(), c.blue(), c.alpha()]
            }).collect();
            webp(&rgba, l, h, transparent)
        }
    }
}

/// Encode du RGBA en WebP par le `ffmpeg` du système (encodeur libwebp, qualité 90).
fn webp(rgba: &[u8], largeur: u32, hauteur: u32, transparent: bool) -> Result<Vec<u8>, ErreurRendu> {
    let mut c = Command::new("ffmpeg");
    c.args(["-hide_banner", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", &format!("{largeur}x{hauteur}"), "-i", "pipe:0", "-frames:v", "1", "-c:v", "libwebp", "-quality", &QUALITE_WEBP.to_string()]);
    if transparent {
        c.args(["-pix_fmt", "yuva420p"]);
    }
    c.args(["-f", "webp", "pipe:1"]).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut processus = c.spawn().map_err(|e| ErreurRendu::Ffmpeg(e.to_string()))?;
    let mut entree = processus.stdin.take().expect("entrée redirigée");
    let donnees = rgba.to_vec();
    let ecrivain = std::thread::spawn(move || entree.write_all(&donnees));
    let mut sortie = Vec::new();
    processus.stdout.take().expect("sortie redirigée").read_to_end(&mut sortie)?;
    let mut erreurs = String::new();
    let _ = processus.stderr.take().expect("erreurs redirigées").read_to_string(&mut erreurs);
    let etat = processus.wait()?;
    let _ = ecrivain.join();
    if !etat.success() || sortie.len() < 12 || &sortie[0..4] != b"RIFF" || &sortie[8..12] != b"WEBP" {
        return Err(ErreurRendu::Ffmpeg(format!("WebP non produit ({})", erreurs.trim())));
    }
    // Écrit dans un tuyau, ffmpeg ne peut pas revenir au début pour noter la taille du fichier
    // (au-delà de son tampon de 32 Ko) : il l'écrit à la fin, quatre octets en trop, et laisse 0
    // en tête ; des lecteurs (libwebp, Pillow) refusent alors le fichier. On garde les blocs
    // entiers et on note la taille.
    let mut fin = 12;
    while fin + 8 <= sortie.len() {
        let taille = u32::from_le_bytes(sortie[fin + 4..fin + 8].try_into().expect("quatre octets")) as usize;
        let suivant = fin + 8 + taille + (taille & 1);
        if suivant > sortie.len() {
            break;
        }
        fin = suivant;
    }
    if fin == 12 {
        return Err(ErreurRendu::Ffmpeg("WebP sans image".into()));
    }
    sortie.truncate(fin);
    let taille = u32::try_from(fin - 8).map_err(|_| ErreurRendu::Encodage("WebP trop grand".into()))?;
    sortie[4..8].copy_from_slice(&taille.to_le_bytes());
    Ok(sortie)
}

// ----------------------------------------------------------------------------------------
// La page en un seul SVG
// ----------------------------------------------------------------------------------------

/// Les modes de fusion du canevas que le SVG connaît (`mix-blend-mode`).
fn fusion_css(fusion: Option<&str>) -> Option<&'static str> {
    Some(match fusion? {
        "multiply" => "multiply",
        "screen" => "screen",
        "overlay" => "overlay",
        "darken" => "darken",
        "lighten" => "lighten",
        "color-dodge" => "color-dodge",
        "color-burn" => "color-burn",
        "hard-light" => "hard-light",
        "soft-light" => "soft-light",
        "difference" => "difference",
        "exclusion" => "exclusion",
        "hue" => "hue",
        "saturation" => "saturation",
        "color" => "color",
        "luminosity" => "luminosity",
        _ => return None,
    })
}

fn nombre(v: f64) -> String {
    let r = (v * 1e4).round() / 1e4;
    if r == r.trunc() { format!("{}", r as i64) } else { format!("{r}") }
}

fn matrice_svg(m: &Affine) -> String {
    let a = &m.0;
    format!("matrix({} {} {} {} {} {})", nombre(a[0]), nombre(a[1]), nombre(a[2]), nombre(a[3]), nombre(a[4]), nombre(a[5]))
}

/// Un calque SVG autonome (cadré sur sa boîte), posé à sa place dans le repère de l'élément.
fn calque_imbrique(svg: &str, x: f64, y: f64) -> Result<String, ErreurRendu> {
    let debut = svg.find("<svg").ok_or_else(|| ErreurRendu::Svg("calque sans balise svg".into()))?;
    Ok(format!("{}<svg x=\"{}\" y=\"{}\"{}", &svg[..debut], nombre(x), nombre(y), &svg[debut + 4..]))
}

/// Un calque posé : sa transformation (repère du calque vers la page), son opacité, sa fusion.
fn ouvrir_groupe(sortie: &mut String, m: &Affine, opacite: f64, fusion: Option<&str>) {
    let _ = write!(sortie, "<g transform=\"{}\"", matrice_svg(m));
    if opacite < 0.9999 {
        let _ = write!(sortie, " opacity=\"{}\"", nombre(opacite.clamp(0.0, 1.0)));
    }
    if let Some(f) = fusion_css(fusion) {
        let _ = write!(sortie, " style=\"mix-blend-mode:{f}\"");
    }
    sortie.push('>');
}

/// Une clé courte pour des réglages du labo (empreinte FNV-1a de leur JSON).
fn cle_reglages(r: &labo::Reglages) -> String {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for o in serde_json::to_string(r).unwrap_or_default().bytes() {
        h = (h ^ o as u64).wrapping_mul(0x0100_0000_01b3);
    }
    format!("{h:016x}")
}

/// La page à l'instant `t`, en un seul document SVG. Les photos y sont désignées par
/// `eliot:original/<empreinte>`, une photo retouchée par le labo par
/// `eliot:retouche/<empreinte>/<clé des réglages>`, l'image d'une vidéo par
/// `eliot:video/<empreinte>/<ms>` : `Images::lire` sait les lire.
pub fn composer_svg(description: &DescriptionPage, t: f64, dossier_ressources: &Path) -> Result<String, ErreurRendu> {
    Ok(composer_svg_retouches(description, t, dossier_ressources)?.0)
}

/// Le même, avec les réglages du labo que le SVG désigne par leur clé.
fn composer_svg_retouches(description: &DescriptionPage, t: f64, dossier_ressources: &Path) -> Result<(String, Vec<(String, labo::Reglages)>), ErreurRendu> {
    let poses = montage::poses_vectorielles(description, t, dossier_ressources)?;
    let mut retouches: Vec<(String, labo::Reglages)> = Vec::new();
    let (l, h) = (description.largeur, description.hauteur);
    let mut corps = String::new();
    let mut defs = String::new();
    let mut n = 0usize;
    let mut poser = |corps: &mut String, defs: &mut String, c: &Calque, element: &Affine, opacite_el: f64, echelle_ombre: f64, instant_video: Option<f64>, retouche: Option<&(String, labo::Reglages)>| -> Result<(), ErreurRendu> {
        match c {
            Calque::Svg { svg, boite, ombre, opacite, fusion, unite } => {
                // Un sous-titre garde ses lettres ordinaires ; la variante du mot prononcé ne
                // sert qu'à la lecture.
                if unite.is_some_and(|u| u.actif) {
                    return Ok(());
                }
                let op = opacite_el * opacite;
                if op <= 0.001 {
                    return Ok(());
                }
                // L'ombre se décale dans le repère de la page, comme celle d'un canevas.
                let m = match ombre {
                    Some(o) => Affine::translation(o.dx * echelle_ombre, o.dy * echelle_ombre).fois(element),
                    None => *element,
                };
                ouvrir_groupe(corps, &m, op, fusion.as_deref());
                corps.push_str(&calque_imbrique(svg, boite.x0, boite.y0)?);
                corps.push_str("</g>");
            }
            Calque::Image { ressource, matrice, decoupes, opacite, fusion, unite, .. } | Calque::Video { ressource, matrice, decoupes, opacite, fusion, unite, .. } => {
                if unite.is_some_and(|u| u.actif) || !images::identifiant_valide(ressource) {
                    return Ok(());
                }
                let op = opacite_el * opacite;
                if op <= 0.001 {
                    return Ok(());
                }
                ouvrir_groupe(corps, element, op, fusion.as_deref());
                for d in decoupes {
                    n += 1;
                    let _ = write!(defs, "<clipPath id=\"eliot_d{n}\"><path d=\"{}\"/></clipPath>", d.replace('"', ""));
                    let _ = write!(corps, "<g clip-path=\"url(#eliot_d{n})\">");
                }
                let href = match (c, instant_video) {
                    (Calque::Video { .. }, Some(ms)) => format!("eliot:video/{ressource}/{}", ms.max(0.0).round() as u64),
                    (Calque::Video { .. }, None) => return Ok(()),
                    _ => match retouche {
                        Some((cle, _)) => format!("eliot:retouche/{ressource}/{cle}"),
                        None => format!("eliot:original/{ressource}"),
                    },
                };
                let _ = write!(corps, "<image width=\"1\" height=\"1\" preserveAspectRatio=\"none\" transform=\"{}\" xlink:href=\"{href}\"/>", matrice_svg(&Affine(*matrice)));
                for _ in decoupes {
                    corps.push_str("</g>");
                }
                corps.push_str("</g>");
            }
        }
        Ok(())
    };
    for c in &description.fond {
        poser(&mut corps, &mut defs, c, &Affine::IDENTITE, 1.0, 1.0, None, None)?;
    }
    for (e, pose) in description.elements.iter().zip(poses) {
        let Some(p) = pose else { continue };
        if p.opacite <= 0.001 {
            continue;
        }
        let retouche = montage::reglages_labo(&e.element).map(|r| (cle_reglages(&r), r));
        for c in &e.calques {
            poser(&mut corps, &mut defs, c, &p.matrice, p.opacite, p.echelle_ombre, p.instant_video, retouche.as_ref())?;
        }
        if let Some(r) = retouche
            && !retouches.iter().any(|(c, _)| *c == r.0)
        {
            retouches.push(r);
        }
    }
    let svg = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"{w}\" height=\"{h}\" viewBox=\"0 0 {w} {h}\"><defs>{defs}</defs>{corps}</svg>",
        w = nombre(l),
        h = nombre(h)
    );
    Ok((svg, retouches))
}

// ----------------------------------------------------------------------------------------
// Les photos et les images des vidéos, depuis les originaux
// ----------------------------------------------------------------------------------------

/// Le codage d'une photo emportée par le PDF ou le SVG.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Codage {
    Png,
    Jpeg,
}

/// Une adresse lue : la photo et son codage, ou rien (adresse inconnue, fichier illisible).
type Lue = Option<(Codage, Arc<Vec<u8>>)>;

/// Une photo telle que le PDF et le SVG l'emportent : le JPEG d'origine s'il est droit
/// (aucune rotation demandée par l'appareil photo) et sans retouche, sinon l'image redressée
/// et retouchée par le labo, à la définition de l'original, en JPEG (qualité 95) ou en PNG si
/// elle a de la transparence.
fn photo_vectorielle(dossier: &Path, id: &str, reglages: Option<&labo::Reglages>) -> Result<(Codage, Vec<u8>), ErreurRendu> {
    let chemin = images::chemin_ressource(dossier, id, Genre::Original).map_err(|e| ErreurRendu::Photo(id.into(), e.to_string()))?;
    let octets = fs::read(&chemin)?;
    if reglages.is_none() && octets.starts_with(&[0xFF, 0xD8, 0xFF]) {
        let droit = image::ImageReader::new(Cursor::new(&octets))
            .with_guessed_format()
            .ok()
            .and_then(|l| l.into_decoder().ok())
            .and_then(|mut d| image::ImageDecoder::orientation(&mut d).ok())
            .is_some_and(|o| o == image::metadata::Orientation::NoTransforms);
        if droit {
            return Ok((Codage::Jpeg, octets));
        }
    }
    if reglages.is_none() && octets.starts_with(&[0x89, b'P', b'N', b'G']) {
        return Ok((Codage::Png, octets));
    }
    let mut image = images::decoder_redresse(&octets).map_err(|e| ErreurRendu::Photo(id.into(), e.to_string()))?;
    if let Some(r) = reglages {
        let mut rgba = image.to_rgba8();
        let (l, h) = rgba.dimensions();
        labo::appliquer(&mut rgba, l, h, r, true);
        image = if image.color().has_alpha() { image::DynamicImage::ImageRgba8(rgba) } else { image::DynamicImage::ImageRgb8(image::DynamicImage::ImageRgba8(rgba).to_rgb8()) };
    }
    let mut sortie = Vec::new();
    if image.color().has_alpha() {
        image.write_to(&mut Cursor::new(&mut sortie), image::ImageFormat::Png).map_err(|e| ErreurRendu::Photo(id.into(), e.to_string()))?;
        Ok((Codage::Png, sortie))
    } else {
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut sortie, 95)
            .encode_image(&image.to_rgb8())
            .map_err(|e| ErreurRendu::Photo(id.into(), e.to_string()))?;
        Ok((Codage::Jpeg, sortie))
    }
}

/// L'image d'une vidéo à l'instant `ms` de son original, en PNG.
fn image_de_video(dossier: &Path, id: &str, ms: u64) -> Result<Vec<u8>, ErreurRendu> {
    let chemin = images::chemin_ressource(dossier, id, Genre::Original).map_err(|e| ErreurRendu::Photo(id.into(), e.to_string()))?;
    let s = Command::new("ffmpeg")
        .args(["-hide_banner", "-loglevel", "error", "-ss", &format!("{:.3}", ms as f64 / 1000.0), "-i"])
        .arg(&chemin)
        .args(["-frames:v", "1", "-f", "image2pipe", "-c:v", "png", "pipe:1"])
        .output()
        .map_err(|e| ErreurRendu::Ffmpeg(e.to_string()))?;
    if !s.status.success() || !s.stdout.starts_with(&[0x89, b'P', b'N', b'G']) {
        return Err(ErreurRendu::Ffmpeg(format!("image de la vidéo {id} à {ms} ms : {}", String::from_utf8_lossy(&s.stderr).trim())));
    }
    Ok(s.stdout)
}

/// Lit une adresse `eliot:` du SVG composé ; garde ce qu'elle a déjà lu, et ce qui n'a pas pu
/// l'être : une photo manquante fait échouer l'export plutôt que de laisser un trou.
struct Images {
    dossier: PathBuf,
    lues: std::sync::Mutex<HashMap<String, Lue>>,
    erreurs: std::sync::Mutex<Vec<String>>,
    /// Les réglages du labo désignés par les adresses `eliot:retouche/…/<clé>`.
    retouches: std::sync::Mutex<HashMap<String, labo::Reglages>>,
}

impl Images {
    fn nouvelles(dossier: &Path) -> Arc<Self> {
        Arc::new(Images { dossier: dossier.to_path_buf(), lues: Default::default(), erreurs: Default::default(), retouches: Default::default() })
    }

    fn connaitre(&self, retouches: Vec<(String, labo::Reglages)>) {
        if let Ok(mut m) = self.retouches.lock() {
            m.extend(retouches);
        }
    }

    /// La première photo qui n'a pas pu être lue.
    fn verifier(&self) -> Result<(), ErreurRendu> {
        match self.erreurs.lock().ok().and_then(|e| e.first().cloned()) {
            Some(e) => Err(ErreurRendu::Photo("introuvable ou illisible".into(), e)),
            None => Ok(()),
        }
    }

    fn lire(&self, href: &str) -> Lue {
        let lu = self.lire_sans_noter(href);
        if lu.is_none()
            && let Ok(mut e) = self.erreurs.lock()
        {
            e.push(href.trim_start_matches("eliot:").to_string());
        }
        lu
    }

    fn lire_sans_noter(&self, href: &str) -> Lue {
        if let Some(lu) = self.lues.lock().ok()?.get(href) {
            return lu.clone();
        }
        let lu = if let Some(id) = href.strip_prefix("eliot:original/") {
            match photo_vectorielle(&self.dossier, id, None) {
                Ok((g, o)) => Some((g, Arc::new(o))),
                Err(e) => {
                    self.erreurs.lock().ok()?.push(e.to_string());
                    None
                }
            }
        } else if let Some(reste) = href.strip_prefix("eliot:retouche/") {
            let (id, cle) = reste.split_once('/')?;
            let r = self.retouches.lock().ok()?.get(cle).cloned()?;
            match photo_vectorielle(&self.dossier, id, Some(&r)) {
                Ok((g, o)) => Some((g, Arc::new(o))),
                Err(e) => {
                    self.erreurs.lock().ok()?.push(e.to_string());
                    None
                }
            }
        } else if let Some(reste) = href.strip_prefix("eliot:video/") {
            let (id, ms) = reste.split_once('/')?;
            match image_de_video(&self.dossier, id, ms.parse().ok()?) {
                Ok(o) => Some((Codage::Png, Arc::new(o))),
                Err(e) => {
                    self.erreurs.lock().ok()?.push(e.to_string());
                    None
                }
            }
        } else if let Some(id) = href.strip_prefix("eliot:apercu/") {
            let chemin = images::chemin_ressource(&self.dossier, id, Genre::Apercu).ok()?;
            let o = fs::read(chemin).ok()?;
            let genre = if o.starts_with(&[0xFF, 0xD8]) { Codage::Jpeg } else { Codage::Png };
            Some((genre, Arc::new(o)))
        } else {
            None
        };
        self.lues.lock().ok()?.insert(href.to_string(), lu.clone());
        lu
    }
}

// ----------------------------------------------------------------------------------------
// SVG : relu et réécrit par usvg (textes en tracés, photos dedans)
// ----------------------------------------------------------------------------------------

/// La page en SVG autonome : textes en tracés, photos et images de vidéos dedans (base64).
pub fn svg(description: &DescriptionPage, t: f64, dossier_ressources: &Path) -> Result<Vec<u8>, ErreurRendu> {
    let (compose, retouches) = composer_svg_retouches(description, t, dossier_ressources)?;
    let mut options = montage::options_rendu(&description.polices, dossier_ressources)?;
    let images = Images::nouvelles(dossier_ressources);
    images.connaitre(retouches);
    let lecteur = images.clone();
    options.image_href_resolver = usvg::ImageHrefResolver {
        resolve_data: usvg::ImageHrefResolver::default_data_resolver(),
        resolve_string: Box::new(move |href: &str, _: &usvg::Options| {
            let (genre, octets) = lecteur.lire(href)?;
            Some(match genre {
                Codage::Jpeg => usvg::ImageKind::JPEG(octets),
                Codage::Png => usvg::ImageKind::PNG(octets),
            })
        }),
    };
    let arbre = usvg::Tree::from_str(&compose, &options).map_err(|e| ErreurRendu::Svg(e.to_string()))?;
    images.verifier()?;
    let texte = arbre.to_string(&usvg::WriteOptions::default());
    Ok(texte.into_bytes())
}

// ----------------------------------------------------------------------------------------
// PDF : krilla, textes vectoriels et sélectionnables
// ----------------------------------------------------------------------------------------

/// Points PDF par pixel de la page : une page A4 ou A5 d'Eliot (300 dpi) prend la taille du
/// papier ; une autre compte 96 pixels par pouce (1 px = 0,75 pt).
pub fn points_par_pixel(largeur: f64, hauteur: f64) -> f64 {
    let (a, b) = (largeur.round() as i64, hauteur.round() as i64);
    let papier = [(2480, 3508), (1748, 2480)];
    if papier.iter().any(|&(x, y)| (a, b) == (x, y) || (a, b) == (y, x)) {
        72.0 / 300.0
    } else {
        72.0 / 96.0
    }
}

/// Les polices de toutes les pages, une fois chacune.
fn polices_du_document(pages: &[(DescriptionPage, f64)]) -> Vec<PoliceCalques> {
    let mut vues = std::collections::HashSet::new();
    let mut toutes = Vec::new();
    for (d, _) in pages {
        for p in &d.polices {
            if vues.insert((p.famille.to_lowercase(), p.style.clone(), p.poids_min, p.poids_max)) {
                toutes.push(p.clone());
            }
        }
    }
    toutes
}

/// Les options de lecture du SVG composé pour le PDF : les polices de la fenêtre (même choix
/// de face que pour le film), celles du poste en secours, les photos depuis les originaux.
fn options_pdf(polices: &[PoliceCalques], images: Arc<Images>) -> Result<usvg_pdf::Options<'static>, ErreurRendu> {
    use usvg_pdf::fontdb;
    let mut base = fontdb::Database::new();
    base.load_system_fonts();
    let mut familles: HashMap<String, Vec<FaceEliot<fontdb::ID>>> = HashMap::new();
    for p in polices {
        let octets = base64::engine::general_purpose::STANDARD.decode(p.donnees.as_bytes()).map_err(|e| ErreurRendu::Pdf(format!("police {} : {e}", p.famille)))?;
        for id in base.load_font_source(fontdb::Source::Binary(Arc::new(octets))) {
            familles.entry(p.famille.to_lowercase()).or_default().push(FaceEliot { italique: p.style == "italic", poids_min: p.poids_min, poids_max: p.poids_max, id });
        }
    }
    let familles = Arc::new(familles);
    let defaut = usvg_pdf::FontResolver::default_font_selector();
    let font_resolver = usvg_pdf::FontResolver {
        select_font: Box::new(move |police, base| {
            let italique = police.style() != usvg_pdf::FontStyle::Normal;
            for famille in police.families() {
                if let usvg_pdf::FontFamily::Named(nom) = famille
                    && let Some(faces) = familles.get(&nom.to_lowercase())
                    && let Some(id) = montage::choisir_face(faces, italique, police.weight())
                {
                    return Some(id);
                }
            }
            defaut(police, base)
        }),
        select_fallback: usvg_pdf::FontResolver::default_fallback_selector(),
    };
    let image_href_resolver = usvg_pdf::ImageHrefResolver {
        resolve_data: usvg_pdf::ImageHrefResolver::default_data_resolver(),
        resolve_string: Box::new(move |href: &str, _: &usvg_pdf::Options| {
            let (genre, octets) = images.lire(href)?;
            Some(match genre {
                Codage::Jpeg => usvg_pdf::ImageKind::JPEG(octets),
                Codage::Png => usvg_pdf::ImageKind::PNG(octets),
            })
        }),
    };
    Ok(usvg_pdf::Options { fontdb: Arc::new(base), font_resolver, image_href_resolver, ..Default::default() })
}

/// Toutes les pages en un PDF : chaque page à son instant (une page fixe : 0).
pub fn pdf(pages: &[(DescriptionPage, f64)], dossier_ressources: &Path) -> Result<Vec<u8>, ErreurRendu> {
    pdf_suivi(pages, dossier_ressources, &mut |_, _| ())
}

/// Le même, avec `avancement(fait, total)` après chaque page.
pub fn pdf_suivi(pages: &[(DescriptionPage, f64)], dossier_ressources: &Path, avancement: &mut dyn FnMut(usize, usize)) -> Result<Vec<u8>, ErreurRendu> {
    use krilla::geom::Size;
    use krilla::page::PageSettings;
    use krilla_svg::{SurfaceExt, SvgSettings};
    if pages.is_empty() {
        return Err(ErreurRendu::Pdf("aucune page".into()));
    }
    let images = Images::nouvelles(dossier_ressources);
    let options = options_pdf(&polices_du_document(pages), images.clone())?;
    let mut document = krilla::Document::new();
    for (rang, (description, t)) in pages.iter().enumerate() {
        let (compose, retouches) = composer_svg_retouches(description, *t, dossier_ressources)?;
        images.connaitre(retouches);
        let arbre = usvg_pdf::Tree::from_str(&compose, &options).map_err(|e| ErreurRendu::Svg(e.to_string()))?;
        images.verifier()?;
        let k = points_par_pixel(description.largeur, description.hauteur);
        let (l, h) = ((description.largeur * k) as f32, (description.hauteur * k) as f32);
        let reglage = PageSettings::from_wh(l, h).ok_or_else(|| ErreurRendu::Pdf("taille de page".into()))?;
        let mut page = document.start_page_with(reglage);
        let mut surface = page.surface();
        let taille = Size::from_wh(l, h).ok_or_else(|| ErreurRendu::Pdf("taille de page".into()))?;
        surface.draw_svg(&arbre, taille, SvgSettings { embed_text: true, filter_scale: 4.0 }).ok_or_else(|| ErreurRendu::Pdf("page non dessinée".into()))?;
        surface.finish();
        page.finish();
        avancement(rang + 1, pages.len());
    }
    document.finish().map_err(|e| ErreurRendu::Pdf(format!("{e:?}")))
}

// ----------------------------------------------------------------------------------------
// L'export demandé par la fenêtre
// ----------------------------------------------------------------------------------------

/// Une page à exporter : sa description en calques (`src/export/calques.ts`) et l'instant
/// montré (une page fixe : 0).
#[derive(Debug, Clone, Deserialize)]
pub struct PageAExporter {
    pub description: DescriptionPage,
    #[serde(default)]
    pub instant: f64,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FormatDocument {
    Png,
    Jpeg,
    Webp,
    Pdf,
    Svg,
}

/// Ce que la fenêtre demande. Les polices viennent une fois pour toutes les pages (une page
/// dont la liste est vide prend celles-ci).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DemandeExport {
    pub format: FormatDocument,
    pub pages: Vec<PageAExporter>,
    #[serde(default)]
    pub polices: Vec<PoliceCalques>,
    #[serde(default = "un")]
    pub echelle: f64,
    #[serde(default)]
    pub transparent: bool,
}

/// Rend et écrit l'export : un PDF pour toutes les pages, sinon un fichier par page (`nom`,
/// puis `nom_page-01`, `nom_page-02`... s'il y en a plusieurs). Le chemin choisi dans
/// « Enregistrer sous » ne vaut que pour un seul fichier. `avancement(fait, total)` après chaque
/// page. Renvoie les chemins écrits.
pub fn exporter_document(
    mut demande: DemandeExport,
    dossier_ressources: &Path,
    dossier_par_defaut: &Path,
    nom: &str,
    chemin_choisi: Option<&Path>,
    avancement: &mut dyn FnMut(usize, usize),
) -> Result<Vec<PathBuf>, ErreurRendu> {
    if demande.pages.is_empty() {
        return Err(ErreurRendu::Taille("aucune page à exporter".into()));
    }
    for p in &mut demande.pages {
        if p.description.polices.is_empty() {
            p.description.polices = demande.polices.clone();
        }
    }
    let total = demande.pages.len();
    if demande.format == FormatDocument::Pdf {
        let pages: Vec<(DescriptionPage, f64)> = demande.pages.into_iter().map(|p| (p.description, p.instant)).collect();
        let octets = pdf_suivi(&pages, dossier_ressources, avancement)?;
        return Ok(vec![export::exporter(&octets, Format::Pdf, dossier_par_defaut, nom, chemin_choisi)?]);
    }
    let mut ecrits = Vec::with_capacity(total);
    for (rang, p) in demande.pages.iter().enumerate() {
        let (octets, format) = match demande.format {
            FormatDocument::Svg => (svg(&p.description, p.instant, dossier_ressources)?, Format::Svg),
            f => {
                let (format_image, format) = match f {
                    FormatDocument::Jpeg => (FormatImage::Jpeg, Format::Jpeg),
                    FormatDocument::Webp => (FormatImage::Webp, Format::Webp),
                    _ => (FormatImage::Png, Format::Png),
                };
                let o = OptionsImage { format: format_image, echelle: demande.echelle, transparent: demande.transparent, instant: p.instant };
                (image(&p.description, &o, dossier_ressources)?, format)
            }
        };
        let nom_page = if total > 1 { format!("{nom}_page-{:02}", rang + 1) } else { nom.to_string() };
        ecrits.push(export::exporter(&octets, format, dossier_par_defaut, &nom_page, if total == 1 { chemin_choisi } else { None })?);
        avancement(rang + 1, total);
    }
    Ok(ecrits)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn ffmpeg_present() -> bool {
        Command::new("ffmpeg").arg("-version").stdout(Stdio::null()).stderr(Stdio::null()).status().is_ok_and(|s| s.success())
    }

    fn dossier_de_test(nom: &str) -> PathBuf {
        let dossier = std::env::temp_dir().join(format!("eliot-rendu-{nom}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dossier);
        fs::create_dir_all(&dossier).unwrap();
        dossier
    }

    fn rectangle(l: f64, h: f64, couleur: &str) -> serde_json::Value {
        json!({ "genre": "svg", "svg": format!("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{l}\" height=\"{h}\" viewBox=\"0 0 {l} {h}\"><path d=\"M0 0L{l} 0L{l} {h}L0 {h}Z\" fill=\"{couleur}\"/></svg>"), "boite": { "x0": 0, "y0": 0, "x1": l, "y1": h }, "opacite": 1 })
    }

    /// Une photo de 400 × 200 : rouge à gauche, bleue à droite, rangée comme à l'import.
    fn photo(dossier: &Path) -> String {
        let mut img = image::RgbImage::new(400, 200);
        for (x, _, p) in img.enumerate_pixels_mut() {
            *p = if x < 200 { image::Rgb([230, 20, 20]) } else { image::Rgb([20, 20, 230]) };
        }
        let mut octets = Vec::new();
        image::DynamicImage::ImageRgb8(img).write_to(&mut Cursor::new(&mut octets), image::ImageFormat::Jpeg).unwrap();
        images::importer(&octets, "photo.jpg", dossier).unwrap().id
    }

    /// Une page de 600 × 400, fond blanc : un carré vert tourné de 90° en (100, 50), une photo
    /// en (300, 200) de 200 × 100 aux coins coupés par une découpe, à demi transparente.
    fn page(ressource: &str) -> DescriptionPage {
        serde_json::from_value(json!({
            "largeur": 600, "hauteur": 400, "duree": 0,
            "fond": [rectangle(600.0, 400.0, "#ffffff")],
            "elements": [
                { "element": { "id": "c", "type": "forme", "x": 200, "y": 50, "largeur": 100, "hauteur": 100, "rotation": 90, "opacite": 1, "visible": true },
                  "calques": [rectangle(100.0, 100.0, "#00c000")] },
                { "element": { "id": "p", "type": "image", "x": 300, "y": 200, "largeur": 200, "hauteur": 100, "rotation": 0, "opacite": 0.5, "visible": true, "ressource": ressource },
                  "calques": [{ "genre": "image", "ressource": ressource, "matrice": [200, 0, 0, 100, 0, 0], "decoupes": ["M10 0L190 0L200 10L200 90L190 100L10 100L0 90L0 10Z"], "boite": { "x0": 0, "y0": 0, "x1": 200, "y1": 100 }, "opacite": 1 }] }
            ],
            "polices": []
        }))
        .unwrap()
    }

    fn pixel(png: &[u8], x: u32, y: u32) -> [u8; 4] {
        image::load_from_memory(png).unwrap().to_rgba8().get_pixel(x, y).0
    }

    fn proche(a: [u8; 4], b: [u8; 4], tol: i32) -> bool {
        a.iter().zip(b).all(|(x, y)| (*x as i32 - y as i32).abs() <= tol)
    }

    #[test]
    fn l_image_suit_l_echelle_et_les_formats() {
        let dossier = dossier_de_test("image");
        let id = photo(&dossier);
        let p = page(&id);
        let png = image(&p, &OptionsImage { format: FormatImage::Png, echelle: 2.0, transparent: false, instant: 0.0 }, &dossier).unwrap();
        let lu = image::load_from_memory(&png).unwrap();
        assert_eq!((lu.width(), lu.height()), (1200, 800));
        // Le carré tourné de 90° autour de son coin (200, 50) couvre x de 100 à 200, y de 50 à 150.
        assert!(proche(pixel(&png, 300, 200), [0, 192, 0, 255], 8), "{:?}", pixel(&png, 300, 200));
        assert!(proche(pixel(&png, 450, 200), [255, 255, 255, 255], 2));
        // La photo à demi transparente sur le blanc : rouge pâle à gauche, bleu pâle à droite ;
        // le coin coupé reste blanc.
        assert!(proche(pixel(&png, 700, 500), [242, 137, 137, 255], 14), "{:?}", pixel(&png, 700, 500));
        assert!(proche(pixel(&png, 900, 500), [137, 137, 242, 255], 14), "{:?}", pixel(&png, 900, 500));
        assert!(proche(pixel(&png, 602, 402), [255, 255, 255, 255], 2), "{:?}", pixel(&png, 602, 402));
        // Fond transparent : plus de blanc.
        let transparent = image(&p, &OptionsImage { format: FormatImage::Png, echelle: 1.0, transparent: true, instant: 0.0 }, &dossier).unwrap();
        assert_eq!(pixel(&transparent, 500, 50)[3], 0);
        let jpeg = image(&p, &OptionsImage { format: FormatImage::Jpeg, echelle: 1.0, transparent: true, instant: 0.0 }, &dossier).unwrap();
        assert!(jpeg.starts_with(&[0xFF, 0xD8, 0xFF]));
        assert!(proche(pixel(&jpeg, 500, 50), [255, 255, 255, 255], 3), "un JPEG n'a pas de transparence");
        if ffmpeg_present() {
            let webp = image(&p, &OptionsImage { format: FormatImage::Webp, echelle: 1.0, transparent: true, instant: 0.0 }, &dossier).unwrap();
            assert!(webp.starts_with(b"RIFF") && &webp[8..12] == b"WEBP");
            assert_eq!(u32::from_le_bytes(webp[4..8].try_into().unwrap()) as usize, webp.len() - 8, "taille du fichier notée");
            // Plus de 32 Ko (le tampon de ffmpeg) : une image pleine de détails, à × 3.
            let mut bruit = p.clone();
            bruit.elements.clear();
            let mut svg = String::from("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"400\" viewBox=\"0 0 600 400\">");
            for i in 0..2400u32 {
                let (x, y) = (i.wrapping_mul(7919) % 600, i.wrapping_mul(104729) % 400);
                let _ = write!(svg, "<circle cx=\"{x}\" cy=\"{y}\" r=\"{}\" fill=\"#{:06x}\"/>", 2 + i % 9, i.wrapping_mul(2654435761) & 0xffffff);
            }
            svg.push_str("</svg>");
            bruit.fond = vec![serde_json::from_value(json!({ "genre": "svg", "svg": svg, "boite": { "x0": 0, "y0": 0, "x1": 600, "y1": 400 }, "opacite": 1 })).unwrap()];
            let gros = image(&bruit, &OptionsImage { format: FormatImage::Webp, echelle: 3.0, transparent: false, instant: 0.0 }, &dossier).unwrap();
            assert!(gros.len() > 100_000, "{} octets", gros.len());
            assert_eq!(u32::from_le_bytes(gros[4..8].try_into().unwrap()) as usize, gros.len() - 8);
            let blocs = &gros[12..];
            assert_eq!(u32::from_le_bytes(blocs[4..8].try_into().unwrap()) as usize + 8, blocs.len(), "un seul bloc VP8, rien après");
            assert_eq!(image::load_from_memory(&gros).unwrap().width(), 1800);
            let lu = image::load_from_memory(&webp).unwrap().to_rgba8();
            assert_eq!(lu.dimensions(), (600, 400));
            assert!(lu.get_pixel(500, 50)[3] < 10, "le WebP garde la transparence");
        }
        assert!(matches!(taille(&p, 30.0), Err(ErreurRendu::Taille(_))));
        let _ = fs::remove_dir_all(&dossier);
    }

    #[test]
    fn le_svg_compose_se_rend_comme_l_image() {
        let dossier = dossier_de_test("svg");
        let id = photo(&dossier);
        let p = page(&id);
        let compose = composer_svg(&p, 0.0, &dossier).unwrap();
        assert!(compose.contains(&format!("eliot:original/{id}")) && compose.contains("clip-path"), "{compose}");
        let ecrit = svg(&p, 0.0, &dossier).unwrap();
        let texte = String::from_utf8(ecrit.clone()).unwrap();
        assert!(texte.contains("data:image/jpeg;base64,"), "la photo est dans le SVG");
        assert!(!texte.contains("eliot:"), "plus d'adresse propre à Eliot");
        // Relu par resvg, il donne la même image que le rendu du noyau.
        let arbre = usvg::Tree::from_data(&ecrit, &usvg::Options::default()).unwrap();
        let mut rendu = resvg::tiny_skia::Pixmap::new(600, 400).unwrap();
        resvg::render(&arbre, resvg::tiny_skia::Transform::identity(), &mut rendu.as_mut());
        let png = image(&p, &OptionsImage { format: FormatImage::Png, echelle: 1.0, transparent: false, instant: 0.0 }, &dossier).unwrap();
        let attendu = image::load_from_memory(&png).unwrap().to_rgba8();
        let lu = image::load_from_memory(&rendu.encode_png().unwrap()).unwrap().to_rgba8();
        let ecart: f64 = attendu.as_raw().iter().zip(lu.as_raw()).map(|(a, b)| (*a as f64 - *b as f64).abs()).sum::<f64>() / attendu.as_raw().len() as f64;
        assert!(ecart < 1.5, "écart moyen {ecart}");
        let _ = fs::remove_dir_all(&dossier);
    }

    #[test]
    fn le_pdf_a_une_page_par_page_et_la_taille_du_papier() {
        let dossier = dossier_de_test("pdf");
        let id = photo(&dossier);
        let p = page(&id);
        let mut a4 = p.clone();
        a4.largeur = 2480.0;
        a4.hauteur = 3508.0;
        let octets = pdf(&[(p.clone(), 0.0), (a4, 0.0)], &dossier).unwrap();
        assert!(octets.starts_with(b"%PDF-"));
        let texte = String::from_utf8_lossy(&octets);
        // Deux pages : 600 px à 96 dpi font 450 pt ; l'A4 fait 595,2 × 841,92 pt.
        assert_eq!(texte.matches("/MediaBox[").count(), 2, "deux pages");
        assert!(texte.contains("/MediaBox[0 0 450 300]"), "page à 96 dpi");
        assert!(texte.contains("/MediaBox[0 0 595.2 841.92]"), "page A4");
        // La photo JPEG passe telle quelle, une seule fois pour les deux pages.
        assert_eq!(texte.matches("/DCTDecode").count(), 1);
        // Rendue par poppler à 96 dpi, la première page redonne l'image du noyau.
        let chemin = dossier.join("page.pdf");
        fs::write(&chemin, &octets).unwrap();
        let rendu = Command::new("pdftoppm").args(["-r", "96", "-f", "1", "-l", "1", "-png", "-singlefile"]).arg(&chemin).arg(dossier.join("page")).status();
        if rendu.is_ok_and(|s| s.success()) {
            let lu = image::open(dossier.join("page.png")).unwrap().to_rgba8();
            let png = image(&p, &OptionsImage { format: FormatImage::Png, echelle: 1.0, transparent: false, instant: 0.0 }, &dossier).unwrap();
            let attendu = image::load_from_memory(&png).unwrap().to_rgba8();
            assert_eq!(lu.dimensions(), attendu.dimensions());
            let ecart: f64 = attendu.as_raw().iter().zip(lu.as_raw()).map(|(a, b)| (*a as f64 - *b as f64).abs()).sum::<f64>() / attendu.as_raw().len() as f64;
            assert!(ecart < 2.0, "écart moyen {ecart}");
        }
        assert!((points_par_pixel(1748.0, 2480.0) - 0.24).abs() < 1e-9 && (points_par_pixel(1080.0, 1080.0) - 0.75).abs() < 1e-9);
        let _ = fs::remove_dir_all(&dossier);
    }

    /// Une page de texte en Lexend (police variable) : gras et léger.
    fn page_de_texte() -> DescriptionPage {
        let lexend = fs::read(concat!(env!("CARGO_MANIFEST_DIR"), "/../public/bibliotheque/polices/lexend/Lexend[wght].ttf")).unwrap();
        let texte = |poids: u16, y: u32, mots: &str| {
            json!({ "genre": "svg", "svg": format!("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"560\" height=\"90\" viewBox=\"0 0 560 90\"><text x=\"10\" y=\"64\" font-family=\"Lexend\" font-size=\"56\" font-weight=\"{poids}\" fill=\"#1a2a6c\" xml:space=\"preserve\">{mots}</text></svg>"),
                    "boite": { "x0": 0, "y0": 0, "x1": 560, "y1": 90 }, "opacite": 1, "_y": y })
        };
        serde_json::from_value(json!({
            "largeur": 600, "hauteur": 260, "duree": 0,
            "fond": [rectangle(600.0, 260.0, "#fdf6e3")],
            "elements": [
                { "element": { "id": "t1", "type": "texte", "x": 20, "y": 30, "largeur": 560, "hauteur": 90, "rotation": 0, "opacite": 1, "visible": true }, "calques": [texte(800, 0, "Bonjour Eliot")] },
                { "element": { "id": "t2", "type": "texte", "x": 20, "y": 140, "largeur": 560, "hauteur": 90, "rotation": 0, "opacite": 1, "visible": true }, "calques": [texte(250, 0, "un post léger")] }
            ],
            "polices": [{ "famille": "Lexend", "style": "normal", "poidsMin": 100, "poidsMax": 900, "donnees": base64::engine::general_purpose::STANDARD.encode(&lexend) }]
        }))
        .unwrap()
    }

    #[test]
    fn le_pdf_garde_les_textes_et_le_svg_les_trace() {
        let dossier = dossier_de_test("texte");
        let p = page_de_texte();
        let octets = pdf(&[(p.clone(), 0.0)], &dossier).unwrap();
        let chemin = dossier.join("texte.pdf");
        fs::write(&chemin, &octets).unwrap();
        let png = image(&p, &OptionsImage { format: FormatImage::Png, echelle: 1.0, transparent: false, instant: 0.0 }, &dossier).unwrap();
        let attendu = image::load_from_memory(&png).unwrap().to_rgba8();
        if let Ok(s) = Command::new("pdftotext").arg(&chemin).arg("-").output() {
            let lu = String::from_utf8_lossy(&s.stdout);
            assert!(lu.contains("Bonjour Eliot") && lu.contains("un post léger"), "texte sélectionnable : {lu:?}");
        }
        if let Ok(s) = Command::new("pdffonts").arg(&chemin).output() {
            let lu = String::from_utf8_lossy(&s.stdout);
            assert!(lu.contains("Lexend"), "police incluse : {lu}");
        }
        let rendu = Command::new("pdftoppm").args(["-r", "96", "-png", "-singlefile"]).arg(&chemin).arg(dossier.join("texte")).status();
        if rendu.is_ok_and(|s| s.success()) {
            let lu = image::open(dossier.join("texte.png")).unwrap().to_rgba8();
            let ecart: f64 = attendu.as_raw().iter().zip(lu.as_raw()).map(|(a, b)| (*a as f64 - *b as f64).abs()).sum::<f64>() / attendu.as_raw().len() as f64;
            assert!(ecart < 2.5, "écart moyen {ecart} entre poppler et le noyau");
        }
        // Le SVG : plus de texte, des tracés ; relu sans les polices, la même image.
        let ecrit = svg(&p, 0.0, &dossier).unwrap();
        let texte = String::from_utf8(ecrit.clone()).unwrap();
        assert!(!texte.contains("<text"), "les textes deviennent des tracés");
        let arbre = usvg::Tree::from_data(&ecrit, &usvg::Options::default()).unwrap();
        let mut rendu = resvg::tiny_skia::Pixmap::new(600, 260).unwrap();
        resvg::render(&arbre, resvg::tiny_skia::Transform::identity(), &mut rendu.as_mut());
        let lu = image::load_from_memory(&rendu.encode_png().unwrap()).unwrap().to_rgba8();
        let ecart: f64 = attendu.as_raw().iter().zip(lu.as_raw()).map(|(a, b)| (*a as f64 - *b as f64).abs()).sum::<f64>() / attendu.as_raw().len() as f64;
        assert!(ecart < 1.0, "écart moyen {ecart} entre le SVG et le noyau");
        let _ = fs::remove_dir_all(&dossier);
    }

    #[test]
    fn l_export_ecrit_un_fichier_par_page_ou_un_pdf() {
        let dossier = dossier_de_test("document");
        let id = photo(&dossier);
        let sortie = dossier.join("sortie");
        let demande = |format: FormatDocument| DemandeExport { format, pages: vec![PageAExporter { description: page(&id), instant: 0.0 }, PageAExporter { description: page_de_texte(), instant: 0.0 }], polices: vec![], echelle: 0.5, transparent: false };
        let mut vu = Vec::new();
        exporter_document(demande(FormatDocument::Pdf), &dossier, &sortie, "essai", None, &mut |f, t| vu.push((f, t))).unwrap();
        assert_eq!(vu, [(1, 2), (2, 2)], "le PDF dit où il en est après chaque page");
        vu.clear();
        let ecrits = exporter_document(demande(FormatDocument::Jpeg), &dossier, &sortie, "essai", None, &mut |f, t| vu.push((f, t))).unwrap();
        assert_eq!(ecrits.iter().map(|c| c.file_name().unwrap().to_string_lossy().into_owned()).collect::<Vec<_>>(), ["essai_page-01.jpg", "essai_page-02.jpg"]);
        assert_eq!(vu, [(1, 2), (2, 2)]);
        assert_eq!(image::open(&ecrits[0]).unwrap().width(), 300, "échelle 0,5");
        let ecrits = exporter_document(demande(FormatDocument::Pdf), &dossier, &sortie, "essai", None, &mut |_, _| ()).unwrap();
        assert_eq!(ecrits.len(), 1);
        assert!(ecrits[0].extension().is_some_and(|e| e == "pdf"));
        // Les polices données une fois valent pour la page qui n'en a pas.
        let mut sans = demande(FormatDocument::Svg);
        sans.polices = std::mem::take(&mut sans.pages[1].description.polices);
        sans.pages.remove(0);
        let choisi = sortie.join("mon texte");
        let ecrits = exporter_document(sans, &dossier, &sortie, "essai", Some(&choisi), &mut |_, _| ()).unwrap();
        assert_eq!(ecrits, [sortie.join("mon texte.svg")]);
        assert!(!fs::read_to_string(&ecrits[0]).unwrap().contains("<text"));
        let _ = fs::remove_dir_all(&dossier);
    }

    #[test]
    fn une_photo_manquante_fait_echouer_le_pdf_et_le_svg() {
        let dossier = dossier_de_test("manquante");
        let id = photo(&dossier);
        let p = page(&id);
        fs::remove_file(images::chemin_ressource(&dossier, &id, Genre::Original).unwrap()).unwrap();
        let e = pdf(&[(p.clone(), 0.0)], &dossier).unwrap_err();
        assert!(matches!(e, ErreurRendu::Photo(..)), "{e}");
        assert!(matches!(svg(&p, 0.0, &dossier), Err(ErreurRendu::Photo(..))));
        let _ = fs::remove_dir_all(&dossier);
    }

    #[test]
    fn les_reglages_du_labo_passent_dans_l_export() {
        let dossier = dossier_de_test("labo");
        let id = photo(&dossier);
        let brute = page(&id);
        let mut retouchee = brute.clone();
        retouchee.elements[1].element["reglages"] = json!({ "exposition": -2, "saturation": -100 });
        let png = |p: &DescriptionPage| image(p, &OptionsImage { format: FormatImage::Png, echelle: 1.0, transparent: false, instant: 0.0 }, &dossier).unwrap();
        // La moitié rouge de la photo, à demi transparente sur le blanc : sans réglages elle est
        // rouge pâle ; plus sombre de deux IL et sans couleur, elle devient grise.
        let a = pixel(&png(&brute), 350, 250);
        let b = pixel(&png(&retouchee), 350, 250);
        assert!(a[0] > a[1] + 60, "{a:?}");
        assert!(b[0].abs_diff(b[1]) <= 3 && b[0] < a[0], "{b:?}");
        // Le PDF et le SVG emportent la photo retouchée.
        let octets = pdf(&[(retouchee.clone(), 0.0)], &dossier).unwrap();
        let chemin = dossier.join("labo.pdf");
        fs::write(&chemin, &octets).unwrap();
        if Command::new("pdftoppm").args(["-r", "96", "-png", "-singlefile"]).arg(&chemin).arg(dossier.join("labo")).status().is_ok_and(|s| s.success()) {
            let c = image::open(dossier.join("labo.png")).unwrap().to_rgba8().get_pixel(350, 250).0;
            assert!(c[0].abs_diff(c[1]) <= 4 && proche(c, b, 6), "{c:?} contre {b:?}");
        }
        let texte = String::from_utf8(svg(&retouchee, 0.0, &dossier).unwrap()).unwrap();
        assert!(texte.contains("data:image/jpeg;base64,") && !texte.contains("eliot:"));
        let _ = fs::remove_dir_all(&dossier);
    }
}
