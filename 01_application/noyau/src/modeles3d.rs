//! Les modèles 3D (étape 6, lot 1) : un modèle entre dans les ressources du design comme une
//! image. Le noyau le vérifie, range l'original une seule fois (empreinte SHA-256) et prépare
//! la copie que la fenêtre charge (règle 5, comme l'aperçu d'une photo) :
//!
//! - un GLB garde sa forme ; ses textures de plus de 2048 px sont ramenées à 2048 dans la copie ;
//! - un glTF et les fichiers qu'il cite (tampons, textures, rangés à côté de lui) deviennent un
//!   seul GLB, qui sert d'original ; sa copie, textures réduites, comme pour un GLB ;
//! - un FBX (Mixamo) ou un OBJ est chargé tel quel par la fenêtre : la copie est l'original.
//!
//! La fenêtre seule sait dessiner la 3D : elle rend la miniature après l'import et la confie au
//! noyau (`enregistrer_miniature`), qui la range comme celle d'une image.
//!
//! Rangement : `originaux/<empreinte>.(glb|fbx|obj)`, `copies/<empreinte>.glb` (si la copie
//! diffère de l'original), `apercus/<empreinte>.png` (512 px), `miniatures/<empreinte>.png`
//! (256 px), `infos/<empreinte>.json`.

use std::fs;
use std::path::{Component, Path, PathBuf};

use base64::Engine;
use image::DynamicImage;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use thiserror::Error;

use crate::fichiers::ecrire_atomiquement;
use crate::images::{self, Ressource};

/// Le plus grand côté d'une texture dans la copie de la fenêtre.
pub const COTE_TEXTURE: u32 = 2048;
/// Le plus gros fichier accepté (un modèle, ou un glTF avec tout ce qu'il cite).
pub const TAILLE_MAX: u64 = 300 * 1024 * 1024;
/// Le côté de l'aperçu d'un modèle (sa miniature agrandie, pour les panneaux).
pub const COTE_APERCU: u32 = 512;

/// Extensions reconnues comme des modèles 3D à l'import.
pub const EXTENSIONS: [&str; 4] = ["glb", "gltf", "fbx", "obj"];

#[derive(Debug, Error)]
pub enum ErreurModele {
    #[error("lecture impossible : {0}")]
    Lecture(#[from] std::io::Error),
    #[error("{0}")]
    Format(String),
    #[error("fichier trop gros : {0} Mo, au plus {max} Mo", max = TAILLE_MAX / 1024 / 1024)]
    TropGros(u64),
    #[error("{0}")]
    Image(#[from] images::ErreurImage),
}

/// Ce que la fenêtre sait d'un modèle, rangé avec la ressource.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InfosModele3d {
    /// Le format de l'original : `glb` (un glTF importé devient un GLB), `fbx` ou `obj`.
    pub format: String,
    /// L'extension de la copie chargée par la fenêtre, ou `original` si c'est l'original même.
    pub copie: String,
    /// Les animations du modèle, par leur nom (un GLB ; celles d'un FBX, la fenêtre les lit).
    #[serde(default)]
    pub animations: Vec<String>,
    /// Les matières du modèle, par leur nom (un GLB).
    #[serde(default)]
    pub matieres: Vec<String>,
    /// Le nombre de triangles (un GLB).
    #[serde(default)]
    pub triangles: u64,
    /// Les textures ramenées à 2048 px dans la copie.
    #[serde(default)]
    pub textures_reduites: u32,
    /// La miniature a été rendue par la fenêtre.
    #[serde(default)]
    pub miniature: bool,
}

pub fn est_un_modele(chemin: &Path) -> bool {
    chemin.extension().is_some_and(|e| EXTENSIONS.contains(&e.to_string_lossy().to_lowercase().as_str()))
}

fn empreinte(octets: &[u8]) -> String {
    Sha256::digest(octets).iter().map(|o| format!("{o:02x}")).collect()
}

fn format_err(texte: impl Into<String>) -> ErreurModele {
    ErreurModele::Format(texte.into())
}

// ----------------------------------------------------------------------------------------
// GLB : lecture et écriture
// ----------------------------------------------------------------------------------------

const MAGIE_GLB: &[u8; 4] = b"glTF";
const CHUNK_JSON: u32 = 0x4E4F_534A;
const CHUNK_BIN: u32 = 0x004E_4942;

fn u32_le(o: &[u8], i: usize) -> Option<u32> {
    o.get(i..i + 4).map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
}

/// Le JSON et le tampon binaire d'un GLB (version 2), vérifiés.
pub fn lire_glb(octets: &[u8]) -> Result<(Value, Vec<u8>), ErreurModele> {
    if octets.len() < 20 || &octets[0..4] != MAGIE_GLB {
        return Err(format_err("ce n'est pas un GLB (en-tête « glTF » absent)"));
    }
    if u32_le(octets, 4) != Some(2) {
        return Err(format_err("GLB d'une version autre que 2 : non pris en charge"));
    }
    let longueur = u32_le(octets, 8).unwrap_or(0) as usize;
    if longueur > octets.len() || longueur < 20 {
        return Err(format_err("GLB tronqué"));
    }
    let mut json = None;
    let mut bin = Vec::new();
    let mut i = 12;
    while i + 8 <= longueur {
        let taille = u32_le(octets, i).unwrap_or(0) as usize;
        let genre = u32_le(octets, i + 4).unwrap_or(0);
        let debut = i + 8;
        let fin = debut.checked_add(taille).filter(|f| *f <= longueur).ok_or_else(|| format_err("GLB : bloc tronqué"))?;
        match genre {
            CHUNK_JSON if json.is_none() => json = Some(serde_json::from_slice::<Value>(&octets[debut..fin]).map_err(|e| format_err(format!("GLB : JSON illisible ({e})")))?),
            CHUNK_BIN if bin.is_empty() => bin = octets[debut..fin].to_vec(),
            _ => {}
        }
        i = fin + (4 - fin % 4) % 4;
    }
    let json = json.ok_or_else(|| format_err("GLB sans JSON"))?;
    verifier_asset(&json)?;
    Ok((json, bin))
}

fn verifier_asset(json: &Value) -> Result<(), ErreurModele> {
    let version = json.pointer("/asset/version").and_then(Value::as_str).unwrap_or("");
    if !version.starts_with('2') {
        return Err(format_err(format!("glTF de version « {version} » : seule la version 2 est prise en charge")));
    }
    Ok(())
}

/// Un GLB à partir d'un JSON et d'un tampon binaire (blocs alignés sur 4 octets).
pub fn ecrire_glb(json: &Value, bin: &[u8]) -> Vec<u8> {
    let mut texte = serde_json::to_vec(json).expect("JSON sérialisable");
    while texte.len() % 4 != 0 {
        texte.push(b' ');
    }
    let mut binaire = bin.to_vec();
    while binaire.len() % 4 != 0 {
        binaire.push(0);
    }
    let avec_bin = !binaire.is_empty();
    let total = 12 + 8 + texte.len() + if avec_bin { 8 + binaire.len() } else { 0 };
    let mut sortie = Vec::with_capacity(total);
    sortie.extend_from_slice(MAGIE_GLB);
    sortie.extend_from_slice(&2u32.to_le_bytes());
    sortie.extend_from_slice(&(total as u32).to_le_bytes());
    sortie.extend_from_slice(&(texte.len() as u32).to_le_bytes());
    sortie.extend_from_slice(&CHUNK_JSON.to_le_bytes());
    sortie.extend_from_slice(&texte);
    if avec_bin {
        sortie.extend_from_slice(&(binaire.len() as u32).to_le_bytes());
        sortie.extend_from_slice(&CHUNK_BIN.to_le_bytes());
        sortie.extend_from_slice(&binaire);
    }
    sortie
}

// ----------------------------------------------------------------------------------------
// Empaqueter : un seul tampon, les images dedans, réduites au besoin
// ----------------------------------------------------------------------------------------

/// Les octets d'une adresse `data:` (base64), ou `None`.
fn donnees_uri(uri: &str) -> Option<Vec<u8>> {
    let reste = uri.strip_prefix("data:")?;
    let (entete, donnees) = reste.split_once(',')?;
    if entete.ends_with(";base64") {
        base64::engine::general_purpose::STANDARD.decode(donnees.trim()).ok()
    } else {
        Some(decoder_pourcent(donnees).into_bytes())
    }
}

fn decoder_pourcent(texte: &str) -> String {
    let o = texte.as_bytes();
    let mut sortie = Vec::with_capacity(o.len());
    let mut i = 0;
    while i < o.len() {
        if o[i] == b'%' && i + 2 < o.len() {
            if let Ok(v) = u8::from_str_radix(&texte[i + 1..i + 3], 16) {
                sortie.push(v);
                i += 3;
                continue;
            }
        }
        sortie.push(o[i]);
        i += 1;
    }
    String::from_utf8_lossy(&sortie).into_owned()
}

/// Un fichier cité par un glTF, lu à côté de lui : jamais au-dessus de son dossier, jamais un
/// chemin absolu ni une adresse réseau.
fn lire_voisin(dossier: &Path, uri: &str) -> Result<Vec<u8>, ErreurModele> {
    if uri.contains("://") {
        return Err(format_err(format!("glTF : « {uri} » est une adresse réseau ; Eliot ne lit que les fichiers rangés à côté du glTF")));
    }
    let relatif = PathBuf::from(decoder_pourcent(uri));
    if relatif.components().any(|c| !matches!(c, Component::Normal(_) | Component::CurDir)) {
        return Err(format_err(format!("glTF : « {uri} » sort du dossier du modèle")));
    }
    let chemin = dossier.join(relatif);
    fs::read(&chemin).map_err(|e| format_err(format!("glTF : fichier cité introuvable, « {uri} » ({e})")))
}

/// Une image réduite à 2048 px si elle est plus grande ; `None` si elle reste telle quelle
/// (petite, ou d'un format que le noyau ne lit pas, comme KTX2).
fn reduire_texture(octets: &[u8], cote: u32) -> Option<(Vec<u8>, &'static str)> {
    let format = image::guess_format(octets).ok()?;
    if !matches!(format, image::ImageFormat::Png | image::ImageFormat::Jpeg | image::ImageFormat::WebP) {
        return None;
    }
    let image = image::load_from_memory(octets).ok()?;
    if image.width().max(image.height()) <= cote {
        return None;
    }
    let alpha = image.color().has_alpha();
    let image = if alpha { DynamicImage::ImageRgba8(image.to_rgba8()) } else { DynamicImage::ImageRgb8(image.to_rgb8()) };
    let petite = images::reduire(&image, cote).ok()?;
    let octets = images::encoder(&petite, alpha).ok()?;
    Some((octets, if alpha { "image/png" } else { "image/jpeg" }))
}

fn aligner(tampon: &mut Vec<u8>) {
    while tampon.len() % 4 != 0 {
        tampon.push(0);
    }
}

/// Un glTF en un seul GLB : chaque vue garde son rang (accesseurs et extensions ne changent
/// pas), ses octets sont recopiés à la suite dans un tampon unique ; les images citées par une
/// adresse y entrent comme des vues nouvelles. `reduire` : les textures de plus de 2048 px y
/// sont réduites. Renvoie le GLB et le nombre de textures réduites.
fn empaqueter(mut json: Value, tampons: &[Vec<u8>], dossier: Option<&Path>, reduire: bool) -> Result<(Vec<u8>, u32), ErreurModele> {
    let vues_images: std::collections::HashSet<usize> = json
        .get("images")
        .and_then(Value::as_array)
        .map(|l| l.iter().filter_map(|i| i.get("bufferView").and_then(Value::as_u64)).map(|v| v as usize).collect())
        .unwrap_or_default();
    let mut bin = Vec::new();
    let mut reduites = 0;
    // Les vues : recopiées à la suite ; celles d'une image, réduite si elle est trop grande.
    let mut mimes_vues: std::collections::HashMap<usize, &'static str> = std::collections::HashMap::new();
    if let Some(vues) = json.get_mut("bufferViews").and_then(Value::as_array_mut) {
        for (rang, vue) in vues.iter_mut().enumerate() {
            let tampon = vue.get("buffer").and_then(Value::as_u64).unwrap_or(0) as usize;
            let decalage = vue.get("byteOffset").and_then(Value::as_u64).unwrap_or(0) as usize;
            let longueur = vue.get("byteLength").and_then(Value::as_u64).unwrap_or(0) as usize;
            let source = tampons.get(tampon).ok_or_else(|| format_err("glTF : une vue cite un tampon absent"))?;
            let octets = source.get(decalage..decalage + longueur).ok_or_else(|| format_err("glTF : une vue dépasse son tampon"))?;
            let nouveaux = if reduire && vues_images.contains(&rang) {
                match reduire_texture(octets, COTE_TEXTURE) {
                    Some((o, mime)) => {
                        reduites += 1;
                        mimes_vues.insert(rang, mime);
                        o
                    }
                    None => octets.to_vec(),
                }
            } else {
                octets.to_vec()
            };
            aligner(&mut bin);
            vue["buffer"] = json!(0);
            vue["byteOffset"] = json!(bin.len());
            vue["byteLength"] = json!(nouveaux.len());
            bin.extend_from_slice(&nouveaux);
        }
    }
    // Les images citées par une adresse (fichier voisin ou `data:`) entrent dans le tampon.
    let nb_vues = json.get("bufferViews").and_then(Value::as_array).map_or(0, Vec::len);
    let mut nouvelles_vues = Vec::new();
    if let Some(images_json) = json.get_mut("images").and_then(Value::as_array_mut) {
        for image in images_json.iter_mut() {
            if let Some(v) = image.get("bufferView").and_then(Value::as_u64) {
                if let Some(mime) = mimes_vues.get(&(v as usize)) {
                    image["mimeType"] = json!(mime);
                }
                continue;
            }
            let Some(uri) = image.get("uri").and_then(Value::as_str).map(str::to_string) else { continue };
            let octets = match donnees_uri(&uri) {
                Some(o) => o,
                None => lire_voisin(dossier.ok_or_else(|| format_err("glTF : une image citée par son nom, sans son dossier"))?, &uri)?,
            };
            let (octets, mime) = match if reduire { reduire_texture(&octets, COTE_TEXTURE) } else { None } {
                Some((o, m)) => {
                    reduites += 1;
                    (o, m.to_string())
                }
                None => {
                    let mime = match image::guess_format(&octets) {
                        Ok(image::ImageFormat::Png) => "image/png",
                        Ok(image::ImageFormat::Jpeg) => "image/jpeg",
                        Ok(image::ImageFormat::WebP) => "image/webp",
                        _ if uri.to_lowercase().ends_with(".ktx2") => "image/ktx2",
                        _ => "image/png",
                    };
                    (octets, image.get("mimeType").and_then(Value::as_str).unwrap_or(mime).to_string())
                }
            };
            aligner(&mut bin);
            nouvelles_vues.push(json!({ "buffer": 0, "byteOffset": bin.len(), "byteLength": octets.len() }));
            bin.extend_from_slice(&octets);
            let objet = image.as_object_mut().expect("une image est un objet");
            objet.remove("uri");
            objet.insert("bufferView".into(), json!(nb_vues + nouvelles_vues.len() - 1));
            objet.insert("mimeType".into(), json!(mime));
        }
    }
    if !nouvelles_vues.is_empty() {
        let vues = json.as_object_mut().expect("glTF objet").entry("bufferViews").or_insert_with(|| json!([]));
        vues.as_array_mut().expect("liste de vues").extend(nouvelles_vues);
    }
    aligner(&mut bin);
    json["buffers"] = if bin.is_empty() { json!([]) } else { json!([{ "byteLength": bin.len() }]) };
    Ok((ecrire_glb(&json, &bin), reduites))
}

/// Les tampons d'un glTF : le bloc binaire d'un GLB, les adresses `data:`, les fichiers voisins.
fn tampons_du_gltf(json: &Value, bin_glb: Option<&[u8]>, dossier: Option<&Path>) -> Result<Vec<Vec<u8>>, ErreurModele> {
    let mut tampons = Vec::new();
    for (rang, tampon) in json.get("buffers").and_then(Value::as_array).cloned().unwrap_or_default().iter().enumerate() {
        let octets = match tampon.get("uri").and_then(Value::as_str) {
            None if rang == 0 => bin_glb.map(<[u8]>::to_vec).ok_or_else(|| format_err("glTF : tampon sans adresse hors d'un GLB"))?,
            None => return Err(format_err("glTF : tampon sans adresse")),
            Some(uri) => match donnees_uri(uri) {
                Some(o) => o,
                None => lire_voisin(dossier.ok_or_else(|| format_err("glTF : un tampon cité par son nom, sans son dossier"))?, uri)?,
            },
        };
        tampons.push(octets);
    }
    Ok(tampons)
}

/// Ce qu'on sait d'un glTF sans le dessiner : animations, matières, triangles.
fn decrire(json: &Value) -> (Vec<String>, Vec<String>, u64) {
    let noms = |cle: &str, defaut: &str| -> Vec<String> {
        json.get(cle)
            .and_then(Value::as_array)
            .map(|l| l.iter().enumerate().map(|(i, e)| e.get("name").and_then(Value::as_str).filter(|n| !n.is_empty()).map_or_else(|| format!("{defaut} {}", i + 1), str::to_string)).collect())
            .unwrap_or_default()
    };
    let accesseurs = json.get("accessors").and_then(Value::as_array).cloned().unwrap_or_default();
    let compte = |i: Option<u64>| i.and_then(|i| accesseurs.get(i as usize)).and_then(|a| a.get("count")).and_then(Value::as_u64).unwrap_or(0);
    let mut triangles = 0;
    for maillage in json.get("meshes").and_then(Value::as_array).cloned().unwrap_or_default() {
        for p in maillage.get("primitives").and_then(Value::as_array).cloned().unwrap_or_default() {
            // Mode 4 (triangles) par défaut ; les autres (lignes, points) ne comptent pas.
            if p.get("mode").and_then(Value::as_u64).unwrap_or(4) != 4 {
                continue;
            }
            let n = match p.get("indices").and_then(Value::as_u64) {
                Some(i) => compte(Some(i)),
                None => compte(p.pointer("/attributes/POSITION").and_then(Value::as_u64)),
            };
            triangles += n / 3;
        }
    }
    (noms("animations", "Animation"), noms("materials", "Matière"), triangles)
}

// ----------------------------------------------------------------------------------------
// Reconnaître FBX et OBJ
// ----------------------------------------------------------------------------------------

fn est_fbx(octets: &[u8]) -> bool {
    if octets.starts_with(b"Kaydara FBX Binary  \0") {
        return true;
    }
    // Un FBX en texte : des commentaires « ; », puis « FBXHeaderExtension: ».
    let debut = String::from_utf8_lossy(&octets[..octets.len().min(4096)]).into_owned();
    debut.lines().map(str::trim).find(|l| !l.is_empty() && !l.starts_with(';')).is_some_and(|l| l.starts_with("FBXHeaderExtension"))
        || debut.trim_start().starts_with("; FBX")
}

fn est_obj(octets: &[u8]) -> bool {
    if std::str::from_utf8(&octets[..octets.len().min(65536)]).is_err() && octets.len() <= 65536 {
        return false;
    }
    let texte = String::from_utf8_lossy(&octets[..octets.len().min(1 << 20)]);
    let mut sommets = false;
    let mut faces = false;
    for ligne in texte.lines() {
        let l = ligne.trim_start();
        sommets |= l.starts_with("v ");
        faces |= l.starts_with("f ");
        if sommets && faces {
            return true;
        }
    }
    false
}

// ----------------------------------------------------------------------------------------
// Importer
// ----------------------------------------------------------------------------------------

/// Un glTF (ou un GLB) qui cite des fichiers par leur nom : un tampon ou une image hors du bloc
/// binaire et hors d'une adresse `data:`.
fn cite_des_fichiers(json: &Value) -> bool {
    let externe = |e: &Value| e.get("uri").and_then(Value::as_str).is_some_and(|u| !u.starts_with("data:"));
    ["buffers", "images"].iter().any(|cle| json.get(*cle).and_then(Value::as_array).is_some_and(|l| l.iter().any(externe)))
}

fn ecrire_infos(dossier: &Path, ressource: &Ressource) -> Result<(), ErreurModele> {
    let infos = serde_json::to_vec_pretty(ressource).map_err(|e| format_err(e.to_string()))?;
    ecrire_atomiquement(&dossier.join("infos").join(format!("{}.json", ressource.id)), &infos)?;
    Ok(())
}

/// Importe un modèle (GLB, glTF et ses fichiers voisins, FBX, OBJ) depuis un fichier du poste.
pub fn importer_fichier(chemin: &Path, dossier: &Path) -> Result<Ressource, ErreurModele> {
    let taille = fs::metadata(chemin)?.len();
    if taille > TAILLE_MAX {
        return Err(ErreurModele::TropGros(taille / 1024 / 1024));
    }
    let octets = fs::read(chemin)?;
    let nom = chemin.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    importer(&octets, &nom, chemin.parent(), dossier)
}

/// Importe un modèle à partir de ses octets. `voisins` : le dossier où lire les fichiers cités
/// par un glTF. Le même modèle déjà importé n'est pas refait.
pub fn importer(octets: &[u8], nom: &str, voisins: Option<&Path>, dossier: &Path) -> Result<Ressource, ErreurModele> {
    if octets.len() as u64 > TAILLE_MAX {
        return Err(ErreurModele::TropGros(octets.len() as u64 / 1024 / 1024));
    }
    let extension = Path::new(nom).extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    // Ce qui part en original : le GLB tel quel, le glTF empaqueté, le FBX ou l'OBJ tel quel.
    let (original, format, json) = if octets.starts_with(MAGIE_GLB) {
        let (json, bin) = lire_glb(octets)?;
        if cite_des_fichiers(&json) {
            // Un GLB qui cite des fichiers rangés à côté de lui (les paquets de Kenney : leur
            // texture commune) : empaqueté comme un glTF.
            let tampons = tampons_du_gltf(&json, Some(&bin), voisins)?;
            let (glb, _) = empaqueter(json, &tampons, voisins, false)?;
            let (json, _) = lire_glb(&glb)?;
            (glb, "glb", Some(json))
        } else {
            (octets.to_vec(), "glb", Some(json))
        }
    } else if extension == "gltf" || (octets.first() == Some(&b'{') && extension != "obj") {
        let json: Value = serde_json::from_slice(octets).map_err(|e| format_err(format!("glTF illisible ({e})")))?;
        verifier_asset(&json)?;
        let tampons = tampons_du_gltf(&json, None, voisins)?;
        let total: u64 = tampons.iter().map(|t| t.len() as u64).sum();
        if total > TAILLE_MAX {
            return Err(ErreurModele::TropGros(total / 1024 / 1024));
        }
        let (glb, _) = empaqueter(json, &tampons, voisins, false)?;
        let (json, _) = lire_glb(&glb)?;
        (glb, "glb", Some(json))
    } else if est_fbx(octets) {
        (octets.to_vec(), "fbx", None)
    } else if est_obj(octets) {
        (octets.to_vec(), "obj", None)
    } else {
        return Err(format_err(format!("« {nom} » n'est pas un modèle 3D reconnu (GLB, glTF, FBX, OBJ)")));
    };
    let id = empreinte(&original);
    if let Ok(deja) = images::infos(dossier, &id) {
        if deja.modele3d.is_some() {
            return Ok(Ressource { nom: nom.to_string(), ..deja });
        }
    }
    for sous_dossier in ["originaux", "copies", "apercus", "miniatures", "infos"] {
        fs::create_dir_all(dossier.join(sous_dossier))?;
    }
    ecrire_atomiquement(&dossier.join("originaux").join(format!("{id}.{format}")), &original)?;
    let mut infos = InfosModele3d { format: format.into(), copie: "original".into(), ..InfosModele3d::default() };
    if let Some(json) = json {
        let (animations, matieres, triangles) = decrire(&json);
        infos.animations = animations;
        infos.matieres = matieres;
        infos.triangles = triangles;
        // La copie de la fenêtre : textures ramenées à 2048 px. Un modèle compressé par
        // meshopt garde ses textures (ses vues ne se recopient pas telles quelles).
        let meshopt = json.get("extensionsUsed").and_then(Value::as_array).is_some_and(|l| l.iter().any(|e| e.as_str() == Some("EXT_meshopt_compression")));
        if !meshopt {
            let (_, bin) = lire_glb(&original)?;
            let tampons = tampons_du_gltf(&json, Some(&bin), None)?;
            let (copie, reduites) = empaqueter(json, &tampons, None, true)?;
            if reduites > 0 {
                ecrire_atomiquement(&dossier.join("copies").join(format!("{id}.glb")), &copie)?;
                infos.copie = "glb".into();
                infos.textures_reduites = reduites;
            }
        }
    }
    let ressource = Ressource {
        id,
        nom: nom.to_string(),
        largeur: COTE_APERCU,
        hauteur: COTE_APERCU,
        transparence: true,
        format_apercu: "png".into(),
        credit: None,
        video: None,
        son: None,
        modele3d: Some(infos),
        environnement3d: None,
    };
    ecrire_infos(dossier, &ressource)?;
    Ok(ressource)
}

/// Importe un modèle venu d'une banque (Poly Haven, Sketchfab, Kenney), avec son crédit et son
/// nom ; un glTF lit ses fichiers à côté de lui.
pub fn importer_avec_credit(chemin: &Path, nom: &str, dossier: &Path, credit: images::Credit) -> Result<Ressource, ErreurModele> {
    let taille = fs::metadata(chemin)?.len();
    if taille > TAILLE_MAX {
        return Err(ErreurModele::TropGros(taille / 1024 / 1024));
    }
    let octets = fs::read(chemin)?;
    let extension = chemin.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    let mut r = importer(&octets, &format!("{nom}.{extension}"), chemin.parent(), dossier)?;
    r.nom = nom.to_string();
    r.credit = Some(credit);
    ecrire_infos(dossier, &r)?;
    Ok(r)
}

/// La miniature d'un modèle, rendue par la fenêtre (PNG, fond transparent) : rangée en aperçu
/// de 512 px et en miniature de 256 px, comme celles d'une image.
pub fn enregistrer_miniature(dossier: &Path, id: &str, png: &[u8]) -> Result<Ressource, ErreurModele> {
    let mut ressource = images::infos(dossier, id)?;
    let Some(infos) = ressource.modele3d.as_mut() else {
        return Err(format_err("cette ressource n'est pas un modèle 3D"));
    };
    if image::guess_format(png).ok() != Some(image::ImageFormat::Png) {
        return Err(format_err("la miniature doit être un PNG"));
    }
    let image = image::load_from_memory(png).map_err(|e| format_err(format!("miniature illisible ({e})")))?;
    let image = DynamicImage::ImageRgba8(image.to_rgba8());
    let apercu = images::reduire(&image, COTE_APERCU)?;
    let miniature = images::reduire(&apercu, images::COTE_MINIATURE)?;
    ecrire_atomiquement(&dossier.join("apercus").join(format!("{id}.png")), &images::encoder(&apercu, true)?)?;
    ecrire_atomiquement(&dossier.join("miniatures").join(format!("{id}.png")), &images::encoder(&miniature, true)?)?;
    infos.miniature = true;
    ecrire_infos(dossier, &ressource)?;
    Ok(ressource)
}

/// Le fichier que la fenêtre charge : la copie, ou l'original quand ils ne diffèrent pas.
pub fn chemin_copie(dossier: &Path, ressource: &Ressource) -> Option<PathBuf> {
    let infos = ressource.modele3d.as_ref()?;
    Some(if infos.copie == "original" {
        dossier.join("originaux").join(format!("{}.{}", ressource.id, infos.format))
    } else {
        dossier.join("copies").join(format!("{}.{}", ressource.id, infos.copie))
    })
}

/// Les fichiers d'un modèle en plus de l'original, de l'aperçu et de la miniature (copier d'un
/// design à l'autre).
pub fn fichiers_en_plus(dossier: &Path, ressource: &Ressource) -> Vec<PathBuf> {
    match &ressource.modele3d {
        Some(infos) if infos.copie != "original" => vec![dossier.join("copies").join(format!("{}.{}", ressource.id, infos.copie))],
        _ => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dossier_de_test(nom: &str) -> PathBuf {
        let dossier = std::env::temp_dir().join(format!("eliot-modeles3d-{nom}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dossier);
        fs::create_dir_all(&dossier).unwrap();
        dossier
    }

    fn png(l: u32, h: u32) -> Vec<u8> {
        let image = DynamicImage::ImageRgb8(image::RgbImage::from_fn(l, h, |x, y| image::Rgb([(x % 256) as u8, (y % 256) as u8, 90])));
        images::encoder(&image, true).unwrap()
    }

    /// Un triangle texturé, son tampon : trois positions (36 octets), trois indices (6 octets,
    /// complétés à 8).
    fn triangle() -> (Value, Vec<u8>) {
        let mut bin = Vec::new();
        for v in [0.0f32, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0] {
            bin.extend_from_slice(&v.to_le_bytes());
        }
        for i in [0u16, 1, 2, 0] {
            bin.extend_from_slice(&i.to_le_bytes());
        }
        let json = json!({
            "asset": { "version": "2.0" },
            "buffers": [{ "byteLength": bin.len() }],
            "bufferViews": [{ "buffer": 0, "byteOffset": 0, "byteLength": 36 }, { "buffer": 0, "byteOffset": 36, "byteLength": 6 }],
            "accessors": [
                { "bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3", "min": [0, 0, 0], "max": [1, 1, 0] },
                { "bufferView": 1, "componentType": 5123, "count": 3, "type": "SCALAR" }
            ],
            "materials": [{ "name": "Étiquette", "pbrMetallicRoughness": { "baseColorTexture": { "index": 0 } } }, {}],
            "textures": [{ "source": 0 }],
            "meshes": [{ "primitives": [{ "attributes": { "POSITION": 0 }, "indices": 1, "material": 0 }] }],
            "nodes": [{ "mesh": 0 }],
            "scenes": [{ "nodes": [0] }],
            "animations": [{ "name": "Tourner", "channels": [], "samplers": [] }]
        });
        (json, bin)
    }

    #[test]
    fn un_glb_entre_et_sa_copie_a_des_textures_de_2048_px_au_plus() {
        let dossier = dossier_de_test("glb");
        let (mut json, mut bin) = triangle();
        // Une texture de 3000 px dans le tampon.
        let texture = png(3000, 100);
        while bin.len() % 4 != 0 {
            bin.push(0);
        }
        let debut = bin.len();
        bin.extend_from_slice(&texture);
        json["bufferViews"].as_array_mut().unwrap().push(json!({ "buffer": 0, "byteOffset": debut, "byteLength": texture.len() }));
        json["images"] = json!([{ "bufferView": 2, "mimeType": "image/png" }]);
        json["buffers"] = json!([{ "byteLength": bin.len() }]);
        let glb = ecrire_glb(&json, &bin);
        let r = importer(&glb, "flacon.glb", None, &dossier).unwrap();
        let infos = r.modele3d.clone().unwrap();
        assert_eq!((infos.format.as_str(), infos.copie.as_str(), infos.textures_reduites), ("glb", "glb", 1));
        assert_eq!(infos.animations, vec!["Tourner"]);
        assert_eq!(infos.matieres, vec!["Étiquette", "Matière 2"]);
        assert_eq!(infos.triangles, 1);
        // L'original est intact ; la copie se relit, sa texture fait 2048 px, la géométrie reste.
        assert_eq!(fs::read(dossier.join("originaux").join(format!("{}.glb", r.id))).unwrap(), glb);
        let copie = fs::read(chemin_copie(&dossier, &r).unwrap()).unwrap();
        let (j, b) = lire_glb(&copie).unwrap();
        let vue = &j["bufferViews"][j["images"][0]["bufferView"].as_u64().unwrap() as usize];
        let (o, l) = (vue["byteOffset"].as_u64().unwrap() as usize, vue["byteLength"].as_u64().unwrap() as usize);
        let t = image::load_from_memory(&b[o..o + l]).unwrap();
        assert_eq!((t.width(), t.height()), (2048, 68));
        let p = &j["bufferViews"][0];
        assert_eq!(&b[p["byteOffset"].as_u64().unwrap() as usize..][..36], &bin[..36]);
        // Le même fichier une seconde fois : la même ressource, rien de refait.
        let encore = importer(&glb, "autre-nom.glb", None, &dossier).unwrap();
        assert_eq!((encore.id, encore.nom.as_str()), (r.id.clone(), "autre-nom.glb"));
        // Copier vers un autre design emporte la copie.
        assert_eq!(fichiers_en_plus(&dossier, &r), vec![dossier.join("copies").join(format!("{}.glb", r.id))]);
        let _ = fs::remove_dir_all(&dossier);
    }

    #[test]
    fn un_gltf_et_ses_fichiers_deviennent_un_glb() {
        let dossier = dossier_de_test("gltf");
        let source = dossier.join("source");
        fs::create_dir_all(source.join("textures")).unwrap();
        let (mut json, bin) = triangle();
        fs::write(source.join("scene.bin"), &bin).unwrap();
        fs::write(source.join("textures").join("étiquette.png"), png(64, 32)).unwrap();
        json["buffers"] = json!([{ "byteLength": bin.len(), "uri": "scene.bin" }]);
        json["images"] = json!([{ "uri": "textures/%C3%A9tiquette.png" }]);
        fs::write(source.join("scene.gltf"), serde_json::to_vec(&json).unwrap()).unwrap();
        let ressources = dossier.join("ressources");
        let r = importer_fichier(&source.join("scene.gltf"), &ressources).unwrap();
        let infos = r.modele3d.unwrap();
        assert_eq!((infos.format.as_str(), infos.copie.as_str()), ("glb", "original"), "rien à réduire : la copie est l'original");
        let (j, b) = lire_glb(&fs::read(ressources.join("originaux").join(format!("{}.glb", r.id))).unwrap()).unwrap();
        assert!(j["buffers"][0].get("uri").is_none() && j["images"][0].get("uri").is_none());
        assert_eq!(j["images"][0]["mimeType"], "image/png");
        let vue = &j["bufferViews"][j["images"][0]["bufferView"].as_u64().unwrap() as usize];
        let o = vue["byteOffset"].as_u64().unwrap() as usize;
        assert_eq!(image::load_from_memory(&b[o..o + vue["byteLength"].as_u64().unwrap() as usize]).unwrap().width(), 64);
        // Un glTF qui cite un fichier hors de son dossier, ou une adresse réseau : refusé.
        for uri in ["../secret.bin", "/etc/passwd", "https://exemple.org/a.bin"] {
            json["buffers"] = json!([{ "byteLength": bin.len(), "uri": uri }]);
            fs::write(source.join("mauvais.gltf"), serde_json::to_vec(&json).unwrap()).unwrap();
            assert!(importer_fichier(&source.join("mauvais.gltf"), &ressources).is_err(), "{uri}");
        }
        let _ = fs::remove_dir_all(&dossier);
    }

    #[test]
    fn un_glb_qui_cite_sa_texture_l_emporte_et_garde_son_credit() {
        // Comme les paquets de Kenney : le GLB cite « Textures/colormap.png », rangé à côté.
        let dossier = dossier_de_test("glb-cite");
        let source = dossier.join("Models").join("GLB format");
        fs::create_dir_all(source.join("Textures")).unwrap();
        let (mut json, bin) = triangle();
        json["images"] = json!([{ "uri": "Textures/colormap.png" }]);
        fs::write(source.join("Textures").join("colormap.png"), png(32, 32)).unwrap();
        fs::write(source.join("pomme.glb"), ecrire_glb(&json, &bin)).unwrap();
        let ressources = dossier.join("ressources");
        let credit = images::Credit { source: "Kenney".into(), auteur: "Kenney".into(), lien: "https://kenney.nl".into(), licence: Some("CC0 1.0".into()), titre: Some("Pomme".into()) };
        let r = importer_avec_credit(&source.join("pomme.glb"), "Pomme", &ressources, credit.clone()).unwrap();
        assert_eq!(r.nom, "Pomme");
        assert_eq!(r.credit.as_ref(), Some(&credit));
        assert_eq!(images::infos(&ressources, &r.id).unwrap().credit, Some(credit));
        let (j, _) = lire_glb(&fs::read(ressources.join("originaux").join(format!("{}.glb", r.id))).unwrap()).unwrap();
        assert!(j["images"][0].get("uri").is_none() && j["images"][0].get("bufferView").is_some());
        // Les mêmes octets sans leur dossier : la texture manque, l'import le dit.
        let octets = fs::read(source.join("pomme.glb")).unwrap();
        assert!(importer(&octets, "pomme.glb", None, &dossier.join("autres")).is_err());
        let _ = fs::remove_dir_all(&dossier);
    }

    #[test]
    fn fbx_et_obj_entrent_tels_quels_le_reste_est_refuse() {
        let dossier = dossier_de_test("fbx");
        let fbx = [b"Kaydara FBX Binary  \0\x1a\0".as_slice(), &[0u8; 64]].concat();
        let r = importer(&fbx, "danse.fbx", None, &dossier).unwrap();
        assert_eq!(r.modele3d.as_ref().map(|i| (i.format.as_str(), i.copie.as_str())), Some(("fbx", "original")));
        assert_eq!(chemin_copie(&dossier, &r).unwrap(), dossier.join("originaux").join(format!("{}.fbx", r.id)));
        let fbx_texte = b"; FBX 7.4.0 project file\n; ----\nFBXHeaderExtension:  {\n}\n";
        assert_eq!(importer(fbx_texte, "cube.fbx", None, &dossier).unwrap().modele3d.unwrap().format, "fbx");
        let obj = b"# un triangle\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n";
        assert_eq!(importer(obj, "triangle.obj", None, &dossier).unwrap().modele3d.unwrap().format, "obj");
        assert!(importer(b"bonjour", "texte.obj", None, &dossier).is_err());
        assert!(importer(&png(10, 10), "photo.glb", None, &dossier).is_err());
        let glb_v1 = [b"glTF".as_slice(), &1u32.to_le_bytes(), &20u32.to_le_bytes(), &[0u8; 8]].concat();
        assert!(importer(&glb_v1, "ancien.glb", None, &dossier).is_err());
        let _ = fs::remove_dir_all(&dossier);
    }

    #[test]
    fn la_miniature_rendue_par_la_fenetre_est_rangee() {
        let dossier = dossier_de_test("miniature");
        let (json, bin) = triangle();
        let r = importer(&ecrire_glb(&json, &bin), "triangle.glb", None, &dossier).unwrap();
        assert!(!r.modele3d.as_ref().unwrap().miniature);
        let apres = enregistrer_miniature(&dossier, &r.id, &png(1024, 1024)).unwrap();
        assert!(apres.modele3d.unwrap().miniature);
        let apercu = image::open(images::chemin_ressource(&dossier, &r.id, images::Genre::Apercu).unwrap()).unwrap();
        let miniature = image::open(images::chemin_ressource(&dossier, &r.id, images::Genre::Miniature).unwrap()).unwrap();
        assert_eq!((apercu.width(), miniature.width()), (512, 256));
        assert!(enregistrer_miniature(&dossier, &r.id, b"pas un png").is_err());
        let _ = fs::remove_dir_all(&dossier);
    }
}
