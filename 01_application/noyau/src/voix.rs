//! Le nettoyage d'une voix (étape 4, lot 6) : réduction du bruit de fond, coupe des graves sous
//! 80 Hz, chaleur et présence, compresseur, dé-esseur, niveau de la voix. Les réglages sont des
//! valeurs du document, posées sur un clip de la frise (règle 13) : l'original n'est jamais
//! touché. Le noyau fabrique une fois la version nettoyée de tout le fichier et la garde en
//! cache, à côté des ressources du design :
//!
//! `traitees/<empreinte>-<clé>.flac` (stéréo, 48 kHz, 24 bits, pour l'export),
//! `traitees/<empreinte>-<clé>.webm` (copie d'écoute Opus, pour la fenêtre),
//! `traitees/<empreinte>-<clé>.json` (durée, niveau, forme d'onde).
//!
//! La clé résume les réglages : deux clips d'une même prise aux mêmes réglages partagent la
//! même version. Ce dossier n'entre pas dans l'archive `.eliot` : il se refait au besoin.
//!
//! La réduction du bruit est RNNoise (Xiph et Mozilla, réécrit en Rust par `nnnoiseless`, son
//! modèle compris) ; les filtres sont ceux de `ffmpeg` ; le niveau se mesure par `ebur128`,
//! comme à l'export. Tout tourne sur le processeur (règle 9).

use std::collections::HashSet;
use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::process::Stdio;

use nnnoiseless::DenoiseState;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::fichiers::{chemin_temporaire, ecrire_atomiquement};
use crate::images::{self, Genre};
use crate::sons::{self, ErreurSon, Mesureur, Niveau};
use crate::videos::{self, Onde};

/// Le niveau visé par « niveau de la voix » : -16 LUFS, le niveau courant d'une voix parlée
/// (podcasts, vidéos), qui la laisse au-dessus d'une musique baissée sous elle.
pub const CIBLE_VOIX: f64 = -16.0;
/// La crête vraie ne dépasse jamais -1 dBTP, comme à l'export.
pub const CRETE_VOIX: f64 = -1.0;
/// Le dossier des versions nettoyées, dans le dossier des ressources du design.
pub const DOSSIER: &str = "traitees";
/// Changé si les traitements changent : les anciennes versions ne servent plus.
const VERSION: &str = "v1";
const FREQUENCE: usize = 48_000;

/// Les réglages du nettoyage d'une voix, tels que le document les garde sur un clip. Un réglage
/// absent ne fait rien.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Nettoyage {
    /// Réduction du bruit de fond, de 0 à 1 (1 : tout RNNoise ; 0,5 : moitié son d'origine).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bruit: Option<f64>,
    /// Coupe les graves sous 80 Hz (rumeur, bruits de manipulation, ronflement).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub graves: Option<bool>,
    /// Chaleur : plateau des bas médiums vers 180 Hz, en dB (-6 à +6).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chaleur: Option<f64>,
    /// Présence : cloche vers 4,5 kHz, en dB (-6 à +6).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub presence: Option<f64>,
    /// Compresseur, de 0 à 1 : resserre l'écart entre les passages forts et faibles.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub compresseur: Option<f64>,
    /// Dé-esseur, de 0 à 1 : adoucit les « s » et les « ch ».
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deesseur: Option<f64>,
    /// Cale la voix sur -16 LUFS ; sinon, elle garde le niveau qu'elle avait avant.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub niveau: Option<bool>,
}

fn arrondi(v: f64, pas: f64) -> f64 {
    (v / pas).round() * pas
}

impl Nettoyage {
    /// Les réglages ramenés dans leurs bornes et à leur précision ; ce qui ne fait rien disparaît.
    pub fn borne(&self) -> Nettoyage {
        let part = |v: Option<f64>| v.map(|x| arrondi(x.clamp(0.0, 1.0), 0.01)).filter(|x| *x > 0.0);
        let db = |v: Option<f64>| v.map(|x| arrondi(x.clamp(-6.0, 6.0), 0.1)).filter(|x| x.abs() > 1e-9);
        Nettoyage {
            bruit: part(self.bruit),
            graves: self.graves.filter(|g| *g),
            chaleur: db(self.chaleur),
            presence: db(self.presence),
            compresseur: part(self.compresseur),
            deesseur: part(self.deesseur),
            niveau: self.niveau.filter(|n| *n),
        }
    }

    pub fn est_vide(&self) -> bool {
        self.borne() == Nettoyage::default()
    }

    /// La clé de ces réglages : 16 chiffres hexadécimaux, les mêmes pour les mêmes réglages.
    pub fn cle(&self) -> String {
        let b = self.borne();
        let texte = format!(
            "{VERSION};bruit={:.2};graves={};chaleur={:.1};presence={:.1};compresseur={:.2};deesseur={:.2};niveau={}",
            b.bruit.unwrap_or(0.0),
            b.graves.unwrap_or(false),
            b.chaleur.unwrap_or(0.0),
            b.presence.unwrap_or(0.0),
            b.compresseur.unwrap_or(0.0),
            b.deesseur.unwrap_or(0.0),
            b.niveau.unwrap_or(false)
        );
        Sha256::digest(texte.as_bytes()).iter().take(8).map(|o| format!("{o:02x}")).collect()
    }

    /// Les filtres de `ffmpeg` (après la réduction du bruit), ou `None` s'il n'y en a pas.
    pub fn filtres(&self) -> Option<String> {
        let b = self.borne();
        let mut f: Vec<String> = Vec::new();
        if b.graves == Some(true) {
            // Deux passe-haut à la suite : 24 dB par octave sous 80 Hz (un ronflement à 50 Hz
            // perd 17 dB, une voix grave à 150 Hz 1 dB).
            f.push("highpass=f=80:poles=2,highpass=f=80:poles=2".into());
        }
        if let Some(g) = b.chaleur {
            f.push(format!("lowshelf=f=180:g={g:.1}"));
        }
        if let Some(g) = b.presence {
            f.push(format!("equalizer=f=4500:t=q:w=1:g={g:.1}"));
        }
        if let Some(c) = b.compresseur {
            // Seuil de -10 à -30 dB, rapport de 1,5 à 6 ; pas de gain de rattrapage ici : le
            // niveau est calé à la fin, sur tout le fichier.
            let seuil_db = -10.0 - 20.0 * c;
            let rapport = 1.5 + 4.5 * c;
            f.push(format!("acompressor=threshold={:.6}:ratio={rapport:.2}:attack=5:release=120:knee=2.8:makeup=1", 10f64.powf(seuil_db / 20.0)));
        }
        if let Some(d) = b.deesseur {
            f.push(format!("deesser=i={d:.2}:m=0.5:f=0.5:s=o"));
        }
        (!f.is_empty()).then(|| f.join(","))
    }
}

/// Le réglage prêt « Voix nette » : bruit réduit, graves coupés, un peu de chaleur et de
/// présence, compresseur et dé-esseur moyens, voix calée sur -16 LUFS.
pub fn voix_nette() -> Nettoyage {
    Nettoyage { bruit: Some(0.85), graves: Some(true), chaleur: Some(1.5), presence: Some(3.0), compresseur: Some(0.5), deesseur: Some(0.4), niveau: Some(true) }
}

/// Ce que l'interface sait d'une version nettoyée.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Traitee {
    pub cle: String,
    /// Durée, en millisecondes (celle de l'original).
    pub duree: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lufs: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub crete: Option<f64>,
}

#[derive(Serialize, Deserialize)]
struct FicheTraitee {
    #[serde(flatten)]
    traitee: Traitee,
    onde: Onde,
}

/// Une clé venue de l'interface : 16 chiffres hexadécimaux en minuscules, rien d'autre (elle
/// sert à construire un chemin).
pub fn cle_valide(cle: &str) -> bool {
    cle.len() == 16 && cle.bytes().all(|o| o.is_ascii_hexdigit() && !o.is_ascii_uppercase())
}

/// Le chemin d'un fichier d'une version nettoyée (`flac`, `webm` ou `json`).
pub fn chemin(dossier: &Path, id: &str, cle: &str, extension: &str) -> Result<PathBuf, ErreurSon> {
    if !images::identifiant_valide(id) || !cle_valide(cle) || !["flac", "webm", "json"].contains(&extension) {
        return Err(ErreurSon::Ffmpeg("version nettoyée inconnue".into()));
    }
    Ok(dossier.join(DOSSIER).join(format!("{id}-{cle}.{extension}")))
}

/// La forme d'onde d'une version nettoyée (JSON, comme celle d'un son importé).
pub fn lire_onde(dossier: &Path, id: &str, cle: &str) -> Result<Vec<u8>, ErreurSon> {
    let fiche: FicheTraitee = serde_json::from_slice(&fs::read(chemin(dossier, id, cle, "json")?)?).map_err(|e| ErreurSon::Ffmpeg(e.to_string()))?;
    Ok(serde_json::to_vec(&fiche.onde).expect("onde sérialisable"))
}

// ----------------------------------------------------------------------------------------
// Les traitements
// ----------------------------------------------------------------------------------------

/// Le retard de RNNoise : une trame (480 échantillons, 10 ms), rattrapé pour que la voix
/// nettoyée tombe exactement à la place de l'originale.
const RETARD_RNNOISE: usize = DenoiseState::FRAME_SIZE;

/// Réduit le bruit de fond d'un son mono à 48 kHz (valeurs de -1 à 1). `force` : 1 pour tout
/// RNNoise, moins pour mêler le son d'origine (calé sur le même instant).
pub fn debruiter(mono: &[f32], force: f64) -> Vec<f32> {
    let force = force.clamp(0.0, 1.0) as f32;
    if force <= 0.0 || mono.is_empty() {
        return mono.to_vec();
    }
    let trame = DenoiseState::FRAME_SIZE;
    let mut etat = DenoiseState::new();
    let total = mono.len() + RETARD_RNNOISE;
    let trames = total.div_ceil(trame);
    let mut entree = vec![0.0_f32; trame];
    let mut sortie_trame = vec![0.0_f32; trame];
    let mut sortie: Vec<f32> = Vec::with_capacity(trames * trame);
    for n in 0..trames {
        for (i, v) in entree.iter_mut().enumerate() {
            *v = mono.get(n * trame + i).copied().unwrap_or(0.0) * 32768.0;
        }
        etat.process_frame(&mut sortie_trame, &entree);
        sortie.extend(sortie_trame.iter().map(|v| v / 32768.0));
    }
    // La sortie a une trame de retard : on la rattrape, et on mêle le son d'origine au besoin.
    (0..mono.len()).map(|i| sortie[i + RETARD_RNNOISE] * force + mono[i] * (1.0 - force)).collect()
}

/// Passe un son mono à 48 kHz dans une chaîne de filtres de `ffmpeg`.
fn filtrer(mono: Vec<f32>, filtres: &str) -> Result<Vec<f32>, ErreurSon> {
    let mut processus = videos::programme("ffmpeg")
        .args(["-hide_banner", "-loglevel", "error", "-f", "f32le", "-ar", "48000", "-ac", "1", "-i", "pipe:0", "-af", filtres, "-f", "f32le", "-ar", "48000", "-ac", "1", "pipe:1"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| if e.kind() == io::ErrorKind::NotFound { ErreurSon::FfmpegAbsent } else { ErreurSon::Lecture(e) })?;
    let longueur = mono.len();
    let mut entree = processus.stdin.take().expect("entrée redirigée");
    // L'écriture à part : ffmpeg rend le son au fil de l'eau, les deux tuyaux ne doivent jamais
    // se bloquer l'un l'autre.
    let ecrivain = std::thread::spawn(move || {
        let octets: Vec<u8> = mono.iter().flat_map(|v| v.to_le_bytes()).collect();
        entree.write_all(&octets)
    });
    let mut erreur = processus.stderr.take().expect("stderr redirigé");
    let lecteur_erreur = std::thread::spawn(move || {
        let mut texte = String::new();
        let _ = erreur.read_to_string(&mut texte);
        texte
    });
    let mut octets = Vec::with_capacity(longueur * 4);
    processus.stdout.take().expect("sortie redirigée").read_to_end(&mut octets)?;
    let ecrit = ecrivain.join().unwrap_or_else(|_| Err(io::Error::other("écriture interrompue")));
    let statut = processus.wait()?;
    let texte = lecteur_erreur.join().unwrap_or_default();
    if !statut.success() {
        return Err(ErreurSon::Ffmpeg(texte.lines().last().unwrap_or("échec sans message").to_string()));
    }
    ecrit?;
    let mut sortie: Vec<f32> = octets.chunks_exact(4).map(|o| f32::from_le_bytes([o[0], o[1], o[2], o[3]])).collect();
    // Les filtres gardent la durée ; au cas où, on la remet exacte.
    sortie.resize(longueur, 0.0);
    Ok(sortie)
}

/// Mesure un son mono tel qu'il s'entend : sur les deux canaux.
fn mesurer_mono(mono: &[f32]) -> (Onde, Niveau) {
    let mut m = Mesureur::new();
    for bloc in mono.chunks(FREQUENCE) {
        let stereo: Vec<f32> = bloc.iter().flat_map(|v| [*v, *v]).collect();
        m.ajouter(&stereo);
    }
    m.finir()
}

/// Le gain (dB) final : la voix calée sur `cible` LUFS, ou sur `reference` (son niveau d'avant),
/// sans que la crête vraie dépasse -1 dBTP.
pub fn gain_final(niveau: &Niveau, cible: Option<f64>) -> f64 {
    let Some(lufs) = niveau.lufs else { return 0.0 };
    let mut g = cible.map_or(0.0, |c| c - lufs);
    if let Some(crete) = niveau.crete {
        g = g.min(CRETE_VOIX - crete);
    }
    g
}

/// Applique les réglages à un son mono à 48 kHz : réduction du bruit, filtres, puis le gain qui
/// cale le niveau (sur -16 LUFS, ou sur celui d'avant `reference`).
pub fn traiter(mono: &[f32], reglages: &Nettoyage, reference: Option<f64>) -> Result<Vec<f32>, ErreurSon> {
    let r = reglages.borne();
    let mut son = debruiter(mono, r.bruit.unwrap_or(0.0));
    if let Some(filtres) = r.filtres() {
        son = filtrer(son, &filtres)?;
    }
    let (_, niveau) = mesurer_mono(&son);
    let cible = if r.niveau == Some(true) { Some(CIBLE_VOIX) } else { reference };
    let gain = 10f64.powf(gain_final(&niveau, cible) / 20.0) as f32;
    if (gain - 1.0).abs() > 1e-6 {
        for v in &mut son {
            *v *= gain;
        }
    }
    Ok(son)
}

/// Écrit la version nettoyée (FLAC 24 bits et copie d'écoute Opus, en stéréo) en une passe.
fn ecrire(mono: &[f32], flac: &Path, webm: &Path) -> Result<(), ErreurSon> {
    let tmp_flac = chemin_temporaire(flac)?;
    let tmp_webm = chemin_temporaire(webm)?;
    let mut processus = videos::programme("ffmpeg")
        .args(["-y", "-hide_banner", "-loglevel", "error", "-f", "f32le", "-ar", "48000", "-ac", "2", "-i", "pipe:0"])
        .args(["-map", "0:a", "-c:a", "flac", "-sample_fmt", "s32", "-bits_per_raw_sample", "24", "-f", "flac"])
        .arg(&tmp_flac)
        .args(["-map", "0:a", "-c:a", "libopus", "-b:a", "128k", "-f", "webm"])
        .arg(&tmp_webm)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| if e.kind() == io::ErrorKind::NotFound { ErreurSon::FfmpegAbsent } else { ErreurSon::Lecture(e) })?;
    let mut erreur = processus.stderr.take().expect("stderr redirigé");
    let lecteur_erreur = std::thread::spawn(move || {
        let mut texte = String::new();
        let _ = erreur.read_to_string(&mut texte);
        texte
    });
    let ecrit = (|| -> io::Result<()> {
        let mut entree = processus.stdin.take().expect("entrée redirigée");
        for bloc in mono.chunks(FREQUENCE) {
            let octets: Vec<u8> = bloc.iter().flat_map(|v| {
                let o = v.clamp(-1.0, 1.0).to_le_bytes();
                [o, o]
            }).flatten().collect();
            entree.write_all(&octets)?;
        }
        Ok(())
    })();
    let statut = processus.wait()?;
    let texte = lecteur_erreur.join().unwrap_or_default();
    let nettoyer = || {
        let _ = fs::remove_file(&tmp_flac);
        let _ = fs::remove_file(&tmp_webm);
    };
    if !statut.success() {
        nettoyer();
        return Err(ErreurSon::Ffmpeg(texte.lines().last().unwrap_or("échec sans message").to_string()));
    }
    if let Err(e) = ecrit {
        nettoyer();
        return Err(e.into());
    }
    fs::rename(&tmp_flac, flac)?;
    fs::rename(&tmp_webm, webm)?;
    Ok(())
}

/// La version nettoyée d'un son du design (un son importé, une prise, ou une vidéo dont on a
/// détaché le son), faite une fois puis relue du cache.
pub fn nettoyer(dossier: &Path, id: &str, reglages: &Nettoyage) -> Result<Traitee, ErreurSon> {
    let cle = reglages.cle();
    let fiche = chemin(dossier, id, &cle, "json")?;
    if let Ok(octets) = fs::read(&fiche)
        && let Ok(f) = serde_json::from_slice::<FicheTraitee>(&octets)
        && chemin(dossier, id, &cle, "flac")?.exists()
        && chemin(dossier, id, &cle, "webm")?.exists()
    {
        return Ok(f.traitee);
    }
    let infos = images::infos(dossier, id).map_err(|e| ErreurSon::Ffmpeg(e.to_string()))?;
    if infos.son.is_none() && !infos.video.as_ref().is_some_and(|v| v.son) {
        return Err(ErreurSon::PasDeSon);
    }
    let original = images::chemin_ressource(dossier, id, Genre::Original).map_err(|e| ErreurSon::Ffmpeg(e.to_string()))?;
    let stereo = sons::decoder_stereo(&original)?;
    // Le niveau d'avant, tel qu'il s'entend : la voix le garde si on ne la cale pas.
    let reference = sons::mesurer(&stereo).lufs;
    let mono: Vec<f32> = stereo.chunks_exact(2).map(|p| (p[0] + p[1]) * 0.5).collect();
    drop(stereo);
    let son = traiter(&mono, reglages, reference)?;
    drop(mono);
    fs::create_dir_all(dossier.join(DOSSIER))?;
    ecrire(&son, &chemin(dossier, id, &cle, "flac")?, &chemin(dossier, id, &cle, "webm")?)?;
    let (onde, niveau) = mesurer_mono(&son);
    let traitee = Traitee { cle: cle.clone(), duree: (son.len() as u64 * 1000).div_ceil(FREQUENCE as u64), lufs: niveau.lufs, crete: niveau.crete };
    ecrire_atomiquement(&fiche, &serde_json::to_vec(&FicheTraitee { traitee: traitee.clone(), onde }).expect("fiche sérialisable"))?;
    Ok(traitee)
}

/// Le fichier à décoder pour l'export d'un clip nettoyé (fait au besoin).
pub fn fichier_pour_export(dossier: &Path, id: &str, reglages: &Nettoyage) -> Result<PathBuf, ErreurSon> {
    let t = nettoyer(dossier, id, reglages)?;
    chemin(dossier, id, &t.cle, "flac")
}

/// Efface les versions nettoyées dont plus aucun clip ne se sert (`gardees` : les couples
/// ressource et réglages encore utilisés). Renvoie le nombre de fichiers effacés.
pub fn purger(dossier: &Path, gardees: &[(String, Nettoyage)]) -> usize {
    let garder: HashSet<String> = gardees.iter().map(|(id, n)| format!("{id}-{}", n.cle())).collect();
    let Ok(entrees) = fs::read_dir(dossier.join(DOSSIER)) else { return 0 };
    let mut effaces = 0;
    for entree in entrees.flatten() {
        let chemin = entree.path();
        let Some(base) = chemin.file_stem().map(|s| s.to_string_lossy().into_owned()) else { continue };
        // Seulement les fichiers d'Eliot (empreinte, tiret, clé) : rien d'autre n'est touché.
        let forme = base.len() == 64 + 1 + 16 && images::identifiant_valide(&base[..64]) && cle_valide(&base[65..]);
        if forme && !garder.contains(&base) && fs::remove_file(&chemin).is_ok() {
            effaces += 1;
        }
    }
    effaces
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sons::importer;
    use std::process::Command;

    fn ffmpeg_present() -> bool {
        Command::new("ffmpeg").arg("-version").stdout(Stdio::null()).stderr(Stdio::null()).status().is_ok_and(|s| s.success())
    }

    fn dossier_de_test(nom: &str) -> PathBuf {
        let dossier = std::env::temp_dir().join(format!("eliot-voix-{nom}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dossier);
        fs::create_dir_all(&dossier).unwrap();
        dossier
    }

    /// Un générateur pseudo-aléatoire simple, pour un bruit reproductible.
    fn bruit_blanc(n: usize, amplitude: f32) -> Vec<f32> {
        let mut x: u32 = 12345;
        (0..n)
            .map(|_| {
                x ^= x << 13;
                x ^= x >> 17;
                x ^= x << 5;
                (x as f32 / u32::MAX as f32 * 2.0 - 1.0) * amplitude
            })
            .collect()
    }

    fn rms(v: &[f32]) -> f64 {
        (v.iter().map(|x| (*x as f64).powi(2)).sum::<f64>() / v.len().max(1) as f64).sqrt()
    }

    #[test]
    fn les_reglages_se_bornent_et_se_resument_en_une_cle() {
        let n = Nettoyage { bruit: Some(1.7), graves: Some(false), chaleur: Some(-9.0), presence: Some(0.0), compresseur: Some(0.333), deesseur: None, niveau: Some(true) };
        let b = n.borne();
        assert_eq!(b, Nettoyage { bruit: Some(1.0), graves: None, chaleur: Some(-6.0), presence: None, compresseur: Some(0.33), deesseur: None, niveau: Some(true) });
        // Mêmes réglages une fois bornés : même clé ; autres réglages : autre clé.
        assert_eq!(n.cle(), b.cle());
        assert!(cle_valide(&n.cle()));
        assert_ne!(n.cle(), voix_nette().cle());
        assert!(Nettoyage::default().est_vide() && Nettoyage { graves: Some(false), ..Default::default() }.est_vide());
        assert!(!voix_nette().est_vide());
        // Les filtres de ffmpeg dans l'ordre : graves, chaleur, présence, compresseur, dé-esseur.
        let f = voix_nette().filtres().unwrap();
        let ordre: Vec<usize> = ["highpass", "lowshelf", "equalizer", "acompressor", "deesser"].iter().map(|x| f.find(x).unwrap()).collect();
        assert!(ordre.windows(2).all(|p| p[0] < p[1]), "{f}");
        assert!(Nettoyage { bruit: Some(1.0), niveau: Some(true), ..Default::default() }.filtres().is_none());
        // Le document en camelCase, sans les réglages absents.
        let j = serde_json::to_value(Nettoyage { bruit: Some(0.5), ..Default::default() }).unwrap();
        assert_eq!(j, serde_json::json!({ "bruit": 0.5 }));
        let lu: Nettoyage = serde_json::from_value(serde_json::json!({ "graves": true, "inconnu": 3 })).unwrap();
        assert_eq!(lu.graves, Some(true));
        // Une clé ou un identifiant bancal ne fait pas de chemin.
        let d = Path::new("/tmp/x");
        assert!(chemin(d, &"a".repeat(64), "0123456789abcdef", "flac").is_ok());
        assert!(chemin(d, &"a".repeat(64), "../../etc/passwd", "flac").is_err());
        assert!(chemin(d, "abc", "0123456789abcdef", "flac").is_err());
        assert!(chemin(d, &"a".repeat(64), "0123456789abcdef", "sh").is_err());
    }

    /// Un bruit de pièce (aigus atténués, comme un souffle ou une rumeur), reproductible.
    fn bruit_de_piece(n: usize, amplitude: f32) -> Vec<f32> {
        let blanc = bruit_blanc(n, 1.0);
        let mut y = 0.0_f32;
        let brut: Vec<f32> = blanc.iter().map(|b| {
            y = 0.98 * y + 0.2 * b;
            y
        }).collect();
        let e = rms(&brut) as f32;
        brut.iter().map(|v| v / e * amplitude).collect()
    }

    #[test]
    fn rnnoise_retire_le_bruit_sans_decaler_le_son() {
        // Un son grave et net (une fausse voix) d'une demi-seconde au milieu, sur un bruit de
        // pièce constant à -40 dBFS. Le bruit doit nettement baisser, et le son rester à sa place.
        // (Mesuré le 2026-10-15 : RNNoise baisse un bruit rose ou brun de 30 à 50 dB, mais
        // laisse un souffle blanc fort presque intact ; voir le JOURNAL.)
        let n = FREQUENCE * 3;
        let mut son = bruit_de_piece(n, 0.01);
        let debut = FREQUENCE + 4800;
        for i in debut..debut + FREQUENCE / 2 {
            let t = (i - debut) as f32 / FREQUENCE as f32;
            // Une voyelle grossière : un fondamental à 150 Hz et ses harmoniques.
            son[i] += (1..8).map(|h| (2.0 * std::f32::consts::PI * 150.0 * h as f32 * t).sin() * 0.25 / h as f32).sum::<f32>();
        }
        let sortie = debruiter(&son, 1.0);
        assert_eq!(sortie.len(), n);
        // Le bruit seul (la première seconde, passé le temps d'apprentissage) baisse d'au moins 15 dB.
        let avant = rms(&son[FREQUENCE / 2..FREQUENCE]);
        let apres = rms(&sortie[FREQUENCE / 2..FREQUENCE]);
        let baisse = 20.0 * (avant / apres).log10();
        assert!(baisse > 15.0, "le bruit ne baisse que de {baisse:.1} dB");
        // Le son garde sa place : l'énergie monte au même instant, à 5 ms près.
        let attaque = |v: &[f32]| (0..n / 240).map(|k| (k, rms(&v[k * 240..(k + 1) * 240]))).find(|(_, e)| *e > 0.08).map(|(k, _)| k * 240).unwrap();
        let (a, b) = (attaque(&son), attaque(&sortie));
        assert!((a as i64 - b as i64).abs() <= 240, "le son est décalé : {a} contre {b}");
        // À moitié : entre les deux.
        let moitie = debruiter(&son, 0.5);
        let m = rms(&moitie[FREQUENCE / 2..FREQUENCE]);
        assert!(m < avant && m > apres, "{m} entre {apres} et {avant}");
        // À zéro : rien ne change.
        assert_eq!(debruiter(&son, 0.0), son);
    }

    #[test]
    fn le_gain_final_cale_sans_depasser_la_crete() {
        let n = Niveau { lufs: Some(-30.0), crete: Some(-12.0) };
        assert!((gain_final(&n, Some(-16.0)) - 11.0).abs() < 1e-9, "crête : -12 + 11 = -1");
        assert!((gain_final(&Niveau { lufs: Some(-30.0), crete: Some(-25.0) }, Some(-16.0)) - 14.0).abs() < 1e-9);
        assert_eq!(gain_final(&Niveau { lufs: Some(-20.0), crete: Some(-5.0) }, None), 0.0);
        assert_eq!(gain_final(&Niveau { lufs: None, crete: None }, Some(-16.0)), 0.0);
    }

    #[test]
    fn une_voix_se_nettoie_une_fois_et_se_relit_du_cache() {
        if !ffmpeg_present() {
            eprintln!("ffmpeg absent : essai sauté");
            return;
        }
        let dossier = dossier_de_test("nettoyer");
        // Une « voix » faible (-30 dBFS environ) sur un bruit de fond et un ronflement à 50 Hz.
        let n = FREQUENCE * 4;
        let mut son = bruit_de_piece(n, 0.004);
        for (i, v) in son.iter_mut().enumerate() {
            let t = i as f32 / FREQUENCE as f32;
            *v += 0.03 * (2.0 * std::f32::consts::PI * 50.0 * t).sin();
            if (FREQUENCE..3 * FREQUENCE).contains(&i) {
                *v += (1..8).map(|h| (2.0 * std::f32::consts::PI * 180.0 * h as f32 * t).sin() * 0.04 / h as f32).sum::<f32>();
            }
        }
        let wav = dossier.join("prise.wav");
        let mut f = fs::File::create(&wav).unwrap();
        let octets: Vec<u8> = son.iter().flat_map(|v| ((v * 32767.0) as i16).to_le_bytes()).collect();
        f.write_all(&crate::micro::entete_wav(octets.len() as u32 / 2)).unwrap();
        f.write_all(&octets).unwrap();
        drop(f);
        let ressources = dossier.join("ressources");
        let r = importer(&wav, &ressources, &mut |_| ()).unwrap();
        let avant = r.son.as_ref().unwrap().lufs.unwrap();

        // Voix nette : calée sur -16 LUFS, crête sous -1 dBTP, même durée, copie et onde.
        let t = nettoyer(&ressources, &r.id, &voix_nette()).unwrap();
        assert!((t.lufs.unwrap() - CIBLE_VOIX).abs() < 0.6, "{:?}", t.lufs);
        assert!(t.crete.unwrap() <= CRETE_VOIX + 0.15, "{:?}", t.crete);
        assert!((t.duree as i64 - r.son.as_ref().unwrap().duree as i64).abs() <= 25, "{} contre {}", t.duree, r.son.as_ref().unwrap().duree);
        for ext in ["flac", "webm", "json"] {
            assert!(chemin(&ressources, &r.id, &t.cle, ext).unwrap().exists(), "{ext}");
        }
        let onde: Onde = serde_json::from_slice(&lire_onde(&ressources, &r.id, &t.cle).unwrap()).unwrap();
        assert!((195..=205).contains(&onde.pics.len()), "{}", onde.pics.len());
        // Le ronflement à 50 Hz est coupé : la première seconde (bruit seul) est bien plus calme
        // que la voix, rapportée au même gain.
        let lu = sons::decoder_stereo(&chemin(&ressources, &r.id, &t.cle, "flac").unwrap()).unwrap();
        let mono: Vec<f32> = lu.chunks_exact(2).map(|p| p[0]).collect();
        let fond = rms(&mono[FREQUENCE / 2..FREQUENCE]);
        let voix = rms(&mono[3 * FREQUENCE / 2..5 * FREQUENCE / 2]);
        assert!(20.0 * (voix / fond).log10() > 25.0, "fond {fond}, voix {voix}");
        // L'original n'a pas bougé.
        let original = images::chemin_ressource(&ressources, &r.id, Genre::Original).unwrap();
        assert_eq!(videos::empreinte_fichier(&original).unwrap(), r.id);

        // Relu du cache : rien n'est refait.
        let date = fs::metadata(chemin(&ressources, &r.id, &t.cle, "flac").unwrap()).unwrap().modified().unwrap();
        let encore = nettoyer(&ressources, &r.id, &voix_nette()).unwrap();
        assert_eq!(encore, t);
        assert_eq!(fs::metadata(chemin(&ressources, &r.id, &t.cle, "flac").unwrap()).unwrap().modified().unwrap(), date);

        // Sans calage, la voix garde le niveau qu'elle avait (à 1 dB près).
        let graves = Nettoyage { graves: Some(true), ..Default::default() };
        let g = nettoyer(&ressources, &r.id, &graves).unwrap();
        assert!((g.lufs.unwrap() - avant).abs() < 1.0, "{:?} contre {avant}", g.lufs);
        assert_ne!(g.cle, t.cle);

        // Purger garde ce qui sert encore, efface le reste (trois fichiers par version).
        assert_eq!(purger(&ressources, &[(r.id.clone(), voix_nette())]), 3);
        assert!(chemin(&ressources, &r.id, &t.cle, "flac").unwrap().exists());
        assert!(!chemin(&ressources, &r.id, &g.cle, "flac").unwrap().exists());
        // Un fichier étranger au cache n'est jamais touché.
        fs::write(ressources.join(DOSSIER).join("autre.txt"), b"x").unwrap();
        assert_eq!(purger(&ressources, &[]), 3);
        assert!(ressources.join(DOSSIER).join("autre.txt").exists());
        fs::remove_dir_all(&dossier).unwrap();
    }
}
