//! Le micro (étape 4, lot 6) : la voix enregistrée prise par prise. Le noyau écoute le micro
//! par `ffmpeg`, entrée PulseAudio (que PipeWire fournit aussi sur Ubuntu), en mono à 48 kHz et
//! 16 bits, par blocs de 20 ms ; il calcule le niveau pour la fenêtre et écrit la prise dans un
//! fichier WAV. La fenêtre ne touche jamais au micro.
//!
//! Une prise : le micro écoute dès que la fenêtre de prise s'ouvre (le niveau s'affiche) ;
//! `commencer` ouvre le fichier au clic sur « Enregistrer » ; `marquer` note l'instant où le
//! compte à rebours finit et où la tête de lecture part (le clip commencera là, le compte à
//! rebours reste dans le fichier) ; `arreter` ferme le fichier.

use std::fs::{self, File};
use std::io::{self, BufWriter, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;

use serde::Serialize;
use thiserror::Error;

pub const FREQUENCE: u32 = 48_000;
/// Un niveau envoyé à la fenêtre tous les 2 400 échantillons (50 ms).
const BLOC_NIVEAU: usize = 2_400;
/// Taille des blocs demandés à PulseAudio, en octets : 960 échantillons, 20 ms.
const FRAGMENT: &str = "1920";

#[derive(Debug, Error)]
pub enum ErreurMicro {
    #[error("ffmpeg introuvable : installe-le (commande 2 du CLAUDE.md : sudo apt install ffmpeg)")]
    FfmpegAbsent,
    #[error("aucun micro trouvé : PulseAudio ou PipeWire ne répond pas, ou aucun micro n'est branché")]
    AucunMicro,
    #[error("le micro ne s'ouvre pas : {0}")]
    Ouverture(String),
    #[error("aucune prise en cours")]
    PasDePrise,
    #[error("une prise est déjà en cours")]
    PriseEnCours,
    #[error("écriture de la prise impossible : {0}")]
    Ecriture(#[from] io::Error),
}

/// Un micro du poste, tel que PulseAudio le présente.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Micro {
    /// Le nom à donner à `ffmpeg` (`default` : le micro choisi dans les réglages du système).
    pub nom: String,
    pub description: String,
    pub defaut: bool,
}

/// Lit la liste de `ffmpeg -sources pulse` : une ligne par source, `*` devant celle par défaut,
/// `nom [description] (…)`. Les « moniteurs » (ce que jouent les haut-parleurs) sont écartés.
pub fn lire_sources(texte: &str) -> Vec<Micro> {
    let mut micros = Vec::new();
    for ligne in texte.lines() {
        let l = ligne.trim_end();
        if !l.starts_with("  ") && !l.starts_with("* ") {
            continue;
        }
        let defaut = l.trim_start().starts_with('*');
        let reste = l.trim_start().trim_start_matches('*').trim_start();
        let (nom, description) = match (reste.find(" ["), reste.rfind(']')) {
            (Some(a), Some(b)) if b > a => (reste[..a].trim(), reste[a + 2..b].trim()),
            _ => (reste.split_whitespace().next().unwrap_or(""), ""),
        };
        if nom.is_empty() || nom.ends_with(".monitor") {
            continue;
        }
        micros.push(Micro { nom: nom.to_string(), description: if description.is_empty() { nom.to_string() } else { description.to_string() }, defaut });
    }
    micros
}

/// Les micros du poste, le micro par défaut d'abord.
pub fn lister() -> Result<Vec<Micro>, ErreurMicro> {
    let sortie = Command::new("ffmpeg")
        .args(["-hide_banner", "-sources", "pulse"])
        .stdin(Stdio::null())
        .output()
        .map_err(|e| if e.kind() == io::ErrorKind::NotFound { ErreurMicro::FfmpegAbsent } else { ErreurMicro::Ouverture(e.to_string()) })?;
    let texte = format!("{}{}", String::from_utf8_lossy(&sortie.stdout), String::from_utf8_lossy(&sortie.stderr));
    let mut micros = lire_sources(&texte);
    if micros.is_empty() {
        return Err(ErreurMicro::AucunMicro);
    }
    micros.sort_by_key(|m| !m.defaut);
    Ok(micros)
}

/// Un nom de micro venu de l'interface : une source PulseAudio, jamais une option de `ffmpeg`.
pub fn nom_valide(nom: &str) -> bool {
    !nom.is_empty() && nom.len() < 256 && !nom.starts_with('-') && nom.chars().all(|c| c.is_ascii_alphanumeric() || "._-:@".contains(c))
}

/// La commande qui écoute un micro : du son brut, mono, 48 kHz, 16 bits, sur la sortie.
pub fn commande_pulse(source: &str) -> Command {
    let mut c = Command::new("ffmpeg");
    c.args(["-hide_banner", "-nostats", "-loglevel", "error", "-nostdin", "-f", "pulse", "-name", "Eliot", "-stream_name", "Prise de voix", "-sample_rate", "48000", "-channels", "1", "-fragment_size", FRAGMENT, "-i", source]);
    c.args(["-c:a", "copy", "-f", "s16le", "pipe:1"]);
    c
}

/// L'en-tête d'un fichier WAV mono, 48 kHz, 16 bits, de `echantillons` échantillons.
pub fn entete_wav(echantillons: u32) -> [u8; 44] {
    entete_wav_canaux(echantillons, 1)
}

/// L'en-tête d'un fichier WAV à 48 kHz, 16 bits, de `trames` trames de `canaux` canaux.
pub fn entete_wav_canaux(trames: u32, canaux: u16) -> [u8; 44] {
    let donnees = trames.saturating_mul(2 * canaux as u32);
    let mut e = [0u8; 44];
    e[0..4].copy_from_slice(b"RIFF");
    e[4..8].copy_from_slice(&donnees.saturating_add(36).to_le_bytes());
    e[8..16].copy_from_slice(b"WAVEfmt ");
    e[16..20].copy_from_slice(&16u32.to_le_bytes());
    e[20..22].copy_from_slice(&1u16.to_le_bytes());
    e[22..24].copy_from_slice(&canaux.to_le_bytes());
    e[24..28].copy_from_slice(&FREQUENCE.to_le_bytes());
    e[28..32].copy_from_slice(&(FREQUENCE * 2 * canaux as u32).to_le_bytes());
    e[32..34].copy_from_slice(&(2 * canaux).to_le_bytes());
    e[34..36].copy_from_slice(&16u16.to_le_bytes());
    e[36..40].copy_from_slice(b"data");
    e[40..44].copy_from_slice(&donnees.to_le_bytes());
    e
}

/// Ce que la fenêtre reçoit tous les 50 ms.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct NiveauMicro {
    /// Crête du bloc, en dBFS (-90 pour le silence).
    pub crete: f64,
    /// Niveau moyen (RMS) du bloc, en dBFS.
    pub rms: f64,
    /// Le son a touché le maximum : il sature.
    pub ecretage: bool,
    /// Depuis le top de la prise en cours, en ms (absent hors prise ou pendant le compte à
    /// rebours).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prise: Option<u64>,
    /// Le micro s'est arrêté (débranché, refusé) : pourquoi.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub erreur: Option<String>,
}

fn en_db(v: f64) -> f64 {
    if v <= 0.0 { -90.0 } else { (20.0 * v.log10()).max(-90.0) }
}

struct EnCours {
    chemin: PathBuf,
    fichier: BufWriter<File>,
    /// Échantillons écrits dans le fichier.
    ecrits: u64,
    /// Le top (échantillon du fichier), une fois le compte à rebours fini.
    marque: Option<u64>,
}

#[derive(Default)]
struct Partage {
    prise: Option<EnCours>,
    erreur: Option<String>,
    fini: bool,
    /// Fermé exprès (micro fermé, ou un autre choisi) : la fin n'est pas une erreur à dire.
    ferme: bool,
}

/// Une prise finie : le fichier WAV, sa durée et le top, en ms.
#[derive(Debug, Clone, Serialize)]
pub struct PriseFinie {
    pub chemin: PathBuf,
    pub duree: u64,
    pub marque: u64,
}

/// Le micro ouvert, qui écoute jusqu'à `fermer` (ou la fin de l'objet).
pub struct Captation {
    processus: Child,
    partage: Arc<Mutex<Partage>>,
    lecteur: Option<JoinHandle<()>>,
}

fn ms(echantillons: u64) -> u64 {
    echantillons * 1000 / FREQUENCE as u64
}

impl Captation {
    /// Ouvre le micro `source` (`default` : celui du système).
    pub fn ouvrir(source: &str, envoyer: Box<dyn FnMut(NiveauMicro) + Send>) -> Result<Self, ErreurMicro> {
        if !nom_valide(source) {
            return Err(ErreurMicro::Ouverture(format!("nom de micro refusé : {source}")));
        }
        Self::lancer(commande_pulse(source), envoyer)
    }

    /// Écoute ce que `commande` écrit sur sa sortie (son brut, mono, 48 kHz, 16 bits) : le
    /// micro, ou un son de test.
    pub fn lancer(mut commande: Command, mut envoyer: Box<dyn FnMut(NiveauMicro) + Send>) -> Result<Self, ErreurMicro> {
        let mut processus = commande
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| if e.kind() == io::ErrorKind::NotFound { ErreurMicro::FfmpegAbsent } else { ErreurMicro::Ouverture(e.to_string()) })?;
        let mut sortie = processus.stdout.take().expect("sortie redirigée");
        let mut erreurs = processus.stderr.take().expect("stderr redirigé");
        let partage = Arc::new(Mutex::new(Partage::default()));
        let p = partage.clone();
        let lecteur = std::thread::spawn(move || {
            let lecteur_erreurs = std::thread::spawn(move || {
                let mut texte = String::new();
                let _ = erreurs.read_to_string(&mut texte);
                texte
            });
            let mut tampon = vec![0u8; 8192];
            let mut reste: Vec<u8> = Vec::new();
            let (mut crete, mut somme, mut n, mut sature) = (0i32, 0f64, 0usize, false);
            loop {
                let lus = match sortie.read(&mut tampon) {
                    Ok(0) | Err(_) => break,
                    Ok(l) => l,
                };
                reste.extend_from_slice(&tampon[..lus]);
                let utiles = reste.len() / 2 * 2;
                let mut etat = p.lock().unwrap_or_else(|e| e.into_inner());
                if let Some(prise) = etat.prise.as_mut() {
                    match prise.fichier.write_all(&reste[..utiles]) {
                        Ok(()) => prise.ecrits += (utiles / 2) as u64,
                        Err(e) => etat.erreur = Some(e.to_string()),
                    }
                }
                let depuis_top = etat.prise.as_ref().and_then(|x| x.marque.map(|m| ms(x.ecrits.saturating_sub(m))));
                drop(etat);
                for o in reste[..utiles].chunks_exact(2) {
                    let v = i16::from_le_bytes([o[0], o[1]]) as i32;
                    crete = crete.max(v.abs());
                    sature |= v >= i16::MAX as i32 || v <= i16::MIN as i32;
                    somme += (v as f64) * (v as f64);
                    n += 1;
                    if n == BLOC_NIVEAU {
                        envoyer(NiveauMicro { crete: en_db(crete as f64 / 32768.0), rms: en_db((somme / n as f64).sqrt() / 32768.0), ecretage: sature, prise: depuis_top, erreur: None });
                        (crete, somme, n, sature) = (0, 0.0, 0, false);
                    }
                }
                reste.drain(..utiles);
            }
            let texte = lecteur_erreurs.join().unwrap_or_default();
            let mut etat = p.lock().unwrap_or_else(|e| e.into_inner());
            etat.fini = true;
            let ferme = etat.ferme;
            let message = etat.erreur.clone().or_else(|| texte.lines().last().map(str::to_string)).unwrap_or_else(|| "le micro s'est arrêté".into());
            drop(etat);
            if !ferme {
                envoyer(NiveauMicro { crete: -90.0, rms: -90.0, ecretage: false, prise: None, erreur: Some(message) });
            }
        });
        Ok(Self { processus, partage, lecteur: Some(lecteur) })
    }

    fn etat(&self) -> std::sync::MutexGuard<'_, Partage> {
        self.partage.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Commence une prise dans le fichier `chemin` (le compte à rebours y entre).
    pub fn commencer(&self, chemin: &Path) -> Result<(), ErreurMicro> {
        let mut etat = self.etat();
        if etat.fini {
            return Err(ErreurMicro::Ouverture(etat.erreur.clone().unwrap_or_else(|| "le micro s'est arrêté".into())));
        }
        if etat.prise.is_some() {
            return Err(ErreurMicro::PriseEnCours);
        }
        let mut fichier = BufWriter::new(File::create(chemin)?);
        fichier.write_all(&entete_wav(0))?;
        etat.prise = Some(EnCours { chemin: chemin.to_path_buf(), fichier, ecrits: 0, marque: None });
        Ok(())
    }

    /// Le top : le clip commencera ici. Renvoie l'instant du fichier, en ms.
    pub fn marquer(&self) -> Result<u64, ErreurMicro> {
        let mut etat = self.etat();
        let prise = etat.prise.as_mut().ok_or(ErreurMicro::PasDePrise)?;
        let m = prise.ecrits;
        prise.marque = Some(m);
        Ok(ms(m))
    }

    /// Arrête la prise et ferme son fichier ; le micro continue d'écouter.
    pub fn arreter(&self) -> Result<PriseFinie, ErreurMicro> {
        let prise = self.etat().prise.take().ok_or(ErreurMicro::PasDePrise)?;
        let EnCours { chemin, fichier, ecrits, marque } = prise;
        let mut f = fichier.into_inner().map_err(|e| ErreurMicro::Ecriture(e.into_error()))?;
        f.seek(SeekFrom::Start(0))?;
        f.write_all(&entete_wav(ecrits.min(u32::MAX as u64 / 2 - 64) as u32))?;
        f.sync_all()?;
        Ok(PriseFinie { chemin, duree: ms(ecrits), marque: ms(marque.unwrap_or(0)) })
    }

    /// Abandonne la prise en cours (Échap) : son fichier est effacé.
    pub fn abandonner(&self) {
        if let Some(prise) = self.etat().prise.take() {
            drop(prise.fichier);
            let _ = fs::remove_file(&prise.chemin);
        }
    }

    /// Le micro écoute-t-il encore ?
    pub fn ouvert(&self) -> bool {
        !self.etat().fini
    }
}

impl Drop for Captation {
    fn drop(&mut self) {
        self.etat().ferme = true;
        self.abandonner();
        let _ = self.processus.kill();
        let _ = self.processus.wait();
        if let Some(l) = self.lecteur.take() {
            let _ = l.join();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::{Duration, Instant};

    fn ffmpeg_present() -> bool {
        Command::new("ffmpeg").arg("-version").stdout(Stdio::null()).stderr(Stdio::null()).status().is_ok_and(|s| s.success())
    }

    #[test]
    fn la_liste_des_micros_se_lit_sans_les_moniteurs() {
        let texte = "Auto-detected sources for pulse:\n  alsa_output.pci.analog-stereo.monitor [Monitor of Built-in Audio] (none)\n* alsa_input.pci.analog-stereo [Built-in Audio Analog Stereo] (none)\n  bluez_input.00:11:22 [Casque] (none)\n";
        let m = lire_sources(texte);
        assert_eq!(m.len(), 2);
        assert_eq!(m[0], Micro { nom: "alsa_input.pci.analog-stereo".into(), description: "Built-in Audio Analog Stereo".into(), defaut: true });
        assert_eq!(m[1].nom, "bluez_input.00:11:22");
        assert!(!m[1].defaut);
        assert!(lire_sources("Cannot list sources: Generic error").is_empty());
        assert!(nom_valide("default") && nom_valide("bluez_input.00:11:22") && nom_valide("micro_essai"));
        assert!(!nom_valide("-i") && !nom_valide("a b") && !nom_valide("x;rm") && !nom_valide(""));
    }

    #[test]
    fn l_entete_wav_se_relit() {
        let e = entete_wav(48_000);
        assert_eq!(&e[0..4], b"RIFF");
        assert_eq!(u32::from_le_bytes([e[40], e[41], e[42], e[43]]), 96_000);
        assert_eq!(u32::from_le_bytes([e[24], e[25], e[26], e[27]]), 48_000);
    }

    #[test]
    fn une_prise_garde_le_compte_a_rebours_et_marque_le_top() {
        if !ffmpeg_present() {
            eprintln!("ffmpeg absent : essai sauté");
            return;
        }
        // Un faux micro : une sinusoïde, envoyée au rythme réel.
        let mut c = Command::new("ffmpeg");
        c.args(["-hide_banner", "-loglevel", "error", "-re", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-af", "volume=0.5", "-ac", "1", "-f", "s16le", "-c:a", "pcm_s16le", "pipe:1"]);
        let (tx, rx) = mpsc::channel();
        let micro = Captation::lancer(c, Box::new(move |n| { let _ = tx.send(n); })).unwrap();
        // Le niveau arrive avant toute prise. La sinusoïde de ffmpeg est à -18 dBFS, la moitié
        // fait -24 dBFS de crête et -27 de RMS.
        let n = rx.recv_timeout(Duration::from_secs(10)).unwrap();
        assert!((n.crete + 24.0).abs() < 0.5 && (n.rms + 27.0).abs() < 0.5, "{n:?}");
        assert_eq!(n.prise, None);
        assert!(micro.marquer().is_err());
        // ffmpeg envoie d'abord une demi-seconde d'un coup (`-re`), puis au rythme réel.
        std::thread::sleep(Duration::from_millis(1000));

        let dossier = std::env::temp_dir().join(format!("eliot-micro-{}", std::process::id()));
        fs::create_dir_all(&dossier).unwrap();
        let fichier = dossier.join("prise.wav");
        micro.commencer(&fichier).unwrap();
        assert!(matches!(micro.commencer(&fichier), Err(ErreurMicro::PriseEnCours)));
        std::thread::sleep(Duration::from_millis(600));
        let top = micro.marquer().unwrap();
        assert!((500..=800).contains(&top), "top à {top} ms");
        let depart = Instant::now();
        // Après le top, les niveaux disent depuis combien de temps la prise court.
        let mut vu = None;
        while depart.elapsed() < Duration::from_millis(900) {
            if let Ok(n) = rx.recv_timeout(Duration::from_millis(100)) {
                vu = n.prise.or(vu);
            }
        }
        let fin = micro.arreter().unwrap();
        assert!(vu.is_some_and(|v| v >= 500), "{vu:?}");
        assert_eq!(fin.marque, top);
        assert!((fin.duree as i64 - top as i64 - 900).abs() < 250, "durée {} pour un top à {top}", fin.duree);
        // Le fichier est un WAV complet, que ffprobe relit à la bonne durée.
        let sortie = Command::new("ffprobe").args(["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0"]).arg(&fichier).output().unwrap();
        let secondes: f64 = String::from_utf8_lossy(&sortie.stdout).trim().parse().unwrap();
        assert!((secondes * 1000.0 - fin.duree as f64).abs() < 30.0, "{secondes} s pour {} ms", fin.duree);
        // Le micro écoute toujours ; une prise abandonnée ne laisse rien.
        assert!(micro.ouvert());
        let deuxieme = dossier.join("deuxieme.wav");
        micro.commencer(&deuxieme).unwrap();
        micro.abandonner();
        assert!(!deuxieme.exists());
        assert!(matches!(micro.arreter(), Err(ErreurMicro::PasDePrise)));
        // Fermé exprès : pas d'erreur annoncée.
        drop(micro);
        while let Ok(n) = rx.recv_timeout(Duration::from_millis(300)) {
            assert!(n.erreur.is_none(), "{n:?}");
        }
        fs::remove_dir_all(&dossier).unwrap();
    }

    #[test]
    fn un_micro_qui_s_arrete_le_dit() {
        if !ffmpeg_present() {
            return;
        }
        let mut c = Command::new("ffmpeg");
        c.args(["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "0.3", "-f", "s16le", "-c:a", "pcm_s16le", "pipe:1"]);
        let (tx, rx) = mpsc::channel();
        let micro = Captation::lancer(c, Box::new(move |n| { let _ = tx.send(n); })).unwrap();
        let mut derniere = None;
        while let Ok(n) = rx.recv_timeout(Duration::from_secs(5)) {
            let fin = n.erreur.is_some();
            derniere = Some(n);
            if fin {
                break;
            }
        }
        assert!(derniere.unwrap().erreur.is_some());
        assert!(!micro.ouvert());
        assert!(micro.commencer(&std::env::temp_dir().join("jamais.wav")).is_err());
    }
}
