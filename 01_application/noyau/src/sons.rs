//! Import des sons (étape 4, lot 5) : musiques, bruitages, jingles. L'original est rangé une
//! seule fois ; la fenêtre joue une copie d'écoute légère (règle 5 : elle ne lit jamais
//! l'original) ; le noyau mesure le niveau sonore (EBU R128) et la forme d'onde de la frise.
//! Tout passe par `ffprobe` et `ffmpeg`, sur le processeur (règle 9).
//!
//! Rangement, à côté des images et des vidéos (voir `images.rs`) :
//! `originaux/<empreinte>.<ext>`, `copies/<empreinte>.webm` (Opus, 128 kbit/s, stéréo,
//! 48 kHz), `ondes/<empreinte>.json`, `infos/<empreinte>.json`. Ni aperçu ni miniature.

use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::process::Stdio;

use ebur128::{EbuR128, Mode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

use crate::fichiers::{copier_atomiquement, ecrire_atomiquement};
use crate::images::{Credit, Ressource};
use crate::videos::{self, ErreurVideo, Onde, PICS_PAR_SECONDE};

#[derive(Debug, Error)]
pub enum ErreurSon {
    #[error("ffmpeg introuvable : installe-le (commande 2 du CLAUDE.md : sudo apt install ffmpeg)")]
    FfmpegAbsent,
    #[error("ce fichier ne contient pas de son lisible")]
    PasDeSon,
    #[error("ffmpeg a échoué : {0}")]
    Ffmpeg(String),
    #[error("lecture impossible : {0}")]
    Lecture(#[from] io::Error),
}

impl From<ErreurVideo> for ErreurSon {
    fn from(e: ErreurVideo) -> Self {
        match e {
            ErreurVideo::FfmpegAbsent => ErreurSon::FfmpegAbsent,
            ErreurVideo::Lecture(e) => ErreurSon::Lecture(e),
            ErreurVideo::Ffmpeg(m) => ErreurSon::Ffmpeg(m),
            autre => ErreurSon::Ffmpeg(autre.to_string()),
        }
    }
}

/// Ce que l'interface sait d'un son, rangé dans `infos/<empreinte>.json` avec la ressource.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InfosSon {
    /// Durée, en millisecondes.
    pub duree: u64,
    /// Extension de la copie d'écoute (`webm`).
    pub copie: String,
    /// Niveau intégré (EBU R128), en LUFS ; absent pour un son muet.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lufs: Option<f64>,
    /// Crête vraie, en dBTP ; absente pour un son muet.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub crete: Option<f64>,
    /// D'où vient le son quand Eliot l'a fait lui-même (lot 6) : `micro` (une prise de voix)
    /// ou `synthese` (une voix de synthèse). Absent pour un son importé.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origine: Option<String>,
    /// Une prise au micro : l'instant du top (ms du fichier), où la voix commence après le
    /// compte à rebours. Le clip posé depuis la liste des sons commence là.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub marque: Option<u64>,
}

/// Extensions reconnues comme des sons à l'import.
pub const EXTENSIONS: [&str; 11] = ["mp3", "wav", "ogg", "oga", "opus", "m4a", "aac", "flac", "aif", "aiff", "wma"];

pub fn est_un_son(chemin: &Path) -> bool {
    chemin.extension().is_some_and(|e| EXTENSIONS.contains(&e.to_string_lossy().to_lowercase().as_str()))
}

/// Les réglages de la copie d'écoute : Opus en WebM, que le moteur de la fenêtre lit comme les
/// copies des vidéos (banc du lot 0).
const ARGUMENTS_COPIE: [&str; 13] = ["-map", "0:a:0", "-vn", "-sn", "-c:a", "libopus", "-b:a", "128k", "-ar", "48000", "-ac", "2", "-f"];

/// La durée d'un son (ms) d'après la sortie JSON de `ffprobe -show_format -show_streams`.
pub fn lire_sondage(json: &Value) -> Result<u64, ErreurSon> {
    let flux = json.get("streams").and_then(Value::as_array).cloned().unwrap_or_default();
    let son = flux.iter().find(|f| f.get("codec_type").and_then(Value::as_str) == Some("audio")).ok_or(ErreurSon::PasDeSon)?;
    let secondes = json
        .pointer("/format/duration")
        .and_then(Value::as_str)
        .or_else(|| son.get("duration").and_then(Value::as_str))
        .and_then(|d| d.parse::<f64>().ok())
        .filter(|d| *d > 0.0)
        .ok_or(ErreurSon::PasDeSon)?;
    Ok((secondes * 1000.0).round() as u64)
}

pub fn sonder(chemin: &Path) -> Result<u64, ErreurSon> {
    let sortie = videos::programme("ffprobe")
        .args(["-v", "error", "-print_format", "json", "-show_format", "-show_streams"])
        .arg(chemin)
        .output()
        .map_err(|e| if e.kind() == io::ErrorKind::NotFound { ErreurSon::FfmpegAbsent } else { ErreurSon::Lecture(e) })?;
    if !sortie.status.success() {
        return Err(ErreurSon::PasDeSon);
    }
    let json: Value = serde_json::from_slice(&sortie.stdout).map_err(|e| ErreurSon::Ffmpeg(format!("réponse de ffprobe illisible : {e}")))?;
    lire_sondage(&json)
}

// ----------------------------------------------------------------------------------------
// Mesure : niveau sonore et forme d'onde
// ----------------------------------------------------------------------------------------

pub const FREQUENCE: u32 = 48_000;

/// Le niveau d'un son : intégré (LUFS) et crête vraie (dBTP) ; `None` pour un silence.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct Niveau {
    pub lufs: Option<f64>,
    pub crete: Option<f64>,
}

/// Mesure au fil de l'eau d'un son stéréo à 48 kHz en nombres flottants entrelacés : niveau
/// EBU R128 et pics de la forme d'onde.
pub struct Mesureur {
    r128: EbuR128,
    pics: Vec<u8>,
    pic: f32,
    dans_paquet: usize,
    paquet: usize,
    trames: u64,
}

impl Default for Mesureur {
    fn default() -> Self {
        Self::new()
    }
}

impl Mesureur {
    pub fn new() -> Self {
        Self {
            r128: EbuR128::new(2, FREQUENCE, Mode::I | Mode::TRUE_PEAK).expect("réglages R128 valides"),
            pics: Vec::new(),
            pic: 0.0,
            dans_paquet: 0,
            paquet: (FREQUENCE / PICS_PAR_SECONDE) as usize,
            trames: 0,
        }
    }

    /// Ajoute des trames (gauche, droite, gauche, droite…).
    pub fn ajouter(&mut self, echantillons: &[f32]) {
        let echantillons = &echantillons[..echantillons.len() / 2 * 2];
        if echantillons.is_empty() {
            return;
        }
        let _ = self.r128.add_frames_f32(echantillons);
        for paire in echantillons.chunks_exact(2) {
            self.pic = self.pic.max(paire[0].abs()).max(paire[1].abs());
            self.dans_paquet += 1;
            if self.dans_paquet == self.paquet {
                self.pics.push(Self::en_pic(self.pic));
                self.pic = 0.0;
                self.dans_paquet = 0;
            }
        }
        self.trames += (echantillons.len() / 2) as u64;
    }

    fn en_pic(v: f32) -> u8 {
        ((v as f64) * 100.0).round().clamp(0.0, 100.0) as u8
    }

    pub fn trames(&self) -> u64 {
        self.trames
    }

    pub fn niveau(&self) -> Niveau {
        let lufs = self.r128.loudness_global().ok().filter(|v| v.is_finite());
        let crete = (0..2).filter_map(|c| self.r128.true_peak(c).ok()).fold(0.0_f64, f64::max);
        let crete = (crete > 0.0).then(|| 20.0 * crete.log10()).filter(|v| v.is_finite());
        Niveau { lufs: lufs.map(arrondi_dixieme), crete: crete.map(arrondi_dixieme) }
    }

    pub fn finir(mut self) -> (Onde, Niveau) {
        if self.dans_paquet > 0 {
            self.pics.push(Self::en_pic(self.pic));
        }
        let niveau = self.niveau();
        (Onde { par_seconde: PICS_PAR_SECONDE, pics: self.pics }, niveau)
    }
}

fn arrondi_dixieme(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}

/// Le niveau d'un son déjà en mémoire (stéréo, 48 kHz).
pub fn mesurer(echantillons: &[f32]) -> Niveau {
    let mut m = Mesureur::new();
    m.ajouter(echantillons);
    m.niveau()
}

/// Décode `chemin` (son ou vidéo) en stéréo 48 kHz et le passe au mesureur, sans jamais tout
/// garder en mémoire. `avancement` reçoit la part faite d'après `duree` (ms).
fn analyser(chemin: &Path, duree: u64, avancement: &mut dyn FnMut(f32)) -> Result<(Onde, Niveau), ErreurSon> {
    let mut processus = videos::programme("ffmpeg")
        .args(["-hide_banner", "-loglevel", "error", "-nostdin", "-i"])
        .arg(chemin)
        .args(["-map", "0:a:0", "-vn", "-sn", "-ac", "2", "-ar", "48000", "-f", "f32le", "pipe:1"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| if e.kind() == io::ErrorKind::NotFound { ErreurSon::FfmpegAbsent } else { ErreurSon::Lecture(e) })?;
    let mut erreur = processus.stderr.take().expect("stderr redirigé");
    let lecteur_erreur = std::thread::spawn(move || {
        let mut texte = String::new();
        let _ = erreur.read_to_string(&mut texte);
        texte
    });
    let mut sortie = processus.stdout.take().expect("sortie redirigée");
    let mut mesureur = Mesureur::new();
    let mut tampon = vec![0u8; 1 << 16];
    let mut reste: Vec<u8> = Vec::new();
    let attendues = (duree as f64 * FREQUENCE as f64 / 1000.0).max(1.0);
    let mut echantillons: Vec<f32> = Vec::with_capacity(tampon.len() / 4);
    loop {
        let lus = sortie.read(&mut tampon)?;
        if lus == 0 {
            break;
        }
        reste.extend_from_slice(&tampon[..lus]);
        let utiles = reste.len() / 8 * 8;
        echantillons.clear();
        echantillons.extend(reste[..utiles].chunks_exact(4).map(|o| f32::from_le_bytes([o[0], o[1], o[2], o[3]])));
        reste.drain(..utiles);
        mesureur.ajouter(&echantillons);
        avancement((mesureur.trames() as f64 / attendues).clamp(0.0, 1.0) as f32);
    }
    let statut = processus.wait()?;
    let texte = lecteur_erreur.join().unwrap_or_default();
    if !statut.success() {
        return Err(ErreurSon::Ffmpeg(texte.lines().last().unwrap_or("échec sans message").to_string()));
    }
    if mesureur.trames() == 0 {
        return Err(ErreurSon::PasDeSon);
    }
    Ok(mesureur.finir())
}

/// Décode tout le son de `chemin` (son ou vidéo) en stéréo à 48 kHz, en mémoire : pour les
/// traitements de la voix (lot 6), qui ont besoin de tout le son à la fois.
pub(crate) fn decoder_stereo(chemin: &Path) -> Result<Vec<f32>, ErreurSon> {
    let sortie = videos::programme("ffmpeg")
        .args(["-hide_banner", "-loglevel", "error", "-nostdin", "-i"])
        .arg(chemin)
        .args(["-map", "0:a:0", "-vn", "-sn", "-ac", "2", "-ar", "48000", "-f", "f32le", "pipe:1"])
        .output()
        .map_err(|e| if e.kind() == io::ErrorKind::NotFound { ErreurSon::FfmpegAbsent } else { ErreurSon::Lecture(e) })?;
    if !sortie.status.success() {
        return Err(ErreurSon::Ffmpeg(String::from_utf8_lossy(&sortie.stderr).lines().last().unwrap_or("échec sans message").to_string()));
    }
    let echantillons: Vec<f32> = sortie.stdout.chunks_exact(4).map(|o| f32::from_le_bytes([o[0], o[1], o[2], o[3]])).collect();
    if echantillons.len() < 2 {
        return Err(ErreurSon::PasDeSon);
    }
    Ok(echantillons)
}

// ----------------------------------------------------------------------------------------
// Import
// ----------------------------------------------------------------------------------------

const SOUS_DOSSIERS: [&str; 4] = ["originaux", "copies", "ondes", "infos"];

/// L'extension de l'original, nettoyée (elle sert à construire un chemin).
fn extension_sure(chemin: &Path) -> String {
    let e = videos::extension_sure(chemin);
    if e == "video" { "son".into() } else { e }
}

/// Importe un son du disque. `avancement` reçoit de 0 à 1 pendant le travail. Un son déjà
/// importé n'est pas refait.
pub fn importer(chemin: &Path, dossier: &Path, avancement: &mut dyn FnMut(f32)) -> Result<Ressource, ErreurSon> {
    let nom = chemin.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "son".into());
    let id = videos::empreinte_fichier(chemin)?;
    let infos = dossier.join("infos").join(format!("{id}.json"));
    if let Ok(texte) = fs::read(&infos)
        && let Ok(mut deja) = serde_json::from_slice::<Ressource>(&texte)
        && deja.son.is_some()
    {
        deja.nom = nom;
        avancement(1.0);
        return Ok(deja);
    }
    let duree = sonder(chemin)?;
    for sous_dossier in SOUS_DOSSIERS {
        fs::create_dir_all(dossier.join(sous_dossier))?;
    }
    avancement(0.0);
    let original = dossier.join("originaux").join(format!("{id}.{}", extension_sure(chemin)));
    if !original.exists() {
        copier_atomiquement(chemin, &original)?;
    }
    avancement(0.05);

    let copie = dossier.join("copies").join(format!("{id}.webm"));
    let mut arguments = vec!["-i".to_string(), videos::chemin_texte(&original)];
    arguments.extend(ARGUMENTS_COPIE.map(String::from));
    arguments.push("webm".into());
    videos::encoder_vers(&arguments, &copie, "webm", duree, &mut |a| avancement(0.05 + 0.55 * a))?;

    let (onde, niveau) = analyser(&original, duree, &mut |a| avancement(0.6 + 0.38 * a))?;
    ecrire_atomiquement(&dossier.join("ondes").join(format!("{id}.json")), &serde_json::to_vec(&onde).expect("onde sérialisable"))?;

    let ressource = Ressource {
        id: id.clone(),
        nom,
        largeur: 0,
        hauteur: 0,
        transparence: false,
        format_apercu: String::new(),
        credit: None,
        video: None,
        modele3d: None,
        environnement3d: None,
        son: Some(InfosSon { duree, copie: "webm".into(), lufs: niveau.lufs, crete: niveau.crete, origine: None, marque: None }),
    };
    ecrire_atomiquement(&infos, &serde_json::to_vec_pretty(&ressource).expect("ressource sérialisable"))?;
    avancement(1.0);
    Ok(ressource)
}

/// Importe un son venu d'une banque (Freesound) sous le nom `nom`, et garde son crédit avec lui.
pub fn importer_avec_credit(chemin: &Path, nom: &str, dossier: &Path, credit: Credit, avancement: &mut dyn FnMut(f32)) -> Result<Ressource, ErreurSon> {
    let mut ressource = importer(chemin, dossier, avancement)?;
    ressource.nom = nom.to_string();
    ressource.credit = Some(credit);
    let infos = dossier.join("infos").join(format!("{}.json", ressource.id));
    ecrire_atomiquement(&infos, &serde_json::to_vec_pretty(&ressource).expect("ressource sérialisable"))?;
    Ok(ressource)
}

/// Importe un son fait par Eliot (une prise au micro, une voix de synthèse) sous le nom `nom`,
/// avec son origine (`micro`, `synthese`), l'instant du top d'une prise et, s'il en a un, son
/// crédit.
pub fn importer_fait(chemin: &Path, nom: &str, origine: &str, marque: Option<u64>, credit: Option<Credit>, dossier: &Path, avancement: &mut dyn FnMut(f32)) -> Result<Ressource, ErreurSon> {
    let mut ressource = importer(chemin, dossier, avancement)?;
    ressource.nom = nom.to_string();
    ressource.credit = credit;
    if let Some(son) = ressource.son.as_mut() {
        son.origine = Some(origine.to_string());
        son.marque = marque;
    }
    let infos = dossier.join("infos").join(format!("{}.json", ressource.id));
    ecrire_atomiquement(&infos, &serde_json::to_vec_pretty(&ressource).expect("ressource sérialisable"))?;
    Ok(ressource)
}

/// Les fichiers propres à un son, en plus de l'original et des infos (copie, onde).
pub fn fichiers_en_plus(dossier: &Path, ressource: &Ressource) -> Vec<PathBuf> {
    let Some(son) = &ressource.son else { return Vec::new() };
    let id = &ressource.id;
    vec![dossier.join("copies").join(format!("{id}.{}", son.copie)), dossier.join("ondes").join(format!("{id}.json"))]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::images;
    use serde_json::json;
    use std::process::Command;

    fn ffmpeg_present() -> bool {
        Command::new("ffmpeg").arg("-version").stdout(Stdio::null()).stderr(Stdio::null()).status().is_ok_and(|s| s.success())
    }

    fn dossier_de_test(nom: &str) -> PathBuf {
        let dossier = std::env::temp_dir().join(format!("eliot-sons-{nom}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dossier);
        fs::create_dir_all(&dossier).unwrap();
        dossier
    }

    /// Un son synthétique fait par ffmpeg, d'après une source `lavfi`.
    fn son_de_test(dossier: &Path, nom: &str, source: &str, secondes: f64) -> PathBuf {
        let chemin = dossier.join(nom);
        let s = Command::new("ffmpeg")
            .args(["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", source, "-t", &format!("{secondes}")])
            .arg(&chemin)
            .status()
            .unwrap();
        assert!(s.success());
        chemin
    }

    #[test]
    fn le_sondage_lit_la_duree_et_refuse_un_fichier_sans_son() {
        let j = json!({ "streams": [{ "codec_type": "video" }, { "codec_type": "audio" }], "format": { "duration": "61.2345" } });
        assert_eq!(lire_sondage(&j).unwrap(), 61235);
        let muet = json!({ "streams": [{ "codec_type": "video" }], "format": { "duration": "3" } });
        assert!(matches!(lire_sondage(&muet), Err(ErreurSon::PasDeSon)));
        assert!(est_un_son(Path::new("a/Musique.MP3")) && est_un_son(Path::new("b.flac")) && !est_un_son(Path::new("c.mp4")));
    }

    #[test]
    fn le_niveau_d_une_sinusoide_connue() {
        // Une sinusoïde de 1 kHz à pleine échelle sur les deux canaux vaut 0 LUFS (EBU Tech
        // 3341 : « -23 dBFS » sur les deux canaux donnent -23 LUFS) ; d'amplitude 0,5, -6 LUFS
        // et -6 dBTP de crête vraie.
        let sinus = |amplitude: f32| -> Vec<f32> {
            (0..FREQUENCE as usize * 5)
                .flat_map(|i| {
                    let v = amplitude * (2.0 * std::f32::consts::PI * 1000.0 * i as f32 / FREQUENCE as f32).sin();
                    [v, v]
                })
                .collect()
        };
        let fort = mesurer(&sinus(0.5));
        let faible = mesurer(&sinus(0.25));
        let (a, b) = (fort.lufs.unwrap(), faible.lufs.unwrap());
        assert!((a - b - 6.0).abs() < 0.2, "{a} et {b}");
        assert!((a + 6.0).abs() < 0.2, "{a}");
        assert!((fort.crete.unwrap() + 6.0).abs() < 0.3, "{:?}", fort.crete);
        // Le silence n'a pas de niveau.
        assert_eq!(mesurer(&vec![0.0; 96_000]), Niveau { lufs: None, crete: None });
    }

    #[test]
    fn un_son_s_importe_avec_sa_copie_son_onde_et_son_niveau() {
        if !ffmpeg_present() {
            eprintln!("ffmpeg absent : essai sauté");
            return;
        }
        let dossier = dossier_de_test("import");
        let source = son_de_test(&dossier, "la.wav", "sine=frequency=440:sample_rate=44100", 3.0);
        let ressources = dossier.join("ressources");
        let mut etapes = Vec::new();
        let r = importer(&source, &ressources, &mut |a| etapes.push(a)).unwrap();
        let s = r.son.clone().unwrap();
        assert!((2950..=3100).contains(&s.duree), "{}", s.duree);
        assert_eq!(s.copie, "webm");
        assert!(r.video.is_none());
        assert_eq!(etapes.last(), Some(&1.0));
        assert!(etapes.windows(2).all(|p| p[0] <= p[1]), "l'avancement ne recule pas : {etapes:?}");
        // La sinusoïde de ffmpeg a une amplitude de 1/8 (-18 dBFS). Mono, elle passe sur les
        // deux canaux à -3 dB chacun (règle de ffmpeg, la même à l'écoute et à l'export) :
        // -21 dBTP de crête et environ -21,8 LUFS.
        let lufs = s.lufs.unwrap();
        assert!((-22.5..=-21.2).contains(&lufs), "{lufs}");
        assert!((s.crete.unwrap() + 21.1).abs() < 0.3, "{:?}", s.crete);
        // La copie : Opus, stéréo, 48 kHz.
        let copie = images::chemin_ressource(&ressources, &r.id, images::Genre::Copie).unwrap();
        let sortie = Command::new("ffprobe").args(["-v", "error", "-print_format", "json", "-show_streams"]).arg(&copie).output().unwrap();
        let j: Value = serde_json::from_slice(&sortie.stdout).unwrap();
        assert_eq!(j.pointer("/streams/0/codec_name").and_then(Value::as_str), Some("opus"));
        assert_eq!(j.pointer("/streams/0/channels").and_then(Value::as_u64), Some(2));
        // L'onde : 50 pics par seconde, 9 partout (1/8 du maximum, à -3 dB).
        let onde: Onde = serde_json::from_slice(&fs::read(images::chemin_ressource(&ressources, &r.id, images::Genre::Onde).unwrap()).unwrap()).unwrap();
        assert!((148..=156).contains(&onde.pics.len()), "{}", onde.pics.len());
        assert!(onde.pics[5..140].iter().all(|p| *p == 9), "{:?}", &onde.pics[..20]);
        // Pas d'aperçu : la frise montre l'onde.
        assert!(!ressources.join("apercus").exists());
        // Réimporter ne refait rien.
        let mut appels = 0;
        let encore = importer(&source, &ressources, &mut |_| appels += 1).unwrap();
        assert_eq!((encore.id.as_str(), appels), (r.id.as_str(), 1));
        // Il se liste avec les images, et se copie dans un autre design avec tous ses fichiers.
        assert!(images::lister(&ressources)[0].son.is_some());
        let autre = dossier.join("autre");
        images::copier(&ressources, &autre, std::slice::from_ref(&r.id)).unwrap();
        for genre in [images::Genre::Copie, images::Genre::Onde, images::Genre::Original] {
            assert!(images::chemin_ressource(&autre, &r.id, genre).unwrap().exists(), "{genre:?}");
        }
        assert!(images::chemin_ressource(&autre, &r.id, images::Genre::Vignettes).is_err());
        // Un crédit de banque se garde.
        let credit = Credit { source: "Freesound".into(), auteur: "Anne".into(), lien: "https://freesound.org/people/Anne/sounds/1/".into(), licence: Some("CC BY 4.0".into()), titre: Some("Pluie".into()), lien_auteur: None };
        let r2 = importer_avec_credit(&source, "freesound-1-pluie.ogg", &ressources, credit.clone(), &mut |_| ()).unwrap();
        assert_eq!(r2.credit, Some(credit.clone()));
        assert_eq!(images::infos(&ressources, &r.id).unwrap().credit, Some(credit));
        fs::remove_dir_all(&dossier).unwrap();
    }

    #[test]
    fn un_son_muet_s_importe_sans_niveau_et_un_faux_est_refuse() {
        if !ffmpeg_present() {
            return;
        }
        let dossier = dossier_de_test("muet");
        let source = son_de_test(&dossier, "silence.wav", "anullsrc=r=48000:cl=stereo", 1.0);
        let r = importer(&source, &dossier.join("r"), &mut |_| ()).unwrap();
        let s = r.son.unwrap();
        assert_eq!((s.lufs, s.crete), (None, None));
        let faux = dossier.join("faux.mp3");
        fs::write(&faux, b"pas un son").unwrap();
        assert!(importer(&faux, &dossier.join("r"), &mut |_| ()).is_err());
        fs::remove_dir_all(&dossier).unwrap();
    }
}
