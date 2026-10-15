//! Sons libres de Freesound (étape 4, lot 5, BRIEF règle 12) : recherche, extraits à écouter,
//! téléchargement du son choisi. Tout passe par ici : la clé ne quitte jamais le noyau (elle
//! part dans un en-tête vers l'API, jamais dans une adresse), l'interface ne voit que des
//! identifiants et des octets.
//!
//! Règles de Freesound (https://freesound.org/docs/api/terms_of_use.html, BRIEF § 4) : usage
//! gratuit pour un usage non commercial ; créditer Freesound et l'auteur selon la licence du
//! son. Seuls les sons CC0 et CC BY sont proposés : ceux qui interdisent l'usage commercial
//! (CC BY-NC) et les anciens Sampling+ sont écartés dès la recherche, et une seconde fois à la
//! lecture de la réponse. Le fichier d'origine demande une connexion au compte (OAuth2) : Eliot
//! prend l'extrait de bonne qualité (OGG, environ 192 kbit/s), que la clé suffit à obtenir.

use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::fichiers::{self, ecrire_atomiquement};
use crate::images::Credit;

const DUREE_CACHE: Duration = Duration::from_secs(24 * 3600);
const ADRESSE_API: &str = "https://freesound.org/apiv2/";
const NOM_DE_LA_CLE: &str = "FREESOUND_API_KEY";
/// Un extrait de musique de dix minutes en OGG fait une quinzaine de Mo.
const TAILLE_MAX: u64 = 60 * 1024 * 1024;
const PAR_PAGE: u32 = 30;
const CHAMPS: &str = "id,name,username,license,duration,previews,tags,url";
const LICENCES_PERMISES: &str = "license:(\"Attribution\" OR \"Creative Commons 0\")";

#[derive(Debug, thiserror::Error)]
pub enum ErreurFreesound {
    #[error("pas de clé Freesound : ajouter FREESOUND_API_KEY dans le fichier .env du projet")]
    CleAbsente,
    #[error("Freesound injoignable : {0}")]
    Reseau(String),
    #[error("Freesound a refusé la demande (code {0})")]
    Refus(u16),
    #[error("réponse de Freesound illisible : {0}")]
    Illisible(String),
    #[error("son inconnu : relancer la recherche")]
    SonInconnu,
    #[error("fichier trop lourd (plus de {0} Mo)")]
    TropLourd(u64),
    #[error("adresse refusée : ce n'est pas une adresse de Freesound")]
    AdresseRefusee,
    #[error(transparent)]
    Disque(#[from] std::io::Error),
}

/// Cherche la clé dans des fichiers `.env` (une ligne `FREESOUND_API_KEY=…`), dans l'ordre.
pub fn lire_cle(fichiers: &[PathBuf]) -> Option<String> {
    fichiers::lire_cle(fichiers, NOM_DE_LA_CLE)
}

/// Ce qu'on cherche : des bruitages (30 s au plus), des musiques (20 s et plus) ou tout.
#[derive(Debug, Clone, Copy, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Genre {
    Bruitages,
    Musiques,
    #[default]
    Tout,
}

/// La licence lisible d'un son, d'après ce que dit l'API (un nom ou l'adresse de la licence) ;
/// `None` pour une licence qui interdit l'usage commercial ou qu'on ne connaît pas.
pub fn licence_de(texte: &str) -> Option<String> {
    let t = texte.trim().to_lowercase();
    if t.contains("noncommercial") || t.contains("by-nc") || t.contains("sampling") {
        return None;
    }
    if t.contains("publicdomain/zero") || t == "creative commons 0" || t == "cc0" {
        return Some("CC0 1.0".into());
    }
    if let Some(reste) = t.split("/licenses/by/").nth(1) {
        let version = reste.split('/').next().unwrap_or("").trim();
        let sure = !version.is_empty() && version.len() <= 4 && version.chars().all(|c| c.is_ascii_digit() || c == '.');
        return Some(if sure { format!("CC BY {version}") } else { "CC BY".into() });
    }
    (t == "attribution").then(|| "CC BY".into())
}

/// Un son tel que l'interface le voit.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SonFreesound {
    pub id: u64,
    pub nom: String,
    pub auteur: String,
    /// `CC0 1.0`, `CC BY 4.0`…
    pub licence: String,
    /// Durée, en secondes.
    pub duree: f64,
    /// La page du son sur Freesound, pour le crédit.
    pub lien: String,
    pub mots: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PageSons {
    pub total: u32,
    pub sons: Vec<SonFreesound>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct Extraits {
    #[serde(rename = "preview-hq-mp3", default)]
    hq_mp3: String,
    #[serde(rename = "preview-lq-mp3", default)]
    lq_mp3: String,
    #[serde(rename = "preview-hq-ogg", default)]
    hq_ogg: String,
    #[serde(rename = "preview-lq-ogg", default)]
    lq_ogg: String,
}

/// Ce que l'API renvoie pour un son (seuls les champs utiles).
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Resultat {
    id: u64,
    #[serde(default)]
    name: String,
    #[serde(default)]
    username: String,
    #[serde(default)]
    license: String,
    #[serde(default)]
    duration: f64,
    #[serde(default)]
    previews: Extraits,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    url: String,
}

#[derive(Deserialize)]
struct ReponseApi {
    #[serde(default)]
    count: u32,
    #[serde(default)]
    results: Vec<Resultat>,
}

pub struct ClientFreesound {
    cle: String,
    adresse: String,
    cache: PathBuf,
    agent: ureq::Agent,
    /// Débuts d'adresse d'où un extrait peut être téléchargé.
    origines: Vec<String>,
}

impl ClientFreesound {
    pub fn new(cle: String, cache: PathBuf) -> Self {
        Self::avec_adresse(cle, cache, ADRESSE_API.to_string(), vec!["https://freesound.org/".into(), "https://cdn.freesound.org/".into()])
    }

    /// Pour les tests : une autre adresse d'API et d'autres origines permises.
    pub fn avec_adresse(cle: String, cache: PathBuf, adresse: String, origines: Vec<String>) -> Self {
        let agent: ureq::Agent = ureq::Agent::config_builder()
            .timeout_global(Some(Duration::from_secs(60)))
            .user_agent("Eliot (editeur graphique local)")
            .build()
            .into();
        Self { cle, adresse, cache, agent, origines }
    }

    /// Un message d'erreur ne doit jamais contenir la clé (il remonte jusqu'à l'interface).
    fn masquer(&self, message: String) -> String {
        if self.cle.is_empty() { message } else { message.replace(&self.cle, "***") }
    }

    /// Une demande à l'API : la clé part dans l'en-tête `Authorization`.
    fn demander_api(&self, parametres: &[(&str, &str)]) -> Result<Vec<u8>, ErreurFreesound> {
        let mut demande = self.agent.get(format!("{}search/", self.adresse)).header("Authorization", format!("Token {}", self.cle));
        for (nom, valeur) in parametres {
            demande = demande.query(*nom, *valeur);
        }
        let mut reponse = match demande.call() {
            Ok(r) => r,
            Err(ureq::Error::StatusCode(code)) => return Err(ErreurFreesound::Refus(code)),
            Err(e) => return Err(ErreurFreesound::Reseau(self.masquer(e.to_string()))),
        };
        reponse.body_mut().with_config().limit(TAILLE_MAX).read_to_vec().map_err(|e| ErreurFreesound::Reseau(self.masquer(e.to_string())))
    }

    /// Télécharge un extrait (sans la clé : les extraits sont servis à tous) dans `cible`, sans
    /// tout garder en mémoire ; `avancement` reçoit la part reçue quand la taille est connue.
    fn lire_vers(&self, adresse: &str, cible: &Path, avancement: &mut dyn FnMut(f32)) -> Result<u64, ErreurFreesound> {
        self.adresse_permise(adresse)?;
        let mut reponse = match self.agent.get(adresse).call() {
            Ok(r) => r,
            Err(ureq::Error::StatusCode(code)) => return Err(ErreurFreesound::Refus(code)),
            Err(e) => return Err(ErreurFreesound::Reseau(self.masquer(e.to_string()))),
        };
        let attendu = reponse.body().content_length();
        if attendu.is_some_and(|n| n > TAILLE_MAX) {
            return Err(ErreurFreesound::TropLourd(TAILLE_MAX / 1024 / 1024));
        }
        let mut lecteur = reponse.body_mut().with_config().limit(TAILLE_MAX).reader();
        if let Some(dossier) = cible.parent() {
            fs::create_dir_all(dossier)?;
        }
        let mut fichier = File::create(cible)?;
        let mut tampon = vec![0u8; 256 * 1024];
        let mut recu: u64 = 0;
        loop {
            let n = lecteur.read(&mut tampon).map_err(|e| ErreurFreesound::Reseau(self.masquer(e.to_string())))?;
            if n == 0 {
                break;
            }
            fichier.write_all(&tampon[..n])?;
            recu += n as u64;
            if let Some(total) = attendu.filter(|t| *t > 0) {
                avancement((recu as f32 / total as f32).min(1.0));
            }
        }
        fichier.sync_all()?;
        avancement(1.0);
        Ok(recu)
    }

    fn fichier_cache(&self, sous_dossier: &str, nom: &str) -> PathBuf {
        self.cache.join(sous_dossier).join(nom)
    }

    fn frais(chemin: &Path) -> bool {
        fs::metadata(chemin)
            .and_then(|m| m.modified())
            .ok()
            .and_then(|date| SystemTime::now().duration_since(date).ok())
            .is_some_and(|age| age < DUREE_CACHE)
    }

    fn adresse_permise(&self, adresse: &str) -> Result<(), ErreurFreesound> {
        if self.origines.iter().any(|o| adresse.starts_with(o.as_str())) { Ok(()) } else { Err(ErreurFreesound::AdresseRefusee) }
    }

    /// Une page de résultats (30 sons, CC0 et CC BY seulement), depuis le cache s'il a moins de
    /// 24 h (Freesound limite à 2 000 demandes par jour).
    pub fn chercher(&self, requete: &str, page: u32, genre: Genre) -> Result<PageSons, ErreurFreesound> {
        if self.cle.is_empty() {
            return Err(ErreurFreesound::CleAbsente);
        }
        let requete: String = requete.trim().chars().take(100).collect();
        let page = page.clamp(1, 20).to_string();
        let filtre = match genre {
            Genre::Bruitages => format!("{LICENCES_PERMISES} AND duration:[0 TO 30]"),
            Genre::Musiques => format!("{LICENCES_PERMISES} AND duration:[20 TO *]"),
            Genre::Tout => LICENCES_PERMISES.to_string(),
        };
        let empreinte: String = Sha256::digest(format!("{requete}|{page}|{genre:?}").as_bytes()).iter().take(16).map(|o| format!("{o:02x}")).collect();
        let cache = self.fichier_cache("recherches", &format!("{empreinte}.json"));
        let resultats: Vec<Resultat> = if Self::frais(&cache) {
            serde_json::from_slice(&fs::read(&cache)?).map_err(|e| ErreurFreesound::Illisible(e.to_string()))?
        } else {
            let par_page = PAR_PAGE.to_string();
            let parametres = [("query", requete.as_str()), ("filter", filtre.as_str()), ("fields", CHAMPS), ("sort", "score"), ("page_size", par_page.as_str()), ("page", page.as_str())];
            let octets = match self.demander_api(&parametres) {
                // Au-delà de la dernière page, Freesound répond « 404 » : une page vide.
                Err(ErreurFreesound::Refus(404)) => br#"{"count":0,"results":[]}"#.to_vec(),
                autre => autre?,
            };
            let api: ReponseApi = serde_json::from_slice(&octets).map_err(|e| ErreurFreesound::Illisible(e.to_string()))?;
            fs::create_dir_all(cache.parent().expect("dans le cache"))?;
            ecrire_atomiquement(&cache, &serde_json::to_vec(&api.results).map_err(|e| ErreurFreesound::Illisible(e.to_string()))?)?;
            ecrire_atomiquement(&cache.with_extension("total"), api.count.to_string().as_bytes())?;
            api.results
        };
        let total = fs::read_to_string(cache.with_extension("total")).ok().and_then(|t| t.trim().parse().ok()).unwrap_or(resultats.len() as u32);

        // Chaque son garde ses adresses à part : l'extrait et le téléchargement le retrouvent par
        // son identifiant.
        fs::create_dir_all(self.cache.join("sons"))?;
        let mut sons = Vec::new();
        for r in resultats {
            let Some(licence) = licence_de(&r.license) else { continue };
            ecrire_atomiquement(&self.fichier_cache("sons", &format!("{}.json", r.id)), &serde_json::to_vec(&r).map_err(|e| ErreurFreesound::Illisible(e.to_string()))?)?;
            sons.push(SonFreesound { id: r.id, nom: r.name, auteur: r.username, licence, duree: (r.duration * 10.0).round() / 10.0, lien: r.url, mots: r.tags.join(", ") });
        }
        Ok(PageSons { total, sons })
    }

    fn resultat(&self, id: u64) -> Result<Resultat, ErreurFreesound> {
        let chemin = self.fichier_cache("sons", &format!("{id}.json"));
        if !Self::frais(&chemin) {
            return Err(ErreurFreesound::SonInconnu);
        }
        let texte = fs::read(&chemin).map_err(|_| ErreurFreesound::SonInconnu)?;
        let r: Resultat = serde_json::from_slice(&texte).map_err(|e| ErreurFreesound::Illisible(e.to_string()))?;
        if licence_de(&r.license).is_none() {
            return Err(ErreurFreesound::SonInconnu);
        }
        Ok(r)
    }

    /// L'extrait léger d'un son (MP3, environ 64 kbit/s), à écouter avant de choisir ; gardé en
    /// cache 24 h.
    pub fn extrait(&self, id: u64) -> Result<Vec<u8>, ErreurFreesound> {
        let cache = self.fichier_cache("extraits", &format!("{id}.mp3"));
        if Self::frais(&cache) {
            return Ok(fs::read(&cache)?);
        }
        let r = self.resultat(id)?;
        let adresse = [&r.previews.lq_mp3, &r.previews.hq_mp3].into_iter().find(|a| !a.is_empty()).ok_or(ErreurFreesound::SonInconnu)?;
        let temporaire = fichiers::chemin_temporaire(&cache)?;
        if let Err(e) = self.lire_vers(adresse, &temporaire, &mut |_| ()) {
            let _ = fs::remove_file(&temporaire);
            return Err(e);
        }
        fs::rename(&temporaire, &cache)?;
        Ok(fs::read(&cache)?)
    }

    /// Le son choisi, téléchargé dans `cible` (l'extrait de bonne qualité), avec son crédit et
    /// son nom.
    pub fn telecharger(&self, id: u64, cible: &Path, avancement: &mut dyn FnMut(f32)) -> Result<(Credit, String), ErreurFreesound> {
        let r = self.resultat(id)?;
        let licence = licence_de(&r.license).ok_or(ErreurFreesound::SonInconnu)?;
        let adresse = [&r.previews.hq_ogg, &r.previews.hq_mp3, &r.previews.lq_ogg, &r.previews.lq_mp3].into_iter().find(|a| !a.is_empty()).ok_or(ErreurFreesound::SonInconnu)?;
        if let Err(e) = self.lire_vers(adresse, cible, avancement) {
            let _ = fs::remove_file(cible);
            return Err(e);
        }
        let titre = if r.name.trim().is_empty() { format!("Son {}", r.id) } else { r.name.trim().to_string() };
        let credit = Credit { source: "Freesound".into(), auteur: r.username.clone(), lien: r.url.clone(), licence: Some(licence), titre: Some(titre.clone()) };
        Ok((credit, titre))
    }

    /// Retire du cache ce qui a plus de 24 h. Ne touche qu'aux sous-dossiers du cache, et
    /// qu'aux fichiers. Renvoie le nombre de fichiers retirés.
    pub fn nettoyer(&self) -> usize {
        let mut retires = 0;
        for sous_dossier in ["recherches", "sons", "extraits", "telechargements"] {
            let Ok(entrees) = fs::read_dir(self.cache.join(sous_dossier)) else { continue };
            for entree in entrees.flatten() {
                let chemin = entree.path();
                if entree.file_type().is_ok_and(|t| t.is_file()) && !Self::frais(&chemin) && fs::remove_file(&chemin).is_ok() {
                    retires += 1;
                }
            }
        }
        retires
    }

    /// Où télécharger un son avant de l'importer (effacé ensuite par l'appelant).
    pub fn fichier_de_telechargement(&self, id: u64) -> PathBuf {
        self.fichier_cache("telechargements", &format!("{id}.ogg"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader};
    use std::net::TcpListener;
    use std::sync::{Arc, Mutex};

    /// Une demande reçue par le faux Freesound : chemin et en-tête `Authorization`.
    type Demandes = Arc<Mutex<Vec<(String, Option<String>)>>>;

    /// Un faux Freesound local : il répond à la recherche et sert les extraits.
    fn faux_freesound() -> (String, Demandes) {
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
                    let mut entete = String::new();
                    if lecteur.read_line(&mut entete).unwrap_or(0) == 0 || entete.trim().is_empty() {
                        break;
                    }
                    if let Some((nom, valeur)) = entete.split_once(':')
                        && nom.eq_ignore_ascii_case("authorization")
                    {
                        autorisation = Some(valeur.trim().to_string());
                    }
                }
                d.lock().unwrap().push((chemin.clone(), autorisation));
                let previews = |id: u64| format!(r#"{{"preview-hq-mp3":"{b}/previews/{id}-hq.mp3","preview-lq-mp3":"{b}/previews/{id}-lq.mp3","preview-hq-ogg":"{b}/previews/{id}-hq.ogg","preview-lq-ogg":"{b}/previews/{id}-lq.ogg"}}"#);
                let (code, type_mime, corps): (&str, &str, Vec<u8>) = if chemin.starts_with("/apiv2/search/") && chemin.contains("page=9") {
                    ("404 Not Found", "application/json", br#"{"detail":"Invalid page."}"#.to_vec())
                } else if chemin.starts_with("/apiv2/search/") {
                    let json = format!(
                        r#"{{"count":4,"next":null,"results":[
                        {{"id":1,"name":"Pluie sur le toit","username":"Anne","license":"http://creativecommons.org/licenses/by/4.0/","duration":12.34,"previews":{},"tags":["pluie","toit"],"url":"https://freesound.org/people/Anne/sounds/1/"}},
                        {{"id":2,"name":"Porte","username":"Bob","license":"Creative Commons 0","duration":1.5,"previews":{},"tags":["porte"],"url":"https://freesound.org/people/Bob/sounds/2/"}},
                        {{"id":3,"name":"Interdit","username":"Cid","license":"http://creativecommons.org/licenses/by-nc/4.0/","duration":3,"previews":{},"tags":[],"url":"https://freesound.org/people/Cid/sounds/3/"}},
                        {{"id":4,"name":"Ailleurs","username":"Dan","license":"Creative Commons 0","duration":2,"previews":{{"preview-hq-ogg":"https://ailleurs.example/4.ogg","preview-lq-mp3":"https://ailleurs.example/4.mp3"}},"tags":[],"url":"https://freesound.org/people/Dan/sounds/4/"}}]}}"#,
                        previews(1),
                        previews(2),
                        previews(3)
                    );
                    ("200 OK", "application/json", json.into_bytes())
                } else if chemin.starts_with("/previews/") {
                    ("200 OK", "audio/mpeg", format!("SON {chemin}").repeat(50).into_bytes())
                } else {
                    ("404 Not Found", "text/plain", b"introuvable".to_vec())
                };
                let entete = format!("HTTP/1.1 {code}\r\nContent-Type: {type_mime}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", corps.len());
                let _ = flux.write_all(entete.as_bytes());
                let _ = flux.write_all(&corps);
            }
        });
        (base, demandes)
    }

    /// Une adresse lisible : `%XX` et `+` décodés.
    fn decoder(adresse: &str) -> String {
        let octets = adresse.as_bytes();
        let mut sortie = Vec::new();
        let mut i = 0;
        while i < octets.len() {
            match octets[i] {
                b'%' if i + 2 < octets.len() => {
                    sortie.push(u8::from_str_radix(&adresse[i + 1..i + 3], 16).unwrap());
                    i += 3;
                }
                b'+' => {
                    sortie.push(b' ');
                    i += 1;
                }
                o => {
                    sortie.push(o);
                    i += 1;
                }
            }
        }
        String::from_utf8(sortie).unwrap()
    }

    fn client(base: &str, nom: &str) -> (ClientFreesound, PathBuf) {
        let cache = std::env::temp_dir().join(format!("eliot-freesound-{nom}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&cache);
        (ClientFreesound::avec_adresse("CLE-SECRETE".into(), cache.clone(), format!("{base}/apiv2/"), vec![format!("{base}/previews/")]), cache)
    }

    #[test]
    fn les_licences_permises_et_les_autres() {
        assert_eq!(licence_de("http://creativecommons.org/licenses/by/4.0/").as_deref(), Some("CC BY 4.0"));
        assert_eq!(licence_de("https://creativecommons.org/licenses/by/3.0/").as_deref(), Some("CC BY 3.0"));
        assert_eq!(licence_de("http://creativecommons.org/publicdomain/zero/1.0/").as_deref(), Some("CC0 1.0"));
        assert_eq!(licence_de("Creative Commons 0").as_deref(), Some("CC0 1.0"));
        assert_eq!(licence_de("Attribution").as_deref(), Some("CC BY"));
        for refusee in ["Attribution NonCommercial", "http://creativecommons.org/licenses/by-nc/3.0/", "http://creativecommons.org/licenses/sampling+/1.0/", "", "autre"] {
            assert_eq!(licence_de(refusee), None, "{refusee}");
        }
    }

    #[test]
    fn une_recherche_ne_garde_que_cc0_et_cc_by_et_la_cle_reste_dans_l_en_tete() {
        let (base, demandes) = faux_freesound();
        let (c, cache) = client(&base, "recherche");
        let page = c.chercher("pluie", 1, Genre::Bruitages).unwrap();
        assert_eq!(page.total, 4);
        let ids: Vec<u64> = page.sons.iter().map(|s| s.id).collect();
        assert_eq!(ids, vec![1, 2, 4], "le son CC BY-NC est écarté");
        assert_eq!(
            page.sons[0],
            SonFreesound { id: 1, nom: "Pluie sur le toit".into(), auteur: "Anne".into(), licence: "CC BY 4.0".into(), duree: 12.3, lien: "https://freesound.org/people/Anne/sounds/1/".into(), mots: "pluie, toit".into() }
        );
        let api: Vec<(String, Option<String>)> = demandes.lock().unwrap().iter().filter(|d| d.0.starts_with("/apiv2/")).cloned().collect();
        assert_eq!(api.len(), 1);
        let (adresse, autorisation) = &api[0];
        assert_eq!(autorisation.as_deref(), Some("Token CLE-SECRETE"));
        assert!(!adresse.contains("CLE-SECRETE"), "la clé ne part jamais dans l'adresse : {adresse}");
        let adresse = decoder(adresse);
        assert!(adresse.contains("query=pluie") && adresse.contains("license:(\"Attribution\" OR \"Creative Commons 0\")") && adresse.contains("duration:[0 TO 30]"), "{adresse}");
        // La même recherche ne repart pas sur le réseau ; une autre sorte, si.
        c.chercher("pluie", 1, Genre::Bruitages).unwrap();
        c.chercher("pluie", 1, Genre::Musiques).unwrap();
        let api: Vec<String> = demandes.lock().unwrap().iter().filter(|d| d.0.starts_with("/apiv2/")).map(|d| decoder(&d.0)).collect();
        assert_eq!(api.len(), 2);
        assert!(api[1].contains("duration:[20 TO *]"), "{}", api[1]);
        // Après la dernière page : une page vide, pas une erreur.
        assert_eq!(c.chercher("pluie", 9, Genre::Tout).unwrap().sons.len(), 0);
        fs::remove_dir_all(&cache).unwrap();
    }

    #[test]
    fn extrait_et_son_choisi_viennent_seulement_de_freesound_sans_la_cle() {
        let (base, demandes) = faux_freesound();
        let (c, cache) = client(&base, "telechargement");
        c.chercher("pluie", 1, Genre::Tout).unwrap();
        assert!(c.extrait(1).unwrap().starts_with(b"SON /previews/1-lq.mp3"));
        let cible = c.fichier_de_telechargement(1);
        let mut parts = Vec::new();
        let (credit, titre) = c.telecharger(1, &cible, &mut |p| parts.push(p)).unwrap();
        assert!(fs::read(&cible).unwrap().starts_with(b"SON /previews/1-hq.ogg"));
        assert_eq!(parts.last(), Some(&1.0));
        assert_eq!(titre, "Pluie sur le toit");
        assert_eq!(credit, Credit { source: "Freesound".into(), auteur: "Anne".into(), lien: "https://freesound.org/people/Anne/sounds/1/".into(), licence: Some("CC BY 4.0".into()), titre: Some("Pluie sur le toit".into()) });
        // Les extraits partent sans la clé.
        assert!(demandes.lock().unwrap().iter().filter(|d| d.0.starts_with("/previews/")).all(|d| d.1.is_none()));
        assert!(matches!(c.telecharger(4, &cache.join("x.ogg"), &mut |_| ()), Err(ErreurFreesound::AdresseRefusee)), "une adresse hors de Freesound est refusée");
        assert!(!cache.join("x.ogg").exists());
        assert!(matches!(c.extrait(3), Err(ErreurFreesound::SonInconnu)), "un son CC BY-NC ne s'écoute pas non plus");
        assert!(matches!(c.extrait(99), Err(ErreurFreesound::SonInconnu)));
        fs::remove_dir_all(&cache).unwrap();
    }

    #[test]
    fn le_cache_ne_garde_rien_plus_de_24_heures() {
        let (base, _) = faux_freesound();
        let (c, cache) = client(&base, "nettoyage");
        c.chercher("pluie", 1, Genre::Tout).unwrap();
        c.extrait(2).unwrap();
        assert_eq!(c.nettoyer(), 0, "tout est frais");
        let vieux = SystemTime::now() - Duration::from_secs(25 * 3600);
        for sous in ["recherches", "sons", "extraits"] {
            for e in fs::read_dir(cache.join(sous)).unwrap().flatten() {
                fs::File::options().write(true).open(e.path()).unwrap().set_modified(vieux).unwrap();
            }
        }
        assert!(matches!(c.extrait(1), Err(ErreurFreesound::SonInconnu)));
        assert_eq!(c.nettoyer(), 6, "recherche, total, trois sons, un extrait");
        fs::remove_dir_all(&cache).unwrap();
    }

    #[test]
    fn sans_cle_rien_ne_part_et_la_cle_ne_fuit_pas_dans_les_erreurs() {
        let c = ClientFreesound::avec_adresse(String::new(), std::env::temp_dir(), "http://127.0.0.1:9/apiv2/".into(), vec![]);
        assert!(matches!(c.chercher("pluie", 1, Genre::Tout), Err(ErreurFreesound::CleAbsente)));
        let c = ClientFreesound::avec_adresse("CLE-SECRETE".into(), std::env::temp_dir().join("eliot-freesound-fuite"), "http://127.0.0.1:9/apiv2/".into(), vec![]);
        let erreur = c.chercher("pluie", 1, Genre::Tout).unwrap_err().to_string();
        assert!(!erreur.contains("CLE-SECRETE"), "{erreur}");
        let d = std::env::temp_dir().join(format!("eliot-env-freesound-{}", std::process::id()));
        fs::create_dir_all(&d).unwrap();
        fs::write(d.join(".env"), "PIXABAY_API_KEY=a\nFREESOUND_API_KEY='b2'\n").unwrap();
        assert_eq!(lire_cle(&[d.join(".env")]).as_deref(), Some("b2"));
        fs::remove_dir_all(&d).unwrap();
    }
}
