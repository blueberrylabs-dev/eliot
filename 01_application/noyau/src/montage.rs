//! L'export vidéo (étape 4, lot 4) : une page vidéo devient un MP4 (H.264 et AAC) ou un GIF,
//! image par image, sur le processeur (règle 9 : jamais l'encodeur de la carte graphique).
//!
//! L'interface décrit la page (`src/export/calques.ts`) : chaque élément au repos, en calques
//! SVG dans son propre repère, plus ses photos et ses vidéos, désignées par leur ressource.
//! Ici, chaque calque SVG est rendu par `resvg` avec les fichiers de police de la fenêtre ; puis,
//! pour chaque image du film, chaque élément est posé avec sa pose et ses effets à cet instant
//! (`animation.rs`, les mêmes formules que l'écran), ses photos depuis les originaux et ses
//! vidéos décodées depuis les originaux par `ffmpeg`. Le son des vidéos et les sons de la page
//! (lot 5 : musiques, voix, bruitages, `son.rs`) sont mixés ici, avec les volumes, les fondus,
//! les transitions et la musique qui baisse sous la voix ; le niveau se cale au besoin sur la
//! cible de la plateforme (EBU R128), puis `ffmpeg` encode. Une version sans musique peut suivre.
//!
//! Un calque qui ne bouge pas d'une image à l'autre est rendu à sa place exacte, au pixel près,
//! comme à l'écran ; un calque qui bouge est posé depuis un rendu plus fin, rééchantillonné.

use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{self, BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdout, Command, Stdio};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine;
use resvg::tiny_skia::{self, BlendMode, Color, FillRule, FilterQuality, IntSize, Mask, Pixmap, PixmapPaint, Transform};
use resvg::usvg::{self, fontdb};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

use crate::animation::{self, Contexte, ElementAnime, Format, GenreUnites, Repere};
use crate::sous_titres::{self, SousTitre};
use crate::fichiers::{chemin_libre, chemin_temporaire};
use crate::images::{self, Genre};
use crate::labo;
use crate::son::{self, ClipAudio};
use crate::sons::{self, Niveau};
use crate::voix;

// ----------------------------------------------------------------------------------------
// Ce que l'interface envoie
// ----------------------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
pub struct Boite {
    pub x0: f64,
    pub y0: f64,
    pub x1: f64,
    pub y1: f64,
}

impl Boite {
    fn largeur(&self) -> f64 {
        self.x1 - self.x0
    }
    fn hauteur(&self) -> f64 {
        self.y1 - self.y0
    }
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
pub struct Ombre {
    pub dx: f64,
    pub dy: f64,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
pub struct Unite {
    pub lettre: f64,
    pub mot: f64,
    pub ligne: f64,
    pub cx: f64,
    pub cy: f64,
    pub taille: f64,
    /// Sous-titre (lot 7) : la variante de la lettre quand son mot est prononcé (couleur du
    /// mot prononcé), et le milieu de son mot, autour duquel il grandit.
    #[serde(default)]
    pub actif: bool,
    pub mx: Option<f64>,
    pub my: Option<f64>,
}

/// Un calque d'élément (voir `contexteSvg.ts`).
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "genre", rename_all = "lowercase")]
pub enum Calque {
    Svg {
        svg: String,
        boite: Boite,
        ombre: Option<Ombre>,
        opacite: f64,
        fusion: Option<String>,
        unite: Option<Unite>,
    },
    Image {
        ressource: String,
        matrice: [f64; 6],
        decoupes: Vec<String>,
        boite: Boite,
        opacite: f64,
        fusion: Option<String>,
        unite: Option<Unite>,
    },
    Video {
        ressource: String,
        matrice: [f64; 6],
        decoupes: Vec<String>,
        boite: Boite,
        opacite: f64,
        fusion: Option<String>,
        unite: Option<Unite>,
    },
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
pub struct Totaux {
    pub lettres: f64,
    pub mots: f64,
    pub lignes: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CalquesElement {
    pub element: Value,
    pub calques: Vec<Calque>,
    pub totaux: Option<Totaux>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PoliceCalques {
    pub famille: String,
    pub style: String,
    pub poids_min: u16,
    pub poids_max: u16,
    /// Le fichier, en base64.
    pub donnees: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DescriptionPage {
    pub largeur: f64,
    pub hauteur: f64,
    pub duree: f64,
    pub fond: Vec<Calque>,
    pub elements: Vec<CalquesElement>,
    pub polices: Vec<PoliceCalques>,
    /// Les sons de la page (lot 5), tels que le document les garde.
    #[serde(default)]
    pub sons: Vec<ClipAudio>,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FormatVideo {
    Mp4,
    Gif,
}

/// Les réglages d'un export, préparés par l'interface (réglages par plateforme).
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Reglages {
    pub format: FormatVideo,
    /// Taille du film, en pixels (paire pour le MP4).
    pub largeur: u32,
    pub hauteur: u32,
    pub images_par_seconde: u32,
    /// MP4 : qualité constante (CRF de x264, 18 : très bonne) plafonnée à ce débit.
    pub crf: u8,
    pub debit_max_kbps: u32,
    /// MP4 : une image clé toutes les `gop_secondes` (YouTube : une demi-seconde).
    pub gop_secondes: f64,
    pub debit_son_kbps: u32,
    /// MP4 : garder le son (celui des vidéos et les sons de la page).
    pub son: bool,
    /// MP4 : caler le niveau du son sur cette cible, en LUFS (EBU R128), crête vraie plafonnée
    /// à `CRETE_MAX` ; `None` : le son reste tel que mixé.
    #[serde(default)]
    pub niveau_lufs: Option<f64>,
    /// MP4 : faire aussi une version sans les musiques (voix et bruitages gardés), pour ajouter
    /// le son tendance d'une application au moment de publier.
    #[serde(default)]
    pub sans_musique: bool,
}

/// La crête vraie la plus haute permise quand le niveau est calé (dBTP) : la valeur que
/// recommande YouTube.
pub const CRETE_MAX: f64 = -1.0;

/// Ce que l'export a écrit.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Film {
    pub chemin: PathBuf,
    /// La version sans musique, si elle a été demandée et que la page a une musique.
    pub sans_musique: Option<PathBuf>,
    /// Le niveau final du son du film (`None` sans son).
    pub niveau: Option<NiveauFilm>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq)]
pub struct NiveauFilm {
    /// LUFS intégrés et crête vraie (dBTP) du mixage tel qu'il part dans le film.
    pub lufs: Option<f64>,
    pub crete: Option<f64>,
    /// Le gain appliqué pour caler le niveau, en dB (0 si rien n'a été calé).
    pub gain: f64,
}

impl Reglages {
    fn verifier(&self) -> Result<(), ErreurMontage> {
        let mauvais = |m: &str| Err(ErreurMontage::Reglages(m.to_string()));
        if !(16..=4096).contains(&self.largeur) || !(16..=4096).contains(&self.hauteur) {
            return mauvais("taille du film hors de 16 à 4096 pixels");
        }
        if self.format == FormatVideo::Mp4 && (self.largeur % 2 != 0 || self.hauteur % 2 != 0) {
            return mauvais("le MP4 demande une largeur et une hauteur paires");
        }
        if !(1..=60).contains(&self.images_par_seconde) {
            return mauvais("cadence hors de 1 à 60 images par seconde");
        }
        if self.crf > 51 || !(100..=200_000).contains(&self.debit_max_kbps) || !(32..=512).contains(&self.debit_son_kbps) {
            return mauvais("qualité ou débit hors limites");
        }
        if !(0.1..=10.0).contains(&self.gop_secondes) {
            return mauvais("intervalle des images clés hors de 0,1 à 10 s");
        }
        if self.niveau_lufs.is_some_and(|n| !(-40.0..=-5.0).contains(&n)) {
            return mauvais("niveau sonore visé hors de -40 à -5 LUFS");
        }
        Ok(())
    }
}

// ----------------------------------------------------------------------------------------
// Erreurs, avancement
// ----------------------------------------------------------------------------------------

#[derive(Debug, Error)]
pub enum ErreurMontage {
    #[error("ffmpeg introuvable : installe-le (commande 2 du CLAUDE.md : sudo apt install ffmpeg)")]
    FfmpegAbsent,
    #[error("l'encodeur H.264 (libx264) manque à ffmpeg : installe le paquet ffmpeg d'Ubuntu (commande 2 du CLAUDE.md)")]
    SansX264,
    #[error("export annulé")]
    Annule,
    #[error("réglages refusés : {0}")]
    Reglages(String),
    #[error("page vide : rien à exporter")]
    PageVide,
    #[error("calque illisible : {0}")]
    Calque(String),
    #[error("vidéo illisible : {0}")]
    Video(String),
    #[error("ffmpeg a échoué : {0}")]
    Ffmpeg(String),
    #[error("écriture impossible : {0}")]
    Ecriture(#[from] io::Error),
}

/// Où en est l'export : `etape` (`son`, `images`, `gif`, `sans-musique`), images faites sur le
/// total, part faite de 0 à 1.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Avancement {
    pub etape: &'static str,
    pub image: u32,
    pub images: u32,
    pub part: f32,
}

// ----------------------------------------------------------------------------------------
// Petits outils
// ----------------------------------------------------------------------------------------

fn programme(nom: &str) -> Command {
    let mut commande = Command::new(nom);
    commande.stdin(Stdio::null());
    commande
}

fn lancer_erreur(e: io::Error) -> ErreurMontage {
    if e.kind() == io::ErrorKind::NotFound { ErreurMontage::FfmpegAbsent } else { ErreurMontage::Ecriture(e) }
}

/// Lit le texte d'erreur d'un processus à part, pour ne jamais le bloquer sur un tuyau plein.
fn lire_erreurs(processus: &mut Child) -> std::thread::JoinHandle<String> {
    let mut erreur = processus.stderr.take();
    std::thread::spawn(move || {
        let mut texte = String::new();
        if let Some(e) = erreur.as_mut() {
            let _ = e.read_to_string(&mut texte);
        }
        texte
    })
}

fn derniere_ligne(texte: &str) -> String {
    texte.lines().rev().find(|l| !l.trim().is_empty()).unwrap_or("échec sans message").to_string()
}

/// `ffmpeg` sait-il encoder en H.264 avec x264 ?
pub fn x264_present() -> Result<bool, ErreurMontage> {
    let sortie = programme("ffmpeg").args(["-hide_banner", "-encoders"]).output().map_err(lancer_erreur)?;
    Ok(String::from_utf8_lossy(&sortie.stdout).contains("libx264"))
}

/// Une matrice de canevas `[a, b, c, d, e, f]` en transformation.
fn matrice(m: &[f64; 6]) -> Transform {
    Transform::from_row(m[0] as f32, m[1] as f32, m[2] as f32, m[3] as f32, m[4] as f32, m[5] as f32)
}

/// Les transformations se composent en `f64`, puis passent en `f32` pour le dessin.
#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct Affine(pub(crate) [f64; 6]);

impl Affine {
    pub(crate) const IDENTITE: Affine = Affine([1.0, 0.0, 0.0, 1.0, 0.0, 0.0]);
    pub(crate) fn translation(x: f64, y: f64) -> Self {
        Affine([1.0, 0.0, 0.0, 1.0, x, y])
    }
    fn echelle(s: f64) -> Self {
        Affine([s, 0.0, 0.0, s, 0.0, 0.0])
    }
    fn echelles(sx: f64, sy: f64) -> Self {
        Affine([sx, 0.0, 0.0, sy, 0.0, 0.0])
    }
    fn rotation(degres: f64) -> Self {
        let (s, c) = degres.to_radians().sin_cos();
        Affine([c, s, -s, c, 0.0, 0.0])
    }
    /// `self × n` : `n` s'applique d'abord.
    pub(crate) fn fois(&self, n: &Affine) -> Affine {
        let (m, n) = (&self.0, &n.0);
        Affine([
            m[0] * n[0] + m[2] * n[1],
            m[1] * n[0] + m[3] * n[1],
            m[0] * n[2] + m[2] * n[3],
            m[1] * n[2] + m[3] * n[3],
            m[0] * n[4] + m[2] * n[5] + m[4],
            m[1] * n[4] + m[3] * n[5] + m[5],
        ])
    }
    fn point(&self, x: f64, y: f64) -> (f64, f64) {
        let m = &self.0;
        (m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])
    }
    fn vers(&self) -> Transform {
        matrice(&self.0)
    }
    fn proche(&self, autre: &Affine) -> bool {
        self.0.iter().zip(autre.0.iter()).all(|(a, b)| (a - b).abs() < 1e-7)
    }
    /// Facteurs d'agrandissement le long de chaque axe.
    fn facteurs(&self) -> (f64, f64) {
        let m = &self.0;
        (m[0].hypot(m[1]), m[2].hypot(m[3]))
    }
}

/// Lit un tracé SVG tel que `contexteSvg.ts` les écrit : M, L, C, Z, coordonnées absolues.
fn trace(d: &str) -> Option<tiny_skia::Path> {
    let mut pb = tiny_skia::PathBuilder::new();
    let mut nombres: Vec<f32> = Vec::new();
    let mut commande = ' ';
    let finir = |c: char, n: &mut Vec<f32>, pb: &mut tiny_skia::PathBuilder| {
        match c {
            'M' if n.len() >= 2 => pb.move_to(n[0], n[1]),
            'L' if n.len() >= 2 => pb.line_to(n[0], n[1]),
            'C' if n.len() >= 6 => pb.cubic_to(n[0], n[1], n[2], n[3], n[4], n[5]),
            'Z' => pb.close(),
            _ => {}
        }
        n.clear();
    };
    let mut nombre = String::new();
    for c in d.chars().chain(std::iter::once(' ')) {
        if c.is_ascii_alphabetic() && c != 'e' && c != 'E' {
            if !nombre.is_empty() {
                nombres.push(nombre.parse().ok()?);
                nombre.clear();
            }
            if commande != ' ' {
                finir(commande, &mut nombres, &mut pb);
            }
            commande = c;
        } else if c == ' ' || c == ',' || (c == '-' && !nombre.is_empty() && !nombre.ends_with(['e', 'E'])) {
            if !nombre.is_empty() {
                nombres.push(nombre.parse().ok()?);
                nombre.clear();
            }
            if c == '-' {
                nombre.push(c);
            }
        } else {
            nombre.push(c);
        }
    }
    if commande != ' ' {
        finir(commande, &mut nombres, &mut pb);
    }
    pb.finish()
}

fn rectangle(x0: f64, y0: f64, x1: f64, y1: f64) -> Option<tiny_skia::Path> {
    tiny_skia::Rect::from_ltrb(x0 as f32, y0 as f32, x1 as f32, y1 as f32).map(tiny_skia::PathBuilder::from_rect)
}

fn mode_de_fusion(fusion: Option<&str>) -> BlendMode {
    match fusion {
        Some("multiply") => BlendMode::Multiply,
        Some("screen") => BlendMode::Screen,
        Some("overlay") => BlendMode::Overlay,
        Some("darken") => BlendMode::Darken,
        Some("lighten") => BlendMode::Lighten,
        Some("color-dodge") => BlendMode::ColorDodge,
        Some("color-burn") => BlendMode::ColorBurn,
        Some("hard-light") => BlendMode::HardLight,
        Some("soft-light") => BlendMode::SoftLight,
        Some("difference") => BlendMode::Difference,
        Some("exclusion") => BlendMode::Exclusion,
        Some("hue") => BlendMode::Hue,
        Some("saturation") => BlendMode::Saturation,
        Some("color") => BlendMode::Color,
        Some("luminosity") => BlendMode::Luminosity,
        _ => BlendMode::SourceOver,
    }
}

/// Des pixels RGBA ordinaires en pixels prémultipliés, comme les veut `tiny-skia`.
fn premultiplier(mut rgba: Vec<u8>, largeur: u32, hauteur: u32) -> Option<Pixmap> {
    for p in rgba.chunks_exact_mut(4) {
        let a = p[3] as u32;
        if a < 255 {
            for c in &mut p[..3] {
                *c = ((*c as u32 * a + 127) / 255) as u8;
            }
        }
    }
    Pixmap::from_vec(rgba, IntSize::from_wh(largeur, hauteur)?)
}

// ----------------------------------------------------------------------------------------
// Polices et options de `resvg`
// ----------------------------------------------------------------------------------------

/// Un fichier de police de la fenêtre. `I` : son numéro dans la base de polices (celle de
/// `resvg` ici, celle du PDF dans `rendu_page.rs`).
pub(crate) struct FaceEliot<I = fontdb::ID> {
    pub(crate) italique: bool,
    pub(crate) poids_min: u16,
    pub(crate) poids_max: u16,
    pub(crate) id: I,
}

/// Choisit le fichier d'une famille le plus proche du style et du poids demandés.
pub(crate) fn choisir_face<I: Copy>(faces: &[FaceEliot<I>], italique: bool, poids: u16) -> Option<I> {
    let memes: Vec<&FaceEliot<I>> = faces.iter().filter(|f| f.italique == italique).collect();
    let liste: Vec<&FaceEliot<I>> = if memes.is_empty() { faces.iter().collect() } else { memes };
    liste
        .into_iter()
        .min_by_key(|f| if poids < f.poids_min { f.poids_min - poids } else { poids.saturating_sub(f.poids_max) })
        .map(|f| f.id)
}

/// Les options de rendu : les polices de la fenêtre d'abord (par le nom que la fenêtre leur
/// donne), celles du poste en secours ; les aperçus des photos pour les ombres.
pub(crate) fn options_rendu(polices: &[PoliceCalques], dossier_ressources: &Path) -> Result<usvg::Options<'static>, ErreurMontage> {
    let mut base = fontdb::Database::new();
    base.load_system_fonts();
    let mut familles: HashMap<String, Vec<FaceEliot>> = HashMap::new();
    for p in polices {
        let octets = base64::engine::general_purpose::STANDARD
            .decode(p.donnees.as_bytes())
            .map_err(|e| ErreurMontage::Calque(format!("police {} : {e}", p.famille)))?;
        let ids = base.load_font_source(fontdb::Source::Binary(Arc::new(octets)));
        for id in ids {
            familles.entry(p.famille.to_lowercase()).or_default().push(FaceEliot { italique: p.style == "italic", poids_min: p.poids_min, poids_max: p.poids_max, id });
        }
    }
    let familles = Arc::new(familles);
    let mut options = usvg::Options::default();
    options.fontdb = Arc::new(base);
    let defaut = usvg::FontResolver::default_font_selector();
    options.font_resolver = usvg::FontResolver {
        select_font: Box::new(move |police, base| {
            let italique = police.style() != usvg::FontStyle::Normal;
            for famille in police.families() {
                if let usvg::FontFamily::Named(nom) = famille
                    && let Some(faces) = familles.get(&nom.to_lowercase())
                    && let Some(id) = choisir_face(faces, italique, police.weight())
                {
                    return Some(id);
                }
            }
            defaut(police, base)
        }),
        select_fallback: usvg::FontResolver::default_fallback_selector(),
    };
    let dossier = dossier_ressources.to_path_buf();
    options.image_href_resolver = usvg::ImageHrefResolver {
        resolve_data: usvg::ImageHrefResolver::default_data_resolver(),
        resolve_string: Box::new(move |href: &str, _options: &usvg::Options| {
            let id = href.strip_prefix("eliot:apercu/")?;
            let chemin = images::chemin_ressource(&dossier, id, Genre::Apercu).ok()?;
            let octets = Arc::new(fs::read(chemin).ok()?);
            if octets.starts_with(&[0x89, b'P', b'N', b'G']) {
                Some(usvg::ImageKind::PNG(octets))
            } else if octets.starts_with(&[0xFF, 0xD8]) {
                Some(usvg::ImageKind::JPEG(octets))
            } else {
                Some(usvg::ImageKind::WEBP(octets))
            }
        }),
    };
    Ok(options)
}

// ----------------------------------------------------------------------------------------
// Les calques rendus
// ----------------------------------------------------------------------------------------

/// Un calque SVG : son arbre, un rendu fin (pour quand il bouge) et un rendu exact (pour
/// quand il est immobile).
struct SvgRendu {
    arbre: usvg::Tree,
    boite: Boite,
    fin: Option<(Pixmap, f64)>,
    exact: Option<(Affine, i32, i32, Pixmap)>,
}

/// Une photo du design : l'original redressé, réduit à la taille utile.
struct ImageRendu {
    pixmap: Arc<Pixmap>,
}

/// Une vidéo : `ffmpeg` décode l'original, une image du film à la fois.
struct LecteurVideo {
    processus: Child,
    sortie: ChildStdout,
    erreurs: Option<std::thread::JoinHandle<String>>,
    largeur: u32,
    hauteur: u32,
    /// Le rang (dans le film) de la première image lue, et celui de l'image courante.
    premiere: u64,
    courante: Option<(u64, Pixmap)>,
    fini: bool,
    /// Le labo (étape 5, lot 4) : chaque image retouchée, son grain tiré de son instant dans
    /// le fichier (`debut` + rang × `pas`, en ms).
    retouche: Option<labo::Reglages>,
    debut: f64,
    pas: f64,
}

impl LecteurVideo {
    /// L'image du film `rang` (une seule lecture par image, dans l'ordre).
    fn image(&mut self, rang: u64) -> Result<Option<&Pixmap>, ErreurMontage> {
        let voulue = rang.saturating_sub(self.premiere);
        loop {
            if let Some((r, _)) = &self.courante
                && (*r >= voulue || self.fini)
            {
                break;
            }
            if self.fini {
                break;
            }
            let mut tampon = vec![0u8; self.largeur as usize * self.hauteur as usize * 4];
            match self.sortie.read_exact(&mut tampon) {
                Ok(()) => {
                    let r = self.courante.as_ref().map_or(0, |(r, _)| r + 1);
                    if let Some(reglages) = &self.retouche {
                        let graine = labo::graine_du_temps(self.debut + r as f64 * self.pas);
                        labo::appliquer_graine(&mut tampon, self.largeur, self.hauteur, reglages, true, graine);
                    }
                    let pixmap = premultiplier(tampon, self.largeur, self.hauteur).ok_or_else(|| ErreurMontage::Video("image de taille inattendue".into()))?;
                    self.courante = Some((r, pixmap));
                }
                Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => {
                    self.fini = true;
                    if self.courante.is_none() {
                        let _ = self.processus.wait();
                        let texte = self.erreurs.take().and_then(|h| h.join().ok()).unwrap_or_default();
                        return Err(ErreurMontage::Video(derniere_ligne(&texte)));
                    }
                }
                Err(e) => return Err(ErreurMontage::Ecriture(e)),
            }
        }
        Ok(self.courante.as_ref().map(|(_, p)| p))
    }
}

impl Drop for LecteurVideo {
    fn drop(&mut self) {
        let _ = self.processus.kill();
        let _ = self.processus.wait();
    }
}

enum Rendu {
    Svg(SvgRendu),
    Image(ImageRendu),
    Video(Option<LecteurVideo>),
}

struct CalqueEnPlace {
    calque: Calque,
    rendu: Rendu,
    /// Découpes (images et vidéos), dans le repère de l'élément.
    decoupes: Vec<tiny_skia::Path>,
}

impl CalqueEnPlace {
    fn commun(&self) -> (f64, Option<&str>, Option<&Unite>, Option<&Ombre>) {
        match &self.calque {
            Calque::Svg { opacite, fusion, unite, ombre, .. } => (*opacite, fusion.as_deref(), unite.as_ref(), ombre.as_ref()),
            Calque::Image { opacite, fusion, unite, .. } | Calque::Video { opacite, fusion, unite, .. } => (*opacite, fusion.as_deref(), unite.as_ref(), None),
        }
    }
}

/// Ce qu'une vidéo de la page dit de son clip.
#[derive(Debug, Clone, Default, Deserialize)]
struct Clip {
    ressource: Option<String>,
    coupe: Option<Coupe>,
    vitesse: Option<f64>,
}

#[derive(Debug, Clone, Copy, Default, Deserialize)]
struct Coupe {
    debut: f64,
    fin: Option<f64>,
}

struct ElementEnPlace {
    el: ElementAnime,
    clip: Clip,
    ctx: Contexte,
    calques: Vec<CalqueEnPlace>,
    totaux: Option<Totaux>,
    /// Un sous-titre (lot 7) : le temps de ses mots, le mot prononcé mis en valeur.
    sous_titre: Option<SousTitre>,
    /// Échelle des rendus fins : celle du film, fois le plus fort agrandissement de l'élément.
    finesse: f64,
    /// Vidéo : durée du fichier, en ms.
    duree_fichier: Option<f64>,
    /// Les réglages du labo d'un clip vidéo (une photo est retouchée une fois pour toutes).
    retouche: Option<labo::Reglages>,
}

const LOIN: f64 = 1e5;

/// La pose et l'effet d'un élément à l'instant `t`, en transformation (repère de l'élément vers
/// la page), opacité, découpe du volet et état des morceaux de texte.
struct Etat {
    pose: Affine,
    element: Affine,
    echelle_noeuds: f64,
    opacite: f64,
    volet: Option<(Repere, f64, f64)>,
    unites: Option<animation::Unites>,
}

impl ElementEnPlace {
    fn etat(&self, t: f64) -> Etat {
        let (pose, effet) = animation::etat_anime(&self.el, t, &self.ctx);
        let p = Affine::translation(pose.x, pose.y).fois(&Affine::rotation(pose.rotation)).fois(&Affine::echelle(pose.echelle));
        // Le décalage de l'effet est en pixels de la page : ramené dans le repère de la pose.
        let a = (-pose.rotation).to_radians();
        let dxl = (effet.dx * a.cos() - effet.dy * a.sin()) / pose.echelle;
        let dyl = (effet.dx * a.sin() + effet.dy * a.cos()) / pose.echelle;
        let (l, h) = (self.el.largeur, self.el.hauteur);
        let e = Affine::translation(l / 2.0 + dxl, h / 2.0 + dyl)
            .fois(&Affine::rotation(effet.rotation))
            .fois(&Affine::echelle(effet.echelle))
            .fois(&Affine::translation(-l / 2.0, -h / 2.0));
        Etat {
            pose: p,
            element: p.fois(&e),
            echelle_noeuds: pose.echelle * effet.echelle,
            opacite: pose.opacite * effet.opacite,
            volet: effet.volet.map(|v| (v.repere, v.debut, v.fin)),
            unites: effet.unites,
        }
    }

    fn visible_a(&self, t: f64) -> bool {
        self.el.visible && self.el.temps.is_none_or(|tp| t >= tp.debut && t < tp.fin)
    }

    /// L'instant du fichier vidéo (ms) montré à l'instant `t` de la page. Sur une page fixe
    /// (élément sans temps), la couverture, comme à l'écran.
    fn temps_media(&self, t: f64) -> f64 {
        if self.el.temps.is_none() {
            return instant_de_couverture(self.duree_fichier);
        }
        let coupe = self.clip.coupe.unwrap_or_default();
        let fin = coupe.fin.unwrap_or(f64::INFINITY).min(self.duree_fichier.unwrap_or(f64::INFINITY));
        let depuis = self.el.temps.map_or(t, |tp| t - tp.debut);
        (coupe.debut + depuis * self.clip.vitesse.unwrap_or(1.0)).clamp(coupe.debut, fin.max(coupe.debut))
    }
}

/// La transformation propre d'une lettre d'un texte par morceaux, et son opacité ; `None` si
/// elle est invisible.
fn etat_lettre(unite: &Unite, unites: &animation::Unites, totaux: Option<&Totaux>) -> Option<(Affine, f64)> {
    let t = totaux.copied().unwrap_or(Totaux { lettres: 0.0, mots: 0.0, lignes: 0.0 });
    let (i, n) = match unites.genre {
        GenreUnites::Lignes => (unite.ligne, t.lignes),
        GenreUnites::Mots => (unite.mot, t.mots),
        GenreUnites::Lettres | GenreUnites::MachineAEcrire => (unite.lettre, t.lettres),
    };
    let e = animation::etat_unite(*unites, i, n);
    if e.opacite <= 0.001 {
        return None;
    }
    let u = Affine::translation(unite.cx, unite.cy + e.dy_em * unite.taille)
        .fois(&Affine::echelle(e.echelle))
        .fois(&Affine::translation(-unite.cx, -unite.cy));
    Some((u, e.opacite))
}

// ----------------------------------------------------------------------------------------
// La scène : tout ce qu'il faut pour composer une image du film
// ----------------------------------------------------------------------------------------

struct Scene {
    format: Format,
    largeur: u32,
    hauteur: u32,
    sortie: Affine,
    fond: Pixmap,
    elements: Vec<ElementEnPlace>,
    dossier: PathBuf,
    images_par_seconde: f64,
}

fn arbre(svg: &str, options: &usvg::Options) -> Result<usvg::Tree, ErreurMontage> {
    usvg::Tree::from_str(svg, options).map_err(|e| ErreurMontage::Calque(e.to_string()))
}

/// Rend un arbre avec la transformation `m` (repère du calque vers le film), dans le film :
/// renvoie le rendu et sa place, limitée au film.
fn rendre_exact(a: &usvg::Tree, boite: &Boite, m: &Affine, largeur: u32, hauteur: u32) -> Option<(i32, i32, Pixmap)> {
    let coins = [m.point(boite.x0, boite.y0), m.point(boite.x1, boite.y0), m.point(boite.x1, boite.y1), m.point(boite.x0, boite.y1)];
    let x0 = coins.iter().map(|c| c.0).fold(f64::INFINITY, f64::min).floor().max(0.0);
    let y0 = coins.iter().map(|c| c.1).fold(f64::INFINITY, f64::min).floor().max(0.0);
    let x1 = coins.iter().map(|c| c.0).fold(f64::NEG_INFINITY, f64::max).ceil().min(largeur as f64);
    let y1 = coins.iter().map(|c| c.1).fold(f64::NEG_INFINITY, f64::max).ceil().min(hauteur as f64);
    if x1 <= x0 || y1 <= y0 {
        return None;
    }
    let mut pixmap = Pixmap::new((x1 - x0) as u32, (y1 - y0) as u32)?;
    let t = Affine::translation(-x0, -y0).fois(m).fois(&Affine::translation(boite.x0, boite.y0));
    resvg::render(a, t.vers(), &mut pixmap.as_mut());
    Some((x0 as i32, y0 as i32, pixmap))
}

/// Le rendu fin d'un calque SVG, à l'échelle `s` (bornée à 4096 pixels de côté).
fn rendre_fin(a: &usvg::Tree, boite: &Boite, s: f64) -> Option<(Pixmap, f64)> {
    let cote = boite.largeur().max(boite.hauteur()) * s;
    let s = if cote > 4096.0 { s * 4096.0 / cote } else { s };
    let mut pixmap = Pixmap::new((boite.largeur() * s).ceil().max(1.0) as u32, (boite.hauteur() * s).ceil().max(1.0) as u32)?;
    resvg::render(a, Transform::from_scale(s as f32, s as f32), &mut pixmap.as_mut());
    Some((pixmap, s))
}

/// Les réglages du labo d'une photo (étape 5, lot 2) ou d'un clip vidéo (lot 4), s'il en a qui
/// changent quelque chose.
pub(crate) fn reglages_labo(element: &Value) -> Option<labo::Reglages> {
    if !matches!(element.get("type").and_then(Value::as_str), Some("image" | "video")) {
        return None;
    }
    let mut r: labo::Reglages = serde_json::from_value(element.get("reglages")?.clone()).ok()?;
    if r.bornes().neutres() {
        return None;
    }
    // Recadrée (lot 5) : le vignetage suit le cadre gardé ; sans vignetage, le recadrage ne
    // change aucun pixel et reste hors de la clé de la retouche.
    r.rognage = None;
    if r.vignetage != 0.0 {
        r.rognage = element.get("rognage").and_then(|g| serde_json::from_value(g.clone()).ok());
    }
    Some(r)
}

/// Une photo du design, depuis l'original redressé, réduite à `largeur` × `hauteur` au plus,
/// puis retouchée par le labo à cette taille (les rayons des réglages suivent la taille).
fn charger_photo(dossier: &Path, id: &str, largeur: f64, hauteur: f64, reglages: Option<&labo::Reglages>) -> Result<Pixmap, ErreurMontage> {
    let chemin = images::chemin_ressource(dossier, id, Genre::Original).map_err(|e| ErreurMontage::Calque(e.to_string()))?;
    let octets = fs::read(chemin)?;
    let image = images::decoder_redresse(&octets).map_err(|e| ErreurMontage::Calque(e.to_string()))?;
    let (l0, h0) = (image.width(), image.height());
    let l = (largeur.ceil() as u32).clamp(1, l0);
    let h = (hauteur.ceil() as u32).clamp(1, h0);
    let rgba = if l == l0 && h == h0 {
        image.to_rgba8()
    } else {
        let source = image::DynamicImage::ImageRgba8(image.to_rgba8());
        let mut cible = fast_image_resize::images::Image::new(l, h, fast_image_resize::PixelType::U8x4);
        let options = fast_image_resize::ResizeOptions::new().resize_alg(fast_image_resize::ResizeAlg::Convolution(fast_image_resize::FilterType::Lanczos3));
        fast_image_resize::Resizer::new().resize(&source, &mut cible, &options).map_err(|e| ErreurMontage::Calque(e.to_string()))?;
        image::RgbaImage::from_raw(l, h, cible.into_vec()).ok_or_else(|| ErreurMontage::Calque("réduction".into()))?
    };
    let mut rgba = rgba.into_raw();
    if let Some(r) = reglages {
        labo::appliquer(&mut rgba, l, h, r, true);
    }
    premultiplier(rgba, l, h).ok_or_else(|| ErreurMontage::Calque("photo vide".into()))
}

/// La chaîne `atempo` d'une vitesse (chaque maillon entre 0,5 et 2).
fn atempo(vitesse: f64) -> Vec<String> {
    let mut v = vitesse.clamp(0.25, 4.0);
    let mut maillons = Vec::new();
    while v < 0.5 {
        maillons.push("atempo=0.5".to_string());
        v /= 0.5;
    }
    while v > 2.0 {
        maillons.push("atempo=2.0".to_string());
        v /= 2.0;
    }
    if (v - 1.0).abs() > 1e-6 || maillons.is_empty() {
        maillons.push(format!("atempo={v:.6}"));
    }
    maillons
}


/// Ce qu'il faut pour lancer le décodage d'une vidéo, lu sur l'élément avant de toucher à ses
/// calques.
struct OuvertureVideo {
    debut: f64,
    fin: f64,
    vitesse: f64,
    finesse: f64,
}

/// Lance le décodage d'une vidéo : `ffmpeg` sort, une par une, les images du fichier aux
/// instants des images du film à partir de l'image `rang`, à la taille utile.
fn ouvrir_video(dossier: &Path, images_par_seconde: f64, calque: &Calque, o: &OuvertureVideo, rang: u64, retouche: Option<&labo::Reglages>) -> Result<LecteurVideo, ErreurMontage> {
    let Calque::Video { ressource, matrice: m, .. } = calque else {
        return Err(ErreurMontage::Video("calque inattendu".into()));
    };
    let original = images::chemin_ressource(dossier, ressource, Genre::Original).map_err(|e| ErreurMontage::Video(e.to_string()))?;
    let infos = images::infos(dossier, ressource).map_err(|e| ErreurMontage::Video(e.to_string()))?;
    let (fx, fy) = Affine(*m).facteurs();
    let largeur = ((fx * o.finesse).ceil() as u32).clamp(2, infos.largeur.max(2));
    let hauteur = ((fy * o.finesse).ceil() as u32).clamp(2, infos.hauteur.max(2));
    let cadence = images_par_seconde * o.vitesse;
    let mut a: Vec<String> = ["-hide_banner", "-loglevel", "error", "-nostdin", "-ss"].map(String::from).to_vec();
    a.push(format!("{:.3}", o.debut / 1000.0));
    if o.fin.is_finite() {
        a.push("-t".into());
        a.push(format!("{:.3}", ((o.fin - o.debut) / 1000.0).max(0.05)));
    }
    a.push("-i".into());
    a.push(original.to_string_lossy().into_owned());
    a.extend(["-an", "-sn", "-vf"].map(String::from));
    a.push(format!("fps={cadence:.6},scale={largeur}:{hauteur}:flags=bicubic,format=rgba"));
    a.extend(["-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"].map(String::from));
    let mut processus = programme("ffmpeg").args(&a).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn().map_err(lancer_erreur)?;
    let erreurs = Some(lire_erreurs(&mut processus));
    let sortie = processus.stdout.take().expect("sortie redirigée");
    Ok(LecteurVideo { processus, sortie, erreurs, largeur, hauteur, premiere: rang, courante: None, fini: false, retouche: retouche.cloned(), debut: o.debut, pas: 1000.0 / cadence })
}

impl Scene {
    fn preparer(description: &DescriptionPage, reglages: &Reglages, dossier: &Path) -> Result<Scene, ErreurMontage> {
        Scene::preparer_taille(description, reglages.largeur, reglages.hauteur, reglages.images_par_seconde, false, dossier)
    }

    /// La scène à une taille donnée ; `transparent` : ni le fond noir du film, ni celui de la
    /// page (une image PNG ou WebP à fond transparent, étape 5).
    fn preparer_taille(description: &DescriptionPage, largeur: u32, hauteur: u32, images_par_seconde: u32, transparent: bool, dossier: &Path) -> Result<Scene, ErreurMontage> {
        let options = options_rendu(&description.polices, dossier)?;
        let format = Format { largeur: description.largeur, hauteur: description.hauteur };
        // Le film garde les proportions de la page (au pixel près, pour la parité).
        let sortie = Affine::echelles(largeur as f64 / format.largeur, hauteur as f64 / format.hauteur);
        let mut fond = Pixmap::new(largeur, hauteur).ok_or_else(|| ErreurMontage::Reglages("taille du film".into()))?;
        if !transparent {
            fond.fill(Color::BLACK);
        }
        for c in description.fond.iter().filter(|_| !transparent) {
            if let Calque::Svg { svg, boite, opacite, .. } = c {
                let a = arbre(svg, &options)?;
                if let Some((x, y, p)) = rendre_exact(&a, boite, &sortie, largeur, hauteur) {
                    let paint = PixmapPaint { opacity: *opacite as f32, ..PixmapPaint::default() };
                    fond.draw_pixmap(x, y, p.as_ref(), &paint, Transform::identity(), None);
                }
            }
        }
        let animes: Vec<ElementAnime> = description
            .elements
            .iter()
            .map(|e| serde_json::from_value(e.element.clone()).map_err(|err| ErreurMontage::Calque(format!("élément : {err}"))))
            .collect::<Result<_, _>>()?;
        let transitions = animation::contextes_transitions(&animes);
        let echelle_film = (largeur as f64 / format.largeur).max(hauteur as f64 / format.hauteur);
        let mut photos: HashMap<(String, u32, u32, String), Arc<Pixmap>> = HashMap::new();
        let mut elements = Vec::new();
        for (e, el) in description.elements.iter().zip(animes) {
            let (entree, sortie_tr) = transitions.get(&el.id).cloned().unwrap_or((None, None));
            let ctx = Contexte { format, transition_entree: entree, transition_sortie: sortie_tr };
            let finesse = echelle_film * animation::agrandissement_max(&el, &ctx);
            let clip: Clip = serde_json::from_value(e.element.clone()).unwrap_or_default();
            let duree_fichier = clip
                .ressource
                .as_deref()
                .filter(|_| el.genre == "video")
                .and_then(|id| images::infos(dossier, id).ok())
                .and_then(|r| r.video.map(|v| v.duree as f64));
            let retouche = reglages_labo(&e.element);
            let cle_retouche = retouche.as_ref().map(|r| serde_json::to_string(r).unwrap_or_default()).unwrap_or_default();
            let mut calques = Vec::new();
            for c in &e.calques {
                let (rendu, decoupes) = match c {
                    Calque::Svg { svg, boite, .. } => (Rendu::Svg(SvgRendu { arbre: arbre(svg, &options)?, boite: *boite, fin: None, exact: None }), Vec::new()),
                    Calque::Image { ressource, matrice: m, decoupes, .. } => {
                        let (fx, fy) = Affine(*m).facteurs();
                        let (l, h) = ((fx * finesse).ceil() as u32, (fy * finesse).ceil() as u32);
                        let cle = (ressource.clone(), l, h, cle_retouche.clone());
                        let pixmap = match photos.get(&cle) {
                            Some(p) => p.clone(),
                            None => {
                                let p = Arc::new(charger_photo(dossier, ressource, l as f64, h as f64, retouche.as_ref())?);
                                photos.insert(cle, p.clone());
                                p
                            }
                        };
                        (Rendu::Image(ImageRendu { pixmap }), decoupes.iter().filter_map(|d| trace(d)).collect())
                    }
                    Calque::Video { decoupes, .. } => (Rendu::Video(None), decoupes.iter().filter_map(|d| trace(d)).collect()),
                };
                calques.push(CalqueEnPlace { calque: c.clone(), rendu, decoupes });
            }
            let sous_titre = e.element.get("sousTitre").and_then(|v| serde_json::from_value::<SousTitre>(v.clone()).ok());
            elements.push(ElementEnPlace { el, clip, ctx, calques, totaux: e.totaux, sous_titre, finesse, duree_fichier, retouche });
        }
        Ok(Scene { format, largeur, hauteur, sortie, fond, elements, dossier: dossier.to_path_buf(), images_par_seconde: images_par_seconde as f64 })
    }

    /// Compose l'image `rang` du film dans `cadre`.
    fn composer(&mut self, rang: u64, cadre: &mut Pixmap) -> Result<(), ErreurMontage> {
        let pas = 1000.0 / self.images_par_seconde;
        let t = rang as f64 * pas;
        cadre.data_mut().copy_from_slice(self.fond.data());
        let (largeur, hauteur, sortie, format) = (self.largeur, self.hauteur, self.sortie, self.format);
        for el in &mut self.elements {
            if !el.visible_a(t) {
                // Une vidéo passée libère son décodeur.
                if el.el.temps.is_some_and(|tp| t >= tp.fin) {
                    for c in &mut el.calques {
                        if let Rendu::Video(l) = &mut c.rendu {
                            *l = None;
                        }
                    }
                }
                continue;
            }
            let etat = el.etat(t);
            if etat.opacite <= 0.001 {
                continue;
            }
            // L'instant suivant : un calque qui n'y bouge pas est rendu à sa place exacte.
            let suivant = el.etat(t + pas);
            let masque_volet = match etat.volet {
                None => None,
                Some(v) => match masque_de_volet(v, &etat, el, &format, &sortie, largeur, hauteur) {
                    Some(m) => Some(m),
                    None => continue,
                },
            };
            let ouverture = OuvertureVideo {
                debut: el.temps_media(t),
                fin: el.clip.coupe.unwrap_or_default().fin.unwrap_or(f64::INFINITY).min(el.duree_fichier.unwrap_or(f64::INFINITY)),
                vitesse: el.clip.vitesse.unwrap_or(1.0).clamp(0.25, 4.0),
                finesse: el.finesse,
            };
            let (totaux, finesse) = (el.totaux, el.finesse);
            let retouche = el.retouche.clone();
            // Un sous-titre : le mot prononcé maintenant et à l'image suivante.
            let sous_titre = el.sous_titre.clone();
            let debut_clip = el.el.temps.as_ref().map_or(0.0, |tp| tp.debut);
            let mots = totaux.map_or(0, |t| t.mots.max(0.0) as usize);
            let actif_a = |instant: f64| sous_titre.as_ref().map_or(-1, |st| sous_titres::mot_actif(&st.mots, mots, instant - debut_clip));
            let (actif, actif_suivant) = (actif_a(t), actif_a(t + pas));
            for calque in &mut el.calques {
                let (opacite, fusion, unite, ombre) = calque.commun();
                let (fusion, unite, ombre) = (mode_de_fusion(fusion), unite.copied(), ombre.copied());
                // Une lettre d'un texte par morceaux : sa propre transformation et son opacité ;
                // une lettre de sous-titre : visible ou non, agrandie autour de son mot.
                let lettre = |e: &Etat, actif: i64| -> Option<(Affine, f64)> {
                    let (m, alpha) = match (&unite, &e.unites) {
                        (Some(u), Some(us)) => etat_lettre(u, us, totaux.as_ref())?,
                        _ => (Affine::IDENTITE, 1.0),
                    };
                    match (&unite, &sous_titre) {
                        (Some(u), Some(st)) => {
                            let echelle = sous_titres::lettre_de_sous_titre(st, u.mot, u.actif, actif)?;
                            if (echelle - 1.0).abs() < 1e-9 {
                                return Some((m, alpha));
                            }
                            let (mx, my) = (u.mx.unwrap_or(u.cx), u.my.unwrap_or(u.cy));
                            let grand = Affine::translation(mx, my).fois(&Affine::echelle(echelle)).fois(&Affine::translation(-mx, -my));
                            Some((m.fois(&grand), alpha))
                        }
                        _ => Some((m, alpha)),
                    }
                };
                // L'ombre se décale dans le repère de la page, comme celle d'un canevas.
                let place = |e: &Etat, u: &Affine| {
                    let decalage = ombre.map_or(Affine::IDENTITE, |o| Affine::translation(o.dx * e.echelle_noeuds, o.dy * e.echelle_noeuds));
                    sortie.fois(&decalage).fois(&e.element).fois(u)
                };
                let Some((u, alpha_lettre)) = lettre(&etat, actif) else { continue };
                let m = place(&etat, &u);
                let immobile = lettre(&suivant, actif_suivant).is_some_and(|(u2, _)| place(&suivant, &u2).proche(&m));
                let paint = PixmapPaint {
                    opacity: (etat.opacite * opacite * alpha_lettre).clamp(0.0, 1.0) as f32,
                    blend_mode: fusion,
                    quality: FilterQuality::Bilinear,
                };
                match &mut calque.rendu {
                    Rendu::Svg(s) => {
                        if immobile {
                            if !s.exact.as_ref().is_some_and(|(cle, ..)| cle.proche(&m)) {
                                s.exact = rendre_exact(&s.arbre, &s.boite, &m, largeur, hauteur).map(|(x, y, p)| (m, x, y, p));
                            }
                            if let Some((_, x, y, p)) = &s.exact {
                                cadre.draw_pixmap(*x, *y, p.as_ref(), &paint, Transform::identity(), masque_volet.as_ref());
                            }
                        } else {
                            if s.fin.is_none() {
                                s.fin = rendre_fin(&s.arbre, &s.boite, finesse);
                            }
                            if let Some((p, f)) = &s.fin {
                                let tr = m.fois(&Affine::translation(s.boite.x0, s.boite.y0)).fois(&Affine::echelle(1.0 / f));
                                cadre.draw_pixmap(0, 0, p.as_ref(), &paint, tr.vers(), masque_volet.as_ref());
                            }
                        }
                    }
                    rendu => {
                        let mat = match &calque.calque {
                            Calque::Image { matrice: mm, .. } | Calque::Video { matrice: mm, .. } => Affine(*mm),
                            Calque::Svg { .. } => continue,
                        };
                        // Découpes (coins arrondis, forme d'un cadre) et volet.
                        let mut masque = masque_volet.clone();
                        for d in &calque.decoupes {
                            match &mut masque {
                                Some(mq) => mq.intersect_path(d, FillRule::Winding, true, m.vers()),
                                None => {
                                    let Some(mut mq) = Mask::new(largeur, hauteur) else { continue };
                                    mq.fill_path(d, FillRule::Winding, true, m.vers());
                                    masque = Some(mq);
                                }
                            }
                        }
                        let image: Option<&Pixmap> = match rendu {
                            Rendu::Image(im) => Some(im.pixmap.as_ref()),
                            Rendu::Video(lecteur) => {
                                if lecteur.is_none() {
                                    *lecteur = Some(ouvrir_video(&self.dossier, self.images_par_seconde, &calque.calque, &ouverture, rang, retouche.as_ref())?);
                                }
                                match lecteur.as_mut() {
                                    Some(l) => l.image(rang)?,
                                    None => None,
                                }
                            }
                            Rendu::Svg(_) => None,
                        };
                        if let Some(p) = image {
                            let tr = m.fois(&mat).fois(&Affine::echelles(1.0 / p.width() as f64, 1.0 / p.height() as f64));
                            cadre.draw_pixmap(0, 0, p.as_ref(), &paint, tr.vers(), masque.as_ref());
                        }
                    }
                }
            }
        }
        Ok(())
    }
}

/// Le masque d'un volet (transition ou animation en volet) : une bande verticale de l'élément
/// (dans le repère de sa pose) ou de la page.
fn masque_de_volet(v: (Repere, f64, f64), etat: &Etat, el: &ElementEnPlace, format: &Format, sortie: &Affine, largeur: u32, hauteur: u32) -> Option<Mask> {
    let (repere, debut, fin) = v;
    let mut m = Mask::new(largeur, hauteur)?;
    let (chemin, tr) = match repere {
        Repere::Element => {
            let (l, h) = (el.el.largeur, el.el.hauteur);
            let g = if debut <= 0.0 { -LOIN } else { debut * l };
            let d = if fin >= 1.0 { LOIN } else { fin * l };
            if d <= g {
                return None;
            }
            (rectangle(g, -LOIN, d, h + LOIN)?, sortie.fois(&etat.pose))
        }
        Repere::Page => {
            let g = if debut <= 0.0 { -LOIN } else { debut * format.largeur };
            let d = if fin >= 1.0 { LOIN } else { fin * format.largeur };
            if d <= g {
                return None;
            }
            (rectangle(g, -LOIN, d, LOIN)?, *sortie)
        }
    };
    m.fill_path(&chemin, FillRule::Winding, true, tr.vers());
    Some(m)
}

// ----------------------------------------------------------------------------------------
// Le son
// ----------------------------------------------------------------------------------------

pub const FREQUENCE: u32 = 48_000;

/// Le son mixé d'une page, en deux parts : les musiques à part, tout le reste (son des vidéos,
/// voix, bruitages) ensemble. Stéréo, 48 kHz, nombres flottants ; `None` : part muette.
#[derive(Default)]
struct Mixage {
    reste: Option<Vec<f32>>,
    musique: Option<Vec<f32>>,
}

impl Mixage {
    /// Le film entier : les deux parts additionnées.
    fn tout(&self) -> Option<Vec<f32>> {
        match (&self.reste, &self.musique) {
            (None, None) => None,
            (Some(a), None) | (None, Some(a)) => Some(a.clone()),
            (Some(a), Some(b)) => Some(a.iter().zip(b).map(|(x, y)| x + y).collect()),
        }
    }
}

/// Décode une partie du son d'un fichier (son ou vidéo), en stéréo à 48 kHz : `longueur` ms à
/// partir de `debut` ms (`None` : jusqu'au bout), à la vitesse `vitesse` (hauteur gardée).
fn decoder_son(chemin: &Path, debut: f64, longueur: Option<f64>, vitesse: f64) -> Result<Vec<f32>, ErreurMontage> {
    let mut a: Vec<String> = ["-hide_banner", "-loglevel", "error", "-nostdin", "-ss"].map(String::from).to_vec();
    a.push(format!("{:.3}", debut / 1000.0));
    if let Some(l) = longueur {
        a.push("-t".into());
        a.push(format!("{:.3}", l / 1000.0));
    }
    a.push("-i".into());
    a.push(chemin.to_string_lossy().into_owned());
    a.extend(["-map", "0:a:0", "-vn", "-sn"].map(String::from));
    if (vitesse - 1.0).abs() > 1e-6 {
        a.push("-af".into());
        a.push(atempo(vitesse).join(","));
    }
    a.extend(["-ac", "2", "-ar"].map(String::from));
    a.push(FREQUENCE.to_string());
    a.extend(["-f", "f32le", "pipe:1"].map(String::from));
    let sortie = programme("ffmpeg").args(&a).output().map_err(lancer_erreur)?;
    if !sortie.status.success() {
        return Err(ErreurMontage::Ffmpeg(derniere_ligne(&String::from_utf8_lossy(&sortie.stderr))));
    }
    Ok(sortie.stdout.chunks_exact(4).map(|o| f32::from_le_bytes([o[0], o[1], o[2], o[3]])).collect())
}

/// Mixe le son de la page : chaque vidéo à sa place, à sa vitesse, avec son volume, ses fondus
/// et ceux des transitions ; puis chaque son de la page (`son.rs`) avec son volume, ses fondus,
/// sa boucle et, pour une musique, la baisse sous les voix.
fn mixer_son(scene: &Scene, sons_page: &[ClipAudio], duree: f64, annule: &AtomicBool) -> Result<Mixage, ErreurMontage> {
    let par_ms = FREQUENCE as f64 / 1000.0;
    let total = (duree * par_ms).ceil() as usize;
    let mut mix = Mixage::default();
    // Où l'on parle dans les vidéos de la page : la musique y baisse aussi (décision d'Alexandre
    // du 2026-10-16). L'analyse du niveau est faite une fois par fichier, puis relue.
    let mut analyses: Vec<(f64, f64, f64, f64, Vec<[u64; 2]>)> = Vec::new();
    if sons_page.iter().any(|c| c.est_musique()) {
        for el in &scene.elements {
            if el.el.genre != "video" || !el.el.visible || el.el.volume.unwrap_or(1.0) <= 0.0 {
                continue;
            }
            let (Some(id), Some(temps)) = (el.clip.ressource.as_deref(), el.el.temps) else { continue };
            if !images::infos(&scene.dossier, id).is_ok_and(|i| i.video.is_some_and(|v| v.son)) {
                continue;
            }
            if let Ok(a) = crate::parole::analyser(&scene.dossier, id) {
                analyses.push((temps.debut, temps.fin, el.clip.coupe.unwrap_or_default().debut, el.clip.vitesse.unwrap_or(1.0), a.parole));
            }
        }
    }
    let clips_qui_parlent: Vec<son::ClipQuiParle> = analyses.iter().map(|(debut, fin, coupe_debut, vitesse, parole)| son::ClipQuiParle { debut: *debut, fin: *fin, coupe_debut: *coupe_debut, vitesse: *vitesse, parole }).collect();
    let paroles = son::paroles_des_clips(&clips_qui_parlent);
    for el in &scene.elements {
        if annule.load(Ordering::Relaxed) {
            return Err(ErreurMontage::Annule);
        }
        if el.el.genre != "video" || !el.el.visible || el.el.volume.unwrap_or(1.0) <= 0.0 {
            continue;
        }
        let Some(id) = el.clip.ressource.as_deref() else { continue };
        let Ok(infos) = images::infos(&scene.dossier, id) else { continue };
        if !infos.video.as_ref().is_some_and(|v| v.son) {
            continue;
        }
        let Some(temps) = el.el.temps else { continue };
        let vitesse = el.clip.vitesse.unwrap_or(1.0).clamp(0.25, 4.0);
        let debut_media = el.temps_media(temps.debut);
        let longueur_media = (el.temps_media(temps.fin) - debut_media).max(0.0);
        if longueur_media <= 0.0 {
            continue;
        }
        let original = images::chemin_ressource(&scene.dossier, id, Genre::Original).map_err(|e| ErreurMontage::Video(e.to_string()))?;
        let echantillons = decoder_son(&original, debut_media, Some(longueur_media), vitesse)?;
        let tampon = mix.reste.get_or_insert_with(|| vec![0.0; total * 2]);
        let premier = (temps.debut * par_ms).round() as usize;
        let dernier = ((temps.fin.min(duree)) * par_ms).round() as usize;
        // Le gain se recalcule à chaque milliseconde.
        let mut gain = 0.0_f32;
        for (j, paire) in echantillons.chunks_exact(2).enumerate() {
            let k = premier + j;
            if k >= dernier || k >= total {
                break;
            }
            if j % 48 == 0 {
                gain = animation::gain_son(&el.el, k as f64 / par_ms, &el.ctx) as f32;
            }
            tampon[2 * k] += paire[0] * gain;
            tampon[2 * k + 1] += paire[1] * gain;
        }
    }
    for c in sons_page {
        if annule.load(Ordering::Relaxed) {
            return Err(ErreurMontage::Annule);
        }
        if c.volume.unwrap_or(1.0) <= 0.0 || c.temps.fin <= c.temps.debut {
            continue;
        }
        // Un son importé, ou le son détaché d'une vidéo.
        let Ok(infos) = images::infos(&scene.dossier, &c.ressource) else { continue };
        let duree_fichier = match (&infos.son, &infos.video) {
            (Some(s), _) => s.duree as f64,
            (None, Some(v)) if v.son => v.duree as f64,
            _ => continue,
        };
        let (debut, fin) = c.partie_jouee(Some(duree_fichier));
        let partie = fin - debut;
        if partie <= 0.0 {
            continue;
        }
        // Une voix nettoyée : sa version nettoyée (faite au besoin), jamais l'original retouché.
        let original = match c.nettoyage.as_ref().filter(|n| !n.est_vide()) {
            Some(n) => voix::fichier_pour_export(&scene.dossier, &c.ressource, n).map_err(|e| ErreurMontage::Video(e.to_string()))?,
            None => images::chemin_ressource(&scene.dossier, &c.ressource, Genre::Original).map_err(|e| ErreurMontage::Video(e.to_string()))?,
        };
        // Sans boucle, seule la longueur du clip sert ; en boucle, toute la partie jouée.
        let longueur = if c.boucle() { partie } else { partie.min(c.temps.fin - c.temps.debut) };
        let echantillons = decoder_son(&original, debut, Some(longueur), 1.0)?;
        let trames = echantillons.len() / 2;
        if trames == 0 {
            continue;
        }
        let tampon = if c.est_musique() { &mut mix.musique } else { &mut mix.reste }.get_or_insert_with(|| vec![0.0; total * 2]);
        let premier = (c.temps.debut * par_ms).round() as usize;
        let dernier = ((c.temps.fin.min(duree)) * par_ms).round().min(total as f64) as usize;
        let phase = (c.phase.unwrap_or(0.0) * par_ms).round().max(0.0) as usize;
        let mut gain = 0.0_f32;
        for k in premier..dernier {
            let j = k - premier;
            let i = if c.boucle() {
                (j + phase) % trames
            } else if j < trames {
                j
            } else {
                break;
            };
            if j % 48 == 0 {
                gain = son::gain_clip_son(c, k as f64 / par_ms, sons_page, &paroles) as f32;
            }
            tampon[2 * k] += echantillons[2 * i] * gain;
            tampon[2 * k + 1] += echantillons[2 * i + 1] * gain;
        }
    }
    Ok(mix)
}

/// Le gain (linéaire) qui cale `niveau` sur `cible` LUFS sans que la crête vraie dépasse
/// `CRETE_MAX` ; 1 pour un silence.
fn gain_de_niveau(niveau: &Niveau, cible: f64) -> f64 {
    let Some(lufs) = niveau.lufs else { return 1.0 };
    let mut gain_db = cible - lufs;
    if let Some(crete) = niveau.crete {
        gain_db = gain_db.min(CRETE_MAX - crete);
    }
    10f64.powf(gain_db / 20.0)
}

fn ecrire_son(chemin: &Path, echantillons: &[f32], gain: f32) -> io::Result<()> {
    let mut f = BufWriter::new(File::create(chemin)?);
    for v in echantillons {
        f.write_all(&(v * gain).clamp(-1.0, 1.0).to_le_bytes())?;
    }
    f.flush()
}

// ----------------------------------------------------------------------------------------
// L'export
// ----------------------------------------------------------------------------------------

/// Un dossier de travail à soi, effacé à la fin (ou à l'annulation).
struct DossierTravail(PathBuf);

impl DossierTravail {
    fn creer() -> io::Result<Self> {
        let marque = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
        let chemin = std::env::temp_dir().join(format!("eliot-export-{}-{marque}", std::process::id()));
        fs::create_dir_all(&chemin)?;
        Ok(Self(chemin))
    }
}

impl Drop for DossierTravail {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

/// Le fichier de sortie en cours d'écriture, effacé s'il n'est pas mené au bout.
struct Partiel {
    chemin: PathBuf,
    garde: bool,
}

impl Drop for Partiel {
    fn drop(&mut self) {
        if !self.garde {
            let _ = fs::remove_file(&self.chemin);
        }
    }
}

/// Fait le film d'une page vidéo et l'écrit à `cible` (écrasée si elle existe : le dialogue
/// « Enregistrer sous » l'a confirmé, sinon l'appelant a choisi un nom libre), avec, si elle est
/// demandée, la version sans musique à côté (`<nom>_sans-musique.mp4`, sous un nom libre).
/// `annule` arrête tout au plus tôt ; rien n'est laissé derrière.
pub fn exporter(
    description: &DescriptionPage,
    reglages: &Reglages,
    dossier_ressources: &Path,
    cible: &Path,
    avancement: &mut dyn FnMut(Avancement),
    annule: &AtomicBool,
) -> Result<Film, ErreurMontage> {
    reglages.verifier()?;
    if description.duree <= 0.0 || description.largeur <= 0.0 || description.hauteur <= 0.0 {
        return Err(ErreurMontage::PageVide);
    }
    if reglages.format == FormatVideo::Mp4 && !x264_present()? {
        return Err(ErreurMontage::SansX264);
    }
    if let Some(dossier) = cible.parent() {
        fs::create_dir_all(dossier)?;
    }
    let travail = DossierTravail::creer()?;
    let mut scene = Scene::preparer(description, reglages, dossier_ressources)?;
    let fps = reglages.images_par_seconde;
    let images = ((description.duree * fps as f64 / 1000.0).ceil() as u64).max(1);
    let rapport = |avancement: &mut dyn FnMut(Avancement), etape: &'static str, image: u64, part: f64| {
        avancement(Avancement { etape, image: image as u32, images: images as u32, part: part.clamp(0.0, 1.0) as f32 })
    };

    // 1. Le son (MP4 seulement), calé au besoin sur le niveau visé ; la version sans musique
    // garde le même gain, pour que la voix y sonne pareil.
    rapport(avancement, "son", 0, 0.0);
    let mixage = if reglages.format == FormatVideo::Mp4 && reglages.son { mixer_son(&scene, &description.sons, description.duree, annule)? } else { Mixage::default() };
    let tout = mixage.tout();
    let mut niveau_film = None;
    let fichier_son = match &tout {
        Some(echantillons) => {
            let mesure = sons::mesurer(echantillons);
            let gain = reglages.niveau_lufs.map_or(1.0, |cible| gain_de_niveau(&mesure, cible));
            let chemin = travail.0.join("son.f32");
            ecrire_son(&chemin, echantillons, gain as f32)?;
            let apres = if (gain - 1.0).abs() > 1e-9 { sons::mesurer(&echantillons.iter().map(|v| (v * gain as f32).clamp(-1.0, 1.0)).collect::<Vec<f32>>()) } else { mesure };
            niveau_film = Some((NiveauFilm { lufs: apres.lufs, crete: apres.crete, gain: (20.0 * gain.log10() * 10.0).round() / 10.0 }, gain));
            Some(chemin)
        }
        None => None,
    };
    // La version sans musique : seulement si la page a une musique.
    let veut_sans_musique = reglages.format == FormatVideo::Mp4 && reglages.sans_musique && mixage.musique.is_some();
    let fichier_sans_musique = match (&mixage.reste, veut_sans_musique) {
        (Some(reste), true) => {
            let chemin = travail.0.join("sans-musique.f32");
            ecrire_son(&chemin, reste, niveau_film.map_or(1.0, |n| n.1) as f32)?;
            Some(chemin)
        }
        _ => None,
    };
    let part_images = if reglages.format == FormatVideo::Gif { 0.85 } else if veut_sans_musique { 0.93 } else { 0.97 };
    rapport(avancement, "images", 0, 0.03);

    // 2. Les images, envoyées à l'encodeur au fil de l'eau.
    let partiel = Partiel { chemin: chemin_temporaire(cible)?, garde: false };
    let intermediaire = travail.0.join("images.mkv");
    let (l, h) = (reglages.largeur, reglages.hauteur);
    let mut a: Vec<String> = ["-y", "-hide_banner", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s"].map(String::from).to_vec();
    a.push(format!("{l}x{h}"));
    a.push("-framerate".into());
    a.push(fps.to_string());
    a.extend(["-i", "pipe:0"].map(String::from));
    match reglages.format {
        FormatVideo::Mp4 => {
            if let Some(f) = &fichier_son {
                a.extend(["-f", "f32le", "-ar"].map(String::from));
                a.push(FREQUENCE.to_string());
                a.extend(["-ac", "2", "-i"].map(String::from));
                a.push(f.to_string_lossy().into_owned());
                a.extend(["-map", "0:v", "-map", "1:a"].map(String::from));
            }
            let gop = ((fps as f64 * reglages.gop_secondes).round() as u32).max(1);
            a.extend(["-vf", "scale=out_color_matrix=bt709:out_range=tv:flags=bicubic,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-profile:v", "high", "-crf"].map(String::from));
            a.push(reglages.crf.to_string());
            a.push("-maxrate".into());
            a.push(format!("{}k", reglages.debit_max_kbps));
            a.push("-bufsize".into());
            a.push(format!("{}k", reglages.debit_max_kbps * 2));
            a.push("-g".into());
            a.push(gop.to_string());
            a.extend(["-bf", "2", "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"].map(String::from));
            if fichier_son.is_some() {
                a.extend(["-c:a", "aac", "-b:a"].map(String::from));
                a.push(format!("{}k", reglages.debit_son_kbps));
                a.extend(["-ar", "48000", "-ac", "2"].map(String::from));
            }
            a.extend(["-movflags", "+faststart", "-f", "mp4"].map(String::from));
            a.push(partiel.chemin.to_string_lossy().into_owned());
        }
        FormatVideo::Gif => {
            // Sans perte d'abord ; la palette se calcule ensuite sur tout le film.
            a.extend(["-c:v", "ffv1", "-pix_fmt", "bgr0", "-f", "matroska"].map(String::from));
            a.push(intermediaire.to_string_lossy().into_owned());
        }
    }
    let mut encodeur = programme("ffmpeg").args(&a).stdin(Stdio::piped()).stdout(Stdio::null()).stderr(Stdio::piped()).spawn().map_err(lancer_erreur)?;
    let erreurs = lire_erreurs(&mut encodeur);
    let mut entree = encodeur.stdin.take().expect("entrée redirigée");
    let mut cadre = Pixmap::new(l, h).ok_or_else(|| ErreurMontage::Reglages("taille du film".into()))?;
    let mut resultat: Result<(), ErreurMontage> = Ok(());
    for rang in 0..images {
        if annule.load(Ordering::Relaxed) {
            resultat = Err(ErreurMontage::Annule);
            break;
        }
        if let Err(e) = scene.composer(rang, &mut cadre) {
            resultat = Err(e);
            break;
        }
        if let Err(e) = entree.write_all(cadre.data()) {
            resultat = Err(ErreurMontage::Ecriture(e));
            break;
        }
        rapport(avancement, "images", rang + 1, 0.03 + (part_images - 0.03) * (rang + 1) as f64 / images as f64);
    }
    drop(entree);
    if resultat.is_err() {
        let _ = encodeur.kill();
    }
    let statut = encodeur.wait()?;
    let texte = erreurs.join().unwrap_or_default();
    resultat.map_err(|e| match e {
        // Un tuyau cassé veut dire qu'ffmpeg s'est arrêté : son message dit pourquoi.
        ErreurMontage::Ecriture(_) if !texte.trim().is_empty() => ErreurMontage::Ffmpeg(derniere_ligne(&texte)),
        autre => autre,
    })?;
    if !statut.success() {
        return Err(ErreurMontage::Ffmpeg(derniere_ligne(&texte)));
    }

    // 3. GIF : palette du film, puis le GIF.
    if reglages.format == FormatVideo::Gif {
        if annule.load(Ordering::Relaxed) {
            return Err(ErreurMontage::Annule);
        }
        rapport(avancement, "gif", images, 0.88);
        let palette = travail.0.join("palette.png");
        let mut a: Vec<String> = ["-y", "-hide_banner", "-loglevel", "error", "-nostdin", "-i"].map(String::from).to_vec();
        a.push(intermediaire.to_string_lossy().into_owned());
        a.extend(["-vf", "palettegen=stats_mode=diff"].map(String::from));
        a.push(palette.to_string_lossy().into_owned());
        let s = programme("ffmpeg").args(&a).output().map_err(lancer_erreur)?;
        if !s.status.success() {
            return Err(ErreurMontage::Ffmpeg(derniere_ligne(&String::from_utf8_lossy(&s.stderr))));
        }
        if annule.load(Ordering::Relaxed) {
            return Err(ErreurMontage::Annule);
        }
        rapport(avancement, "gif", images, 0.93);
        let mut a: Vec<String> = ["-y", "-hide_banner", "-loglevel", "error", "-nostdin", "-i"].map(String::from).to_vec();
        a.push(intermediaire.to_string_lossy().into_owned());
        a.push("-i".into());
        a.push(palette.to_string_lossy().into_owned());
        a.extend(["-lavfi", "paletteuse=dither=sierra2_4a:diff_mode=rectangle", "-loop", "0", "-f", "gif"].map(String::from));
        a.push(partiel.chemin.to_string_lossy().into_owned());
        let s = programme("ffmpeg").args(&a).output().map_err(lancer_erreur)?;
        if !s.status.success() {
            return Err(ErreurMontage::Ffmpeg(derniere_ligne(&String::from_utf8_lossy(&s.stderr))));
        }
    }
    // 4. La version sans musique : les mêmes images, recopiées telles quelles, et le son sans
    // les musiques (aucun son si la page n'avait que de la musique).
    let mut partiel_sans_musique = None;
    if veut_sans_musique {
        if annule.load(Ordering::Relaxed) {
            return Err(ErreurMontage::Annule);
        }
        rapport(avancement, "sans-musique", images, 0.95);
        let dossier = cible.parent().map(Path::to_path_buf).unwrap_or_default();
        let base = format!("{}_sans-musique", cible.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_else(|| "film".into()));
        let chemin = chemin_libre(&dossier, &base, "mp4");
        let p = Partiel { chemin: chemin_temporaire(&chemin)?, garde: false };
        let mut a: Vec<String> = ["-y", "-hide_banner", "-loglevel", "error", "-nostdin", "-i"].map(String::from).to_vec();
        a.push(partiel.chemin.to_string_lossy().into_owned());
        match &fichier_sans_musique {
            Some(f) => {
                a.extend(["-f", "f32le", "-ar"].map(String::from));
                a.push(FREQUENCE.to_string());
                a.extend(["-ac", "2", "-i"].map(String::from));
                a.push(f.to_string_lossy().into_owned());
                a.extend(["-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a"].map(String::from));
                a.push(format!("{}k", reglages.debit_son_kbps));
                a.extend(["-ar", "48000", "-ac", "2"].map(String::from));
            }
            None => a.extend(["-map", "0:v", "-c:v", "copy", "-an"].map(String::from)),
        }
        a.extend(["-movflags", "+faststart", "-f", "mp4"].map(String::from));
        a.push(p.chemin.to_string_lossy().into_owned());
        let s = programme("ffmpeg").args(&a).output().map_err(lancer_erreur)?;
        if !s.status.success() {
            return Err(ErreurMontage::Ffmpeg(derniere_ligne(&String::from_utf8_lossy(&s.stderr))));
        }
        partiel_sans_musique = Some((p, chemin));
    }
    if annule.load(Ordering::Relaxed) {
        return Err(ErreurMontage::Annule);
    }
    let mut partiel = partiel;
    fs::rename(&partiel.chemin, cible)?;
    partiel.garde = true;
    let sans_musique = match partiel_sans_musique {
        Some((mut p, chemin)) => {
            fs::rename(&p.chemin, &chemin)?;
            p.garde = true;
            Some(chemin)
        }
        None => None,
    };
    rapport(avancement, "fini", images, 1.0);
    Ok(Film { chemin: cible.to_path_buf(), sans_musique, niveau: niveau_film.map(|n| n.0) })
}

/// La pose d'un élément pour un rendu vectoriel (PDF, SVG ; étape 5, lot 1) : sa matrice du
/// repère de l'élément vers la page, son opacité, l'échelle de ses ombres, et pour une vidéo
/// l'instant du fichier à montrer. Les effets lettre par lettre et les volets n'y sont pas : le
/// texte est posé au repos.
pub(crate) struct PoseVectorielle {
    pub(crate) matrice: Affine,
    pub(crate) opacite: f64,
    pub(crate) echelle_ombre: f64,
    pub(crate) instant_video: Option<f64>,
}

/// La pose de chaque élément de la description à l'instant `t` (`None` : il ne se voit pas),
/// par les mêmes formules que le film.
pub(crate) fn poses_vectorielles(description: &DescriptionPage, t: f64, dossier: &Path) -> Result<Vec<Option<PoseVectorielle>>, ErreurMontage> {
    let animes: Vec<ElementAnime> = description
        .elements
        .iter()
        .map(|e| serde_json::from_value(e.element.clone()).map_err(|err| ErreurMontage::Calque(format!("élément : {err}"))))
        .collect::<Result<_, _>>()?;
    let transitions = animation::contextes_transitions(&animes);
    let format = Format { largeur: description.largeur, hauteur: description.hauteur };
    let mut poses = Vec::new();
    for (e, el) in description.elements.iter().zip(animes) {
        let (entree, sortie) = transitions.get(&el.id).cloned().unwrap_or((None, None));
        let clip: Clip = serde_json::from_value(e.element.clone()).unwrap_or_default();
        let duree_fichier = clip.ressource.as_deref().filter(|_| el.genre == "video").and_then(|id| images::infos(dossier, id).ok()).and_then(|r| r.video.map(|v| v.duree as f64));
        let place = ElementEnPlace { el, clip, ctx: Contexte { format, transition_entree: entree, transition_sortie: sortie }, calques: Vec::new(), totaux: e.totaux, sous_titre: None, finesse: 1.0, duree_fichier, retouche: None };
        if !place.visible_a(t) {
            poses.push(None);
            continue;
        }
        let etat = place.etat(t);
        let instant_video = (place.el.genre == "video").then(|| place.temps_media(t));
        poses.push(Some(PoseVectorielle { matrice: etat.element, opacite: etat.opacite, echelle_ombre: etat.echelle_noeuds, instant_video }));
    }
    Ok(poses)
}

/// L'instant de la couverture d'une vidéo (ms du fichier) : celui que `videos.rs` prend à
/// l'import, et que l'écran montre sur une page fixe.
pub(crate) fn instant_de_couverture(duree_fichier: Option<f64>) -> f64 {
    duree_fichier.map_or(0.0, |d| (d / 10.0).min(1000.0).floor())
}

/// Une page à un instant (ms), en pixels prémultipliés, à la taille demandée : l'export d'une
/// image depuis le document (étape 5, lot 1), photos et vidéos depuis leurs originaux.
pub(crate) fn rendre_instant(description: &DescriptionPage, largeur: u32, hauteur: u32, instant: f64, transparent: bool, dossier_ressources: &Path) -> Result<Pixmap, ErreurMontage> {
    const CADENCE: u32 = 30;
    let mut scene = Scene::preparer_taille(description, largeur, hauteur, CADENCE, transparent, dossier_ressources)?;
    let mut cadre = Pixmap::new(largeur, hauteur).ok_or_else(|| ErreurMontage::Reglages("taille de l'image".into()))?;
    let rang = (instant.max(0.0) * CADENCE as f64 / 1000.0).round() as u64;
    scene.composer(rang, &mut cadre)?;
    Ok(cadre)
}

/// Une image du film, en PNG, sans encoder de film : pour comparer l'export à l'écran.
pub fn image_du_film(description: &DescriptionPage, reglages: &Reglages, dossier_ressources: &Path, rang: u64) -> Result<Vec<u8>, ErreurMontage> {
    reglages.verifier()?;
    let mut scene = Scene::preparer(description, reglages, dossier_ressources)?;
    let mut cadre = Pixmap::new(reglages.largeur, reglages.hauteur).ok_or_else(|| ErreurMontage::Reglages("taille du film".into()))?;
    // Les vidéos se lisent dans l'ordre : on passe par les images d'avant sans les garder.
    scene.composer(rang, &mut cadre)?;
    cadre.encode_png().map_err(|e| ErreurMontage::Calque(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::videos;
    use serde_json::json;

    fn ffmpeg_present() -> bool {
        Command::new("ffmpeg").arg("-version").stdout(Stdio::null()).stderr(Stdio::null()).status().is_ok_and(|s| s.success())
    }

    fn dossier_de_test(nom: &str) -> PathBuf {
        let dossier = std::env::temp_dir().join(format!("eliot-montage-{nom}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dossier);
        fs::create_dir_all(&dossier).unwrap();
        dossier
    }

    /// Une vidéo de 2 s : rouge pendant la première seconde, bleue pendant la seconde, avec un
    /// son de 440 Hz.
    fn video_rouge_puis_bleue(dossier: &Path) -> PathBuf {
        let chemin = dossier.join("rouge_bleu.mp4");
        let a: Vec<String> = [
            "-y", "-hide_banner", "-loglevel", "error",
            "-f", "lavfi", "-i", "color=c=red:size=160x90:rate=25:duration=1",
            "-f", "lavfi", "-i", "color=c=blue:size=160x90:rate=25:duration=1",
            "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2",
            "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]", "-map", "[v]", "-map", "2:a",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
        ]
        .map(String::from)
        .to_vec();
        let mut a = a;
        a.push(chemin.to_string_lossy().into_owned());
        let s = Command::new("ffmpeg").args(&a).output().unwrap();
        assert!(s.status.success(), "{}", String::from_utf8_lossy(&s.stderr));
        chemin
    }

    fn rectangle_svg(l: f64, h: f64, couleur: &str) -> Value {
        json!({ "genre": "svg", "svg": format!("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{l}\" height=\"{h}\" viewBox=\"0 0 {l} {h}\"><path d=\"M0 0L{l} 0L{l} {h}L0 {h}Z\" fill=\"{couleur}\"/></svg>"), "boite": { "x0": 0, "y0": 0, "x1": l, "y1": h }, "opacite": 1 })
    }

    /// Une page de 320 × 180, 2 s : la vidéo en plein cadre (fondu du son à l'entrée), un carré
    /// vert qui traverse le bas de gauche à droite (deux images clés).
    fn page_de_test(ressource: &str) -> DescriptionPage {
        serde_json::from_value(json!({
            "largeur": 320, "hauteur": 180, "duree": 2000,
            "fond": [rectangle_svg(320.0, 180.0, "#ffffff")],
            "elements": [
                {
                    "element": { "id": "v", "type": "video", "x": 0, "y": 0, "largeur": 320, "hauteur": 180, "rotation": 0, "opacite": 1, "visible": true,
                                 "temps": { "debut": 0, "fin": 2000 }, "piste": 0, "ressource": ressource, "volume": 1, "fonduEntree": 500 },
                    "calques": [{ "genre": "video", "ressource": ressource, "matrice": [320, 0, 0, 180, 0, 0], "decoupes": [], "boite": { "x0": 0, "y0": 0, "x1": 320, "y1": 180 }, "opacite": 1 }]
                },
                {
                    "element": { "id": "c", "type": "forme", "x": 0, "y": 130, "largeur": 40, "hauteur": 40, "rotation": 0, "opacite": 1, "visible": true,
                                 "temps": { "debut": 0, "fin": 2000 }, "piste": 1,
                                 "cles": [{ "t": 0, "x": 0, "y": 130, "courbe": "lineaire" }, { "t": 2000, "x": 280, "y": 130 }] },
                    "calques": [rectangle_svg(40.0, 40.0, "#00ff00")]
                }
            ],
            "polices": []
        }))
        .unwrap()
    }

    fn reglages(format: FormatVideo, largeur: u32, hauteur: u32, ips: u32) -> Reglages {
        Reglages { format, largeur, hauteur, images_par_seconde: ips, crf: 18, debit_max_kbps: 4000, gop_secondes: 0.5, debit_son_kbps: 192, son: true, niveau_lufs: None, sans_musique: false }
    }

    /// L'image du film à `secondes`, décodée.
    fn image_a(film: &Path, secondes: f64) -> image::RgbImage {
        let s = Command::new("ffmpeg")
            .args(["-hide_banner", "-loglevel", "error", "-ss", &format!("{secondes:.3}"), "-i"])
            .arg(film)
            .args(["-frames:v", "1", "-f", "image2pipe", "-c:v", "png", "pipe:1"])
            .output()
            .unwrap();
        image::load_from_memory(&s.stdout).unwrap().to_rgb8()
    }

    fn proche(p: &image::Rgb<u8>, attendu: [u8; 3]) -> bool {
        p.0.iter().zip(attendu).all(|(a, b)| (*a as i32 - b as i32).abs() <= 45)
    }

    fn sonder(film: &Path) -> Value {
        let s = Command::new("ffprobe").args(["-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json"]).arg(film).output().unwrap();
        serde_json::from_slice(&s.stdout).unwrap()
    }

    /// Le niveau moyen du son du film entre deux instants (s).
    fn niveau(film: &Path, debut: f64, fin: f64) -> f32 {
        let s = Command::new("ffmpeg")
            .args(["-hide_banner", "-loglevel", "error", "-ss", &format!("{debut}"), "-t", &format!("{}", fin - debut), "-i"])
            .arg(film)
            .args(["-vn", "-ac", "1", "-ar", "48000", "-f", "f32le", "pipe:1"])
            .output()
            .unwrap();
        let v: Vec<f32> = s.stdout.chunks_exact(4).map(|o| f32::from_le_bytes([o[0], o[1], o[2], o[3]])).collect();
        (v.iter().map(|x| x * x).sum::<f32>() / v.len().max(1) as f32).sqrt()
    }

    #[test]
    fn un_film_mp4_compose_la_video_le_carre_et_le_son() {
        if !ffmpeg_present() || !x264_present().unwrap_or(false) {
            eprintln!("ffmpeg ou x264 absent : essai sauté");
            return;
        }
        let dossier = dossier_de_test("mp4");
        let ressources = dossier.join("ressources");
        fs::create_dir_all(&ressources).unwrap();
        let ressource = videos::importer(&video_rouge_puis_bleue(&dossier), &ressources, &videos::ReglageCopie::default(), &mut |_| {}).unwrap();
        let page = page_de_test(&ressource.id);
        let cible = dossier.join("sortie").join("film.mp4");
        let mut avancements = Vec::new();
        let annule = AtomicBool::new(false);
        let ecrit = exporter(&page, &reglages(FormatVideo::Mp4, 320, 180, 25), &ressources, &cible, &mut |a| avancements.push(a), &annule).unwrap();
        assert_eq!(ecrit, Film { chemin: cible.clone(), sans_musique: None, niveau: ecrit.niveau });
        assert!(ecrit.niveau.is_some_and(|n| n.gain == 0.0 && n.lufs.is_some()), "{:?}", ecrit.niveau);
        assert!(avancements.windows(2).all(|p| p[1].part >= p[0].part), "l'avancement ne recule jamais");
        assert_eq!(avancements.last().unwrap().etape, "fini");
        assert_eq!(avancements.last().unwrap().images, 50);

        let infos = sonder(&cible);
        let flux = infos["streams"].as_array().unwrap();
        let video = flux.iter().find(|f| f["codec_type"] == "video").unwrap();
        assert_eq!(video["codec_name"], "h264");
        assert_eq!(video["profile"], "High");
        assert_eq!((video["width"].as_u64(), video["height"].as_u64()), (Some(320), Some(180)));
        assert_eq!(video["nb_read_frames"], "50");
        assert_eq!(video["pix_fmt"], "yuv420p");
        assert_eq!(video["color_space"], "bt709");
        let son = flux.iter().find(|f| f["codec_type"] == "audio").unwrap();
        assert_eq!((son["codec_name"].as_str(), son["sample_rate"].as_str(), son["channels"].as_u64()), (Some("aac"), Some("48000"), Some(2)));
        let duree: f64 = infos["format"]["duration"].as_str().unwrap().parse().unwrap();
        assert!((duree - 2.0).abs() < 0.1, "durée {duree}");

        // La vidéo : rouge, puis bleue ; le carré vert avance.
        let a = image_a(&cible, 0.5);
        let b = image_a(&cible, 1.5);
        assert!(proche(a.get_pixel(160, 50), [255, 0, 0]), "{:?}", a.get_pixel(160, 50));
        assert!(proche(b.get_pixel(160, 50), [0, 0, 255]), "{:?}", b.get_pixel(160, 50));
        // À 0,5 s, le carré est en x = 70 (de 70 à 110) ; à 1,5 s, en x = 210.
        assert!(proche(a.get_pixel(90, 150), [0, 255, 0]) && !proche(a.get_pixel(230, 150), [0, 255, 0]), "{:?}", a.get_pixel(90, 150));
        assert!(proche(b.get_pixel(230, 150), [0, 255, 0]) && !proche(b.get_pixel(90, 150), [0, 255, 0]), "{:?}", b.get_pixel(230, 150));
        // Le son (une sinusoïde à un huitième du maximum, soit 0,088 en moyenne quadratique) monte
        // pendant le fondu d'entrée (une demi-seconde), puis reste.
        let (debut, milieu) = (niveau(&cible, 0.0, 0.15), niveau(&cible, 1.0, 1.4));
        assert!((milieu - 0.088).abs() < 0.015 && debut < milieu * 0.5, "début {debut}, milieu {milieu}");
        // Rien ne traîne à côté du film.
        let restes: Vec<_> = fs::read_dir(cible.parent().unwrap()).unwrap().flatten().map(|e| e.file_name()).collect();
        assert_eq!(restes.len(), 1, "{restes:?}");
        let _ = fs::remove_dir_all(&dossier);
    }

    /// Un clip retouché par le labo (étape 5, lot 4) : chaque image du film l'est, depuis
    /// l'original ; le grain change d'une image à l'autre.
    #[test]
    fn un_clip_retouche_l_est_image_par_image() {
        if !ffmpeg_present() || !x264_present().unwrap_or(false) {
            eprintln!("ffmpeg ou x264 absent : essai sauté");
            return;
        }
        let dossier = dossier_de_test("labo");
        let ressources = dossier.join("ressources");
        fs::create_dir_all(&ressources).unwrap();
        let ressource = videos::importer(&video_rouge_puis_bleue(&dossier), &ressources, &videos::ReglageCopie::default(), &mut |_| {}).unwrap();
        let film = |retouche: Value, nom: &str| {
            let mut page = page_de_test(&ressource.id);
            page.elements[0].element["reglages"] = retouche;
            let cible = dossier.join(nom).join("film.mp4");
            exporter(&page, &reglages(FormatVideo::Mp4, 320, 180, 25), &ressources, &cible, &mut |_| {}, &AtomicBool::new(false)).unwrap();
            cible
        };
        // Sans couleur et plus clair : le rouge, puis le bleu, deviennent des gris.
        let gris = film(json!({ "saturation": -100, "exposition": 1 }), "gris");
        for t in [0.5, 1.5] {
            let p = image_a(&gris, t).get_pixel(160, 50).0;
            assert!(p[0].abs_diff(p[1]) <= 6 && p[1].abs_diff(p[2]) <= 6 && p[0] > 60, "{t} s : {p:?}");
        }
        // Le grain : deux images voisines d'un rouge uni diffèrent ; sans grain, elles se valent.
        let ecart = |f: &Path| {
            let (a, b) = (image_a(f, 0.40), image_a(f, 0.52));
            let zone = |i: &image::RgbImage| (40..120).flat_map(|y| (60..260).map(move |x| (x, y))).map(|(x, y)| i.get_pixel(x, y).0[0] as f32).collect::<Vec<_>>();
            zone(&a).iter().zip(zone(&b)).map(|(x, y)| (x - y).abs()).sum::<f32>() / (80.0 * 200.0)
        };
        let (avec, sans) = (ecart(&film(json!({ "grain": 100, "exposition": -1 }), "grain")), ecart(&film(json!({ "exposition": -1 }), "sans")));
        assert!(avec > sans + 1.5, "grain : {avec} contre {sans}");
        let _ = fs::remove_dir_all(&dossier);
    }

    /// Un sous-titre de deux mots (deux carrés), chacun en deux variantes : noire d'ordinaire,
    /// rouge et agrandie de moitié quand le mot est dit. À 0,5 s, le premier mot est dit ; à
    /// 1,5 s, le second. Un second sous-titre, progressif, n'a encore que son premier mot.
    #[test]
    fn un_sous_titre_met_en_valeur_le_mot_dit() {
        if !ffmpeg_present() || !x264_present().unwrap_or(false) {
            eprintln!("ffmpeg ou x264 absent : essai sauté");
            return;
        }
        let dossier = dossier_de_test("sous-titre");
        let ressources = dossier.join("ressources");
        fs::create_dir_all(&ressources).unwrap();
        let lettre = |x: f64, y: f64, mot: f64, actif: bool| {
            let mut c = rectangle_svg(40.0, 40.0, if actif { "#ff0000" } else { "#000000" });
            c["svg"] = json!(c["svg"].as_str().unwrap().replace("viewBox=\"0 0 40 40\"", &format!("viewBox=\"{x} {y} 40 40\"")).replace("M0 0L40 0L40 40L0 40Z", &format!("M{x} {y}L{} {y}L{} {}L{x} {}Z", x + 40.0, x + 40.0, y + 40.0, y + 40.0)));
            c["boite"] = json!({ "x0": x, "y0": y, "x1": x + 40.0, "y1": y + 40.0 });
            c["unite"] = json!({ "lettre": mot, "mot": mot, "ligne": 0, "cx": x + 20.0, "cy": y + 20.0, "taille": 40, "actif": actif, "mx": x + 20.0, "my": y + 20.0 });
            c
        };
        let texte = |id: &str, y: f64, progressif: bool| {
            json!({
                "element": { "id": id, "type": "texte", "x": 0, "y": 0, "largeur": 320, "hauteur": 180, "rotation": 0, "opacite": 1, "visible": true,
                             "temps": { "debut": 0, "fin": 2000 }, "piste": 1,
                             "sousTitre": { "mots": [{ "debut": 0, "fin": 1000 }, { "debut": 1000, "fin": 2000 }], "actif": { "couleur": "#ff0000", "echelle": 1.5 }, "progressif": progressif } },
                "calques": [lettre(40.0, y, 0.0, false), lettre(40.0, y, 0.0, true), lettre(200.0, y, 1.0, false), lettre(200.0, y, 1.0, true)],
                "totaux": { "lettres": 2, "mots": 2, "lignes": 1 }
            })
        };
        let page: DescriptionPage = serde_json::from_value(json!({
            "largeur": 320, "hauteur": 180, "duree": 2000,
            "fond": [rectangle_svg(320.0, 180.0, "#ffffff")],
            "elements": [texte("a", 20.0, false), texte("b", 110.0, true)],
            "polices": []
        }))
        .unwrap();
        let cible = dossier.join("sortie").join("film.mp4");
        exporter(&page, &reglages(FormatVideo::Mp4, 320, 180, 25), &ressources, &cible, &mut |_| (), &AtomicBool::new(false)).unwrap();
        let (a, b) = (image_a(&cible, 0.5), image_a(&cible, 1.5));
        let (rouge, noir, blanc) = ([255, 0, 0], [0, 0, 0], [255, 255, 255]);
        // Premier sous-titre (carrés de y 20 à 60) : à 0,5 s, le mot 0 rouge et agrandi (il
        // déborde jusqu'à x = 30), le mot 1 noir ; à 1,5 s, l'inverse.
        assert!(proche(a.get_pixel(60, 40), rouge) && proche(a.get_pixel(33, 40), rouge) && proche(a.get_pixel(220, 40), noir) && proche(a.get_pixel(195, 40), blanc), "{:?}", (a.get_pixel(60, 40), a.get_pixel(33, 40), a.get_pixel(220, 40)));
        assert!(proche(b.get_pixel(60, 40), noir) && proche(b.get_pixel(33, 40), blanc) && proche(b.get_pixel(220, 40), rouge) && proche(b.get_pixel(193, 40), rouge), "{:?}", (b.get_pixel(60, 40), b.get_pixel(220, 40)));
        // Le progressif (y de 110 à 150) : à 0,5 s, le mot 1 n'est pas encore là.
        assert!(proche(a.get_pixel(60, 130), rouge) && proche(a.get_pixel(220, 130), blanc), "{:?}", (a.get_pixel(60, 130), a.get_pixel(220, 130)));
        assert!(proche(b.get_pixel(60, 130), noir) && proche(b.get_pixel(220, 130), rouge), "{:?}", (b.get_pixel(60, 130), b.get_pixel(220, 130)));
        let _ = fs::remove_dir_all(&dossier);
    }

    /// Le niveau moyen du son du film entre deux instants (s), autour d'une fréquence (Hz).
    fn niveau_a(film: &Path, debut: f64, fin: f64, frequence: u32) -> f32 {
        let s = Command::new("ffmpeg")
            .args(["-hide_banner", "-loglevel", "error", "-ss", &format!("{debut}"), "-t", &format!("{}", fin - debut), "-i"])
            .arg(film)
            .args(["-vn", "-af", &format!("bandpass=f={frequence}:width_type=h:w=60,bandpass=f={frequence}:width_type=h:w=60"), "-ac", "1", "-ar", "48000", "-f", "f32le", "pipe:1"])
            .output()
            .unwrap();
        let v: Vec<f32> = s.stdout.chunks_exact(4).map(|o| f32::from_le_bytes([o[0], o[1], o[2], o[3]])).collect();
        (v.iter().map(|x| x * x).sum::<f32>() / v.len().max(1) as f32).sqrt()
    }

    /// Un son synthétique : une sinusoïde d'amplitude 1/8, en WAV mono.
    fn sinus_wav(dossier: &Path, nom: &str, frequence: u32, secondes: f64) -> PathBuf {
        let chemin = dossier.join(nom);
        let s = Command::new("ffmpeg")
            .args(["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", &format!("sine=frequency={frequence}:sample_rate=48000:duration={secondes}")])
            .arg(&chemin)
            .output()
            .unwrap();
        assert!(s.status.success());
        chemin
    }

    /// Le niveau intégré d'un film, mesuré sur son son décodé.
    fn lufs_du_film(film: &Path) -> f64 {
        let s = Command::new("ffmpeg").args(["-hide_banner", "-loglevel", "error", "-i"]).arg(film).args(["-vn", "-ac", "2", "-ar", "48000", "-f", "f32le", "pipe:1"]).output().unwrap();
        let v: Vec<f32> = s.stdout.chunks_exact(4).map(|o| f32::from_le_bytes([o[0], o[1], o[2], o[3]])).collect();
        sons::mesurer(&v).lufs.unwrap()
    }

    /// Une vidéo où l'on parle (décision d'Alexandre du 2026-10-16) : la musique baisse là où
    /// l'analyse trouve de la parole dans son son, et seulement là.
    #[test]
    fn le_vignetage_d_une_photo_recadree_suit_son_cadre() {
        let g = json!({ "x": 0.1, "y": 0.2, "largeur": 0.5, "hauteur": 0.6, "angle": 4.5 });
        let avec = reglages_labo(&json!({ "type": "image", "reglages": { "vignetage": -40, "contraste": 10 }, "rognage": g })).unwrap();
        assert_eq!(avec.rognage, Some(labo::Rognage { x: 0.1, y: 0.2, largeur: 0.5, hauteur: 0.6, angle: 4.5 }));
        // Sans vignetage, le recadrage ne change aucun pixel : il reste hors de la retouche.
        let sans = reglages_labo(&json!({ "type": "video", "reglages": { "contraste": 10 }, "rognage": g })).unwrap();
        assert_eq!(sans.rognage, None);
        // Un recadrage seul n'est pas une retouche ; un recadrage glissé dans les réglages non plus.
        assert!(reglages_labo(&json!({ "type": "image", "rognage": g })).is_none());
        assert!(reglages_labo(&json!({ "type": "image", "reglages": { "rognage": g } })).is_none());
    }

    #[test]
    fn la_musique_baisse_la_ou_l_on_parle_dans_une_video() {
        if !ffmpeg_present() || !x264_present().unwrap_or(false) {
            eprintln!("ffmpeg ou x264 absent : essai sauté");
            return;
        }
        let dossier = dossier_de_test("parle");
        let ressources = dossier.join("ressources");
        fs::create_dir_all(&ressources).unwrap();
        // 2 s d'image ; le son : 1 000 Hz de 1 à 1,6 s, du silence ailleurs.
        let chemin = dossier.join("parle.mp4");
        let s = Command::new("ffmpeg")
            .args(["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=gray:size=160x90:rate=25:duration=2", "-f", "lavfi", "-i", "sine=frequency=1000:sample_rate=48000:duration=2"])
            .args(["-af", "volume=0:enable='not(between(t,1,1.6))'", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest"])
            .arg(&chemin)
            .output()
            .unwrap();
        assert!(s.status.success(), "{}", String::from_utf8_lossy(&s.stderr));
        let video = videos::importer(&chemin, &ressources, &videos::ReglageCopie::default(), &mut |_| {}).unwrap();
        let musique = sons::importer(&sinus_wav(&dossier, "musique.wav", 440, 2.0), &ressources, &mut |_| {}).unwrap();
        let mut page = page_de_test(&video.id);
        page.elements[0].element.as_object_mut().unwrap().remove("fonduEntree");
        page.sons = serde_json::from_value(json!([{ "id": "m", "ressource": musique.id, "temps": { "debut": 0, "fin": 2000 }, "piste": 0, "role": "musique" }])).unwrap();
        let cible = dossier.join("sortie").join("film.mp4");
        exporter(&page, &reglages(FormatVideo::Mp4, 320, 180, 25), &ressources, &cible, &mut |_| {}, &AtomicBool::new(false)).unwrap();
        let (avant, sous) = (niveau_a(&cible, 0.2, 0.7, 440), niveau_a(&cible, 1.15, 1.5, 440));
        assert!(avant > 0.02, "{avant}");
        assert!((sous / avant - 0.3).abs() < 0.08, "sous la parole de la vidéo : {sous} pour {avant}");
        // La même vidéo muette : la musique ne baisse plus.
        page.elements[0].element["volume"] = json!(0);
        let cible2 = dossier.join("sortie").join("muette.mp4");
        exporter(&page, &reglages(FormatVideo::Mp4, 320, 180, 25), &ressources, &cible2, &mut |_| {}, &AtomicBool::new(false)).unwrap();
        let (avant2, sous2) = (niveau_a(&cible2, 0.2, 0.7, 440), niveau_a(&cible2, 1.15, 1.5, 440));
        assert!((sous2 / avant2 - 1.0).abs() < 0.15, "vidéo muette : {sous2} pour {avant2}");
        let _ = fs::remove_dir_all(&dossier);
    }

    #[test]
    fn la_musique_boucle_baisse_sous_la_voix_se_cale_et_s_enleve() {
        if !ffmpeg_present() || !x264_present().unwrap_or(false) {
            eprintln!("ffmpeg ou x264 absent : essai sauté");
            return;
        }
        let dossier = dossier_de_test("sons");
        let ressources = dossier.join("ressources");
        fs::create_dir_all(&ressources).unwrap();
        let video = videos::importer(&video_rouge_puis_bleue(&dossier), &ressources, &videos::ReglageCopie::default(), &mut |_| {}).unwrap();
        // Une musique d'une demi-seconde (440 Hz), répétée jusqu'au bout ; une voix (1 000 Hz)
        // de 1 à 1,6 s ; la vidéo, muette.
        let musique = sons::importer(&sinus_wav(&dossier, "musique.wav", 440, 0.5), &ressources, &mut |_| {}).unwrap();
        let voix = sons::importer(&sinus_wav(&dossier, "voix.wav", 1000, 0.6), &ressources, &mut |_| {}).unwrap();
        let mut page = page_de_test(&video.id);
        page.elements[0].element["volume"] = json!(0);
        page.sons = serde_json::from_value(json!([
            { "id": "m", "ressource": musique.id, "temps": { "debut": 0, "fin": 2000 }, "piste": 0, "role": "musique", "jusquALaFin": true },
            { "id": "v", "ressource": voix.id, "temps": { "debut": 1000, "fin": 1600 }, "piste": 1, "role": "voix" }
        ]))
        .unwrap();
        let annule = AtomicBool::new(false);
        let cible = dossier.join("sortie").join("film.mp4");
        let film = exporter(&page, &reglages(FormatVideo::Mp4, 320, 180, 25), &ressources, &cible, &mut |_| {}, &annule).unwrap();
        assert_eq!(film.sans_musique, None);
        // La musique passe la fin de son fichier sans s'arrêter (0,5 s), puis baisse à 30 % sous
        // la voix, et remonte après.
        let (avant, sous, apres) = (niveau_a(&cible, 0.2, 0.9, 440), niveau_a(&cible, 1.15, 1.5, 440), niveau_a(&cible, 0.55, 0.75, 440));
        assert!(avant > 0.02, "{avant}");
        assert!((apres / avant - 1.0).abs() < 0.15, "la boucle ne laisse pas de trou : {avant} puis {apres}");
        assert!((sous / avant - 0.3).abs() < 0.08, "sous la voix : {sous} pour {avant}");
        let voix_seule = niveau_a(&cible, 1.15, 1.5, 1000);
        assert!(voix_seule > 0.02 && niveau_a(&cible, 0.2, 0.9, 1000) < voix_seule * 0.1, "{voix_seule}");

        // Calé sur -14 LUFS, avec la version sans musique : même gain, plus de 440 Hz.
        let mut r = reglages(FormatVideo::Mp4, 320, 180, 25);
        r.niveau_lufs = Some(-14.0);
        r.sans_musique = true;
        let cible2 = dossier.join("sortie").join("cale.mp4");
        let film = exporter(&page, &r, &ressources, &cible2, &mut |_| {}, &annule).unwrap();
        let n = film.niveau.unwrap();
        assert!((n.lufs.unwrap() + 14.0).abs() < 0.3 && n.gain > 5.0 && n.crete.unwrap() <= CRETE_MAX + 0.05, "{n:?}");
        assert!((lufs_du_film(&cible2) + 14.0).abs() < 1.0, "{}", lufs_du_film(&cible2));
        let variante = film.sans_musique.clone().unwrap();
        assert_eq!(variante, dossier.join("sortie").join("cale_sans-musique.mp4"));
        let (v1, v2) = (sonder(&cible2), sonder(&variante));
        let images = |j: &Value| j["streams"].as_array().unwrap().iter().find(|f| f["codec_type"] == "video").unwrap()["nb_read_frames"].clone();
        assert_eq!(images(&v1), images(&v2), "les images sont recopiées telles quelles");
        let gain = 10f32.powf(n.gain as f32 / 20.0);
        assert!(niveau_a(&variante, 0.2, 0.9, 440) < 0.01, "plus de musique : {}", niveau_a(&variante, 0.2, 0.9, 440));
        let voix_calee = niveau_a(&variante, 1.15, 1.5, 1000);
        assert!((voix_calee / (voix_seule * gain) - 1.0).abs() < 0.15, "la voix garde le niveau du film calé : {voix_calee} pour {}", voix_seule * gain);

        // Une page sans voix ni bruitage : la version sans musique n'a pas de son ; une page sans
        // musique n'en a pas besoin.
        page.sons.truncate(1);
        let cible3 = dossier.join("sortie").join("musique.mp4");
        let film = exporter(&page, &r, &ressources, &cible3, &mut |_| {}, &annule).unwrap();
        let v3 = sonder(&film.sans_musique.unwrap());
        assert!(v3["streams"].as_array().unwrap().iter().all(|f| f["codec_type"] != "audio"), "{v3}");
        page.sons[0].role = "bruitage".into();
        let film = exporter(&page, &r, &ressources, &dossier.join("sortie").join("bruitage.mp4"), &mut |_| {}, &annule).unwrap();
        assert_eq!(film.sans_musique, None);
        let _ = fs::remove_dir_all(&dossier);
    }

    #[test]
    fn une_voix_nettoyee_s_exporte_nettoyee() {
        if !ffmpeg_present() || !x264_present().unwrap_or(false) {
            eprintln!("ffmpeg ou x264 absent : essai sauté");
            return;
        }
        let dossier = dossier_de_test("voix-nettoyee");
        let ressources = dossier.join("ressources");
        fs::create_dir_all(&ressources).unwrap();
        let video = videos::importer(&video_rouge_puis_bleue(&dossier), &ressources, &videos::ReglageCopie::default(), &mut |_| {}).unwrap();
        // Une « voix » : 1 000 Hz, avec un ronflement à 50 Hz aussi fort qu'elle.
        let wav = dossier.join("voix.wav");
        let s = Command::new("ffmpeg")
            .args(["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "aevalsrc=0.05*sin(2*PI*50*t)+0.05*sin(2*PI*1000*t):s=48000:d=2"])
            .arg(&wav)
            .output()
            .unwrap();
        assert!(s.status.success());
        let voix = sons::importer(&wav, &ressources, &mut |_| {}).unwrap();
        let mut page = page_de_test(&video.id);
        page.elements[0].element["volume"] = json!(0);
        page.sons = serde_json::from_value(json!([{ "id": "v", "ressource": voix.id, "temps": { "debut": 0, "fin": 2000 }, "piste": 0, "role": "voix" }])).unwrap();
        let annule = AtomicBool::new(false);
        let brut = dossier.join("sortie").join("brut.mp4");
        exporter(&page, &reglages(FormatVideo::Mp4, 320, 180, 25), &ressources, &brut, &mut |_| {}, &annule).unwrap();
        // Graves coupés et voix calée sur -16 LUFS : le ronflement s'efface, la voix monte.
        page.sons[0].nettoyage = Some(voix::Nettoyage { graves: Some(true), niveau: Some(true), ..Default::default() });
        let net = dossier.join("sortie").join("net.mp4");
        exporter(&page, &reglages(FormatVideo::Mp4, 320, 180, 25), &ressources, &net, &mut |_| {}, &annule).unwrap();
        let (r_brut, r_net) = (niveau_a(&brut, 0.3, 1.7, 50), niveau_a(&net, 0.3, 1.7, 50));
        let (v_brut, v_net) = (niveau_a(&brut, 0.3, 1.7, 1000), niveau_a(&net, 0.3, 1.7, 1000));
        assert!(r_net / v_net < 0.25 * r_brut / v_brut, "ronflement {r_brut} puis {r_net}, voix {v_brut} puis {v_net}");
        assert!(v_net > v_brut * 1.5, "la voix calée monte : {v_brut} puis {v_net}");
        assert!((lufs_du_film(&net) + 16.0).abs() < 1.5, "{}", lufs_du_film(&net));
        // La version nettoyée est restée dans le cache du design ; l'original n'a pas bougé.
        let cle = page.sons[0].nettoyage.as_ref().unwrap().cle();
        assert!(voix::chemin(&ressources, &voix.id, &cle, "flac").unwrap().exists());
        assert_eq!(videos::empreinte_fichier(&images::chemin_ressource(&ressources, &voix.id, Genre::Original).unwrap()).unwrap(), voix.id);
        let _ = fs::remove_dir_all(&dossier);
    }

    #[test]
    fn un_gif_en_boucle_et_une_annulation_qui_ne_laisse_rien() {
        if !ffmpeg_present() {
            eprintln!("ffmpeg absent : essai sauté");
            return;
        }
        let dossier = dossier_de_test("gif");
        let ressources = dossier.join("ressources");
        fs::create_dir_all(&ressources).unwrap();
        let ressource = videos::importer(&video_rouge_puis_bleue(&dossier), &ressources, &videos::ReglageCopie::default(), &mut |_| {}).unwrap();
        let page = page_de_test(&ressource.id);
        let annule = AtomicBool::new(false);
        let cible = dossier.join("film.gif");
        exporter(&page, &reglages(FormatVideo::Gif, 160, 90, 10), &ressources, &cible, &mut |_| {}, &annule).unwrap();
        let octets = fs::read(&cible).unwrap();
        assert!(octets.starts_with(b"GIF89a"));
        // L'extension « NETSCAPE2.0 » fait tourner le GIF en boucle.
        assert!(octets.windows(11).any(|w| w == b"NETSCAPE2.0"));
        let infos = sonder(&cible);
        assert_eq!(infos["streams"][0]["nb_read_frames"], "20");
        assert_eq!(infos["streams"][0]["width"].as_u64(), Some(160));

        // Annulé à la cinquième image : une erreur claire, ni film ni fichier temporaire.
        let cible2 = dossier.join("annule.mp4");
        let annule = AtomicBool::new(false);
        let resultat = exporter(&page, &reglages(FormatVideo::Mp4, 320, 180, 25), &ressources, &cible2, &mut |a| {
            if a.image >= 5 {
                annule.store(true, Ordering::SeqCst);
            }
        }, &annule);
        assert!(matches!(resultat, Err(ErreurMontage::Annule)), "{resultat:?}");
        assert!(!cible2.exists());
        let caches: Vec<_> = fs::read_dir(&dossier).unwrap().flatten().filter(|e| e.file_name().to_string_lossy().starts_with(".annule")).collect();
        assert!(caches.is_empty());
        let _ = fs::remove_dir_all(&dossier);
    }

    #[test]
    fn les_traces_du_contexte_svg_se_relisent() {
        let p = trace("M10 20L30 20C30 25 35 30 40 30Z").unwrap();
        let b = p.bounds();
        assert_eq!((b.left(), b.top(), b.right(), b.bottom()), (10.0, 20.0, 40.0, 30.0));
        let n = trace("M-1.5 -2L3e2 4L-10 -20Z").unwrap();
        assert_eq!((n.bounds().left(), n.bounds().right(), n.bounds().top()), (-10.0, 300.0, -20.0));
        assert!(trace("").is_none());
    }

    #[test]
    fn la_vitesse_du_son_en_maillons_atempo() {
        assert_eq!(atempo(0.25), vec!["atempo=0.5", "atempo=0.500000"]);
        assert_eq!(atempo(4.0), vec!["atempo=2.0", "atempo=2.000000"]);
        assert_eq!(atempo(1.0), vec!["atempo=1.000000"]);
        assert_eq!(atempo(1.5), vec!["atempo=1.500000"]);
    }

    #[test]
    fn les_reglages_sont_verifies() {
        assert!(reglages(FormatVideo::Mp4, 1080, 1920, 30).verifier().is_ok());
        assert!(matches!(reglages(FormatVideo::Mp4, 1081, 1920, 30).verifier(), Err(ErreurMontage::Reglages(_))));
        assert!(reglages(FormatVideo::Gif, 481, 853, 15).verifier().is_ok());
        assert!(reglages(FormatVideo::Mp4, 1080, 1920, 120).verifier().is_err());
        assert!(reglages(FormatVideo::Mp4, 8, 8, 30).verifier().is_err());
        let mut r = reglages(FormatVideo::Mp4, 1080, 1920, 30);
        r.niveau_lufs = Some(-14.0);
        assert!(r.verifier().is_ok());
        r.niveau_lufs = Some(3.0);
        assert!(r.verifier().is_err());
        // Les réglages d'avant le lot 5 se lisent encore (niveau et version sans musique absents).
        let ancien: Reglages = serde_json::from_value(json!({ "format": "mp4", "largeur": 1080, "hauteur": 1920, "imagesParSeconde": 30, "crf": 18, "debitMaxKbps": 8000, "gopSecondes": 0.5, "debitSonKbps": 192, "son": true })).unwrap();
        assert_eq!((ancien.niveau_lufs, ancien.sans_musique), (None, false));
    }

    #[test]
    fn le_gain_cale_le_niveau_sans_depasser_la_crete() {
        let g = |lufs: f64, crete: f64, cible: f64| 20.0 * gain_de_niveau(&Niveau { lufs: Some(lufs), crete: Some(crete) }, cible).log10();
        assert!((g(-20.0, -10.0, -14.0) - 6.0).abs() < 1e-9, "6 dB de plus");
        assert!((g(-20.0, -3.0, -14.0) - 2.0).abs() < 1e-9, "la crête arrête à -1 dBTP");
        assert!((g(-8.0, -0.5, -14.0) + 6.0).abs() < 1e-9, "trop fort : on baisse");
        assert_eq!(gain_de_niveau(&Niveau::default(), -14.0), 1.0, "un silence reste un silence");
    }

    #[test]
    fn une_lettre_d_un_texte_par_morceaux() {
        let u = Unite { lettre: 3.0, mot: 1.0, ligne: 0.0, cx: 100.0, cy: 50.0, taille: 40.0, actif: false, mx: None, my: None };
        let totaux = Totaux { lettres: 10.0, mots: 3.0, lignes: 1.0 };
        // Machine à écrire à mi-course : les cinq premières lettres se voient, pas les autres.
        let machine = animation::Unites { genre: GenreUnites::MachineAEcrire, sens: animation::Sens::Entree, p: 0.5 };
        assert_eq!(etat_lettre(&u, &machine, Some(&totaux)).map(|(_, a)| a), Some(1.0));
        assert!(etat_lettre(&Unite { lettre: 6.0, ..u }, &machine, Some(&totaux)).is_none());
        // Lettres au tout début : décalées vers le bas d'une part de la taille, rapetissées.
        let lettres = animation::Unites { genre: GenreUnites::Lettres, sens: animation::Sens::Entree, p: 0.05 };
        let (t, a) = etat_lettre(&Unite { lettre: 0.0, ..u }, &lettres, Some(&totaux)).unwrap();
        let attendu = animation::etat_unite(lettres, 0.0, 10.0);
        assert!((a - attendu.opacite).abs() < 1e-12);
        let (x, y) = t.point(100.0, 50.0);
        assert!((x - 100.0).abs() < 1e-9 && (y - (50.0 + attendu.dy_em * 40.0)).abs() < 1e-9);
    }

    /// Rend l'image `ELIOT_RANG` (0 par défaut) d'une description écrite par la fenêtre
    /// (`ELIOT_DESCRIPTION`), avec les ressources de `ELIOT_RESSOURCES`, en PNG dans
    /// `ELIOT_SORTIE` : sert aux essais qui comparent l'export à l'écran.
    #[test]
    #[ignore]
    fn rendre_une_description() {
        let description: DescriptionPage = serde_json::from_slice(&fs::read(std::env::var("ELIOT_DESCRIPTION").unwrap()).unwrap()).unwrap();
        let ressources = PathBuf::from(std::env::var("ELIOT_RESSOURCES").unwrap_or_else(|_| "/tmp".into()));
        let rang: u64 = std::env::var("ELIOT_RANG").ok().and_then(|r| r.parse().ok()).unwrap_or(0);
        let echelle: f64 = std::env::var("ELIOT_ECHELLE").ok().and_then(|r| r.parse().ok()).unwrap_or(1.0);
        let reglages = Reglages {
            format: FormatVideo::Mp4,
            largeur: ((description.largeur * echelle / 2.0).round() * 2.0) as u32,
            hauteur: ((description.hauteur * echelle / 2.0).round() * 2.0) as u32,
            images_par_seconde: 30,
            crf: 18,
            debit_max_kbps: 12_000,
            gop_secondes: 0.5,
            debit_son_kbps: 384,
            son: false,
            niveau_lufs: None,
            sans_musique: false,
        };
        let debut = std::time::Instant::now();
        let png = image_du_film(&description, &reglages, &ressources, rang).unwrap();
        eprintln!("image rendue en {:?}", debut.elapsed());
        fs::write(std::env::var("ELIOT_SORTIE").unwrap(), png).unwrap();
    }
}
