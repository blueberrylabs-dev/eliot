//! Import des vidéos (étape 4) : l'original rangé une seule fois, une copie d'aperçu légère
//! pour la fenêtre (règle 5 : l'interface ne lit jamais l'original), une image de couverture,
//! la bande des vignettes de la frise et la forme d'onde du son. Tout passe par les programmes
//! `ffprobe` et `ffmpeg` du système, sur le processeur (règle 9 : jamais l'encodeur de la
//! carte graphique).
//!
//! Rangement, à côté des images (voir `images.rs`) :
//! `originaux/<empreinte>.<ext>`, `copies/<empreinte>.<webm|mp4>`, `apercus/<empreinte>.jpg`
//! (la couverture), `miniatures/<empreinte>.jpg`, `vignettes/<empreinte>.jpg`,
//! `ondes/<empreinte>.json`, `infos/<empreinte>.json`.

use std::fs::{self, File};
use std::io::{self, BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use thiserror::Error;

use crate::fichiers::{chemin_temporaire, copier_atomiquement, ecrire_atomiquement};
use crate::images::{self, Credit, Ressource};

#[derive(Debug, Error)]
pub enum ErreurVideo {
    #[error("ffmpeg introuvable : installe-le (commande 2 du CLAUDE.md : sudo apt install ffmpeg)")]
    FfmpegAbsent,
    #[error("ce fichier ne contient pas de vidéo lisible")]
    PasDeVideo,
    #[error("ffmpeg a échoué : {0}")]
    Ffmpeg(String),
    #[error("lecture impossible : {0}")]
    Lecture(#[from] io::Error),
    #[error("image de couverture illisible : {0}")]
    Couverture(String),
}

/// Le format de la copie d'aperçu, choisi par le banc de l'étape 4 (lot 0).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CodecCopie {
    Vp9,
    Vp8,
    H264,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ReglageCopie {
    pub codec: CodecCopie,
    /// Le petit côté de la copie, en pixels (720 : 1280 × 720 pour une vidéo en largeur,
    /// 720 × 1280 pour une story). Jamais d'agrandissement. Choisi par le banc du lot 0
    /// (2026-10-15) : VP9 en 720 joue sans à-coup dans la page et la tête de lecture saute en
    /// 8 ms ; 540 reste possible pour une machine modeste.
    pub cote_court: u32,
}

impl Default for ReglageCopie {
    fn default() -> Self {
        Self { codec: CodecCopie::Vp9, cote_court: 720 }
    }
}

impl ReglageCopie {
    pub fn extension(&self) -> &'static str {
        match self.codec {
            CodecCopie::Vp9 | CodecCopie::Vp8 => "webm",
            CodecCopie::H264 => "mp4",
        }
    }

    /// Les arguments d'encodage : une image clé par demi-seconde (15 images à 30 images/s,
    /// `-force_key_frames` pour suivre n'importe quelle cadence), pour que la tête de lecture
    /// saute vite n'importe où.
    fn arguments(&self) -> Vec<String> {
        let c = self.cote_court;
        // Le petit côté ramené à `c` (s'il est plus grand), l'autre suit, toujours pair.
        let echelle = format!("scale='if(gt(iw,ih),-2,min({c},iw))':'if(gt(iw,ih),min({c},ih),-2)'");
        let mut a: Vec<&str> = vec!["-vf", &echelle, "-force_key_frames", "expr:gte(t,n_forced*0.5)", "-pix_fmt", "yuv420p"];
        let codec: &[&str] = match self.codec {
            CodecCopie::Vp9 => &["-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1", "-crf", "33", "-b:v", "0", "-c:a", "libopus", "-b:a", "96k"],
            CodecCopie::Vp8 => &["-c:v", "libvpx", "-deadline", "realtime", "-cpu-used", "8", "-crf", "10", "-b:v", "2M", "-c:a", "libopus", "-b:a", "96k"],
            CodecCopie::H264 => &["-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart"],
        };
        a.extend_from_slice(codec);
        a.into_iter().map(String::from).collect()
    }
}

/// Ce que l'interface sait d'une vidéo, rangé dans `infos/<empreinte>.json` avec la ressource.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InfosVideo {
    /// Durée, en millisecondes.
    pub duree: u64,
    pub images_par_seconde: f64,
    /// La vidéo a-t-elle une piste son ?
    pub son: bool,
    /// Extension de la copie d'aperçu (`webm` ou `mp4`).
    pub copie: String,
    /// La bande des vignettes de la frise.
    pub vignettes: Vignettes,
}

/// Une image JPEG faite de `nombre` vignettes côte à côte, une toutes les `intervalle` ms.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Vignettes {
    pub nombre: u32,
    pub intervalle: u64,
    pub largeur: u32,
    pub hauteur: u32,
}

/// La forme d'onde : le pic du son, de 0 à 100, `par_seconde` fois par seconde.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Onde {
    pub par_seconde: u32,
    pub pics: Vec<u8>,
}

/// Ce que `ffprobe` dit d'un fichier.
#[derive(Debug, Clone, PartialEq)]
pub struct Sondage {
    pub duree: u64,
    /// Dimensions affichées (rotation de l'appareil appliquée).
    pub largeur: u32,
    pub hauteur: u32,
    pub images_par_seconde: f64,
    pub son: bool,
}

pub const HAUTEUR_VIGNETTE: u32 = 90;
pub const VIGNETTES_MAX: u32 = 60;
pub const PICS_PAR_SECONDE: u32 = 50;

pub(crate) fn programme(nom: &str) -> Command {
    let mut commande = Command::new(nom);
    commande.stdin(Stdio::null());
    commande
}

fn lancer(nom: &str, arguments: &[String]) -> Result<Vec<u8>, ErreurVideo> {
    let sortie = programme(nom).args(arguments).output().map_err(|e| {
        if e.kind() == io::ErrorKind::NotFound { ErreurVideo::FfmpegAbsent } else { ErreurVideo::Lecture(e) }
    })?;
    if !sortie.status.success() {
        let message = String::from_utf8_lossy(&sortie.stderr);
        return Err(ErreurVideo::Ffmpeg(message.lines().last().unwrap_or("échec sans message").to_string()));
    }
    Ok(sortie.stdout)
}

pub(crate) fn chemin_texte(chemin: &Path) -> String {
    chemin.to_string_lossy().into_owned()
}

/// `30000/1001` → 29.97.
fn fraction(texte: &str) -> Option<f64> {
    let (n, d) = texte.split_once('/').unwrap_or((texte, "1"));
    let (n, d) = (n.parse::<f64>().ok()?, d.parse::<f64>().ok()?);
    (d > 0.0 && n > 0.0).then(|| n / d)
}

/// Interprète la sortie JSON de `ffprobe -show_format -show_streams`.
pub fn lire_sondage(json: &Value) -> Result<Sondage, ErreurVideo> {
    let flux = json.get("streams").and_then(Value::as_array).cloned().unwrap_or_default();
    let video = flux
        .iter()
        .find(|f| f.get("codec_type").and_then(Value::as_str) == Some("video") && f.pointer("/disposition/attached_pic").and_then(Value::as_i64) != Some(1))
        .ok_or(ErreurVideo::PasDeVideo)?;
    let son = flux.iter().any(|f| f.get("codec_type").and_then(Value::as_str) == Some("audio"));
    let (mut largeur, mut hauteur) = (
        video.get("width").and_then(Value::as_u64).unwrap_or(0) as u32,
        video.get("height").and_then(Value::as_u64).unwrap_or(0) as u32,
    );
    if largeur == 0 || hauteur == 0 {
        return Err(ErreurVideo::PasDeVideo);
    }
    // Un téléphone tenu debout filme en largeur et note la rotation : on la suit, comme ffmpeg.
    let rotation = video
        .get("side_data_list")
        .and_then(Value::as_array)
        .and_then(|l| l.iter().find_map(|d| d.get("rotation").and_then(Value::as_f64)))
        .or_else(|| video.pointer("/tags/rotate").and_then(Value::as_str).and_then(|r| r.parse().ok()))
        .unwrap_or(0.0);
    if (rotation.abs() as i64) % 180 == 90 {
        std::mem::swap(&mut largeur, &mut hauteur);
    }
    let secondes = json
        .pointer("/format/duration")
        .and_then(Value::as_str)
        .or_else(|| video.get("duration").and_then(Value::as_str))
        .and_then(|d| d.parse::<f64>().ok())
        .filter(|d| *d > 0.0)
        .ok_or(ErreurVideo::PasDeVideo)?;
    let images_par_seconde = video
        .get("avg_frame_rate")
        .and_then(Value::as_str)
        .and_then(fraction)
        .or_else(|| video.get("r_frame_rate").and_then(Value::as_str).and_then(fraction))
        .unwrap_or(30.0);
    Ok(Sondage {
        duree: (secondes * 1000.0).round() as u64,
        largeur,
        hauteur,
        images_par_seconde: (images_par_seconde * 100.0).round() / 100.0,
        son,
    })
}

pub fn sonder(chemin: &Path) -> Result<Sondage, ErreurVideo> {
    let arguments = ["-v", "error", "-print_format", "json", "-show_format", "-show_streams"].map(String::from);
    let mut liste = arguments.to_vec();
    liste.push(chemin_texte(chemin));
    let sortie = lancer("ffprobe", &liste)?;
    let json: Value = serde_json::from_slice(&sortie).map_err(|e| ErreurVideo::Ffmpeg(format!("réponse de ffprobe illisible : {e}")))?;
    lire_sondage(&json)
}

/// Empreinte SHA-256 d'un fichier lu par morceaux : une vidéo de plusieurs Go ne passe jamais
/// en mémoire.
pub fn empreinte_fichier(chemin: &Path) -> io::Result<String> {
    let mut fichier = File::open(chemin)?;
    let mut somme = Sha256::new();
    let mut tampon = vec![0u8; 1 << 20];
    loop {
        let lus = fichier.read(&mut tampon)?;
        if lus == 0 {
            break;
        }
        somme.update(&tampon[..lus]);
    }
    Ok(somme.finalize().iter().map(|o| format!("{o:02x}")).collect())
}

/// Encode la copie d'aperçu en suivant l'avancement (`-progress`), de 0 à 1.
fn fabriquer_copie(original: &Path, cible: &Path, reglage: &ReglageCopie, duree: u64, avancement: &mut dyn FnMut(f32)) -> Result<(), ErreurVideo> {
    let mut arguments = vec!["-i".to_string(), chemin_texte(original)];
    arguments.extend(reglage.arguments());
    encoder_vers(&arguments, cible, reglage.extension(), duree, avancement)
}

/// Lance `ffmpeg` avec `arguments` (entrée et réglages, sans la sortie) vers un temporaire
/// d'extension `extension`, renommé en `cible` à la fin. L'avancement (`-progress`) va de 0 à
/// 1 d'après la durée attendue, en ms. Sert aussi aux sons (`sons.rs`).
pub(crate) fn encoder_vers(arguments: &[String], cible: &Path, extension: &str, duree: u64, avancement: &mut dyn FnMut(f32)) -> Result<(), ErreurVideo> {
    let temporaire = chemin_temporaire(cible)?;
    // Le temporaire garde l'extension : ffmpeg en déduit le conteneur.
    let temporaire = temporaire.with_extension(format!("{}.{extension}", temporaire.extension().map(|e| e.to_string_lossy().into_owned()).unwrap_or_default()));
    let mut tous: Vec<String> = ["-y", "-hide_banner", "-loglevel", "error", "-nostats", "-progress", "pipe:1"].map(String::from).to_vec();
    tous.extend_from_slice(arguments);
    tous.push(chemin_texte(&temporaire));
    let mut processus = programme("ffmpeg")
        .args(&tous)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| if e.kind() == io::ErrorKind::NotFound { ErreurVideo::FfmpegAbsent } else { ErreurVideo::Lecture(e) })?;
    // Le texte d'erreur est lu à part, pour ne jamais bloquer ffmpeg sur un tuyau plein.
    let mut erreur = processus.stderr.take().expect("stderr redirigé");
    let lecteur_erreur = std::thread::spawn(move || {
        let mut texte = String::new();
        let _ = erreur.read_to_string(&mut texte);
        texte
    });
    if let Some(sortie) = processus.stdout.take() {
        for ligne in BufReader::new(sortie).lines().map_while(Result::ok) {
            if let Some(us) = ligne.strip_prefix("out_time_us=").and_then(|v| v.parse::<f64>().ok())
                && duree > 0
            {
                avancement(((us / 1000.0) / duree as f64).clamp(0.0, 1.0) as f32);
            }
        }
    }
    let statut = processus.wait()?;
    let texte_erreur = lecteur_erreur.join().unwrap_or_default();
    if !statut.success() {
        let _ = fs::remove_file(&temporaire);
        return Err(ErreurVideo::Ffmpeg(texte_erreur.lines().last().unwrap_or("échec sans message").to_string()));
    }
    fs::rename(&temporaire, cible)?;
    Ok(())
}

/// La couverture : une image prise à l'instant `ms` de l'original, en pleine taille.
fn image_a(original: &Path, ms: u64) -> Result<image::DynamicImage, ErreurVideo> {
    let mut arguments: Vec<String> = vec!["-hide_banner".into(), "-loglevel".into(), "error".into(), "-ss".into(), format!("{:.3}", ms as f64 / 1000.0), "-i".into()];
    arguments.push(chemin_texte(original));
    arguments.extend(["-frames:v", "1", "-f", "image2pipe", "-c:v", "png", "pipe:1"].map(String::from));
    let png = lancer("ffmpeg", &arguments)?;
    image::load_from_memory(&png).map_err(|e| ErreurVideo::Couverture(e.to_string()))
}

/// L'image de la copie d'aperçu à l'instant `ms` du fichier, en JPEG : ce que la fenêtre montre
/// à cet instant, pour une capture ou une vignette de page vidéo. Rapide grâce aux images clés
/// rapprochées de la copie.
pub fn image_de_copie(dossier: &Path, id: &str, ms: u64) -> Result<Vec<u8>, ErreurVideo> {
    let copie = images::chemin_ressource(dossier, id, images::Genre::Copie).map_err(|e| ErreurVideo::Lecture(io::Error::other(e.to_string())))?;
    let mut arguments: Vec<String> = vec!["-hide_banner".into(), "-loglevel".into(), "error".into(), "-ss".into(), format!("{:.3}", ms as f64 / 1000.0), "-i".into()];
    arguments.push(chemin_texte(&copie));
    arguments.extend(["-frames:v", "1", "-f", "image2pipe", "-c:v", "mjpeg", "-q:v", "3", "pipe:1"].map(String::from));
    let jpeg = lancer("ffmpeg", &arguments)?;
    if jpeg.is_empty() {
        return Err(ErreurVideo::Ffmpeg(format!("aucune image à {ms} ms")));
    }
    Ok(jpeg)
}

fn pair(v: f64) -> u32 {
    ((v / 2.0).round() as u32).max(1) * 2
}

/// La bande des vignettes, tirée de la copie (plus rapide à décoder que l'original).
fn fabriquer_vignettes(copie: &Path, cible: &Path, sondage: &Sondage) -> Result<Vignettes, ErreurVideo> {
    let secondes = sondage.duree as f64 / 1000.0;
    let nombre = (secondes.ceil() as u32).clamp(1, VIGNETTES_MAX);
    let largeur = pair(HAUTEUR_VIGNETTE as f64 * sondage.largeur as f64 / sondage.hauteur as f64);
    let filtre = format!("fps={nombre}/{secondes:.3},scale={largeur}:{HAUTEUR_VIGNETTE},tile={nombre}x1");
    let mut arguments: Vec<String> = ["-y", "-hide_banner", "-loglevel", "error", "-i"].map(String::from).to_vec();
    arguments.push(chemin_texte(copie));
    arguments.extend(["-vf".to_string(), filtre, "-frames:v".into(), "1".into(), "-q:v".into(), "5".into()]);
    let temporaire = chemin_temporaire(cible)?.with_extension("jpg");
    arguments.push(chemin_texte(&temporaire));
    lancer("ffmpeg", &arguments)?;
    fs::rename(&temporaire, cible)?;
    Ok(Vignettes { nombre, intervalle: (sondage.duree as f64 / nombre as f64).round() as u64, largeur, hauteur: HAUTEUR_VIGNETTE })
}

/// Les pics d'un son en 16 bits, mono : un pic (0 à 100) par paquet de `paquet` échantillons.
pub fn pics(echantillons: &[u8], paquet: usize) -> Vec<u8> {
    echantillons
        .chunks(paquet * 2)
        .map(|morceau| {
            let max = morceau.chunks_exact(2).map(|o| i16::from_le_bytes([o[0], o[1]]).unsigned_abs()).max().unwrap_or(0);
            ((max as f64 / 32768.0) * 100.0).round().min(100.0) as u8
        })
        .collect()
}

/// La forme d'onde, tirée de la copie : son ramené en mono à 8 000 Hz, puis des pics.
fn fabriquer_onde(copie: &Path) -> Result<Onde, ErreurVideo> {
    const FREQUENCE: u32 = 8000;
    let mut arguments: Vec<String> = ["-hide_banner", "-loglevel", "error", "-i"].map(String::from).to_vec();
    arguments.push(chemin_texte(copie));
    arguments.extend(["-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", "pipe:1"].map(String::from));
    let brut = lancer("ffmpeg", &arguments)?;
    Ok(Onde { par_seconde: PICS_PAR_SECONDE, pics: pics(&brut, (FREQUENCE / PICS_PAR_SECONDE) as usize) })
}

/// L'extension de l'original, nettoyée (elle sert à construire un chemin).
pub(crate) fn extension_sure(chemin: &Path) -> String {
    let brute = chemin.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    if !brute.is_empty() && brute.len() <= 5 && brute.chars().all(|c| c.is_ascii_alphanumeric()) { brute } else { "video".into() }
}

const SOUS_DOSSIERS: [&str; 7] = ["originaux", "copies", "apercus", "miniatures", "vignettes", "ondes", "infos"];

/// Importe une vidéo du disque. `avancement` reçoit de 0 à 1 pendant le travail (la copie
/// d'aperçu en prend l'essentiel). Une vidéo déjà importée n'est pas refaite.
pub fn importer(chemin: &Path, dossier: &Path, reglage: &ReglageCopie, avancement: &mut dyn FnMut(f32)) -> Result<Ressource, ErreurVideo> {
    let nom = chemin.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "vidéo".into());
    let id = empreinte_fichier(chemin)?;
    let infos = dossier.join("infos").join(format!("{id}.json"));
    if let Ok(texte) = fs::read(&infos)
        && let Ok(mut deja) = serde_json::from_slice::<Ressource>(&texte)
        && deja.video.is_some()
    {
        deja.nom = nom;
        avancement(1.0);
        return Ok(deja);
    }
    let sondage = sonder(chemin)?;
    for sous_dossier in SOUS_DOSSIERS {
        fs::create_dir_all(dossier.join(sous_dossier))?;
    }
    avancement(0.0);
    let original = dossier.join("originaux").join(format!("{id}.{}", extension_sure(chemin)));
    if !original.exists() {
        copier_atomiquement(chemin, &original)?;
    }
    avancement(0.05);

    let copie = dossier.join("copies").join(format!("{id}.{}", reglage.extension()));
    fabriquer_copie(&original, &copie, reglage, sondage.duree, &mut |a| avancement(0.05 + 0.8 * a))?;

    // Couverture prise à une seconde (ou au dixième d'une vidéo plus courte) : la première
    // image d'une vidéo est souvent noire.
    let couverture = image_a(&original, (sondage.duree / 10).min(1000))?;
    let couverture = image::DynamicImage::ImageRgb8(couverture.to_rgb8());
    let apercu = images::reduire(&couverture, images::COTE_APERCU).map_err(|e| ErreurVideo::Couverture(e.to_string()))?;
    let miniature = images::reduire(&apercu, images::COTE_MINIATURE).map_err(|e| ErreurVideo::Couverture(e.to_string()))?;
    ecrire_atomiquement(&dossier.join("apercus").join(format!("{id}.jpg")), &images::encoder(&apercu, false).map_err(|e| ErreurVideo::Couverture(e.to_string()))?)?;
    ecrire_atomiquement(&dossier.join("miniatures").join(format!("{id}.jpg")), &images::encoder(&miniature, false).map_err(|e| ErreurVideo::Couverture(e.to_string()))?)?;
    avancement(0.9);

    let vignettes = fabriquer_vignettes(&copie, &dossier.join("vignettes").join(format!("{id}.jpg")), &sondage)?;
    if sondage.son {
        let onde = fabriquer_onde(&copie)?;
        ecrire_atomiquement(&dossier.join("ondes").join(format!("{id}.json")), &serde_json::to_vec(&onde).expect("onde sérialisable"))?;
    }

    let ressource = Ressource {
        id: id.clone(),
        nom,
        largeur: sondage.largeur,
        hauteur: sondage.hauteur,
        transparence: false,
        format_apercu: "jpg".into(),
        credit: None,
        son: None,
        modele3d: None,
        environnement3d: None,
        video: Some(InfosVideo {
            duree: sondage.duree,
            images_par_seconde: sondage.images_par_seconde,
            son: sondage.son,
            copie: reglage.extension().into(),
            vignettes,
        }),
    };
    ecrire_atomiquement(&infos, &serde_json::to_vec_pretty(&ressource).expect("ressource sérialisable"))?;
    avancement(1.0);
    Ok(ressource)
}

/// Importe une vidéo venue d'une banque (Pixabay) et garde son crédit avec elle.
pub fn importer_avec_credit(chemin: &Path, nom: &str, dossier: &Path, reglage: &ReglageCopie, credit: Credit, avancement: &mut dyn FnMut(f32)) -> Result<Ressource, ErreurVideo> {
    let mut ressource = importer(chemin, dossier, reglage, avancement)?;
    ressource.nom = nom.to_string();
    ressource.credit = Some(credit);
    let infos = dossier.join("infos").join(format!("{}.json", ressource.id));
    ecrire_atomiquement(&infos, &serde_json::to_vec_pretty(&ressource).expect("ressource sérialisable"))?;
    Ok(ressource)
}

/// Les fichiers propres à une vidéo, en plus de ceux d'une image (copie, vignettes, onde).
pub fn fichiers_en_plus(dossier: &Path, ressource: &Ressource) -> Vec<PathBuf> {
    let Some(video) = &ressource.video else { return Vec::new() };
    let id = &ressource.id;
    let mut liste = vec![dossier.join("copies").join(format!("{id}.{}", video.copie)), dossier.join("vignettes").join(format!("{id}.jpg"))];
    if video.son {
        liste.push(dossier.join("ondes").join(format!("{id}.json")));
    }
    liste
}

/// Extensions reconnues comme des vidéos à l'import.
pub const EXTENSIONS: [&str; 8] = ["mp4", "mov", "m4v", "webm", "mkv", "avi", "mpg", "mpeg"];

pub fn est_une_video(chemin: &Path) -> bool {
    chemin.extension().is_some_and(|e| EXTENSIONS.contains(&e.to_string_lossy().to_lowercase().as_str()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn ffmpeg_present() -> bool {
        Command::new("ffmpeg").arg("-version").stdout(Stdio::null()).stderr(Stdio::null()).status().is_ok_and(|s| s.success())
    }

    fn dossier_de_test(nom: &str) -> PathBuf {
        let dossier = std::env::temp_dir().join(format!("eliot-videos-{nom}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dossier);
        fs::create_dir_all(&dossier).unwrap();
        dossier
    }

    /// Une petite vidéo synthétique (mire et son), faite par ffmpeg.
    fn video_de_test(dossier: &Path, nom: &str, taille: &str, son: bool) -> PathBuf {
        let chemin = dossier.join(nom);
        let mut a: Vec<String> = ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i"].map(String::from).to_vec();
        a.push(format!("testsrc=size={taille}:rate=25"));
        if son {
            a.extend(["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000"].map(String::from));
        }
        a.extend(["-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p"].map(String::from));
        if son {
            a.extend(["-c:a", "aac", "-shortest"].map(String::from));
        }
        a.push(chemin_texte(&chemin));
        lancer("ffmpeg", &a).unwrap();
        chemin
    }

    #[test]
    fn le_sondage_lit_duree_taille_cadence_et_rotation() {
        let json = json!({
            "streams": [
                { "codec_type": "video", "width": 1920, "height": 1080, "avg_frame_rate": "30000/1001", "side_data_list": [{ "rotation": -90 }] },
                { "codec_type": "audio" }
            ],
            "format": { "duration": "12.345" }
        });
        let s = lire_sondage(&json).unwrap();
        assert_eq!(s, Sondage { duree: 12345, largeur: 1080, hauteur: 1920, images_par_seconde: 29.97, son: true });
        let sans_video = json!({ "streams": [{ "codec_type": "audio" }], "format": { "duration": "3" } });
        assert!(matches!(lire_sondage(&sans_video), Err(ErreurVideo::PasDeVideo)));
        // Une pochette d'album n'est pas une vidéo.
        let pochette = json!({ "streams": [{ "codec_type": "video", "width": 500, "height": 500, "disposition": { "attached_pic": 1 } }], "format": { "duration": "3" } });
        assert!(matches!(lire_sondage(&pochette), Err(ErreurVideo::PasDeVideo)));
    }

    #[test]
    fn les_pics_du_son() {
        let mut brut = Vec::new();
        for v in [0i16, 16384, -32768, 100] {
            brut.extend_from_slice(&v.to_le_bytes());
        }
        assert_eq!(pics(&brut, 2), vec![50, 100]);
    }

    #[test]
    fn une_video_s_importe_avec_sa_copie_ses_vignettes_et_son_onde() {
        if !ffmpeg_present() {
            eprintln!("ffmpeg absent : essai sauté");
            return;
        }
        let dossier = dossier_de_test("import");
        let source = video_de_test(&dossier, "essai.mp4", "640x360", true);
        let ressources = dossier.join("ressources");
        let mut etapes = Vec::new();
        let r = importer(&source, &ressources, &ReglageCopie::default(), &mut |a| etapes.push(a)).unwrap();
        assert_eq!((r.largeur, r.hauteur), (640, 360));
        let v = r.video.clone().unwrap();
        assert!((1900..=2100).contains(&v.duree), "{}", v.duree);
        assert!(v.son);
        assert_eq!(v.copie, "webm");
        assert_eq!(etapes.last(), Some(&1.0));
        assert!(etapes.windows(2).all(|p| p[0] <= p[1]), "l'avancement ne recule pas : {etapes:?}");
        // La copie : VP9 en 1280 × 720 au plus, ici 640 × 360 (jamais d'agrandissement).
        let copie = images::chemin_ressource(&ressources, &r.id, images::Genre::Copie).unwrap();
        let s = sonder(&copie).unwrap();
        assert_eq!((s.largeur, s.hauteur), (640, 360));
        // Les vignettes : une par seconde, 90 px de haut.
        let bande = image::open(images::chemin_ressource(&ressources, &r.id, images::Genre::Vignettes).unwrap()).unwrap();
        assert_eq!((bande.width(), bande.height()), (v.vignettes.largeur * v.vignettes.nombre, 90));
        assert_eq!(v.vignettes.nombre, 2);
        // L'onde : 50 pics par seconde, un son franc (la sinusoïde) partout.
        let onde: Onde = serde_json::from_slice(&fs::read(images::chemin_ressource(&ressources, &r.id, images::Genre::Onde).unwrap()).unwrap()).unwrap();
        assert!((95..=105).contains(&onde.pics.len()), "{}", onde.pics.len());
        assert!(onde.pics[10..90].iter().all(|p| *p > 5), "{:?}", &onde.pics[..20]);
        // La couverture et la miniature, l'original intact.
        assert!(images::chemin_ressource(&ressources, &r.id, images::Genre::Apercu).unwrap().exists());
        let original = images::chemin_ressource(&ressources, &r.id, images::Genre::Original).unwrap();
        assert_eq!(fs::read(&original).unwrap(), fs::read(&source).unwrap());
        // L'image d'un instant, tirée de la copie : un JPEG à la taille de la copie.
        let jpeg = image_de_copie(&ressources, &r.id, 1500).unwrap();
        assert_eq!(&jpeg[..2], &[0xFF, 0xD8]);
        assert_eq!(image::load_from_memory(&jpeg).unwrap().width(), 640);
        assert!(image_de_copie(&ressources, "inconnue", 0).is_err());
        // Réimporter ne refait rien.
        let mut appels = 0;
        let encore = importer(&source, &ressources, &ReglageCopie::default(), &mut |_| appels += 1).unwrap();
        assert_eq!(encore.id, r.id);
        assert_eq!(appels, 1);
        // Elle se liste avec les images, et se copie dans un autre design avec tous ses fichiers.
        assert_eq!(images::lister(&ressources)[0].video.as_ref().map(|v| v.duree), Some(v.duree));
        let autre = dossier.join("autre");
        images::copier(&ressources, &autre, std::slice::from_ref(&r.id)).unwrap();
        for genre in [images::Genre::Copie, images::Genre::Vignettes, images::Genre::Onde, images::Genre::Original] {
            assert!(images::chemin_ressource(&autre, &r.id, genre).unwrap().exists(), "{genre:?}");
        }
        fs::remove_dir_all(&dossier).unwrap();
    }

    #[test]
    fn une_video_debout_garde_son_sens_et_une_video_muette_n_a_pas_d_onde() {
        if !ffmpeg_present() {
            eprintln!("ffmpeg absent : essai sauté");
            return;
        }
        let dossier = dossier_de_test("debout");
        let source = video_de_test(&dossier, "story.mp4", "1080x1920", false);
        let ressources = dossier.join("ressources");
        let r = importer(&source, &ressources, &ReglageCopie::default(), &mut |_| ()).unwrap();
        let v = r.video.unwrap();
        assert!(!v.son);
        assert!(images::chemin_ressource(&ressources, &r.id, images::Genre::Onde).is_err());
        // Le petit côté passe à 720 : 720 × 1280.
        let copie = sonder(&images::chemin_ressource(&ressources, &r.id, images::Genre::Copie).unwrap()).unwrap();
        assert_eq!((copie.largeur, copie.hauteur), (720, 1280));
        assert_eq!(v.vignettes.largeur, 50);
        // Le réglage d'une machine modeste : 540 × 960.
        let modeste = dossier.join("modeste");
        let r = importer(&source, &modeste, &ReglageCopie { codec: CodecCopie::Vp9, cote_court: 540 }, &mut |_| ()).unwrap();
        let copie = sonder(&images::chemin_ressource(&modeste, &r.id, images::Genre::Copie).unwrap()).unwrap();
        assert_eq!((copie.largeur, copie.hauteur), (540, 960));
        fs::remove_dir_all(&dossier).unwrap();
    }

    #[test]
    fn un_fichier_qui_n_est_pas_une_video_est_refuse() {
        if !ffmpeg_present() {
            return;
        }
        let dossier = dossier_de_test("faux");
        let faux = dossier.join("faux.mp4");
        fs::write(&faux, b"pas une video").unwrap();
        assert!(importer(&faux, &dossier.join("r"), &ReglageCopie::default(), &mut |_| ()).is_err());
        assert!(est_une_video(Path::new("a/B.MOV")) && !est_une_video(Path::new("a/b.jpg")));
        fs::remove_dir_all(&dossier).unwrap();
    }
}
