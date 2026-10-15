//! La parole d'un son ou d'une vidéo du design (étape 4, lot 7) : où l'on parle, et ce qui est
//! dit, mot par mot. Deux étages :
//!
//! - l'analyse du niveau, sans rien à installer : le son est décodé en mono à 16 kHz et son
//!   niveau mesuré toutes les 10 ms ; au-dessus d'un seuil tiré du bruit de fond, on parle.
//!   La coupe des blancs s'en sert, au plus près de la voix ;
//! - la transcription, par Whisper sur le processeur (règle 9) : le programme
//!   `whisper-ctranslate2` (faster-whisper et CTranslate2, licence MIT), installé par Alexandre
//!   comme Piper, lancé avec `--device cpu` et sans carte graphique visible
//!   (`CUDA_VISIBLE_DEVICES` vide) ; le modèle (`faster-whisper-small`, licence MIT) est
//!   téléchargé une fois dans `telechargements/whisper/`. Chaque mot vient avec son début et sa
//!   fin ; Whisper les place à 0,1 ou 0,3 s près, l'analyse du niveau les recale sur les bords
//!   de la voix.
//!
//! Le résultat est gardé dans `transcriptions/<empreinte>.json`, à côté des ressources du
//! design : quelques kilo-octets, qui voyagent dans l'archive `.eliot`.

use std::fs;
use std::io::{self, BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

use crate::fichiers::ecrire_atomiquement;
use crate::images::{self, Genre};
use crate::micro;
use crate::sons::ErreurSon;
use crate::videos;

/// Changé si l'analyse ou le calage changent : les anciens résultats sont refaits.
pub const VERSION: u32 = 1;
/// Le dossier des analyses, dans le dossier des ressources du design.
pub const DOSSIER: &str = "transcriptions";
/// Le programme de Whisper.
pub const PROGRAMME: &str = "whisper-ctranslate2";
const FREQUENCE: usize = 16_000;
/// Une mesure du niveau toutes les 10 ms.
const TRAME: usize = FREQUENCE / 100;
const TRAME_MS: u64 = 10;
/// Un trou plus court que 150 ms reste dans la parole (une occlusive, une respiration brève).
const TROU_MAX: usize = 15;
/// Un passage plus court que 60 ms n'est pas de la parole (un clic).
const BREF_MIN: usize = 6;
/// La parole déborde de 30 ms de chaque côté du seuil (attaques et fins douces).
const DEBORD: usize = 3;
/// Un mot que Whisper place à moins de 400 ms du bord de sa voix y est recalé.
const CALAGE: u64 = 400;
/// Un mot loin de toute voix (plus de 200 ms) est une invention de Whisper dans le silence.
const LOIN_DE_LA_VOIX: u64 = 200;
/// Un mot dure au moins 40 ms.
const MOT_MIN: u64 = 40;

#[derive(Debug, Error)]
pub enum ErreurParole {
    #[error("Whisper n'est pas installé : commande 18 du CLAUDE.md (uv tool install whisper-ctranslate2)")]
    Absent,
    #[error("aucun modèle de Whisper trouvé : télécharge-le (commande 19 du CLAUDE.md)")]
    SansModele,
    #[error("ce fichier n'a pas de son")]
    PasDeSon,
    #[error("transcription annulée")]
    Annulee,
    #[error("Whisper a échoué : {0}")]
    Echec(String),
    #[error("ressource illisible : {0}")]
    Ressource(String),
    #[error(transparent)]
    Son(#[from] ErreurSon),
    #[error("lecture impossible : {0}")]
    Lecture(#[from] io::Error),
}

/// Un mot dit, en millisecondes du fichier.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Mot {
    /// Le mot tel que Whisper l'écrit, ponctuation comprise (« aujourd'hui, »).
    pub texte: String,
    pub debut: u64,
    pub fin: u64,
    /// La confiance de Whisper, de 0 à 1.
    pub proba: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Transcription {
    /// Le dossier du modèle (`faster-whisper-small`).
    pub modele: String,
    /// La langue demandée ou reconnue (`fr`).
    pub langue: String,
    pub mots: Vec<Mot>,
}

/// Ce que le noyau sait de la parole d'un fichier.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Analyse {
    pub version: u32,
    /// Durée du son, en ms.
    pub duree: u64,
    /// Les passages où l'on parle, `[début, fin]` en ms du fichier, dans l'ordre.
    pub parole: Vec<[u64; 2]>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transcription: Option<Transcription>,
}

// ----------------------------------------------------------------------------------------
// L'analyse du niveau
// ----------------------------------------------------------------------------------------

/// Le son d'un fichier en mono, à 16 kHz (la fréquence de Whisper).
fn decoder_mono(chemin: &Path) -> Result<Vec<f32>, ErreurSon> {
    let sortie = videos::programme("ffmpeg")
        .args(["-hide_banner", "-loglevel", "error", "-nostdin", "-i"])
        .arg(chemin)
        .args(["-map", "0:a:0", "-vn", "-sn", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"])
        .output()
        .map_err(|e| if e.kind() == io::ErrorKind::NotFound { ErreurSon::FfmpegAbsent } else { ErreurSon::Lecture(e) })?;
    if !sortie.status.success() {
        return Err(ErreurSon::Ffmpeg(String::from_utf8_lossy(&sortie.stderr).lines().last().unwrap_or("échec sans message").to_string()));
    }
    let mono: Vec<f32> = sortie.stdout.chunks_exact(4).map(|o| f32::from_le_bytes([o[0], o[1], o[2], o[3]])).collect();
    if mono.is_empty() {
        return Err(ErreurSon::PasDeSon);
    }
    Ok(mono)
}

/// Le niveau (dBFS, valeur efficace) de chaque tranche de 10 ms.
pub fn niveaux(mono: &[f32]) -> Vec<f32> {
    mono.chunks(TRAME)
        .map(|t| {
            let energie = t.iter().map(|v| (*v as f64) * (*v as f64)).sum::<f64>() / t.len() as f64;
            (10.0 * (energie + 1e-12).log10()) as f32
        })
        .collect()
}

/// Les passages où l'on parle, d'après les niveaux par tranche de 10 ms. Le seuil se tire du
/// bruit de fond (le dixième le plus calme) et de la voix (le vingtième le plus fort) : 10 dB
/// au-dessus du bruit, sans descendre à plus de 40 dB sous la voix. Un son sans écart net entre
/// les deux (une musique continue) est tout entier de la parole : rien n'y sera coupé.
pub fn passages(niveaux: &[f32]) -> Vec<[u64; 2]> {
    if niveaux.is_empty() {
        return Vec::new();
    }
    let mut tries: Vec<f32> = niveaux.iter().map(|n| n.max(-100.0)).collect();
    tries.sort_by(|a, b| a.total_cmp(b));
    let rang = |p: f64| tries[((tries.len() - 1) as f64 * p).round() as usize];
    let (bruit, haut) = (rang(0.10), rang(0.95));
    let n = niveaux.len();
    if haut < -60.0 {
        return Vec::new();
    }
    if haut - bruit < 12.0 {
        return vec![[0, n as u64 * TRAME_MS]];
    }
    let seuil = (bruit + 10.0).max(haut - 40.0).min(haut - 12.0);
    let mut brutes: Vec<[usize; 2]> = Vec::new();
    let mut debut = None;
    for (i, v) in niveaux.iter().enumerate() {
        if *v > seuil {
            debut.get_or_insert(i);
        } else if let Some(d) = debut.take() {
            brutes.push([d, i]);
        }
    }
    if let Some(d) = debut {
        brutes.push([d, n]);
    }
    let mut reunies: Vec<[usize; 2]> = Vec::new();
    for r in brutes {
        match reunies.last_mut() {
            Some(p) if r[0] - p[1] < TROU_MAX => p[1] = r[1],
            _ => reunies.push(r),
        }
    }
    reunies.retain(|r| r[1] - r[0] >= BREF_MIN);
    let mut sortie: Vec<[u64; 2]> = Vec::new();
    for r in reunies {
        let a = r[0].saturating_sub(DEBORD) as u64 * TRAME_MS;
        let b = (r[1] + DEBORD).min(n) as u64 * TRAME_MS;
        match sortie.last_mut() {
            Some(p) if a <= p[1] => p[1] = b,
            _ => sortie.push([a, b]),
        }
    }
    sortie
}

fn chemin_analyse(dossier: &Path, id: &str) -> Result<PathBuf, ErreurParole> {
    if !images::identifiant_valide(id) {
        return Err(ErreurParole::Ressource("identifiant invalide".into()));
    }
    Ok(dossier.join(DOSSIER).join(format!("{id}.json")))
}

/// L'analyse gardée d'un fichier, si elle est de la version courante.
pub fn lire(dossier: &Path, id: &str) -> Result<Option<Analyse>, ErreurParole> {
    let chemin = chemin_analyse(dossier, id)?;
    Ok(fs::read(chemin).ok().and_then(|o| serde_json::from_slice::<Analyse>(&o).ok()).filter(|a| a.version == VERSION))
}

fn garder(dossier: &Path, id: &str, analyse: &Analyse) -> Result<(), ErreurParole> {
    let chemin = chemin_analyse(dossier, id)?;
    fs::create_dir_all(dossier.join(DOSSIER))?;
    ecrire_atomiquement(&chemin, &serde_json::to_vec(analyse).expect("analyse sérialisable"))?;
    Ok(())
}

/// Le fichier d'origine d'une ressource qui a du son (un son, ou une vidéo avec du son).
fn original(dossier: &Path, id: &str) -> Result<PathBuf, ErreurParole> {
    let infos = images::infos(dossier, id).map_err(|e| ErreurParole::Ressource(e.to_string()))?;
    if infos.son.is_none() && !infos.video.as_ref().is_some_and(|v| v.son) {
        return Err(ErreurParole::PasDeSon);
    }
    images::chemin_ressource(dossier, id, Genre::Original).map_err(|e| ErreurParole::Ressource(e.to_string()))
}

/// L'analyse d'un fichier, faite au besoin (relue sinon), avec le son décodé quand il a fallu
/// le décoder.
fn analyse_et_son(dossier: &Path, id: &str) -> Result<(Analyse, Option<Vec<f32>>), ErreurParole> {
    if let Some(a) = lire(dossier, id)? {
        return Ok((a, None));
    }
    let mono = decoder_mono(&original(dossier, id)?)?;
    let analyse = Analyse { version: VERSION, duree: (mono.len() as u64 * 1000).div_ceil(FREQUENCE as u64), parole: passages(&niveaux(&mono)), transcription: None };
    garder(dossier, id, &analyse)?;
    Ok((analyse, Some(mono)))
}

/// Où l'on parle dans un son du design (analyse du niveau, faite une fois puis relue).
pub fn analyser(dossier: &Path, id: &str) -> Result<Analyse, ErreurParole> {
    analyse_et_son(dossier, id).map(|(a, _)| a)
}

// ----------------------------------------------------------------------------------------
// Whisper
// ----------------------------------------------------------------------------------------

/// Le programme `whisper-ctranslate2` : `ELIOT_WHISPER` s'il est donné, sinon dans le `PATH`,
/// sinon dans `~/.local/bin` (où `uv tool install` le range).
pub fn trouver_whisper() -> Option<PathBuf> {
    if let Some(p) = std::env::var_os("ELIOT_WHISPER").map(PathBuf::from) {
        return p.is_file().then_some(p);
    }
    let mut dossiers: Vec<PathBuf> = std::env::var_os("PATH").map(|p| std::env::split_paths(&p).collect()).unwrap_or_default();
    if let Some(maison) = std::env::var_os("HOME") {
        dossiers.push(PathBuf::from(maison).join(".local").join("bin"));
    }
    dossiers.into_iter().map(|d| d.join(PROGRAMME)).find(|p| p.is_file())
}

/// Les dossiers où chercher les modèles : `telechargements/whisper/` du dépôt (en remontant
/// depuis un dossier de départ, en développement), puis `whisper/` dans les données d'Eliot.
pub fn dossiers_de_modeles(depart: &Path, donnees: Option<&Path>) -> Vec<PathBuf> {
    let mut d: Vec<PathBuf> = depart.ancestors().take(6).map(|a| a.join("telechargements").join("whisper")).filter(|p| p.is_dir()).collect();
    if let Some(x) = donnees {
        d.push(x.join("whisper"));
    }
    d
}

/// Un dossier de modèle CTranslate2 complet : poids, configuration et vocabulaire.
fn est_un_modele(d: &Path) -> bool {
    d.join("model.bin").is_file() && d.join("config.json").is_file() && (d.join("tokenizer.json").is_file() || d.join("vocabulary.txt").is_file() || d.join("vocabulary.json").is_file())
}

/// L'ordre de préférence des modèles : le plus juste d'abord (Alexandre ne télécharge un gros
/// modèle que pour s'en servir).
const PREFERENCES: [&str; 5] = ["large-v3-turbo", "large-v3", "medium", "small", "base"];

/// Le modèle à utiliser parmi ceux des dossiers (le dossier lui-même, ou ses sous-dossiers).
pub fn trouver_modele(dossiers: &[PathBuf]) -> Option<PathBuf> {
    let mut trouves: Vec<PathBuf> = Vec::new();
    for d in dossiers {
        if est_un_modele(d) {
            trouves.push(d.clone());
        }
        if let Ok(entrees) = fs::read_dir(d) {
            let mut sous: Vec<PathBuf> = entrees.flatten().map(|e| e.path()).filter(|p| p.is_dir() && est_un_modele(p)).collect();
            sous.sort();
            trouves.extend(sous);
        }
    }
    let rang = |p: &PathBuf| {
        let nom = p.file_name().map(|n| n.to_string_lossy().to_lowercase()).unwrap_or_default();
        PREFERENCES.iter().position(|x| nom.ends_with(x)).unwrap_or(PREFERENCES.len())
    };
    trouves.into_iter().enumerate().min_by_key(|(i, p)| (rang(p), *i)).map(|(_, p)| p)
}

/// Le début de texte soufflé à Whisper : sans lui, il efface les hésitations (« euh »), que la
/// coupe doit justement trouver.
fn consigne(langue: &str) -> Option<&'static str> {
    match langue {
        "fr" => Some("Euh, bon, alors, euh, hum, je pense que, ben, voilà."),
        "en" => Some("Um, uh, so, like, hmm, I mean, you know."),
        _ => None,
    }
}

/// L'instant de fin d'une ligne de Whisper (`[00:02.780 --> 00:06.420]  Euh, aujourd'hui`), en
/// secondes.
pub fn fin_de_ligne(ligne: &str) -> Option<f64> {
    let l = ligne.trim_start();
    if !l.starts_with('[') {
        return None;
    }
    let fin = l.split("-->").nth(1)?.split(']').next()?.trim();
    let mut secondes = 0.0;
    for (i, morceau) in fin.split(':').rev().enumerate() {
        let v: f64 = morceau.trim().parse().ok()?;
        secondes += v * 60f64.powi(i as i32);
    }
    Some(secondes)
}

/// Les mots de la sortie JSON de Whisper, en ms. Un morceau qui ne commence pas par une espace
/// continue le mot d'avant (« aujourd » et « 'hui, » font « aujourd'hui, »).
pub fn lire_sortie(json: &Value) -> (Option<String>, Vec<Mot>) {
    let langue = json["language"].as_str().map(str::to_string);
    let ms = |v: &Value| (v.as_f64().unwrap_or(0.0).max(0.0) * 1000.0).round() as u64;
    let mut mots: Vec<Mot> = Vec::new();
    for segment in json["segments"].as_array().into_iter().flatten() {
        let mut premier = true;
        for w in segment["words"].as_array().into_iter().flatten() {
            let brut = w["word"].as_str().unwrap_or("");
            let texte = brut.trim();
            if texte.is_empty() {
                continue;
            }
            let (debut, fin) = (ms(&w["start"]), ms(&w["end"]));
            let proba = (w["probability"].as_f64().unwrap_or(0.0) * 100.0).round() / 100.0;
            let collee = !premier && !brut.starts_with(char::is_whitespace);
            premier = false;
            if collee && let Some(m) = mots.last_mut() {
                m.texte.push_str(texte);
                m.fin = m.fin.max(fin);
                m.proba = m.proba.min(proba);
                continue;
            }
            mots.push(Mot { texte: texte.to_string(), debut, fin: fin.max(debut), proba });
        }
    }
    (langue, mots)
}

/// Recale les mots de Whisper sur les passages de parole : un mot qui commence (ou finit) dans
/// un silence est ramené au bord de la voix ; le premier mot d'un passage commence avec lui, le
/// dernier finit avec lui (à moins de 400 ms). Un mot loin de toute voix est retiré : Whisper
/// en invente parfois dans les silences.
pub fn caler(mots: &[Mot], parole: &[[u64; 2]]) -> Vec<Mot> {
    if parole.is_empty() {
        return mots.to_vec();
    }
    let dans = |t: u64| parole.iter().position(|r| t >= r[0] && t <= r[1]);
    let mut sortie: Vec<Mot> = mots.iter().filter(|m| parole.iter().any(|r| m.debut < r[1] + LOIN_DE_LA_VOIX && r[0] < m.fin + LOIN_DE_LA_VOIX)).cloned().collect();
    // Le passage où commence et celui où finit chaque mot, tels que Whisper les donne.
    let debuts: Vec<Option<usize>> = sortie.iter().map(|m| dans(m.debut)).collect();
    let fins: Vec<Option<usize>> = sortie.iter().map(|m| dans(m.fin)).collect();
    let n = sortie.len();
    for i in 0..n {
        let m = &mut sortie[i];
        match debuts[i] {
            // Le début tombe dans un silence : la voix qui suit, si elle commence avant la fin
            // du mot.
            None => {
                if let Some(r) = parole.iter().find(|r| r[0] > m.debut && r[0] < m.fin) {
                    m.debut = r[0];
                }
            }
            Some(p) => {
                let premier = i == 0 || debuts[i - 1] != Some(p);
                if premier && m.debut - parole[p][0] < CALAGE {
                    m.debut = parole[p][0];
                }
            }
        }
        match fins[i] {
            None => {
                if let Some(r) = parole.iter().rev().find(|r| r[1] < m.fin && r[1] > m.debut) {
                    m.fin = r[1];
                }
            }
            Some(p) => {
                let dernier = i + 1 == n || fins[i + 1] != Some(p);
                if dernier && parole[p][1] - m.fin < CALAGE {
                    m.fin = parole[p][1];
                }
            }
        }
    }
    // Dans l'ordre, sans chevauchement, 40 ms au moins.
    let mut avant = 0;
    for m in &mut sortie {
        m.debut = m.debut.max(avant);
        m.fin = m.fin.max(m.debut + MOT_MIN);
        avant = m.fin;
    }
    sortie
}

/// Un dossier de travail neuf, dans le dossier temporaire du système.
fn dossier_de_travail() -> io::Result<PathBuf> {
    let marque = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let d = std::env::temp_dir().join(format!("eliot-parole-{}-{marque}", std::process::id()));
    fs::create_dir_all(&d)?;
    Ok(d)
}

/// Écrit le son en WAV mono 16 bits à 16 kHz, ce que Whisper lit sans rien convertir.
fn ecrire_wav(mono: &[f32], chemin: &Path) -> io::Result<()> {
    let mut f = io::BufWriter::new(fs::File::create(chemin)?);
    f.write_all(&micro::entete_wav_a(mono.len() as u32, 1, FREQUENCE as u32))?;
    for v in mono {
        f.write_all(&(((v.clamp(-1.0, 1.0)) * 32767.0).round() as i16).to_le_bytes())?;
    }
    f.flush()
}

/// Lance Whisper sur `wav` ; `avancement` reçoit l'instant (s) atteint à chaque phrase.
/// Renvoie la sortie JSON.
fn lancer_whisper(programme: &Path, modele: &Path, wav: &Path, travail: &Path, langue: &str, annule: &AtomicBool, avancement: &mut dyn FnMut(f64)) -> Result<Value, ErreurParole> {
    let coeurs = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(2);
    let fils = coeurs.saturating_sub(1).clamp(1, 8);
    let mut c = Command::new(programme);
    c.arg(wav).arg("--model_directory").arg(modele).arg("--output_dir").arg(travail);
    // Sur le processeur seulement (règle 9), entiers 8 bits : rapide et juste.
    c.args(["--device", "cpu", "--compute_type", "int8", "--threads", &fils.to_string()]);
    c.args(["--word_timestamps", "True", "--output_format", "json", "--verbose", "True"]);
    if langue != "auto" {
        c.args(["--language", langue]);
    }
    if let Some(p) = consigne(langue) {
        c.args(["--initial_prompt", p]);
    }
    // Aucune carte graphique visible, rien à chercher sur Internet, lignes écrites au fil de
    // l'eau.
    c.env("CUDA_VISIBLE_DEVICES", "").env("HF_HUB_OFFLINE", "1").env("HF_HUB_DISABLE_TELEMETRY", "1").env("PYTHONUNBUFFERED", "1").env("PYTHONIOENCODING", "utf-8");
    c.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut processus = c.spawn().map_err(|e| if e.kind() == io::ErrorKind::NotFound { ErreurParole::Absent } else { ErreurParole::Lecture(e) })?;
    let sortie = processus.stdout.take().expect("sortie redirigée");
    let mut erreurs = processus.stderr.take().expect("erreurs redirigées");
    let (tx, rx) = mpsc::channel::<f64>();
    let lecteur = std::thread::spawn(move || {
        for ligne in BufReader::new(sortie).lines().map_while(Result::ok) {
            if let Some(s) = fin_de_ligne(&ligne) {
                let _ = tx.send(s);
            }
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
            return Err(ErreurParole::Annulee);
        }
        match rx.recv_timeout(Duration::from_millis(100)) {
            Ok(s) => avancement(s),
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
    let statut = processus.wait()?;
    let _ = lecteur.join();
    let messages = journal.join().unwrap_or_default();
    let json = travail.join(wav.file_stem().map(|s| format!("{}.json", s.to_string_lossy())).unwrap_or_default());
    if !statut.success() || !json.is_file() {
        let ligne = messages.lines().rev().find(|l| !l.trim().is_empty()).unwrap_or("échec sans message");
        return Err(ErreurParole::Echec(ligne.trim().to_string()));
    }
    serde_json::from_slice(&fs::read(&json)?).map_err(|e| ErreurParole::Echec(format!("sortie illisible : {e}")))
}

/// Ce qui est dit dans un son du design, mot par mot : fait par Whisper au besoin (`forcer` le
/// refait), relu sinon. `langue` : `fr`, `en` ou `auto`. `avancement` reçoit de 0 à 1.
#[allow(clippy::too_many_arguments)]
pub fn transcrire(dossier: &Path, id: &str, programme: &Path, modele: &Path, langue: &str, forcer: bool, annule: &AtomicBool, avancement: &mut dyn FnMut(f32)) -> Result<Analyse, ErreurParole> {
    let langue = match langue {
        "fr" | "en" => langue,
        _ => "auto",
    };
    let (mut analyse, mono) = analyse_et_son(dossier, id)?;
    if !forcer && analyse.transcription.as_ref().is_some_and(|t| langue == "auto" || t.langue == langue) {
        avancement(1.0);
        return Ok(analyse);
    }
    avancement(0.02);
    let mono = match mono {
        Some(m) => m,
        None => decoder_mono(&original(dossier, id)?)?,
    };
    if annule.load(Ordering::Relaxed) {
        return Err(ErreurParole::Annulee);
    }
    let travail = dossier_de_travail()?;
    let resultat = (|| -> Result<(), ErreurParole> {
        let wav = travail.join("parole.wav");
        ecrire_wav(&mono, &wav)?;
        let duree = (analyse.duree as f64 / 1000.0).max(0.001);
        avancement(0.05);
        let json = lancer_whisper(programme, modele, &wav, &travail, langue, annule, &mut |s| avancement((0.05 + 0.93 * (s / duree)).clamp(0.05, 0.98) as f32))?;
        let (reconnue, mots) = lire_sortie(&json);
        let langue = if langue == "auto" { reconnue.unwrap_or_else(|| "auto".into()) } else { langue.to_string() };
        let nom = modele.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        analyse.transcription = Some(Transcription { modele: nom, langue, mots: caler(&mots, &analyse.parole) });
        garder(dossier, id, &analyse)?;
        Ok(())
    })();
    let _ = fs::remove_dir_all(&travail);
    resultat?;
    avancement(1.0);
    Ok(analyse)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sons::importer;
    use serde_json::json;

    fn ffmpeg_present() -> bool {
        Command::new("ffmpeg").arg("-version").stdout(Stdio::null()).stderr(Stdio::null()).status().is_ok_and(|s| s.success())
    }

    fn dossier_de_test(nom: &str) -> PathBuf {
        let dossier = std::env::temp_dir().join(format!("eliot-parole-test-{nom}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dossier);
        fs::create_dir_all(&dossier).unwrap();
        dossier
    }

    #[test]
    fn les_passages_suivent_la_voix() {
        // 0,5 s de souffle (-70 dB), 1 s de voix (-20 dB), 0,1 s de trou (gardé), 0,6 s de
        // voix, 0,8 s de souffle, un clic de 30 ms, 0,5 s de souffle, 0,4 s de voix.
        let mut n: Vec<f32> = Vec::new();
        let mut pousser = |ms: usize, db: f32| n.extend(std::iter::repeat_n(db, ms / 10));
        pousser(500, -70.0);
        pousser(1000, -20.0);
        pousser(100, -70.0);
        pousser(600, -22.0);
        pousser(800, -70.0);
        pousser(30, -25.0);
        pousser(500, -70.0);
        pousser(400, -21.0);
        let p = passages(&n);
        assert_eq!(p, vec![[470, 2230], [3500, 3930]]);
        // Tout pareil (une musique continue) : tout est de la parole ; silence : rien.
        assert_eq!(passages(&[-20.0; 300]), vec![[0, 3000]]);
        assert!(passages(&[-95.0; 300]).is_empty());
    }

    #[test]
    fn la_sortie_de_whisper_se_lit_mot_par_mot() {
        let sortie = json!({
            "language": "fr",
            "segments": [
                { "words": [ { "start": 0.0, "end": 0.8, "word": " Bonjour", "probability": 0.87 }, { "start": 1.02, "end": 1.5, "word": " tous.", "probability": 0.98 } ] },
                { "words": [
                    { "start": 2.78, "end": 2.92, "word": " Euh,", "probability": 0.05 },
                    { "start": 3.54, "end": 3.88, "word": " aujourd", "probability": 0.98 },
                    { "start": 3.88, "end": 4.22, "word": "'hui,", "probability": 1.0 }
                ] },
                { "words": [ { "start": 8.8, "end": 9.38, "word": "D", "probability": 0.97 }, { "start": 9.38, "end": 9.68, "word": "'abord,", "probability": 1.0 } ] }
            ]
        });
        let (langue, mots) = lire_sortie(&sortie);
        assert_eq!(langue.as_deref(), Some("fr"));
        let textes: Vec<&str> = mots.iter().map(|m| m.texte.as_str()).collect();
        assert_eq!(textes, ["Bonjour", "tous.", "Euh,", "aujourd'hui,", "D'abord,"]);
        assert_eq!((mots[3].debut, mots[3].fin, mots[3].proba), (3540, 4220, 0.98));
        assert_eq!((mots[4].debut, mots[4].fin), (8800, 9680));
        assert_eq!(fin_de_ligne("[00:02.780 --> 00:06.420]  Euh, aujourd'hui"), Some(6.42));
        assert_eq!(fin_de_ligne("[01:00:02.000 --> 01:00:03.500] fin"), Some(3603.5));
        assert_eq!(fin_de_ligne("Detected language 'French'"), None);
    }

    #[test]
    fn les_mots_se_calent_sur_la_voix() {
        // La phrase d'essai (voix Piper et silences posés à la main) : « Bonjour à tous. »,
        // « euh », « Aujourd'hui… café. », « hum », « D'abord… l'eau. ».
        let parole = [[300, 1670], [2670, 3088], [3488, 6727], [7027, 7584], [9084, 10954]];
        let m = |t: &str, d: u64, f: u64| Mot { texte: t.into(), debut: d, fin: f, proba: 0.9 };
        let mots = [m("Bonjour", 0, 800), m("à", 800, 1020), m("tous.", 1020, 1500), m("Euh,", 2780, 2920), m("aujourd'hui,", 3540, 4220), m("je", 4480, 4640), m("café.", 6140, 6420), m("Merci.", 8100, 8300), m("D'abord,", 8800, 9680), m("l'eau.", 10600, 10800)];
        let c = caler(&mots, &parole);
        let vus: Vec<(&str, u64, u64)> = c.iter().map(|x| (x.texte.as_str(), x.debut, x.fin)).collect();
        assert_eq!(
            vus,
            [
                ("Bonjour", 300, 800),
                ("à", 800, 1020),
                ("tous.", 1020, 1670),
                ("Euh,", 2670, 3088),
                ("aujourd'hui,", 3488, 4220),
                ("je", 4480, 4640),
                ("café.", 6140, 6727),
                // « Merci. » est à plus de 200 ms de toute voix : inventé, retiré.
                ("D'abord,", 9084, 9680),
                ("l'eau.", 10600, 10954),
            ]
        );
    }

    #[test]
    fn les_modeles_se_trouvent_par_preference() {
        let d = dossier_de_test("modeles");
        for nom in ["faster-whisper-small", "faster-whisper-medium", "incomplet"] {
            let m = d.join(nom);
            fs::create_dir_all(&m).unwrap();
            fs::write(m.join("model.bin"), b"x").unwrap();
            if nom != "incomplet" {
                fs::write(m.join("config.json"), b"{}").unwrap();
                fs::write(m.join("vocabulary.txt"), b"a").unwrap();
            }
        }
        assert_eq!(trouver_modele(std::slice::from_ref(&d)), Some(d.join("faster-whisper-medium")));
        fs::remove_dir_all(d.join("faster-whisper-medium")).unwrap();
        assert_eq!(trouver_modele(std::slice::from_ref(&d)), Some(d.join("faster-whisper-small")));
        assert_eq!(trouver_modele(&[d.join("faster-whisper-small")]), Some(d.join("faster-whisper-small")));
        assert_eq!(trouver_modele(&[d.join("incomplet")]), None);
        let _ = fs::remove_dir_all(&d);
    }

    /// Un son fait de bips (la voix) et de silences : l'analyse retrouve les bips à 40 ms près,
    /// se garde dans `transcriptions/`, et se relit.
    #[test]
    fn un_son_s_analyse_et_se_garde() {
        if !ffmpeg_present() {
            eprintln!("ffmpeg absent : essai sauté");
            return;
        }
        let d = dossier_de_test("analyse");
        let source = d.join("bips.wav");
        let filtre = "sine=f=300:d=1:r=48000,volume=0.5[a];anullsrc=r=48000:cl=mono:d=0.8[b];sine=f=400:d=0.6:r=48000,volume=0.5[c];anullsrc=r=48000:cl=mono:d=1.2[e];sine=f=350:d=0.5:r=48000,volume=0.5[f];[a][b][c][e][f]concat=n=5:v=0:a=1";
        let s = Command::new("ffmpeg").args(["-v", "error", "-y", "-filter_complex", filtre, "-ar", "48000", "-ac", "1"]).arg(&source).status().unwrap();
        assert!(s.success());
        let ressources = d.join("ressources");
        let r = importer(&source, &ressources, &mut |_| ()).unwrap();
        let a = analyser(&ressources, &r.id).unwrap();
        assert!((4050..=4150).contains(&a.duree), "durée {}", a.duree);
        assert_eq!(a.parole.len(), 3, "{:?}", a.parole);
        for (p, (debut, fin)) in a.parole.iter().zip([(0, 1000), (1800, 2400), (3600, 4100)]) {
            assert!(p[0].abs_diff(debut) <= 40 && p[1].abs_diff(fin) <= 40, "{p:?} au lieu de {debut}-{fin}");
        }
        assert!(ressources.join(DOSSIER).join(format!("{}.json", r.id)).is_file());
        assert_eq!(lire(&ressources, &r.id).unwrap(), Some(a));
        assert!(analyser(&ressources, "pas-une-empreinte").is_err());
        let _ = fs::remove_dir_all(&d);
    }

    /// Avec le vrai Whisper et un vrai modèle (dans le conteneur de Claude : `ELIOT_WHISPER`,
    /// `ELIOT_WHISPER_MODELES` et `ELIOT_PAROLE_ESSAI`, la phrase d'essai), la phrase se
    /// transcrit mot par mot, calée sur la voix, et se relit du cache.
    #[test]
    fn whisper_transcrit_si_il_est_la() {
        let (Some(programme), Some(modeles), Some(phrase)) = (trouver_whisper(), std::env::var_os("ELIOT_WHISPER_MODELES").map(PathBuf::from), std::env::var_os("ELIOT_PAROLE_ESSAI").map(PathBuf::from)) else {
            eprintln!("Whisper ou la phrase d'essai absents : essai sauté");
            return;
        };
        let modele = trouver_modele(&[modeles]).expect("un modèle");
        let d = dossier_de_test("whisper");
        let ressources = d.join("ressources");
        let r = importer(&phrase, &ressources, &mut |_| ()).unwrap();
        let mut etapes = Vec::new();
        let a = transcrire(&ressources, &r.id, &programme, &modele, "fr", false, &AtomicBool::new(false), &mut |p| etapes.push(p)).unwrap();
        let t = a.transcription.clone().expect("une transcription");
        assert_eq!(t.langue, "fr");
        let textes: Vec<String> = t.mots.iter().map(|m| m.texte.to_lowercase()).collect();
        assert!(textes.iter().any(|m| m.starts_with("bonjour")), "{textes:?}");
        assert!(textes.iter().any(|m| m.starts_with("euh")), "{textes:?}");
        // Les mots commencent avec leur voix (Piper laisse un souffle de 60 à 100 ms avant de
        // parler), à 150 ms au plus des instants où les morceaux ont été posés.
        let bonjour = &t.mots[0];
        assert!(bonjour.debut == a.parole[0][0] && bonjour.debut.abs_diff(300) <= 150, "{bonjour:?} {:?}", a.parole);
        let abord = t.mots.iter().find(|m| m.texte.to_lowercase().starts_with("d'abord")).expect("d'abord");
        assert!(a.parole.iter().any(|r| r[0] == abord.debut) && abord.debut.abs_diff(9084) <= 150, "{abord:?} {:?}", a.parole);
        assert!(etapes.len() >= 3 && *etapes.last().unwrap() == 1.0, "{etapes:?}");
        // Relue : Whisper ne repart pas.
        let encore = transcrire(&ressources, &r.id, Path::new("/nulle/part"), &modele, "fr", false, &AtomicBool::new(false), &mut |_| ()).unwrap();
        assert_eq!(encore, a);
        // Annulée d'avance : rien n'est fait.
        let annulee = transcrire(&ressources, &r.id, &programme, &modele, "en", true, &AtomicBool::new(true), &mut |_| ());
        assert!(matches!(annulee, Err(ErreurParole::Annulee)));
        let _ = fs::remove_dir_all(&d);
    }
}
