//! Les designs enregistrés. Un design est un dossier autonome qu'on peut copier tel quel d'une
//! machine à l'autre :
//!
//! ```text
//! <rayon>/<id>/document.json            le document (seule vérité, règle 1)
//!             document.precedent.json   la version d'avant, en secours
//!             miniature.png             l'image de l'accueil
//!             ressources/               images du design (voir images.rs)
//! ```
//!
//! Un « rayon » est un dossier qui range des designs : `Designs/` ou `Modèles/`. L'identifiant
//! d'un design est le nom de son dossier, tiré du nom du design.

use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;
use serde_json::{Map, Value, json};
use thiserror::Error;

use crate::fichiers::{ecrire_atomiquement, nettoyer_nom};

/// Version du document que cette version d'Eliot écrit.
pub const VERSION_DOCUMENT: u64 = 2;

pub const FICHIER_DOCUMENT: &str = "document.json";
pub const FICHIER_PRECEDENT: &str = "document.precedent.json";
pub const FICHIER_MINIATURE: &str = "miniature.png";
pub const DOSSIER_RESSOURCES: &str = "ressources";
pub const EXTENSION_ARCHIVE: &str = "eliot";

/// Limites de l'import d'une archive, contre un fichier piégé.
const ENTREES_MAX: usize = 20_000;
const TAILLE_MAX: u64 = 8 * 1024 * 1024 * 1024;

#[derive(Debug, Error)]
pub enum ErreurProjet {
    #[error("accès au disque impossible : {0}")]
    Disque(#[from] io::Error),
    #[error("identifiant de design invalide")]
    IdentifiantInvalide,
    #[error("ce design n'existe pas")]
    Introuvable,
    #[error("document illisible : {0}")]
    DocumentIllisible(String),
    #[error("ce document vient d'une version plus récente d'Eliot (version {0})")]
    VersionFuture(u64),
    #[error("archive refusée : {0}")]
    ArchiveRefusee(String),
}

/// Ce que l'accueil affiche d'un design.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct InfoProjet {
    pub id: String,
    pub nom: String,
    pub largeur: u64,
    pub hauteur: u64,
    pub pages: u64,
    /// Dernière modification, en millisecondes depuis 1970.
    pub modifie: u64,
    pub miniature: bool,
}

/// Un identifiant venant de l'interface sert à construire un chemin : il ne doit contenir que
/// ce que `nettoyer_nom` produit, donc ni `/`, ni `..`, ni point au début.
pub fn identifiant_valide(id: &str) -> bool {
    !id.is_empty() && nettoyer_nom(id) == id
}

fn dossier_projet(rayon: &Path, id: &str) -> Result<PathBuf, ErreurProjet> {
    if !identifiant_valide(id) {
        return Err(ErreurProjet::IdentifiantInvalide);
    }
    let dossier = rayon.join(id);
    if !dossier.join(FICHIER_DOCUMENT).is_file() {
        return Err(ErreurProjet::Introuvable);
    }
    Ok(dossier)
}

/// Dossier des images d'un design (créé au besoin).
pub fn dossier_ressources(rayon: &Path, id: &str) -> Result<PathBuf, ErreurProjet> {
    let dossier = dossier_projet(rayon, id)?.join(DOSSIER_RESSOURCES);
    fs::create_dir_all(&dossier)?;
    Ok(dossier)
}

/// Premier nom de dossier libre : `base`, `base_2`, `base_3`…
fn dossier_libre(rayon: &Path, base: &str) -> PathBuf {
    let premier = rayon.join(base);
    if !premier.exists() {
        return premier;
    }
    (2..)
        .map(|n| rayon.join(format!("{base}_{n}")))
        .find(|chemin| !chemin.exists())
        .expect("une suite infinie finit par trouver un nom libre")
}

fn nom_de_dossier(nom: &str) -> String {
    let propre = nettoyer_nom(nom.trim());
    if propre == "eliot" && nom.trim().is_empty() { "Design_sans_titre".to_string() } else { propre }
}

// ----------------------------------------------------------------------------------------
// Conversion des anciens documents
// ----------------------------------------------------------------------------------------

/// Amène un document à la version courante. Version 1 (étape 1) : une page unique
/// `{ page: { largeur, hauteur, fond }, elements }`. Version 2 : `{ nom, format, pages }`.
pub fn migrer(mut document: Value, nom_par_defaut: &str) -> Result<Value, ErreurProjet> {
    let version = document
        .get("version")
        .and_then(Value::as_u64)
        .ok_or_else(|| ErreurProjet::DocumentIllisible("numéro de version absent".into()))?;
    if version > VERSION_DOCUMENT {
        return Err(ErreurProjet::VersionFuture(version));
    }
    if version == 1 {
        let objet = document
            .as_object_mut()
            .ok_or_else(|| ErreurProjet::DocumentIllisible("le document n'est pas un objet".into()))?;
        let page = objet.remove("page").unwrap_or_else(|| json!({}));
        let elements = objet.remove("elements").unwrap_or_else(|| json!([]));
        let largeur = page.get("largeur").cloned().unwrap_or(json!(1080));
        let hauteur = page.get("hauteur").cloned().unwrap_or(json!(1080));
        let fond = page.get("fond").cloned().unwrap_or(json!("#ffffff"));
        document = json!({
            "version": 2,
            "nom": nom_par_defaut,
            "format": { "largeur": largeur, "hauteur": hauteur },
            "pages": [ { "id": "page-1", "fond": fond, "elements": elements } ],
        });
    }
    verifier_forme(&document)?;
    Ok(document)
}

/// Contrôle minimal de la forme d'un document de la version courante : ce que le noyau lit
/// lui-même (nom, format, pages). Le détail des éléments appartient à l'interface.
fn verifier_forme(document: &Value) -> Result<(), ErreurProjet> {
    let illisible = |raison: &str| ErreurProjet::DocumentIllisible(raison.to_string());
    if document.get("version").and_then(Value::as_u64) != Some(VERSION_DOCUMENT) {
        return Err(illisible("version inattendue"));
    }
    document.get("nom").and_then(Value::as_str).ok_or_else(|| illisible("nom absent"))?;
    let format = document.get("format").ok_or_else(|| illisible("format absent"))?;
    for cote in ["largeur", "hauteur"] {
        let valeur = format.get(cote).and_then(Value::as_f64).ok_or_else(|| illisible("format incomplet"))?;
        if !(1.0..=20_000.0).contains(&valeur) {
            return Err(illisible("format hors limites"));
        }
    }
    let pages = document.get("pages").and_then(Value::as_array).ok_or_else(|| illisible("pages absentes"))?;
    if pages.is_empty() {
        return Err(illisible("aucune page"));
    }
    for page in pages {
        page.get("elements").and_then(Value::as_array).ok_or_else(|| illisible("page sans éléments"))?;
    }
    Ok(())
}

fn lire_document(dossier: &Path) -> Result<Value, ErreurProjet> {
    let texte = fs::read(dossier.join(FICHIER_DOCUMENT))?;
    serde_json::from_slice(&texte).map_err(|e| ErreurProjet::DocumentIllisible(e.to_string()))
}

fn info(id: &str, dossier: &Path, document: &Value) -> InfoProjet {
    let format = document.get("format").or_else(|| document.get("page"));
    let nombre = |v: Option<&Value>| v.and_then(Value::as_f64).unwrap_or(0.0).round() as u64;
    let modifie = fs::metadata(dossier.join(FICHIER_DOCUMENT))
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    InfoProjet {
        id: id.to_string(),
        nom: document.get("nom").and_then(Value::as_str).unwrap_or(id).to_string(),
        largeur: nombre(format.and_then(|f| f.get("largeur"))),
        hauteur: nombre(format.and_then(|f| f.get("hauteur"))),
        pages: document.get("pages").and_then(Value::as_array).map(|p| p.len() as u64).unwrap_or(1),
        modifie,
        miniature: dossier.join(FICHIER_MINIATURE).is_file(),
    }
}

fn texte_du_document(document: &Value) -> Result<Vec<u8>, ErreurProjet> {
    serde_json::to_vec_pretty(document).map_err(|e| ErreurProjet::DocumentIllisible(e.to_string()))
}

// ----------------------------------------------------------------------------------------
// Opérations
// ----------------------------------------------------------------------------------------

/// Les designs d'un rayon, du plus récemment modifié au plus ancien. Un dossier illisible est
/// ignoré, il ne bloque pas l'accueil.
pub fn lister(rayon: &Path) -> Vec<InfoProjet> {
    let Ok(entrees) = fs::read_dir(rayon) else { return Vec::new() };
    let mut liste: Vec<InfoProjet> = entrees
        .flatten()
        .filter_map(|entree| {
            let id = entree.file_name().to_string_lossy().into_owned();
            if !identifiant_valide(&id) {
                return None;
            }
            let dossier = entree.path();
            let document = lire_document(&dossier).ok()?;
            Some(info(&id, &dossier, &document))
        })
        .collect();
    liste.sort_by(|a, b| b.modifie.cmp(&a.modifie).then_with(|| a.nom.cmp(&b.nom)));
    liste
}

/// Crée un design à partir d'un document de la version courante. Le nom du dossier vient du
/// nom du design ; le nom inscrit dans le document est celui reçu.
pub fn creer(rayon: &Path, document: &Value) -> Result<InfoProjet, ErreurProjet> {
    verifier_forme(document)?;
    fs::create_dir_all(rayon)?;
    let nom = document["nom"].as_str().unwrap_or_default();
    let dossier = dossier_libre(rayon, &nom_de_dossier(nom));
    fs::create_dir(&dossier)?;
    fs::create_dir(dossier.join(DOSSIER_RESSOURCES))?;
    ecrire_atomiquement(&dossier.join(FICHIER_DOCUMENT), &texte_du_document(document)?)?;
    let id = dossier.file_name().expect("dossier nommé").to_string_lossy().into_owned();
    Ok(info(&id, &dossier, document))
}

/// Ouvre un design et le convertit à la version courante. Si `document.json` est illisible
/// (coupure de courant au mauvais moment, modification à la main), la version précédente
/// prend le relais.
pub fn ouvrir(rayon: &Path, id: &str) -> Result<(InfoProjet, Value), ErreurProjet> {
    let dossier = dossier_projet(rayon, id)?;
    let document = match lire_document(&dossier) {
        Ok(d) => d,
        Err(erreur) => {
            let secours = fs::read(dossier.join(FICHIER_PRECEDENT)).map_err(|_| erreur)?;
            serde_json::from_slice(&secours).map_err(|e| ErreurProjet::DocumentIllisible(e.to_string()))?
        }
    };
    let document = migrer(document, id)?;
    Ok((info(id, &dossier, &document), document))
}

/// Enregistre le document envoyé par l'interface. L'ancien passe en `document.precedent.json`,
/// le nouveau est écrit d'un bloc (règle 8).
pub fn enregistrer(rayon: &Path, id: &str, octets: &[u8]) -> Result<InfoProjet, ErreurProjet> {
    let dossier = dossier_projet(rayon, id)?;
    let document: Value = serde_json::from_slice(octets).map_err(|e| ErreurProjet::DocumentIllisible(e.to_string()))?;
    verifier_forme(&document)?;
    if let Ok(ancien) = fs::read(dossier.join(FICHIER_DOCUMENT)) {
        if ancien == octets {
            return Ok(info(id, &dossier, &document));
        }
        ecrire_atomiquement(&dossier.join(FICHIER_PRECEDENT), &ancien)?;
    }
    ecrire_atomiquement(&dossier.join(FICHIER_DOCUMENT), octets)?;
    Ok(info(id, &dossier, &document))
}

/// Range la miniature de l'accueil (PNG produit par l'interface).
pub fn enregistrer_miniature(rayon: &Path, id: &str, png: &[u8]) -> Result<(), ErreurProjet> {
    let dossier = dossier_projet(rayon, id)?;
    if !png.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]) {
        return Err(ErreurProjet::DocumentIllisible("la miniature n'est pas un PNG".into()));
    }
    ecrire_atomiquement(&dossier.join(FICHIER_MINIATURE), png)?;
    Ok(())
}

pub fn chemin_miniature(rayon: &Path, id: &str) -> Result<PathBuf, ErreurProjet> {
    let chemin = dossier_projet(rayon, id)?.join(FICHIER_MINIATURE);
    if chemin.is_file() { Ok(chemin) } else { Err(ErreurProjet::Introuvable) }
}

fn changer_nom(document: &mut Value, nom: &str) {
    if let Some(objet) = document.as_object_mut() {
        objet.insert("nom".to_string(), Value::String(nom.to_string()));
    }
}

/// Renomme un design : le nom dans le document et le dossier. L'identifiant change avec le
/// dossier ; l'interface reçoit le nouveau.
pub fn renommer(rayon: &Path, id: &str, nom: &str) -> Result<InfoProjet, ErreurProjet> {
    let dossier = dossier_projet(rayon, id)?;
    let nom = nom.trim();
    let mut document = migrer(lire_document(&dossier)?, id)?;
    changer_nom(&mut document, nom);
    ecrire_atomiquement(&dossier.join(FICHIER_DOCUMENT), &texte_du_document(&document)?)?;

    let voulu = nom_de_dossier(nom);
    let cible = if voulu == id { dossier.clone() } else { dossier_libre(rayon, &voulu) };
    if cible != dossier {
        fs::rename(&dossier, &cible)?;
    }
    let nouvel_id = cible.file_name().expect("dossier nommé").to_string_lossy().into_owned();
    Ok(info(&nouvel_id, &cible, &document))
}

fn copier_dossier(source: &Path, cible: &Path) -> io::Result<()> {
    fs::create_dir_all(cible)?;
    for entree in fs::read_dir(source)?.flatten() {
        let nom = entree.file_name();
        // Les fichiers temporaires d'une écriture en cours ne voyagent pas.
        if nom.to_string_lossy().starts_with('.') {
            continue;
        }
        let type_entree = entree.file_type()?;
        if type_entree.is_dir() {
            copier_dossier(&entree.path(), &cible.join(&nom))?;
        } else if type_entree.is_file() {
            fs::copy(entree.path(), cible.join(&nom))?;
        }
    }
    Ok(())
}

/// Copie un design, dans le même rayon ou dans un autre, sous un nouveau nom : « Faire une
/// copie », « Enregistrer comme modèle », « Créer à partir d'un modèle ».
pub fn dupliquer(source: &Path, id: &str, cible: &Path, nom: &str) -> Result<InfoProjet, ErreurProjet> {
    let dossier = dossier_projet(source, id)?;
    let mut document = migrer(lire_document(&dossier)?, id)?;
    changer_nom(&mut document, nom.trim());
    fs::create_dir_all(cible)?;
    let destination = dossier_libre(cible, &nom_de_dossier(nom));
    // Copie dans un dossier caché, puis renommage : un dossier visible est toujours complet.
    let temporaire = cible.join(format!(".copie-{}", std::process::id()));
    let _ = fs::remove_dir_all(&temporaire);
    let resultat = (|| {
        copier_dossier(&dossier, &temporaire)?;
        let _ = fs::remove_file(temporaire.join(FICHIER_PRECEDENT));
        ecrire_atomiquement(&temporaire.join(FICHIER_DOCUMENT), &texte_du_document(&document).map_err(io::Error::other)?)?;
        fs::rename(&temporaire, &destination)
    })();
    if let Err(erreur) = resultat {
        let _ = fs::remove_dir_all(&temporaire);
        return Err(erreur.into());
    }
    let nouvel_id = destination.file_name().expect("dossier nommé").to_string_lossy().into_owned();
    Ok(info(&nouvel_id, &destination, &document))
}

/// Supprime un design en le confiant à `jeter` (la corbeille du système dans l'application,
/// un simple déplacement dans les tests).
pub fn supprimer(rayon: &Path, id: &str, jeter: impl FnOnce(&Path) -> io::Result<()>) -> Result<(), ErreurProjet> {
    let dossier = dossier_projet(rayon, id)?;
    jeter(&dossier)?;
    Ok(())
}

// ----------------------------------------------------------------------------------------
// Archive .eliot : le dossier du design dans un zip
// ----------------------------------------------------------------------------------------

fn ajouter_au_zip<W: Write + io::Seek>(zip: &mut zip::ZipWriter<W>, racine: &Path, dossier: &Path) -> Result<(), ErreurProjet> {
    let mut entrees: Vec<_> = fs::read_dir(dossier)?.flatten().collect();
    entrees.sort_by_key(|e| e.file_name());
    for entree in entrees {
        let nom = entree.file_name().to_string_lossy().into_owned();
        if nom.starts_with('.') || nom == FICHIER_PRECEDENT {
            continue;
        }
        let chemin = entree.path();
        let relatif = chemin.strip_prefix(racine).expect("sous la racine").to_string_lossy().replace('\\', "/");
        if entree.file_type()?.is_dir() {
            ajouter_au_zip(zip, racine, &chemin)?;
        } else {
            // Les images sont déjà compressées : les recompresser ne gagne rien.
            let deja_compresse = !nom.ends_with(".json");
            let methode = if deja_compresse { zip::CompressionMethod::Stored } else { zip::CompressionMethod::Deflated };
            let options = zip::write::SimpleFileOptions::default().compression_method(methode).large_file(true);
            zip.start_file(relatif, options).map_err(|e| io::Error::other(e.to_string()))?;
            io::copy(&mut File::open(&chemin)?, zip)?;
        }
    }
    Ok(())
}

/// Écrit le design dans une archive `.eliot` à l'emplacement choisi.
pub fn exporter_archive(rayon: &Path, id: &str, cible: &Path) -> Result<PathBuf, ErreurProjet> {
    let dossier = dossier_projet(rayon, id)?;
    let mut tampon = io::Cursor::new(Vec::new());
    {
        let mut zip = zip::ZipWriter::new(&mut tampon);
        ajouter_au_zip(&mut zip, &dossier, &dossier)?;
        zip.finish().map_err(|e| io::Error::other(e.to_string()))?;
    }
    ecrire_atomiquement(cible, tampon.get_ref())?;
    Ok(cible.to_path_buf())
}

/// Un chemin d'archive accepté : relatif, sans `..`, et seulement ce qu'un design contient.
fn chemin_d_archive_accepte(nom: &str) -> Option<PathBuf> {
    let chemin = Path::new(nom);
    if !chemin.components().all(|c| matches!(c, Component::Normal(_))) {
        return None;
    }
    let premier = chemin.components().next()?.as_os_str().to_string_lossy().into_owned();
    let accepte = premier == FICHIER_DOCUMENT || premier == FICHIER_MINIATURE || premier == DOSSIER_RESSOURCES;
    let cache = chemin.components().any(|c| c.as_os_str().to_string_lossy().starts_with('.'));
    (accepte && !cache).then(|| chemin.to_path_buf())
}

/// Importe une archive `.eliot` comme nouveau design du rayon. Tout est vérifié avant
/// d'apparaître dans l'accueil : chemins, taille totale, document.
pub fn importer_archive(rayon: &Path, archive: &Path) -> Result<InfoProjet, ErreurProjet> {
    let refus = |raison: &str| ErreurProjet::ArchiveRefusee(raison.to_string());
    let mut zip = zip::ZipArchive::new(File::open(archive)?).map_err(|_| refus("ce n'est pas un fichier .eliot"))?;
    if zip.len() > ENTREES_MAX {
        return Err(refus("trop de fichiers"));
    }
    let mut total = 0u64;
    for i in 0..zip.len() {
        let entree = zip.by_index(i).map_err(|e| refus(&e.to_string()))?;
        total = total.saturating_add(entree.size());
        let nom = entree.name().map_err(|_| refus("nom de fichier illisible"))?.into_owned();
        if entree.is_file() && chemin_d_archive_accepte(&nom).is_none() {
            return Err(refus(&format!("chemin inattendu : {nom}")));
        }
    }
    if total > TAILLE_MAX {
        return Err(refus("contenu trop volumineux"));
    }

    fs::create_dir_all(rayon)?;
    let temporaire = rayon.join(format!(".import-{}", std::process::id()));
    let _ = fs::remove_dir_all(&temporaire);
    let resultat = (|| -> Result<InfoProjet, ErreurProjet> {
        fs::create_dir_all(&temporaire)?;
        for i in 0..zip.len() {
            let mut entree = zip.by_index(i).map_err(|e| refus(&e.to_string()))?;
            if !entree.is_file() {
                continue;
            }
            let nom = entree.name().map_err(|_| refus("nom de fichier illisible"))?.into_owned();
            let relatif = chemin_d_archive_accepte(&nom).ok_or_else(|| refus("chemin inattendu"))?;
            let destination = temporaire.join(relatif);
            if let Some(parent) = destination.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut octets = Vec::with_capacity(entree.size() as usize);
            // La taille annoncée peut mentir : on ne lit jamais plus que la limite.
            (&mut entree).take(TAILLE_MAX).read_to_end(&mut octets)?;
            fs::write(&destination, &octets)?;
        }
        let nom_par_defaut = archive.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
        let document = migrer(lire_document(&temporaire).map_err(|_| refus("document.json absent ou illisible"))?, &nom_par_defaut)?;
        ecrire_atomiquement(&temporaire.join(FICHIER_DOCUMENT), &texte_du_document(&document)?)?;
        fs::create_dir_all(temporaire.join(DOSSIER_RESSOURCES))?;
        let nom = document["nom"].as_str().unwrap_or_default().to_string();
        let destination = dossier_libre(rayon, &nom_de_dossier(&nom));
        fs::rename(&temporaire, &destination)?;
        let id = destination.file_name().expect("dossier nommé").to_string_lossy().into_owned();
        Ok(info(&id, &destination, &document))
    })();
    if resultat.is_err() {
        let _ = fs::remove_dir_all(&temporaire);
    }
    resultat
}

/// Un document vide de la version courante, au format donné.
pub fn document_vide(nom: &str, largeur: u64, hauteur: u64) -> Value {
    let mut page = Map::new();
    page.insert("id".into(), json!("page-1"));
    page.insert("fond".into(), json!("#ffffff"));
    page.insert("elements".into(), json!([]));
    json!({ "version": VERSION_DOCUMENT, "nom": nom, "format": { "largeur": largeur, "hauteur": hauteur }, "pages": [page] })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rayon_de_test(nom: &str) -> PathBuf {
        let dossier = std::env::temp_dir().join(format!("eliot-projets-{nom}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dossier);
        fs::create_dir_all(&dossier).unwrap();
        dossier
    }

    fn texte(document: &Value) -> Vec<u8> {
        serde_json::to_vec(document).unwrap()
    }

    #[test]
    fn un_design_se_cree_s_enregistre_et_se_rouvre() {
        let rayon = rayon_de_test("cycle");
        let info = creer(&rayon, &document_vide("Promo été", 1080, 1350)).unwrap();
        assert_eq!(info.id, "Promo_été");
        assert_eq!((info.largeur, info.hauteur, info.pages), (1080, 1350, 1));

        let mut document = document_vide("Promo été", 1080, 1350);
        document["pages"][0]["fond"] = json!("#ff0000");
        enregistrer(&rayon, &info.id, &texte(&document)).unwrap();
        let (_, relu) = ouvrir(&rayon, &info.id).unwrap();
        assert_eq!(relu["pages"][0]["fond"], "#ff0000");
        assert!(rayon.join(&info.id).join(FICHIER_PRECEDENT).is_file(), "l'ancienne version est gardée");
        fs::remove_dir_all(&rayon).unwrap();
    }

    #[test]
    fn deux_designs_du_meme_nom_ont_deux_dossiers() {
        let rayon = rayon_de_test("doublon");
        let a = creer(&rayon, &document_vide("Affiche", 100, 100)).unwrap();
        let b = creer(&rayon, &document_vide("Affiche", 100, 100)).unwrap();
        assert_eq!((a.id.as_str(), b.id.as_str()), ("Affiche", "Affiche_2"));
        assert_eq!(lister(&rayon).len(), 2);
        fs::remove_dir_all(&rayon).unwrap();
    }

    #[test]
    fn un_document_de_l_etape_1_est_converti() {
        let ancien = json!({
            "version": 1,
            "page": { "largeur": 1080, "hauteur": 1920, "fond": "#123456" },
            "elements": [ { "id": "a1", "type": "forme" } ],
        });
        let nouveau = migrer(ancien, "Ancien").unwrap();
        assert_eq!(nouveau["version"], 2);
        assert_eq!(nouveau["nom"], "Ancien");
        assert_eq!(nouveau["format"]["hauteur"], 1920);
        assert_eq!(nouveau["pages"][0]["fond"], "#123456");
        assert_eq!(nouveau["pages"][0]["elements"][0]["id"], "a1");
    }

    #[test]
    fn un_document_trop_recent_ou_bancal_est_refuse() {
        assert!(matches!(migrer(json!({ "version": 99 }), "x"), Err(ErreurProjet::VersionFuture(99))));
        assert!(migrer(json!({ "version": 2, "nom": "x" }), "x").is_err());
        let rayon = rayon_de_test("refus");
        let info = creer(&rayon, &document_vide("Bon", 10, 10)).unwrap();
        assert!(enregistrer(&rayon, &info.id, b"{ pas du json").is_err());
        assert!(enregistrer(&rayon, &info.id, &texte(&json!({ "version": 2 }))).is_err());
        let (_, relu) = ouvrir(&rayon, &info.id).unwrap();
        assert_eq!(relu["nom"], "Bon", "un enregistrement refusé ne touche pas au fichier");
        fs::remove_dir_all(&rayon).unwrap();
    }

    #[test]
    fn un_document_abime_est_rouvert_depuis_la_version_precedente() {
        let rayon = rayon_de_test("secours");
        let info = creer(&rayon, &document_vide("Secours", 10, 10)).unwrap();
        let mut document = document_vide("Secours", 10, 10);
        document["pages"][0]["fond"] = json!("#00ff00");
        enregistrer(&rayon, &info.id, &texte(&document)).unwrap();
        fs::write(rayon.join(&info.id).join(FICHIER_DOCUMENT), b"{ tronque").unwrap();
        let (_, relu) = ouvrir(&rayon, &info.id).unwrap();
        assert_eq!(relu["pages"][0]["fond"], "#ffffff", "la version précédente est rouverte");
        fs::remove_dir_all(&rayon).unwrap();
    }

    #[test]
    fn renommer_change_le_nom_et_le_dossier() {
        let rayon = rayon_de_test("renommer");
        let info = creer(&rayon, &document_vide("Design sans titre", 10, 10)).unwrap();
        fs::write(rayon.join(&info.id).join(DOSSIER_RESSOURCES).join("garde.txt"), b"x").unwrap();
        let renomme = renommer(&rayon, &info.id, "Pub sneakers").unwrap();
        assert_eq!(renomme.id, "Pub_sneakers");
        assert_eq!(renomme.nom, "Pub sneakers");
        assert!(!rayon.join(&info.id).exists());
        assert!(rayon.join("Pub_sneakers").join(DOSSIER_RESSOURCES).join("garde.txt").is_file());
        let (_, relu) = ouvrir(&rayon, "Pub_sneakers").unwrap();
        assert_eq!(relu["nom"], "Pub sneakers");
        fs::remove_dir_all(&rayon).unwrap();
    }

    #[test]
    fn dupliquer_copie_tout_vers_un_autre_rayon() {
        let racine = rayon_de_test("dupliquer");
        let (designs, modeles) = (racine.join("Designs"), racine.join("Modèles"));
        let info = creer(&designs, &document_vide("Base", 10, 10)).unwrap();
        fs::write(rayon_projet(&designs, &info.id).join(DOSSIER_RESSOURCES).join("photo.jpg"), b"x").unwrap();
        let modele = dupliquer(&designs, &info.id, &modeles, "Mon modèle").unwrap();
        assert_eq!(modele.nom, "Mon modèle");
        assert!(modeles.join(&modele.id).join(DOSSIER_RESSOURCES).join("photo.jpg").is_file());
        assert_eq!(lister(&designs).len(), 1);
        assert_eq!(lister(&modeles).len(), 1);
        fs::remove_dir_all(&racine).unwrap();
    }

    fn rayon_projet(rayon: &Path, id: &str) -> PathBuf {
        rayon.join(id)
    }

    #[test]
    fn supprimer_confie_le_dossier_a_la_corbeille() {
        let rayon = rayon_de_test("supprimer");
        let corbeille = rayon_de_test("corbeille");
        let info = creer(&rayon, &document_vide("Jetable", 10, 10)).unwrap();
        supprimer(&rayon, &info.id, |chemin| fs::rename(chemin, corbeille.join("Jetable"))).unwrap();
        assert!(lister(&rayon).is_empty());
        assert!(corbeille.join("Jetable").join(FICHIER_DOCUMENT).is_file());
        fs::remove_dir_all(&rayon).unwrap();
        fs::remove_dir_all(&corbeille).unwrap();
    }

    #[test]
    fn un_identifiant_douteux_est_refuse() {
        let rayon = rayon_de_test("douteux");
        for id in ["", "..", "../x", "a/b", ".cache", "/etc"] {
            assert!(matches!(ouvrir(&rayon, id), Err(ErreurProjet::IdentifiantInvalide)), "{id}");
        }
        assert!(matches!(ouvrir(&rayon, "absent"), Err(ErreurProjet::Introuvable)));
        fs::remove_dir_all(&rayon).unwrap();
    }

    #[test]
    fn une_archive_eliot_fait_l_aller_et_retour() {
        let racine = rayon_de_test("archive");
        let (a, b) = (racine.join("poste_a"), racine.join("poste_b"));
        let info = creer(&a, &document_vide("Voyage", 1080, 1080)).unwrap();
        let ressources = a.join(&info.id).join(DOSSIER_RESSOURCES).join("apercus");
        fs::create_dir_all(&ressources).unwrap();
        fs::write(ressources.join("image.jpg"), b"octets de l'image").unwrap();
        enregistrer_miniature(&a, &info.id, &[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]).unwrap();

        let fichier = racine.join("Voyage.eliot");
        exporter_archive(&a, &info.id, &fichier).unwrap();
        let importe = importer_archive(&b, &fichier).unwrap();
        assert_eq!(importe.nom, "Voyage");
        assert!(importe.miniature);
        assert_eq!(fs::read(b.join(&importe.id).join("ressources/apercus/image.jpg")).unwrap(), b"octets de l'image");
        // Un second import du même fichier ne remplace rien : il crée « Voyage_2 ».
        assert_eq!(importer_archive(&b, &fichier).unwrap().id, "Voyage_2");
        fs::remove_dir_all(&racine).unwrap();
    }

    #[test]
    fn une_archive_piegee_est_refusee_sans_rien_ecrire() {
        let racine = rayon_de_test("piege");
        let fichier = racine.join("piege.eliot");
        {
            let mut zip = zip::ZipWriter::new(File::create(&fichier).unwrap());
            let options = zip::write::SimpleFileOptions::default();
            zip.start_file("document.json", options).unwrap();
            zip.write_all(&texte(&document_vide("Piège", 10, 10))).unwrap();
            zip.start_file("../../evasion.txt", options).unwrap();
            zip.write_all(b"dehors").unwrap();
            zip.finish().unwrap();
        }
        let rayon = racine.join("Designs");
        assert!(matches!(importer_archive(&rayon, &fichier), Err(ErreurProjet::ArchiveRefusee(_))));
        assert!(lister(&rayon).is_empty());
        assert!(!racine.parent().unwrap().join("evasion.txt").exists());
        assert!(chemin_d_archive_accepte("ressources/apercus/x.jpg").is_some());
        assert!(chemin_d_archive_accepte("ressources/../../x").is_none());
        assert!(chemin_d_archive_accepte("/etc/passwd").is_none());
        assert!(chemin_d_archive_accepte("autre.txt").is_none());
        fs::remove_dir_all(&racine).unwrap();
    }
}
