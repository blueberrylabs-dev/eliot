//! Le pont vers une IA (BRIEF § 6, « Brancher une IA »). Quand Alexandre l'active dans les
//! réglages, Eliot écoute sur un fichier de communication local (socket Unix) réservé à son
//! utilisateur ; le programme `eliot-mcp`, lancé par l'application Claude, y relaie les appels
//! d'outils. Chaque appel part vers l'interface (événement `ia-appel`), qui l'exécute avec les
//! actions du store et répond par la commande `ia_repondre`.
//!
//! Protocole : une ligne JSON par message. Demande : `{"id", "outil", "arguments"}`. Réponse :
//! `{"id", "ok", "resultat"}` ou `{"id", "ok": false, "erreur"}`.

use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::os::unix::fs::PermissionsExt;
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tauri::{AppHandle, Emitter, Manager};

/// Délai laissé à l'interface pour exécuter un outil (une capture ou un export en image
/// prennent quelques secondes au plus).
const DELAI_REPONSE: Duration = Duration::from_secs(120);

/// Un export en MP4 ou en GIF fait le film image par image : plusieurs minutes pour une vidéo
/// longue.
const DELAI_FILM: Duration = Duration::from_secs(1800);

/// Le délai d'un outil : celui d'un film pour un export en MP4 ou en GIF, et pour un détourage
/// (étape 5, lot 7 : le modèle sur le processeur d'une petite machine peut dépasser deux minutes).
pub fn delai_pour(outil: &str, arguments: &Value) -> Duration {
    let long = (outil == "exporter" && matches!(arguments.get("format").and_then(Value::as_str), Some("mp4" | "gif"))) || outil == "detourer";
    if long { DELAI_FILM } else { DELAI_REPONSE }
}

/// `eliot-mcp/src/main.rs` essaie ce chemin, et aussi `/run/user/<uid>` quand le client MCP
/// le lance sans `XDG_RUNTIME_DIR` (cas de l'application Claude).
pub fn chemin_socket() -> PathBuf {
    let base = std::env::var_os("XDG_RUNTIME_DIR")
        .map(PathBuf::from)
        .filter(|d| d.is_dir())
        .unwrap_or_else(|| std::env::var_os("HOME").map(PathBuf::from).unwrap_or_else(std::env::temp_dir).join(".cache"));
    base.join("eliot").join("eliot.sock")
}

#[derive(Default, Serialize, Deserialize, Clone)]
pub struct Reglages {
    #[serde(default)]
    pub ia_active: bool,
}

fn chemin_reglages(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("reglages.json"))
}

pub fn lire_reglages(app: &AppHandle) -> Reglages {
    chemin_reglages(app)
        .and_then(|c| fs::read(c).ok())
        .and_then(|o| serde_json::from_slice(&o).ok())
        .unwrap_or_default()
}

fn ecrire_reglages(app: &AppHandle, reglages: &Reglages) -> Result<(), String> {
    let chemin = chemin_reglages(app).ok_or("dossier de configuration introuvable")?;
    if let Some(dossier) = chemin.parent() {
        fs::create_dir_all(dossier).map_err(|e| e.to_string())?;
    }
    let octets = serde_json::to_vec_pretty(reglages).map_err(|e| e.to_string())?;
    noyau::fichiers::ecrire_atomiquement(&chemin, &octets).map_err(|e| e.to_string())
}

type Attentes = Arc<Mutex<HashMap<u64, mpsc::Sender<Value>>>>;

#[derive(Default)]
pub struct PontIa {
    arret: Mutex<Option<Arc<AtomicBool>>>,
    attentes: Attentes,
    compteur: Arc<AtomicU64>,
    /// L'interface écoute les appels : au lancement, le fichier de communication s'ouvre avant
    /// que la fenêtre ait fini de charger ; un appel arrivé trop tôt attend ce signal.
    interface_prete: Arc<AtomicBool>,
}

/// Temps laissé à la fenêtre pour finir de se charger quand un appel arrive au lancement.
const DELAI_DEMARRAGE: Duration = Duration::from_secs(30);

#[derive(Deserialize)]
struct Demande {
    id: Value,
    outil: String,
    #[serde(default)]
    arguments: Value,
}

#[derive(Serialize, Clone)]
struct AppelIa {
    id: u64,
    outil: String,
    arguments: Value,
}

/// Une connexion d'`eliot-mcp` : on lit les demandes une à une, on attend la réponse de
/// l'interface, on la renvoie.
/// Attend que l'interface écoute, au plus `DELAI_DEMARRAGE`.
fn attendre_interface(prete: &AtomicBool) -> bool {
    let debut = std::time::Instant::now();
    while !prete.load(Ordering::Relaxed) {
        if debut.elapsed() > DELAI_DEMARRAGE {
            return false;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    true
}

fn servir(app: AppHandle, flux: UnixStream, attentes: Attentes, compteur: Arc<AtomicU64>, prete: Arc<AtomicBool>) {
    let Ok(lecture) = flux.try_clone() else { return };
    let mut ecriture = flux;
    for ligne in BufReader::new(lecture).lines() {
        let Ok(ligne) = ligne else { break };
        if ligne.trim().is_empty() {
            continue;
        }
        let reponse = match serde_json::from_str::<Demande>(&ligne) {
            Err(e) => json!({ "id": null, "ok": false, "erreur": format!("demande illisible : {e}") }),
            Ok(demande) => {
                let interne = compteur.fetch_add(1, Ordering::Relaxed);
                let (envoi, reception) = mpsc::channel();
                attentes.lock().unwrap_or_else(|e| e.into_inner()).insert(interne, envoi);
                let delai = delai_pour(&demande.outil, &demande.arguments);
                let appel = AppelIa { id: interne, outil: demande.outil, arguments: demande.arguments };
                let resultat = if !attendre_interface(&prete) {
                    json!({ "ok": false, "erreur": "Eliot finit de démarrer : réessaie dans quelques secondes" })
                } else {
                    match app.emit("ia-appel", appel) {
                    Err(e) => json!({ "ok": false, "erreur": format!("interface injoignable : {e}") }),
                    Ok(()) => reception
                        .recv_timeout(delai)
                        .unwrap_or_else(|_| json!({ "ok": false, "erreur": "Eliot n'a pas répondu à temps" })),
                    }
                };
                attentes.lock().unwrap_or_else(|e| e.into_inner()).remove(&interne);
                let mut objet = resultat;
                objet["id"] = demande.id;
                objet
            }
        };
        let mut texte = reponse.to_string();
        texte.push('\n');
        if ecriture.write_all(texte.as_bytes()).is_err() {
            break;
        }
    }
}

/// Ouvre le fichier de communication. Un fichier resté d'une session précédente est remplacé ;
/// si une autre fenêtre d'Eliot écoute déjà, on s'arrête là.
pub fn demarrer(app: &AppHandle) -> Result<PathBuf, String> {
    let pont = app.state::<PontIa>();
    let mut arret = pont.arret.lock().unwrap_or_else(|e| e.into_inner());
    let chemin = chemin_socket();
    if arret.is_some() {
        return Ok(chemin);
    }
    let dossier = chemin.parent().ok_or("chemin du pont sans dossier")?;
    fs::create_dir_all(dossier).map_err(|e| format!("dossier du pont : {e}"))?;
    fs::set_permissions(dossier, fs::Permissions::from_mode(0o700)).map_err(|e| e.to_string())?;
    if chemin.exists() {
        if UnixStream::connect(&chemin).is_ok() {
            return Err("une autre fenêtre d'Eliot a déjà le pont IA".into());
        }
        fs::remove_file(&chemin).map_err(|e| e.to_string())?;
    }
    let ecoute = UnixListener::bind(&chemin).map_err(|e| format!("pont IA : {e}"))?;
    fs::set_permissions(&chemin, fs::Permissions::from_mode(0o600)).map_err(|e| e.to_string())?;
    ecoute.set_nonblocking(true).map_err(|e| e.to_string())?;

    let drapeau = Arc::new(AtomicBool::new(false));
    *arret = Some(drapeau.clone());
    let (app, attentes, compteur, prete, chemin_fil) = (app.clone(), pont.attentes.clone(), pont.compteur.clone(), pont.interface_prete.clone(), chemin.clone());
    std::thread::spawn(move || {
        while !drapeau.load(Ordering::Relaxed) {
            match ecoute.accept() {
                Ok((flux, _)) => {
                    let _ = flux.set_nonblocking(false);
                    let (app, attentes, compteur, prete) = (app.clone(), attentes.clone(), compteur.clone(), prete.clone());
                    std::thread::spawn(move || servir(app, flux, attentes, compteur, prete));
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => std::thread::sleep(Duration::from_millis(100)),
                Err(_) => std::thread::sleep(Duration::from_millis(500)),
            }
        }
        let _ = fs::remove_file(&chemin_fil);
    });
    Ok(chemin)
}

pub fn arreter(app: &AppHandle) {
    let pont = app.state::<PontIa>();
    if let Some(drapeau) = pont.arret.lock().unwrap_or_else(|e| e.into_inner()).take() {
        drapeau.store(true, Ordering::Relaxed);
    }
}

/// Au lancement : le pont s'ouvre si Alexandre l'a laissé activé.
pub fn au_demarrage(app: &AppHandle) {
    if lire_reglages(app).ia_active {
        if let Err(e) = demarrer(app) {
            eprintln!("pont IA non ouvert : {e}");
        }
    }
}

/// Le programme `eliot-mcp` compilé à côté de l'application (développement).
fn chemin_binaire() -> PathBuf {
    let chemin = PathBuf::from(concat!(env!("CARGO_MANIFEST_DIR"), "/../eliot-mcp/target/release/eliot-mcp"));
    chemin.canonicalize().unwrap_or(chemin)
}

#[derive(Serialize)]
pub struct InfosIa {
    active: bool,
    ecoute: bool,
    socket: String,
    binaire: String,
    binaire_present: bool,
}

fn infos(app: &AppHandle) -> InfosIa {
    let binaire = chemin_binaire();
    InfosIa {
        active: lire_reglages(app).ia_active,
        ecoute: app.state::<PontIa>().arret.lock().unwrap_or_else(|e| e.into_inner()).is_some(),
        socket: chemin_socket().to_string_lossy().into_owned(),
        binaire_present: binaire.is_file(),
        binaire: binaire.to_string_lossy().into_owned(),
    }
}

#[tauri::command]
pub fn ia_infos(app: AppHandle) -> InfosIa {
    infos(&app)
}

#[tauri::command]
pub fn ia_activer(app: AppHandle, active: bool) -> Result<InfosIa, String> {
    ecrire_reglages(&app, &Reglages { ia_active: active })?;
    if active {
        demarrer(&app)?;
    } else {
        arreter(&app);
    }
    Ok(infos(&app))
}

/// Réponse de l'interface à un appel d'outil.
/// L'interface signale qu'elle écoute les appels de l'IA.
#[tauri::command]
pub fn ia_pret(app: AppHandle) {
    app.state::<PontIa>().interface_prete.store(true, Ordering::Relaxed);
}

#[tauri::command]
pub fn ia_repondre(app: AppHandle, id: u64, ok: bool, resultat: Value, erreur: Option<String>) {
    let pont = app.state::<PontIa>();
    let envoi = pont.attentes.lock().unwrap_or_else(|e| e.into_inner()).remove(&id);
    if let Some(envoi) = envoi {
        let message = if ok { json!({ "ok": true, "resultat": resultat }) } else { json!({ "ok": false, "erreur": erreur.unwrap_or_default() }) };
        let _ = envoi.send(message);
    }
}
