//! Photos libres de Pixabay (étape 3, BRIEF règle 12) : recherche, aperçus, téléchargement de
//! la photo choisie. Tout passe par ici : la clé ne quitte jamais le noyau, l'interface ne voit
//! que des identifiants et des octets.
//!
//! Règles de Pixabay (https://pixabay.com/api/docs/) : résultats gardés 24 h ; pas de lien
//! permanent vers leurs serveurs (la photo choisie est copiée dans le design) ; montrer d'où
//! viennent les photos ; pas de téléchargement en masse (seulement la photo choisie).

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::fichiers::ecrire_atomiquement;
use crate::images::Credit;

/// Durée de vie d'une recherche gardée en cache, comme le demande Pixabay.
const DUREE_CACHE: Duration = Duration::from_secs(24 * 3600);
const ADRESSE_API: &str = "https://pixabay.com/api/";
const NOM_DE_LA_CLE: &str = "PIXABAY_API_KEY";
/// Une photo de 1280 px fait quelques centaines de Ko ; on refuse au-delà de 40 Mo.
const TAILLE_MAX: u64 = 40 * 1024 * 1024;

#[derive(Debug, thiserror::Error)]
pub enum ErreurPixabay {
    #[error("pas de clé Pixabay : ajouter PIXABAY_API_KEY dans le fichier .env du projet")]
    CleAbsente,
    #[error("Pixabay injoignable : {0}")]
    Reseau(String),
    #[error("Pixabay a refusé la demande (code {0})")]
    Refus(u16),
    #[error("réponse de Pixabay illisible : {0}")]
    Illisible(String),
    #[error("photo inconnue : relancer la recherche")]
    PhotoInconnue,
    #[error("adresse refusée : ce n'est pas une adresse de Pixabay")]
    AdresseRefusee,
    #[error(transparent)]
    Disque(#[from] io::Error),
}

/// Cherche la clé dans des fichiers `.env` (une ligne `PIXABAY_API_KEY=…`), dans l'ordre.
pub fn lire_cle(fichiers: &[PathBuf]) -> Option<String> {
    for fichier in fichiers {
        let Ok(texte) = fs::read_to_string(fichier) else { continue };
        for ligne in texte.lines() {
            let ligne = ligne.trim().trim_start_matches("export ").trim();
            let Some((nom, valeur)) = ligne.split_once('=') else { continue };
            if nom.trim() == NOM_DE_LA_CLE {
                let valeur = valeur.trim().trim_matches(['"', '\'']).trim();
                if !valeur.is_empty() {
                    return Some(valeur.to_string());
                }
            }
        }
    }
    None
}

/// Les `.env` possibles : en remontant depuis un dossier de départ (le dépôt, en
/// développement), puis le fichier du dossier de configuration (version installée).
pub fn fichiers_de_cle(depart: &Path, configuration: Option<&Path>) -> Vec<PathBuf> {
    let mut fichiers: Vec<PathBuf> = depart.ancestors().take(6).map(|d| d.join(".env")).collect();
    if let Some(c) = configuration {
        fichiers.push(c.join("cles.env"));
    }
    fichiers
}

/// Une photo telle que l'interface la voit.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Photo {
    pub id: u64,
    pub largeur: u32,
    pub hauteur: u32,
    pub auteur: String,
    /// Page de la photo sur Pixabay, pour le crédit.
    pub lien: String,
    pub mots: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PageResultats {
    pub total: u32,
    pub photos: Vec<Photo>,
}

/// Ce que l'API renvoie pour une photo (seuls les champs utiles).
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Resultat {
    id: u64,
    #[serde(rename = "pageURL")]
    page_url: String,
    #[serde(default)]
    tags: String,
    #[serde(rename = "webformatURL")]
    webformat_url: String,
    #[serde(rename = "largeImageURL")]
    large_image_url: String,
    #[serde(rename = "imageWidth")]
    image_width: u32,
    #[serde(rename = "imageHeight")]
    image_height: u32,
    #[serde(default)]
    user: String,
}

#[derive(Deserialize)]
struct ReponseApi {
    #[serde(rename = "totalHits")]
    total_hits: u32,
    hits: Vec<Resultat>,
}

/// Filtres de recherche que l'interface peut donner.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct Filtres {
    /// `horizontal` ou `vertical`.
    pub orientation: Option<String>,
    /// Une couleur de Pixabay : red, orange, yellow, green, turquoise, blue, lilac, pink,
    /// white, gray, black, brown, transparent, grayscale.
    pub couleur: Option<String>,
}

const ORIENTATIONS: [&str; 2] = ["horizontal", "vertical"];
const COULEURS: [&str; 14] = ["red", "orange", "yellow", "green", "turquoise", "blue", "lilac", "pink", "white", "gray", "black", "brown", "transparent", "grayscale"];

pub struct ClientPixabay {
    cle: String,
    adresse: String,
    cache: PathBuf,
    agent: ureq::Agent,
    /// Débuts d'adresse d'où une image peut être téléchargée.
    origines: Vec<String>,
}

impl ClientPixabay {
    pub fn new(cle: String, cache: PathBuf) -> Self {
        Self::avec_adresse(cle, cache, ADRESSE_API.to_string(), vec!["https://pixabay.com/".into(), "https://cdn.pixabay.com/".into()])
    }

    /// Pour les tests : une autre adresse d'API et d'autres origines permises.
    pub fn avec_adresse(cle: String, cache: PathBuf, adresse: String, origines: Vec<String>) -> Self {
        let agent: ureq::Agent = ureq::Agent::config_builder()
            .timeout_global(Some(Duration::from_secs(30)))
            .user_agent("Eliot (editeur graphique local)")
            .build()
            .into();
        Self { cle, adresse, cache, agent, origines }
    }

    /// Un message d'erreur ne doit jamais contenir la clé (il remonte jusqu'à l'interface).
    fn masquer(&self, message: String) -> String {
        if self.cle.is_empty() { message } else { message.replace(&self.cle, "***") }
    }

    fn lire(&self, adresse: &str, parametres: &[(&str, &str)]) -> Result<Vec<u8>, ErreurPixabay> {
        let mut demande = self.agent.get(adresse);
        for (nom, valeur) in parametres {
            demande = demande.query(*nom, *valeur);
        }
        let mut reponse = match demande.call() {
            Ok(r) => r,
            Err(ureq::Error::StatusCode(code)) => return Err(ErreurPixabay::Refus(code)),
            Err(e) => return Err(ErreurPixabay::Reseau(self.masquer(e.to_string()))),
        };
        reponse
            .body_mut()
            .with_config()
            .limit(TAILLE_MAX)
            .read_to_vec()
            .map_err(|e| ErreurPixabay::Reseau(self.masquer(e.to_string())))
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

    /// Une page de résultats (40 photos), depuis le cache s'il a moins de 24 h.
    pub fn chercher(&self, requete: &str, page: u32, filtres: &Filtres) -> Result<PageResultats, ErreurPixabay> {
        if self.cle.is_empty() {
            return Err(ErreurPixabay::CleAbsente);
        }
        let requete: String = requete.trim().chars().take(100).collect();
        let page = page.clamp(1, 12).to_string();
        let orientation = filtres.orientation.as_deref().filter(|o| ORIENTATIONS.contains(o));
        let couleur = filtres.couleur.as_deref().filter(|c| COULEURS.contains(c));
        let empreinte: String = Sha256::digest(format!("{requete}|{page}|{orientation:?}|{couleur:?}").as_bytes()).iter().take(16).map(|o| format!("{o:02x}")).collect();
        let cache = self.fichier_cache("recherches", &format!("{empreinte}.json"));

        let reponse: Vec<Resultat> = if Self::frais(&cache) {
            serde_json::from_slice(&fs::read(&cache)?).map_err(|e| ErreurPixabay::Illisible(e.to_string()))?
        } else {
            let mut parametres = vec![
                ("key", self.cle.as_str()),
                ("q", requete.as_str()),
                ("lang", "fr"),
                ("image_type", "photo"),
                ("safesearch", "true"),
                ("per_page", "40"),
                ("page", page.as_str()),
            ];
            if let Some(o) = orientation {
                parametres.push(("orientation", o));
            }
            if let Some(c) = couleur {
                parametres.push(("colors", c));
            }
            let octets = self.lire(&self.adresse, &parametres)?;
            let api: ReponseApi = serde_json::from_slice(&octets).map_err(|e| ErreurPixabay::Illisible(e.to_string()))?;
            fs::create_dir_all(cache.parent().unwrap())?;
            ecrire_atomiquement(&cache, &serde_json::to_vec(&api.hits).map_err(|e| ErreurPixabay::Illisible(e.to_string()))?)?;
            // Le nombre total va avec la recherche : on le garde à côté.
            ecrire_atomiquement(&cache.with_extension("total"), api.total_hits.to_string().as_bytes())?;
            api.hits
        };
        let total = fs::read_to_string(cache.with_extension("total")).ok().and_then(|t| t.trim().parse().ok()).unwrap_or(reponse.len() as u32);

        // Chaque photo garde ses adresses à part : le téléchargement les retrouve par l'identifiant.
        fs::create_dir_all(self.cache.join("photos"))?;
        for r in &reponse {
            ecrire_atomiquement(&self.fichier_cache("photos", &format!("{}.json", r.id)), &serde_json::to_vec(r).map_err(|e| ErreurPixabay::Illisible(e.to_string()))?)?;
        }
        Ok(PageResultats {
            total,
            photos: reponse
                .into_iter()
                .map(|r| Photo { id: r.id, largeur: r.image_width, hauteur: r.image_height, auteur: r.user, lien: r.page_url, mots: r.tags })
                .collect(),
        })
    }

    /// Les adresses d'une photo trouvée par une recherche. Pixabay ne les garantit que 24 h :
    /// au-delà, la photo est tenue pour inconnue et il faut relancer la recherche.
    fn resultat(&self, id: u64) -> Result<Resultat, ErreurPixabay> {
        let chemin = self.fichier_cache("photos", &format!("{id}.json"));
        if !Self::frais(&chemin) {
            return Err(ErreurPixabay::PhotoInconnue);
        }
        let texte = fs::read(&chemin).map_err(|_| ErreurPixabay::PhotoInconnue)?;
        serde_json::from_slice(&texte).map_err(|e| ErreurPixabay::Illisible(e.to_string()))
    }

    /// Retire du cache ce qui a plus de 24 h (Pixabay ne permet pas de garder plus longtemps).
    /// Ne touche qu'aux trois sous-dossiers du cache, et qu'aux fichiers. Renvoie le nombre de
    /// fichiers retirés.
    pub fn nettoyer(&self) -> usize {
        let mut retires = 0;
        for sous_dossier in ["recherches", "photos", "apercus"] {
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

    fn adresse_permise(&self, adresse: &str) -> Result<(), ErreurPixabay> {
        if self.origines.iter().any(|o| adresse.starts_with(o.as_str())) { Ok(()) } else { Err(ErreurPixabay::AdresseRefusee) }
    }

    /// L'aperçu d'une photo (340 px de haut), gardé en cache 24 h.
    pub fn apercu(&self, id: u64) -> Result<Vec<u8>, ErreurPixabay> {
        let cache = self.fichier_cache("apercus", &format!("{id}.jpg"));
        if Self::frais(&cache) {
            return Ok(fs::read(&cache)?);
        }
        let r = self.resultat(id)?;
        // Pixabay sert les aperçus en plusieurs tailles : « _640 » devient « _340 » (340 px de
        // haut, assez pour une vignette nette sur un écran dense).
        let adresse = r.webformat_url.replace("_640.", "_340.");
        self.adresse_permise(&adresse)?;
        let octets = self.lire(&adresse, &[])?;
        fs::create_dir_all(cache.parent().unwrap())?;
        ecrire_atomiquement(&cache, &octets)?;
        Ok(octets)
    }

    /// La photo choisie, en grand (1 280 px), avec son crédit et un nom de fichier.
    pub fn telecharger(&self, id: u64) -> Result<(Vec<u8>, Credit, String), ErreurPixabay> {
        let r = self.resultat(id)?;
        self.adresse_permise(&r.large_image_url)?;
        let octets = self.lire(&r.large_image_url, &[])?;
        let credit = Credit { source: "Pixabay".into(), auteur: r.user.clone(), lien: r.page_url.clone() };
        let premier_mot = r.tags.split(',').next().unwrap_or("photo").trim().to_string();
        Ok((octets, credit, format!("pixabay-{}-{}.jpg", premier_mot.replace(' ', "-"), r.id)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader, Write};
    use std::net::TcpListener;
    use std::sync::{Arc, Mutex};

    /// Un faux Pixabay local : il répond à l'API et sert deux images, et note les demandes.
    fn faux_pixabay() -> (String, Arc<Mutex<Vec<String>>>) {
        let ecoute = TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}", ecoute.local_addr().unwrap());
        let demandes = Arc::new(Mutex::new(Vec::new()));
        let (b, d) = (base.clone(), demandes.clone());
        std::thread::spawn(move || {
            for flux in ecoute.incoming() {
                let Ok(mut flux) = flux else { continue };
                let mut ligne = String::new();
                BufReader::new(&flux).read_line(&mut ligne).unwrap();
                let chemin = ligne.split_whitespace().nth(1).unwrap_or("/").to_string();
                d.lock().unwrap().push(chemin.clone());
                let (type_mime, corps): (&str, Vec<u8>) = if chemin.starts_with("/api/") {
                    let json = format!(
                        r#"{{"total":2,"totalHits":2,"hits":[{{"id":11,"pageURL":"https://pixabay.com/photos/chat-11/","tags":"chat, animal","webformatURL":"{b}/img/11_640.jpg","largeImageURL":"{b}/img/11_1280.jpg","imageWidth":4000,"imageHeight":3000,"user":"Anne"}},{{"id":12,"pageURL":"https://pixabay.com/photos/x-12/","tags":"x","webformatURL":"https://ailleurs.example/12_640.jpg","largeImageURL":"https://ailleurs.example/12.jpg","imageWidth":10,"imageHeight":10,"user":"B"}}]}}"#
                    );
                    ("application/json", json.into_bytes())
                } else if chemin.starts_with("/img/") {
                    ("image/jpeg", format!("IMAGE {chemin}").into_bytes())
                } else {
                    ("text/plain", b"introuvable".to_vec())
                };
                let code = if type_mime == "text/plain" { "404 Not Found" } else { "200 OK" };
                let entete = format!("HTTP/1.1 {code}\r\nContent-Type: {type_mime}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", corps.len());
                let _ = flux.write_all(entete.as_bytes());
                let _ = flux.write_all(&corps);
            }
        });
        (base, demandes)
    }

    fn client(base: &str, nom: &str) -> (ClientPixabay, PathBuf) {
        let cache = std::env::temp_dir().join(format!("eliot-pixabay-{nom}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&cache);
        (ClientPixabay::avec_adresse("CLE-SECRETE".into(), cache.clone(), format!("{base}/api/"), vec![format!("{base}/img/")]), cache)
    }

    #[test]
    fn la_cle_se_lit_dans_un_env_et_jamais_ailleurs() {
        let d = std::env::temp_dir().join(format!("eliot-env-{}", std::process::id()));
        fs::create_dir_all(d.join("sous")).unwrap();
        fs::write(d.join(".env"), "AUTRE=1\n# commentaire\nexport PIXABAY_API_KEY=\"abc123\"\n").unwrap();
        assert_eq!(lire_cle(&fichiers_de_cle(&d.join("sous"), None)), Some("abc123".into()));
        assert_eq!(lire_cle(&[d.join("absent.env")]), None);
        fs::remove_dir_all(&d).unwrap();
    }

    #[test]
    fn une_recherche_donne_les_photos_et_reste_en_cache() {
        let (base, demandes) = faux_pixabay();
        let (c, cache) = client(&base, "recherche");
        let page = c.chercher("chat", 1, &Filtres::default()).unwrap();
        assert_eq!(page.total, 2);
        assert_eq!(page.photos[0], Photo { id: 11, largeur: 4000, hauteur: 3000, auteur: "Anne".into(), lien: "https://pixabay.com/photos/chat-11/".into(), mots: "chat, animal".into() });
        let api = demandes.lock().unwrap().iter().filter(|d| d.starts_with("/api/")).cloned().collect::<Vec<_>>();
        assert_eq!(api.len(), 1);
        assert!(api[0].contains("q=chat") && api[0].contains("lang=fr") && api[0].contains("safesearch=true"));
        // La même recherche ne repart pas sur le réseau.
        c.chercher("chat", 1, &Filtres::default()).unwrap();
        assert_eq!(demandes.lock().unwrap().iter().filter(|d| d.starts_with("/api/")).count(), 1);
        fs::remove_dir_all(&cache).unwrap();
    }

    #[test]
    fn apercu_et_photo_choisie_viennent_seulement_de_pixabay() {
        let (base, demandes) = faux_pixabay();
        let (c, cache) = client(&base, "telechargement");
        c.chercher("chat", 1, &Filtres::default()).unwrap();
        assert_eq!(c.apercu(11).unwrap(), b"IMAGE /img/11_340.jpg");
        assert!(demandes.lock().unwrap().iter().any(|d| d == "/img/11_340.jpg"), "l'aperçu est demandé en 340 px");
        let (octets, credit, nom) = c.telecharger(11).unwrap();
        assert_eq!(octets, b"IMAGE /img/11_1280.jpg");
        assert_eq!(credit, Credit { source: "Pixabay".into(), auteur: "Anne".into(), lien: "https://pixabay.com/photos/chat-11/".into() });
        assert_eq!(nom, "pixabay-chat-11.jpg");
        assert!(matches!(c.telecharger(12), Err(ErreurPixabay::AdresseRefusee)), "une adresse hors de Pixabay est refusée");
        assert!(matches!(c.telecharger(99), Err(ErreurPixabay::PhotoInconnue)));
        fs::remove_dir_all(&cache).unwrap();
    }

    #[test]
    fn le_cache_ne_garde_rien_plus_de_24_heures() {
        let (base, _) = faux_pixabay();
        let (c, cache) = client(&base, "nettoyage");
        c.chercher("chat", 1, &Filtres::default()).unwrap();
        c.apercu(11).unwrap();
        assert_eq!(c.nettoyer(), 0, "tout est frais");
        // On vieillit tous les fichiers de 25 h.
        let vieux = SystemTime::now() - Duration::from_secs(25 * 3600);
        for sous in ["recherches", "photos", "apercus"] {
            for e in fs::read_dir(cache.join(sous)).unwrap().flatten() {
                fs::File::options().write(true).open(e.path()).unwrap().set_modified(vieux).unwrap();
            }
        }
        assert!(matches!(c.telecharger(11), Err(ErreurPixabay::PhotoInconnue)), "les adresses de plus de 24 h ne servent plus");
        assert_eq!(c.nettoyer(), 5, "recherche, total, deux photos, un aperçu");
        assert_eq!(fs::read_dir(cache.join("photos")).unwrap().count(), 0);
        fs::remove_dir_all(&cache).unwrap();
    }

    #[test]
    fn sans_cle_rien_ne_part_et_la_cle_ne_fuit_pas_dans_les_erreurs() {
        let c = ClientPixabay::avec_adresse(String::new(), std::env::temp_dir(), "http://127.0.0.1:9/api/".into(), vec![]);
        assert!(matches!(c.chercher("chat", 1, &Filtres::default()), Err(ErreurPixabay::CleAbsente)));
        let c = ClientPixabay::avec_adresse("CLE-SECRETE".into(), std::env::temp_dir().join("eliot-pixabay-fuite"), "http://127.0.0.1:9/api/".into(), vec![]);
        let erreur = c.chercher("chat", 1, &Filtres::default()).unwrap_err().to_string();
        assert!(!erreur.contains("CLE-SECRETE"), "{erreur}");
    }
}
