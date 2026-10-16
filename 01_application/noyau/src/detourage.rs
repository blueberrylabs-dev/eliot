//! Le détourage d'une photo (étape 5, lot 7) : le fond retiré par un modèle d'IA local, puis
//! les bords repris au pinceau.
//!
//! - Le modèle tourne hors d'Eliot, comme Whisper : un petit programme Python
//!   (`detourer.py`, écrit dans un dossier de travail neuf à chaque fois) et onnxruntime pour
//!   le processeur, installés par Alexandre dans `telechargements/detourage/env/` ; le modèle,
//!   un fichier ONNX, téléchargé une fois dans `telechargements/detourage/`. Aucune carte
//!   graphique visible, rien à chercher sur Internet.
//! - Le masque du modèle est gardé tel qu'il sort, 1024 x 1024 en niveaux de gris, dans
//!   `ressources/masques/<ressource>-<modèle>.png` : il appartient à la photo, pas à l'objet
//!   (deux copies d'une photo le partagent). L'original n'est jamais touché (règle 13).
//! - Les coups de pinceau sont des valeurs du document (`detourage.coups` de l'objet) : on les
//!   annule comme le reste, et ils valent à toutes les tailles (points en fractions de l'image,
//!   rayon en fraction de son grand côté).
//! - Le masque d'une taille donnée : le masque du modèle agrandi (bilinéaire, centres des
//!   pixels alignés), puis les coups, dans l'ordre. La fenêtre fait le même calcul
//!   (`src/modele/detourage.ts`), contrôlé par un tableau de valeurs commun
//!   (`detourage.attendus.json`).

use std::fs;
use std::io::{self, BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::time::Duration;

use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::fichiers::ecrire_atomiquement;
use crate::images::{self, Genre};

/// Le côté de l'image donnée au modèle, et de son masque.
pub const COTE: u32 = 1024;

/// Le programme lancé par le noyau, embarqué dans Eliot.
const PROGRAMME: &str = include_str!("detourer.py");

#[derive(Debug, Error)]
pub enum ErreurDetourage {
    #[error("le programme du détourage n'est pas installé (commande 20 du CLAUDE.md)")]
    Absent,
    #[error("aucun modèle de détourage dans telechargements/detourage/ (commande 21 du CLAUDE.md)")]
    SansModele,
    #[error("une photo seulement")]
    PasUnePhoto,
    #[error("masque inconnu : {0}")]
    MasqueInconnu(String),
    #[error("détourage annulé")]
    Annule,
    #[error("le détourage a échoué : {0}")]
    Echec(String),
    #[error("lecture : {0}")]
    Lecture(#[from] io::Error),
    #[error("image : {0}")]
    Image(#[from] images::ErreurImage),
}

// ----------------------------------------------------------------------------------------
// Le document
// ----------------------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    /// Rend ce que le modèle a retiré.
    Garder,
    /// Retire ce que le modèle a gardé.
    Effacer,
}

/// Un coup de pinceau : un trait passant par `points` (fractions de la largeur et de la
/// hauteur de l'image), de rayon `rayon` (fraction de son grand côté) ; `durete` de 0 (bord
/// très doux) à 1 (bord net).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Coup {
    pub mode: Mode,
    pub rayon: f64,
    pub durete: f64,
    pub points: Vec<[f64; 2]>,
}

/// Le détourage d'une photo, tel que le document le garde.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Detourage {
    /// Le masque du modèle : `ressources/masques/<masque>.png`.
    pub masque: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub coups: Vec<Coup>,
}

/// Le détourage d'un objet du document, s'il en a un (une photo seulement).
pub fn de_l_element(element: &serde_json::Value) -> Option<Detourage> {
    if element.get("type").and_then(serde_json::Value::as_str) != Some("image") {
        return None;
    }
    let d: Detourage = serde_json::from_value(element.get("detourage")?.clone()).ok()?;
    nom_valide(&d.masque).then_some(d)
}

/// Un nom de masque : l'empreinte de la photo, un tiret, le nom court du modèle. Il sert à
/// construire un chemin, il ne doit pas pouvoir en sortir.
pub fn nom_valide(nom: &str) -> bool {
    match nom.split_once('-') {
        Some((id, modele)) => images::identifiant_valide(id) && !modele.is_empty() && modele.bytes().all(|o| o.is_ascii_lowercase() || o.is_ascii_digit() || o == b'-'),
        None => false,
    }
}

pub fn chemin_masque(dossier: &Path, nom: &str) -> Result<PathBuf, ErreurDetourage> {
    if !nom_valide(nom) {
        return Err(ErreurDetourage::MasqueInconnu(nom.to_string()));
    }
    Ok(dossier.join("masques").join(format!("{nom}.png")))
}

/// Les masques d'une photo (tous modèles), pour la copier d'un design à un autre.
pub fn masques_de(dossier: &Path, id: &str) -> Vec<PathBuf> {
    let Ok(entrees) = fs::read_dir(dossier.join("masques")) else { return Vec::new() };
    let mut v: Vec<PathBuf> = entrees
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x == "png") && p.file_stem().and_then(|s| s.to_str()).is_some_and(|s| nom_valide(s) && s.split_once('-').is_some_and(|(i, _)| i == id)))
        .collect();
    v.sort();
    v
}

/// Le masque du modèle, en niveaux de gris (`COTE` x `COTE` d'ordinaire).
pub fn lire_masque(dossier: &Path, nom: &str) -> Result<image::GrayImage, ErreurDetourage> {
    let chemin = chemin_masque(dossier, nom)?;
    if !chemin.is_file() {
        return Err(ErreurDetourage::MasqueInconnu(nom.to_string()));
    }
    let img = image::load_from_memory(&fs::read(chemin)?).map_err(|e| ErreurDetourage::Echec(format!("masque illisible : {e}")))?;
    Ok(img.to_luma8())
}

// ----------------------------------------------------------------------------------------
// Le masque à une taille donnée
// ----------------------------------------------------------------------------------------

/// Le masque `source` (`ls` x `hs`, de 0 à 255) agrandi ou réduit à `l` x `h`, de 0 à 1 :
/// bilinéaire, centres des pixels alignés, bords prolongés.
pub fn agrandir(source: &[u8], ls: u32, hs: u32, l: u32, h: u32) -> Vec<f32> {
    let (ls, hs) = (ls as usize, hs as usize);
    let (l, h) = (l as usize, h as usize);
    let mut sortie = vec![0.0f32; l * h];
    if ls == 0 || hs == 0 || source.len() < ls * hs {
        return sortie;
    }
    let ex = ls as f64 / l as f64;
    let ey = hs as f64 / h as f64;
    let colonnes: Vec<(usize, usize, f64)> = (0..l)
        .map(|x| {
            let sx = ((x as f64 + 0.5) * ex - 0.5).clamp(0.0, (ls - 1) as f64);
            let x0 = sx.floor() as usize;
            (x0, (x0 + 1).min(ls - 1), sx - x0 as f64)
        })
        .collect();
    sortie.par_chunks_mut(l).enumerate().for_each(|(y, ligne)| {
        let sy = ((y as f64 + 0.5) * ey - 0.5).clamp(0.0, (hs - 1) as f64);
        let y0 = sy.floor() as usize;
        let y1 = (y0 + 1).min(hs - 1);
        let fy = sy - y0 as f64;
        let (a, b) = (&source[y0 * ls..(y0 + 1) * ls], &source[y1 * ls..(y1 + 1) * ls]);
        for (v, &(x0, x1, fx)) in ligne.iter_mut().zip(&colonnes) {
            let haut = a[x0] as f64 + (a[x1] as f64 - a[x0] as f64) * fx;
            let bas = b[x0] as f64 + (b[x1] as f64 - b[x0] as f64) * fx;
            *v = ((haut + (bas - haut) * fy) / 255.0) as f32;
        }
    });
    sortie
}

/// La part du pinceau à la distance `d` (pixels) de son trait : 1 au cœur, 0 au-delà du
/// rayon `r`, une courbe douce entre les deux, sur au moins un pixel.
pub fn couverture(d: f64, r: f64, durete: f64) -> f64 {
    let largeur = (r * (1.0 - durete.clamp(0.0, 1.0))).max(1.0).min(r.max(1e-9));
    if d >= r {
        return 0.0;
    }
    let t = ((r - d) / largeur).min(1.0);
    t * t * (3.0 - 2.0 * t)
}

/// Distance du point `p` au segment `a`–`b`.
fn distance_segment(p: [f64; 2], a: [f64; 2], b: [f64; 2]) -> f64 {
    let (dx, dy) = (b[0] - a[0], b[1] - a[1]);
    let n = dx * dx + dy * dy;
    let t = if n > 0.0 { (((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / n).clamp(0.0, 1.0) } else { 0.0 };
    ((p[0] - a[0] - t * dx).powi(2) + (p[1] - a[1] - t * dy).powi(2)).sqrt()
}

/// Les coups de pinceau, dans l'ordre, sur `alpha` (`l` x `h`, de 0 à 1). Chaque coup couvre
/// la zone de son trait (le plus fort de ses segments) ; « garder » rapproche de 1 ce qu'il
/// couvre, « effacer » le rapproche de 0.
pub fn appliquer_coups(alpha: &mut [f32], l: u32, h: u32, coups: &[Coup]) {
    let (lu, hu) = (l as usize, h as usize);
    if lu == 0 || hu == 0 || alpha.len() < lu * hu {
        return;
    }
    let grand = l.max(h) as f64;
    for coup in coups {
        if coup.points.is_empty() || !(coup.rayon > 0.0) {
            continue;
        }
        let r = coup.rayon * grand;
        let pts: Vec<[f64; 2]> = coup.points.iter().map(|p| [p[0] * l as f64, p[1] * h as f64]).collect();
        let x0 = (pts.iter().map(|p| p[0]).fold(f64::INFINITY, f64::min) - r).floor().max(0.0) as usize;
        let y0 = (pts.iter().map(|p| p[1]).fold(f64::INFINITY, f64::min) - r).floor().max(0.0) as usize;
        let x1 = ((pts.iter().map(|p| p[0]).fold(f64::NEG_INFINITY, f64::max) + r).ceil().max(0.0) as usize).min(lu);
        let y1 = ((pts.iter().map(|p| p[1]).fold(f64::NEG_INFINITY, f64::max) + r).ceil().max(0.0) as usize).min(hu);
        if x0 >= x1 || y0 >= y1 {
            continue;
        }
        let lb = x1 - x0;
        let mut part = vec![0.0f64; lb * (y1 - y0)];
        let segments: Vec<([f64; 2], [f64; 2])> = if pts.len() == 1 { vec![(pts[0], pts[0])] } else { pts.windows(2).map(|w| (w[0], w[1])).collect() };
        for (a, b) in segments {
            let sx0 = ((a[0].min(b[0]) - r).floor().max(x0 as f64) as usize).max(x0);
            let sy0 = ((a[1].min(b[1]) - r).floor().max(y0 as f64) as usize).max(y0);
            let sx1 = ((a[0].max(b[0]) + r).ceil().max(0.0) as usize).min(x1);
            let sy1 = ((a[1].max(b[1]) + r).ceil().max(0.0) as usize).min(y1);
            for y in sy0..sy1 {
                for x in sx0..sx1 {
                    let c = couverture(distance_segment([x as f64 + 0.5, y as f64 + 0.5], a, b), r, coup.durete);
                    let v = &mut part[(y - y0) * lb + (x - x0)];
                    if c > *v {
                        *v = c;
                    }
                }
            }
        }
        for y in y0..y1 {
            for x in x0..x1 {
                let c = part[(y - y0) * lb + (x - x0)];
                if c <= 0.0 {
                    continue;
                }
                let a = &mut alpha[y * lu + x];
                let v = *a as f64;
                *a = match coup.mode {
                    Mode::Garder => v + (1.0 - v) * c,
                    Mode::Effacer => v * (1.0 - c),
                } as f32;
            }
        }
    }
}

/// Le masque complet à `l` x `h` : celui du modèle, puis les coups.
pub fn masque_a_la_taille(masque: &image::GrayImage, coups: &[Coup], l: u32, h: u32) -> Vec<f32> {
    let mut a = agrandir(masque.as_raw(), masque.width(), masque.height(), l, h);
    appliquer_coups(&mut a, l, h, coups);
    a
}

/// Pose le détourage sur une image RGBA (non prémultipliée) de `l` x `h` : sa transparence
/// est multipliée par le masque.
pub fn appliquer(dossier: &Path, rgba: &mut [u8], l: u32, h: u32, d: &Detourage) -> Result<(), ErreurDetourage> {
    let masque = lire_masque(dossier, &d.masque)?;
    let a = masque_a_la_taille(&masque, &d.coups, l, h);
    rgba.par_chunks_mut(4).zip(a.par_iter()).for_each(|(p, &m)| {
        p[3] = (p[3] as f32 * m.clamp(0.0, 1.0)).round() as u8;
    });
    Ok(())
}

// ----------------------------------------------------------------------------------------
// Le modèle
// ----------------------------------------------------------------------------------------

/// Un modèle connu : son fichier, sa préparation, sa sortie.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Modele {
    /// Le nom court, dans le nom du masque.
    pub nom: &'static str,
    pub fichier: &'static str,
    /// Moyenne et écart d'ImageNet retirés de l'image.
    pub normaliser: bool,
    /// La sortie est un logit : le programme y applique la sigmoïde.
    pub sigmoide: bool,
    /// Ce que l'interface affiche.
    pub libelle: &'static str,
}

/// Les modèles reconnus, par ordre de préférence (le premier présent sert).
pub const MODELES: [Modele; 3] = [
    Modele { nom: "birefnet", fichier: "birefnet.onnx", normaliser: true, sigmoide: true, libelle: "BiRefNet" },
    Modele { nom: "birefnet-lite", fichier: "birefnet-lite.onnx", normaliser: true, sigmoide: true, libelle: "BiRefNet lite" },
    Modele { nom: "ben2", fichier: "BEN2_Base.onnx", normaliser: false, sigmoide: false, libelle: "BEN2 Base" },
];

/// Les dossiers du détourage : `telechargements/detourage/` du dépôt (en remontant depuis un
/// dossier de départ, en développement), puis `detourage/` dans les données d'Eliot.
pub fn dossiers(depart: &Path, donnees: Option<&Path>) -> Vec<PathBuf> {
    let mut d: Vec<PathBuf> = depart.ancestors().take(6).map(|a| a.join("telechargements").join("detourage")).filter(|p| p.is_dir()).collect();
    if let Some(x) = donnees {
        d.push(x.join("detourage"));
    }
    d
}

/// Le modèle à utiliser parmi ceux des dossiers.
pub fn trouver_modele(dossiers: &[PathBuf]) -> Option<(PathBuf, Modele)> {
    MODELES.iter().find_map(|m| dossiers.iter().map(|d| d.join(m.fichier)).find(|p| p.is_file()).map(|p| (p, *m)))
}

/// Le Python qui fait tourner le modèle : `ELIOT_DETOURAGE_PYTHON` s'il est donné, sinon celui
/// de l'environnement `env/` d'un des dossiers.
pub fn trouver_python(dossiers: &[PathBuf]) -> Option<PathBuf> {
    if let Some(p) = std::env::var_os("ELIOT_DETOURAGE_PYTHON").map(PathBuf::from) {
        return p.is_file().then_some(p);
    }
    dossiers.iter().flat_map(|d| [d.join("env").join("bin").join("python3"), d.join("env").join("bin").join("python")]).find(|p| p.is_file())
}

/// Un dossier de travail neuf, dans le dossier temporaire du système.
fn dossier_de_travail() -> io::Result<PathBuf> {
    let marque = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let d = std::env::temp_dir().join(format!("eliot-detourage-{}-{marque}", std::process::id()));
    fs::create_dir_all(&d)?;
    Ok(d)
}

/// L'image donnée au modèle : l'original redressé, réduit (ou agrandi) à `COTE` x `COTE`, en RGB.
fn image_du_modele(dossier: &Path, id: &str) -> Result<Vec<u8>, ErreurDetourage> {
    let infos = images::infos(dossier, id)?;
    if infos.video.is_some() || infos.son.is_some() {
        return Err(ErreurDetourage::PasUnePhoto);
    }
    let octets = fs::read(images::chemin_ressource(dossier, id, Genre::Original)?)?;
    let img = images::decoder_redresse(&octets)?;
    // Une photo transparente : son fond devient blanc pour le modèle (il ne lit pas la
    // transparence) ; l'export garde la transparence d'origine, multipliée par le masque.
    let rgba = img.to_rgba8();
    let (l, h) = rgba.dimensions();
    let mut rgb = Vec::with_capacity(l as usize * h as usize * 3);
    for p in rgba.pixels() {
        let a = p[3] as u32;
        for c in 0..3 {
            rgb.push(((p[c] as u32 * a + 255 * (255 - a) + 127) / 255) as u8);
        }
    }
    let source = fast_image_resize::images::Image::from_vec_u8(l, h, rgb, fast_image_resize::PixelType::U8x3).map_err(|e| ErreurDetourage::Echec(e.to_string()))?;
    let mut cible = fast_image_resize::images::Image::new(COTE, COTE, fast_image_resize::PixelType::U8x3);
    let options = fast_image_resize::ResizeOptions::new().resize_alg(fast_image_resize::ResizeAlg::Convolution(fast_image_resize::FilterType::Bilinear));
    fast_image_resize::Resizer::new().resize(&source, &mut cible, &options).map_err(|e| ErreurDetourage::Echec(e.to_string()))?;
    Ok(cible.into_vec())
}

/// Lance le programme sur `entree` ; `avancement` reçoit l'étape atteinte (de 0 à 1).
fn lancer(python: &Path, modele: &Path, sorte: &Modele, travail: &Path, annule: &AtomicBool, avancement: &mut dyn FnMut(f32)) -> Result<Vec<f32>, ErreurDetourage> {
    let script = travail.join("detourer.py");
    fs::write(&script, PROGRAMME)?;
    let (entree, sortie) = (travail.join("entree.rgb"), travail.join("sortie.f32"));
    let coeurs = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(2);
    let fils = coeurs.saturating_sub(1).clamp(1, 8);
    let mut c = Command::new(python);
    // -I : Python isolé (ni le dossier courant, ni les variables PYTHON*, ni les paquets de
    // l'utilisateur) ; -B : pas de fichiers compilés à côté du programme.
    c.arg("-I").arg("-B").arg(&script).arg("--modele").arg(modele).arg("--entree").arg(&entree).arg("--sortie").arg(&sortie);
    c.args(["--cote", &COTE.to_string(), "--fils", &fils.to_string()]);
    c.args(["--normaliser", if sorte.normaliser { "imagenet" } else { "aucune" }, "--activation", if sorte.sigmoide { "sigmoide" } else { "aucune" }]);
    // Sur le processeur seulement (règle 9) : aucune carte graphique visible.
    c.env("CUDA_VISIBLE_DEVICES", "").env("OMP_NUM_THREADS", fils.to_string()).env("PYTHONUNBUFFERED", "1").env("PYTHONIOENCODING", "utf-8");
    c.current_dir(travail).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut processus = c.spawn().map_err(|e| if e.kind() == io::ErrorKind::NotFound { ErreurDetourage::Absent } else { ErreurDetourage::Lecture(e) })?;
    let sortie_texte = processus.stdout.take().expect("sortie redirigée");
    let mut erreurs = processus.stderr.take().expect("erreurs redirigées");
    let (tx, rx) = mpsc::channel::<f32>();
    let lecteur = std::thread::spawn(move || {
        for ligne in BufReader::new(sortie_texte).lines().map_while(Result::ok) {
            let p = match ligne.trim() {
                "etape image" => 0.2,
                "etape modele" => 0.35,
                "etape fini" => 0.95,
                _ => continue,
            };
            let _ = tx.send(p);
        }
    });
    let journal = std::thread::spawn(move || {
        let mut t = String::new();
        let _ = erreurs.read_to_string(&mut t);
        t
    });
    loop {
        if annule.load(Ordering::Relaxed) {
            let _ = processus.kill();
            let _ = processus.wait();
            let _ = lecteur.join();
            let _ = journal.join();
            return Err(ErreurDetourage::Annule);
        }
        match rx.recv_timeout(Duration::from_millis(100)) {
            Ok(p) => avancement(p),
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
    let statut = processus.wait()?;
    let _ = lecteur.join();
    let messages = journal.join().unwrap_or_default();
    let octets = if statut.success() { fs::read(&sortie).ok() } else { None };
    let n = (COTE * COTE) as usize;
    match octets {
        Some(o) if o.len() == n * 4 => Ok(o.chunks_exact(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect()),
        _ => {
            let ligne = messages.lines().rev().find(|l| !l.trim().is_empty()).unwrap_or("échec sans message");
            Err(ErreurDetourage::Echec(ligne.trim().to_string()))
        }
    }
}

/// Retire le fond de la photo `id` du design : le masque du modèle, fait une fois puis relu
/// (`forcer` le refait). Renvoie son nom, à garder dans `detourage.masque`.
#[allow(clippy::too_many_arguments)]
pub fn detourer(dossier: &Path, id: &str, python: &Path, modele: &Path, sorte: &Modele, forcer: bool, annule: &AtomicBool, avancement: &mut dyn FnMut(f32)) -> Result<String, ErreurDetourage> {
    let nom = format!("{id}-{}", sorte.nom);
    let chemin = chemin_masque(dossier, &nom)?;
    if chemin.is_file() && !forcer {
        avancement(1.0);
        return Ok(nom);
    }
    avancement(0.05);
    let entree = image_du_modele(dossier, id)?;
    let travail = dossier_de_travail()?;
    let resultat = (|| {
        fs::write(travail.join("entree.rgb"), &entree)?;
        avancement(0.1);
        let masque = lancer(python, modele, sorte, &travail, annule, avancement)?;
        let gris: Vec<u8> = masque.iter().map(|v| (v.clamp(0.0, 1.0) * 255.0).round() as u8).collect();
        let img = image::GrayImage::from_raw(COTE, COTE, gris).expect("taille du masque");
        let mut png = Vec::new();
        img.write_to(&mut io::Cursor::new(&mut png), image::ImageFormat::Png).map_err(|e| ErreurDetourage::Echec(e.to_string()))?;
        fs::create_dir_all(dossier.join("masques"))?;
        ecrire_atomiquement(&chemin, &png)?;
        avancement(1.0);
        Ok(nom.clone())
    })();
    let _ = fs::remove_dir_all(&travail);
    resultat
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{Value, json};

    const ATTENDUS: &str = include_str!("../../src/modele/detourage.attendus.json");

    fn coups_d_essai() -> Vec<Coup> {
        vec![
            Coup { mode: Mode::Garder, rayon: 0.25, durete: 0.5, points: vec![[0.2, 0.3], [0.6, 0.35]] },
            Coup { mode: Mode::Effacer, rayon: 0.12, durete: 1.0, points: vec![[0.75, 0.7]] },
            Coup { mode: Mode::Garder, rayon: 0.08, durete: 0.0, points: vec![[0.1, 0.9], [0.3, 0.8], [0.5, 0.95]] },
        ]
    }

    fn masque_d_essai() -> image::GrayImage {
        image::GrayImage::from_fn(5, 4, |x, y| image::Luma([((x * 53 + y * 31) % 256) as u8]))
    }

    fn calculer() -> Value {
        let courbe: Vec<Value> = [(0.0, 10.0, 0.5), (4.9, 10.0, 0.5), (5.0, 10.0, 0.5), (7.5, 10.0, 0.5), (9.99, 10.0, 0.5), (10.0, 10.0, 0.5), (9.5, 10.0, 1.0), (2.0, 3.0, 0.0), (0.4, 0.5, 0.2)]
            .iter()
            .map(|&(d, r, du)| json!({ "d": d, "r": r, "durete": du, "c": couverture(d, r, du) }))
            .collect();
        let m = masque_d_essai();
        let agrandi = agrandir(m.as_raw(), 5, 4, 9, 7);
        let reduit = agrandir(m.as_raw(), 5, 4, 3, 2);
        let mut avec = agrandir(m.as_raw(), 5, 4, 24, 16);
        appliquer_coups(&mut avec, 24, 16, &coups_d_essai());
        let f = |v: &[f32]| v.iter().map(|x| *x as f64).collect::<Vec<f64>>();
        json!({
            "note": "Calculé par le noyau (detourage.rs, cargo test avec ELIOT_ECRIRE_ATTENDUS=1) ; relu par la fenêtre.",
            "courbe": courbe,
            "masque": { "largeur": 5, "hauteur": 4, "valeurs": m.as_raw() },
            "agrandi": { "largeur": 9, "hauteur": 7, "valeurs": f(&agrandi) },
            "reduit": { "largeur": 3, "hauteur": 2, "valeurs": f(&reduit) },
            "coups": coups_d_essai(),
            "avecCoups": { "largeur": 24, "hauteur": 16, "valeurs": f(&avec) },
        })
    }

    #[test]
    fn le_tableau_commun_est_celui_du_noyau() {
        let calcule = calculer();
        if std::env::var("ELIOT_ECRIRE_ATTENDUS").is_ok() {
            let chemin = concat!(env!("CARGO_MANIFEST_DIR"), "/../src/modele/detourage.attendus.json");
            std::fs::write(chemin, serde_json::to_string_pretty(&calcule).unwrap() + "\n").unwrap();
            return;
        }
        let attendu: Value = serde_json::from_str(ATTENDUS).unwrap();
        // Les masques sont calculés en flottants 32 bits : à un millionième près.
        fn proches(a: &Value, b: &Value, chemin: &str) {
            match (a, b) {
                (Value::Number(x), Value::Number(y)) => {
                    let (x, y) = (x.as_f64().unwrap(), y.as_f64().unwrap());
                    assert!((x - y).abs() <= 1e-6 * (1.0 + x.abs()), "{chemin} : {x} au lieu de {y}");
                }
                (Value::Array(x), Value::Array(y)) => {
                    assert_eq!(x.len(), y.len(), "{chemin}");
                    for (i, (u, v)) in x.iter().zip(y).enumerate() {
                        proches(u, v, &format!("{chemin}[{i}]"));
                    }
                }
                (Value::Object(x), Value::Object(y)) => {
                    assert_eq!(x.len(), y.len(), "{chemin}");
                    for (k, u) in x {
                        proches(u, &y[k], &format!("{chemin}.{k}"));
                    }
                }
                _ => assert_eq!(a, b, "{chemin}"),
            }
        }
        proches(&attendu, &calcule, "");
    }

    #[test]
    fn le_pinceau_garde_et_efface() {
        // Un masque tout noir (tout est fond) : « garder » rend un disque, « effacer » en
        // retire le centre.
        let mut a = vec![0.0f32; 100 * 100];
        appliquer_coups(&mut a, 100, 100, &[Coup { mode: Mode::Garder, rayon: 0.2, durete: 1.0, points: vec![[0.5, 0.5]] }]);
        assert!(a[50 * 100 + 50] > 0.999 && a[50 * 100 + 68] > 0.99 && a[50 * 100 + 71] == 0.0, "{} {} {}", a[5050], a[5068], a[5071]);
        appliquer_coups(&mut a, 100, 100, &[Coup { mode: Mode::Effacer, rayon: 0.05, durete: 0.5, points: vec![[0.5, 0.5]] }]);
        assert!(a[50 * 100 + 50] < 0.001 && a[50 * 100 + 60] > 0.99);
        // Un trait couvre tout son segment, pas seulement ses deux bouts.
        let mut b = vec![0.0f32; 100 * 100];
        appliquer_coups(&mut b, 100, 100, &[Coup { mode: Mode::Garder, rayon: 0.03, durete: 1.0, points: vec![[0.1, 0.5], [0.9, 0.5]] }]);
        assert!((10..90).all(|x| b[50 * 100 + x] > 0.99) && b[40 * 100 + 50] == 0.0);
        // Hors de l'image : rien ne déborde, rien ne casse.
        appliquer_coups(&mut b, 100, 100, &[Coup { mode: Mode::Effacer, rayon: 0.1, durete: 1.0, points: vec![[1.5, -0.5]] }]);
    }

    #[test]
    fn le_masque_vaut_a_toutes_les_tailles() {
        // Le même détourage à deux tailles : les mêmes formes (le grand côté porte le rayon).
        let m = image::GrayImage::from_fn(COTE, COTE, |x, _| image::Luma([if x < COTE / 2 { 0 } else { 255 }]));
        let coups = vec![Coup { mode: Mode::Garder, rayon: 0.1, durete: 0.8, points: vec![[0.25, 0.5]] }];
        let petit = masque_a_la_taille(&m, &coups, 300, 200);
        let grand = masque_a_la_taille(&m, &coups, 3000, 2000);
        for (u, v) in [(0.1, 0.1), (0.25, 0.5), (0.25, 0.62), (0.75, 0.5), (0.49, 0.9), (0.51, 0.9)] {
            let p = petit[(v * 200.0) as usize * 300 + (u * 300.0) as usize];
            let g = grand[(v * 2000.0) as usize * 3000 + (u * 3000.0) as usize];
            assert!((p - g).abs() < 0.06, "({u}, {v}) : {p} contre {g}");
        }
    }

    #[test]
    fn les_noms_de_masque_ne_sortent_pas_du_dossier() {
        let id = "a".repeat(64);
        assert!(nom_valide(&format!("{id}-birefnet-lite")));
        assert!(!nom_valide(&format!("{id}-../x")) && !nom_valide(&format!("{id}-")) && !nom_valide("x-birefnet") && !nom_valide(&format!("{id}/birefnet")));
        let el = json!({ "type": "image", "detourage": { "masque": format!("{id}-ben2"), "coups": [{ "mode": "effacer", "rayon": 0.1, "durete": 0.5, "points": [[0.1, 0.2]] }] } });
        assert_eq!(de_l_element(&el).map(|d| d.coups.len()), Some(1));
        assert!(de_l_element(&json!({ "type": "video", "detourage": { "masque": format!("{id}-ben2") } })).is_none());
        assert!(de_l_element(&json!({ "type": "image", "detourage": { "masque": "../../etc" } })).is_none());
    }

    fn dossier_de_test(nom: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("eliot-detourage-test-{nom}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    /// Une photo importée dans un dossier de ressources : un carré rouge sur fond bleu.
    fn photo(dossier: &Path) -> String {
        let img = image::RgbImage::from_fn(400, 300, |x, y| if (100..300).contains(&x) && (75..225).contains(&y) { image::Rgb([220, 30, 30]) } else { image::Rgb([30, 60, 200]) });
        let mut png = Vec::new();
        img.write_to(&mut io::Cursor::new(&mut png), image::ImageFormat::Png).unwrap();
        images::importer(&png, "carre.png", dossier).unwrap().id
    }

    /// Un faux Python : il lit l'image de 1024 x 1024 et garde le rouge (le premier plan).
    fn faux_python(dossier: &Path) -> PathBuf {
        let p = dossier.join("faux_python.sh");
        let script = r#"#!/bin/sh
# Arguments : -I -B detourer.py --modele M --entree E --sortie S ...
while [ $# -gt 0 ]; do case "$1" in --entree) E="$2"; shift;; --sortie) S="$2"; shift;; esac; shift; done
echo "etape image"; echo "etape modele"
python3 -c "
import sys
e = open('$E', 'rb').read()
import struct
o = bytearray()
for i in range(0, len(e), 3):
    o += struct.pack('<f', 1.0 if e[i] > 150 and e[i + 2] < 100 else 0.0)
open('$S', 'wb').write(bytes(o))
"
echo "etape fini"
"#;
        fs::write(&p, script).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&p, fs::Permissions::from_mode(0o755)).unwrap();
        }
        p
    }

    #[test]
    fn une_photo_se_detoure_et_le_masque_se_pose() {
        let d = dossier_de_test("photo");
        let id = photo(&d);
        let python = faux_python(&d);
        let modele = d.join("faux.onnx");
        fs::write(&modele, b"faux").unwrap();
        let annule = AtomicBool::new(false);
        let mut etapes = Vec::new();
        let nom = detourer(&d, &id, &python, &modele, &MODELES[1], false, &annule, &mut |p| etapes.push(p)).unwrap();
        assert_eq!(nom, format!("{id}-birefnet-lite"));
        assert!(etapes.windows(2).all(|w| w[0] <= w[1]) && etapes.last() == Some(&1.0), "{etapes:?}");
        let masque = lire_masque(&d, &nom).unwrap();
        assert_eq!(masque.dimensions(), (COTE, COTE));
        // Posé sur l'image à sa taille : le carré reste, le fond devient transparent.
        let mut rgba = image::RgbaImage::from_pixel(400, 300, image::Rgba([10, 20, 30, 255])).into_raw();
        appliquer(&d, &mut rgba, 400, 300, &Detourage { masque: nom.clone(), coups: vec![] }).unwrap();
        let a = |x: usize, y: usize| rgba[(y * 400 + x) * 4 + 3];
        assert_eq!((a(200, 150), a(20, 20), a(390, 290)), (255, 0, 0));
        // Relu sans relancer le modèle (un programme absent n'y change rien).
        assert_eq!(detourer(&d, &id, Path::new("/nulle/part"), &modele, &MODELES[1], false, &annule, &mut |_| ()).unwrap(), nom);
        assert!(matches!(detourer(&d, &id, Path::new("/nulle/part"), &modele, &MODELES[1], true, &annule, &mut |_| ()), Err(ErreurDetourage::Absent)));
        // Les masques suivent la photo quand on la copie dans un autre design.
        assert_eq!(masques_de(&d, &id).len(), 1);
        let autre = dossier_de_test("photo-copiee");
        images::copier(&d, &autre, std::slice::from_ref(&id)).unwrap();
        assert_eq!(lire_masque(&autre, &nom).unwrap().dimensions(), (COTE, COTE));
        let _ = fs::remove_dir_all(&d);
        let _ = fs::remove_dir_all(&autre);
    }

    #[test]
    fn un_programme_qui_echoue_le_dit() {
        let d = dossier_de_test("echec");
        let id = photo(&d);
        let p = d.join("python_casse.sh");
        fs::write(&p, "#!/bin/sh\necho 'onnxruntime introuvable' >&2\nexit 1\n").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&p, fs::Permissions::from_mode(0o755)).unwrap();
        }
        let r = detourer(&d, &id, &p, &d.join("m.onnx"), &MODELES[0], false, &AtomicBool::new(false), &mut |_| ());
        assert!(matches!(&r, Err(ErreurDetourage::Echec(m)) if m.contains("onnxruntime introuvable")), "{r:?}");
        assert!(!chemin_masque(&d, &format!("{id}-birefnet")).unwrap().exists());
        let _ = fs::remove_dir_all(&d);
    }

    /// Le vrai modèle, s'il est là (dans le conteneur de Claude : `ELIOT_DETOURAGE_DOSSIER`).
    #[test]
    fn le_vrai_modele_detoure_si_il_est_la() {
        let Some(dossier) = std::env::var_os("ELIOT_DETOURAGE_DOSSIER").map(PathBuf::from) else { return };
        let ds = [dossier];
        let (Some(python), Some((modele, sorte))) = (trouver_python(&ds), trouver_modele(&ds)) else { return };
        let d = dossier_de_test("vrai");
        let id = photo(&d);
        let nom = detourer(&d, &id, &python, &modele, &sorte, false, &AtomicBool::new(false), &mut |_| ()).unwrap();
        let m = lire_masque(&d, &nom).unwrap();
        let v = |x: u32, y: u32| m.get_pixel(x * COTE / 400, y * COTE / 300)[0];
        assert!(v(200, 150) > 200 && v(20, 20) < 50, "centre {} coin {}", v(200, 150), v(20, 20));
        let _ = fs::remove_dir_all(&d);
    }
}
