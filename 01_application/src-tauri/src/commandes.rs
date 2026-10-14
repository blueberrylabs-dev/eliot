//! Les commandes que l'interface peut appeler. Chacune est `async` : une commande synchrone
//! tournerait sur le fil principal et gèlerait la fenêtre (doc Tauri, BRIEF § 4). Le travail
//! sur le disque part sur un fil à part (`spawn_blocking`).

use std::path::PathBuf;
use std::sync::Mutex;

use noyau::{export, images, projet};
use percent_encoding::percent_decode_str;
use serde::Serialize;
use serde_json::Value;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager};

/// Une seule opération à la fois sur les designs : un enregistrement automatique ne croise
/// jamais un renommage du même dossier.
#[derive(Default)]
pub struct VerrouProjets(Mutex<()>);

/// `~/Documents/Eliot` (le dossier Documents de l'utilisateur, sinon le dossier personnel).
fn racine(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .document_dir()
        .or_else(|_| app.path().home_dir())
        .map_err(|e| format!("dossier Documents introuvable : {e}"))?;
    Ok(base.join("Eliot"))
}

/// Les deux rayons : `designs` (`~/Documents/Eliot/Designs`) et `modeles` (`…/Modèles`).
fn rayon(app: &AppHandle, nom: &str) -> Result<PathBuf, String> {
    let sous_dossier = match nom {
        "designs" => "Designs",
        "modeles" => "Modèles",
        autre => return Err(format!("rayon inconnu : {autre}")),
    };
    Ok(racine(app)?.join(sous_dossier))
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

fn entete_requis(requete: &Request<'_>, nom: &str) -> Result<String, String> {
    entete(requete, nom).filter(|v| !v.is_empty()).ok_or_else(|| format!("en-tête {nom} manquant"))
}

fn corps_brut(requete: &Request<'_>) -> Result<Vec<u8>, String> {
    match requete.body() {
        InvokeBody::Raw(octets) => Ok(octets.clone()),
        _ => Err("corps binaire attendu".to_string()),
    }
}

/// Exécute `travail` sur un fil à part, sous le verrou des designs.
async fn sur_le_disque<T, F>(app: &AppHandle, travail: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let verrou = app.state::<VerrouProjets>();
        let _garde = verrou.0.lock().unwrap_or_else(|empoisonne| empoisonne.into_inner());
        travail()
    })
    .await
    .map_err(|e| format!("opération interrompue : {e}"))?
}

// ----------------------------------------------------------------------------------------
// Designs
// ----------------------------------------------------------------------------------------

#[tauri::command]
pub async fn projets_lister(app: AppHandle, rayon_nom: String) -> Result<Vec<projet::InfoProjet>, String> {
    let dossier = rayon(&app, &rayon_nom)?;
    sur_le_disque(&app, move || Ok(projet::lister(&dossier))).await
}

#[tauri::command]
pub async fn projet_creer(app: AppHandle, document: Value) -> Result<projet::InfoProjet, String> {
    let dossier = rayon(&app, "designs")?;
    sur_le_disque(&app, move || projet::creer(&dossier, &document).map_err(|e| e.to_string())).await
}

#[derive(Serialize)]
pub struct ProjetOuvert {
    info: projet::InfoProjet,
    document: Value,
}

#[tauri::command]
pub async fn projet_ouvrir(app: AppHandle, rayon_nom: String, id: String) -> Result<ProjetOuvert, String> {
    let dossier = rayon(&app, &rayon_nom)?;
    sur_le_disque(&app, move || {
        projet::ouvrir(&dossier, &id).map(|(info, document)| ProjetOuvert { info, document }).map_err(|e| e.to_string())
    })
    .await
}

/// Corps : le document en JSON. En-têtes : `x-rayon`, `x-id`.
#[tauri::command]
pub async fn projet_enregistrer(app: AppHandle, requete: Request<'_>) -> Result<projet::InfoProjet, String> {
    let octets = corps_brut(&requete)?;
    let dossier = rayon(&app, &entete_requis(&requete, "x-rayon")?)?;
    let id = entete_requis(&requete, "x-id")?;
    sur_le_disque(&app, move || projet::enregistrer(&dossier, &id, &octets).map_err(|e| e.to_string())).await
}

/// Corps : la miniature en PNG. En-têtes : `x-rayon`, `x-id`.
#[tauri::command]
pub async fn projet_miniature_enregistrer(app: AppHandle, requete: Request<'_>) -> Result<(), String> {
    let octets = corps_brut(&requete)?;
    let dossier = rayon(&app, &entete_requis(&requete, "x-rayon")?)?;
    let id = entete_requis(&requete, "x-id")?;
    sur_le_disque(&app, move || projet::enregistrer_miniature(&dossier, &id, &octets).map_err(|e| e.to_string())).await
}

#[tauri::command]
pub async fn projet_miniature_lire(app: AppHandle, rayon_nom: String, id: String) -> Result<Response, String> {
    let dossier = rayon(&app, &rayon_nom)?;
    let octets = sur_le_disque(&app, move || {
        let chemin = projet::chemin_miniature(&dossier, &id).map_err(|e| e.to_string())?;
        std::fs::read(chemin).map_err(|e| e.to_string())
    })
    .await?;
    Ok(Response::new(octets))
}

#[tauri::command]
pub async fn projet_renommer(app: AppHandle, rayon_nom: String, id: String, nom: String) -> Result<projet::InfoProjet, String> {
    let dossier = rayon(&app, &rayon_nom)?;
    sur_le_disque(&app, move || projet::renommer(&dossier, &id, &nom).map_err(|e| e.to_string())).await
}

/// « Faire une copie » (designs vers designs), « Enregistrer comme modèle » (designs vers
/// modèles), « Utiliser ce modèle » (modèles vers designs).
#[tauri::command]
pub async fn projet_dupliquer(app: AppHandle, source: String, id: String, cible: String, nom: String) -> Result<projet::InfoProjet, String> {
    let (source, cible) = (rayon(&app, &source)?, rayon(&app, &cible)?);
    sur_le_disque(&app, move || projet::dupliquer(&source, &id, &cible, &nom).map_err(|e| e.to_string())).await
}

/// Le dossier part dans la corbeille du système : on peut l'y récupérer.
#[tauri::command]
pub async fn projet_supprimer(app: AppHandle, rayon_nom: String, id: String) -> Result<(), String> {
    let dossier = rayon(&app, &rayon_nom)?;
    sur_le_disque(&app, move || {
        projet::supprimer(&dossier, &id, |chemin| trash::delete(chemin).map_err(|e| std::io::Error::other(e.to_string())))
            .map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn projet_exporter_archive(app: AppHandle, rayon_nom: String, id: String, chemin: String) -> Result<String, String> {
    let dossier = rayon(&app, &rayon_nom)?;
    let mut cible = PathBuf::from(chemin);
    if cible.extension().is_none_or(|e| e != projet::EXTENSION_ARCHIVE) {
        cible.set_extension(projet::EXTENSION_ARCHIVE);
    }
    sur_le_disque(&app, move || {
        projet::exporter_archive(&dossier, &id, &cible).map(|c| c.to_string_lossy().into_owned()).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn projet_importer_archive(app: AppHandle, chemin: String) -> Result<projet::InfoProjet, String> {
    let dossier = rayon(&app, "designs")?;
    sur_le_disque(&app, move || projet::importer_archive(&dossier, &PathBuf::from(chemin)).map_err(|e| e.to_string())).await
}

#[tauri::command]
pub fn dossier_designs(app: AppHandle) -> Result<String, String> {
    rayon(&app, "designs").map(|p| p.to_string_lossy().into_owned())
}

// ----------------------------------------------------------------------------------------
// Images d'un design
// ----------------------------------------------------------------------------------------

fn ressources_du_projet(app: &AppHandle, rayon_nom: &str, projet_id: &str) -> Result<PathBuf, String> {
    projet::dossier_ressources(&rayon(app, rayon_nom)?, projet_id).map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct ResultatImport {
    chemin: String,
    ressource: Option<images::Ressource>,
    erreur: Option<String>,
}

/// Importe des fichiers choisis dans le sélecteur natif ou déposés sur la fenêtre : le noyau
/// lit les fichiers lui-même, l'image ne passe jamais par l'interface. Plusieurs fichiers
/// sont traités en parallèle.
#[tauri::command]
pub async fn importer_images(app: AppHandle, rayon_nom: String, projet_id: String, chemins: Vec<String>) -> Result<Vec<ResultatImport>, String> {
    let dossier = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
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

/// Importe une image reçue en octets (collage depuis le presse-papiers). En-têtes : `x-rayon`,
/// `x-projet`, `x-nom`.
#[tauri::command]
pub async fn importer_image_octets(app: AppHandle, requete: Request<'_>) -> Result<images::Ressource, String> {
    let octets = corps_brut(&requete)?;
    let nom = entete(&requete, "x-nom").unwrap_or_else(|| "image".to_string());
    let dossier = ressources_du_projet(&app, &entete_requis(&requete, "x-rayon")?, &entete_requis(&requete, "x-projet")?)?;
    tauri::async_runtime::spawn_blocking(move || images::importer(&octets, &nom, &dossier).map_err(|e| e.to_string()))
        .await
        .map_err(|e| format!("import interrompu : {e}"))?
}

/// Les images déjà rangées dans un design, pour le panneau Images à l'ouverture.
#[tauri::command]
pub async fn ressources_lister(app: AppHandle, rayon_nom: String, projet_id: String) -> Result<Vec<images::Ressource>, String> {
    let dossier = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    tauri::async_runtime::spawn_blocking(move || images::lister(&dossier))
        .await
        .map_err(|e| format!("lecture interrompue : {e}"))
}

/// Copie des images d'un design vers un autre (coller entre deux designs).
#[tauri::command]
pub async fn ressources_copier(app: AppHandle, source_rayon: String, source_id: String, cible_rayon: String, cible_id: String, ids: Vec<String>) -> Result<Vec<images::Ressource>, String> {
    let source = ressources_du_projet(&app, &source_rayon, &source_id)?;
    let cible = ressources_du_projet(&app, &cible_rayon, &cible_id)?;
    tauri::async_runtime::spawn_blocking(move || images::copier(&source, &cible, &ids).map_err(|e| e.to_string()))
        .await
        .map_err(|e| format!("copie interrompue : {e}"))?
}

/// Renvoie l'aperçu ou la miniature d'une image, en octets bruts.
#[tauri::command]
pub async fn lire_ressource(app: AppHandle, rayon_nom: String, projet_id: String, id: String, genre: String) -> Result<Response, String> {
    let genre = match genre.as_str() {
        "apercu" => images::Genre::Apercu,
        "miniature" => images::Genre::Miniature,
        autre => return Err(format!("genre inconnu : {autre}")),
    };
    let dossier = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    let chemin = images::chemin_ressource(&dossier, &id, genre).map_err(|e| e.to_string())?;
    let octets = tauri::async_runtime::spawn_blocking(move || std::fs::read(chemin))
        .await
        .map_err(|e| format!("lecture interrompue : {e}"))?
        .map_err(|e| format!("lecture impossible : {e}"))?;
    Ok(Response::new(octets))
}

// ----------------------------------------------------------------------------------------
// Export
// ----------------------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------------------
// Essai automatique, en développement seulement
// ----------------------------------------------------------------------------------------

/// La variable `ELIOT_AUTOTEST` donne le chemin d'une image à importer. Inactif dans la
/// version compilée pour de bon.
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
