//! Le labo photo (étape 5, lots 2 à 4) : les réglages d'une photo ou d'un clip vidéo façon
//! Lightroom, valeurs du
//! document (règle 13 : l'original n'est jamais touché), calculés en nombres à virgule, en
//! lumière linéaire, dans l'ordre fixe du BRIEF (§ 6, « Ce que Eliot reprend de Lightroom ») :
//!
//! 1. balance des blancs (température, teinte) et exposition, des gains par canal ;
//! 2. tonalités (contraste, hautes lumières, ombres, blancs, noirs), sur la luminance perçue ;
//! 3. courbe des tonalités (une pour l'image entière, une par canal), sur l'image telle
//!    qu'elle s'affiche (en sRGB, de 0 à 1) ;
//! 4. couleurs : saturation, vibrance, le mélangeur de huit couleurs, puis l'étalonnage (une
//!    teinte pour les ombres, les tons moyens et les hautes lumières, qui colore aussi une photo
//!    passée en noir et blanc) ;
//! 5. détail : réduction du bruit, netteté ;
//! 6. effets : texture, clarté, correction du voile, puis vignetage et grain.
//!
//! Les étapes 1 à 4 et la fin de la 6 (vignetage, grain) ne regardent qu'un pixel : la
//! fenêtre les refait dans un shader WebGL pendant qu'on tire un curseur (`src/labo/shader.ts`,
//! mêmes formules, ligne pour ligne, contrôlées par le tableau commun
//! `src/modele/labo.attendus.json`). Les autres regardent les pixels voisins : le noyau les
//! calcule au relâchement du curseur, sur l'aperçu de 2560 px, et à l'export, depuis l'original.
//! Leurs rayons comptent en pixels d'une image de 2560 px de grand côté et suivent la taille de
//! l'image : l'aperçu et l'original donnent le même dessin.
//!
//! Un clip vidéo (lot 4) passe image par image dans les mêmes formules ; son grain change 24 fois
//! par seconde du fichier (`graine_du_temps`), comme celui d'un film.
//!
//! Le recadrage (lot 5) est une valeur de l'élément, que la fenêtre pose en dessinant la page
//! (le SVG de la page le porte, le noyau n'a rien à recadrer) ; le noyau ne s'en sert que pour
//! le vignetage, qui suit le cadre gardé, comme le vignetage après recadrage de Lightroom.

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

/// Au plus seize points par courbe.
pub const POINTS_COURBE_MAX: usize = 16;
/// Les pas de la table d'une courbe, lue en ligne droite (la même dans le shader).
pub const PAS_COURBE: usize = 1024;

/// La courbe des tonalités : des points (entrée, sortie) de 0 à 255, pour l'image entière
/// (`rgb`) puis pour chaque canal. Une liste vide : la diagonale, rien ne change. Les points
/// sont rangés par entrée ; la courbe passe toujours par une entrée 0 et une entrée 255 (s'ils
/// manquent, les points (0, 0) et (255, 255) sont ajoutés).
#[derive(Debug, Clone, Default, PartialEq, Deserialize, Serialize)]
#[serde(default)]
pub struct Courbe {
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub rgb: Vec<[f32; 2]>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub rouge: Vec<[f32; 2]>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub vert: Vec<[f32; 2]>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub bleu: Vec<[f32; 2]>,
}

/// Les points d'une courbe tels que le document doit les garder : entiers de 0 à 255, rangés,
/// une seule sortie par entrée (la dernière donnée), les deux bouts présents, seize au plus ;
/// une diagonale devient une liste vide. Les mêmes règles que `normaliserCourbe` de la fenêtre.
pub fn normaliser_points(points: &[[f32; 2]]) -> Vec<[f32; 2]> {
    let mut p: Vec<[f32; 2]> = points
        .iter()
        .filter(|q| q[0].is_finite() && q[1].is_finite())
        .map(|q| [q[0].clamp(0.0, 255.0).round(), q[1].clamp(0.0, 255.0).round()])
        .collect();
    // Tri stable : à entrée égale, l'ordre donné reste, et la dernière sortie l'emporte.
    p.sort_by(|a, b| a[0].total_cmp(&b[0]));
    let mut sortie: Vec<[f32; 2]> = Vec::with_capacity(p.len() + 2);
    for q in p {
        match sortie.last_mut() {
            Some(d) if d[0] == q[0] => *d = q,
            _ => sortie.push(q),
        }
    }
    if sortie.is_empty() {
        return sortie;
    }
    if sortie[0][0] > 0.0 {
        sortie.insert(0, [0.0, 0.0]);
    }
    if sortie[sortie.len() - 1][0] < 255.0 {
        sortie.push([255.0, 255.0]);
    }
    if sortie.len() > POINTS_COURBE_MAX {
        let dernier = sortie[sortie.len() - 1];
        sortie.truncate(POINTS_COURBE_MAX - 1);
        sortie.push(dernier);
    }
    if sortie.iter().all(|q| q[0] == q[1]) {
        sortie.clear();
    }
    sortie
}

impl Courbe {
    pub fn bornes(&self) -> Courbe {
        Courbe { rgb: normaliser_points(&self.rgb), rouge: normaliser_points(&self.rouge), vert: normaliser_points(&self.vert), bleu: normaliser_points(&self.bleu) }
    }

    pub fn neutre(&self) -> bool {
        self.rgb.is_empty() && self.rouge.is_empty() && self.vert.is_empty() && self.bleu.is_empty()
    }
}

/// Une courbe monotone par morceaux (Fritsch et Carlson, 1980) : elle passe par chaque point
/// sans repartir en arrière entre deux points ni dépasser ses voisins. Calculée en f64, comme
/// les nombres de JavaScript, pour que la fenêtre et le noyau aient la même table.
struct Spline {
    x: Vec<f64>,
    y: Vec<f64>,
    m: Vec<f64>,
}

impl Spline {
    /// `points` : normalisés (de 0 à 255) ; vide : la diagonale.
    fn new(points: &[[f32; 2]]) -> Spline {
        let (x, y): (Vec<f64>, Vec<f64>) = if points.len() < 2 {
            (vec![0.0, 1.0], vec![0.0, 1.0])
        } else {
            points.iter().map(|q| (q[0] as f64 / 255.0, q[1] as f64 / 255.0)).unzip()
        };
        let n = x.len();
        let d: Vec<f64> = (0..n - 1).map(|k| (y[k + 1] - y[k]) / (x[k + 1] - x[k])).collect();
        let mut m = vec![0.0; n];
        m[0] = d[0];
        m[n - 1] = d[n - 2];
        for k in 1..n - 1 {
            m[k] = if d[k - 1] * d[k] <= 0.0 { 0.0 } else { (d[k - 1] + d[k]) / 2.0 };
        }
        for k in 0..n - 1 {
            if d[k] == 0.0 {
                m[k] = 0.0;
                m[k + 1] = 0.0;
            } else {
                let (a, b) = (m[k] / d[k], m[k + 1] / d[k]);
                let s = a * a + b * b;
                if s > 9.0 {
                    let t = 3.0 / s.sqrt();
                    m[k] = t * a * d[k];
                    m[k + 1] = t * b * d[k];
                }
            }
        }
        Spline { x, y, m }
    }

    fn lire(&self, v: f64) -> f64 {
        let n = self.x.len();
        if v <= self.x[0] {
            return self.y[0];
        }
        if v >= self.x[n - 1] {
            return self.y[n - 1];
        }
        let mut k = 0;
        while k < n - 2 && v >= self.x[k + 1] {
            k += 1;
        }
        let h = self.x[k + 1] - self.x[k];
        let t = (v - self.x[k]) / h;
        let (t2, t3) = (t * t, t * t * t);
        let y = (2.0 * t3 - 3.0 * t2 + 1.0) * self.y[k] + (t3 - 2.0 * t2 + t) * h * self.m[k] + (-2.0 * t3 + 3.0 * t2) * self.y[k + 1] + (t3 - t2) * h * self.m[k + 1];
        y.clamp(0.0, 1.0)
    }
}

/// La table d'une courbe : pour 1024 valeurs de 0 à 1 (en sRGB), la sortie de chaque canal,
/// la courbe de l'image entière d'abord, puis celle du canal. `None` : rien à faire.
pub fn table_courbe(c: &Courbe) -> Option<Vec<[f32; 3]>> {
    let c = c.bornes();
    if c.neutre() {
        return None;
    }
    let (maitre, r, v, b) = (Spline::new(&c.rgb), Spline::new(&c.rouge), Spline::new(&c.vert), Spline::new(&c.bleu));
    Some(
        (0..PAS_COURBE)
            .map(|i| {
                let x = maitre.lire(i as f64 / (PAS_COURBE - 1) as f64);
                [r.lire(x) as f32, v.lire(x) as f32, b.lire(x) as f32]
            })
            .collect(),
    )
}

fn lire_courbe(table: &[[f32; 3]], canal: usize, e: f32) -> f32 {
    let x = e.clamp(0.0, 1.0) * (PAS_COURBE - 1) as f32;
    let i = (x as usize).min(PAS_COURBE - 2);
    let t = x - i as f32;
    table[i][canal] * (1.0 - t) + table[i + 1][canal] * t
}

/// Une zone de l'étalonnage : une teinte (de 0 à 360°) et sa force (de 0 à 100).
#[derive(Debug, Clone, Copy, Default, PartialEq, Deserialize, Serialize)]
#[serde(default)]
pub struct Zone {
    pub teinte: f32,
    pub saturation: f32,
}

/// L'étalonnage, comme celui de Lightroom : une teinte pour les ombres, les tons moyens et les
/// hautes lumières ; l'équilibre (de -100 à +100) déplace la frontière entre ombres et hautes
/// lumières (positif : plus de hautes lumières).
#[derive(Debug, Clone, Copy, Default, PartialEq, Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Etalonnage {
    pub ombres: Zone,
    pub tons_moyens: Zone,
    pub hautes_lumieres: Zone,
    pub equilibre: f32,
}

/// La force de l'étalonnage à 100 : la teinte, sans luminance, multiplie la lumière d'autant.
const FORCE_ETALONNAGE: f32 = 1.0;

impl Etalonnage {
    pub fn bornes(&self) -> Etalonnage {
        let z = |x: Zone| {
            let s = borne(x.saturation, 0.0, 100.0);
            Zone { teinte: if s > 0.0 && x.teinte.is_finite() { x.teinte.rem_euclid(360.0) } else { 0.0 }, saturation: s }
        };
        let (o, m, h) = (z(self.ombres), z(self.tons_moyens), z(self.hautes_lumieres));
        let actif = o.saturation > 0.0 || m.saturation > 0.0 || h.saturation > 0.0;
        Etalonnage { ombres: o, tons_moyens: m, hautes_lumieres: h, equilibre: if actif { borne(self.equilibre, -100.0, 100.0) } else { 0.0 } }
    }

    pub fn neutre(&self) -> bool {
        self.ombres.saturation <= 0.0 && self.tons_moyens.saturation <= 0.0 && self.hautes_lumieres.saturation <= 0.0
    }
}

/// La couleur d'une teinte (pleine, de valeur 1), moins sa luminance : un écart de couleur qui ne
/// change pas la lumière d'un gris, à la force `saturation` (0 à 100). Le même calcul dans la
/// fenêtre (`vecteurEtalonnage`).
pub fn vecteur_etalonnage(teinte: f32, saturation: f32) -> [f32; 3] {
    let f = |n: f32| {
        let k = (n + teinte / 60.0).rem_euclid(6.0);
        1.0 - k.min(4.0 - k).clamp(0.0, 1.0)
    };
    let c = [f(5.0), f(3.0), f(1.0)];
    let y = c[0] * LUMA[0] + c[1] * LUMA[1] + c[2] * LUMA[2];
    let force = saturation / 100.0 * FORCE_ETALONNAGE;
    [(c[0] - y) * force, (c[1] - y) * force, (c[2] - y) * force]
}

/// Le recadrage d'une photo ou d'un clip (lot 5), tel que l'élément le garde : le rectangle
/// gardé dans l'image redressée (qui a le même centre que l'original), en fractions de la
/// largeur et de la hauteur de l'original (`x`, `y` : son coin haut gauche), et le redressement
/// en degrés, de -45 à 45 (positif : l'image tourne dans le sens des aiguilles d'une montre).
#[derive(Debug, Clone, Copy, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Rognage {
    pub x: f32,
    pub y: f32,
    pub largeur: f32,
    pub hauteur: f32,
    #[serde(default)]
    pub angle: f32,
}

impl Rognage {
    /// Un recadrage lisible : des nombres, un rectangle qui a une taille.
    fn valide(&self) -> bool {
        [self.x, self.y, self.largeur, self.hauteur, self.angle].iter().all(|v| v.is_finite()) && self.largeur > 1e-4 && self.hauteur > 1e-4
    }

    /// Du centre `(X, Y)` d'un pixel d'une image de `largeur` × `hauteur` (`X` = x + 0,5) aux
    /// coordonnées du cadre gardé, de 0 à 1 : `[a, b, c, d, e, f]`, u = a X + c Y + e,
    /// v = b X + d Y + f (comme une matrice de canevas). Le même calcul dans la fenêtre
    /// (`matriceRognage` vers un cadre de 1 × 1).
    pub fn repere(&self, largeur: f32, hauteur: f32) -> [f32; 6] {
        let (l, h) = (largeur as f64, hauteur as f64);
        let t = (self.angle as f64).to_radians();
        let (co, si) = (t.cos(), t.sin());
        let gauche = (self.x as f64 - 0.5) * l;
        let haut = (self.y as f64 - 0.5) * h;
        let sx = 1.0 / (self.largeur as f64 * l);
        let sy = 1.0 / (self.hauteur as f64 * h);
        [
            (sx * co) as f32,
            (sy * si) as f32,
            (-sx * si) as f32,
            (sy * co) as f32,
            (sx * (-co * l / 2.0 + si * h / 2.0 - gauche)) as f32,
            (sy * (-si * l / 2.0 - co * h / 2.0 - haut)) as f32,
        ]
    }
}

/// Les réglages d'une photo, tels que le document les garde (seulement ceux qui ne sont pas à
/// zéro ; un absent vaut zéro). Exposition en IL de -5 à +5 ; réduction du bruit et grain de 0 à
/// 100 ; les autres de -100 à +100 ; la courbe en points de 0 à 255.
#[derive(Debug, Clone, Default, PartialEq, Deserialize, Serialize)]
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
    pub etalonnage: Etalonnage,
    pub courbe: Courbe,
    pub texture: f32,
    pub clarte: f32,
    pub voile: f32,
    pub vignetage: f32,
    pub grain: f32,
    pub nettete: f32,
    pub bruit: f32,
    /// Le recadrage de l'élément, que la fenêtre et `montage::reglages_labo` posent ici quand il
    /// y a un vignetage (jamais dans les réglages du document) : le vignetage suit le cadre gardé.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rognage: Option<Rognage>,
    /// Le détourage de la photo (lot 7), que `montage::reglages_labo` pose ici pour l'export
    /// (jamais dans les réglages du document) : il entre dans la clé de la retouche, et le noyau
    /// le pose après les réglages (`detourage::appliquer`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detourage: Option<crate::detourage::Detourage>,
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
            etalonnage: self.etalonnage.bornes(),
            courbe: self.courbe.bornes(),
            texture: c(self.texture),
            clarte: c(self.clarte),
            voile: c(self.voile),
            vignetage: c(self.vignetage),
            grain: p(self.grain),
            nettete: c(self.nettete),
            bruit: p(self.bruit),
            rognage: self.rognage.filter(Rognage::valide).map(|g| Rognage { angle: g.angle.clamp(-45.0, 45.0), ..g }),
            detourage: self.detourage.clone(),
        }
    }

    /// Rien à faire : l'image sort telle qu'elle est entrée (le recadrage seul ne touche à aucun
    /// pixel ; le détourage se pose à part).
    pub fn neutres(&self) -> bool {
        Reglages { rognage: None, detourage: None, ..self.clone() } == Reglages::default()
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

/// La graine du grain d'une image prise à `ms` millisecondes de son fichier : elle change 24
/// fois par seconde. Une photo a la graine 0.
pub fn graine_du_temps(ms: f64) -> u32 {
    if ms.is_finite() && ms > 0.0 { (ms * 24.0 / 1000.0 + 1e-6).floor() as u32 } else { 0 }
}

/// Le bruit du grain au point `(gx, gy)` de la grille de référence, de -0,5 à 0,5 : la valeur
/// de chaque nœud vient du hachage, entre les nœuds elle se lit en ligne droite. La graine
/// décale la grille : un autre tirage, image après image (le même décalage en GLSL).
fn bruit_valeur(gx: f32, gy: f32, graine: u32) -> f32 {
    let (x0, y0) = (gx.floor(), gy.floor());
    let (fx, fy) = (gx - x0, gy - y0);
    let (ix, iy) = (x0.max(0.0) as u32, y0.max(0.0) as u32);
    let (ox, oy) = (graine.wrapping_mul(7919), graine.wrapping_mul(6271));
    let h = |x: u32, y: u32| (hachage(x.wrapping_add(ox), y.wrapping_add(oy)) & 0xffff) as f32 / 65535.0 - 0.5;
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
    /// Des tonalités à régler (sinon l'étape est sautée : deux puissances de moins par pixel).
    tonal: bool,
    /// L'étalonnage : les écarts de couleur des trois zones et la frontière (en lumière perçue)
    /// entre ombres et hautes lumières, s'il y en a un.
    etalonnage: Option<([[f32; 3]; 3], f32)>,
    /// La table de la courbe et le retour du sRGB à la lumière linéaire, s'il y a une courbe.
    courbe: Option<(Vec<[f32; 3]>, Table)>,
    /// Le grand côté de l'image (vignetage et grain suivent sa taille).
    largeur: u32,
    hauteur: u32,
    /// Le repère du cadre gardé (`Rognage::repere`), s'il y a un recadrage : le vignetage le suit.
    repere: Option<[f32; 6]>,
    echelle_grain: f32,
    /// La graine du grain (0 pour une photo ; un clip : `graine_du_temps`).
    graine: u32,
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
        let courbe = table_courbe(&r.courbe).map(|t| (t, Table::new(srgb_vers_lineaire)));
        let tonal = [r.contraste, r.hautes_lumieres, r.ombres, r.blancs, r.noirs].iter().any(|v| *v != 0.0);
        let e = &r.etalonnage;
        let etalonnage = (!e.neutre()).then(|| {
            let v = |z: &Zone| vecteur_etalonnage(z.teinte, z.saturation);
            ([v(&e.ombres), v(&e.tons_moyens), v(&e.hautes_lumieres)], 0.5 - 0.25 * e.equilibre / 100.0)
        });
        let repere = r.rognage.map(|g| g.repere(largeur.max(1) as f32, hauteur.max(1) as f32));
        Prepares { entree, sortie, gains, r, melangeur, melange, tonal, etalonnage, courbe, largeur, hauteur, repere, echelle_grain: COTE_REFERENCE / cote, graine: 0 }
    }

    /// La graine du grain d'une image d'un clip.
    pub fn avec_graine(mut self, graine: u32) -> Self {
        self.graine = graine;
        self
    }

    pub fn vers_lineaire(&self, c: u8) -> f32 {
        self.entree[c as usize]
    }

    /// Du linéaire au sRGB, de 0 à 1, par une table de 4096 pas lue en ligne droite.
    fn vers_srgb(&self, l: f32) -> f32 {
        let x = l.clamp(0.0, 1.0) * PAS_SORTIE as f32;
        let i = (x as usize).min(PAS_SORTIE - 1);
        let t = x - i as f32;
        self.sortie[i] * (1.0 - t) + self.sortie[i + 1] * t
    }

    /// Du linéaire au sRGB sur 8 bits.
    pub fn vers_srgb8(&self, l: f32) -> u8 {
        (self.vers_srgb(l) * 255.0).round() as u8
    }

    /// Étapes 1 à 4 : balance des blancs, exposition, tonalités, courbe, couleurs. Lumière
    /// linéaire en entrée et en sortie (la sortie peut dépasser 1).
    pub fn reglages_pixel(&self, c: [f32; 3]) -> [f32; 3] {
        let r = &self.r;
        let mut l = [c[0] * self.gains[0], c[1] * self.gains[1], c[2] * self.gains[2]];
        // Tonalités, sur la luminance perçue.
        let y0 = l[0] * LUMA[0] + l[1] * LUMA[1] + l[2] * LUMA[2];
        if self.tonal && y0 > 1e-6 {
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
        // Courbe des tonalités, sur chaque canal tel qu'il s'affiche (au-delà du blanc, le blanc).
        if let Some((table, lineaire)) = &self.courbe {
            for (c, v) in l.iter_mut().enumerate() {
                *v = lineaire.lire(lire_courbe(table, c, self.vers_srgb(*v)));
            }
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
        // Étalonnage : chaque zone (selon la lumière perçue) teinte la lumière sans changer celle
        // d'un gris ; il vient après la saturation, il colore donc aussi un noir et blanc.
        if let Some((v, frontiere)) = &self.etalonnage {
            let y3 = (l[0] * LUMA[0] + l[1] * LUMA[1] + l[2] * LUMA[2]).clamp(0.0, 1.0);
            let p = y3.powf(1.0 / 2.2);
            let wo = 1.0 - smoothstep(0.0, *frontiere, p);
            let wh = smoothstep(*frontiere, 1.0, p);
            let wm = 1.0 - wo - wh;
            for (c, x) in l.iter_mut().enumerate() {
                *x *= 1.0 + wo * v[0][c] + wm * v[1][c] + wh * v[2][c];
            }
        }
        [l[0].max(0.0), l[1].max(0.0), l[2].max(0.0)]
    }

    /// Fin de l'étape 6 : vignetage et grain, au pixel `(x, y)` de l'image.
    pub fn effets_pixel(&self, l: [f32; 3], x: u32, y: u32) -> [f32; 3] {
        let r = &self.r;
        let mut l = l;
        if r.vignetage != 0.0 {
            let (u, v) = match self.repere {
                // Recadrée : la position dans le cadre gardé.
                Some(m) => {
                    let (px, py) = (x as f32 + 0.5, y as f32 + 0.5);
                    ((m[0] * px + m[2] * py + m[4]) * 2.0 - 1.0, (m[1] * px + m[3] * py + m[5]) * 2.0 - 1.0)
                }
                None => ((x as f32 + 0.5) / self.largeur as f32 * 2.0 - 1.0, (y as f32 + 0.5) / self.hauteur as f32 * 2.0 - 1.0),
            };
            let d = ((u * u + v * v) / 2.0).sqrt();
            let f = (r.vignetage / 100.0 * 1.5 * smoothstep(0.35, 1.0, d)).exp2();
            l = [l[0] * f, l[1] * f, l[2] * f];
        }
        if r.grain != 0.0 {
            let gx = (x as f32 + 0.5) * self.echelle_grain - 0.5;
            let gy = (y as f32 + 0.5) * self.echelle_grain - 0.5;
            let f = 1.0 + r.grain / 100.0 * 0.25 * bruit_valeur(gx, gy, self.graine) * 2.0;
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
    appliquer_graine(rgba, largeur, hauteur, r, effets, 0);
}

/// Le même, pour une image d'un clip : `graine` tire son grain (`graine_du_temps`).
pub fn appliquer_graine(rgba: &mut [u8], largeur: u32, hauteur: u32, r: &Reglages, effets: bool, graine: u32) {
    let r = r.bornes();
    if r.neutres() || largeur == 0 || hauteur == 0 || rgba.len() < largeur as usize * hauteur as usize * 4 {
        return;
    }
    let pr = Prepares::new(&r, largeur, hauteur).avec_graine(graine);
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

/// L'angle qui redresse une photo du design (lot 5, bouton « Auto ») : la ligne la plus marquée
/// de son aperçu (`horizon::redressement`), ou `None` sans ligne assez nette. Un clip passe par
/// sa couverture, son aperçu.
pub fn horizon_apercu(chemin: &std::path::Path) -> Result<Option<crate::horizon::Horizon>, String> {
    Ok(crate::horizon::redressement(apercu_decode(chemin)?.as_ref()))
}

/// La base de l'aperçu en direct d'un clip à l'arrêt (lot 4) : l'image que la fenêtre montre,
/// envoyée telle quelle (RGBA), retouchée sans vignetage ni grain. Même rôle que
/// `base_apercu` pour une photo ; la fenêtre et le noyau partent ainsi des mêmes pixels.
pub fn base_pixels(largeur: u32, hauteur: u32, mut rgba: Vec<u8>, r: &Reglages) -> Result<Vec<u8>, String> {
    if largeur == 0 || hauteur == 0 || rgba.len() != largeur as usize * hauteur as usize * 4 {
        return Err(format!("image de {} octets pour {largeur} × {hauteur} px", rgba.len()));
    }
    appliquer(&mut rgba, largeur, hauteur, r, false);
    Ok(rgba)
}

/// Une image d'un clip en JPEG (la copie d'aperçu à un instant), retouchée en entier, grain de
/// cet instant compris : la capture et les vignettes d'une page vidéo.
pub fn retoucher_jpeg(jpeg: &[u8], r: &Reglages, graine: u32) -> Result<Vec<u8>, String> {
    let mut img = image::load_from_memory(jpeg).map_err(|e| format!("image illisible : {e}"))?.to_rgba8();
    let (l, h) = img.dimensions();
    appliquer_graine(&mut img, l, h, r, true, graine);
    let rgb = image::DynamicImage::ImageRgba8(img).to_rgb8();
    let mut sortie = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut sortie, 92).encode_image(&rgb).map_err(|e| format!("JPEG : {e}"))?;
    Ok(sortie)
}

// ----------------------------------------------------------------------------------------
// Les préréglages d'Alexandre (lot 3), rangés hors des designs :
// `~/Documents/Eliot/Préréglages/prereglages.json`. Ceux qu'Eliot fournit sont dans la fenêtre
// (`src/modele/prereglages.json`).
// ----------------------------------------------------------------------------------------

const FICHIER_PREREGLAGES: &str = "prereglages.json";
const PREREGLAGES_MAX: usize = 200;
/// Deux cents préréglages tiennent en quelques centaines de Ko ; on refuse un fichier démesuré.
const TAILLE_PREREGLAGES_MAX: usize = 1024 * 1024;

fn prereglages_vides() -> serde_json::Value {
    serde_json::json!({ "version": 1, "prereglages": [] })
}

/// Un fichier de préréglages se tient : une liste d'au plus 200, chacun avec un identifiant
/// unique, un nom de 1 à 60 caractères et des réglages que le noyau sait lire.
fn verifier_prereglages(v: &serde_json::Value) -> Result<(), String> {
    let liste = v.get("prereglages").and_then(|l| l.as_array()).ok_or("une liste « prereglages » est attendue")?;
    if liste.len() > PREREGLAGES_MAX {
        return Err(format!("au plus {PREREGLAGES_MAX} préréglages"));
    }
    let mut ids = std::collections::HashSet::new();
    for p in liste {
        let id = p.get("id").and_then(|x| x.as_str()).filter(|x| !x.is_empty() && x.len() <= 64).ok_or("un préréglage sans identifiant")?;
        if !ids.insert(id) {
            return Err(format!("identifiant en double : {id}"));
        }
        let nom = p.get("nom").and_then(|x| x.as_str()).unwrap_or("");
        if nom.trim().is_empty() || nom.chars().count() > 60 {
            return Err(format!("préréglage {id} : un nom de 1 à 60 caractères"));
        }
        let reglages = p.get("reglages").filter(|r| r.is_object()).ok_or_else(|| format!("préréglage {nom} : des réglages sont attendus"))?;
        serde_json::from_value::<Reglages>(reglages.clone()).map_err(|e| format!("préréglage {nom} : {e}"))?;
    }
    Ok(())
}

/// Les préréglages d'Alexandre. Absent : une liste vide. Abîmé : une erreur, le fichier n'est
/// pas touché.
pub fn lire_prereglages(dossier: &std::path::Path) -> Result<serde_json::Value, String> {
    let octets = match std::fs::read(dossier.join(FICHIER_PREREGLAGES)) {
        Ok(o) => o,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(prereglages_vides()),
        Err(e) => return Err(format!("préréglages illisibles : {e}")),
    };
    let v: serde_json::Value = serde_json::from_slice(&octets).map_err(|e| format!("préréglages illisibles : {e}"))?;
    verifier_prereglages(&v).map_err(|e| format!("préréglages illisibles : {e}"))?;
    Ok(v)
}

/// Enregistre la liste entière (écriture atomique), après l'avoir vérifiée.
pub fn enregistrer_prereglages(dossier: &std::path::Path, v: &serde_json::Value) -> Result<(), String> {
    verifier_prereglages(v)?;
    let octets = serde_json::to_vec_pretty(v).map_err(|e| e.to_string())?;
    if octets.len() > TAILLE_PREREGLAGES_MAX {
        return Err("préréglages trop gros".into());
    }
    std::fs::create_dir_all(dossier).map_err(|e| format!("dossier des préréglages : {e}"))?;
    crate::fichiers::ecrire_atomiquement(&dossier.join(FICHIER_PREREGLAGES), &octets).map_err(|e| format!("préréglages : {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{Value, json};

    #[test]
    fn les_prereglages_d_alexandre_se_lisent_et_s_enregistrent() {
        let d = std::env::temp_dir().join(format!("eliot-prereglages-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        assert_eq!(lire_prereglages(&d).unwrap(), prereglages_vides());
        let liste = json!({ "version": 1, "prereglages": [{ "id": "a1", "nom": "Mes posts", "reglages": { "contraste": 20, "courbe": { "rgb": [[0, 20], [255, 255]] } } }] });
        enregistrer_prereglages(&d, &liste).unwrap();
        assert_eq!(lire_prereglages(&d).unwrap(), liste);
        let double = json!({ "prereglages": [{ "id": "a", "nom": "x", "reglages": {} }, { "id": "a", "nom": "y", "reglages": {} }] });
        assert!(enregistrer_prereglages(&d, &double).unwrap_err().contains("double"));
        let mauvais = json!({ "prereglages": [{ "id": "b", "nom": "x", "reglages": { "contraste": "fort" } }] });
        assert!(enregistrer_prereglages(&d, &mauvais).is_err());
        assert!(enregistrer_prereglages(&d, &json!({ "prereglages": [{ "id": "c", "nom": " ", "reglages": {} }] })).is_err());
        std::fs::write(d.join(FICHIER_PREREGLAGES), b"{ pas du json").unwrap();
        assert!(lire_prereglages(&d).is_err());
        assert_eq!(std::fs::read(d.join(FICHIER_PREREGLAGES)).unwrap(), b"{ pas du json", "un fichier abîmé n'est pas touché");
        let _ = std::fs::remove_dir_all(&d);
    }

    const ATTENDUS: &str = include_str!("../../src/modele/labo.attendus.json");

    /// Les cas du tableau commun : chacun est une image de 64 × 48 px dont on lit 96 pixels.
    /// La graine du grain de chaque cas (0 : une photo).
    fn graine_du_cas(nom: &str) -> u32 {
        if nom.contains("image 37") { 37 } else { 0 }
    }

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
            ("courbe en S".into(), r(json!({ "courbe": { "rgb": [[0, 0], [64, 46], [192, 210], [255, 255]] } }))),
            ("courbe délavée".into(), r(json!({ "courbe": { "rgb": [[0, 40], [128, 128], [255, 228]] } }))),
            ("courbes par canal".into(), r(json!({ "courbe": { "rouge": [[0, 0], [128, 150], [255, 255]], "vert": [[60, 50]], "bleu": [[0, 30], [255, 220]] } }))),
            ("courbe et exposition".into(), r(json!({ "exposition": 1.2, "contraste": 20, "courbe": { "rgb": [[0, 20], [96, 80], [200, 215], [255, 240]], "bleu": [[0, 12], [255, 245]] }, "saturation": 15 }))),
            ("grain 70, image 37 d'un clip".into(), r(json!({ "grain": 70, "contraste": 10 }))),
            ("étalonnage sarcelle et orange".into(), r(json!({ "etalonnage": { "ombres": { "teinte": 190, "saturation": 45 }, "hautesLumieres": { "teinte": 35, "saturation": 40 } } }))),
            ("sépia".into(), r(json!({ "saturation": -100, "etalonnage": { "ombres": { "teinte": 30, "saturation": 35 }, "tonsMoyens": { "teinte": 35, "saturation": 30 }, "hautesLumieres": { "teinte": 45, "saturation": 25 } } }))),
            ("étalonnage et équilibre".into(), r(json!({ "vibrance": 20, "etalonnage": { "tonsMoyens": { "teinte": 300, "saturation": 60 }, "hautesLumieres": { "teinte": 60, "saturation": 80 }, "equilibre": 70 } }))),
            ("vignetage d'un recadrage".into(), r(json!({ "vignetage": -70, "rognage": { "x": 0.1, "y": 0.15, "largeur": 0.5, "hauteur": 0.6, "angle": 0 } }))),
            ("vignetage d'un recadrage redressé".into(), r(json!({ "vignetage": 50, "contraste": 10, "rognage": { "x": 0.2, "y": 0.1, "largeur": 0.55, "hauteur": 0.7, "angle": 12.5 } }))),
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
                let graine = graine_du_cas(&nom);
                let p = Prepares::new(&r, 64, 48).avec_graine(graine);
                let pixels: Vec<Value> = positions().into_iter().map(|(x, y)| json!({ "x": x, "y": y, "entree": entree(x, y), "sortie": p.pixel(entree(x, y), x, y) })).collect();
                json!({ "nom": nom, "reglages": r, "graine": graine, "largeur": 64, "hauteur": 48, "pixels": pixels })
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
            let p = Prepares::new(&r, 64, 48).avec_graine(a["graine"].as_u64().unwrap_or(0) as u32);
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
    fn le_vignetage_suit_le_cadre_garde() {
        // Le cadre gardé : la moitié droite de l'image (de x = 32 à 64), toute la hauteur.
        let g = Rognage { x: 0.5, y: 0.0, largeur: 0.5, hauteur: 1.0, angle: 0.0 };
        let r = Reglages { vignetage: -100.0, rognage: Some(g), ..Default::default() };
        let p = Prepares::new(&r, 64, 48);
        let gris = [128u8, 128, 128];
        // Le centre du cadre gardé ne bouge pas ; le centre de l'image, au bord gauche du cadre,
        // s'assombrit comme un bord ; un coin du cadre plus encore.
        assert_eq!(p.pixel(gris, 47, 23)[0], 128);
        let bord = p.pixel(gris, 32, 23)[0];
        let coin = p.pixel(gris, 63, 47)[0];
        assert!(bord < 120 && coin < bord, "bord {bord}, coin {coin}");
        // Sans recadrage, le centre de l'image ne bouge pas.
        let sans = Prepares::new(&Reglages { vignetage: -100.0, ..Default::default() }, 64, 48);
        assert_eq!(sans.pixel(gris, 31, 23)[0], 128);
        // Le repère : les coins du cadre vont en (0, 0) et (1, 1), redressé ou non.
        for angle in [0.0f32, 12.5, -30.0] {
            let g = Rognage { x: 0.2, y: 0.1, largeur: 0.5, hauteur: 0.6, angle };
            let m = g.repere(1000.0, 800.0);
            let t = angle.to_radians();
            // Le coin haut gauche du cadre, dans l'original : centre + rotation inverse.
            let (gx, gy) = ((0.2 - 0.5) * 1000.0, (0.1 - 0.5) * 800.0);
            let (ox, oy) = (gx * t.cos() + gy * t.sin() + 500.0, -gx * t.sin() + gy * t.cos() + 400.0);
            let u = m[0] * ox + m[2] * oy + m[4];
            let v = m[1] * ox + m[3] * oy + m[5];
            assert!(u.abs() < 1e-4 && v.abs() < 1e-4, "{angle} : ({u}, {v})");
        }
        // Un recadrage seul ne touche à aucun pixel.
        assert!(Reglages { rognage: Some(g), ..Default::default() }.neutres());
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

    #[test]
    fn la_courbe_fait_ce_qu_elle_dit() {
        let p = |r: Value| Prepares::new(&serde_json::from_value::<Reglages>(r).unwrap(), 64, 48);
        // Une diagonale ne change rien et disparaît du document.
        let diagonale: Reglages = serde_json::from_value(json!({ "courbe": { "rgb": [[0, 0], [100, 100], [255, 255]] } })).unwrap();
        assert!(diagonale.bornes().neutres());
        // Noirs relevés : le noir devient un gris sombre, le blanc baisse un peu.
        let d = p(json!({ "courbe": { "rgb": [[0, 40], [255, 228]] } }));
        assert_eq!(d.pixel([0, 0, 0], 3, 3), [40, 40, 40]);
        assert_eq!(d.pixel([255, 255, 255], 3, 3), [228, 228, 228]);
        // Une courbe en S creuse les ombres et relève les clairs.
        let s = p(json!({ "courbe": { "rgb": [[0, 0], [64, 46], [192, 210], [255, 255]] } }));
        assert!(s.pixel([64, 64, 64], 3, 3)[0].abs_diff(46) <= 1 && s.pixel([192, 192, 192], 3, 3)[0].abs_diff(210) <= 1);
        assert_eq!(s.pixel([128, 128, 128], 3, 3), [128, 128, 128]);
        // Le canal bleu seul : un gris bleuit, les deux autres canaux ne bougent pas.
        let b = p(json!({ "courbe": { "bleu": [[0, 0], [128, 160], [255, 255]] } })).pixel([128, 128, 128], 3, 3);
        assert_eq!((b[0], b[1]), (128, 128));
        assert!(b[2].abs_diff(160) <= 1, "{b:?}");
        // Les bouts manquants sont ajoutés, les points rangés, la dernière sortie l'emporte.
        assert_eq!(normaliser_points(&[[192.0, 200.0], [64.0, 50.0], [64.0, 40.0]]), vec![[0.0, 0.0], [64.0, 40.0], [192.0, 200.0], [255.0, 255.0]]);
        assert_eq!(normaliser_points(&[[300.0, -4.0]]), vec![[0.0, 0.0], [255.0, 0.0]]);
        let beaucoup: Vec<[f32; 2]> = (0..40).map(|i| [i as f32 * 6.0, i as f32 * 6.0 + 3.0]).collect();
        let n = normaliser_points(&beaucoup);
        assert_eq!(n.len(), POINTS_COURBE_MAX);
        assert_eq!(n[n.len() - 1], [255.0, 255.0]);
        // La courbe ne repart jamais en arrière entre deux points qui montent.
        let t = table_courbe(&Courbe { rgb: vec![[0.0, 0.0], [30.0, 120.0], [60.0, 130.0], [255.0, 255.0]], ..Default::default() }).unwrap();
        assert!(t.windows(2).all(|w| w[1][0] >= w[0][0] - 1e-6));
        assert!(t.iter().all(|v| (0.0..=1.0).contains(&v[0])));
    }

    #[test]
    fn l_etalonnage_colore_meme_un_noir_et_blanc() {
        let p = |r: Value| Prepares::new(&serde_json::from_value::<Reglages>(r).unwrap(), 64, 48);
        // Un écart sans luminance : la lumière d'un gris ne bouge pas (à l'arrondi près).
        for (t, s) in [(0.0, 100.0), (35.0, 40.0), (200.0, 70.0), (300.0, 100.0)] {
            let v = vecteur_etalonnage(t, s);
            assert!((v[0] * LUMA[0] + v[1] * LUMA[1] + v[2] * LUMA[2]).abs() < 1e-6, "{t}° : {v:?}");
        }
        // Sépia : un gris devient brun clair, le noir et le blanc restent proches d'eux-mêmes.
        let sepia = p(json!({ "saturation": -100, "etalonnage": { "ombres": { "teinte": 30, "saturation": 35 }, "tonsMoyens": { "teinte": 35, "saturation": 30 }, "hautesLumieres": { "teinte": 45, "saturation": 25 } } }));
        let g = sepia.pixel([200, 60, 60], 3, 3);
        assert!(g[0] > g[1] + 4 && g[1] > g[2] + 4, "{g:?}");
        assert_eq!(sepia.pixel([0, 0, 0], 3, 3), [0, 0, 0]);
        // Ombres bleues, hautes lumières orange : le sombre bleuit, le clair se réchauffe.
        let virage = p(json!({ "etalonnage": { "ombres": { "teinte": 220, "saturation": 60 }, "hautesLumieres": { "teinte": 35, "saturation": 60 } } }));
        let (sombre, clair) = (virage.pixel([50, 50, 50], 3, 3), virage.pixel([210, 210, 210], 3, 3));
        assert!(sombre[2] > sombre[0] + 3 && clair[0] > clair[2] + 3, "{sombre:?} {clair:?}");
        // L'équilibre vers les hautes lumières : un ton moyen prend leur teinte.
        let e = |eq: f32| p(json!({ "etalonnage": { "hautesLumieres": { "teinte": 35, "saturation": 80 }, "equilibre": eq } })).pixel([128, 128, 128], 3, 3);
        assert!(e(80.0)[0] - e(80.0)[2] > e(-80.0)[0] - e(-80.0)[2] + 6, "{:?} {:?}", e(80.0), e(-80.0));
        // Sans force, l'étalonnage sort du document.
        let r: Reglages = serde_json::from_value(json!({ "etalonnage": { "ombres": { "teinte": 120 }, "equilibre": 40 } })).unwrap();
        assert!(r.bornes().neutres());
    }

    #[test]
    fn le_grain_d_un_clip_change_d_une_image_a_l_autre() {
        assert_eq!(graine_du_temps(0.0), 0);
        assert_eq!(graine_du_temps(41.0), 0);
        assert_eq!(graine_du_temps(1000.0 / 24.0), 1);
        assert_eq!(graine_du_temps(1000.0), 24);
        assert_eq!(graine_du_temps(f64::NAN), 0);
        let r = Reglages { grain: 80.0, ..Default::default() };
        let tirer = |graine: u32| {
            let mut img = vec![128u8; 200 * 120 * 4];
            appliquer_graine(&mut img, 200, 120, &r, true, graine);
            img
        };
        let (a, b, a2) = (tirer(3), tirer(4), tirer(3));
        assert_eq!(a, a2, "même graine, même grain");
        let differents = a.chunks(4).zip(b.chunks(4)).filter(|(x, y)| x[0] != y[0]).count();
        assert!(differents > 200 * 120 / 2, "{differents} pixels changent d'une image à l'autre");
        // La graine 0 reste celle d'une photo.
        let mut photo = vec![128u8; 200 * 120 * 4];
        appliquer(&mut photo, 200, 120, &r, true);
        assert_eq!(photo, tirer(0));
    }

    #[test]
    fn la_base_d_un_clip_et_son_image_retouchee() {
        let r: Reglages = serde_json::from_value(json!({ "saturation": -100, "clarte": 40, "vignetage": -50 })).unwrap();
        let pixels: Vec<u8> = (0..80 * 60).flat_map(|i| [200u8, (i % 256) as u8, 40, 255]).collect();
        let base = base_pixels(80, 60, pixels.clone(), &r).unwrap();
        // Sans vignetage : le coin et le centre ont le même gris pour une même entrée.
        assert!(base.chunks(4).all(|c| c[0] == c[1] && c[1] == c[2]));
        assert!(base_pixels(80, 60, vec![0; 10], &r).is_err());
        // Le JPEG retouché : gris, et le vignetage assombrit les coins.
        let mut jpeg = Vec::new();
        let img = image::RgbImage::from_pixel(160, 120, image::Rgb([180, 120, 60]));
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg, 95).encode_image(&img).unwrap();
        let sortie = image::load_from_memory(&retoucher_jpeg(&jpeg, &r, 5).unwrap()).unwrap().to_rgb8();
        let (coin, centre) = (sortie.get_pixel(1, 1), sortie.get_pixel(80, 60));
        assert!(centre[0].abs_diff(centre[2]) <= 3, "{centre:?}");
        assert!(coin[0] + 15 < centre[0], "{coin:?} contre {centre:?}");
    }

    #[test]
    fn les_prereglages_fournis_sont_valides_et_distincts() {
        let liste: Value = serde_json::from_str(include_str!("../../src/modele/prereglages.json")).unwrap();
        let liste = liste["prereglages"].as_array().unwrap();
        assert!((18..=28).contains(&liste.len()), "{} préréglages", liste.len());
        let image = essai(160, 100);
        let mut rendus: Vec<(String, Vec<u8>)> = Vec::new();
        for p in liste {
            let nom = p["nom"].as_str().unwrap().to_string();
            let reglages = &p["reglages"];
            for cle in ["exposition", "nettete", "bruit"] {
                assert!(reglages.get(cle).is_none(), "{nom} : {cle} reste propre à chaque photo");
            }
            let r: Reglages = serde_json::from_value(reglages.clone()).unwrap_or_else(|e| panic!("{nom} : {e}"));
            assert_eq!(r.bornes(), r, "{nom} : des valeurs hors plage");
            assert!(!r.neutres(), "{nom} ne fait rien");
            let mut img = image.clone();
            appliquer(&mut img, 160, 100, &r, true);
            for (autre, rendu) in &rendus {
                let ecart: f32 = img.iter().zip(rendu).map(|(a, b)| (*a as f32 - *b as f32).abs()).sum::<f32>() / img.len() as f32;
                assert!(ecart > 1.0, "{nom} et {autre} se ressemblent trop ({ecart})");
            }
            rendus.push((nom, img));
        }
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
