//! La voix de synthèse (étape 4, lot 6) : Piper, sur le processeur (règle 9 : jamais l'option
//! `--cuda`). Piper est un programme à part (dépôt `OHF-Voice/piper1-gpl`, GPL-3.0), installé
//! par Alexandre (`uv tool install piper-tts`, commande du CLAUDE.md) ; Eliot le lance comme
//! il lance `ffmpeg`. Les voix sont des fichiers téléchargés une fois : pour chaque voix, le
//! modèle `<nom>.onnx`, sa configuration `<nom>.onnx.json` et, à côté, sa fiche `MODEL_CARD`
//! (d'où viennent ses données, sous quelle licence).
//!
//! Le son de Piper est calé sur -16 LUFS (le niveau d'une voix, comme « Voix nette »), puis
//! gardé en cache le temps de l'écouter et de l'ajouter au design.

use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use thiserror::Error;

use crate::fichiers::chemin_temporaire;
use crate::micro;
use crate::sons::{self, ErreurSon};
use crate::voix::{self, CIBLE_VOIX};

/// Le texte le plus long accepté d'un coup (environ trois minutes de parole).
pub const TEXTE_MAX: usize = 3000;

#[derive(Debug, Error)]
pub enum ErreurPiper {
    #[error("Piper n'est pas installé : commande 16 du CLAUDE.md (uv tool install piper-tts)")]
    Absent,
    #[error("aucune voix trouvée : télécharge-en une (commande 17 du CLAUDE.md)")]
    SansVoix,
    #[error("voix inconnue : {0}")]
    VoixInconnue(String),
    #[error("le texte est vide")]
    TexteVide,
    #[error("le texte est trop long ({0} caractères, {TEXTE_MAX} au plus) : coupe-le en plusieurs voix")]
    TexteTropLong(usize),
    #[error("Piper a échoué : {0}")]
    Echec(String),
    #[error(transparent)]
    Son(#[from] ErreurSon),
    #[error("lecture impossible : {0}")]
    Lecture(#[from] io::Error),
}

/// Une voix, telle que la fenêtre la montre.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VoixPiper {
    /// `fr_FR-siwis-medium`, ou `fr_FR-upmc-medium#pierre` pour un locuteur d'un modèle qui en a
    /// plusieurs.
    pub id: String,
    /// `siwis`, `upmc, pierre`.
    pub nom: String,
    /// `fr_FR`.
    pub langue: String,
    /// `x_low`, `low`, `medium` ou `high`.
    pub qualite: String,
    /// La licence des données de la voix, lue dans sa fiche (`CC BY 4.0`, `CC BY-SA 4.0`, etc.).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub licence: Option<String>,
    /// La page des données de la voix.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub donnees: Option<String>,
}

/// Une voix trouvée sur le disque.
#[derive(Debug, Clone)]
pub struct VoixTrouvee {
    pub voix: VoixPiper,
    pub modele: PathBuf,
    pub configuration: PathBuf,
    pub locuteur: Option<u64>,
}

/// Les dossiers où chercher les voix : `telechargements/voix/` du dépôt (en remontant depuis un
/// dossier de départ, en développement), puis `voix/` dans le dossier des données d'Eliot.
pub fn dossiers_de_voix(depart: &Path, donnees: Option<&Path>) -> Vec<PathBuf> {
    let mut d: Vec<PathBuf> = depart.ancestors().take(6).map(|a| a.join("telechargements").join("voix")).filter(|p| p.is_dir()).collect();
    if let Some(x) = donnees {
        d.push(x.join("voix"));
    }
    d
}

/// Normalise la licence lue dans une fiche de voix.
pub fn licence_lisible(brute: &str) -> String {
    let b = brute.trim().trim_end_matches('/');
    let bas = b.to_lowercase();
    if let Some(i) = bas.find("creativecommons.org/licenses/") {
        let reste: Vec<&str> = bas[i + "creativecommons.org/licenses/".len()..].split('/').collect();
        if let (Some(genre), Some(version)) = (reste.first(), reste.get(1)) {
            return format!("CC {} {version}", genre.to_uppercase());
        }
    }
    if bas.contains("publicdomain/zero") || bas == "cc0" || bas.starts_with("cc0 ") || bas.starts_with("cc0-") {
        return "CC0".into();
    }
    b.replace("CC-BY-SA", "CC BY-SA").replace("CC-BY", "CC BY")
}

/// Lit la fiche d'une voix (`MODEL_CARD`) : la licence et la page de ses données.
pub fn lire_fiche(texte: &str) -> (Option<String>, Option<String>) {
    let mut licence = None;
    let mut donnees = None;
    for ligne in texte.lines() {
        let l = ligne.trim().trim_start_matches(['*', '-']).trim();
        if let Some(v) = l.strip_prefix("License:") {
            licence = Some(licence_lisible(v));
        } else if let Some(v) = l.strip_prefix("URL:") {
            let v = v.trim();
            if v.starts_with("http") && donnees.is_none() {
                donnees = Some(v.to_string());
            }
        }
    }
    (licence, donnees)
}

fn modeles_dans(dossier: &Path, profondeur: usize, trouves: &mut Vec<PathBuf>) {
    let Ok(entrees) = fs::read_dir(dossier) else { return };
    let mut entrees: Vec<PathBuf> = entrees.flatten().map(|e| e.path()).collect();
    entrees.sort();
    for p in entrees {
        if p.is_dir() && profondeur > 0 {
            modeles_dans(&p, profondeur - 1, trouves);
        } else if p.extension().is_some_and(|e| e == "onnx") {
            trouves.push(p);
        }
    }
}

/// Les voix des dossiers donnés, les françaises d'abord. Un modèle sans sa configuration est
/// ignoré ; un modèle à plusieurs locuteurs (jusqu'à dix) donne une voix par locuteur.
pub fn lister_voix(dossiers: &[PathBuf]) -> Vec<VoixTrouvee> {
    let mut modeles = Vec::new();
    for d in dossiers {
        modeles_dans(d, 2, &mut modeles);
    }
    let mut liste = Vec::new();
    for modele in modeles {
        let configuration = PathBuf::from(format!("{}.json", modele.display()));
        let Ok(texte) = fs::read_to_string(&configuration) else { continue };
        let Ok(config) = serde_json::from_str::<Value>(&texte) else { continue };
        let base = modele.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
        let langue = config.pointer("/language/code").and_then(Value::as_str).map(str::to_string).unwrap_or_else(|| base.split('-').next().unwrap_or("").to_string());
        let qualite = config.pointer("/audio/quality").and_then(Value::as_str).map(str::to_string).unwrap_or_else(|| base.rsplit('-').next().unwrap_or("").to_string());
        let jeu = config.get("dataset").and_then(Value::as_str).map(str::to_string).unwrap_or_else(|| base.split('-').nth(1).unwrap_or(&base).to_string());
        let fiche = modele.parent().map(|p| p.join("MODEL_CARD")).and_then(|p| fs::read_to_string(p).ok()).unwrap_or_default();
        let (licence, donnees) = lire_fiche(&fiche);
        let mut locuteurs: Vec<(String, u64)> = config
            .get("speaker_id_map")
            .and_then(Value::as_object)
            .map(|m| m.iter().filter_map(|(k, v)| v.as_u64().map(|n| (k.clone(), n))).collect())
            .unwrap_or_default();
        locuteurs.sort_by_key(|(_, n)| *n);
        let commune = |id: String, nom: String, locuteur| VoixTrouvee {
            voix: VoixPiper { id, nom, langue: langue.clone(), qualite: qualite.clone(), licence: licence.clone(), donnees: donnees.clone() },
            modele: modele.clone(),
            configuration: configuration.clone(),
            locuteur,
        };
        if locuteurs.len() > 1 && locuteurs.len() <= 10 {
            for (nom, n) in locuteurs {
                liste.push(commune(format!("{base}#{nom}"), format!("{jeu}, {nom}"), Some(n)));
            }
        } else {
            liste.push(commune(base.clone(), jeu.clone(), None));
        }
    }
    liste.sort_by(|a, b| (!a.voix.langue.starts_with("fr"), &a.voix.id).cmp(&(!b.voix.langue.starts_with("fr"), &b.voix.id)));
    liste.dedup_by(|a, b| a.voix.id == b.voix.id);
    liste
}

/// Le programme `piper` : `ELIOT_PIPER` s'il est donné, sinon dans le `PATH`, sinon dans
/// `~/.local/bin` (où `uv tool install` le range).
pub fn trouver_piper() -> Option<PathBuf> {
    if let Some(p) = std::env::var_os("ELIOT_PIPER").map(PathBuf::from) {
        return p.is_file().then_some(p);
    }
    let mut dossiers: Vec<PathBuf> = std::env::var_os("PATH").map(|p| std::env::split_paths(&p).collect()).unwrap_or_default();
    if let Some(maison) = std::env::var_os("HOME") {
        dossiers.push(PathBuf::from(maison).join(".local").join("bin"));
    }
    dossiers.into_iter().map(|d| d.join("piper")).find(|p| p.is_file())
}

/// Le texte tel que Piper le lira : espaces et retours à la ligne ramenés à une espace.
pub fn texte_propre(texte: &str) -> Result<String, ErreurPiper> {
    let t = texte.split_whitespace().collect::<Vec<_>>().join(" ");
    if t.is_empty() {
        return Err(ErreurPiper::TexteVide);
    }
    let n = t.chars().count();
    if n > TEXTE_MAX {
        return Err(ErreurPiper::TexteTropLong(n));
    }
    Ok(t)
}

/// Fait dire `texte` à la voix, à la vitesse `vitesse` (1 : normale ; 1,2 : plus vite), dans le
/// fichier WAV `sortie`, tel que Piper le rend.
fn dire(piper: &Path, voix: &VoixTrouvee, texte: &str, vitesse: f64, sortie: &Path) -> Result<(), ErreurPiper> {
    let mut c = Command::new(piper);
    c.arg("-m").arg(&voix.modele).arg("-c").arg(&voix.configuration).arg("-f").arg(sortie);
    c.args(["--length-scale", &format!("{:.3}", 1.0 / vitesse.clamp(0.5, 2.0)), "--sentence-silence", "0.25"]);
    if let Some(n) = voix.locuteur {
        c.args(["-s", &n.to_string()]);
    }
    let mut processus = c.stdin(Stdio::piped()).stdout(Stdio::null()).stderr(Stdio::piped()).spawn().map_err(|e| if e.kind() == io::ErrorKind::NotFound { ErreurPiper::Absent } else { ErreurPiper::Lecture(e) })?;
    let mut erreur = processus.stderr.take().expect("stderr redirigé");
    let lecteur = std::thread::spawn(move || {
        let mut t = String::new();
        let _ = erreur.read_to_string(&mut t);
        t
    });
    {
        let mut entree = processus.stdin.take().expect("entrée redirigée");
        entree.write_all(texte.as_bytes())?;
        entree.write_all(b"\n")?;
    }
    let statut = processus.wait()?;
    let t = lecteur.join().unwrap_or_default();
    if !statut.success() || !sortie.is_file() {
        let ligne = t.lines().rev().find(|l| !l.trim().is_empty()).unwrap_or("échec sans message");
        return Err(ErreurPiper::Echec(ligne.to_string()));
    }
    Ok(())
}

/// Le fichier en cache d'un texte dit par une voix, calé sur -16 LUFS (WAV stéréo, 48 kHz, 16 bits) :
/// fait au premier appel, relu ensuite (écouter puis ajouter ne fait parler Piper qu'une fois).
pub fn preparer(piper: &Path, voix: &VoixTrouvee, texte: &str, vitesse: f64, cache: &Path) -> Result<PathBuf, ErreurPiper> {
    let texte = texte_propre(texte)?;
    let vitesse = (vitesse.clamp(0.5, 2.0) * 100.0).round() / 100.0;
    let somme: String = Sha256::digest(format!("{}\n{vitesse:.2}\n{texte}", voix.voix.id).as_bytes()).iter().take(12).map(|o| format!("{o:02x}")).collect();
    fs::create_dir_all(cache)?;
    let final_ = cache.join(format!("{somme}.wav"));
    if final_.is_file() {
        return Ok(final_);
    }
    let brut = chemin_temporaire(&cache.join(format!("{somme}-piper.wav")))?;
    let resultat = (|| -> Result<(), ErreurPiper> {
        dire(piper, voix, &texte, vitesse, &brut)?;
        // En stéréo, tel qu'il s'entendra : la mesure et le fichier sont le même son (un fichier
        // mono serait encore baissé de 3 dB en passant sur deux canaux).
        let stereo = sons::decoder_stereo(&brut)?;
        let gain = 10f64.powf(voix::gain_final(&sons::mesurer(&stereo), Some(CIBLE_VOIX)) / 20.0) as f32;
        let octets: Vec<u8> = stereo.iter().flat_map(|v| (((v * gain).clamp(-1.0, 1.0) * 32767.0).round() as i16).to_le_bytes()).collect();
        let tmp = chemin_temporaire(&final_)?;
        let mut f = fs::File::create(&tmp)?;
        f.write_all(&micro::entete_wav_canaux((octets.len() / 4) as u32, 2))?;
        f.write_all(&octets)?;
        f.sync_all()?;
        fs::rename(&tmp, &final_)?;
        Ok(())
    })();
    let _ = fs::remove_file(&brut);
    resultat.map(|()| final_)
}

/// Le nom d'un son de synthèse : le début de son texte.
pub fn nom_du_son(texte: &str) -> String {
    let t = texte.split_whitespace().collect::<Vec<_>>().join(" ");
    let court: String = t.chars().take(40).collect();
    if t.chars().count() > 40 { format!("{}…", court.trim_end()) } else { court }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dossier_de_test(nom: &str) -> PathBuf {
        let dossier = std::env::temp_dir().join(format!("eliot-piper-{nom}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dossier);
        fs::create_dir_all(&dossier).unwrap();
        dossier
    }

    #[test]
    fn les_fiches_et_les_licences_se_lisent() {
        let fiche = "# Model card for upmc (medium)\n\n* Language: fr_FR\n\n## Dataset\n\n* URL: https://github.com/marytts/upmc-pierre-data\n* License: http://creativecommons.org/licenses/by-sa/4.0/\n";
        assert_eq!(lire_fiche(fiche), (Some("CC BY-SA 4.0".into()), Some("https://github.com/marytts/upmc-pierre-data".into())));
        assert_eq!(licence_lisible("CC-BY 4.0"), "CC BY 4.0");
        assert_eq!(licence_lisible("CC0"), "CC0");
        assert_eq!(licence_lisible("AGPLv3"), "AGPLv3");
        assert_eq!(lire_fiche(""), (None, None));
        assert_eq!(texte_propre("  Bonjour,\n\n  le monde.  ").unwrap(), "Bonjour, le monde.");
        assert!(matches!(texte_propre(" \n "), Err(ErreurPiper::TexteVide)));
        assert!(matches!(texte_propre(&"a ".repeat(2000)), Err(ErreurPiper::TexteTropLong(_))));
        assert_eq!(nom_du_son("Une phrase courte."), "Une phrase courte.");
        assert_eq!(nom_du_son(&"mot ".repeat(30)).chars().count(), 40);
    }

    #[test]
    fn les_voix_se_trouvent_avec_leurs_locuteurs() {
        let d = dossier_de_test("liste");
        let une = d.join("fr_FR-siwis-medium");
        fs::create_dir_all(&une).unwrap();
        fs::write(une.join("fr_FR-siwis-medium.onnx"), b"modele").unwrap();
        fs::write(une.join("fr_FR-siwis-medium.onnx.json"), r#"{"audio":{"sample_rate":22050,"quality":"medium"},"language":{"code":"fr_FR"},"dataset":"siwis","num_speakers":1,"speaker_id_map":{}}"#).unwrap();
        fs::write(une.join("MODEL_CARD"), "* URL: https://datashare.is.ed.ac.uk/handle/10283/2353\n* License: CC-BY 4.0\n").unwrap();
        let deux = d.join("fr_FR-upmc-medium");
        fs::create_dir_all(&deux).unwrap();
        fs::write(deux.join("fr_FR-upmc-medium.onnx"), b"modele").unwrap();
        fs::write(deux.join("fr_FR-upmc-medium.onnx.json"), r#"{"audio":{"quality":"medium"},"language":{"code":"fr_FR"},"dataset":"upmc","num_speakers":2,"speaker_id_map":{"pierre":1,"jessica":0}}"#).unwrap();
        // Un modèle sans configuration est ignoré, une voix anglaise passe après.
        fs::write(d.join("seul.onnx"), b"x").unwrap();
        fs::write(d.join("en_US-lessac-low.onnx"), b"x").unwrap();
        fs::write(d.join("en_US-lessac-low.onnx.json"), r#"{"language":{"code":"en_US"},"dataset":"lessac","audio":{"quality":"low"}}"#).unwrap();
        let v = lister_voix(&[d.clone()]);
        let ids: Vec<&str> = v.iter().map(|x| x.voix.id.as_str()).collect();
        assert_eq!(ids, ["fr_FR-siwis-medium", "fr_FR-upmc-medium#jessica", "fr_FR-upmc-medium#pierre", "en_US-lessac-low"]);
        assert_eq!(v[0].voix.licence.as_deref(), Some("CC BY 4.0"));
        assert_eq!(v[2].voix.nom, "upmc, pierre");
        assert_eq!(v[2].locuteur, Some(1));
        assert_eq!(v[3].voix.licence, None);
        assert!(lister_voix(&[d.join("absent")]).is_empty());
        fs::remove_dir_all(&d).unwrap();
    }

    /// Avec un vrai Piper et une vraie voix (dans le conteneur de Claude : `ELIOT_PIPER` et
    /// `ELIOT_VOIX_ESSAI`), la voix parle, calée sur -16 LUFS, et se relit du cache.
    #[test]
    fn piper_parle_si_il_est_la() {
        let (Some(piper), Some(dossier)) = (trouver_piper(), std::env::var_os("ELIOT_VOIX_ESSAI").map(PathBuf::from)) else {
            eprintln!("Piper ou voix d'essai absents : essai sauté");
            return;
        };
        let voix = lister_voix(&[dossier]).into_iter().find(|v| v.voix.langue == "fr_FR").expect("une voix française");
        let cache = dossier_de_test("cache");
        let f = preparer(&piper, &voix, "Bonjour, voici la voix d'Eliot.", 1.0, &cache).unwrap();
        let duree = sons::sonder(&f).unwrap();
        assert!((1000..6000).contains(&duree), "{duree} ms");
        let n = sons::mesurer(&sons::decoder_stereo(&f).unwrap());
        assert!((n.lufs.unwrap() - CIBLE_VOIX).abs() < 0.5 || n.crete.unwrap() > -1.3, "{n:?}");
        let date = fs::metadata(&f).unwrap().modified().unwrap();
        assert_eq!(preparer(&piper, &voix, "Bonjour,   voici la voix d'Eliot.", 1.0, &cache).unwrap(), f);
        assert_eq!(fs::metadata(&f).unwrap().modified().unwrap(), date);
        // Plus vite, c'est plus court.
        let vite = preparer(&piper, &voix, "Bonjour, voici la voix d'Eliot.", 1.5, &cache).unwrap();
        assert!(sons::sonder(&vite).unwrap() < duree, "plus vite mais pas plus court");
        fs::remove_dir_all(&cache).unwrap();
    }
}
