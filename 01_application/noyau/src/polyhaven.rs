//! Poly Haven (étape 6, lot 3, BRIEF règle 12) : des modèles 3D et des environnements HDRI sous
//! licence CC0, par leur API publique (https://polyhaven.com/our-api) : gratuite, même pour un
//! usage commercial, sans clé ; elle demande un User-Agent propre à l'application et que
//! l'interface dise d'où viennent les fichiers (la mention « Poly Haven » à côté des résultats).
//!
//! L'index de chaque genre (environ 500 modèles, 1 000 environnements) est gardé 24 h en cache ;
//! la recherche se fait ici, dans l'index (noms, mots-clés, catégories, description). Un modèle
//! se télécharge en glTF 1k (le fichier, son tampon, ses textures, chacun vérifié à sa taille),
//! puis entre par `modeles3d` comme un glTF du poste ; un environnement, en HDR 1k.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::fichiers::ecrire_atomiquement;
use crate::images::Credit;
use crate::reseau::{self, ErreurReseau};

const ADRESSE_API: &str = "https://api.polyhaven.com/";
const DUREE_INDEX: Duration = Duration::from_secs(24 * 3600);
const DUREE_APERCUS: Duration = Duration::from_secs(7 * 24 * 3600);
const PAR_PAGE: usize = 24;
/// Un modèle 1k avec ses textures fait quelques Mo ; un HDR 1k, environ 1,5 Mo.
const TAILLE_MAX: u64 = 200 * 1024 * 1024;
const TAILLE_INDEX: u64 = 40 * 1024 * 1024;

#[derive(Debug, thiserror::Error)]
pub enum ErreurPolyHaven {
    #[error("Poly Haven : {0}")]
    Reseau(#[from] ErreurReseau),
    #[error("réponse de Poly Haven illisible : {0}")]
    Illisible(String),
    #[error("élément inconnu de Poly Haven : relancer la recherche")]
    Inconnu,
    #[error("Poly Haven ne propose pas ce fichier en {0}")]
    SansFichier(String),
    #[error(transparent)]
    Disque(#[from] std::io::Error),
}

/// Ce qu'on cherche : des modèles ou des environnements.
#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Genre {
    Modeles,
    Environnements,
}

impl Genre {
    fn parametre(self) -> &'static str {
        match self {
            Genre::Modeles => "models",
            Genre::Environnements => "hdris",
        }
    }
}

/// Un élément de l'index tel que l'API le donne (seuls les champs utiles).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct Brut {
    #[serde(default)]
    name: String,
    #[serde(default)]
    categories: Vec<String>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    authors: BTreeMap<String, String>,
    #[serde(default)]
    description: String,
    #[serde(default)]
    download_count: u64,
    #[serde(default)]
    polycount: u64,
    #[serde(default)]
    thumbnail_url: String,
}

/// Un modèle ou un environnement tel que l'interface le voit.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ElementPolyHaven {
    pub id: String,
    pub nom: String,
    pub auteur: String,
    pub categories: Vec<String>,
    /// Les triangles d'un modèle (0 pour un environnement).
    pub triangles: u64,
    /// La page de l'élément sur Poly Haven, pour le crédit.
    pub lien: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PagePolyHaven {
    pub total: usize,
    pub elements: Vec<ElementPolyHaven>,
}

/// Une catégorie et le nombre d'éléments qu'elle range.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Categorie {
    pub nom: String,
    pub nombre: usize,
}

#[derive(Debug, Clone, Deserialize)]
struct Fichier {
    url: String,
    #[serde(default)]
    size: u64,
    #[serde(default)]
    include: BTreeMap<String, Fichier>,
}

pub struct ClientPolyHaven {
    adresse: String,
    cache: PathBuf,
    agent: ureq::Agent,
    /// Débuts d'adresse d'où un fichier ou un aperçu peut être téléchargé.
    origines: Vec<String>,
}

/// Un texte comparable : minuscules, sans accents.
fn simple(texte: &str) -> String {
    texte
        .to_lowercase()
        .chars()
        .map(|c| match c {
            'à' | 'â' | 'ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'î' | 'ï' => 'i',
            'ô' | 'ö' => 'o',
            'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            '_' | '-' => ' ',
            c => c,
        })
        .collect()
}

impl ClientPolyHaven {
    pub fn new(cache: PathBuf) -> Self {
        Self::avec_adresse(cache, ADRESSE_API.to_string(), vec!["https://dl.polyhaven.org/".into(), "https://cdn.polyhaven.com/".into()])
    }

    /// Pour les tests : une autre adresse d'API et d'autres origines permises.
    pub fn avec_adresse(cache: PathBuf, adresse: String, origines: Vec<String>) -> Self {
        Self { adresse, cache, agent: reseau::agent(), origines }
    }

    fn sans_cle(texte: String) -> String {
        texte
    }

    fn api(&self, chemin: &str) -> Result<Vec<u8>, ErreurPolyHaven> {
        Ok(reseau::lire(&self.agent, &format!("{}{chemin}", self.adresse), &[], TAILLE_INDEX, &Self::sans_cle)?)
    }

    /// L'index d'un genre, depuis le cache s'il a moins de 24 h.
    fn index(&self, genre: Genre) -> Result<BTreeMap<String, Brut>, ErreurPolyHaven> {
        let cache = self.cache.join(format!("index-{}.json", genre.parametre()));
        let octets = if reseau::frais(&cache, DUREE_INDEX) {
            fs::read(&cache)?
        } else {
            let octets = self.api(&format!("assets?t={}", genre.parametre()))?;
            // Seuls les champs utiles sont gardés en cache.
            let index: BTreeMap<String, Brut> = serde_json::from_slice(&octets).map_err(|e| ErreurPolyHaven::Illisible(e.to_string()))?;
            let reduit = serde_json::to_vec(&index).map_err(|e| ErreurPolyHaven::Illisible(e.to_string()))?;
            fs::create_dir_all(&self.cache)?;
            ecrire_atomiquement(&cache, &reduit)?;
            reduit
        };
        serde_json::from_slice(&octets).map_err(|e| ErreurPolyHaven::Illisible(e.to_string()))
    }

    fn element(id: &str, b: &Brut) -> ElementPolyHaven {
        ElementPolyHaven {
            id: id.to_string(),
            nom: if b.name.trim().is_empty() { id.to_string() } else { b.name.trim().to_string() },
            auteur: b.authors.keys().cloned().collect::<Vec<_>>().join(", "),
            categories: b.categories.clone(),
            triangles: b.polycount,
            lien: format!("https://polyhaven.com/a/{id}"),
        }
    }

    /// Les catégories d'un genre, les plus remplies d'abord (sans les collections).
    pub fn categories(&self, genre: Genre) -> Result<Vec<Categorie>, ErreurPolyHaven> {
        let mut compte: BTreeMap<String, usize> = BTreeMap::new();
        for b in self.index(genre)?.values() {
            for c in &b.categories {
                if !c.starts_with("collection:") {
                    *compte.entry(c.clone()).or_default() += 1;
                }
            }
        }
        let mut liste: Vec<Categorie> = compte.into_iter().map(|(nom, nombre)| Categorie { nom, nombre }).collect();
        liste.sort_by(|a, b| b.nombre.cmp(&a.nombre).then(a.nom.cmp(&b.nom)));
        Ok(liste)
    }

    /// Une page de résultats : chaque mot de la requête doit se trouver dans le nom, les
    /// mots-clés, les catégories ou la description ; les plus téléchargés d'abord.
    pub fn chercher(&self, genre: Genre, requete: &str, categorie: Option<&str>, page: u32) -> Result<PagePolyHaven, ErreurPolyHaven> {
        let mots: Vec<String> = simple(requete).split_whitespace().filter(|m| m.len() > 1).map(str::to_string).take(8).collect();
        let index = self.index(genre)?;
        let mut trouves: Vec<(&String, &Brut, u32)> = index
            .iter()
            .filter(|(_, b)| categorie.is_none_or(|c| b.categories.iter().any(|x| x == c)))
            .filter_map(|(id, b)| {
                if mots.is_empty() {
                    return Some((id, b, 0));
                }
                let nom = simple(&format!("{} {id}", b.name));
                let cles = simple(&format!("{} {}", b.tags.join(" "), b.categories.join(" ")));
                let description = simple(&b.description);
                let mut score = 0;
                for m in &mots {
                    let s = if nom.contains(m.as_str()) { 3 } else if cles.contains(m.as_str()) { 2 } else if description.contains(m.as_str()) { 1 } else { 0 };
                    if s == 0 {
                        return None;
                    }
                    score += s;
                }
                Some((id, b, score))
            })
            .collect();
        trouves.sort_by(|a, b| b.2.cmp(&a.2).then(b.1.download_count.cmp(&a.1.download_count)).then(a.0.cmp(b.0)));
        let total = trouves.len();
        let debut = (page.clamp(1, 100) as usize - 1) * PAR_PAGE;
        let elements = trouves.into_iter().skip(debut).take(PAR_PAGE).map(|(id, b, _)| Self::element(id, b)).collect();
        Ok(PagePolyHaven { total, elements })
    }

    fn brut(&self, genre: Genre, id: &str) -> Result<Brut, ErreurPolyHaven> {
        if !reseau::chemin_sur(id) || id.contains('/') {
            return Err(ErreurPolyHaven::Inconnu);
        }
        self.index(genre)?.remove(id).ok_or(ErreurPolyHaven::Inconnu)
    }

    /// L'aperçu d'un élément (PNG, 256 px de large), gardé 7 jours en cache.
    pub fn apercu(&self, genre: Genre, id: &str) -> Result<Vec<u8>, ErreurPolyHaven> {
        let brut = self.brut(genre, id)?;
        let cache = self.cache.join("apercus").join(format!("{}-{id}.img", genre.parametre()));
        if reseau::frais(&cache, DUREE_APERCUS) {
            return Ok(fs::read(&cache)?);
        }
        // L'adresse de l'index, en PNG de 256 px (128 de haut pour une panoramique).
        let base = brut.thumbnail_url.split('?').next().unwrap_or("").to_string();
        let base = if base.is_empty() { return Err(ErreurPolyHaven::Inconnu) } else { base };
        let hauteur = if genre == Genre::Environnements { 128 } else { 256 };
        let adresse = format!("{}?width=256&height={hauteur}", base.trim_end_matches(".webp"));
        reseau::permise(&adresse, &self.origines)?;
        let octets = reseau::lire(&self.agent, &adresse, &[], 4 * 1024 * 1024, &Self::sans_cle)?;
        fs::create_dir_all(cache.parent().expect("dans le cache"))?;
        ecrire_atomiquement(&cache, &octets)?;
        Ok(octets)
    }

    fn fichiers(&self, id: &str) -> Result<serde_json::Value, ErreurPolyHaven> {
        serde_json::from_slice(&self.api(&format!("files/{id}"))?).map_err(|e| ErreurPolyHaven::Illisible(e.to_string()))
    }

    fn credit(id: &str, b: &Brut) -> Credit {
        let e = Self::element(id, b);
        Credit { source: "Poly Haven".into(), auteur: e.auteur, lien: e.lien, licence: Some("CC0 1.0".into()), titre: Some(e.nom), lien_auteur: None }
    }

    /// Télécharge un modèle en glTF (`1k` ou `2k`) dans `dossier` (le fichier glTF et ce qu'il
    /// cite, à leurs chemins relatifs) ; renvoie son crédit, son nom et le chemin du glTF.
    pub fn telecharger_modele(&self, id: &str, resolution: &str, dossier: &Path, avancement: &mut dyn FnMut(f32)) -> Result<(Credit, String, PathBuf), ErreurPolyHaven> {
        let brut = self.brut(Genre::Modeles, id)?;
        let fichiers = self.fichiers(id)?;
        let resolution = if resolution == "2k" { "2k" } else { "1k" };
        let gltf: Fichier = fichiers
            .pointer(&format!("/gltf/{resolution}/gltf"))
            .cloned()
            .and_then(|v| serde_json::from_value(v).ok())
            .ok_or_else(|| ErreurPolyHaven::SansFichier(format!("glTF {resolution}")))?;
        let total: u64 = gltf.size + gltf.include.values().map(|f| f.size).sum::<u64>();
        if total > TAILLE_MAX {
            return Err(ErreurReseau::TropLourd(TAILLE_MAX / 1024 / 1024).into());
        }
        let nom_gltf = format!("{id}.gltf");
        let mut a_lire: Vec<(String, &Fichier)> = vec![(nom_gltf.clone(), &gltf)];
        for (relatif, f) in &gltf.include {
            if !reseau::chemin_sur(relatif) {
                return Err(ErreurPolyHaven::Illisible(format!("chemin refusé : {relatif}")));
            }
            a_lire.push((relatif.clone(), f));
        }
        let mut fait: u64 = 0;
        for (relatif, f) in a_lire {
            reseau::permise(&f.url, &self.origines)?;
            let cible = dossier.join(&relatif);
            let part = |x: f32| ((fait as f32 + x * f.size as f32) / total.max(1) as f32).min(1.0);
            reseau::lire_vers(&self.agent, &f.url, &cible, TAILLE_MAX, (f.size > 0).then_some(f.size), &mut |x| avancement(part(x)), &Self::sans_cle)?;
            fait += f.size;
        }
        avancement(1.0);
        let e = Self::element(id, &brut);
        Ok((Self::credit(id, &brut), e.nom, dossier.join(nom_gltf)))
    }

    /// Télécharge un environnement en HDR 1k dans `cible` ; son crédit et son nom.
    pub fn telecharger_environnement(&self, id: &str, cible: &Path, avancement: &mut dyn FnMut(f32)) -> Result<(Credit, String), ErreurPolyHaven> {
        let brut = self.brut(Genre::Environnements, id)?;
        let fichiers = self.fichiers(id)?;
        let hdr: Fichier = fichiers
            .pointer("/hdri/1k/hdr")
            .cloned()
            .and_then(|v| serde_json::from_value(v).ok())
            .ok_or_else(|| ErreurPolyHaven::SansFichier("HDR 1k".into()))?;
        reseau::permise(&hdr.url, &self.origines)?;
        reseau::lire_vers(&self.agent, &hdr.url, cible, TAILLE_MAX, (hdr.size > 0).then_some(hdr.size), avancement, &Self::sans_cle)?;
        let e = Self::element(id, &brut);
        Ok((Self::credit(id, &brut), e.nom))
    }

    /// Où télécharger avant d'importer (vidé ensuite par l'appelant).
    pub fn dossier_de_telechargement(&self, id: &str) -> PathBuf {
        self.cache.join("telechargements").join(id)
    }

    /// Retire du cache les aperçus de plus de 7 jours.
    pub fn nettoyer(&self) -> usize {
        reseau::nettoyer(&self.cache.join("apercus"), DUREE_APERCUS)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader, Write};
    use std::net::TcpListener;

    /// Un faux Poly Haven local : un index de deux modèles et d'un environnement, les fichiers
    /// d'un modèle (glTF, tampon, texture) et d'un environnement, les aperçus.
    fn faux_polyhaven() -> String {
        let ecoute = TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}", ecoute.local_addr().unwrap());
        let b = base.clone();
        std::thread::spawn(move || {
            for flux in ecoute.incoming() {
                let Ok(mut flux) = flux else { continue };
                let mut lecteur = BufReader::new(flux.try_clone().unwrap());
                let mut ligne = String::new();
                lecteur.read_line(&mut ligne).unwrap();
                let chemin = ligne.split_whitespace().nth(1).unwrap_or("/").to_string();
                loop {
                    let mut e = String::new();
                    if lecteur.read_line(&mut e).unwrap_or(0) == 0 || e.trim().is_empty() {
                        break;
                    }
                }
                let corps: Vec<u8> = if chemin == "/assets?t=models" {
                    format!(
                        r#"{{"Chaise_bois":{{"name":"Chaise en bois","categories":["furniture","seating"],"tags":["chair","wood"],"authors":{{"Anne":"All"}},"description":"A wooden chair","download_count":10,"polycount":1200,"thumbnail_url":"{b}/thumbs/Chaise_bois.png?width=256"}},
                        "Bouteille":{{"name":"Bouteille","categories":["containers"],"tags":["bottle","glass"],"authors":{{"Bob":"All","Cid":"Textures"}},"description":"Glass bottle","download_count":50,"polycount":800,"thumbnail_url":"{b}/thumbs/Bouteille.png"}},
                        "Piege":{{"name":"Piège","categories":["props"],"authors":{{"Eve":"All"}},"download_count":1,"thumbnail_url":"{b}/thumbs/Piege.png"}}}}"#
                    )
                    .into_bytes()
                } else if chemin == "/assets?t=hdris" {
                    format!(r#"{{"ciel_bleu":{{"name":"Ciel bleu","categories":["outdoor","skies"],"tags":["sky"],"authors":{{"Dan":"All"}},"thumbnail_url":"{b}/thumbs/ciel_bleu.png"}}}}"#).into_bytes()
                } else if chemin == "/files/Bouteille" {
                    format!(r#"{{"gltf":{{"1k":{{"gltf":{{"url":"{b}/dl/Bouteille_1k.gltf","size":4,"include":{{"Bouteille.bin":{{"url":"{b}/dl/Bouteille.bin","size":3}},"textures/b.png":{{"url":"{b}/dl/b.png","size":5}}}}}}}}}}}}"#).into_bytes()
                } else if chemin == "/files/Piege" {
                    format!(r#"{{"gltf":{{"1k":{{"gltf":{{"url":"{b}/dl/x.gltf","size":4,"include":{{"../../hors.bin":{{"url":"{b}/dl/x.bin","size":3}}}}}}}}}}}}"#).into_bytes()
                } else if chemin == "/files/ciel_bleu" {
                    format!(r#"{{"hdri":{{"1k":{{"hdr":{{"url":"{b}/dl/ciel_bleu_1k.hdr","size":10}}}}}}}}"#).into_bytes()
                } else if chemin == "/dl/Bouteille_1k.gltf" {
                    b"GLTF".to_vec()
                } else if chemin == "/dl/Bouteille.bin" {
                    b"BIN".to_vec()
                } else if chemin == "/dl/b.png" {
                    b"IMAGE".to_vec()
                } else if chemin == "/dl/ciel_bleu_1k.hdr" {
                    b"#?RADIANCE".to_vec()
                } else if chemin.starts_with("/thumbs/") {
                    format!("APERCU {chemin}").into_bytes()
                } else {
                    Vec::new()
                };
                let code = if corps.is_empty() { "404 Not Found" } else { "200 OK" };
                let _ = flux.write_all(format!("HTTP/1.1 {code}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", corps.len()).as_bytes());
                let _ = flux.write_all(&corps);
            }
        });
        base
    }

    fn client(nom: &str) -> (ClientPolyHaven, PathBuf) {
        let base = faux_polyhaven();
        let cache = std::env::temp_dir().join(format!("eliot-polyhaven-{nom}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&cache);
        (ClientPolyHaven::avec_adresse(cache.clone(), format!("{base}/"), vec![format!("{base}/")]), cache)
    }

    #[test]
    fn chercher_trie_et_filtre_dans_l_index() {
        let (c, cache) = client("chercher");
        let tout = c.chercher(Genre::Modeles, "", None, 1).unwrap();
        assert_eq!(tout.total, 3);
        // Les plus téléchargés d'abord.
        assert_eq!(tout.elements[0].id, "Bouteille");
        assert_eq!(tout.elements[0].auteur, "Bob, Cid");
        assert_eq!(tout.elements[0].lien, "https://polyhaven.com/a/Bouteille");
        // Un mot du nom, sans accent ni majuscule ; un mot-clé ; une catégorie.
        assert_eq!(c.chercher(Genre::Modeles, "CHAISE", None, 1).unwrap().elements[0].id, "Chaise_bois");
        assert_eq!(c.chercher(Genre::Modeles, "glass", None, 1).unwrap().elements[0].id, "Bouteille");
        assert_eq!(c.chercher(Genre::Modeles, "", Some("seating"), 1).unwrap().total, 1);
        assert_eq!(c.chercher(Genre::Modeles, "chaise verre", None, 1).unwrap().total, 0);
        assert_eq!(c.categories(Genre::Modeles).unwrap()[0].nombre, 1);
        assert_eq!(c.chercher(Genre::Environnements, "sky", None, 1).unwrap().elements[0].id, "ciel_bleu");
        // L'index vient ensuite du cache.
        assert!(cache.join("index-models.json").exists());
        assert_eq!(&c.apercu(Genre::Modeles, "Bouteille").unwrap()[..7], b"APERCU ");
        assert!(c.apercu(Genre::Modeles, "Inconnu").is_err());
        let _ = fs::remove_dir_all(&cache);
    }

    #[test]
    fn un_modele_arrive_avec_ses_fichiers_et_son_credit() {
        let (c, cache) = client("telecharger");
        let dossier = c.dossier_de_telechargement("Bouteille");
        let mut parts = Vec::new();
        let (credit, nom, gltf) = c.telecharger_modele("Bouteille", "1k", &dossier, &mut |p| parts.push(p)).unwrap();
        assert_eq!(nom, "Bouteille");
        assert_eq!(credit.source, "Poly Haven");
        assert_eq!(credit.licence.as_deref(), Some("CC0 1.0"));
        assert_eq!(fs::read(&gltf).unwrap(), b"GLTF");
        assert_eq!(fs::read(dossier.join("Bouteille.bin")).unwrap(), b"BIN");
        assert_eq!(fs::read(dossier.join("textures/b.png")).unwrap(), b"IMAGE");
        assert_eq!(parts.last().copied(), Some(1.0));
        let cible = cache.join("ciel.hdr");
        let (credit, nom) = c.telecharger_environnement("ciel_bleu", &cible, &mut |_| ()).unwrap();
        assert_eq!((credit.auteur.as_str(), nom.as_str()), ("Dan", "Ciel bleu"));
        assert!(fs::read(&cible).unwrap().starts_with(b"#?RADIANCE"));
        let _ = fs::remove_dir_all(&cache);
    }

    #[test]
    fn un_chemin_qui_sort_du_dossier_est_refuse() {
        let (c, cache) = client("piege");
        // Un fichier cité hors du dossier du modèle : refusé avant tout téléchargement.
        assert!(matches!(c.telecharger_modele("Piege", "1k", &cache.join("t"), &mut |_| ()), Err(ErreurPolyHaven::Illisible(_))));
        assert!(!cache.join("hors.bin").exists());
        // Un identifiant absent de l'index, ou qui sort du cache : inconnu.
        assert!(matches!(c.telecharger_modele("Absent", "1k", &cache.join("t"), &mut |_| ()), Err(ErreurPolyHaven::Inconnu)));
        assert!(matches!(c.telecharger_modele("../x", "1k", &cache.join("t"), &mut |_| ()), Err(ErreurPolyHaven::Inconnu)));
        let _ = fs::remove_dir_all(&cache);
    }
}
