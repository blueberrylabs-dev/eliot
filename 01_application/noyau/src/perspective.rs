//! La perspective d'une photo ou d'un clip (étape 5, lot 6) : le visuel à plat (recadrage compris)
//! posé sur quatre coins quelconques. Konva ne sait faire que des transformations affines : la
//! fenêtre dessine la perspective dans un shader (`src/labo/moteurPerspective.ts`), le noyau la
//! refait ici à l'export, depuis l'original, avec les mêmes formules :
//!
//! - l'homographie du carré unité vers les quatre coins (Heckbert, 1989) ;
//! - pour chaque pixel de sortie, le point du visuel à plat (homographie inverse) et sa dérivée,
//!   calculée exactement, d'où la taille d'un pixel de sortie dans le visuel et dans la source ;
//! - le bord du visuel (rectangle aux coins arrondis, en pixels de la page à plat), lissé sur un
//!   pixel de sortie, et la bordure éventuelle, à cheval sur ce bord ;
//! - la source lue en trilinéaire dans une pyramide de demi-tailles (le niveau suit la taille
//!   d'un pixel de sortie dans la source), comme une texture à mipmaps de WebGL.
//!
//! Le tableau commun `src/modele/perspective.attendus.json` vérifie que la fenêtre calcule les
//! mêmes homographies, les mêmes points et les mêmes bords.

use image::{RgbaImage, imageops::FilterType};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};

/// Une homographie, en lignes : x' = (h0 x + h1 y + h2) / (h6 x + h7 y + h8).
pub type Homographie = [f64; 9];

/// L'homographie qui envoie le carré unité sur les coins `q` (haut gauche, haut droit, bas
/// droit, bas gauche). `None` pour un quadrilatère dégénéré.
pub fn homographie(q: &[[f64; 2]; 4]) -> Option<Homographie> {
    let ([x0, y0], [x1, y1], [x2, y2], [x3, y3]) = (q[0], q[1], q[2], q[3]);
    let sx = x0 - x1 + x2 - x3;
    let sy = y0 - y1 + y2 - y3;
    if sx.abs() < 1e-12 && sy.abs() < 1e-12 {
        return Some([x1 - x0, x3 - x0, x0, y1 - y0, y3 - y0, y0, 0.0, 0.0, 1.0]);
    }
    let (dx1, dx2, dy1, dy2) = (x1 - x2, x3 - x2, y1 - y2, y3 - y2);
    let det = dx1 * dy2 - dx2 * dy1;
    if det.abs() < 1e-12 {
        return None;
    }
    let g = (sx * dy2 - dx2 * sy) / det;
    let h = (dx1 * sy - sx * dy1) / det;
    Some([x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1.0])
}

/// L'homographie inverse (matrice adjointe), ramenée à un dernier terme de 1 si possible.
pub fn inverser(m: &Homographie) -> Option<Homographie> {
    let [a, b, c, d, e, f, g, h, i] = *m;
    let ca = e * i - f * h;
    let cb = -(d * i - f * g);
    let cc = d * h - e * g;
    let det = a * ca + b * cb + c * cc;
    if det.abs() < 1e-18 {
        return None;
    }
    let r = [ca, -(b * i - c * h), b * f - c * e, cb, a * i - c * g, -(a * f - c * d), cc, -(a * h - b * g), a * e - b * d];
    let k = if r[8].abs() > 1e-12 { r[8] } else { det };
    Some(r.map(|v| v / k))
}

pub fn projeter(m: &Homographie, x: f64, y: f64) -> [f64; 2] {
    let w = m[6] * x + m[7] * y + m[8];
    [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w]
}

/// `a` après `b`.
pub fn composer(a: &Homographie, b: &Homographie) -> Homographie {
    let mut r = [0.0; 9];
    for i in 0..3 {
        for j in 0..3 {
            r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
        }
    }
    r
}

/// Une matrice de canevas `[a, b, c, d, e, f]` (x' = a x + c y + e) en homographie.
pub fn depuis_affine(m: &[f64; 6]) -> Homographie {
    [m[0], m[2], m[4], m[1], m[3], m[5], 0.0, 0.0, 1.0]
}

/// Le point de `m` en `(x, y)` et sa dérivée : `(point, d/dx, d/dy)`.
pub fn projeter_derivee(m: &Homographie, x: f64, y: f64) -> ([f64; 2], [f64; 2], [f64; 2]) {
    let u = m[0] * x + m[1] * y + m[2];
    let v = m[3] * x + m[4] * y + m[5];
    let w = m[6] * x + m[7] * y + m[8];
    let w2 = w * w;
    (
        [u / w, v / w],
        [(m[0] * w - u * m[6]) / w2, (m[3] * w - v * m[6]) / w2],
        [(m[1] * w - u * m[7]) / w2, (m[4] * w - v * m[7]) / w2],
    )
}

/// La distance signée (négative dedans) au bord d'un rectangle `l` × `h` aux coins arrondis de
/// rayon `r`, au point `(x, y)` (même formule que `distanceRectangleArrondi`).
pub fn distance_rectangle_arrondi(x: f64, y: f64, l: f64, h: f64, r: f64) -> f64 {
    let rr = r.min(l / 2.0).min(h / 2.0).max(0.0);
    let qx = (x - l / 2.0).abs() - (l / 2.0 - rr);
    let qy = (y - h / 2.0).abs() - (h / 2.0 - rr);
    qx.max(0.0).hypot(qy.max(0.0)) + qx.max(qy).min(0.0) - rr
}

/// La bordure d'un visuel en perspective : sa couleur et son épaisseur (pixels de la page à plat).
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct Bordure {
    pub couleur: String,
    pub epaisseur: f64,
}

/// Ce que l'enregistrement de la page dit d'un visuel en perspective (`contexteSvg.ts`) :
/// `plan`, du visuel à plat (carré unité) vers le repère de l'élément ; `source`, du visuel à
/// plat vers l'image entière (fractions de sa largeur et de sa hauteur : le recadrage) ; la taille
/// du visuel à plat, l'arrondi de ses coins et sa bordure, en pixels de la page.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct PerspectiveCalque {
    pub plan: Homographie,
    pub source: [f64; 6],
    pub plat: [f64; 2],
    #[serde(default)]
    pub arrondi: f64,
    #[serde(default)]
    pub bordure: Option<Bordure>,
}

/// Une couleur `#rrggbb`.
fn couleur(texte: &str) -> [u8; 3] {
    let t = texte.trim_start_matches('#');
    let v = |i: usize| t.get(i..i + 2).and_then(|s| u8::from_str_radix(s, 16).ok()).unwrap_or(0);
    [v(0), v(2), v(4)]
}

/// Ce que le pixel de sortie `(x, y)` (centre) voit : sa couverture par le visuel (0 à 1), sa
/// part de bordure (0 à 1), le point de la source (fractions) et le niveau de la pyramide.
/// `sortie_vers_plat` : du pixel de sortie au visuel à plat (carré unité).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Echantillon {
    pub couverture: f64,
    pub bord: f64,
    pub source: [f64; 2],
    /// La taille d'un pixel de sortie dans la source, en pixels de la source.
    pub taille_source: f64,
}

pub fn echantillon(sortie_vers_plat: &Homographie, p: &PerspectiveCalque, x: f64, y: f64, source_l: f64, source_h: f64) -> Echantillon {
    let (f, fx, fy) = projeter_derivee(sortie_vers_plat, x, y);
    let [pl, ph] = p.plat;
    // En pixels de la page à plat.
    let (px, py) = (f[0] * pl, f[1] * ph);
    let gx = (fx[0] * pl).hypot(fx[1] * ph);
    let gy = (fy[0] * pl).hypot(fy[1] * ph);
    let w = (0.5 * (gx + gy)).max(1e-9);
    let s = distance_rectangle_arrondi(px, py, pl, ph, p.arrondi);
    let demi = p.bordure.as_ref().map_or(0.0, |b| b.epaisseur.max(0.0) / 2.0);
    let couverture = (0.5 - (s - demi) / w).clamp(0.0, 1.0);
    let bord = if demi > 0.0 { (0.5 + (s + demi) / w).clamp(0.0, 1.0) } else { 0.0 };
    let m = &p.source;
    let src = [m[0] * f[0] + m[2] * f[1] + m[4], m[1] * f[0] + m[3] * f[1] + m[5]];
    let dsx = [(m[0] * fx[0] + m[2] * fx[1]) * source_l, (m[1] * fx[0] + m[3] * fx[1]) * source_h];
    let dsy = [(m[0] * fy[0] + m[2] * fy[1]) * source_l, (m[1] * fy[0] + m[3] * fy[1]) * source_h];
    let taille_source = dsx[0].hypot(dsx[1]).max(dsy[0].hypot(dsy[1]));
    Echantillon { couverture, bord, source: src, taille_source }
}

/// Une image et ses demi-tailles successives (comme les mipmaps d'une texture).
struct Pyramide {
    niveaux: Vec<RgbaImage>,
}

impl Pyramide {
    fn new(source: RgbaImage) -> Pyramide {
        let mut niveaux = vec![source];
        loop {
            let d = niveaux.last().unwrap();
            let (l, h) = d.dimensions();
            if l <= 1 && h <= 1 {
                break;
            }
            let (nl, nh) = ((l / 2).max(1), (h / 2).max(1));
            let suivant = image::imageops::resize(d, nl, nh, FilterType::Triangle);
            niveaux.push(suivant);
        }
        Pyramide { niveaux }
    }

    /// Bilinéaire au point `(u, v)` (fractions), bords répétés, au niveau `n`.
    fn bilineaire(&self, n: usize, u: f64, v: f64) -> [f64; 4] {
        let img = &self.niveaux[n.min(self.niveaux.len() - 1)];
        let (l, h) = (img.width() as f64, img.height() as f64);
        let x = (u * l - 0.5).clamp(0.0, l - 1.0);
        let y = (v * h - 0.5).clamp(0.0, h - 1.0);
        let (x0, y0) = (x.floor(), y.floor());
        let (tx, ty) = (x - x0, y - y0);
        let (x0, y0) = (x0 as u32, y0 as u32);
        let (x1, y1) = ((x0 + 1).min(img.width() - 1), (y0 + 1).min(img.height() - 1));
        let p = |a: u32, b: u32| img.get_pixel(a, b).0;
        let (a, b, c, d) = (p(x0, y0), p(x1, y0), p(x0, y1), p(x1, y1));
        let mut r = [0.0; 4];
        for k in 0..4 {
            // Prémultiplié : une source transparente ne bave pas sur ses voisins.
            let w = |q: [u8; 4]| q[k] as f64 * if k < 3 { q[3] as f64 / 255.0 } else { 1.0 };
            let haut = w(a) * (1.0 - tx) + w(b) * tx;
            let bas = w(c) * (1.0 - tx) + w(d) * tx;
            r[k] = haut * (1.0 - ty) + bas * ty;
        }
        r
    }

    /// Trilinéaire : entre les deux niveaux qui encadrent `log2(taille)`.
    fn trilineaire(&self, u: f64, v: f64, taille: f64) -> [f64; 4] {
        let lod = taille.max(1e-9).log2().clamp(0.0, (self.niveaux.len() - 1) as f64);
        let n0 = lod.floor() as usize;
        let t = lod - n0 as f64;
        let a = self.bilineaire(n0, u, v);
        if t < 1e-6 {
            return a;
        }
        let b = self.bilineaire(n0 + 1, u, v);
        [a[0] * (1.0 - t) + b[0] * t, a[1] * (1.0 - t) + b[1] * t, a[2] * (1.0 - t) + b[2] * t, a[3] * (1.0 - t) + b[3] * t]
    }
}

/// Le visuel en perspective dans une image de `largeur` × `hauteur` (RGBA, non prémultiplié,
/// transparent hors du visuel). `sortie_vers_plat` : du pixel de sortie (son centre en +0,5) au
/// visuel à plat.
pub fn deformer(source: &RgbaImage, p: &PerspectiveCalque, sortie_vers_plat: &Homographie, largeur: u32, hauteur: u32) -> RgbaImage {
    let (sl, sh) = (source.width() as f64, source.height() as f64);
    // La source n'a pas à être plus fine que le pixel de sortie le plus fin qui la lit : les
    // niveaux qu'aucun pixel ne lirait ne sont pas calculés.
    let mut plus_fin = f64::INFINITY;
    for (x, y) in [(0.0, 0.0), (largeur as f64, 0.0), (largeur as f64, hauteur as f64), (0.0, hauteur as f64), (largeur as f64 / 2.0, hauteur as f64 / 2.0)] {
        plus_fin = plus_fin.min(echantillon(sortie_vers_plat, p, x, y, sl, sh).taille_source);
    }
    let saut = if plus_fin.is_finite() && plus_fin > 2.0 { (plus_fin.log2().floor() as u32).min(10) } else { 0 };
    let base = if saut > 0 {
        let k = 1u32 << saut;
        image::imageops::resize(source, (source.width() / k).max(1), (source.height() / k).max(1), FilterType::Triangle)
    } else {
        source.clone()
    };
    let echelle = (1u32 << saut) as f64;
    let pyramide = Pyramide::new(base);
    let bordure = p.bordure.as_ref().map(|b| couleur(&b.couleur));
    let mut sortie = RgbaImage::new(largeur, hauteur);
    sortie.par_chunks_mut(largeur as usize * 4).enumerate().for_each(|(y, ligne)| {
        for (x, px) in ligne.chunks_exact_mut(4).enumerate() {
            let e = echantillon(sortie_vers_plat, p, x as f64 + 0.5, y as f64 + 0.5, sl, sh);
            if e.couverture <= 0.0 {
                continue;
            }
            let c = pyramide.trilineaire(e.source[0], e.source[1], e.taille_source / echelle);
            // Prémultiplié : l'image, puis la bordure par-dessus, puis la couverture du bord.
            let mut r = [c[0], c[1], c[2], c[3]];
            if let Some(b) = bordure {
                let k = e.bord;
                r = [r[0] * (1.0 - k) + b[0] as f64 * k, r[1] * (1.0 - k) + b[1] as f64 * k, r[2] * (1.0 - k) + b[2] as f64 * k, r[3] * (1.0 - k) + 255.0 * k];
            }
            let a = r[3] * e.couverture;
            if a <= 0.0 {
                continue;
            }
            let k = e.couverture / (a / 255.0);
            px[0] = (r[0] * k).round().clamp(0.0, 255.0) as u8;
            px[1] = (r[1] * k).round().clamp(0.0, 255.0) as u8;
            px[2] = (r[2] * k).round().clamp(0.0, 255.0) as u8;
            px[3] = a.round().clamp(0.0, 255.0) as u8;
        }
    });
    sortie
}

/// La boîte (dans le repère de l'élément) du visuel en perspective, bordure comprise.
pub fn boite(p: &PerspectiveCalque) -> [f64; 4] {
    let demi = p.bordure.as_ref().map_or(0.0, |b| b.epaisseur.max(0.0) / 2.0);
    let (ex, ey) = (demi / p.plat[0].max(1e-9), demi / p.plat[1].max(1e-9));
    let coins = [[-ex, -ey], [1.0 + ex, -ey], [1.0 + ex, 1.0 + ey], [-ex, 1.0 + ey]].map(|[u, v]| projeter(&p.plan, u, v));
    let xs = coins.map(|c| c[0]);
    let ys = coins.map(|c| c[1]);
    [xs.iter().cloned().fold(f64::INFINITY, f64::min), ys.iter().cloned().fold(f64::INFINITY, f64::min), xs.iter().cloned().fold(f64::NEG_INFINITY, f64::max), ys.iter().cloned().fold(f64::NEG_INFINITY, f64::max)]
}

/// Combien de pixels de la source tombent dans un pixel de la page, au plus, sur le visuel :
/// la finesse utile d'un rendu (au-delà, on n'ajoute que du flou).
pub fn densite_source(p: &PerspectiveCalque, source_l: f64, source_h: f64) -> f64 {
    let Some(inv) = inverser(&p.plan) else { return 1.0 };
    let mut d: f64 = 0.0;
    for [u, v] in [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], [0.5, 0.5]] {
        let q = projeter(&p.plan, u, v);
        d = d.max(echantillon(&inv, p, q[0], q[1], source_l, source_h).taille_source);
    }
    d.max(1e-6)
}

/// Le rendu du visuel à `finesse` pixels par pixel de la page : la boîte `[x0, y0, x1, y1]`
/// (repère de l'élément) que couvre l'image, et sa taille en pixels. `None` au-delà de 16 384
/// pixels de côté.
pub fn cadre(p: &PerspectiveCalque, finesse: f64) -> Option<([f64; 4], u32, u32)> {
    let b = boite(p);
    if !b.iter().all(|v| v.is_finite()) || !(finesse > 0.0) {
        return None;
    }
    let (l, h) = (((b[2] - b[0]) * finesse).ceil().max(1.0), ((b[3] - b[1]) * finesse).ceil().max(1.0));
    if l > 16384.0 || h > 16384.0 {
        return None;
    }
    Some(([b[0], b[1], b[0] + l / finesse, b[1] + h / finesse], l as u32, h as u32))
}

/// Le visuel rendu à `finesse` pixels par pixel de la page, sur sa boîte (repère de l'élément) :
/// l'image et la boîte `[x0, y0, x1, y1]` qu'elle couvre (`cadre`).
pub fn rendre(source: &RgbaImage, p: &PerspectiveCalque, finesse: f64) -> Option<(RgbaImage, [f64; 4])> {
    let (b, l, h) = cadre(p, finesse)?;
    let inv = inverser(&p.plan)?;
    // Du pixel de sortie au repère de l'élément, puis au visuel à plat.
    let vers_element = [1.0 / finesse, 0.0, b[0], 0.0, 1.0 / finesse, b[1], 0.0, 0.0, 1.0];
    let sortie_vers_plat = composer(&inv, &vers_element);
    Some((deformer(source, p, &sortie_vers_plat, l, h), b))
}

/// La part de l'original à décoder pour un rendu à `finesse` : assez pour qu'un pixel du rendu
/// lise au plus un pixel de la source là où elle est la plus serrée, jamais plus que l'original.
pub fn reduction_source(p: &PerspectiveCalque, source_l: f64, source_h: f64, finesse: f64) -> f64 {
    (finesse / densite_source(p, source_l, source_h)).clamp(1e-3, 1.0)
}

/// Un damier rouge et bleu, pour les essais.
#[cfg(test)]
fn damier(l: u32, h: u32, case: u32) -> RgbaImage {
    RgbaImage::from_fn(l, h, |x, y| if ((x / case) + (y / case)) % 2 == 0 { image::Rgba([240, 40, 40, 255]) } else { image::Rgba([20, 20, 220, 255]) })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgba;
    use serde_json::{Value, json};

    const ATTENDUS: &str = include_str!("../../src/modele/perspective.attendus.json");

    fn quads() -> Vec<(&'static str, [[f64; 2]; 4])> {
        vec![
            ("carré", [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]),
            ("parallélogramme", [[10.0, 20.0], [310.0, 60.0], [330.0, 260.0], [30.0, 220.0]]),
            ("écran incliné", [[100.0, 80.0], [520.0, 30.0], [540.0, 420.0], [90.0, 360.0]]),
            ("posé à plat", [[160.0, 0.0], [840.0, 0.0], [1000.0, 600.0], [0.0, 600.0]]),
            ("face de boîte", [[0.0, 50.0], [400.0, 0.0], [420.0, 500.0], [10.0, 430.0]]),
        ]
    }

    fn calculer() -> Value {
        let cas: Vec<Value> = quads()
            .into_iter()
            .map(|(nom, q)| {
                let h = homographie(&q).unwrap();
                let inv = inverser(&h).unwrap();
                let points: Vec<Value> = [[0.25, 0.25], [0.5, 0.5], [0.9, 0.1], [0.33, 0.8]]
                    .iter()
                    .map(|&[u, v]| {
                        let p = projeter(&h, u, v);
                        json!({ "plat": [u, v], "page": p, "retour": projeter(&inv, p[0], p[1]) })
                    })
                    .collect();
                let pc = PerspectiveCalque { plan: h, source: [1.0, 0.0, 0.0, 1.0, 0.0, 0.0], plat: [300.0, 200.0], arrondi: 24.0, bordure: Some(Bordure { couleur: "#ffffff".into(), epaisseur: 6.0 }) };
                let echantillons: Vec<Value> = [[0.5, 0.5], [0.0, 0.5], [0.02, 0.02], [1.01, 0.4], [0.5, -0.005]]
                    .iter()
                    .map(|&[u, v]| {
                        let p = projeter(&h, u, v);
                        let e = echantillon(&inv, &pc, p[0], p[1], 1200.0, 800.0);
                        json!({ "page": p, "couverture": e.couverture, "bord": e.bord, "source": e.source, "tailleSource": e.taille_source })
                    })
                    .collect();
                json!({ "nom": nom, "coins": q, "homographie": h, "inverse": inv, "points": points, "echantillons": echantillons })
            })
            .collect();
        json!({ "note": "Calculé par le noyau (perspective.rs, cargo test avec ELIOT_ECRIRE_ATTENDUS=1) ; relu par la fenêtre.", "plat": [300.0, 200.0], "arrondi": 24.0, "bordure": 6.0, "source": [1200.0, 800.0], "cas": cas })
    }

    #[test]
    fn le_tableau_commun_est_celui_du_noyau() {
        let calcule = calculer();
        if std::env::var("ELIOT_ECRIRE_ATTENDUS").is_ok() {
            let chemin = concat!(env!("CARGO_MANIFEST_DIR"), "/../src/modele/perspective.attendus.json");
            std::fs::write(chemin, serde_json::to_string_pretty(&calcule).unwrap() + "\n").unwrap();
            return;
        }
        let attendu: Value = serde_json::from_str(ATTENDUS).unwrap();
        // À un milliardième près : la lecture du JSON arrondit le dernier chiffre.
        fn proches(a: &Value, b: &Value, chemin: &str) {
            match (a, b) {
                (Value::Number(x), Value::Number(y)) => {
                    let (x, y) = (x.as_f64().unwrap(), y.as_f64().unwrap());
                    assert!((x - y).abs() <= 1e-9 * (1.0 + x.abs()), "{chemin} : {x} au lieu de {y}");
                }
                (Value::Array(x), Value::Array(y)) => {
                    assert_eq!(x.len(), y.len(), "{chemin}");
                    for (i, (u, v)) in x.iter().zip(y).enumerate() {
                        proches(u, v, &format!("{chemin}[{i}]"));
                    }
                }
                (Value::Object(x), Value::Object(y)) => {
                    assert_eq!(x.len(), y.len(), "{chemin}");
                    for (k, u) in x {
                        proches(u, &y[k], &format!("{chemin}.{k}"));
                    }
                }
                _ => assert_eq!(a, b, "{chemin}"),
            }
        }
        proches(&attendu, &calcule, "");
    }

    #[test]
    fn les_coins_vont_ou_il_faut() {
        for (nom, q) in quads() {
            let h = homographie(&q).unwrap();
            for (k, [u, v]) in [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]].into_iter().enumerate() {
                let p = projeter(&h, u, v);
                assert!((p[0] - q[k][0]).abs() < 1e-9 && (p[1] - q[k][1]).abs() < 1e-9, "{nom}, coin {k} : {p:?}");
            }
            let inv = inverser(&h).unwrap();
            let r = projeter(&inv, q[2][0], q[2][1]);
            assert!((r[0] - 1.0).abs() < 1e-9 && (r[1] - 1.0).abs() < 1e-9, "{nom} : {r:?}");
            // Une droite reste droite : le milieu d'un côté du carré tombe sur le côté du quadrilatère.
            let m = projeter(&h, 0.5, 0.0);
            let cross = (q[1][0] - q[0][0]) * (m[1] - q[0][1]) - (q[1][1] - q[0][1]) * (m[0] - q[0][0]);
            assert!(cross.abs() < 1e-6, "{nom} : {cross}");
        }
        assert_eq!(homographie(&[[0.0, 0.0], [1.0, 1.0], [2.0, 2.0], [3.0, 3.0]]), None);
    }

    #[test]
    fn un_damier_pose_en_perspective() {
        // Un damier de 8 × 8 cases, posé sur un trapèze : chaque case garde sa couleur à
        // l'endroit où l'homographie l'envoie, et rien ne déborde du quadrilatère.
        let src = damier(800, 800, 100);
        let q = [[60.0, 40.0], [440.0, 10.0], [470.0, 380.0], [30.0, 330.0]];
        let p = PerspectiveCalque { plan: homographie(&q).unwrap(), source: [1.0, 0.0, 0.0, 1.0, 0.0, 0.0], plat: [400.0, 300.0], arrondi: 0.0, bordure: None };
        let (img, b) = rendre(&src, &p, 1.0).unwrap();
        for (i, j) in [(0, 0), (3, 4), (7, 7), (5, 2)] {
            let (u, v) = ((i as f64 + 0.5) / 8.0, (j as f64 + 0.5) / 8.0);
            let pt = projeter(&p.plan, u, v);
            let c = img.get_pixel((pt[0] - b[0]) as u32, (pt[1] - b[1]) as u32).0;
            let rouge = (i + j) % 2 == 0;
            assert!(if rouge { c[0] > 200 && c[2] < 80 } else { c[2] > 180 && c[0] < 60 }, "case ({i}, {j}) : {c:?}");
            assert_eq!(c[3], 255);
        }
        // Hors du quadrilatère : transparent ; sur son bord : à moitié.
        assert_eq!(img.get_pixel(2, 2).0[3], 0);
        let bord = projeter(&p.plan, 0.5, 0.0);
        let a = img.get_pixel((bord[0] - b[0]).floor() as u32, (bord[1] - b[1]).floor() as u32).0[3];
        assert!((60..=200).contains(&a), "bord : {a}");
    }

    #[test]
    fn coins_arrondis_et_bordure_suivent_la_perspective() {
        let src = RgbaImage::from_pixel(400, 300, Rgba([30, 30, 30, 255]));
        let q = [[0.0, 20.0], [400.0, 0.0], [400.0, 300.0], [0.0, 280.0]];
        let p = PerspectiveCalque { plan: homographie(&q).unwrap(), source: [1.0, 0.0, 0.0, 1.0, 0.0, 0.0], plat: [400.0, 290.0], arrondi: 40.0, bordure: Some(Bordure { couleur: "#ff0000".into(), epaisseur: 8.0 }) };
        let (img, b) = rendre(&src, &p, 1.0).unwrap();
        let lire = |u: f64, v: f64| {
            let pt = projeter(&p.plan, u, v);
            img.get_pixel(((pt[0] - b[0]).round() as u32).min(img.width() - 1), ((pt[1] - b[1]).round() as u32).min(img.height() - 1)).0
        };
        // Le coin du carré, hors de l'arrondi : vide ; le milieu : l'image ; le bord : rouge.
        assert!(lire(0.002, 0.002)[3] < 30, "{:?}", lire(0.002, 0.002));
        assert_eq!(lire(0.5, 0.5), [30, 30, 30, 255]);
        let r = lire(0.5, 0.0);
        assert!(r[0] > 200 && r[1] < 60, "bordure : {r:?}");
    }
}
