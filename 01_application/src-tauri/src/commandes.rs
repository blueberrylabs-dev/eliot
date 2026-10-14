//! Les commandes que l'interface peut appeler. Chacune est `async` : une commande synchrone
//! tournerait sur le fil principal et gèlerait la fenêtre (doc Tauri, BRIEF § 4).

use std::path::PathBuf;

use noyau::{export, images};
use percent_encoding::percent_decode_str;
use serde::Serialize;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager};

/// `~/.local/share/fr.alexandredo.eliot/ressources` : originaux, aperçus, miniatures.
fn dossier_ressources(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|d| d.join("ressources"))
        .map_err(|e| format!("dossier des données introuvable : {e}"))
}

/// Le dossier Images de l'utilisateur (`~/Images` sur un Ubuntu en français), puis `Eliot/`.
fn dossier_export_par_defaut(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .picture_dir()
        .or_else(|_| app.path().home_dir())
        .map_err(|e| format!("dossier Images introuvable : {e}"))?;
    Ok(base.join("Eliot"))
}

/// En-tête d'une requête binaire ; les valeurs arrivent encodées (`encodeURIComponent`) pour
/// laisser passer les accents.
fn entete(requete: &Request<'_>, nom: &str) -> Option<String> {
    requete
        .headers()
        .get(nom)
        .and_then(|v| v.to_str().ok())
        .map(|v| percent_decode_str(v).decode_utf8_lossy().into_owned())
}

fn corps_brut(requete: &Request<'_>) -> Result<Vec<u8>, String> {
    match requete.body() {
        InvokeBody::Raw(octets) => Ok(octets.clone()),
        _ => Err("corps binaire attendu".to_string()),
    }
}

#[derive(Serialize)]
pub struct ResultatImport {
    chemin: String,
    ressource: Option<images::Ressource>,
    erreur: Option<String>,
}

/// Importe des fichiers choisis dans le sélecteur natif : le noyau lit les fichiers lui-même,
/// l'image ne passe jamais par l'interface. Plusieurs fichiers sont traités en parallèle.
#[tauri::command]
pub async fn importer_images(app: AppHandle, chemins: Vec<String>) -> Result<Vec<ResultatImport>, String> {
    let dossier = dossier_ressources(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let liste: Vec<PathBuf> = chemins.iter().map(PathBuf::from).collect();
        images::importer_plusieurs(&liste, &dossier)
            .into_iter()
            .zip(chemins)
            .map(|(resultat, chemin)| match resultat {
                Ok(ressource) => ResultatImport { chemin, ressource: Some(ressource), erreur: None },
                Err(e) => ResultatImport { chemin, ressource: None, erreur: Some(e.to_string()) },
            })
            .collect()
    })
    .await
    .map_err(|e| format!("import interrompu : {e}"))
}

/// Importe une image reçue en octets (collage depuis le presse-papiers, par exemple).
#[tauri::command]
pub async fn importer_image_octets(app: AppHandle, requete: Request<'_>) -> Result<images::Ressource, String> {
    let octets = corps_brut(&requete)?;
    let nom = entete(&requete, "x-nom").unwrap_or_else(|| "image".to_string());
    let dossier = dossier_ressources(&app)?;
    tauri::async_runtime::spawn_blocking(move || images::importer(&octets, &nom, &dossier).map_err(|e| e.to_string()))
        .await
        .map_err(|e| format!("import interrompu : {e}"))?
}

/// Renvoie l'aperçu ou la miniature d'une ressource, en octets bruts.
#[tauri::command]
pub async fn lire_ressource(app: AppHandle, id: String, genre: String) -> Result<Response, String> {
    let genre = match genre.as_str() {
        "apercu" => images::Genre::Apercu,
        "miniature" => images::Genre::Miniature,
        autre => return Err(format!("genre inconnu : {autre}")),
    };
    let dossier = dossier_ressources(&app)?;
    let chemin = images::chemin_ressource(&dossier, &id, genre).map_err(|e| e.to_string())?;
    let octets = tauri::async_runtime::spawn_blocking(move || std::fs::read(chemin))
        .await
        .map_err(|e| format!("lecture interrompue : {e}"))?
        .map_err(|e| format!("lecture impossible : {e}"))?;
    Ok(Response::new(octets))
}

/// Écrit un rendu exporté. Corps : les octets du fichier. En-têtes : `x-format` (png, jpeg),
/// `x-nom` (nom suggéré) et, pour « Enregistrer sous », `x-chemin`.
#[tauri::command]
pub async fn exporter_rendu(app: AppHandle, requete: Request<'_>) -> Result<String, String> {
    let octets = corps_brut(&requete)?;
    let format = export::Format::depuis_nom(&entete(&requete, "x-format").unwrap_or_default())
        .map_err(|e| e.to_string())?;
    let nom = entete(&requete, "x-nom").unwrap_or_else(|| "eliot".to_string());
    let chemin_choisi = entete(&requete, "x-chemin").filter(|c| !c.is_empty()).map(PathBuf::from);
    let dossier = dossier_export_par_defaut(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        export::exporter(&octets, format, &dossier, &nom, chemin_choisi.as_deref())
            .map(|chemin| chemin.to_string_lossy().into_owned())
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("export interrompu : {e}"))?
}

#[tauri::command]
pub fn dossier_export(app: AppHandle) -> Result<String, String> {
    dossier_export_par_defaut(&app).map(|p| p.to_string_lossy().into_owned())
}

/// Essai automatique, en développement seulement : la variable `ELIOT_AUTOTEST` donne le
/// chemin d'une image à importer. Inactif dans la version compilée pour de bon.
#[tauri::command]
pub fn autotest_demande() -> Option<String> {
    if cfg!(debug_assertions) { std::env::var("ELIOT_AUTOTEST").ok() } else { None }
}

#[tauri::command]
pub fn autotest_rapport(texte: String) -> Result<(), String> {
    if !cfg!(debug_assertions) {
        return Err("indisponible".to_string());
    }
    let chemin = std::env::temp_dir().join("eliot_autotest.json");
    std::fs::write(&chemin, texte).map_err(|e| e.to_string())
}
