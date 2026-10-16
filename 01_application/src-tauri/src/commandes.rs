//! Les commandes que l'interface peut appeler. Chacune est `async` : une commande synchrone
//! tournerait sur le fil principal et gèlerait la fenêtre (doc Tauri, BRIEF § 4). Le travail
//! sur le disque part sur un fil à part (`spawn_blocking`).

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use noyau::{export, fichiers, freesound, images, labo, marque, micro, montage, parole, piper, pixabay, polices, projet, rendu_page, sons, videos, voix};
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

/// Le client Freesound (étape 4, lot 5), créé de même à la première demande qui trouve une clé.
#[derive(Default)]
pub struct Freesound(Mutex<Option<Arc<freesound::ClientFreesound>>>);

/// Le micro ouvert (étape 4, lot 6), un seul à la fois.
#[derive(Default)]
pub struct Micro(Mutex<Option<micro::Captation>>);

/// Les transcriptions (étape 4, lot 7) : une à la fois (Whisper prend le processeur) ;
/// `annule` arrête celle en cours.
#[derive(Default)]
pub struct Transcriptions {
    en_cours: AtomicBool,
    annule: AtomicBool,
}

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

/// Importe des sons (chemins choisis ou déposés), l'un après l'autre : le noyau range
/// l'original, fabrique la copie d'écoute et la forme d'onde, et mesure le niveau sonore.
#[tauri::command]
pub async fn importer_sons(app: AppHandle, rayon_nom: String, projet_id: String, chemins: Vec<String>, avancement: Channel<Avancement>) -> Result<Vec<ResultatImport>, String> {
    let dossier = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        chemins
            .into_iter()
            .enumerate()
            .map(|(i, chemin)| {
                let mut rapport = rapporteur(&avancement, i, 0.0, 1.0);
                match sons::importer(std::path::Path::new(&chemin), &dossier, &mut rapport) {
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
/// copie d'aperçu, sa bande de vignettes ou sa forme d'onde ; pour un son, sa copie d'écoute ou
/// sa forme d'onde. Jamais un original.
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
pub async fn image_video(app: AppHandle, rayon_nom: String, projet_id: String, id: String, ms: u64, reglages: Option<labo::Reglages>) -> Result<Response, String> {
    let dossier = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    let octets = tauri::async_runtime::spawn_blocking(move || {
        let jpeg = videos::image_de_copie(&dossier, &id, ms).map_err(|e| e.to_string())?;
        // Un clip retouché par le labo (étape 5, lot 4) : l'image l'est aussi, en entier.
        match reglages.filter(|r| !r.bornes().neutres()) {
            Some(r) => labo::retoucher_jpeg(&jpeg, &r, labo::graine_du_temps(ms as f64)),
            None => Ok(jpeg),
        }
    })
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

/// Les fichiers où chercher une clé (Pixabay, Freesound) : en développement, le `.env` du dépôt
/// (en remontant depuis `src-tauri/`) ; toujours, `cles.env` dans le dossier de configuration
/// d'Eliot.
fn fichiers_cle(app: &AppHandle) -> Vec<PathBuf> {
    let configuration = app.path().app_config_dir().ok();
    if cfg!(debug_assertions) {
        fichiers::fichiers_de_cle(std::path::Path::new(env!("CARGO_MANIFEST_DIR")), configuration.as_deref())
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
    let cle = pixabay::lire_cle(&fichiers_cle(app)).ok_or_else(|| pixabay::ErreurPixabay::CleAbsente.to_string())?;
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
// Sons de Freesound (étape 4, lot 5)
// ----------------------------------------------------------------------------------------

fn client_freesound(app: &AppHandle) -> Result<Arc<freesound::ClientFreesound>, String> {
    let etat = app.state::<Freesound>();
    let mut garde = etat.0.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(client) = garde.as_ref() {
        return Ok(client.clone());
    }
    let cle = freesound::lire_cle(&fichiers_cle(app)).ok_or_else(|| freesound::ErreurFreesound::CleAbsente.to_string())?;
    let cache = app.path().app_cache_dir().map_err(|e| format!("dossier de cache introuvable : {e}"))?.join("freesound");
    // Essais de développement : un faux Freesound local peut remplacer le vrai.
    let adresse_essai = if cfg!(debug_assertions) { std::env::var("ELIOT_FREESOUND_ADRESSE").ok() } else { None };
    let client = match adresse_essai {
        Some(adresse) => {
            let origine: String = adresse.split('/').take(3).collect::<Vec<_>>().join("/") + "/";
            freesound::ClientFreesound::avec_adresse(cle, cache, adresse, vec![origine])
        }
        None => freesound::ClientFreesound::new(cle, cache),
    };
    client.nettoyer();
    let client = Arc::new(client);
    *garde = Some(client.clone());
    Ok(client)
}

/// Ce que l'onglet Audio doit savoir : une clé Freesound est-elle là, et sinon où l'ajouter.
#[tauri::command]
pub async fn freesound_etat(app: AppHandle) -> Result<EtatPixabay, String> {
    tauri::async_runtime::spawn_blocking(move || EtatPixabay { cle: client_freesound(&app).is_ok(), fichier: fichier_cle_conseille(&app) })
        .await
        .map_err(|e| format!("lecture interrompue : {e}"))
}

#[tauri::command]
pub async fn freesound_chercher(app: AppHandle, requete: String, page: u32, genre: freesound::Genre) -> Result<freesound::PageSons, String> {
    tauri::async_runtime::spawn_blocking(move || client_freesound(&app)?.chercher(&requete, page, genre).map_err(|e| e.to_string()))
        .await
        .map_err(|e| format!("recherche interrompue : {e}"))?
}

/// L'extrait léger d'un son trouvé (MP3), à écouter avant de le choisir.
#[tauri::command]
pub async fn freesound_extrait(app: AppHandle, id: u64) -> Result<Response, String> {
    let octets = tauri::async_runtime::spawn_blocking(move || client_freesound(&app)?.extrait(id).map_err(|e| e.to_string()))
        .await
        .map_err(|e| format!("extrait interrompu : {e}"))??;
    Ok(Response::new(octets))
}

/// Télécharge le son choisi (le premier quart de l'avancement) puis l'importe comme un son du
/// poste, avec son crédit et sa licence.
#[tauri::command]
pub async fn freesound_importer(app: AppHandle, rayon_nom: String, projet_id: String, id: u64, avancement: Channel<Avancement>) -> Result<images::Ressource, String> {
    let dossier = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let client = client_freesound(&app)?;
        let temporaire = client.fichier_de_telechargement(id);
        let resultat = (|| {
            let (credit, nom) = client.telecharger(id, &temporaire, &mut rapporteur(&avancement, 0, 0.0, 0.25)).map_err(|e| e.to_string())?;
            sons::importer_avec_credit(&temporaire, &nom, &dossier, credit, &mut rapporteur(&avancement, 0, 0.25, 1.0)).map_err(|e| e.to_string())
        })();
        let _ = std::fs::remove_file(&temporaire);
        resultat
    })
    .await
    .map_err(|e| format!("téléchargement interrompu : {e}"))?
}

// ----------------------------------------------------------------------------------------
// La voix (étape 4, lot 6) : le micro, le nettoyage, la voix de synthèse
// ----------------------------------------------------------------------------------------

#[tauri::command]
pub async fn micro_lister() -> Result<Vec<micro::Micro>, String> {
    tauri::async_runtime::spawn_blocking(|| micro::lister().map_err(|e| e.to_string()))
        .await
        .map_err(|e| format!("lecture interrompue : {e}"))?
}

/// Ouvre le micro : son niveau arrive tous les 50 ms sur `niveaux` (un micro déjà ouvert est
/// fermé d'abord).
#[tauri::command]
pub async fn micro_ouvrir(app: AppHandle, source: String, niveaux: Channel<micro::NiveauMicro>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let etat = app.state::<Micro>();
        let mut garde = etat.0.lock().unwrap_or_else(|e| e.into_inner());
        *garde = None;
        let captation = micro::Captation::ouvrir(&source, Box::new(move |n| {
            let _ = niveaux.send(n);
        }))
        .map_err(|e| e.to_string())?;
        *garde = Some(captation);
        Ok(())
    })
    .await
    .map_err(|e| format!("ouverture interrompue : {e}"))?
}

fn avec_micro<T>(app: &AppHandle, f: impl FnOnce(&micro::Captation) -> Result<T, micro::ErreurMicro>) -> Result<T, String> {
    let etat = app.state::<Micro>();
    let garde = etat.0.lock().unwrap_or_else(|e| e.into_inner());
    let captation = garde.as_ref().ok_or_else(|| "le micro n'est pas ouvert".to_string())?;
    f(captation).map_err(|e| e.to_string())
}

/// Le fichier d'une prise en cours, dans le dossier temporaire du système.
fn fichier_de_prise() -> PathBuf {
    let marque = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    std::env::temp_dir().join(format!("eliot-prise-{}-{marque}.wav", std::process::id()))
}

/// Commence une prise (au clic sur « Enregistrer », compte à rebours compris).
#[tauri::command]
pub fn micro_commencer(app: AppHandle) -> Result<(), String> {
    avec_micro(&app, |m| m.commencer(&fichier_de_prise()))
}

/// Le top : le compte à rebours est fini, la tête de lecture part. Renvoie l'instant de la
/// prise, en ms.
#[tauri::command]
pub fn micro_marquer(app: AppHandle) -> Result<u64, String> {
    avec_micro(&app, |m| m.marquer())
}

#[tauri::command]
pub fn micro_abandonner(app: AppHandle) {
    let _ = avec_micro(&app, |m| {
        m.abandonner();
        Ok(())
    });
}

#[tauri::command]
pub fn micro_fermer(app: AppHandle) {
    let etat = app.state::<Micro>();
    let pris = etat.0.lock().unwrap_or_else(|e| e.into_inner()).take();
    drop(pris);
}

/// Une prise rangée dans le design : sa ressource, l'instant du top et sa durée, en ms.
#[derive(Serialize)]
pub struct PriseRangee {
    ressource: images::Ressource,
    marque: u64,
    duree: u64,
}

/// Arrête la prise et la range dans le design sous le nom `nom` (original, copie d'écoute,
/// forme d'onde, niveau). Le micro continue d'écouter pour la prise suivante.
#[tauri::command]
pub async fn micro_arreter(app: AppHandle, rayon_nom: String, projet_id: String, nom: String) -> Result<PriseRangee, String> {
    let dossier = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    let prise = avec_micro(&app, |m| m.arreter())?;
    tauri::async_runtime::spawn_blocking(move || {
        let resultat = sons::importer_fait(&prise.chemin, &nom, "micro", Some(prise.marque), None, &dossier, &mut |_| ()).map_err(|e| e.to_string());
        let _ = std::fs::remove_file(&prise.chemin);
        resultat.map(|ressource| PriseRangee { ressource, marque: prise.marque, duree: prise.duree })
    })
    .await
    .map_err(|e| format!("rangement interrompu : {e}"))?
}

/// La version nettoyée d'un son du design (faite au besoin, sinon relue du cache).
#[tauri::command]
pub async fn voix_nettoyer(app: AppHandle, rayon_nom: String, projet_id: String, id: String, nettoyage: voix::Nettoyage) -> Result<voix::Traitee, String> {
    let dossier = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    tauri::async_runtime::spawn_blocking(move || voix::nettoyer(&dossier, &id, &nettoyage).map_err(|e| e.to_string()))
        .await
        .map_err(|e| format!("nettoyage interrompu : {e}"))?
}

/// La copie d'écoute (`copie`) ou la forme d'onde (`onde`) d'une version nettoyée.
#[tauri::command]
pub async fn voix_lire(app: AppHandle, rayon_nom: String, projet_id: String, id: String, cle: String, genre: String) -> Result<Response, String> {
    let dossier = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    let octets = tauri::async_runtime::spawn_blocking(move || match genre.as_str() {
        "copie" => voix::chemin(&dossier, &id, &cle, "webm").map_err(|e| e.to_string()).and_then(|c| std::fs::read(c).map_err(|e| format!("lecture impossible : {e}"))),
        "onde" => voix::lire_onde(&dossier, &id, &cle).map_err(|e| e.to_string()),
        autre => Err(format!("genre inconnu : {autre}")),
    })
    .await
    .map_err(|e| format!("lecture interrompue : {e}"))??;
    Ok(Response::new(octets))
}

#[derive(serde::Deserialize)]
pub struct VoixUtilisee {
    ressource: String,
    nettoyage: voix::Nettoyage,
}

/// Efface les versions nettoyées dont plus aucun clip du design ne se sert.
#[tauri::command]
pub async fn voix_purger(app: AppHandle, rayon_nom: String, projet_id: String, utilisees: Vec<VoixUtilisee>) -> Result<usize, String> {
    let dossier = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let gardees: Vec<(String, voix::Nettoyage)> = utilisees.into_iter().map(|u| (u.ressource, u.nettoyage)).collect();
        voix::purger(&dossier, &gardees)
    })
    .await
    .map_err(|e| format!("rangement interrompu : {e}"))
}

/// Les dossiers des voix de Piper : `ELIOT_VOIX` pour les essais de développement, sinon
/// `telechargements/voix/` du dépôt (en développement) et `voix/` dans les données d'Eliot.
fn dossiers_voix(app: &AppHandle) -> Vec<PathBuf> {
    if cfg!(debug_assertions)
        && let Some(d) = std::env::var_os("ELIOT_VOIX")
    {
        return vec![PathBuf::from(d)];
    }
    let donnees = app.path().app_data_dir().ok();
    if cfg!(debug_assertions) {
        piper::dossiers_de_voix(std::path::Path::new(env!("CARGO_MANIFEST_DIR")), donnees.as_deref())
    } else {
        donnees.map(|d| vec![d.join("voix")]).unwrap_or_default()
    }
}

/// Le dossier où ranger les voix, à montrer dans l'onglet Audio.
fn dossier_voix_conseille(app: &AppHandle) -> String {
    let depot = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).ancestors().nth(2).map(|d| d.join("telechargements").join("voix"));
    let dossier = match depot {
        Some(d) if cfg!(debug_assertions) => Some(d),
        _ => app.path().app_data_dir().ok().map(|c| c.join("voix")),
    };
    dossier.map(|f| f.to_string_lossy().into_owned()).unwrap_or_default()
}

/// Ce que l'onglet Audio doit savoir de Piper : est-il installé, quelles voix sont là, et où les
/// ranger.
#[derive(Serialize)]
pub struct EtatPiper {
    installe: bool,
    voix: Vec<piper::VoixPiper>,
    dossier: String,
}

#[tauri::command]
pub async fn piper_etat(app: AppHandle) -> Result<EtatPiper, String> {
    tauri::async_runtime::spawn_blocking(move || EtatPiper {
        installe: piper::trouver_piper().is_some(),
        voix: piper::lister_voix(&dossiers_voix(&app)).into_iter().map(|v| v.voix).collect(),
        dossier: dossier_voix_conseille(&app),
    })
    .await
    .map_err(|e| format!("lecture interrompue : {e}"))
}

/// Fait dire `texte` par la voix `voix` : le fichier en cache, calé sur -16 LUFS.
fn preparer_voix(app: &AppHandle, voix_id: &str, texte: &str, vitesse: f64) -> Result<(piper::VoixTrouvee, PathBuf), String> {
    let programme = piper::trouver_piper().ok_or_else(|| piper::ErreurPiper::Absent.to_string())?;
    let toutes = piper::lister_voix(&dossiers_voix(app));
    if toutes.is_empty() {
        return Err(piper::ErreurPiper::SansVoix.to_string());
    }
    let voix = toutes.into_iter().find(|v| v.voix.id == voix_id).ok_or_else(|| piper::ErreurPiper::VoixInconnue(voix_id.to_string()).to_string())?;
    let cache = app.path().app_cache_dir().map_err(|e| format!("dossier de cache introuvable : {e}"))?.join("piper");
    let fichier = piper::preparer(&programme, &voix, texte, vitesse, &cache).map_err(|e| e.to_string())?;
    Ok((voix, fichier))
}

/// Le texte dit par la voix, à écouter avant de l'ajouter (WAV).
#[tauri::command]
pub async fn piper_ecouter(app: AppHandle, voix: String, texte: String, vitesse: f64) -> Result<Response, String> {
    let octets = tauri::async_runtime::spawn_blocking(move || {
        let (_, fichier) = preparer_voix(&app, &voix, &texte, vitesse)?;
        std::fs::read(fichier).map_err(|e| format!("lecture impossible : {e}"))
    })
    .await
    .map_err(|e| format!("synthèse interrompue : {e}"))??;
    Ok(Response::new(octets))
}

/// Le texte dit par la voix, rangé dans le design comme un son, avec le crédit de la voix.
#[tauri::command]
pub async fn piper_ajouter(app: AppHandle, rayon_nom: String, projet_id: String, voix: String, texte: String, vitesse: f64) -> Result<images::Ressource, String> {
    let dossier = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let (trouvee, fichier) = preparer_voix(&app, &voix, &texte, vitesse)?;
        let nom = piper::nom_du_son(&texte);
        let credit = images::Credit {
            source: "Piper".into(),
            auteur: trouvee.voix.nom.clone(),
            lien: trouvee.voix.donnees.clone().unwrap_or_else(|| "https://github.com/OHF-Voice/piper1-gpl".into()),
            licence: trouvee.voix.licence.clone(),
            titre: Some(nom.clone()),
        };
        sons::importer_fait(&fichier, &nom, "synthese", None, Some(credit), &dossier, &mut |_| ()).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("synthèse interrompue : {e}"))?
}

// ----------------------------------------------------------------------------------------
// La parole (étape 4, lot 7) : où l'on parle, ce qui est dit (Whisper)
// ----------------------------------------------------------------------------------------

/// Où l'on parle dans un son ou une vidéo du design (analyse du niveau, gardée ensuite).
#[tauri::command]
pub async fn parole_analyser(app: AppHandle, rayon_nom: String, projet_id: String, id: String) -> Result<parole::Analyse, String> {
    let dossier = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    tauri::async_runtime::spawn_blocking(move || parole::analyser(&dossier, &id).map_err(|e| e.to_string()))
        .await
        .map_err(|e| format!("analyse interrompue : {e}"))?
}

/// Les dossiers des modèles de Whisper : `ELIOT_WHISPER_MODELES` pour les essais de
/// développement, sinon `telechargements/whisper/` du dépôt (en développement) et `whisper/`
/// dans les données d'Eliot.
fn dossiers_whisper(app: &AppHandle) -> Vec<PathBuf> {
    if cfg!(debug_assertions)
        && let Some(d) = std::env::var_os("ELIOT_WHISPER_MODELES")
    {
        return vec![PathBuf::from(d)];
    }
    let donnees = app.path().app_data_dir().ok();
    if cfg!(debug_assertions) {
        parole::dossiers_de_modeles(std::path::Path::new(env!("CARGO_MANIFEST_DIR")), donnees.as_deref())
    } else {
        donnees.map(|d| vec![d.join("whisper")]).unwrap_or_default()
    }
}

/// Ce que la fenêtre doit savoir de Whisper : est-il installé, quel modèle servira, et où
/// ranger un modèle.
#[derive(Serialize)]
pub struct EtatWhisper {
    installe: bool,
    modele: Option<String>,
    dossier: String,
}

#[tauri::command]
pub async fn whisper_etat(app: AppHandle) -> Result<EtatWhisper, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let depot = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).ancestors().nth(2).map(|d| d.join("telechargements").join("whisper"));
        let dossier = match depot {
            Some(d) if cfg!(debug_assertions) => Some(d),
            _ => app.path().app_data_dir().ok().map(|c| c.join("whisper")),
        };
        EtatWhisper {
            installe: parole::trouver_whisper().is_some(),
            modele: parole::trouver_modele(&dossiers_whisper(&app)).and_then(|m| m.file_name().map(|n| n.to_string_lossy().into_owned())),
            dossier: dossier.map(|f| f.to_string_lossy().into_owned()).unwrap_or_default(),
        }
    })
    .await
    .map_err(|e| format!("lecture interrompue : {e}"))
}

/// Ce qui est dit dans un son ou une vidéo du design, mot par mot (Whisper sur le processeur,
/// fait une fois puis relu ; `forcer` le refait). L'avancement, de 0 à 1, part par `avancement`.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn parole_transcrire(app: AppHandle, rayon_nom: String, projet_id: String, id: String, langue: String, noms: Option<Vec<String>>, forcer: bool, avancement: Channel<f32>) -> Result<parole::Analyse, String> {
    let noms = noms.unwrap_or_default();
    let dossier = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    let programme = parole::trouver_whisper().ok_or_else(|| parole::ErreurParole::Absent.to_string())?;
    let modele = parole::trouver_modele(&dossiers_whisper(&app)).ok_or_else(|| parole::ErreurParole::SansModele.to_string())?;
    let etat = app.state::<Transcriptions>();
    if etat.en_cours.swap(true, Ordering::SeqCst) {
        return Err("une transcription est déjà en cours".into());
    }
    etat.annule.store(false, Ordering::SeqCst);
    let app2 = app.clone();
    let resultat = tauri::async_runtime::spawn_blocking(move || {
        let etat = app.state::<Transcriptions>();
        let mut derniere = -1.0_f32;
        let mut rapport = |p: f32| {
            if p - derniere >= 0.01 || p >= 1.0 {
                derniere = p;
                let _ = avancement.send(p);
            }
        };
        parole::transcrire(&dossier, &id, &programme, &modele, &langue, &noms, forcer, &etat.annule, &mut rapport).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("transcription interrompue : {e}"));
    app2.state::<Transcriptions>().en_cours.store(false, Ordering::SeqCst);
    resultat?
}

/// Arrête la transcription en cours.
#[tauri::command]
pub fn parole_annuler(app: AppHandle) {
    app.state::<Transcriptions>().annule.store(true, Ordering::SeqCst);
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
/// `~/Vidéos/Eliot/` sous un nom libre, ou au chemin choisi dans « Enregistrer sous » (avec, si
/// elle est demandée, la version sans musique à côté). L'avancement part par `avancement`, au
/// plus une fois par demi-centième.
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
) -> Result<montage::Film, String> {
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
        montage::exporter(&description, &reglages, &ressources, &cible, &mut rapport, &annule).map_err(|e| e.to_string())
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
// Export depuis le document (étape 5, lot 1)
// ----------------------------------------------------------------------------------------

#[derive(Clone, Serialize)]
pub struct AvancementExport {
    fait: usize,
    total: usize,
}

/// Rend les pages décrites par la fenêtre (`src/export/calques.ts`) depuis les originaux et les
/// écrit dans `~/Images/Eliot/` sous un nom libre, ou au chemin choisi dans « Enregistrer
/// sous » : PNG, JPEG, WebP ou SVG, un fichier par page ; PDF, un seul fichier. Renvoie les
/// chemins écrits ; l'avancement part par `avancement` après chaque page.
#[tauri::command]
pub async fn exporter_document(
    app: AppHandle,
    rayon_nom: String,
    projet_id: String,
    demande: rendu_page::DemandeExport,
    nom: String,
    chemin: Option<String>,
    avancement: Channel<AvancementExport>,
) -> Result<Vec<String>, String> {
    let ressources = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    let dossier = dossier_export_par_defaut(&app)?;
    let chemin = chemin.filter(|c| !c.is_empty()).map(PathBuf::from);
    tauri::async_runtime::spawn_blocking(move || {
        let mut suivi = |fait, total| {
            let _ = avancement.send(AvancementExport { fait, total });
        };
        rendu_page::exporter_document(demande, &ressources, &dossier, &nom, chemin.as_deref(), &mut suivi)
            .map(|ecrits| ecrits.iter().map(|c| c.to_string_lossy().into_owned()).collect())
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("export interrompu : {e}"))?
}

// ----------------------------------------------------------------------------------------
// Le labo photo (étape 5, lot 2)
// ----------------------------------------------------------------------------------------

/// La base de l'aperçu en direct d'une photo retouchée : son aperçu de 2560 px passé par les
/// réglages (ceux qui regardent les pixels voisins compris), sans vignetage ni grain. Réponse
/// binaire : largeur et hauteur (deux entiers de 32 bits, petit-boutistes), puis les pixels
/// RGBA.
#[tauri::command]
pub async fn labo_base(app: AppHandle, rayon_nom: String, projet_id: String, id: String, reglages: labo::Reglages) -> Result<Response, String> {
    let dossier = ressources_du_projet(&app, &rayon_nom, &projet_id)?;
    let chemin = images::chemin_ressource(&dossier, &id, images::Genre::Apercu).map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || labo::base_apercu(&chemin, &reglages).map(Response::new))
        .await
        .map_err(|e| format!("retouche interrompue : {e}"))?
}

/// La base de l'aperçu en direct d'un clip à l'arrêt (étape 5, lot 4) : l'image affichée par la
/// fenêtre (corps : ses pixels RGBA ; en-têtes `x-largeur`, `x-hauteur` et `x-reglages`, les
/// réglages en JSON), retouchée sans vignetage ni grain. Réponse : les pixels RGBA.
#[tauri::command]
pub async fn labo_base_pixels(requete: Request<'_>) -> Result<Response, String> {
    let pixels = corps_brut(&requete)?;
    let largeur: u32 = entete_requis(&requete, "x-largeur")?.parse().map_err(|_| "x-largeur : un entier".to_string())?;
    let hauteur: u32 = entete_requis(&requete, "x-hauteur")?.parse().map_err(|_| "x-hauteur : un entier".to_string())?;
    let reglages: labo::Reglages = serde_json::from_str(&entete_requis(&requete, "x-reglages")?).map_err(|e| format!("x-reglages : {e}"))?;
    tauri::async_runtime::spawn_blocking(move || labo::base_pixels(largeur, hauteur, pixels, &reglages).map(Response::new))
        .await
        .map_err(|e| format!("retouche interrompue : {e}"))?
}

/// Les préréglages d'Alexandre (étape 5, lot 3) : `~/Documents/Eliot/Préréglages/`.
fn dossier_prereglages(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(racine(app)?.join("Préréglages"))
}

#[tauri::command]
pub async fn prereglages_lire(app: AppHandle) -> Result<Value, String> {
    let dossier = dossier_prereglages(&app)?;
    sur_le_disque(&app, move || labo::lire_prereglages(&dossier)).await
}

#[tauri::command]
pub async fn prereglages_enregistrer(app: AppHandle, prereglages: Value) -> Result<(), String> {
    let dossier = dossier_prereglages(&app)?;
    sur_le_disque(&app, move || labo::enregistrer_prereglages(&dossier, &prereglages)).await
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
