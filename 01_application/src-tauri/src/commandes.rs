//! Les commandes que l'interface peut appeler. Chacune est `async` : une commande synchrone
//! tournerait sur le fil principal et gèlerait la fenêtre (doc Tauri, BRIEF § 4). Le travail
//! sur le disque part sur un fil à part (`spawn_blocking`).

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use noyau::{export, fichiers, images, marque, montage, pixabay, polices, projet, videos};
use percent_encoding::percent_decode_str;
use serde::Serialize;
use serde_json::Value;
use tauri::ipc::{Channel, InvokeBody, Request, Response};
use tauri::{AppHandle, Manager};

/// Une seule opération à la fois sur les designs : un enregistrement automatique ne croise
/// jamais un renommage du même dossier.
#[derive(Default)]
pub struct VerrouProjets(Mutex<()>);

/// Les polices du poste, lues une fois (la liste sert aussi à refuser la lecture d'un fichier
/// qu'elle ne contient pas).
#[derive(Default)]
pub struct PolicesPoste(Mutex<Option<Vec<polices::PoliceInstallee>>>);

/// Le client Pixabay, créé à la première demande qui trouve une clé. La clé est lue ici, par
/// le Rust, et ne quitte jamais ce fichier (BRIEF, règle 12).
#[derive(Default)]
pub struct Pixabay(Mutex<Option<Arc<pixabay::ClientPixabay>>>);

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

/// Le dossier des images d'un design, ou celui des logos du kit de marque (rayon `marque`,
/// identifiant `kit` : `~/Documents/Eliot/Marque/kit/ressources/`).
fn ressources_du_projet(app: &AppHandle, rayon_nom: &str, projet_id: &str) -> Result<PathBuf, String> {
    if rayon_nom == "marque" {
        if projet_id != marque::ID_KIT {
            return Err("kit de marque inconnu".into());
        }
        return marque::dossier_ressources(&dossier_kit(app)?).map_err(|e| e.to_string());
    }
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

/// Où en est l'import d'une vidéo : le fichier en cours (à partir de 0) et sa part faite, de 0
/// à 1. Envoyé au plus une fois par centième, pour ne pas noyer la fenêtre.
#[derive(Clone, Serialize)]
pub struct Avancement {
    fichier: usize,
    part: f32,
}

fn rapporteur(canal: &Channel<Avancement>, fichier: usize, debut: f32, fin: f32) -> impl FnMut(f32) + '_ {
    let mut dernier = -1.0_f32;
    move |p: f32| {
        let part = debut + (fin - debut) * p.clamp(0.0, 1.0);
        if part - dernier >= 0.01 || (p >= 1.0 && dernier < fin) {
            dernier = part;
            let _ = canal.send(Avancement { fichier, part });
        }
    }
}

/// Importe des vidéos (chemins choisis ou déposés), l'une après l'autre : `ffmpeg` occupe déjà
/// tout le processeur pour chacune. Le noyau range l'original et fabrique la copie d'aperçu,
/// les vignettes et la forme d'onde ; la fenêtre ne verra que ces copies.
#[tauri::command]
pub async fn importer_videos(app: AppHandle, rayon_nom: String, projet_id: String, chemins: Vec<String>, avancement: Channel<Avancement>) -> Result<Vec<ResultatImport>, String> {
    let dossier = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        chemins
            .into_iter()
            .enumerate()
            .map(|(i, chemin)| {
                let mut rapport = rapporteur(&avancement, i, 0.0, 1.0);
                match videos::importer(std::path::Path::new(&chemin), &dossier, &videos::ReglageCopie::default(), &mut rapport) {
                    Ok(ressource) => ResultatImport { chemin, ressource: Some(ressource), erreur: None },
                    Err(e) => ResultatImport { chemin, ressource: None, erreur: Some(e.to_string()) },
                }
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

/// Renvoie, en octets bruts, l'aperçu ou la miniature d'une image ; pour une vidéo aussi sa
/// copie d'aperçu, sa bande de vignettes ou sa forme d'onde. Jamais un original.
#[tauri::command]
pub async fn lire_ressource(app: AppHandle, rayon_nom: String, projet_id: String, id: String, genre: String) -> Result<Response, String> {
    let genre = match genre.as_str() {
        "apercu" => images::Genre::Apercu,
        "miniature" => images::Genre::Miniature,
        "copie" => images::Genre::Copie,
        "vignettes" => images::Genre::Vignettes,
        "onde" => images::Genre::Onde,
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

/// L'image d'une vidéo à l'instant `ms` de son fichier, en JPEG, tirée de la copie d'aperçu
/// (capture et vignettes d'une page vidéo).
#[tauri::command]
pub async fn image_video(app: AppHandle, rayon_nom: String, projet_id: String, id: String, ms: u64) -> Result<Response, String> {
    let dossier = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    let octets = tauri::async_runtime::spawn_blocking(move || videos::image_de_copie(&dossier, &id, ms).map_err(|e| e.to_string()))
        .await
        .map_err(|e| format!("lecture interrompue : {e}"))??;
    Ok(Response::new(octets))
}

// ----------------------------------------------------------------------------------------
// Polices du poste et polices copiées dans un design (étape 3)
// ----------------------------------------------------------------------------------------

fn liste_polices_poste(app: &AppHandle) -> Vec<polices::PoliceInstallee> {
    let etat = app.state::<PolicesPoste>();
    let mut garde = etat.0.lock().unwrap_or_else(|e| e.into_inner());
    garde.get_or_insert_with(polices::lister_poste).clone()
}

/// Les polices installées sur le poste.
#[tauri::command]
pub async fn polices_poste(app: AppHandle) -> Result<Vec<polices::PoliceInstallee>, String> {
    tauri::async_runtime::spawn_blocking(move || liste_polices_poste(&app))
        .await
        .map_err(|e| format!("lecture des polices interrompue : {e}"))
}

/// Les octets d'une police du poste, pour la montrer dans la fenêtre.
#[tauri::command]
pub async fn police_poste_lire(app: AppHandle, chemin: String) -> Result<Response, String> {
    let octets = tauri::async_runtime::spawn_blocking(move || polices::lire_poste(&chemin, &liste_polices_poste(&app)))
        .await
        .map_err(|e| format!("lecture interrompue : {e}"))?
        .map_err(|e| format!("police illisible : {e}"))?;
    Ok(Response::new(octets))
}

/// Copie une police du poste dans le design : il pourra s'ouvrir sur une autre machine.
#[tauri::command]
pub async fn police_vers_design(app: AppHandle, rayon_nom: String, projet_id: String, chemin: String) -> Result<String, String> {
    let dossier = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    let connues = liste_polices_poste(&app);
    if !connues.iter().flat_map(|p| &p.fichiers).any(|f| f.chemin == chemin) {
        return Err("police inconnue du poste".into());
    }
    sur_le_disque(&app, move || polices::copier_dans_design(&PathBuf::from(chemin), &dossier).map_err(|e| e.to_string())).await
}

/// Les polices copiées dans un design.
#[tauri::command]
pub async fn polices_design(app: AppHandle, rayon_nom: String, projet_id: String) -> Result<Vec<polices::PoliceInstallee>, String> {
    let dossier = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    tauri::async_runtime::spawn_blocking(move || polices::lister_design(&dossier))
        .await
        .map_err(|e| format!("lecture interrompue : {e}"))
}

/// Les octets d'une police copiée dans un design.
#[tauri::command]
pub async fn police_design_lire(app: AppHandle, rayon_nom: String, projet_id: String, fichier: String) -> Result<Response, String> {
    let dossier = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    let octets = tauri::async_runtime::spawn_blocking(move || polices::lire_design(&dossier, &fichier))
        .await
        .map_err(|e| format!("lecture interrompue : {e}"))?
        .map_err(|e| format!("police illisible : {e}"))?;
    Ok(Response::new(octets))
}

// ----------------------------------------------------------------------------------------
// Photos de Pixabay (étape 3)
// ----------------------------------------------------------------------------------------

/// Les fichiers où chercher la clé : en développement, le `.env` du dépôt (en remontant depuis
/// `src-tauri/`) ; toujours, `cles.env` dans le dossier de configuration d'Eliot.
fn fichiers_cle_pixabay(app: &AppHandle) -> Vec<PathBuf> {
    let configuration = app.path().app_config_dir().ok();
    if cfg!(debug_assertions) {
        pixabay::fichiers_de_cle(std::path::Path::new(env!("CARGO_MANIFEST_DIR")), configuration.as_deref())
    } else {
        configuration.map(|c| vec![c.join("cles.env")]).unwrap_or_default()
    }
}

/// Le fichier où ajouter la clé, à montrer dans le panneau (un chemin, jamais la clé).
fn fichier_cle_conseille(app: &AppHandle) -> String {
    let depot = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).ancestors().nth(2).map(|d| d.join(".env"));
    let fichier = match depot {
        Some(d) if cfg!(debug_assertions) => Some(d),
        _ => app.path().app_config_dir().ok().map(|c| c.join("cles.env")),
    };
    fichier.map(|f| f.to_string_lossy().into_owned()).unwrap_or_default()
}

fn client_pixabay(app: &AppHandle) -> Result<Arc<pixabay::ClientPixabay>, String> {
    let etat = app.state::<Pixabay>();
    let mut garde = etat.0.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(client) = garde.as_ref() {
        return Ok(client.clone());
    }
    let cle = pixabay::lire_cle(&fichiers_cle_pixabay(app)).ok_or_else(|| pixabay::ErreurPixabay::CleAbsente.to_string())?;
    let cache = app.path().app_cache_dir().map_err(|e| format!("dossier de cache introuvable : {e}"))?.join("pixabay");
    // Essais de développement : un faux Pixabay local peut remplacer le vrai.
    let adresse_essai = if cfg!(debug_assertions) { std::env::var("ELIOT_PIXABAY_ADRESSE").ok() } else { None };
    let client = match adresse_essai {
        Some(adresse) => {
            let origine: String = adresse.split('/').take(3).collect::<Vec<_>>().join("/") + "/";
            pixabay::ClientPixabay::avec_adresse(cle, cache, adresse, vec![origine])
        }
        None => pixabay::ClientPixabay::new(cle, cache),
    };
    client.nettoyer();
    let client = Arc::new(client);
    *garde = Some(client.clone());
    Ok(client)
}

/// Ce que le panneau Photos doit savoir : une clé est-elle là, et sinon où l'ajouter.
#[derive(Serialize)]
pub struct EtatPixabay {
    cle: bool,
    fichier: String,
}

#[tauri::command]
pub async fn pixabay_etat(app: AppHandle) -> Result<EtatPixabay, String> {
    tauri::async_runtime::spawn_blocking(move || EtatPixabay { cle: client_pixabay(&app).is_ok(), fichier: fichier_cle_conseille(&app) })
        .await
        .map_err(|e| format!("lecture interrompue : {e}"))
}

#[tauri::command]
pub async fn pixabay_chercher(app: AppHandle, requete: String, page: u32, filtres: pixabay::Filtres) -> Result<pixabay::PageResultats, String> {
    tauri::async_runtime::spawn_blocking(move || client_pixabay(&app)?.chercher(&requete, page, &filtres).map_err(|e| e.to_string()))
        .await
        .map_err(|e| format!("recherche interrompue : {e}"))?
}

#[tauri::command]
pub async fn pixabay_apercu(app: AppHandle, id: u64) -> Result<Response, String> {
    let octets = tauri::async_runtime::spawn_blocking(move || client_pixabay(&app)?.apercu(id).map_err(|e| e.to_string()))
        .await
        .map_err(|e| format!("aperçu interrompu : {e}"))??;
    Ok(Response::new(octets))
}

/// Télécharge la photo choisie et la range dans le design, avec son crédit.
#[tauri::command]
pub async fn pixabay_importer(app: AppHandle, rayon_nom: String, projet_id: String, id: u64) -> Result<images::Ressource, String> {
    let dossier = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let (octets, credit, nom) = client_pixabay(&app)?.telecharger(id).map_err(|e| e.to_string())?;
        images::importer_avec_credit(&octets, &nom, &dossier, credit).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("téléchargement interrompu : {e}"))?
}

// ----------------------------------------------------------------------------------------
// Vidéos de Pixabay (étape 4)
// ----------------------------------------------------------------------------------------

#[tauri::command]
pub async fn pixabay_chercher_videos(app: AppHandle, requete: String, page: u32) -> Result<pixabay::PageVideos, String> {
    tauri::async_runtime::spawn_blocking(move || client_pixabay(&app)?.chercher_videos(&requete, page).map_err(|e| e.to_string()))
        .await
        .map_err(|e| format!("recherche interrompue : {e}"))?
}

#[tauri::command]
pub async fn pixabay_apercu_video(app: AppHandle, id: u64) -> Result<Response, String> {
    let octets = tauri::async_runtime::spawn_blocking(move || client_pixabay(&app)?.apercu_video(id).map_err(|e| e.to_string()))
        .await
        .map_err(|e| format!("aperçu interrompu : {e}"))??;
    Ok(Response::new(octets))
}

/// Télécharge la vidéo choisie (le premier tiers de l'avancement) puis l'importe comme une
/// vidéo du poste, avec son crédit.
#[tauri::command]
pub async fn pixabay_importer_video(app: AppHandle, rayon_nom: String, projet_id: String, id: u64, avancement: Channel<Avancement>) -> Result<images::Ressource, String> {
    let dossier = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        std::fs::create_dir_all(&dossier).map_err(|e| e.to_string())?;
        // Fichier caché, mais qui garde son extension : l'original sera rangé en `.mp4`.
        let temporaire = dossier.join(format!(".telechargement-pixabay-{id}-{}.mp4", std::process::id()));
        let resultat = (|| {
            let (credit, nom) = client_pixabay(&app)?.telecharger_video(id, &temporaire, &mut rapporteur(&avancement, 0, 0.0, 0.3)).map_err(|e| e.to_string())?;
            videos::importer_avec_credit(&temporaire, &nom, &dossier, &videos::ReglageCopie::default(), credit, &mut rapporteur(&avancement, 0, 0.3, 1.0)).map_err(|e| e.to_string())
        })();
        let _ = std::fs::remove_file(&temporaire);
        resultat
    })
    .await
    .map_err(|e| format!("téléchargement interrompu : {e}"))?
}

// ----------------------------------------------------------------------------------------
// Kit de marque (étape 3)
// ----------------------------------------------------------------------------------------

fn dossier_kit(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(racine(app)?.join("Marque").join(marque::ID_KIT))
}

#[tauri::command]
pub async fn marque_lire(app: AppHandle) -> Result<Value, String> {
    let dossier = dossier_kit(&app)?;
    sur_le_disque(&app, move || marque::lire(&dossier).map_err(|e| e.to_string())).await
}

#[tauri::command]
pub async fn marque_enregistrer(app: AppHandle, kit: Value) -> Result<(), String> {
    let dossier = dossier_kit(&app)?;
    sur_le_disque(&app, move || marque::enregistrer(&dossier, &kit).map_err(|e| e.to_string())).await
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
// Export vidéo (étape 4, lot 4)
// ----------------------------------------------------------------------------------------

/// Un seul export vidéo à la fois (il prend tout le processeur) ; `annule` l'arrête.
#[derive(Default)]
pub struct ExportVideo {
    en_cours: AtomicBool,
    annule: Arc<AtomicBool>,
}

/// Le dossier Vidéos de l'utilisateur (`~/Vidéos` sur un Ubuntu en français), puis `Eliot/`.
fn dossier_videos_par_defaut(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .video_dir()
        .or_else(|_| app.path().home_dir())
        .map_err(|e| format!("dossier Vidéos introuvable : {e}"))?;
    Ok(base.join("Eliot"))
}

#[tauri::command]
pub fn dossier_export_video(app: AppHandle) -> Result<String, String> {
    dossier_videos_par_defaut(&app).map(|p| p.to_string_lossy().into_owned())
}

/// Fait le film de la page décrite par la fenêtre (`src/export/calques.ts`) et l'écrit dans
/// `~/Vidéos/Eliot/` sous un nom libre, ou au chemin choisi dans « Enregistrer sous ».
/// L'avancement part par `avancement`, au plus une fois par demi-centième.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn exporter_video(
    app: AppHandle,
    rayon_nom: String,
    projet_id: String,
    description: montage::DescriptionPage,
    reglages: montage::Reglages,
    nom: String,
    chemin: Option<String>,
    avancement: Channel<montage::Avancement>,
) -> Result<String, String> {
    let ressources = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    let extension = match reglages.format {
        montage::FormatVideo::Mp4 => "mp4",
        montage::FormatVideo::Gif => "gif",
    };
    let cible = match chemin.filter(|c| !c.is_empty()) {
        Some(c) => {
            let c = PathBuf::from(c);
            let bonne = c.extension().is_some_and(|e| e.to_string_lossy().eq_ignore_ascii_case(extension));
            if bonne { c } else { c.with_extension(extension) }
        }
        None => {
            let dossier = dossier_videos_par_defaut(&app)?;
            fichiers::chemin_libre(&dossier, &fichiers::nettoyer_nom(&nom), extension)
        }
    };
    let etat = app.state::<ExportVideo>();
    if etat.en_cours.swap(true, Ordering::SeqCst) {
        return Err("un export vidéo est déjà en cours".into());
    }
    etat.annule.store(false, Ordering::SeqCst);
    let annule = etat.annule.clone();
    let app2 = app.clone();
    let resultat = tauri::async_runtime::spawn_blocking(move || {
        let mut derniere = (String::new(), -1.0_f32);
        let mut rapport = |a: montage::Avancement| {
            if a.etape != derniere.0 || a.part - derniere.1 >= 0.005 || a.part >= 1.0 {
                derniere = (a.etape.to_string(), a.part);
                let _ = avancement.send(a);
            }
        };
        montage::exporter(&description, &reglages, &ressources, &cible, &mut rapport, &annule)
            .map(|c| c.to_string_lossy().into_owned())
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("export interrompu : {e}"));
    app2.state::<ExportVideo>().en_cours.store(false, Ordering::SeqCst);
    resultat?
}

/// Arrête l'export vidéo en cours (rien n'est laissé sur le disque).
#[tauri::command]
pub fn annuler_export_video(app: AppHandle) {
    app.state::<ExportVideo>().annule.store(true, Ordering::SeqCst);
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
