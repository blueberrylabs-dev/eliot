//! Sketchfab (étape 6, lot 3, BRIEF règle 12) : des modèles 3D téléchargeables, sous licence
//! CC0 ou CC BY seulement (les licences qui interdisent l'usage commercial ou la modification
//! sont écartées dès la recherche, et une seconde fois avant le téléchargement).
//!
//! La recherche et la fiche d'un modèle sont publiques. Le téléchargement demande un compte :
//! Eliot se sert de la clé d'API du compte d'Alexandre (`SKETCHFAB_API_KEY` dans le `.env`,
//! lue ici seulement), envoyée dans l'en-tête `Authorization` à l'API de Sketchfab et jamais
//! ailleurs ; l'adresse de téléchargement qu'elle renvoie est signée et se lit sans la clé. Les
//! lignes directrices de Sketchfab demandent qu'une application publique fasse se connecter
//! chaque utilisateur à son propre compte (OAuth) : pour un outil personnel, la clé du compte
//! d'Alexandre en tient lieu (JOURNAL du 2026-10-17). Le crédit (auteur, licence, lien, mention
//! « Sketchfab ») reste avec le modèle.

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::fichiers::{self, ecrire_atomiquement};
use crate::images::Credit;
use crate::reseau::{self, ErreurReseau};

const ADRESSE_API: &str = "https://api.sketchfab.com/v3/";
/// Le nom de la clé dans le `.env` (et l'ancien nom prévu au plan, accepté aussi).
const NOMS_DE_LA_CLE: [&str; 2] = ["SKETCHFAB_API_KEY", "SKETCHFAB_API_TOKEN"];
const DUREE_CACHE: Duration = Duration::from_secs(24 * 3600);
const PAR_LICENCE: u32 = 12;
const TAILLE_MAX: u64 = 300 * 1024 * 1024;

#[derive(Debug, thiserror::Error)]
pub enum ErreurSketchfab {
    #[error("pas de clé Sketchfab : ajouter SKETCHFAB_API_KEY dans le fichier .env du projet")]
    CleAbsente,
    #[error("Sketchfab a refusé le téléchargement (code {0}) : vérifier la clé SKETCHFAB_API_KEY du fichier .env")]
    CleRefusee(u16),
    #[error("Sketchfab : {0}")]
    Reseau(#[from] ErreurReseau),
    #[error("réponse de Sketchfab illisible : {0}")]
    Illisible(String),
    #[error("modèle inconnu, ou plus téléchargeable sous une licence CC0 ou CC BY : relancer la recherche")]
    Inconnu,
    #[error("archive de Sketchfab abîmée : {0}")]
    Archive(String),
    #[error(transparent)]
    Disque(#[from] std::io::Error),
}

/// Cherche la clé dans des fichiers `.env`, dans l'ordre.
pub fn lire_cle(fichiers: &[PathBuf]) -> Option<String> {
    NOMS_DE_LA_CLE.iter().find_map(|nom| fichiers::lire_cle(fichiers, nom))
}

/// La licence lisible d'un modèle d'après ce que dit l'API (son identifiant, son nom court ou
/// son libellé) ; `None` pour une licence écartée.
pub fn licence_de(licence: &serde_json::Value) -> Option<&'static str> {
    let texte = |cle: &str| licence.get(cle).and_then(serde_json::Value::as_str).unwrap_or("").to_lowercase();
    let (uid, slug, label) = (texte("uid"), texte("slug"), texte("label"));
    if uid == "7c23a1ba438d4306920229c12afcb5f9" || slug == "cc0" || label == "cc0 public domain" {
        Some("CC0 1.0")
    } else if uid == "322a749bcfa841b29dff1e8a1bb74b0b" || slug == "by" || label == "cc attribution" {
        Some("CC BY 4.0")
    } else {
        None
    }
}

/// Les licences à chercher.
#[derive(Debug, Clone, Copy, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Licences {
    Cc0,
    By,
    #[default]
    Toutes,
}

/// Un modèle tel que l'interface le voit.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ModeleSketchfab {
    pub uid: String,
    pub nom: String,
    pub auteur: String,
    /// `CC0 1.0` ou `CC BY 4.0`.
    pub licence: String,
    /// La page du modèle sur Sketchfab, pour le crédit.
    pub lien: String,
    pub triangles: u64,
    pub animations: u64,
    /// Le poids du GLB à télécharger, en octets (0 s'il n'est pas connu).
    pub taille: u64,
    #[serde(default)]
    apercu: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PageSketchfab {
    pub modeles: Vec<ModeleSketchfab>,
    /// D'autres résultats existent après cette page.
    pub suite: bool,
}

pub struct ClientSketchfab {
    cle: Option<String>,
    adresse: String,
    cache: PathBuf,
    agent: ureq::Agent,
    /// D'où viennent les aperçus.
    origines_apercus: Vec<String>,
    /// D'où viennent les fichiers (les adresses signées que l'API renvoie).
    origines_fichiers: Vec<String>,
}

fn champ<'a>(v: &'a serde_json::Value, chemin: &str) -> &'a serde_json::Value {
    v.pointer(chemin).unwrap_or(&serde_json::Value::Null)
}

impl ClientSketchfab {
    pub fn new(cle: Option<String>, cache: PathBuf) -> Self {
        Self::avec_adresse(cle, cache, ADRESSE_API.to_string(), vec!["https://media.sketchfab.com/".into()], vec!["https://".into()])
    }

    /// Pour les tests : une autre adresse d'API et d'autres origines permises.
    pub fn avec_adresse(cle: Option<String>, cache: PathBuf, adresse: String, origines_apercus: Vec<String>, origines_fichiers: Vec<String>) -> Self {
        let cle = cle.filter(|c| !c.trim().is_empty());
        Self { cle, adresse, cache, agent: reseau::agent(), origines_apercus, origines_fichiers }
    }

    pub fn a_une_cle(&self) -> bool {
        self.cle.is_some()
    }

    /// Un message d'erreur ne contient jamais la clé (il remonte jusqu'à l'interface).
    fn masquer(&self) -> impl Fn(String) -> String + '_ {
        move |m: String| match &self.cle {
            Some(c) => m.replace(c.as_str(), "***"),
            None => m,
        }
    }

    fn api_publique(&self, chemin: &str) -> Result<serde_json::Value, ErreurSketchfab> {
        let octets = reseau::lire(&self.agent, &format!("{}{chemin}", self.adresse), &[], 8 * 1024 * 1024, &self.masquer())?;
        serde_json::from_slice(&octets).map_err(|e| ErreurSketchfab::Illisible(e.to_string()))
    }

    fn fiche(r: &serde_json::Value) -> Option<ModeleSketchfab> {
        let licence = licence_de(champ(r, "/license"))?;
        if r.get("isDownloadable").and_then(serde_json::Value::as_bool) == Some(false) {
            return None;
        }
        let uid = r.get("uid")?.as_str()?.to_string();
        if uid.len() > 64 || !uid.chars().all(|c| c.is_ascii_alphanumeric()) {
            return None;
        }
        // L'aperçu : la plus petite image d'au moins 200 px de large, sinon la plus grande.
        let mut images: Vec<(u64, String)> = champ(r, "/thumbnails/images")
            .as_array()
            .map(|l| l.iter().filter_map(|i| Some((i.get("width")?.as_u64()?, i.get("url")?.as_str()?.to_string()))).collect())
            .unwrap_or_default();
        images.sort();
        let apercu = images.iter().find(|(l, _)| *l >= 200).or(images.last()).map(|(_, u)| u.clone()).unwrap_or_default();
        let auteur = [champ(r, "/user/displayName"), champ(r, "/user/username")].iter().find_map(|v| v.as_str().filter(|s| !s.trim().is_empty())).unwrap_or("").to_string();
        Some(ModeleSketchfab {
            nom: r.get("name").and_then(serde_json::Value::as_str).map(str::trim).filter(|s| !s.is_empty()).unwrap_or(&uid).to_string(),
            lien: r.get("viewerUrl").and_then(serde_json::Value::as_str).map(str::to_string).unwrap_or_else(|| format!("https://sketchfab.com/3d-models/{uid}")),
            uid,
            auteur,
            licence: licence.into(),
            triangles: r.get("faceCount").and_then(serde_json::Value::as_u64).unwrap_or(0),
            animations: r.get("animationCount").and_then(serde_json::Value::as_u64).unwrap_or(0),
            taille: champ(r, "/archives/glb/size").as_u64().unwrap_or(0),
            apercu,
        })
    }

    fn cache_modele(&self, uid: &str) -> PathBuf {
        self.cache.join("modeles").join(format!("{uid}.json"))
    }

    /// Une page de résultats : des modèles téléchargeables, CC0 ou CC BY (douze de chaque quand
    /// on cherche les deux), depuis le cache s'il a moins de 24 h. `animes` : seulement ceux qui
    /// ont une animation.
    pub fn chercher(&self, requete: &str, licences: Licences, animes: bool, page: u32) -> Result<PageSketchfab, ErreurSketchfab> {
        let requete: String = requete.trim().chars().take(100).collect();
        let page = page.clamp(1, 40);
        let empreinte: String = Sha256::digest(format!("{requete}|{licences:?}|{animes}|{page}").as_bytes()).iter().take(16).map(|o| format!("{o:02x}")).collect();
        let cache = self.cache.join("recherches").join(format!("{empreinte}.json"));
        if reseau::frais(&cache, DUREE_CACHE) {
            if let Ok(p) = serde_json::from_slice::<PageSketchfab>(&fs::read(&cache)?) {
                return Ok(p);
            }
        }
        let slugs: &[&str] = match licences {
            Licences::Cc0 => &["cc0"],
            Licences::By => &["by"],
            Licences::Toutes => &["cc0", "by"],
        };
        let par = if slugs.len() == 1 { PAR_LICENCE * 2 } else { PAR_LICENCE };
        let mut listes = Vec::new();
        let mut suite = false;
        for slug in slugs {
            let mut chemin = format!("search?type=models&downloadable=true&license={slug}&count={par}&cursor={}", (page - 1) * par);
            if !requete.is_empty() {
                chemin.push_str(&format!("&q={}", encoder(&requete)));
            }
            if animes {
                chemin.push_str("&animated=true");
            }
            let reponse = self.api_publique(&chemin)?;
            suite |= reponse.get("next").is_some_and(|n| !n.is_null());
            listes.push(reponse.get("results").and_then(serde_json::Value::as_array).cloned().unwrap_or_default());
        }
        // Les deux licences en alternance.
        let mut modeles = Vec::new();
        let plus_longue = listes.iter().map(Vec::len).max().unwrap_or(0);
        for i in 0..plus_longue {
            for liste in &listes {
                if let Some(m) = liste.get(i).and_then(Self::fiche) {
                    if !modeles.iter().any(|x: &ModeleSketchfab| x.uid == m.uid) {
                        modeles.push(m);
                    }
                }
            }
        }
        fs::create_dir_all(self.cache.join("modeles"))?;
        for m in &modeles {
            ecrire_atomiquement(&self.cache_modele(&m.uid), &serde_json::to_vec(m).map_err(|e| ErreurSketchfab::Illisible(e.to_string()))?)?;
        }
        let page = PageSketchfab { modeles, suite };
        fs::create_dir_all(cache.parent().expect("dans le cache"))?;
        ecrire_atomiquement(&cache, &serde_json::to_vec(&page).map_err(|e| ErreurSketchfab::Illisible(e.to_string()))?)?;
        Ok(page)
    }

    fn modele(&self, uid: &str) -> Result<ModeleSketchfab, ErreurSketchfab> {
        if uid.is_empty() || uid.len() > 64 || !uid.chars().all(|c| c.is_ascii_alphanumeric()) {
            return Err(ErreurSketchfab::Inconnu);
        }
        let octets = fs::read(self.cache_modele(uid)).map_err(|_| ErreurSketchfab::Inconnu)?;
        serde_json::from_slice(&octets).map_err(|_| ErreurSketchfab::Inconnu)
    }

    /// L'aperçu d'un modèle trouvé (JPEG), gardé 24 h.
    pub fn apercu(&self, uid: &str) -> Result<Vec<u8>, ErreurSketchfab> {
        let m = self.modele(uid)?;
        let cache = self.cache.join("apercus").join(format!("{uid}.jpg"));
        if reseau::frais(&cache, DUREE_CACHE) {
            return Ok(fs::read(&cache)?);
        }
        reseau::permise(&m.apercu, &self.origines_apercus)?;
        let octets = reseau::lire(&self.agent, &m.apercu, &[], 4 * 1024 * 1024, &self.masquer())?;
        fs::create_dir_all(cache.parent().expect("dans le cache"))?;
        ecrire_atomiquement(&cache, &octets)?;
        Ok(octets)
    }

    /// Télécharge un modèle dans `dossier` : le GLB, ou l'archive glTF ouverte. La licence est
    /// relue sur la fiche du modèle juste avant. Renvoie le crédit, le nom et le fichier à
    /// importer.
    pub fn telecharger(&self, uid: &str, dossier: &Path, avancement: &mut dyn FnMut(f32)) -> Result<(Credit, String, PathBuf), ErreurSketchfab> {
        let cle = self.cle.clone().ok_or(ErreurSketchfab::CleAbsente)?;
        self.modele(uid)?;
        let fiche = Self::fiche(&self.api_publique(&format!("models/{uid}"))?).ok_or(ErreurSketchfab::Inconnu)?;
        let reponse = match reseau::lire(&self.agent, &format!("{}models/{uid}/download", self.adresse), &[("Authorization", format!("Token {cle}"))], 1024 * 1024, &self.masquer()) {
            Ok(r) => r,
            Err(ErreurReseau::Refus(code @ (401 | 403))) => return Err(ErreurSketchfab::CleRefusee(code)),
            Err(e) => return Err(e.into()),
        };
        let liens: serde_json::Value = serde_json::from_slice(&reponse).map_err(|e| ErreurSketchfab::Illisible(e.to_string()))?;
        fs::create_dir_all(dossier)?;
        let chemin = if let Some(adresse) = champ(&liens, "/glb/url").as_str() {
            reseau::permise(adresse, &self.origines_fichiers)?;
            let cible = dossier.join(format!("{uid}.glb"));
            reseau::lire_vers(&self.agent, adresse, &cible, TAILLE_MAX, champ(&liens, "/glb/size").as_u64().filter(|t| *t > 0), avancement, &self.masquer())?;
            cible
        } else if let Some(adresse) = champ(&liens, "/gltf/url").as_str() {
            reseau::permise(adresse, &self.origines_fichiers)?;
            let archive = dossier.join(format!("{uid}.zip"));
            reseau::lire_vers(&self.agent, adresse, &archive, TAILLE_MAX, champ(&liens, "/gltf/size").as_u64().filter(|t| *t > 0), avancement, &self.masquer())?;
            let gltf = ouvrir_archive(&archive, &dossier.join("gltf"))?;
            let _ = fs::remove_file(&archive);
            gltf
        } else {
            return Err(ErreurSketchfab::Illisible("ni GLB ni glTF proposé".into()));
        };
        let credit = Credit { source: "Sketchfab".into(), auteur: fiche.auteur.clone(), lien: fiche.lien.clone(), licence: Some(fiche.licence.clone()), titre: Some(fiche.nom.clone()) };
        Ok((credit, fiche.nom, chemin))
    }

    /// Où télécharger avant d'importer (vidé ensuite par l'appelant).
    pub fn dossier_de_telechargement(&self, uid: &str) -> PathBuf {
        self.cache.join("telechargements").join(uid.chars().filter(char::is_ascii_alphanumeric).collect::<String>())
    }

    /// Retire du cache ce qui a plus de 24 h.
    pub fn nettoyer(&self) -> usize {
        ["recherches", "modeles", "apercus"].iter().map(|d| reseau::nettoyer(&self.cache.join(d), DUREE_CACHE)).sum()
    }
}

/// Une requête dans une adresse : lettres et chiffres tels quels, le reste en `%XX`.
fn encoder(texte: &str) -> String {
    texte.bytes().map(|o| if o.is_ascii_alphanumeric() || b"-_.~".contains(&o) { (o as char).to_string() } else { format!("%{o:02X}") }).collect()
}

/// Ouvre l'archive glTF de Sketchfab dans `cible` (chemins sûrs seulement, 300 Mo au plus en
/// tout) et renvoie le fichier glTF qu'elle contient (`scene.gltf` d'abord).
fn ouvrir_archive(archive: &Path, cible: &Path) -> Result<PathBuf, ErreurSketchfab> {
    let mut zip = zip::ZipArchive::new(fs::File::open(archive)?).map_err(|e| ErreurSketchfab::Archive(e.to_string()))?;
    let mut total: u64 = 0;
    let mut gltfs = Vec::new();
    for i in 0..zip.len() {
        let mut entree = zip.by_index(i).map_err(|e| ErreurSketchfab::Archive(e.to_string()))?;
        if entree.is_dir() {
            continue;
        }
        let nom = entree.name().map_err(|e| ErreurSketchfab::Archive(e.to_string()))?.to_string();
        if !reseau::chemin_sur(&nom) {
            return Err(ErreurSketchfab::Archive(format!("chemin refusé : {nom}")));
        }
        total += entree.size();
        if total > TAILLE_MAX {
            return Err(ErreurReseau::TropLourd(TAILLE_MAX / 1024 / 1024).into());
        }
        let chemin = cible.join(&nom);
        fs::create_dir_all(chemin.parent().expect("dans la cible"))?;
        let mut octets = Vec::with_capacity(entree.size() as usize);
        entree.by_ref().take(TAILLE_MAX).read_to_end(&mut octets)?;
        fs::write(&chemin, &octets)?;
        if nom.to_lowercase().ends_with(".gltf") {
            gltfs.push(chemin);
        }
    }
    gltfs.sort_by_key(|c| (c.file_name().is_none_or(|n| n != "scene.gltf"), c.components().count()));
    gltfs.into_iter().next().ok_or_else(|| ErreurSketchfab::Archive("pas de fichier glTF dans l'archive".into()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader, Write};
    use std::net::TcpListener;
    use std::sync::{Arc, Mutex};

    type Demandes = Arc<Mutex<Vec<(String, Option<String>)>>>;

    /// Un faux Sketchfab : la recherche (un CC0, un CC BY, un CC BY-NC à écarter), la fiche, le
    /// téléchargement (qui demande la clé « cle-d-essai »), les fichiers.
    fn faux_sketchfab() -> (String, Demandes) {
        let ecoute = TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}", ecoute.local_addr().unwrap());
        let demandes: Demandes = Arc::new(Mutex::new(Vec::new()));
        let (b, d) = (base.clone(), demandes.clone());
        std::thread::spawn(move || {
            for flux in ecoute.incoming() {
                let Ok(mut flux) = flux else { continue };
                let mut lecteur = BufReader::new(flux.try_clone().unwrap());
                let mut ligne = String::new();
                lecteur.read_line(&mut ligne).unwrap();
                let chemin = ligne.split_whitespace().nth(1).unwrap_or("/").to_string();
                let mut autorisation = None;
                loop {
                    let mut e = String::new();
                    if lecteur.read_line(&mut e).unwrap_or(0) == 0 || e.trim().is_empty() {
                        break;
                    }
                    if let Some((n, v)) = e.split_once(':')
                        && n.eq_ignore_ascii_case("authorization")
                    {
                        autorisation = Some(v.trim().to_string());
                    }
                }
                d.lock().unwrap().push((chemin.clone(), autorisation.clone()));
                let modele = |uid: &str, licence: &str, nom: &str| {
                    format!(r#"{{"uid":"{uid}","name":"{nom}","isDownloadable":true,"license":{licence},"user":{{"displayName":"Auteur {uid}","username":"a{uid}"}},"viewerUrl":"https://sketchfab.com/3d-models/{uid}","faceCount":1200,"animationCount":1,"archives":{{"glb":{{"size":4}}}},"thumbnails":{{"images":[{{"width":64,"url":"{b}/media/{uid}-64.jpg"}},{{"width":256,"url":"{b}/media/{uid}-256.jpg"}},{{"width":1024,"url":"{b}/media/{uid}-1024.jpg"}}]}}}}"#)
                };
                let cc0 = r#"{"uid":"7c23a1ba438d4306920229c12afcb5f9","label":"CC0 Public Domain"}"#;
                let by = r#"{"uid":"322a749bcfa841b29dff1e8a1bb74b0b","label":"CC Attribution"}"#;
                let nc = r#"{"uid":"bbfe3f7dbcdd4122b966b85b9786a989","label":"CC Attribution-NonCommercial"}"#;
                let (code, corps): (&str, Vec<u8>) = if chemin.starts_with("/v3/search") && chemin.contains("license=cc0") {
                    ("200 OK", format!(r#"{{"next":null,"results":[{}]}}"#, modele("aaa111", cc0, "Chaussure")).into_bytes())
                } else if chemin.starts_with("/v3/search") {
                    ("200 OK", format!(r#"{{"next":"{b}/v3/search?cursor=12","results":[{},{}]}}"#, modele("bbb222", by, "Lampe"), modele("ccc333", nc, "Interdit")).into_bytes())
                } else if chemin == "/v3/models/aaa111" {
                    ("200 OK", modele("aaa111", cc0, "Chaussure").into_bytes())
                } else if chemin == "/v3/models/bbb222" {
                    ("200 OK", modele("bbb222", by, "Lampe").into_bytes())
                } else if chemin.ends_with("/download") && autorisation.as_deref() != Some("Token cle-d-essai") {
                    ("401 Unauthorized", br#"{"detail":"Authentication credentials were not provided."}"#.to_vec())
                } else if chemin == "/v3/models/aaa111/download" {
                    ("200 OK", format!(r#"{{"glb":{{"url":"{b}/s3/aaa111.glb","size":4,"expires":300}}}}"#).into_bytes())
                } else if chemin == "/v3/models/bbb222/download" {
                    ("200 OK", format!(r#"{{"gltf":{{"url":"{b}/s3/bbb222.zip","expires":300}}}}"#).into_bytes())
                } else if chemin == "/s3/aaa111.glb" {
                    ("200 OK", b"glTF".to_vec())
                } else if chemin == "/s3/bbb222.zip" {
                    let mut zip = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
                    let options = zip::write::SimpleFileOptions::default();
                    for (nom, contenu) in [("scene.gltf", "{}"), ("scene.bin", "BIN"), ("textures/a.png", "PNG")] {
                        zip.start_file(nom, options).unwrap();
                        zip.write_all(contenu.as_bytes()).unwrap();
                    }
                    ("200 OK", zip.finish().unwrap().into_inner())
                } else if chemin.starts_with("/media/") {
                    ("200 OK", format!("JPEG {chemin}").into_bytes())
                } else {
                    ("404 Not Found", b"introuvable".to_vec())
                };
                let _ = flux.write_all(format!("HTTP/1.1 {code}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", corps.len()).as_bytes());
                let _ = flux.write_all(&corps);
            }
        });
        (base, demandes)
    }

    fn client(nom: &str, cle: Option<&str>) -> (ClientSketchfab, PathBuf, Demandes) {
        let (base, demandes) = faux_sketchfab();
        let cache = std::env::temp_dir().join(format!("eliot-sketchfab-{nom}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&cache);
        (ClientSketchfab::avec_adresse(cle.map(str::to_string), cache.clone(), format!("{base}/v3/"), vec![format!("{base}/media/")], vec![format!("{base}/s3/")]), cache, demandes)
    }

    #[test]
    fn la_recherche_ne_garde_que_cc0_et_cc_by() {
        let (c, cache, demandes) = client("chercher", None);
        let page = c.chercher("chaussure de sport", Licences::Toutes, false, 1).unwrap();
        let uids: Vec<&str> = page.modeles.iter().map(|m| m.uid.as_str()).collect();
        assert_eq!(uids, vec!["aaa111", "bbb222"]);
        assert!(page.suite);
        assert_eq!(page.modeles[0].licence, "CC0 1.0");
        assert_eq!(page.modeles[1].licence, "CC BY 4.0");
        assert_eq!(page.modeles[1].auteur, "Auteur bbb222");
        let d = demandes.lock().unwrap().clone();
        assert!(d.iter().all(|(c, a)| a.is_none() && c.contains("downloadable=true")));
        assert!(d.iter().any(|(c, _)| c.contains("q=chaussure%20de%20sport")));
        // L'aperçu : l'image de 256 px.
        assert_eq!(c.apercu("bbb222").unwrap(), format!("JPEG /media/bbb222-256.jpg").into_bytes());
        assert!(c.apercu("ccc333").is_err());
        let _ = fs::remove_dir_all(&cache);
    }

    #[test]
    fn le_telechargement_demande_la_cle_et_ne_l_envoie_qu_a_l_api() {
        let (sans, cache, _) = client("sans-cle", None);
        sans.chercher("", Licences::Cc0, false, 1).unwrap();
        assert!(matches!(sans.telecharger("aaa111", &cache.join("t"), &mut |_| ()), Err(ErreurSketchfab::CleAbsente)));
        let _ = fs::remove_dir_all(&cache);

        let (mauvaise, cache, _) = client("mauvaise-cle", Some("mauvaise"));
        mauvaise.chercher("", Licences::Cc0, false, 1).unwrap();
        let erreur = mauvaise.telecharger("aaa111", &cache.join("t"), &mut |_| ()).unwrap_err();
        assert!(matches!(erreur, ErreurSketchfab::CleRefusee(401)));
        assert!(!erreur.to_string().contains("mauvaise"));
        let _ = fs::remove_dir_all(&cache);

        let (c, cache, demandes) = client("telecharger", Some("cle-d-essai"));
        c.chercher("", Licences::Toutes, false, 1).unwrap();
        let (credit, nom, glb) = c.telecharger("aaa111", &c.dossier_de_telechargement("aaa111"), &mut |_| ()).unwrap();
        assert_eq!((nom.as_str(), credit.source.as_str(), credit.licence.as_deref()), ("Chaussure", "Sketchfab", Some("CC0 1.0")));
        assert_eq!(fs::read(&glb).unwrap(), b"glTF");
        let (credit, _, gltf) = c.telecharger("bbb222", &c.dossier_de_telechargement("bbb222"), &mut |_| ()).unwrap();
        assert_eq!(credit.lien, "https://sketchfab.com/3d-models/bbb222");
        assert_eq!(gltf.file_name().unwrap(), "scene.gltf");
        assert_eq!(fs::read(gltf.parent().unwrap().join("textures/a.png")).unwrap(), b"PNG");
        // La clé ne part que vers le téléchargement de l'API, jamais vers les fichiers.
        for (chemin, autorisation) in demandes.lock().unwrap().iter() {
            assert_eq!(autorisation.is_some(), chemin.ends_with("/download"), "{chemin}");
        }
        // Un modèle écarté (CC BY-NC) ne se télécharge pas.
        assert!(matches!(c.telecharger("ccc333", &cache.join("t"), &mut |_| ()), Err(ErreurSketchfab::Inconnu)));
        let _ = fs::remove_dir_all(&cache);
    }

    #[test]
    fn une_archive_qui_sort_de_son_dossier_est_refusee() {
        let dossier = std::env::temp_dir().join(format!("eliot-sketchfab-zip-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dossier);
        fs::create_dir_all(&dossier).unwrap();
        let mut zip = zip::ZipWriter::new(fs::File::create(dossier.join("a.zip")).unwrap());
        zip.start_file("../hors.gltf", zip::write::SimpleFileOptions::default()).unwrap();
        zip.write_all(b"{}").unwrap();
        zip.finish().unwrap();
        assert!(matches!(ouvrir_archive(&dossier.join("a.zip"), &dossier.join("x")), Err(ErreurSketchfab::Archive(_))));
        assert!(!dossier.join("hors.gltf").exists());
        let _ = fs::remove_dir_all(&dossier);
    }
}
