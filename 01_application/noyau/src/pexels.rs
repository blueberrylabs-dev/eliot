//! Photos et vidéos de Pexels (étape 7, lot 5, BRIEF règle 12), à côté de celles de Pixabay :
//! recherche, aperçus, téléchargement de la photo ou de la vidéo choisie. Tout passe par ici :
//! la clé (`PEXELS_API_KEY` dans le `.env`) ne quitte jamais le noyau, elle ne part que dans
//! l'en-tête `Authorization` des demandes à l'API de Pexels, jamais vers ses serveurs d'images ;
//! l'interface ne voit que des identifiants et des octets.
//!
//! Règles de l'API (https://www.pexels.com/api/documentation/, lues le 2026-10-17) : montrer un
//! lien bien visible vers Pexels là où ses résultats s'affichent ; citer le photographe quand
//! c'est possible (« Photo de … sur Pexels », avec le lien de la photo et celui de son auteur) ;
//! 200 demandes par heure et 20 000 par mois ; ne pas refaire Pexels (une banque concurrente).
//! Comme pour Pixabay, une recherche reste 24 h en cache et seule la photo ou la vidéo choisie
//! se télécharge, copiée dans le design.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::fichiers::{self, ecrire_atomiquement};
use crate::images::Credit;
use crate::reseau::{self, ErreurReseau};

const ADRESSE_API: &str = "https://api.pexels.com/v1/";
const NOM_DE_LA_CLE: &str = "PEXELS_API_KEY";
const DUREE_CACHE: Duration = Duration::from_secs(24 * 3600);
/// Comme Pixabay : 40 résultats par page, 12 pages au plus (l'API en donne jusqu'à 80).
const PAR_PAGE: u32 = 40;
const PAGES_MAX: u32 = 12;
/// Une photo originale de Pexels fait de 2 à 20 Mo ; on refuse au-delà de 60 Mo.
const TAILLE_MAX: u64 = 60 * 1024 * 1024;
const TAILLE_MAX_VIDEO: u64 = 500 * 1024 * 1024;
const TAILLE_MAX_API: u64 = 8 * 1024 * 1024;

#[derive(Debug, thiserror::Error)]
pub enum ErreurPexels {
    #[error("pas de clé Pexels : ajouter PEXELS_API_KEY dans le fichier .env du projet")]
    CleAbsente,
    #[error("Pexels a refusé la clé (code {0}) : vérifier PEXELS_API_KEY dans le fichier .env")]
    CleRefusee(u16),
    #[error("Pexels : trop de demandes (200 par heure au plus) ; réessayer dans un moment")]
    Limite,
    #[error("Pexels : {0}")]
    Reseau(#[from] ErreurReseau),
    #[error("réponse de Pexels illisible : {0}")]
    Illisible(String),
    #[error("photo ou vidéo inconnue : relancer la recherche")]
    Inconnue,
    #[error(transparent)]
    Disque(#[from] std::io::Error),
}

/// Cherche la clé dans des fichiers `.env` (une ligne `PEXELS_API_KEY=…`), dans l'ordre.
pub fn lire_cle(fichiers: &[PathBuf]) -> Option<String> {
    fichiers::lire_cle(fichiers, NOM_DE_LA_CLE)
}

/// Une photo telle que l'interface la voit.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PhotoPexels {
    pub id: u64,
    pub largeur: u32,
    pub hauteur: u32,
    /// Le photographe.
    pub auteur: String,
    /// Sa page sur Pexels.
    #[serde(rename = "lienAuteur")]
    pub lien_auteur: String,
    /// La page de la photo sur Pexels, pour le crédit.
    pub lien: String,
    /// Ce que montre la photo (son texte de remplacement, sinon les mots de son adresse).
    pub mots: String,
    /// Sa couleur moyenne (`#rrggbb`), le fond de la vignette avant l'aperçu.
    pub couleur: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PagePhotosPexels {
    pub total: u32,
    pub photos: Vec<PhotoPexels>,
}

/// Une vidéo telle que l'interface la voit.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VideoPexels {
    pub id: u64,
    /// Taille du fichier qui sera téléchargé (le 1080p, sinon le plus proche en dessous).
    pub largeur: u32,
    pub hauteur: u32,
    /// Durée, en secondes.
    pub duree: u32,
    pub auteur: String,
    #[serde(rename = "lienAuteur")]
    pub lien_auteur: String,
    pub lien: String,
    pub mots: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PageVideosPexels {
    pub total: u32,
    pub videos: Vec<VideoPexels>,
}

/// Filtres de recherche des photos.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct Filtres {
    /// `landscape`, `portrait` ou `square`.
    pub orientation: Option<String>,
    /// Une couleur de Pexels (red, orange, yellow, green, turquoise, blue, violet, pink, brown,
    /// black, gray, white) ou un code `#rrggbb` (une couleur de la marque).
    pub couleur: Option<String>,
}

const ORIENTATIONS: [&str; 3] = ["landscape", "portrait", "square"];
const COULEURS: [&str; 12] = ["red", "orange", "yellow", "green", "turquoise", "blue", "violet", "pink", "brown", "black", "gray", "white"];

fn couleur_permise(c: &str) -> bool {
    COULEURS.contains(&c) || (c.len() == 7 && c.starts_with('#') && c[1..].chars().all(|x| x.is_ascii_hexdigit()))
}

// ---- Ce que l'API renvoie (seuls les champs utiles) ----

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct Sources {
    #[serde(default)]
    original: String,
    #[serde(default)]
    large2x: String,
    #[serde(default)]
    large: String,
    #[serde(default)]
    medium: String,
    #[serde(default)]
    small: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PhotoBrute {
    id: u64,
    #[serde(default)]
    width: u32,
    #[serde(default)]
    height: u32,
    #[serde(default)]
    url: String,
    #[serde(default)]
    photographer: String,
    #[serde(default)]
    photographer_url: String,
    #[serde(default)]
    avg_color: Option<String>,
    #[serde(default)]
    alt: Option<String>,
    #[serde(default)]
    src: Sources,
}

#[derive(Deserialize)]
struct ReponsePhotos {
    #[serde(default)]
    total_results: u32,
    #[serde(default)]
    photos: Vec<PhotoBrute>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct FichierVideo {
    #[serde(default)]
    quality: Option<String>,
    #[serde(default)]
    file_type: Option<String>,
    #[serde(default)]
    width: Option<u32>,
    #[serde(default)]
    height: Option<u32>,
    #[serde(default)]
    link: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct Utilisateur {
    #[serde(default)]
    name: String,
    #[serde(default)]
    url: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct Image {
    #[serde(default)]
    picture: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct VideoBrute {
    id: u64,
    #[serde(default)]
    url: String,
    #[serde(default)]
    image: String,
    #[serde(default)]
    duration: u32,
    #[serde(default)]
    user: Utilisateur,
    #[serde(default)]
    video_files: Vec<FichierVideo>,
    #[serde(default)]
    video_pictures: Vec<Image>,
}

#[derive(Deserialize)]
struct ReponseVideos {
    #[serde(default)]
    total_results: u32,
    #[serde(default)]
    videos: Vec<VideoBrute>,
}

/// Les mots d'une adresse de Pexels (`…/photo/plage-au-coucher-du-soleil-2014422/`) :
/// « plage au coucher du soleil ».
fn mots_de_l_adresse(adresse: &str) -> String {
    let dernier = adresse.trim_end_matches('/').rsplit('/').next().unwrap_or("");
    let mots: Vec<&str> = dernier.split('-').filter(|m| !m.is_empty() && !m.chars().all(|c| c.is_ascii_digit())).collect();
    mots.join(" ")
}

/// Le fichier MP4 à télécharger : le plus grand dont le petit côté ne dépasse pas 1080 (le
/// 1080p, assez pour un export en 1080p sans le poids du 4K) ; sinon le plus petit qui existe.
fn a_telecharger(fichiers: &[FichierVideo]) -> Option<&FichierVideo> {
    let mp4: Vec<&FichierVideo> = fichiers
        .iter()
        .filter(|f| {
            let genre = f.file_type.as_deref().unwrap_or("");
            f.quality.as_deref() != Some("hls") && (genre == "video/mp4" || (genre.is_empty() && f.link.split('?').next().unwrap_or("").ends_with(".mp4"))) && f.width.unwrap_or(0) > 0 && f.height.unwrap_or(0) > 0 && !f.link.is_empty()
        })
        .collect();
    let cote = |f: &FichierVideo| f.width.unwrap_or(0).min(f.height.unwrap_or(0));
    mp4.iter().filter(|f| cote(f) <= 1080).max_by_key(|f| cote(f)).or_else(|| mp4.iter().min_by_key(|f| (cote(f), f.width.unwrap_or(0) * f.height.unwrap_or(0)))).copied()
}

/// L'extension d'une adresse d'image (`.jpeg`, `.png`), `jpg` par défaut.
fn extension(adresse: &str) -> &'static str {
    let chemin = adresse.split('?').next().unwrap_or("").to_ascii_lowercase();
    if chemin.ends_with(".png") {
        "png"
    } else if chemin.ends_with(".webp") {
        "webp"
    } else {
        "jpg"
    }
}

fn premier_mot(mots: &str, sinon: &str) -> String {
    let m: String = mots.split_whitespace().take(2).collect::<Vec<_>>().join("-").chars().filter(|c| c.is_alphanumeric() || *c == '-').collect::<String>().to_lowercase();
    if m.is_empty() { sinon.into() } else { m }
}

pub struct ClientPexels {
    cle: String,
    adresse: String,
    cache: PathBuf,
    agent: ureq::Agent,
    /// D'où viennent les photos et les aperçus.
    origines_images: Vec<String>,
    /// D'où viennent les fichiers vidéo.
    origines_videos: Vec<String>,
}

impl ClientPexels {
    pub fn new(cle: String, cache: PathBuf) -> Self {
        Self::avec_adresse(
            cle,
            cache,
            ADRESSE_API.to_string(),
            vec!["https://images.pexels.com/".into(), "https://static-videos.pexels.com/".into()],
            vec!["https://videos.pexels.com/".into(), "https://player.vimeo.com/".into()],
        )
    }

    /// Pour les tests : une autre adresse d'API et d'autres origines permises.
    pub fn avec_adresse(cle: String, cache: PathBuf, adresse: String, origines_images: Vec<String>, origines_videos: Vec<String>) -> Self {
        let adresse = if adresse.ends_with('/') { adresse } else { format!("{adresse}/") };
        Self { cle: cle.trim().to_string(), adresse, cache, agent: reseau::agent(), origines_images, origines_videos }
    }

    /// Un message d'erreur ne contient jamais la clé (il remonte jusqu'à l'interface).
    fn masquer(&self) -> impl Fn(String) -> String + '_ {
        move |m: String| if self.cle.is_empty() { m } else { m.replace(self.cle.as_str(), "***") }
    }

    /// Une demande à l'API, la clé dans l'en-tête `Authorization`.
    fn api(&self, chemin: &str, parametres: &[(&str, &str)]) -> Result<Vec<u8>, ErreurPexels> {
        if self.cle.is_empty() {
            return Err(ErreurPexels::CleAbsente);
        }
        let mut demande = self.agent.get(format!("{}{chemin}", self.adresse)).header("Authorization", self.cle.as_str());
        for (nom, valeur) in parametres {
            demande = demande.query(*nom, *valeur);
        }
        let mut reponse = match demande.call() {
            Ok(r) => r,
            Err(ureq::Error::StatusCode(code @ (401 | 403))) => return Err(ErreurPexels::CleRefusee(code)),
            Err(ureq::Error::StatusCode(429)) => return Err(ErreurPexels::Limite),
            Err(ureq::Error::StatusCode(code)) => return Err(ErreurReseau::Refus(code).into()),
            Err(e) => return Err(ErreurReseau::Reseau(self.masquer()(e.to_string())).into()),
        };
        reponse.body_mut().with_config().limit(TAILLE_MAX_API).read_to_vec().map_err(|e| ErreurReseau::Reseau(self.masquer()(e.to_string())).into())
    }

    fn fichier_cache(&self, sous_dossier: &str, nom: &str) -> PathBuf {
        self.cache.join(sous_dossier).join(nom)
    }

    fn empreinte(texte: &str) -> String {
        Sha256::digest(texte.as_bytes()).iter().take(16).map(|o| format!("{o:02x}")).collect()
    }

    /// Une recherche gardée : la liste brute et le total à côté.
    fn garder<T: Serialize>(&self, cache: &Path, liste: &[T], total: u32) -> Result<(), ErreurPexels> {
        fs::create_dir_all(cache.parent().expect("dans le cache"))?;
        ecrire_atomiquement(cache, &serde_json::to_vec(liste).map_err(|e| ErreurPexels::Illisible(e.to_string()))?)?;
        ecrire_atomiquement(&cache.with_extension("total"), total.to_string().as_bytes())?;
        Ok(())
    }

    fn total_garde(cache: &Path, sinon: usize) -> u32 {
        fs::read_to_string(cache.with_extension("total")).ok().and_then(|t| t.trim().parse().ok()).unwrap_or(sinon as u32)
    }

    /// Une page de résultats (40 photos), depuis le cache s'il a moins de 24 h.
    pub fn chercher(&self, requete: &str, page: u32, filtres: &Filtres) -> Result<PagePhotosPexels, ErreurPexels> {
        if self.cle.is_empty() {
            return Err(ErreurPexels::CleAbsente);
        }
        let requete: String = requete.trim().chars().take(100).collect();
        let page = page.clamp(1, PAGES_MAX).to_string();
        let orientation = filtres.orientation.as_deref().filter(|o| ORIENTATIONS.contains(o));
        let couleur = filtres.couleur.as_deref().map(str::to_ascii_lowercase).filter(|c| couleur_permise(c));
        let cache = self.fichier_cache("recherches", &format!("{}.json", Self::empreinte(&format!("photos|{requete}|{page}|{orientation:?}|{couleur:?}"))));
        let photos: Vec<PhotoBrute> = if reseau::frais(&cache, DUREE_CACHE) {
            serde_json::from_slice(&fs::read(&cache)?).map_err(|e| ErreurPexels::Illisible(e.to_string()))?
        } else {
            let par_page = PAR_PAGE.to_string();
            let mut parametres = vec![("query", requete.as_str()), ("per_page", par_page.as_str()), ("page", page.as_str()), ("locale", "fr-FR")];
            if let Some(o) = orientation {
                parametres.push(("orientation", o));
            }
            if let Some(c) = couleur.as_deref() {
                parametres.push(("color", c));
            }
            let api: ReponsePhotos = serde_json::from_slice(&self.api("search", &parametres)?).map_err(|e| ErreurPexels::Illisible(e.to_string()))?;
            self.garder(&cache, &api.photos, api.total_results)?;
            api.photos
        };
        let total = Self::total_garde(&cache, photos.len());
        // Chaque photo garde ses adresses à part : le téléchargement les retrouve par l'identifiant.
        fs::create_dir_all(self.cache.join("photos"))?;
        for p in &photos {
            ecrire_atomiquement(&self.fichier_cache("photos", &format!("{}.json", p.id)), &serde_json::to_vec(p).map_err(|e| ErreurPexels::Illisible(e.to_string()))?)?;
        }
        Ok(PagePhotosPexels {
            total,
            photos: photos
                .into_iter()
                .filter(|p| p.width > 0 && p.height > 0)
                .map(|p| PhotoPexels {
                    id: p.id,
                    largeur: p.width,
                    hauteur: p.height,
                    mots: p.alt.clone().map(|a| a.trim().to_string()).filter(|a| !a.is_empty()).unwrap_or_else(|| mots_de_l_adresse(&p.url)),
                    couleur: p.avg_color.clone().filter(|c| c.len() == 7 && c.starts_with('#')).unwrap_or_else(|| "#d9d6cf".into()),
                    auteur: p.photographer,
                    lien_auteur: p.photographer_url,
                    lien: p.url,
                })
                .collect(),
        })
    }

    fn photo(&self, id: u64) -> Result<PhotoBrute, ErreurPexels> {
        let chemin = self.fichier_cache("photos", &format!("{id}.json"));
        if !reseau::frais(&chemin, DUREE_CACHE) {
            return Err(ErreurPexels::Inconnue);
        }
        serde_json::from_slice(&fs::read(&chemin).map_err(|_| ErreurPexels::Inconnue)?).map_err(|_| ErreurPexels::Inconnue)
    }

    /// L'aperçu d'une photo (350 px de haut), gardé en cache 24 h.
    pub fn apercu(&self, id: u64) -> Result<Vec<u8>, ErreurPexels> {
        let cache = self.fichier_cache("apercus", &format!("{id}.jpg"));
        if reseau::frais(&cache, DUREE_CACHE) {
            return Ok(fs::read(&cache)?);
        }
        let p = self.photo(id)?;
        let adresse = [&p.src.medium, &p.src.small, &p.src.large].into_iter().find(|a| !a.is_empty()).ok_or(ErreurPexels::Inconnue)?;
        reseau::permise(adresse, &self.origines_images)?;
        let octets = reseau::lire(&self.agent, adresse, &[], 8 * 1024 * 1024, &self.masquer())?;
        fs::create_dir_all(cache.parent().expect("dans le cache"))?;
        ecrire_atomiquement(&cache, &octets)?;
        Ok(octets)
    }

    fn credit(auteur: &str, lien_auteur: &str, lien: &str) -> Credit {
        Credit { source: "Pexels".into(), auteur: auteur.into(), lien: lien.into(), lien_auteur: Some(lien_auteur.to_string()).filter(|l| !l.is_empty()), ..Credit::default() }
    }

    /// La photo choisie, dans sa taille d'origine, avec son crédit et un nom de fichier.
    pub fn telecharger(&self, id: u64) -> Result<(Vec<u8>, Credit, String), ErreurPexels> {
        let p = self.photo(id)?;
        let adresse = [&p.src.original, &p.src.large2x, &p.src.large].into_iter().find(|a| !a.is_empty()).ok_or(ErreurPexels::Inconnue)?;
        reseau::permise(adresse, &self.origines_images)?;
        let octets = reseau::lire(&self.agent, adresse, &[], TAILLE_MAX, &self.masquer())?;
        let mots = p.alt.clone().filter(|a| !a.trim().is_empty()).unwrap_or_else(|| mots_de_l_adresse(&p.url));
        let nom = format!("pexels-{}-{}.{}", premier_mot(&mots, "photo"), p.id, extension(adresse));
        Ok((octets, Self::credit(&p.photographer, &p.photographer_url, &p.url), nom))
    }

    // ---- Vidéos ----

    /// Une page de résultats (40 vidéos), depuis le cache s'il a moins de 24 h. Pexels sait
    /// filtrer les vidéos par sens (`landscape`, `portrait`, `square`).
    pub fn chercher_videos(&self, requete: &str, page: u32, orientation: Option<&str>) -> Result<PageVideosPexels, ErreurPexels> {
        if self.cle.is_empty() {
            return Err(ErreurPexels::CleAbsente);
        }
        let requete: String = requete.trim().chars().take(100).collect();
        let page = page.clamp(1, PAGES_MAX).to_string();
        let orientation = orientation.filter(|o| ORIENTATIONS.contains(o));
        let cache = self.fichier_cache("recherches", &format!("{}.json", Self::empreinte(&format!("videos|{requete}|{page}|{orientation:?}"))));
        let videos: Vec<VideoBrute> = if reseau::frais(&cache, DUREE_CACHE) {
            serde_json::from_slice(&fs::read(&cache)?).map_err(|e| ErreurPexels::Illisible(e.to_string()))?
        } else {
            let par_page = PAR_PAGE.to_string();
            let mut parametres = vec![("query", requete.as_str()), ("per_page", par_page.as_str()), ("page", page.as_str()), ("locale", "fr-FR")];
            if let Some(o) = orientation {
                parametres.push(("orientation", o));
            }
            let api: ReponseVideos = serde_json::from_slice(&self.api("videos/search", &parametres)?).map_err(|e| ErreurPexels::Illisible(e.to_string()))?;
            self.garder(&cache, &api.videos, api.total_results)?;
            api.videos
        };
        let total = Self::total_garde(&cache, videos.len());
        fs::create_dir_all(self.cache.join("videos"))?;
        for v in &videos {
            ecrire_atomiquement(&self.fichier_cache("videos", &format!("{}.json", v.id)), &serde_json::to_vec(v).map_err(|e| ErreurPexels::Illisible(e.to_string()))?)?;
        }
        Ok(PageVideosPexels {
            total,
            videos: videos
                .iter()
                .filter_map(|v| {
                    let f = a_telecharger(&v.video_files)?;
                    Some(VideoPexels {
                        id: v.id,
                        largeur: f.width.unwrap_or(0),
                        hauteur: f.height.unwrap_or(0),
                        duree: v.duration,
                        auteur: v.user.name.clone(),
                        lien_auteur: v.user.url.clone(),
                        lien: v.url.clone(),
                        mots: mots_de_l_adresse(&v.url),
                    })
                })
                .collect(),
        })
    }

    fn video(&self, id: u64) -> Result<VideoBrute, ErreurPexels> {
        let chemin = self.fichier_cache("videos", &format!("{id}.json"));
        if !reseau::frais(&chemin, DUREE_CACHE) {
            return Err(ErreurPexels::Inconnue);
        }
        serde_json::from_slice(&fs::read(&chemin).map_err(|_| ErreurPexels::Inconnue)?).map_err(|_| ErreurPexels::Inconnue)
    }

    /// L'image d'aperçu d'une vidéo, gardée en cache 24 h.
    pub fn apercu_video(&self, id: u64) -> Result<Vec<u8>, ErreurPexels> {
        let cache = self.fichier_cache("apercus", &format!("video-{id}.jpg"));
        if reseau::frais(&cache, DUREE_CACHE) {
            return Ok(fs::read(&cache)?);
        }
        let v = self.video(id)?;
        let adresse = std::iter::once(v.image.as_str()).chain(v.video_pictures.iter().map(|i| i.picture.as_str())).find(|a| !a.is_empty()).ok_or(ErreurPexels::Inconnue)?;
        reseau::permise(adresse, &self.origines_images)?;
        let octets = reseau::lire(&self.agent, adresse, &[], 8 * 1024 * 1024, &self.masquer())?;
        fs::create_dir_all(cache.parent().expect("dans le cache"))?;
        ecrire_atomiquement(&cache, &octets)?;
        Ok(octets)
    }

    /// La vidéo choisie, téléchargée dans `cible` (1080p si elle existe), avec son crédit et un
    /// nom de fichier. Les vidéos de Pexels n'ont pas de son.
    pub fn telecharger_video(&self, id: u64, cible: &Path, avancement: &mut dyn FnMut(f32)) -> Result<(Credit, String), ErreurPexels> {
        let v = self.video(id)?;
        let f = a_telecharger(&v.video_files).ok_or(ErreurPexels::Inconnue)?;
        reseau::permise(&f.link, &self.origines_videos)?;
        if let Err(e) = reseau::lire_vers(&self.agent, &f.link, cible, TAILLE_MAX_VIDEO, None, avancement, &self.masquer()) {
            let _ = fs::remove_file(cible);
            return Err(e.into());
        }
        let nom = format!("pexels-{}-{}.mp4", premier_mot(&mots_de_l_adresse(&v.url), "video"), v.id);
        Ok((Self::credit(&v.user.name, &v.user.url, &v.url), nom))
    }

    /// Retire du cache ce qui a plus de 24 h ; le nombre de fichiers retirés.
    pub fn nettoyer(&self) -> usize {
        ["recherches", "photos", "videos", "apercus"].iter().map(|d| reseau::nettoyer(&self.cache.join(d), DUREE_CACHE)).sum()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader, Write};
    use std::net::TcpListener;
    use std::sync::{Arc, Mutex};
    use std::time::SystemTime;

    const CLE: &str = "CLE-PEXELS-SECRETE";

    /// Une demande reçue par le faux Pexels : son chemin et son en-tête `Authorization`.
    #[derive(Debug, Clone)]
    struct Demande {
        chemin: String,
        cle: Option<String>,
    }

    /// Un faux Pexels local : l'API (photos, vidéos), les images et les vidéos ; il note les
    /// demandes. `code` : le code renvoyé par l'API (200, ou 401, 429 pour les essais d'erreur).
    fn faux_pexels(code: u16) -> (String, Arc<Mutex<Vec<Demande>>>) {
        let ecoute = TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}", ecoute.local_addr().unwrap());
        let demandes = Arc::new(Mutex::new(Vec::new()));
        let (b, d) = (base.clone(), demandes.clone());
        std::thread::spawn(move || {
            for flux in ecoute.incoming() {
                let Ok(mut flux) = flux else { continue };
                let mut lecteur = BufReader::new(&flux);
                let mut ligne = String::new();
                lecteur.read_line(&mut ligne).unwrap();
                let chemin = ligne.split_whitespace().nth(1).unwrap_or("/").to_string();
                let mut cle = None;
                loop {
                    let mut entete = String::new();
                    if lecteur.read_line(&mut entete).unwrap_or(0) == 0 || entete.trim().is_empty() {
                        break;
                    }
                    if let Some((nom, valeur)) = entete.split_once(':') {
                        if nom.trim().eq_ignore_ascii_case("authorization") {
                            cle = Some(valeur.trim().to_string());
                        }
                    }
                }
                d.lock().unwrap().push(Demande { chemin: chemin.clone(), cle });
                let (statut, type_mime, corps): (u16, &str, Vec<u8>) = if chemin.starts_with("/v1/") && code != 200 {
                    (code, "application/json", br#"{"error":"non"}"#.to_vec())
                } else if chemin.starts_with("/v1/videos/search") {
                    let fichier = |q: &str, l: u32, h: u32| format!(r#"{{"id":1,"quality":"{q}","file_type":"video/mp4","width":{l},"height":{h},"fps":25,"link":"{b}/vid/31_{h}.mp4"}}"#);
                    let json = format!(
                        r#"{{"page":1,"per_page":40,"total_results":3,"url":"https://www.pexels.com/search/videos/mer/","videos":[{{"id":31,"width":2160,"height":3840,"url":"https://www.pexels.com/video/vagues-sur-la-plage-31/","image":"{b}/img/v31.jpg","duration":14,"user":{{"id":5,"name":"Lou","url":"https://www.pexels.com/@lou"}},"video_files":[{},{},{},{},{{"id":9,"quality":"hls","file_type":"video/mp4","width":null,"height":null,"link":"{b}/vid/31.m3u8"}}],"video_pictures":[{{"id":1,"picture":"{b}/img/v31_p0.jpg","nr":0}}]}},{{"id":32,"width":1920,"height":1080,"url":"https://www.pexels.com/video/ailleurs-32/","image":"https://ailleurs.example/32.jpg","duration":3,"user":{{"name":"B","url":"https://www.pexels.com/@b"}},"video_files":[{{"id":2,"quality":"hd","file_type":"video/mp4","width":1920,"height":1080,"link":"https://ailleurs.example/32.mp4"}}]}},{{"id":33,"width":640,"height":360,"url":"https://www.pexels.com/video/hls-33/","duration":3,"user":{{"name":"C","url":""}},"video_files":[{{"id":3,"quality":"hls","file_type":"video/mp4","width":null,"height":null,"link":"{b}/vid/33.m3u8"}}]}}]}}"#,
                        fichier("uhd", 2160, 3840),
                        fichier("hd", 1080, 1920),
                        fichier("hd", 720, 1280),
                        fichier("sd", 360, 640),
                    );
                    (200, "application/json", json.into_bytes())
                } else if chemin.starts_with("/v1/search") {
                    let json = format!(
                        r##"{{"page":1,"per_page":40,"total_results":2,"photos":[{{"id":11,"width":4000,"height":3000,"url":"https://www.pexels.com/photo/tasse-de-cafe-sur-une-table-11/","photographer":"Anne","photographer_url":"https://www.pexels.com/@anne","photographer_id":7,"avg_color":"#7A5C3E","alt":"Tasse de café sur une table","src":{{"original":"{b}/img/11.jpeg","large2x":"{b}/img/11_l2.jpeg","large":"{b}/img/11_l.jpeg","medium":"{b}/img/11_m.jpeg","small":"{b}/img/11_s.jpeg","portrait":"","landscape":"","tiny":""}},"liked":false}},{{"id":12,"width":10,"height":10,"url":"https://www.pexels.com/photo/x-12/","photographer":"B","photographer_url":"","src":{{"original":"https://ailleurs.example/12.jpeg","medium":"https://ailleurs.example/12_m.jpeg"}}}}]}}"##
                    );
                    (200, "application/json", json.into_bytes())
                } else if chemin.starts_with("/img/") {
                    (200, "image/jpeg", format!("IMAGE {chemin}").into_bytes())
                } else if chemin.starts_with("/vid/") {
                    (200, "video/mp4", format!("VIDEO {chemin}").repeat(100).into_bytes())
                } else {
                    (404, "text/plain", b"introuvable".to_vec())
                };
                let raison = match statut { 200 => "OK", 401 => "Unauthorized", 429 => "Too Many Requests", _ => "Not Found" };
                let entete = format!("HTTP/1.1 {statut} {raison}\r\nContent-Type: {type_mime}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", corps.len());
                let _ = flux.write_all(entete.as_bytes());
                let _ = flux.write_all(&corps);
            }
        });
        (base, demandes)
    }

    fn client(base: &str, nom: &str) -> (ClientPexels, PathBuf) {
        let cache = std::env::temp_dir().join(format!("eliot-pexels-{nom}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&cache);
        (ClientPexels::avec_adresse(CLE.into(), cache.clone(), format!("{base}/v1/"), vec![format!("{base}/img/")], vec![format!("{base}/vid/")]), cache)
    }

    #[test]
    fn la_cle_se_lit_dans_un_env() {
        let d = std::env::temp_dir().join(format!("eliot-env-pexels-{}", std::process::id()));
        fs::create_dir_all(d.join("sous")).unwrap();
        fs::write(d.join(".env"), "PIXABAY_API_KEY=autre\nPEXELS_API_KEY='xyz789'\n").unwrap();
        assert_eq!(lire_cle(&fichiers::fichiers_de_cle(&d.join("sous"), None)), Some("xyz789".into()));
        assert_eq!(lire_cle(&[d.join("absent.env")]), None);
        fs::remove_dir_all(&d).unwrap();
    }

    #[test]
    fn une_recherche_donne_les_photos_la_cle_dans_l_en_tete_seulement() {
        let (base, demandes) = faux_pexels(200);
        let (c, cache) = client(&base, "recherche");
        let page = c.chercher("café", 1, &Filtres { orientation: Some("portrait".into()), couleur: Some("#1D3557".into()) }).unwrap();
        assert_eq!(page.total, 2);
        assert_eq!(
            page.photos[0],
            PhotoPexels { id: 11, largeur: 4000, hauteur: 3000, auteur: "Anne".into(), lien_auteur: "https://www.pexels.com/@anne".into(), lien: "https://www.pexels.com/photo/tasse-de-cafe-sur-une-table-11/".into(), mots: "Tasse de café sur une table".into(), couleur: "#7A5C3E".into() }
        );
        let api: Vec<Demande> = demandes.lock().unwrap().iter().filter(|d| d.chemin.starts_with("/v1/")).cloned().collect();
        assert_eq!(api.len(), 1);
        let q = &api[0].chemin;
        assert!(q.starts_with("/v1/search?") && q.contains("query=caf%C3%A9") && q.contains("per_page=40") && q.contains("locale=fr-FR") && q.contains("orientation=portrait") && q.contains("color=%231d3557"), "{q}");
        assert_eq!(api[0].cle.as_deref(), Some(CLE), "la clé part dans l'en-tête");
        assert!(!q.contains(CLE), "jamais dans l'adresse");
        // La même recherche ne repart pas sur le réseau ; un filtre inconnu est ignoré.
        c.chercher("café", 1, &Filtres { orientation: Some("portrait".into()), couleur: Some("#1d3557".into()) }).unwrap();
        assert_eq!(demandes.lock().unwrap().iter().filter(|d| d.chemin.starts_with("/v1/")).count(), 1);
        c.chercher("café", 2, &Filtres { orientation: Some("diagonale".into()), couleur: Some("lilac".into()) }).unwrap();
        let derniere = demandes.lock().unwrap().iter().filter(|d| d.chemin.starts_with("/v1/")).last().unwrap().chemin.clone();
        assert!(!derniere.contains("orientation") && !derniere.contains("color") && derniere.contains("page=2"), "{derniere}");
        fs::remove_dir_all(&cache).unwrap();
    }

    #[test]
    fn apercu_et_photo_choisie_sans_la_cle_et_seulement_depuis_pexels() {
        let (base, demandes) = faux_pexels(200);
        let (c, cache) = client(&base, "telechargement");
        c.chercher("café", 1, &Filtres::default()).unwrap();
        assert_eq!(c.apercu(11).unwrap(), b"IMAGE /img/11_m.jpeg");
        let (octets, credit, nom) = c.telecharger(11).unwrap();
        assert_eq!(octets, b"IMAGE /img/11.jpeg", "la photo d'origine");
        assert_eq!(credit, Credit { source: "Pexels".into(), auteur: "Anne".into(), lien: "https://www.pexels.com/photo/tasse-de-cafe-sur-une-table-11/".into(), lien_auteur: Some("https://www.pexels.com/@anne".into()), ..Credit::default() });
        assert_eq!(nom, "pexels-tasse-de-11.jpg");
        for d in demandes.lock().unwrap().iter().filter(|d| d.chemin.starts_with("/img/")) {
            assert_eq!(d.cle, None, "la clé ne va pas aux serveurs d'images : {}", d.chemin);
        }
        assert!(matches!(c.telecharger(12), Err(ErreurPexels::Reseau(ErreurReseau::AdresseRefusee))), "une adresse hors de Pexels est refusée");
        assert!(matches!(c.apercu(12), Err(ErreurPexels::Reseau(ErreurReseau::AdresseRefusee))));
        assert!(matches!(c.telecharger(99), Err(ErreurPexels::Inconnue)));
        fs::remove_dir_all(&cache).unwrap();
    }

    #[test]
    fn une_video_se_cherche_par_sens_et_se_telecharge_en_1080p() {
        let (base, demandes) = faux_pexels(200);
        let (c, cache) = client(&base, "videos");
        let page = c.chercher_videos("mer", 1, Some("portrait")).unwrap();
        assert_eq!(page.total, 3);
        assert_eq!(page.videos.len(), 2, "une vidéo sans MP4 téléchargeable est écartée");
        assert_eq!(page.videos[0], VideoPexels { id: 31, largeur: 1080, hauteur: 1920, duree: 14, auteur: "Lou".into(), lien_auteur: "https://www.pexels.com/@lou".into(), lien: "https://www.pexels.com/video/vagues-sur-la-plage-31/".into(), mots: "vagues sur la plage".into() });
        let api: Vec<Demande> = demandes.lock().unwrap().iter().filter(|d| d.chemin.starts_with("/v1/videos/")).cloned().collect();
        assert!(api.len() == 1 && api[0].chemin.contains("query=mer") && api[0].chemin.contains("orientation=portrait") && api[0].cle.as_deref() == Some(CLE), "{api:?}");
        c.chercher_videos("mer", 1, Some("portrait")).unwrap();
        assert_eq!(demandes.lock().unwrap().iter().filter(|d| d.chemin.starts_with("/v1/videos/")).count(), 1, "depuis le cache");
        assert_eq!(c.apercu_video(31).unwrap(), b"IMAGE /img/v31.jpg");
        let cible = cache.join("t.mp4");
        let mut parts = Vec::new();
        let (credit, nom) = c.telecharger_video(31, &cible, &mut |p| parts.push(p)).unwrap();
        assert!(fs::read(&cible).unwrap().starts_with(b"VIDEO /vid/31_1920.mp4"), "le 1080p, pas le 4K");
        assert_eq!(parts.last(), Some(&1.0));
        assert_eq!(credit.source, "Pexels");
        assert_eq!(credit.lien_auteur.as_deref(), Some("https://www.pexels.com/@lou"));
        assert_eq!(nom, "pexels-vagues-sur-31.mp4");
        assert!(matches!(c.telecharger_video(32, &cache.join("a.mp4"), &mut |_| ()), Err(ErreurPexels::Reseau(ErreurReseau::AdresseRefusee))));
        assert!(!cache.join("a.mp4").exists());
        assert!(matches!(c.telecharger_video(11, &cible, &mut |_| ()), Err(ErreurPexels::Inconnue)), "une photo n'est pas une vidéo");
        fs::remove_dir_all(&cache).unwrap();
    }

    #[test]
    fn le_choix_du_fichier_video() {
        let f = |q: &str, l: u32, h: u32| FichierVideo { quality: Some(q.into()), file_type: Some("video/mp4".into()), width: Some(l), height: Some(h), link: format!("https://videos.pexels.com/{l}x{h}.mp4") };
        let liste = [f("uhd", 3840, 2160), f("hd", 1920, 1080), f("hd", 1280, 720), f("sd", 640, 360)];
        assert_eq!(a_telecharger(&liste).unwrap().width, Some(1920));
        // Seulement du 4K : le plus petit qui existe.
        assert_eq!(a_telecharger(&[f("uhd", 4096, 2160), f("uhd", 3840, 2160)]).unwrap().width, Some(3840));
        // Ni HLS, ni fichier sans taille.
        assert!(a_telecharger(&[FichierVideo { quality: Some("hls".into()), file_type: Some("video/mp4".into()), width: None, height: None, link: "x.m3u8".into() }]).is_none());
        assert_eq!(mots_de_l_adresse("https://www.pexels.com/photo/brown-rocks-during-golden-hour-2014422/"), "brown rocks during golden hour");
        assert_eq!(extension("https://images.pexels.com/photos/1/pexels-photo-1.png?auto=compress"), "png");
        assert_eq!(extension("https://images.pexels.com/photos/1/pexels-photo-1.jpeg"), "jpg");
    }

    #[test]
    fn cle_refusee_limite_et_cle_qui_ne_fuit_pas() {
        let (base, _) = faux_pexels(401);
        let (c, cache) = client(&base, "refus");
        assert!(matches!(c.chercher("chat", 1, &Filtres::default()), Err(ErreurPexels::CleRefusee(401))));
        let _ = fs::remove_dir_all(&cache);
        let (base, _) = faux_pexels(429);
        let (c, cache) = client(&base, "limite");
        let e = c.chercher_videos("chat", 1, None).unwrap_err();
        assert!(matches!(e, ErreurPexels::Limite), "{e}");
        let _ = fs::remove_dir_all(&cache);
        let sans = ClientPexels::avec_adresse(String::new(), std::env::temp_dir(), "http://127.0.0.1:9/v1/".into(), vec![], vec![]);
        assert!(matches!(sans.chercher("chat", 1, &Filtres::default()), Err(ErreurPexels::CleAbsente)));
        assert!(matches!(sans.chercher_videos("chat", 1, None), Err(ErreurPexels::CleAbsente)));
        let injoignable = ClientPexels::avec_adresse(CLE.into(), std::env::temp_dir().join("eliot-pexels-fuite"), format!("http://127.0.0.1:9/{CLE}/"), vec![], vec![]);
        let erreur = injoignable.chercher("chat", 1, &Filtres::default()).unwrap_err().to_string();
        assert!(!erreur.contains(CLE), "{erreur}");
    }

    #[test]
    fn le_cache_ne_garde_rien_plus_de_24_heures() {
        let (base, _) = faux_pexels(200);
        let (c, cache) = client(&base, "nettoyage");
        c.chercher("café", 1, &Filtres::default()).unwrap();
        c.apercu(11).unwrap();
        assert_eq!(c.nettoyer(), 0, "tout est frais");
        let vieux = SystemTime::now() - Duration::from_secs(25 * 3600);
        for sous in ["recherches", "photos", "apercus"] {
            for e in fs::read_dir(cache.join(sous)).unwrap().flatten() {
                fs::File::options().write(true).open(e.path()).unwrap().set_modified(vieux).unwrap();
            }
        }
        assert!(matches!(c.telecharger(11), Err(ErreurPexels::Inconnue)), "les adresses de plus de 24 h ne servent plus");
        assert_eq!(c.nettoyer(), 5, "recherche, total, deux photos, un aperçu");
        fs::remove_dir_all(&cache).unwrap();
    }
}
