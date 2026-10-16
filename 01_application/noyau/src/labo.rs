//! Le labo photo (étape 5, lot 2) : les réglages d'une photo façon Lightroom, valeurs du
//! document (règle 13 : l'original n'est jamais touché), calculés en nombres à virgule, en
//! lumière linéaire, dans l'ordre fixe du BRIEF (§ 6, « Ce que Eliot reprend de Lightroom ») :
//!
//! 1. balance des blancs (température, teinte) et exposition, des gains par canal ;
//! 2. tonalités (contraste, hautes lumières, ombres, blancs, noirs), sur la luminance perçue ;
//! 3. (courbe des tonalités : lot 3) ;
//! 4. couleurs : saturation, vibrance, puis le mélangeur de huit couleurs ;
//! 5. détail : réduction du bruit, netteté ;
//! 6. effets : texture, clarté, correction du voile, puis vignetage et grain.
//!
//! Les étapes 1, 2, 4 et la fin de la 6 (vignetage, grain) ne regardent qu'un pixel : la
//! fenêtre les refait dans un shader WebGL pendant qu'on tire un curseur (`src/labo/shader.ts`,
//! mêmes formules, ligne pour ligne, contrôlées par le tableau commun
//! `src/modele/labo.attendus.json`). Les autres regardent les pixels voisins : le noyau les
//! calcule au relâchement du curseur, sur l'aperçu de 2560 px, et à l'export, depuis l'original.
//! Leurs rayons comptent en pixels d'une image de 2560 px de grand côté et suivent la taille de
//! l'image : l'aperçu et l'original donnent le même dessin.

use rayon::prelude::*;
use serde::{Deserialize, Serialize};

/// Les huit couleurs du mélangeur, dans l'ordre du cercle des teintes.
pub const COULEURS: [&str; 8] = ["rouge", "orange", "jaune", "vert", "cyan", "bleu", "violet", "magenta"];
/// Le centre de chacune, en degrés de teinte.
const CENTRES: [f32; 8] = [0.0, 30.0, 60.0, 120.0, 180.0, 240.0, 270.0, 300.0];
const LUMA: [f32; 3] = [0.2126, 0.7152, 0.0722];
/// La taille de référence des rayons et du grain : le grand côté de l'aperçu.
pub const COTE_REFERENCE: f32 = 2560.0;

/// Une couleur du mélangeur : teinte, saturation et luminance, de -100 à +100.
#[derive(Debug, Clone, Copy, Default, PartialEq, Deserialize, Serialize)]
#[serde(default)]
pub struct Couleur {
    pub teinte: f32,
    pub saturation: f32,
    pub luminance: f32,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Deserialize, Serialize)]
#[serde(default)]
pub struct Melangeur {
    pub rouge: Couleur,
    pub orange: Couleur,
    pub jaune: Couleur,
    pub vert: Couleur,
    pub cyan: Couleur,
    pub bleu: Couleur,
    pub violet: Couleur,
    pub magenta: Couleur,
}

impl Melangeur {
    fn tableau(&self) -> [[f32; 3]; 8] {
        [self.rouge, self.orange, self.jaune, self.vert, self.cyan, self.bleu, self.violet, self.magenta].map(|c| [c.teinte, c.saturation, c.luminance])
    }
}

/// Les réglages d'une photo, tels que le document les garde (seulement ceux qui ne sont pas à
/// zéro ; un absent vaut zéro). Exposition en IL de -5 à +5 ; réduction du bruit et grain de 0 à
/// 100 ; les autres de -100 à +100.
#[derive(Debug, Clone, Copy, Default, PartialEq, Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Reglages {
    pub temperature: f32,
    pub teinte: f32,
    pub exposition: f32,
    pub contraste: f32,
    pub hautes_lumieres: f32,
    pub ombres: f32,
    pub blancs: f32,
    pub noirs: f32,
    pub vibrance: f32,
    pub saturation: f32,
    pub melangeur: Melangeur,
    pub texture: f32,
    pub clarte: f32,
    pub voile: f32,
    pub vignetage: f32,
    pub grain: f32,
    pub nettete: f32,
    pub bruit: f32,
}

fn borne(v: f32, a: f32, b: f32) -> f32 {
    if v.is_finite() { v.clamp(a, b) } else { 0.0 }
}

impl Reglages {
    /// Chaque valeur ramenée dans sa plage (un document abîmé ne casse rien).
    pub fn bornes(&self) -> Reglages {
        let c = |v: f32| borne(v, -100.0, 100.0);
        let p = |v: f32| borne(v, 0.0, 100.0);
        let m = |x: Couleur| Couleur { teinte: c(x.teinte), saturation: c(x.saturation), luminance: c(x.luminance) };
        let g = &self.melangeur;
        Reglages {
            temperature: c(self.temperature),
            teinte: c(self.teinte),
            exposition: borne(self.exposition, -5.0, 5.0),
            contraste: c(self.contraste),
            hautes_lumieres: c(self.hautes_lumieres),
            ombres: c(self.ombres),
            blancs: c(self.blancs),
            noirs: c(self.noirs),
            vibrance: c(self.vibrance),
            saturation: c(self.saturation),
            melangeur: Melangeur { rouge: m(g.rouge), orange: m(g.orange), jaune: m(g.jaune), vert: m(g.vert), cyan: m(g.cyan), bleu: m(g.bleu), violet: m(g.violet), magenta: m(g.magenta) },
            texture: c(self.texture),
            clarte: c(self.clarte),
            voile: c(self.voile),
            vignetage: c(self.vignetage),
            grain: p(self.grain),
            nettete: c(self.nettete),
            bruit: p(self.bruit),
        }
    }

    /// Rien à faire : l'image sort telle qu'elle est entrée.
    pub fn neutres(&self) -> bool {
        *self == Reglages::default()
    }

    /// Des réglages qui regardent les pixels voisins (calculés par le noyau seulement).
    pub fn voisins(&self) -> bool {
        self.bruit != 0.0 || self.nettete != 0.0 || self.texture != 0.0 || self.clarte != 0.0 || self.voile != 0.0
    }
}

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

/// Le bruit du grain au point `(gx, gy)` de la grille de référence, de -0,5 à 0,5 : la valeur
/// de chaque nœud vient du hachage, entre les nœuds elle se lit en ligne droite.
fn bruit_valeur(gx: f32, gy: f32) -> f32 {
    let (x0, y0) = (gx.floor(), gy.floor());
    let (fx, fy) = (gx - x0, gy - y0);
    let (ix, iy) = (x0.max(0.0) as u32, y0.max(0.0) as u32);
    let h = |x: u32, y: u32| (hachage(x, y) & 0xffff) as f32 / 65535.0 - 0.5;
    let haut = h(ix, iy) * (1.0 - fx) + h(ix + 1, iy) * fx;
    let bas = h(ix, iy + 1) * (1.0 - fx) + h(ix + 1, iy + 1) * fx;
    haut * (1.0 - fy) + bas * fy
}

const PAS_SORTIE: usize = 4096;

/// Ce qui ne change pas d'un pixel à l'autre, calculé une fois par image.
pub struct Prepares {
    entree: [f32; 256],
    sortie: Vec<f32>,
    gains: [f32; 3],
    r: Reglages,
    melangeur: [[f32; 3]; 8],
    melange: bool,
    /// Le grand côté de l'image (vignetage et grain suivent sa taille).
    largeur: u32,
    hauteur: u32,
    echelle_grain: f32,
}

impl Prepares {
    pub fn new(r: &Reglages, largeur: u32, hauteur: u32) -> Self {
        let r = r.bornes();
        let mut entree = [0.0; 256];
        for (i, v) in entree.iter_mut().enumerate() {
            *v = srgb_vers_lineaire(i as f32 / 255.0);
        }
        let sortie = (0..=PAS_SORTIE).map(|i| lineaire_vers_srgb(i as f32 / PAS_SORTIE as f32)).collect();
        let kt = r.temperature / 100.0 * 0.5;
        let ku = r.teinte / 100.0 * 0.3;
        let e = r.exposition.exp2();
        let gains = [kt.exp2() * e, (-ku).exp2() * e, (-kt).exp2() * e];
        let melangeur = r.melangeur.tableau();
        let melange = melangeur.iter().flatten().any(|v| *v != 0.0);
        let cote = largeur.max(hauteur).max(1) as f32;
        Prepares { entree, sortie, gains, r, melangeur, melange, largeur, hauteur, echelle_grain: COTE_REFERENCE / cote }
    }

    pub fn vers_lineaire(&self, c: u8) -> f32 {
        self.entree[c as usize]
    }

    /// Du linéaire au sRGB sur 8 bits, par une table de 4096 pas lue en ligne droite.
    pub fn vers_srgb8(&self, l: f32) -> u8 {
        let x = l.clamp(0.0, 1.0) * PAS_SORTIE as f32;
        let i = (x as usize).min(PAS_SORTIE - 1);
        let t = x - i as f32;
        ((self.sortie[i] * (1.0 - t) + self.sortie[i + 1] * t) * 255.0).round() as u8
    }

    /// Étapes 1, 2 et 4 : balance des blancs, exposition, tonalités, couleurs. Lumière linéaire
    /// en entrée et en sortie (la sortie peut dépasser 1).
    pub fn reglages_pixel(&self, c: [f32; 3]) -> [f32; 3] {
        let r = &self.r;
        let mut l = [c[0] * self.gains[0], c[1] * self.gains[1], c[2] * self.gains[2]];
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
            let m = |c: usize| self.melangeur[i][c] * (1.0 - t) + self.melangeur[suivant][c] * t;
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
        [l[0].max(0.0), l[1].max(0.0), l[2].max(0.0)]
    }

    /// Fin de l'étape 6 : vignetage et grain, au pixel `(x, y)` de l'image.
    pub fn effets_pixel(&self, l: [f32; 3], x: u32, y: u32) -> [f32; 3] {
        let r = &self.r;
        let mut l = l;
        if r.vignetage != 0.0 {
            let u = (x as f32 + 0.5) / self.largeur as f32 * 2.0 - 1.0;
            let v = (y as f32 + 0.5) / self.hauteur as f32 * 2.0 - 1.0;
            let d = ((u * u + v * v) / 2.0).sqrt();
            let f = (r.vignetage / 100.0 * 1.5 * smoothstep(0.35, 1.0, d)).exp2();
            l = [l[0] * f, l[1] * f, l[2] * f];
        }
        if r.grain != 0.0 {
            let gx = (x as f32 + 0.5) * self.echelle_grain - 0.5;
            let gy = (y as f32 + 0.5) * self.echelle_grain - 0.5;
            let f = 1.0 + r.grain / 100.0 * 0.25 * bruit_valeur(gx, gy) * 2.0;
            l = [l[0] * f, l[1] * f, l[2] * f];
        }
        l
    }

    /// Un pixel, réglages d'un pixel seulement (le tableau commun avec le shader).
    pub fn pixel(&self, c: [u8; 3], x: u32, y: u32) -> [u8; 3] {
        let l = self.reglages_pixel([self.vers_lineaire(c[0]), self.vers_lineaire(c[1]), self.vers_lineaire(c[2])]);
        let l = self.effets_pixel(l, x, y);
        [self.vers_srgb8(l[0]), self.vers_srgb8(l[1]), self.vers_srgb8(l[2])]
    }
}

// ----------------------------------------------------------------------------------------
// Les réglages qui regardent les voisins
// ----------------------------------------------------------------------------------------

/// Flou de boîte séparable de rayon `r`, sur tous les cœurs, bords répétés.
fn flou_boite(plan: &[f32], l: usize, h: usize, r: usize) -> Vec<f32> {
    let n = (2 * r + 1) as f32;
    let mut tmp = vec![0.0f32; plan.len()];
    tmp.par_chunks_mut(l).zip(plan.par_chunks(l)).for_each(|(sortie, ligne)| {
        let lire = |i: isize| ligne[i.clamp(0, l as isize - 1) as usize];
        let mut somme: f32 = (-(r as isize)..=r as isize).map(lire).sum();
        for (x, s) in sortie.iter_mut().enumerate() {
            *s = somme / n;
            somme += lire(x as isize + r as isize + 1) - lire(x as isize - r as isize);
        }
    });
    // Passe verticale, par bandes de colonnes pour garder la mémoire proche.
    let mut sortie = vec![0.0f32; plan.len()];
    let bande = 64;
    let blocs: Vec<(usize, Vec<f32>)> = (0..l)
        .step_by(bande)
        .collect::<Vec<_>>()
        .into_par_iter()
        .map(|x0| {
            let w = bande.min(l - x0);
            let lire = |y: isize, k: usize| tmp[y.clamp(0, h as isize - 1) as usize * l + x0 + k];
            let mut bloc = vec![0.0f32; w * h];
            let mut somme = vec![0.0f32; w];
            for (k, s) in somme.iter_mut().enumerate() {
                *s = (-(r as isize)..=r as isize).map(|y| lire(y, k)).sum();
            }
            for y in 0..h {
                for k in 0..w {
                    bloc[y * w + k] = somme[k] / n;
                    somme[k] += lire(y as isize + r as isize + 1, k) - lire(y as isize - r as isize, k);
                }
            }
            (x0, bloc)
        })
        .collect();
    for (x0, bloc) in blocs {
        let w = bande.min(l - x0);
        for y in 0..h {
            sortie[y * l + x0..y * l + x0 + w].copy_from_slice(&bloc[y * w..(y + 1) * w]);
        }
    }
    sortie
}

/// Flou proche d'un flou gaussien : trois flous de boîte.
fn flou(plan: &[f32], l: usize, h: usize, r: usize) -> Vec<f32> {
    let a = flou_boite(plan, l, h, r);
    let b = flou_boite(&a, l, h, r);
    flou_boite(&b, l, h, r)
}

/// Minimum sur un carré de rayon `r`, séparable.
fn minimum(plan: &[f32], l: usize, h: usize, r: usize) -> Vec<f32> {
    let mut tmp = vec![0.0f32; plan.len()];
    tmp.par_chunks_mut(l).zip(plan.par_chunks(l)).for_each(|(sortie, ligne)| {
        for (x, s) in sortie.iter_mut().enumerate() {
            let (a, b) = (x.saturating_sub(r), (x + r).min(l - 1));
            *s = ligne[a..=b].iter().copied().fold(f32::MAX, f32::min);
        }
    });
    let mut sortie = vec![0.0f32; plan.len()];
    sortie.par_chunks_mut(l).enumerate().for_each(|(y, ligne)| {
        let (a, b) = (y.saturating_sub(r), (y + r).min(h - 1));
        for (x, s) in ligne.iter_mut().enumerate() {
            let mut m = f32::MAX;
            for yy in a..=b {
                m = m.min(tmp[yy * l + x]);
            }
            *s = m;
        }
    });
    sortie
}

/// Une fonction de [0, 1] dans [0, 1] lue dans une table de 4096 pas, en ligne droite : les
/// puissances 2,2 coûtent cher sur des millions de pixels.
struct Table(Vec<f32>);

impl Table {
    fn new(f: impl Fn(f32) -> f32) -> Self {
        Table((0..=PAS_SORTIE).map(|i| f(i as f32 / PAS_SORTIE as f32)).collect())
    }

    fn lire(&self, v: f32) -> f32 {
        let x = v.clamp(0.0, 1.0) * PAS_SORTIE as f32;
        let i = (x as usize).min(PAS_SORTIE - 1);
        let t = x - i as f32;
        self.0[i] * (1.0 - t) + self.0[i + 1] * t
    }
}

/// Étapes 5 et 6 (sans le vignetage ni le grain), sur une image en lumière linéaire, RGB à la
/// suite. Les retouches se font sur la luminance perçue (la racine 2,2 de la luminance) ;
/// les écarts de couleur à cette luminance sont gardés, sauf par la réduction du bruit.
fn reglages_voisins(lin: &mut [f32], l: usize, h: usize, r: &Reglages) {
    let k = l.max(h) as f32 / COTE_REFERENCE;
    let rayon = |base: f32| ((base * k).round() as usize).max(1);
    let n = l * h;
    let percu = Table::new(|v| v.powf(1.0 / 2.2));
    let lineaire = Table::new(|v| v.powf(2.2));
    // Perçu : q par canal, p pour la luminance, o pour l'écart de chaque canal à p.
    let q: Vec<[f32; 3]> = lin.par_chunks(3).map(|c| [percu.lire(c[0]), percu.lire(c[1]), percu.lire(c[2])]).collect();
    let mut p: Vec<f32> = lin.par_chunks(3).map(|c| percu.lire(c[0].min(1.0) * LUMA[0] + c[1].min(1.0) * LUMA[1] + c[2].min(1.0) * LUMA[2])).collect();
    let mut o_r: Vec<f32> = (0..n).into_par_iter().map(|i| q[i][0] - p[i]).collect();
    let mut o_g: Vec<f32> = (0..n).into_par_iter().map(|i| q[i][1] - p[i]).collect();
    let mut o_b: Vec<f32> = (0..n).into_par_iter().map(|i| q[i][2] - p[i]).collect();
    drop(q);
    // Détail : réduction du bruit (couleur, puis luminance en gardant les bords), netteté.
    if r.bruit > 0.0 {
        let s = r.bruit / 100.0;
        let rc = rayon(3.0);
        let (fr, (fg, fb)) = rayon::join(|| flou(&o_r, l, h, rc), || rayon::join(|| flou(&o_g, l, h, rc), || flou(&o_b, l, h, rc)));
        o_r.par_iter_mut().zip(fr.par_iter()).for_each(|(o, f)| *o += (f - *o) * s);
        o_g.par_iter_mut().zip(fg.par_iter()).for_each(|(o, f)| *o += (f - *o) * s);
        o_b.par_iter_mut().zip(fb.par_iter()).for_each(|(o, f)| *o += (f - *o) * s);
        let b = flou(&p, l, h, rayon(1.5));
        p.par_iter_mut().zip(b.par_iter()).for_each(|(v, f)| {
            let d = (*v - f) / 0.06;
            *v += (f - *v) * 0.9 * s / (1.0 + d * d);
        });
    }
    if r.nettete != 0.0 {
        let s = r.nettete / 100.0;
        let a = if s > 0.0 { 1.6 * s } else { s };
        let b = flou(&p, l, h, rayon(1.0));
        p.par_iter_mut().zip(b.par_iter()).for_each(|(v, f)| *v += (*v - f) * a);
    }
    // Effets : texture (détails moyens), clarté (contraste des tons moyens, à grande échelle).
    if r.texture != 0.0 {
        let a = r.texture / 100.0 * 0.9;
        let b = flou(&p, l, h, rayon(5.0));
        p.par_iter_mut().zip(b.par_iter()).for_each(|(v, f)| *v += (*v - f) * a);
    }
    if r.clarte != 0.0 {
        let a = r.clarte / 100.0 * 0.8;
        let b = flou(&p, l, h, rayon(24.0));
        p.par_iter_mut().zip(b.par_iter()).for_each(|(v, f)| {
            let m = (4.0 * *v * (1.0 - *v)).clamp(0.0, 1.0);
            *v += (*v - f) * a * m;
        });
    }
    let mut q: Vec<[f32; 3]> = (0..n).into_par_iter().map(|i| [p[i] + o_r[i], p[i] + o_g[i], p[i] + o_b[i]]).collect();
    // Correction du voile : le canal sombre dit l'épaisseur du voile (Kaiming He, 2009) ; un
    // réglage négatif en ajoute.
    if r.voile != 0.0 {
        let s = r.voile / 100.0;
        let sombre: Vec<f32> = q.par_iter().map(|c| c[0].min(c[1]).min(c[2]).clamp(0.0, 1.0)).collect();
        // L'atmosphère : le canal sombre des 0,5 % de pixels les plus voilés.
        let mut compte = vec![0usize; 1024];
        for v in &sombre {
            compte[((v * 1023.0) as usize).min(1023)] += 1;
        }
        let mut cumul = 0usize;
        let mut haut = 1023;
        for i in (0..1024).rev() {
            cumul += compte[i];
            if cumul as f32 >= n as f32 * 0.005 {
                haut = i;
                break;
            }
        }
        let atmosphere = (haut as f32 / 1023.0).clamp(0.6, 1.0);
        if s > 0.0 {
            let epaisseur = flou(&minimum(&sombre, l, h, rayon(7.0)), l, h, rayon(16.0));
            q.par_iter_mut().zip(epaisseur.par_iter()).for_each(|(c, e)| {
                let t = (1.0 - 0.9 * s * e / atmosphere).max(0.15);
                for v in c.iter_mut() {
                    *v = (*v - atmosphere) / t + atmosphere;
                }
            });
        } else {
            let a = -s * 0.6;
            q.par_iter_mut().for_each(|c| {
                for v in c.iter_mut() {
                    *v += (atmosphere - *v) * a;
                }
            });
        }
    }
    lin.par_chunks_mut(3).zip(q.par_iter()).for_each(|(c, v)| {
        for i in 0..3 {
            c[i] = lineaire.lire(v[i]);
        }
    });
}

/// Applique les réglages à une image RGBA sur 8 bits (non prémultipliée ; l'alpha ne change
/// pas). `effets` : avec le vignetage et le grain (l'export) ou sans (la base de l'aperçu en
/// direct, que le shader complète).
pub fn appliquer(rgba: &mut [u8], largeur: u32, hauteur: u32, r: &Reglages, effets: bool) {
    let r = r.bornes();
    if r.neutres() || largeur == 0 || hauteur == 0 {
        return;
    }
    let pr = Prepares::new(&r, largeur, hauteur);
    let (l, h) = (largeur as usize, hauteur as usize);
    if !r.voisins() {
        rgba.par_chunks_mut(l * 4).enumerate().for_each(|(y, ligne)| {
            for (x, c) in ligne.chunks_exact_mut(4).enumerate() {
                let v = pr.reglages_pixel([pr.vers_lineaire(c[0]), pr.vers_lineaire(c[1]), pr.vers_lineaire(c[2])]);
                let v = if effets { pr.effets_pixel(v, x as u32, y as u32) } else { v };
                c[0] = pr.vers_srgb8(v[0]);
                c[1] = pr.vers_srgb8(v[1]);
                c[2] = pr.vers_srgb8(v[2]);
            }
        });
        return;
    }
    let mut lin: Vec<f32> = rgba
        .par_chunks(4)
        .flat_map_iter(|c| pr.reglages_pixel([pr.vers_lineaire(c[0]), pr.vers_lineaire(c[1]), pr.vers_lineaire(c[2])]))
        .collect();
    reglages_voisins(&mut lin, l, h, &r);
    rgba.par_chunks_mut(l * 4).zip(lin.par_chunks(l * 3)).enumerate().for_each(|(y, (ligne, source))| {
        for (x, (c, v)) in ligne.chunks_exact_mut(4).zip(source.chunks_exact(3)).enumerate() {
            let v = [v[0], v[1], v[2]];
            let v = if effets { pr.effets_pixel(v, x as u32, y as u32) } else { v };
            c[0] = pr.vers_srgb8(v[0]);
            c[1] = pr.vers_srgb8(v[1]);
            c[2] = pr.vers_srgb8(v[2]);
        }
    });
}

/// Les derniers aperçus décodés (on retouche souvent la même photo de suite).
static APERCUS: std::sync::Mutex<Vec<(std::path::PathBuf, std::sync::Arc<image::RgbaImage>)>> = std::sync::Mutex::new(Vec::new());
const APERCUS_GARDES: usize = 4;

fn apercu_decode(chemin: &std::path::Path) -> Result<std::sync::Arc<image::RgbaImage>, String> {
    if let Some((_, i)) = APERCUS.lock().unwrap_or_else(|e| e.into_inner()).iter().find(|(c, _)| c == chemin) {
        return Ok(i.clone());
    }
    let octets = std::fs::read(chemin).map_err(|e| format!("aperçu illisible : {e}"))?;
    let i = std::sync::Arc::new(image::load_from_memory(&octets).map_err(|e| format!("aperçu illisible : {e}"))?.to_rgba8());
    let mut liste = APERCUS.lock().unwrap_or_else(|e| e.into_inner());
    liste.retain(|(c, _)| c != chemin);
    liste.push((chemin.to_path_buf(), i.clone()));
    if liste.len() > APERCUS_GARDES {
        liste.remove(0);
    }
    Ok(i)
}

/// La base de l'aperçu en direct : l'aperçu de 2560 px d'une photo du design (son fichier),
/// retouché sans le vignetage ni le grain (le shader de la fenêtre les ajoute, et refait
/// par-dessus les réglages d'un pixel pendant qu'on tire un curseur). Largeur et hauteur (deux
/// entiers de 32 bits, petit-boutistes), puis les pixels RGBA.
pub fn base_apercu(chemin: &std::path::Path, r: &Reglages) -> Result<Vec<u8>, String> {
    let apercu = apercu_decode(chemin)?;
    let (l, h) = apercu.dimensions();
    let mut sortie = Vec::with_capacity(8 + apercu.as_raw().len());
    sortie.extend_from_slice(&l.to_le_bytes());
    sortie.extend_from_slice(&h.to_le_bytes());
    sortie.extend_from_slice(apercu.as_raw());
    appliquer(&mut sortie[8..], l, h, r, false);
    Ok(sortie)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{Value, json};

    const ATTENDUS: &str = include_str!("../../src/modele/labo.attendus.json");

    /// Les cas du tableau commun : chacun est une image de 64 × 48 px dont on lit 96 pixels.
    fn cas() -> Vec<(String, Reglages)> {
        let r = |v: Value| serde_json::from_value::<Reglages>(v).unwrap();
        vec![
            ("neutre".into(), Reglages::default()),
            ("exposition +1,5".into(), r(json!({ "exposition": 1.5 }))),
            ("exposition -2".into(), r(json!({ "exposition": -2 }))),
            ("chaud et vert".into(), r(json!({ "temperature": 60, "teinte": -40 }))),
            ("froid et magenta".into(), r(json!({ "temperature": -80, "teinte": 50 }))),
            ("contraste +70".into(), r(json!({ "contraste": 70 }))),
            ("contraste -100".into(), r(json!({ "contraste": -100 }))),
            ("tonalités".into(), r(json!({ "hautesLumieres": -90, "ombres": 80, "blancs": 40, "noirs": -50 }))),
            ("saturation -100".into(), r(json!({ "saturation": -100 }))),
            ("vibrance et saturation".into(), r(json!({ "vibrance": 70, "saturation": 25 }))),
            ("mélangeur".into(), r(json!({ "melangeur": { "orange": { "teinte": 20, "saturation": -30, "luminance": 25 }, "bleu": { "teinte": -60, "saturation": 50, "luminance": -40 }, "vert": { "saturation": -100 } } }))),
            ("vignetage -60".into(), r(json!({ "vignetage": -60 }))),
            ("vignetage +40".into(), r(json!({ "vignetage": 40 }))),
            ("grain 70".into(), r(json!({ "grain": 70 }))),
            ("tout".into(), r(json!({ "temperature": 15, "teinte": -5, "exposition": 0.4, "contraste": 25, "hautesLumieres": -40, "ombres": 35, "blancs": 10, "noirs": -10, "vibrance": 20, "saturation": 10, "melangeur": { "orange": { "teinte": 10, "saturation": 20, "luminance": -10 }, "bleu": { "teinte": -15, "saturation": 30, "luminance": -20 } }, "vignetage": -30, "grain": 15 }))),
        ]
    }

    /// L'entrée du pixel `(x, y)` : des gris, des couleurs franches et des tons de peau, de ciel,
    /// de feuillage, puis des couleurs tirées du hachage.
    fn entree(x: u32, y: u32) -> [u8; 3] {
        const FIXES: [[u8; 3]; 16] = [
            [0, 0, 0], [255, 255, 255], [128, 128, 128], [32, 32, 32], [220, 220, 220], [255, 0, 0], [0, 255, 0], [0, 0, 255],
            [224, 172, 140], [120, 170, 230], [70, 120, 50], [250, 200, 40], [180, 60, 200], [20, 200, 210], [240, 120, 30], [90, 40, 30],
        ];
        let i = (y * 64 + x) as usize;
        if i < FIXES.len() * 6 && i.is_multiple_of(6) {
            return FIXES[i / 6];
        }
        let h = hachage(x + 1000, y + 2000);
        [(h & 0xff) as u8, ((h >> 8) & 0xff) as u8, ((h >> 16) & 0xff) as u8]
    }

    /// Les 96 pixels lus : les 16 couleurs fixes et 80 autres, répartis sur l'image (bords et
    /// coins compris, pour le vignetage).
    fn positions() -> Vec<(u32, u32)> {
        let mut v: Vec<(u32, u32)> = (0..16).map(|i| ((i * 6) % 64, (i * 6) / 64)).collect();
        for i in 0..80u32 {
            let h = hachage(i, 77);
            v.push((h % 64, (h >> 8) % 48));
        }
        v.extend([(0, 47), (63, 47), (63, 0), (32, 24)]);
        v.truncate(96);
        v
    }

    fn calculer() -> Value {
        let cas: Vec<Value> = cas()
            .into_iter()
            .map(|(nom, r)| {
                let p = Prepares::new(&r, 64, 48);
                let pixels: Vec<Value> = positions().into_iter().map(|(x, y)| json!({ "x": x, "y": y, "entree": entree(x, y), "sortie": p.pixel(entree(x, y), x, y) })).collect();
                json!({ "nom": nom, "reglages": r, "largeur": 64, "hauteur": 48, "pixels": pixels })
            })
            .collect();
        json!({ "note": "Calculé par le noyau (labo.rs, cargo test avec ELIOT_ECRIRE_ATTENDUS=1) ; relu par le noyau et par le shader de la fenêtre.", "cas": cas })
    }

    #[test]
    fn le_tableau_commun_est_celui_du_noyau() {
        let calcule = calculer();
        if std::env::var("ELIOT_ECRIRE_ATTENDUS").is_ok() {
            let chemin = concat!(env!("CARGO_MANIFEST_DIR"), "/../src/modele/labo.attendus.json");
            std::fs::write(chemin, serde_json::to_string(&calcule).unwrap() + "\n").unwrap();
            return;
        }
        let attendu: Value = serde_json::from_str(ATTENDUS).unwrap();
        assert_eq!(attendu["cas"].as_array().unwrap().len(), calcule["cas"].as_array().unwrap().len());
        for (a, c) in attendu["cas"].as_array().unwrap().iter().zip(calcule["cas"].as_array().unwrap()) {
            let r: Reglages = serde_json::from_value(a["reglages"].clone()).unwrap();
            let p = Prepares::new(&r, 64, 48);
            for px in a["pixels"].as_array().unwrap() {
                let (x, y) = (px["x"].as_u64().unwrap() as u32, px["y"].as_u64().unwrap() as u32);
                let e: [u8; 3] = serde_json::from_value(px["entree"].clone()).unwrap();
                let s: [u8; 3] = serde_json::from_value(px["sortie"].clone()).unwrap();
                assert_eq!(p.pixel(e, x, y), s, "{} en ({x}, {y})", a["nom"]);
            }
            assert_eq!(a["nom"], c["nom"]);
        }
    }

    #[test]
    fn des_reglages_neutres_ne_changent_rien() {
        let mut img: Vec<u8> = (0..64 * 48).flat_map(|i| { let c = entree(i % 64, i / 64); [c[0], c[1], c[2], 200] }).collect();
        let avant = img.clone();
        appliquer(&mut img, 64, 48, &Reglages::default(), true);
        assert_eq!(img, avant);
        // Neutres mais passés par le calcul (une valeur infime) : le sRGB revient au même octet.
        let p = Prepares::new(&Reglages { exposition: 1e-7, ..Default::default() }, 64, 48);
        for v in 0..=255u8 {
            assert_eq!(p.pixel([v, v, v], 3, 3), [v, v, v], "gris {v}");
        }
    }

    #[test]
    fn les_reglages_font_ce_qu_ils_disent() {
        let p = |r: Value| Prepares::new(&serde_json::from_value::<Reglages>(r).unwrap(), 64, 48);
        let gris = [128, 128, 128];
        // +1 IL : la lumière double, donc 128 → environ 175 en sRGB.
        let e = p(json!({ "exposition": 1 })).pixel(gris, 32, 24);
        assert!((e[0] as i32 - 175).abs() <= 2, "{e:?}");
        // Plus chaud : plus de rouge que de bleu.
        let c = p(json!({ "temperature": 50 })).pixel(gris, 32, 24);
        assert!(c[0] > c[2] + 20, "{c:?}");
        // Saturation -100 : un gris.
        let s = p(json!({ "saturation": -100 })).pixel([200, 40, 40], 32, 24);
        assert!(s[0].abs_diff(s[1]) <= 1 && s[1].abs_diff(s[2]) <= 1, "{s:?}");
        // Ombres +100 : un ton sombre s'éclaircit, un ton clair bouge à peine.
        let o = p(json!({ "ombres": 100 }));
        assert!(o.pixel([30, 30, 30], 32, 24)[0] > 60 && o.pixel([230, 230, 230], 32, 24)[0] <= 232);
        // Vignetage négatif : les coins s'assombrissent, le centre ne bouge pas.
        let v = p(json!({ "vignetage": -100 }));
        assert_eq!(v.pixel(gris, 32, 24), gris);
        assert!(v.pixel(gris, 0, 0)[0] < 90);
        // Mélangeur : le bleu tourne, le rouge ne bouge pas.
        let m = p(json!({ "melangeur": { "bleu": { "teinte": 100 } } }));
        assert_ne!(m.pixel([40, 60, 220], 32, 24), [40, 60, 220]);
        assert_eq!(m.pixel([220, 30, 30], 32, 24), [220, 30, 30]);
        // Bornes : une exposition de 40 IL vaut 5 IL.
        assert_eq!(Reglages { exposition: 40.0, ..Default::default() }.bornes().exposition, 5.0);
    }

    /// Une image d'essai : un dégradé doux, une marche nette au milieu, du bruit fin.
    fn essai(l: u32, h: u32) -> Vec<u8> {
        (0..l * h)
            .flat_map(|i| {
                let (x, y) = (i % l, i / l);
                let base = if x < l / 2 { 70.0 } else { 170.0 } + 30.0 * (y as f32 / h as f32);
                let n = ((hachage(x, y) & 0xff) as f32 - 127.5) / 127.5 * 12.0;
                let c = (base + n).clamp(0.0, 255.0) as u8;
                [c, (c as f32 * 0.9) as u8, (c as f32 * 0.8) as u8, 255]
            })
            .collect()
    }

    fn ecart_type(img: &[u8], l: u32, x0: u32, x1: u32, y0: u32, y1: u32) -> f32 {
        let v: Vec<f32> = (y0..y1).flat_map(|y| (x0..x1).map(move |x| img[((y * l + x) * 4) as usize] as f32)).collect();
        let m = v.iter().sum::<f32>() / v.len() as f32;
        (v.iter().map(|a| (a - m) * (a - m)).sum::<f32>() / v.len() as f32).sqrt()
    }

    #[test]
    fn les_reglages_voisins() {
        let (l, h) = (640, 400);
        let base = essai(l, h);
        let applique = |r: Value| {
            let mut img = base.clone();
            appliquer(&mut img, l, h, &serde_json::from_value(r).unwrap(), true);
            img
        };
        let zone = |img: &[u8]| ecart_type(img, l, 40, 280, 180, 220);
        // Réduction du bruit : le grain de l'image baisse nettement.
        let avant = zone(&base);
        let lisse = applique(json!({ "bruit": 100 }));
        assert!(zone(&lisse) < avant * 0.6, "{} contre {avant}", zone(&lisse));
        // Netteté : le bruit fin ressort ; négative, elle adoucit.
        assert!(zone(&applique(json!({ "nettete": 100 }))) > avant * 1.3);
        assert!(zone(&applique(json!({ "nettete": -100 }))) < avant * 0.9);
        // Clarté : la marche du milieu se creuse (le côté sombre s'assombrit près du bord).
        let clarte = applique(json!({ "clarte": 100 }));
        let pres = |img: &[u8]| img[((200 * l + l / 2 - 6) * 4) as usize] as i32;
        assert!(pres(&clarte) < pres(&base) - 3, "{} contre {}", pres(&clarte), pres(&base));
        // Voile : le contraste d'ensemble monte ; négatif, il baisse.
        let ecart = |img: &[u8]| ecart_type(img, l, 0, l, 0, h);
        assert!(ecart(&applique(json!({ "voile": 80 }))) > ecart(&base));
        assert!(ecart(&applique(json!({ "voile": -80 }))) < ecart(&base));
        // L'alpha reste.
        assert!(lisse.chunks(4).all(|c| c[3] == 255));
    }

    #[test]
    fn l_apercu_et_l_original_donnent_le_meme_dessin() {
        // Une image et sa réduction de moitié : retoucher puis réduire, ou réduire puis
        // retoucher, se ressemblent (les rayons suivent la taille).
        let (l, h) = (800, 500);
        let grande = essai(l, h);
        let reduire = |img: &[u8], l: u32, h: u32| -> Vec<u8> {
            (0..(l / 2) * (h / 2))
                .flat_map(|i| {
                    let (x, y) = (i % (l / 2), i / (l / 2));
                    let mut s = [0u32; 4];
                    for (dx, dy) in [(0, 0), (1, 0), (0, 1), (1, 1)] {
                        let j = (((2 * y + dy) * l + 2 * x + dx) * 4) as usize;
                        for c in 0..4 {
                            s[c] += img[j + c] as u32;
                        }
                    }
                    s.map(|v| (v / 4) as u8)
                })
                .collect()
        };
        let r: Reglages = serde_json::from_value(json!({ "clarte": 60, "texture": 40, "voile": 30, "exposition": 0.3 })).unwrap();
        let mut a = grande.clone();
        appliquer(&mut a, l, h, &r, true);
        let a = reduire(&a, l, h);
        let mut b = reduire(&grande, l, h);
        appliquer(&mut b, l / 2, h / 2, &r, true);
        let ecart: f32 = a.iter().zip(&b).map(|(x, y)| (*x as f32 - *y as f32).abs()).sum::<f32>() / a.len() as f32;
        assert!(ecart < 4.0, "écart moyen {ecart}");
    }

    /// Pour les comparaisons de Claude dans le conteneur : retouche un fichier
    /// (`ELIOT_LABO_ENTREE`, `ELIOT_LABO_REGLAGES` en JSON, `ELIOT_LABO_SORTIE` en PNG).
    #[test]
    #[ignore]
    fn retoucher_un_fichier() {
        let entree = std::env::var("ELIOT_LABO_ENTREE").unwrap();
        let r: Reglages = serde_json::from_str(&std::env::var("ELIOT_LABO_REGLAGES").unwrap()).unwrap();
        let mut img = image::open(entree).unwrap().to_rgba8();
        let (l, h) = img.dimensions();
        let debut = std::time::Instant::now();
        appliquer(&mut img, l, h, &r, std::env::var("ELIOT_LABO_SANS_EFFETS").is_err());
        eprintln!("retouche en {:?}", debut.elapsed());
        img.save(std::env::var("ELIOT_LABO_SORTIE").unwrap()).unwrap();
    }
}
