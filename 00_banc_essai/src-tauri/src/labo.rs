//! Étape 5, lot 0 : l'aperçu en direct du labo photo, côté Rust.
//!
//! Deux voies sont à départager (BRIEF § 6, « Ce que Eliot reprend de Lightroom ») : le Rust
//! recalcule une copie à la taille de l'écran à chaque mouvement du curseur et renvoie les
//! pixels bruts, ou un shader WebGL fait le même calcul dans la fenêtre. Ce module fait la
//! première voie, et mesure ce que coûtent les réglages qui regardent les pixels voisins
//! (clarté, texture, netteté, bruit, voile), que le Rust calculerait de toute façon.
//!
//! Les réglages qui ne regardent qu'un pixel suivent l'ordre du BRIEF : balance des blancs,
//! exposition, tonalités, couleurs (saturation, vibrance, mélangeur), effets (vignetage,
//! grain). Les mêmes formules sont écrites en GLSL dans `src/labo.ts` ; le banc compare les
//! deux rendus. Elles servent à mesurer, pas encore à retoucher : le labo du lot 2 les reprendra
//! dans le noyau, avec leur tableau de valeurs attendues.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Instant;

use fast_image_resize::{FilterType, IntoImageView, ResizeAlg, ResizeOptions, Resizer};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};

fn donnees(nom: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("public").join("donnees").join(nom)
}

/// Les réglages qui ne regardent qu'un pixel, tels que la fenêtre les envoie.
#[derive(Deserialize, Default, Clone, Copy, Debug)]
#[serde(default, rename_all = "camelCase")]
pub struct Reglages {
    pub exposition: f32,
    pub contraste: f32,
    pub hautes_lumieres: f32,
    pub ombres: f32,
    pub blancs: f32,
    pub noirs: f32,
    pub temperature: f32,
    pub teinte: f32,
    pub vibrance: f32,
    pub saturation: f32,
    /// Huit couleurs (rouge, orange, jaune, vert, cyan, bleu, violet, magenta) : teinte,
    /// saturation, luminance, de -100 à +100.
    pub melangeur: [[f32; 3]; 8],
    pub vignetage: f32,
    pub grain: f32,
}

/// Centres des huit couleurs du mélangeur, en degrés de teinte.
const CENTRES: [f32; 8] = [0.0, 30.0, 60.0, 120.0, 180.0, 240.0, 270.0, 300.0];
const LUMA: [f32; 3] = [0.2126, 0.7152, 0.0722];

fn smoothstep(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

fn srgb_vers_lineaire(c: f32) -> f32 {
    if c <= 0.04045 { c / 12.92 } else { ((c + 0.055) / 1.055).powf(2.4) }
}

fn lineaire_vers_srgb(l: f32) -> f32 {
    if l <= 0.003_130_8 { 12.92 * l } else { 1.055 * l.powf(1.0 / 2.4) - 0.055 }
}

/// Le hachage du grain, le même en GLSL (entiers non signés sur 32 bits).
pub fn hachage(x: u32, y: u32) -> u32 {
    let mut h = x.wrapping_mul(374_761_393).wrapping_add(y.wrapping_mul(668_265_263));
    h = (h ^ (h >> 13)).wrapping_mul(1_274_126_177);
    h ^ (h >> 16)
}

/// Ce qui ne change pas d'un pixel à l'autre, calculé une fois par image.
pub struct Prepares {
    entree: [f32; 256],
    sortie: Vec<f32>,
    gains: [f32; 3],
    r: Reglages,
    melange: bool,
}

const PAS_SORTIE: usize = 4096;

impl Prepares {
    pub fn new(r: Reglages) -> Self {
        let mut entree = [0.0; 256];
        for (i, v) in entree.iter_mut().enumerate() {
            *v = srgb_vers_lineaire(i as f32 / 255.0);
        }
        let sortie = (0..=PAS_SORTIE).map(|i| lineaire_vers_srgb(i as f32 / PAS_SORTIE as f32)).collect();
        let kt = r.temperature / 100.0 * 0.5;
        let ku = r.teinte / 100.0 * 0.3;
        let e = r.exposition.exp2();
        let gains = [kt.exp2() * e, (-ku).exp2() * e, (-kt).exp2() * e];
        let melange = r.melangeur.iter().flatten().any(|v| *v != 0.0);
        Prepares { entree, sortie, gains, r, melange }
    }

    fn vers_srgb(&self, l: f32) -> f32 {
        let x = l.clamp(0.0, 1.0) * PAS_SORTIE as f32;
        let i = (x as usize).min(PAS_SORTIE - 1);
        let t = x - i as f32;
        self.sortie[i] * (1.0 - t) + self.sortie[i + 1] * t
    }

    /// Un pixel : `c` en sRGB sur 8 bits, `(u, v)` sa place dans l'image de -1 à 1 (pour le
    /// vignetage), `(x, y)` ses coordonnées (pour le grain).
    pub fn pixel(&self, c: [u8; 3], u: f32, v: f32, x: u32, y: u32) -> [u8; 3] {
        let r = &self.r;
        // Balance des blancs et exposition.
        let mut l = [self.entree[c[0] as usize] * self.gains[0], self.entree[c[1] as usize] * self.gains[1], self.entree[c[2] as usize] * self.gains[2]];
        // Tonalités, sur la luminance perçue.
        let y0 = l[0] * LUMA[0] + l[1] * LUMA[1] + l[2] * LUMA[2];
        if y0 > 1e-6 {
            let mut p = y0.powf(1.0 / 2.2);
            let f = if r.contraste >= 0.0 { 1.0 + r.contraste / 100.0 * 0.8 } else { 1.0 + r.contraste / 100.0 * 0.6 };
            p = 0.5 + (p - 0.5) * f;
            p += 0.3 * r.hautes_lumieres / 100.0 * smoothstep(0.5, 1.0, p)
                + 0.3 * r.ombres / 100.0 * (1.0 - smoothstep(0.0, 0.5, p))
                + 0.2 * r.blancs / 100.0 * smoothstep(0.7, 1.0, p)
                + 0.2 * r.noirs / 100.0 * (1.0 - smoothstep(0.0, 0.3, p));
            let rapport = p.max(0.0).powf(2.2) / y0;
            l = [l[0] * rapport, l[1] * rapport, l[2] * rapport];
        }
        // Couleurs : saturation et vibrance autour de la luminance.
        let y1 = l[0] * LUMA[0] + l[1] * LUMA[1] + l[2] * LUMA[2];
        let haut = l[0].max(l[1]).max(l[2]);
        let bas = l[0].min(l[1]).min(l[2]);
        let chroma = if haut > 1e-6 { (haut - bas) / haut } else { 0.0 };
        let k = (1.0 + r.saturation / 100.0) * (1.0 + r.vibrance / 100.0 * (1.0 - chroma));
        l = [y1 + (l[0] - y1) * k, y1 + (l[1] - y1) * k, y1 + (l[2] - y1) * k];
        // Mélangeur : teinte, saturation et luminance de huit couleurs.
        if self.melange && chroma > 0.0 {
            // La teinte de la couleur telle qu'elle est maintenant (après la saturation).
            let haut = l[0].max(l[1]).max(l[2]);
            let delta = haut - l[0].min(l[1]).min(l[2]);
            let mut h = if delta <= 1e-9 {
                0.0
            } else if haut == l[0] {
                60.0 * ((l[1] - l[2]) / delta)
            } else if haut == l[1] {
                60.0 * ((l[2] - l[0]) / delta + 2.0)
            } else {
                60.0 * ((l[0] - l[1]) / delta + 4.0)
            };
            if h < 0.0 {
                h += 360.0;
            }
            let mut i = 7;
            for j in 0..7 {
                if h < CENTRES[j + 1] {
                    i = j;
                    break;
                }
            }
            let suivant = (i + 1) % 8;
            let fin = if i == 7 { 360.0 } else { CENTRES[i + 1] };
            let t = (h - CENTRES[i]) / (fin - CENTRES[i]);
            let m = |c: usize| r.melangeur[i][c] * (1.0 - t) + r.melangeur[suivant][c] * t;
            let (dh, ds, dl) = (m(0) / 100.0 * 30.0, m(1) / 100.0, m(2) / 100.0);
            // Rotation autour de l'axe des gris.
            let a = dh.to_radians();
            let (s, co) = a.sin_cos();
            let un = (1.0 - co) / 3.0;
            let rac = s / 3.0_f32.sqrt();
            let rot = [[co + un, un - rac, un + rac], [un + rac, co + un, un - rac], [un - rac, un + rac, co + un]];
            let v0 = l;
            l = [
                rot[0][0] * v0[0] + rot[0][1] * v0[1] + rot[0][2] * v0[2],
                rot[1][0] * v0[0] + rot[1][1] * v0[1] + rot[1][2] * v0[2],
                rot[2][0] * v0[0] + rot[2][1] * v0[1] + rot[2][2] * v0[2],
            ];
            let y2 = l[0] * LUMA[0] + l[1] * LUMA[1] + l[2] * LUMA[2];
            let ks = 1.0 + ds * chroma;
            let kl = (dl * chroma).exp2();
            l = [(y2 + (l[0] - y2) * ks) * kl, (y2 + (l[1] - y2) * ks) * kl, (y2 + (l[2] - y2) * ks) * kl];
        }
        // Effets : vignetage, grain.
        if r.vignetage != 0.0 {
            let d = ((u * u + v * v) / 2.0).sqrt();
            let f = (r.vignetage / 100.0 * 1.5 * smoothstep(0.35, 1.0, d)).exp2();
            l = [l[0] * f, l[1] * f, l[2] * f];
        }
        if r.grain != 0.0 {
            let n = (hachage(x, y) & 0xffff) as f32 / 65535.0 - 0.5;
            let f = 1.0 + r.grain / 100.0 * 0.25 * n;
            l = [l[0] * f, l[1] * f, l[2] * f];
        }
        [
            (self.vers_srgb(l[0]) * 255.0).round() as u8,
            (self.vers_srgb(l[1]) * 255.0).round() as u8,
            (self.vers_srgb(l[2]) * 255.0).round() as u8,
        ]
    }
}

/// Une image en RGBA sur 8 bits.
#[derive(Clone)]
pub struct Image {
    pub largeur: u32,
    pub hauteur: u32,
    pub pixels: Vec<u8>,
}

/// Applique les réglages à toute l'image, sur tous les cœurs ; écrit du RGBA.
pub fn rendre(source: &Image, r: Reglages, sortie: &mut [u8]) {
    let p = Prepares::new(r);
    let (l, h) = (source.largeur as usize, source.hauteur as usize);
    sortie.par_chunks_mut(l * 4).zip(source.pixels.par_chunks(l * 4)).enumerate().for_each(|(y, (ligne, src))| {
        let v = (y as f32 + 0.5) / h as f32 * 2.0 - 1.0;
        for x in 0..l {
            let u = (x as f32 + 0.5) / l as f32 * 2.0 - 1.0;
            let c = p.pixel([src[4 * x], src[4 * x + 1], src[4 * x + 2]], u, v, x as u32, y as u32);
            ligne[4 * x..4 * x + 3].copy_from_slice(&c);
            ligne[4 * x + 3] = 255;
        }
    });
}

/// Décode une photo du banc et la réduit à `largeur` px sur le grand côté (0 : telle quelle).
pub fn charger(nom: &str, largeur: u32) -> Result<Image, String> {
    let octets = fs::read(donnees(nom)).map_err(|e| format!("{nom} : {e} (commande 4 bis du CLAUDE.md)"))?;
    let source = image::load_from_memory_with_format(&octets, image::ImageFormat::Jpeg).map_err(|e| format!("décodage : {e}"))?.into_rgba8();
    let (ls, hs) = source.dimensions();
    if largeur == 0 || largeur >= ls.max(hs) {
        return Ok(Image { largeur: ls, hauteur: hs, pixels: source.into_raw() });
    }
    let echelle = largeur as f64 / ls.max(hs) as f64;
    let (la, ha) = ((ls as f64 * echelle).round() as u32, (hs as f64 * echelle).round() as u32);
    let source = image::DynamicImage::ImageRgba8(source);
    let mut reduite = fast_image_resize::images::Image::new(la, ha, source.pixel_type().ok_or("type de pixel inconnu")?);
    Resizer::new()
        .resize(&source, &mut reduite, &ResizeOptions::new().resize_alg(ResizeAlg::Convolution(FilterType::Lanczos3)))
        .map_err(|e| format!("réduction : {e}"))?;
    Ok(Image { largeur: la, hauteur: ha, pixels: reduite.into_vec() })
}

// ---- Les réglages qui regardent les voisins (mesurés, pas affichés) ----

/// Flou de boîte séparable de rayon `r`, sur tous les cœurs.
fn flou_boite(plan: &[f32], l: usize, h: usize, r: usize) -> Vec<f32> {
    let mut tmp = vec![0.0f32; plan.len()];
    tmp.par_chunks_mut(l).zip(plan.par_chunks(l)).for_each(|(sortie, ligne)| {
        let mut somme = 0.0f32;
        for i in 0..=r.min(l - 1) {
            somme += ligne[i];
        }
        somme += ligne[0] * r as f32;
        for x in 0..l {
            sortie[x] = somme / (2 * r + 1) as f32;
            let ajout = ligne[(x + r + 1).min(l - 1)];
            let retrait = ligne[x.saturating_sub(r)];
            somme += ajout - retrait;
        }
    });
    // Passe verticale : par bandes de colonnes, pour garder la mémoire proche.
    let mut sortie = vec![0.0f32; plan.len()];
    let bande = 64;
    let colonnes: Vec<usize> = (0..l).step_by(bande).collect();
    let resultats: Vec<(usize, Vec<f32>)> = colonnes
        .par_iter()
        .map(|&x0| {
            let w = bande.min(l - x0);
            let mut bloc = vec![0.0f32; w * h];
            let mut somme = vec![0.0f32; w];
            for k in 0..w {
                for i in 0..=r.min(h - 1) {
                    somme[k] += tmp[i * l + x0 + k];
                }
                somme[k] += tmp[x0 + k] * r as f32;
            }
            for y in 0..h {
                let ajout = (y + r + 1).min(h - 1) * l;
                let retrait = y.saturating_sub(r) * l;
                for k in 0..w {
                    bloc[y * w + k] = somme[k] / (2 * r + 1) as f32;
                    somme[k] += tmp[ajout + x0 + k] - tmp[retrait + x0 + k];
                }
            }
            (x0, bloc)
        })
        .collect();
    for (x0, bloc) in resultats {
        let w = bande.min(l - x0);
        for y in 0..h {
            sortie[y * l + x0..y * l + x0 + w].copy_from_slice(&bloc[y * w..(y + 1) * w]);
        }
    }
    sortie
}

/// Flou proche d'un flou gaussien : trois flous de boîte.
fn flou(plan: &[f32], l: usize, h: usize, r: usize) -> Vec<f32> {
    let r = r.max(1);
    let a = flou_boite(plan, l, h, r);
    let b = flou_boite(&a, l, h, r);
    flou_boite(&b, l, h, r)
}

/// Minimum sur un carré de rayon `r` (pour la correction du voile), séparable.
fn minimum(plan: &[f32], l: usize, h: usize, r: usize) -> Vec<f32> {
    let mut tmp = vec![0.0f32; plan.len()];
    tmp.par_chunks_mut(l).zip(plan.par_chunks(l)).for_each(|(sortie, ligne)| {
        for x in 0..l {
            let (a, b) = (x.saturating_sub(r), (x + r).min(l - 1));
            sortie[x] = ligne[a..=b].iter().copied().fold(f32::MAX, f32::min);
        }
    });
    let mut sortie = vec![0.0f32; plan.len()];
    sortie.par_chunks_mut(l).enumerate().for_each(|(y, ligne)| {
        let (a, b) = (y.saturating_sub(r), (y + r).min(h - 1));
        for x in 0..l {
            let mut m = f32::MAX;
            for yy in a..=b {
                m = m.min(tmp[yy * l + x]);
            }
            ligne[x] = m;
        }
    });
    sortie
}

/// Luminance perçue de chaque pixel, de 0 à 1.
fn luminance(img: &Image) -> Vec<f32> {
    img.pixels.par_chunks(4).map(|p| (p[0] as f32 * LUMA[0] + p[1] as f32 * LUMA[1] + p[2] as f32 * LUMA[2]) / 255.0).collect()
}

/// Contraste local : la luminance s'éloigne de sa version floue (clarté, texture, netteté).
fn contraste_local(lum: &[f32], l: usize, h: usize, rayon: usize, force: f32, tons_moyens: bool) -> Vec<f32> {
    let b = flou(lum, l, h, rayon);
    lum.par_iter()
        .zip(b.par_iter())
        .map(|(&v, &f)| {
            let masque = if tons_moyens { 4.0 * v * (1.0 - v) } else { 1.0 };
            (v + force * (v - f) * masque).clamp(0.0, 1.0)
        })
        .collect()
}

#[derive(Serialize, Clone, Copy, Debug, Default)]
pub struct MesureVoisins {
    pub largeur: u32,
    pub hauteur: u32,
    pub clarte_ms: f64,
    pub texture_ms: f64,
    pub nettete_ms: f64,
    pub bruit_ms: f64,
    pub voile_ms: f64,
    pub tous_ms: f64,
}

fn ms(t: Instant) -> f64 {
    (t.elapsed().as_secs_f64() * 10_000.0).round() / 10.0
}

/// Chaque réglage qui regarde les voisins, seul, puis tous ensemble, sur une image.
pub fn mesurer_voisins(img: &Image) -> MesureVoisins {
    let (l, h) = (img.largeur as usize, img.hauteur as usize);
    let cote = l.max(h);
    let debut_tous = Instant::now();
    let t = Instant::now();
    let lum = luminance(img);
    let clarte = contraste_local(&lum, l, h, cote * 15 / 1000, 0.5, true);
    let clarte_ms = ms(t);
    let t = Instant::now();
    let texture = contraste_local(&clarte, l, h, (cote * 3 / 1000).max(1), 0.4, false);
    let texture_ms = ms(t);
    let t = Instant::now();
    let nette = contraste_local(&texture, l, h, 1, 0.8, false);
    let nettete_ms = ms(t);
    // Bruit : les deux plans de couleur (écart au rouge et au bleu) floutés, la luminance gardée.
    let t = Instant::now();
    let cr: Vec<f32> = img.pixels.par_chunks(4).zip(lum.par_iter()).map(|(p, &y)| p[0] as f32 / 255.0 - y).collect();
    let cb: Vec<f32> = img.pixels.par_chunks(4).zip(lum.par_iter()).map(|(p, &y)| p[2] as f32 / 255.0 - y).collect();
    let (cr, cb) = rayon::join(|| flou(&cr, l, h, 2), || flou(&cb, l, h, 2));
    let bruit_ms = ms(t);
    // Voile : canal sombre, transmission, puis l'image corrigée.
    let t = Instant::now();
    let sombre: Vec<f32> = img.pixels.par_chunks(4).map(|p| p[0].min(p[1]).min(p[2]) as f32 / 255.0).collect();
    let sombre = minimum(&sombre, l, h, 7);
    let transmission: Vec<f32> = flou(&sombre, l, h, 20).par_iter().map(|&d| (1.0 - 0.9 * d / 0.95).max(0.1)).collect();
    let voile_ms = ms(t);
    // L'image finale, pour que rien ne soit écarté par le compilateur.
    let fini: Vec<u8> = (0..l * h)
        .into_par_iter()
        .flat_map_iter(|i| {
            let y = nette[i];
            let r = ((y + cr[i] - 0.95) / transmission[i] + 0.95).clamp(0.0, 1.0);
            let b = ((y + cb[i] - 0.95) / transmission[i] + 0.95).clamp(0.0, 1.0);
            [(r * 255.0) as u8, (y * 255.0) as u8, (b * 255.0) as u8, 255]
        })
        .collect();
    std::hint::black_box(&fini);
    MesureVoisins { largeur: img.largeur, hauteur: img.hauteur, clarte_ms, texture_ms, nettete_ms, bruit_ms, voile_ms, tous_ms: ms(debut_tous) }
}

// ---- Commandes ----

/// Les images préparées, par largeur demandée.
#[derive(Default)]
pub struct Cache(pub Mutex<Vec<(u32, Image)>>);

fn image_prete(cache: &Cache, largeur: u32) -> Result<Image, String> {
    if let Some((_, img)) = cache.0.lock().unwrap().iter().find(|(l, _)| *l == largeur) {
        return Ok(img.clone());
    }
    let img = charger("photo_apercu_2560.jpg", largeur)?;
    cache.0.lock().unwrap().push((largeur, img.clone()));
    Ok(img)
}

/// Prépare la copie à la taille de l'écran (une fois) ; renvoie sa taille.
#[tauri::command]
pub async fn labo_preparer(largeur: u32, cache: tauri::State<'_, Cache>) -> Result<(u32, u32), String> {
    let img = image_prete(&cache, largeur)?;
    Ok((img.largeur, img.hauteur))
}

/// La copie de base, sans réglages, en RGBA brut (pour comparer avec le shader sur les mêmes
/// pixels) : 8 octets d'en-tête (largeur, hauteur), puis les pixels.
#[tauri::command]
pub async fn labo_source(largeur: u32, cache: tauri::State<'_, Cache>) -> Result<tauri::ipc::Response, String> {
    let img = image_prete(&cache, largeur)?;
    let mut sortie = Vec::with_capacity(8 + img.pixels.len());
    sortie.extend_from_slice(&img.largeur.to_le_bytes());
    sortie.extend_from_slice(&img.hauteur.to_le_bytes());
    sortie.extend_from_slice(&img.pixels);
    Ok(tauri::ipc::Response::new(sortie))
}

/// Une image réglée, en RGBA brut : 16 octets d'en-tête (largeur, hauteur, durée du calcul en
/// microsecondes, réservé), puis les pixels.
#[tauri::command]
pub async fn labo_rendre(largeur: u32, reglages: Reglages, cache: tauri::State<'_, Cache>) -> Result<tauri::ipc::Response, String> {
    let img = image_prete(&cache, largeur)?;
    let t = Instant::now();
    let mut sortie = vec![0u8; 16 + img.pixels.len()];
    rendre(&img, reglages, &mut sortie[16..]);
    let micro = t.elapsed().as_micros() as u32;
    sortie[0..4].copy_from_slice(&img.largeur.to_le_bytes());
    sortie[4..8].copy_from_slice(&img.hauteur.to_le_bytes());
    sortie[8..12].copy_from_slice(&micro.to_le_bytes());
    Ok(tauri::ipc::Response::new(sortie))
}

#[derive(Serialize)]
pub struct MesureOriginal {
    pub decodage_ms: f64,
    pub pixels_ms: f64,
    pub voisins: MesureVoisins,
    pub total_ms: f64,
}

/// Les réglages qui regardent les voisins sur l'aperçu de 2560 px (médiane de trois passes),
/// puis tout le labo sur l'original de 24 Mpx, comme à l'export.
#[tauri::command]
pub async fn labo_voisins(cache: tauri::State<'_, Cache>) -> Result<(MesureVoisins, MesureOriginal), String> {
    let apercu = image_prete(&cache, 0)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut passes: Vec<MesureVoisins> = (0..3).map(|_| mesurer_voisins(&apercu)).collect();
        passes.sort_by(|a, b| a.tous_ms.total_cmp(&b.tous_ms));
        let debut = Instant::now();
        let t = Instant::now();
        let original = charger("photo_24mpx.jpg", 0)?;
        let decodage_ms = ms(t);
        let t = Instant::now();
        let mut sortie = vec![0u8; original.pixels.len()];
        rendre(&original, reglages_essai(), &mut sortie);
        let pixels_ms = ms(t);
        let voisins = mesurer_voisins(&original);
        Ok((passes[1], MesureOriginal { decodage_ms, pixels_ms, voisins, total_ms: ms(debut) }))
    })
    .await
    .map_err(|e| format!("tâche interrompue : {e}"))?
}

/// Des réglages où chaque formule travaille (le mélangeur compris).
pub fn reglages_essai() -> Reglages {
    let mut melangeur = [[0.0; 3]; 8];
    melangeur[1] = [10.0, 20.0, -10.0];
    melangeur[5] = [-15.0, 30.0, -20.0];
    Reglages { exposition: 0.4, contraste: 25.0, hautes_lumieres: -40.0, ombres: 35.0, blancs: 10.0, noirs: -10.0, temperature: 12.0, teinte: -5.0, vibrance: 20.0, saturation: 10.0, melangeur, vignetage: -30.0, grain: 15.0 }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sans_reglage_l_image_ne_change_pas() {
        let p = Prepares::new(Reglages::default());
        for c in [[0u8, 0, 0], [255, 255, 255], [12, 130, 250], [200, 90, 40]] {
            let s = p.pixel(c, 0.0, 0.0, 3, 4);
            for k in 0..3 {
                assert!((s[k] as i32 - c[k] as i32).abs() <= 1, "{c:?} donne {s:?}");
            }
        }
    }

    #[test]
    fn l_exposition_eclaircit_et_le_vignetage_assombrit_les_coins() {
        let r = Reglages { exposition: 1.0, ..Default::default() };
        let s = Prepares::new(r).pixel([100, 100, 100], 0.0, 0.0, 0, 0);
        assert!(s[0] > 125 && s[0] < 140, "{s:?}");
        let r = Reglages { vignetage: -100.0, ..Default::default() };
        let p = Prepares::new(r);
        assert_eq!(p.pixel([150, 150, 150], 0.0, 0.0, 0, 0)[0], 150);
        assert!(p.pixel([150, 150, 150], 1.0, 1.0, 0, 0)[0] < 110);
    }

    #[test]
    fn le_melangeur_ne_touche_pas_les_gris() {
        let mut melangeur = [[100.0; 3]; 8];
        melangeur[0] = [100.0, 100.0, 100.0];
        let p = Prepares::new(Reglages { melangeur, ..Default::default() });
        assert_eq!(p.pixel([128, 128, 128], 0.0, 0.0, 0, 0), [128, 128, 128]);
        let rouge = p.pixel([200, 40, 40], 0.0, 0.0, 0, 0);
        assert_ne!(rouge, [200, 40, 40]);
    }

    #[test]
    fn les_reglages_voisins_tournent_sur_l_apercu() {
        let img = charger("photo_apercu_2560.jpg", 0).expect("commande 4 bis");
        let m = mesurer_voisins(&img);
        eprintln!("{m:?}");
        assert_eq!(img.largeur.max(img.hauteur), 2560);
        assert!(m.tous_ms > 0.0);
        let mut sortie = vec![0u8; img.pixels.len()];
        let t = Instant::now();
        rendre(&img, reglages_essai(), &mut sortie);
        eprintln!("pixels 2560 : {:.1} ms", t.elapsed().as_secs_f64() * 1000.0);
        // Pour regarder le rendu : BANC_IMAGE=/chemin/rendu.ppm cargo test labo
        if let Ok(chemin) = std::env::var("BANC_IMAGE") {
            let mut ppm = format!("P6 {} {} 255\n", img.largeur, img.hauteur).into_bytes();
            for (a, b) in img.pixels.chunks(4).zip(sortie.chunks(4)) {
                let _ = a;
                ppm.extend_from_slice(&b[..3]);
            }
            fs::write(chemin, ppm).unwrap();
        }
    }
}
