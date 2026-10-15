//! Les animations d'une page vidéo (étape 4, lots 3 et 4), pour l'export : les mêmes formules
//! que `src/modele/animation.ts`, écrites une seconde fois. Le tableau commun
//! `src/modele/animation.attendus.json` (550 cas, calculés par l'interface) est relu par les
//! tests : les deux côtés doivent tomber sur les mêmes valeurs, à un millionième près.
//!
//! L'état d'un élément à un instant se lit en deux parts : sa pose (position, échelle,
//! rotation, opacité), donnée par ses images clés, et un effet posé par-dessus, autour de son
//! centre, donné par ses animations et les transitions.

use std::collections::HashMap;
use std::f64::consts::PI;

use serde::Deserialize;

// ---- Ce que le document en dit ----

#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
pub struct Temps {
    pub debut: f64,
    pub fin: f64,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct Animation {
    pub nom: String,
    pub duree: f64,
}

#[derive(Debug, Clone, Default, Deserialize, PartialEq)]
pub struct Animations {
    pub entree: Option<Animation>,
    pub sortie: Option<Animation>,
    pub boucle: Option<Animation>,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct Cle {
    pub t: f64,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub echelle: Option<f64>,
    pub rotation: Option<f64>,
    pub opacite: Option<f64>,
    pub courbe: Option<String>,
}

/// Les champs d'un élément qui comptent pour l'animation et le son (le reste du document est
/// ignoré).
#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ElementAnime {
    #[serde(default)]
    pub id: String,
    #[serde(rename = "type", default)]
    pub genre: String,
    pub x: f64,
    pub y: f64,
    pub largeur: f64,
    pub hauteur: f64,
    #[serde(default)]
    pub rotation: f64,
    #[serde(default = "un")]
    pub opacite: f64,
    #[serde(default = "vrai")]
    pub visible: bool,
    pub temps: Option<Temps>,
    pub piste: Option<f64>,
    pub animations: Option<Animations>,
    pub cles: Option<Vec<Cle>>,
    pub transition: Option<Animation>,
    pub volume: Option<f64>,
    pub fondu_entree: Option<f64>,
    pub fondu_sortie: Option<f64>,
    pub taille_police: Option<f64>,
}

fn un() -> f64 {
    1.0
}
fn vrai() -> bool {
    true
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
pub struct Format {
    pub largeur: f64,
    pub hauteur: f64,
}

/// Une transition vue d'un clip : son nom et la fenêtre où les deux clips se chevauchent.
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct Fenetre {
    pub nom: String,
    pub debut: f64,
    pub fin: f64,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Contexte {
    pub format: Format,
    pub transition_entree: Option<Fenetre>,
    pub transition_sortie: Option<Fenetre>,
}

// ---- Courbes ----

fn borne(v: f64) -> f64 {
    v.clamp(0.0, 1.0)
}

pub fn douce(p: f64) -> f64 {
    p * p * (3.0 - 2.0 * p)
}
pub fn sortie_cubique(p: f64) -> f64 {
    1.0 - (1.0 - p).powi(3)
}
pub fn entree_cubique(p: f64) -> f64 {
    p.powi(3)
}
const C1: f64 = 1.70158;
const C3: f64 = C1 + 1.0;
pub fn dos(p: f64) -> f64 {
    1.0 + C3 * (p - 1.0).powi(3) + C1 * (p - 1.0).powi(2)
}
pub fn rebondi(p: f64) -> f64 {
    let n = 7.5625;
    let d = 2.75;
    if p < 1.0 / d {
        n * p * p
    } else if p < 2.0 / d {
        n * (p - 1.5 / d).powi(2) + 0.75
    } else if p < 2.5 / d {
        n * (p - 2.25 / d).powi(2) + 0.9375
    } else {
        n * (p - 2.625 / d).powi(2) + 0.984375
    }
}

// ---- Effets ----

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Repere {
    Element,
    Page,
}

/// Une bande verticale visible, de `debut` à `fin` (fractions de la largeur de l'élément ou de
/// la page).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Volet {
    pub repere: Repere,
    pub debut: f64,
    pub fin: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GenreUnites {
    MachineAEcrire,
    Lettres,
    Mots,
    Lignes,
}

impl GenreUnites {
    pub fn depuis_nom(nom: &str) -> Option<Self> {
        match nom {
            "machine-a-ecrire" => Some(Self::MachineAEcrire),
            "lettres" => Some(Self::Lettres),
            "mots" => Some(Self::Mots),
            "lignes" => Some(Self::Lignes),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Sens {
    Entree,
    Sortie,
}

/// Un texte qui apparaît par morceaux : `p` va de 0 à 1 pendant l'animation.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Unites {
    pub genre: GenreUnites,
    pub sens: Sens,
    pub p: f64,
}

/// Ce que les animations posent sur l'élément, autour de son centre.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Effet {
    pub dx: f64,
    pub dy: f64,
    pub echelle: f64,
    pub rotation: f64,
    pub opacite: f64,
    pub volet: Option<Volet>,
    pub unites: Option<Unites>,
}

pub const EFFET_NEUTRE: Effet = Effet { dx: 0.0, dy: 0.0, echelle: 1.0, rotation: 0.0, opacite: 1.0, volet: None, unites: None };

/// Une part d'effet : les champs absents ne changent rien.
#[derive(Debug, Clone, Copy, Default)]
struct Part {
    dx: Option<f64>,
    dy: Option<f64>,
    echelle: Option<f64>,
    rotation: Option<f64>,
    opacite: Option<f64>,
    volet: Option<Volet>,
    unites: Option<Unites>,
}

fn ajouter(effet: &mut Effet, m: Part) {
    if let Some(v) = m.dx.filter(|v| *v != 0.0) {
        effet.dx += v;
    }
    if let Some(v) = m.dy.filter(|v| *v != 0.0) {
        effet.dy += v;
    }
    if let Some(v) = m.echelle {
        effet.echelle *= v;
    }
    if let Some(v) = m.rotation.filter(|v| *v != 0.0) {
        effet.rotation += v;
    }
    if let Some(v) = m.opacite {
        effet.opacite *= v;
    }
    if m.volet.is_some() {
        effet.volet = m.volet;
    }
    if m.unites.is_some() {
        effet.unites = m.unites;
    }
}

const GLISSEMENT: f64 = 0.15;
const CHUTE: f64 = 0.35;

fn unites(nom: &str, sens: Sens, p: f64) -> Part {
    Part { unites: GenreUnites::depuis_nom(nom).map(|genre| Unites { genre, sens, p }), ..Part::default() }
}

fn effet_entree(nom: &str, p: f64, f: Format) -> Part {
    let e = sortie_cubique(p);
    let apparait = borne(2.0 * p);
    match nom {
        "fondu" => Part { opacite: Some(p), ..Part::default() },
        "glissement-haut" => Part { dy: Some((1.0 - e) * GLISSEMENT * f.hauteur), opacite: Some(apparait), ..Part::default() },
        "glissement-bas" => Part { dy: Some(-(1.0 - e) * GLISSEMENT * f.hauteur), opacite: Some(apparait), ..Part::default() },
        "glissement-gauche" => Part { dx: Some((1.0 - e) * GLISSEMENT * f.largeur), opacite: Some(apparait), ..Part::default() },
        "glissement-droite" => Part { dx: Some(-(1.0 - e) * GLISSEMENT * f.largeur), opacite: Some(apparait), ..Part::default() },
        "zoom" => Part { echelle: Some(0.3 + 0.7 * e), opacite: Some(apparait), ..Part::default() },
        "zoom-arriere" => Part { echelle: Some(1.6 - 0.6 * e), opacite: Some(p), ..Part::default() },
        "rebond" => Part { echelle: Some(dos(p).max(0.0)), opacite: Some(borne(4.0 * p)), ..Part::default() },
        "chute" => Part { dy: Some(-(1.0 - rebondi(p)) * CHUTE * f.hauteur), opacite: Some(borne(4.0 * p)), ..Part::default() },
        "tourbillon" => Part { rotation: Some(-180.0 * (1.0 - e)), echelle: Some(0.2 + 0.8 * e), opacite: Some(apparait), ..Part::default() },
        "volet" => Part { volet: Some(Volet { repere: Repere::Element, debut: 0.0, fin: e }), ..Part::default() },
        autre => unites(autre, Sens::Entree, p),
    }
}

fn effet_sortie(nom: &str, q: f64, f: Format) -> Part {
    let x = entree_cubique(q);
    let reste = borne(2.0 * (1.0 - q));
    match nom {
        "fondu" => Part { opacite: Some(1.0 - q), ..Part::default() },
        "glissement-haut" => Part { dy: Some(-x * GLISSEMENT * f.hauteur), opacite: Some(reste), ..Part::default() },
        "glissement-bas" => Part { dy: Some(x * GLISSEMENT * f.hauteur), opacite: Some(reste), ..Part::default() },
        "glissement-gauche" => Part { dx: Some(-x * GLISSEMENT * f.largeur), opacite: Some(reste), ..Part::default() },
        "glissement-droite" => Part { dx: Some(x * GLISSEMENT * f.largeur), opacite: Some(reste), ..Part::default() },
        "zoom" => Part { echelle: Some(1.0 - 0.7 * x), opacite: Some(reste), ..Part::default() },
        "zoom-arriere" => Part { echelle: Some(1.0 + 0.6 * x), opacite: Some(1.0 - q), ..Part::default() },
        "rebond" => Part { echelle: Some(dos(1.0 - q).max(0.0)), opacite: Some(borne(4.0 * (1.0 - q))), ..Part::default() },
        "chute" => Part { dy: Some(x * CHUTE * f.hauteur), opacite: Some(1.0 - q), ..Part::default() },
        "tourbillon" => Part { rotation: Some(180.0 * x), echelle: Some(1.0 - 0.8 * x), opacite: Some(reste), ..Part::default() },
        "volet" => Part { volet: Some(Volet { repere: Repere::Element, debut: x, fin: 1.0 }), ..Part::default() },
        autre => unites(autre, Sens::Sortie, q),
    }
}

fn bosse(ph: f64, c: f64) -> f64 {
    if (ph - c).abs() < 0.1 { (PI * (ph - c + 0.1) / 0.2).sin() } else { 0.0 }
}

fn effet_boucle(a: &Animation, tr: f64, longueur: f64, f: Format) -> Part {
    let periode = a.duree.max(100.0);
    let u = tr / periode;
    let w = 2.0 * PI * u;
    let phase = u - u.floor();
    match a.nom.as_str() {
        "pulsation" => Part { echelle: Some(1.0 + 0.06 * w.sin()), ..Part::default() },
        "battement" => Part { echelle: Some(1.0 + 0.08 * (bosse(phase, 0.15) + 0.6 * bosse(phase, 0.4))), ..Part::default() },
        "flottement" => Part { dy: Some(-0.01 * f.hauteur * w.sin()), ..Part::default() },
        "balancement" => Part { rotation: Some(5.0 * w.sin()), ..Part::default() },
        "tremblement" => Part { dx: Some(0.006 * f.largeur * (3.0 * w).sin()), dy: Some(0.006 * f.largeur * (2.0 * w + 1.0).sin()), ..Part::default() },
        "clignotement" => Part { opacite: Some(0.6 + 0.4 * w.cos()), ..Part::default() },
        "rotation" => Part { rotation: Some(360.0 * u), ..Part::default() },
        "zoom-lent" => Part { echelle: Some(1.0 + 0.15 * borne(tr / longueur.max(1.0))), ..Part::default() },
        _ => Part::default(),
    }
}

fn effet_transition(nom: &str, entrant: bool, p: f64, f: Format) -> Part {
    let s = douce(p);
    match nom {
        "fondu" if entrant => Part { opacite: Some(p), ..Part::default() },
        "glissement" => Part { dx: Some(if entrant { (1.0 - s) * f.largeur } else { -s * f.largeur }), ..Part::default() },
        "zoom" if entrant => Part { echelle: Some(0.85 + 0.15 * s), opacite: Some(p), ..Part::default() },
        "zoom" => Part { echelle: Some(1.0 + 0.25 * s), ..Part::default() },
        "volet" if entrant => Part { volet: Some(Volet { repere: Repere::Page, debut: 0.0, fin: s }), ..Part::default() },
        _ => Part::default(),
    }
}

/// Un morceau de texte (lettre, mot ou ligne `i` sur `n`) pendant une animation par morceaux :
/// opacité, décalage vers le bas en tailles de police, échelle.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EtatUnite {
    pub opacite: f64,
    pub dy_em: f64,
    pub echelle: f64,
}

pub fn etat_unite(u: Unites, i: f64, n: f64) -> EtatUnite {
    if n <= 0.0 {
        return EtatUnite { opacite: 1.0, dy_em: 0.0, echelle: 1.0 };
    }
    if u.genre == GenreUnites::MachineAEcrire {
        let visibles = if u.sens == Sens::Entree { u.p * n } else { (1.0 - u.p) * n };
        return EtatUnite { opacite: if visibles > i { 1.0 } else { 0.0 }, dy_em: 0.0, echelle: 1.0 };
    }
    let (largeur, amplitude) = match u.genre {
        GenreUnites::Lettres => (0.3, 0.35),
        GenreUnites::Mots => (0.45, 0.5),
        _ => (0.6, 0.7),
    };
    let lettres = u.genre == GenreUnites::Lettres;
    let w = if n > 1.0 { largeur } else { 1.0 };
    let debut = if n > 1.0 { i * (1.0 - w) / (n - 1.0) } else { 0.0 };
    let local = borne((u.p - debut) / w);
    if u.sens == Sens::Entree {
        let e = sortie_cubique(local);
        EtatUnite { opacite: local, dy_em: amplitude * (1.0 - e), echelle: if lettres { 0.6 + 0.4 * e } else { 1.0 } }
    } else {
        let x = entree_cubique(local);
        EtatUnite { opacite: 1.0 - local, dy_em: -amplitude * x, echelle: if lettres { 1.0 - 0.4 * x } else { 1.0 } }
    }
}

// ---- Transitions de la page ----

/// Les transitions de la piste principale, vues de chaque clip concerné : (entrée, sortie).
pub fn contextes_transitions(elements: &[ElementAnime]) -> HashMap<String, (Option<Fenetre>, Option<Fenetre>)> {
    let mut sortie: HashMap<String, (Option<Fenetre>, Option<Fenetre>)> = HashMap::new();
    let mut principale: Vec<&ElementAnime> = elements.iter().filter(|e| e.piste == Some(0.0) && e.temps.is_some()).collect();
    principale.sort_by(|a, b| a.temps.unwrap().debut.total_cmp(&b.temps.unwrap().debut));
    for paire in principale.windows(2) {
        let (a, b) = (paire[0], paire[1]);
        let (ta, tb) = (a.temps.unwrap(), b.temps.unwrap());
        let Some(tr) = &b.transition else { continue };
        if tb.debut >= ta.fin {
            continue;
        }
        let fenetre = Fenetre { nom: tr.nom.clone(), debut: tb.debut, fin: ta.fin };
        sortie.entry(b.id.clone()).or_default().0 = Some(fenetre.clone());
        sortie.entry(a.id.clone()).or_default().1 = Some(fenetre);
    }
    sortie
}

/// Durées d'entrée et de sortie, réduites ensemble si elles dépassent la longueur du clip.
pub fn durees_entree_sortie(el: &ElementAnime) -> (f64, f64) {
    let a = el.animations.as_ref();
    let entree = a.and_then(|a| a.entree.as_ref()).map_or(0.0, |x| x.duree.max(0.0));
    let sortie = a.and_then(|a| a.sortie.as_ref()).map_or(0.0, |x| x.duree.max(0.0));
    let longueur = el.temps.map_or(f64::INFINITY, |t| t.fin - t.debut);
    if entree + sortie <= longueur {
        return (entree, sortie);
    }
    let f = longueur / (entree + sortie);
    (entree * f, sortie * f)
}

/// L'effet des animations et des transitions sur l'élément à l'instant `t` de la page.
pub fn effet_a(el: &ElementAnime, t: f64, ctx: &Contexte) -> Effet {
    let mut effet = EFFET_NEUTRE;
    let Some(temps) = el.temps else { return effet };
    let longueur = temps.fin - temps.debut;
    let tr = t - temps.debut;
    let (entree, sortie) = durees_entree_sortie(el);
    if let Some(a) = &el.animations {
        if let Some(x) = &a.entree {
            if entree > 0.0 && tr < entree {
                ajouter(&mut effet, effet_entree(&x.nom, borne(tr / entree), ctx.format));
            }
        }
        if let Some(x) = &a.sortie {
            if sortie > 0.0 && tr > longueur - sortie {
                ajouter(&mut effet, effet_sortie(&x.nom, borne((tr - (longueur - sortie)) / sortie), ctx.format));
            }
        }
        if let Some(x) = &a.boucle {
            ajouter(&mut effet, effet_boucle(x, tr, longueur, ctx.format));
        }
    }
    if let Some(te) = &ctx.transition_entree {
        if t < te.fin {
            ajouter(&mut effet, effet_transition(&te.nom, true, borne((t - te.debut) / (te.fin - te.debut).max(1.0)), ctx.format));
        }
    }
    if let Some(ts) = &ctx.transition_sortie {
        if t >= ts.debut {
            ajouter(&mut effet, effet_transition(&ts.nom, false, borne((t - ts.debut) / (ts.fin - ts.debut).max(1.0)), ctx.format));
        }
    }
    effet
}

// ---- Images clés ----

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Pose {
    pub x: f64,
    pub y: f64,
    pub echelle: f64,
    pub rotation: f64,
    pub opacite: f64,
}

struct Jalon {
    t: f64,
    lineaire: bool,
    valeur: f64,
}

/// La valeur d'un canal à l'instant `t`, d'après les jalons qui le donnent (triés).
fn valeur_canal(jalons: &[Jalon], t: f64, base: f64) -> f64 {
    let Some(premier) = jalons.first() else { return base };
    if t <= premier.t {
        return premier.valeur;
    }
    for paire in jalons.windows(2) {
        let (a, b) = (&paire[0], &paire[1]);
        if t < b.t {
            let u = (t - a.t) / (b.t - a.t);
            let k = if a.lineaire { u } else { douce(u) };
            return a.valeur + (b.valeur - a.valeur) * k;
        }
    }
    jalons.last().unwrap().valeur
}

fn jalons(cles: &[Cle], lire: impl Fn(&Cle) -> Option<f64>) -> Vec<Jalon> {
    cles.iter().filter_map(|c| lire(c).map(|valeur| Jalon { t: c.t, lineaire: c.courbe.as_deref() == Some("lineaire"), valeur })).collect()
}

fn centre_de(x: f64, y: f64, l: f64, h: f64, e: f64, r: f64) -> (f64, f64) {
    let a = r * PI / 180.0;
    let (hx, hy) = (l * e / 2.0, h * e / 2.0);
    (x + hx * a.cos() - hy * a.sin(), y + hx * a.sin() + hy * a.cos())
}

/// La pose de l'élément `tr` ms après le début de son clip, d'après ses images clés.
pub fn pose_a(el: &ElementAnime, tr: f64) -> Pose {
    let Some(brutes) = el.cles.as_ref().filter(|c| !c.is_empty()) else {
        return Pose { x: el.x, y: el.y, echelle: 1.0, rotation: el.rotation, opacite: el.opacite };
    };
    let mut cles = brutes.clone();
    cles.sort_by(|a, b| a.t.total_cmp(&b.t));
    let echelles = jalons(&cles, |c| c.echelle);
    let rotations = jalons(&cles, |c| c.rotation);
    let echelle_a = |t: f64| valeur_canal(&echelles, t, 1.0).max(0.01);
    let rotation_a = |t: f64| valeur_canal(&rotations, t, el.rotation);
    let echelle = echelle_a(tr);
    let rotation = rotation_a(tr);
    let opacite = borne(valeur_canal(&jalons(&cles, |c| c.opacite), tr, el.opacite));
    let positions: Vec<&Cle> = cles.iter().filter(|c| c.x.is_some() && c.y.is_some()).collect();
    let (cx, cy) = if positions.is_empty() {
        centre_de(el.x, el.y, el.largeur, el.hauteur, 1.0, el.rotation)
    } else {
        let centres: Vec<(f64, bool, (f64, f64))> = positions
            .iter()
            .map(|c| (c.t, c.courbe.as_deref() == Some("lineaire"), centre_de(c.x.unwrap(), c.y.unwrap(), el.largeur, el.hauteur, echelle_a(c.t), rotation_a(c.t))))
            .collect();
        let jx: Vec<Jalon> = centres.iter().map(|(t, l, c)| Jalon { t: *t, lineaire: *l, valeur: c.0 }).collect();
        let jy: Vec<Jalon> = centres.iter().map(|(t, l, c)| Jalon { t: *t, lineaire: *l, valeur: c.1 }).collect();
        (valeur_canal(&jx, tr, 0.0), valeur_canal(&jy, tr, 0.0))
    };
    let a = rotation * PI / 180.0;
    let (hx, hy) = (el.largeur * echelle / 2.0, el.hauteur * echelle / 2.0);
    Pose { x: cx - (hx * a.cos() - hy * a.sin()), y: cy - (hx * a.sin() + hy * a.cos()), echelle, rotation, opacite }
}

/// Pose et effet de l'élément à l'instant `t` de la page.
pub fn etat_anime(el: &ElementAnime, t: f64, ctx: &Contexte) -> (Pose, Effet) {
    let tr = el.temps.map_or(0.0, |temps| t - temps.debut);
    (pose_a(el, tr), effet_a(el, t, ctx))
}

/// Le volume d'une vidéo à l'instant `t` : son volume, ses fondus et ceux des transitions.
pub fn gain_son(el: &ElementAnime, t: f64, ctx: &Contexte) -> f64 {
    let mut v = el.volume.unwrap_or(1.0);
    let Some(temps) = el.temps else { return borne(v) };
    let tr = t - temps.debut;
    let longueur = temps.fin - temps.debut;
    let fi = el.fondu_entree.unwrap_or(0.0);
    let fo = el.fondu_sortie.unwrap_or(0.0);
    if fi > 0.0 && tr < fi {
        v *= borne(tr / fi);
    }
    if fo > 0.0 && tr > longueur - fo {
        v *= borne((longueur - tr) / fo);
    }
    if let Some(te) = &ctx.transition_entree {
        if t < te.fin {
            v *= borne((t - te.debut) / (te.fin - te.debut).max(1.0));
        }
    }
    if let Some(ts) = &ctx.transition_sortie {
        if t >= ts.debut {
            v *= borne((ts.fin - t) / (ts.fin - ts.debut).max(1.0));
        }
    }
    borne(v)
}

/// L'agrandissement le plus fort que l'élément peut prendre (images clés, animations,
/// transition en zoom) : ses calques se dessinent d'autant plus fins, pour rester nets.
pub fn agrandissement_max(el: &ElementAnime, ctx: &Contexte) -> f64 {
    let cles = el.cles.as_ref().map_or(1.0, |c| c.iter().filter_map(|c| c.echelle).fold(1.0, f64::max));
    let mut effets: f64 = 1.0;
    if let Some(a) = &el.animations {
        if a.entree.as_ref().is_some_and(|x| x.nom == "zoom-arriere") {
            effets = effets.max(1.6);
        }
        if a.sortie.as_ref().is_some_and(|x| x.nom == "zoom-arriere") {
            effets = effets.max(1.6);
        }
        if a.entree.as_ref().is_some_and(|x| x.nom == "rebond") || a.sortie.as_ref().is_some_and(|x| x.nom == "rebond") {
            effets = effets.max(1.11);
        }
        if let Some(b) = &a.boucle {
            effets *= match b.nom.as_str() {
                "zoom-lent" => 1.15,
                "battement" => 1.08,
                "pulsation" => 1.06,
                _ => 1.0,
            };
        }
    }
    if ctx.transition_sortie.as_ref().is_some_and(|f| f.nom == "zoom") {
        effets = effets.max(1.25);
    }
    (cles * effets).clamp(1.0, 2.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    const ATTENDUS: &str = include_str!("../../src/modele/animation.attendus.json");

    fn nombre(v: &Value) -> f64 {
        v.as_f64().unwrap_or_else(|| panic!("nombre attendu : {v}"))
    }

    fn proche(nom: &str, calcule: f64, attendu: &Value, ecarts: &mut Vec<String>) {
        let a = nombre(attendu);
        if (calcule - a).abs() > 2e-6 {
            ecarts.push(format!("{nom} : {calcule} au lieu de {a}"));
        }
    }

    #[test]
    fn les_formules_retrouvent_le_tableau_commun() {
        let tableau: Value = serde_json::from_str(ATTENDUS).unwrap();
        let cas = tableau["cas"].as_array().unwrap();
        assert_eq!(cas.len(), 550, "le tableau a changé de taille : régénérer et vérifier");
        let mut ecarts = Vec::new();
        for (i, c) in cas.iter().enumerate() {
            match c["genre"].as_str().unwrap() {
                "element" => {
                    let el: ElementAnime = serde_json::from_value(c["element"].clone()).unwrap();
                    let ctx: Contexte = serde_json::from_value(c["contexte"].clone()).unwrap();
                    let t = nombre(&c["t"]);
                    let (pose, effet) = etat_anime(&el, t, &ctx);
                    let p = &c["pose"];
                    for (nom, v) in [("x", pose.x), ("y", pose.y), ("echelle", pose.echelle), ("rotation", pose.rotation), ("opacite", pose.opacite)] {
                        proche(&format!("cas {i} pose.{nom}"), v, &p[nom], &mut ecarts);
                    }
                    let e = &c["effet"];
                    for (nom, v) in [("dx", effet.dx), ("dy", effet.dy), ("echelle", effet.echelle), ("rotation", effet.rotation), ("opacite", effet.opacite)] {
                        proche(&format!("cas {i} effet.{nom}"), v, &e[nom], &mut ecarts);
                    }
                    match (&effet.volet, e.get("volet")) {
                        (None, None) => {}
                        (Some(v), Some(a)) => {
                            let repere = if v.repere == Repere::Page { "page" } else { "element" };
                            if a["repere"] != repere {
                                ecarts.push(format!("cas {i} volet.repere"));
                            }
                            proche(&format!("cas {i} volet.debut"), v.debut, &a["debut"], &mut ecarts);
                            proche(&format!("cas {i} volet.fin"), v.fin, &a["fin"], &mut ecarts);
                        }
                        _ => ecarts.push(format!("cas {i} : volet présent d'un seul côté")),
                    }
                    match (&effet.unites, e.get("unites")) {
                        (None, None) => {}
                        (Some(u), Some(a)) => {
                            let sens = if u.sens == Sens::Entree { "entree" } else { "sortie" };
                            if a["sens"] != sens || GenreUnites::depuis_nom(a["genre"].as_str().unwrap()) != Some(u.genre) {
                                ecarts.push(format!("cas {i} unites"));
                            }
                            proche(&format!("cas {i} unites.p"), u.p, &a["p"], &mut ecarts);
                        }
                        _ => ecarts.push(format!("cas {i} : unités présentes d'un seul côté")),
                    }
                    if let Some(g) = c.get("gain") {
                        proche(&format!("cas {i} gain"), gain_son(&el, t, &ctx), g, &mut ecarts);
                    }
                }
                "unite" => {
                    let u = &c["unites"];
                    let unites = Unites {
                        genre: GenreUnites::depuis_nom(u["genre"].as_str().unwrap()).unwrap(),
                        sens: if u["sens"] == "entree" { Sens::Entree } else { Sens::Sortie },
                        p: nombre(&u["p"]),
                    };
                    let e = etat_unite(unites, nombre(&c["i"]), nombre(&c["n"]));
                    let a = &c["etat"];
                    proche(&format!("cas {i} opacite"), e.opacite, &a["opacite"], &mut ecarts);
                    proche(&format!("cas {i} dyEm"), e.dy_em, &a["dyEm"], &mut ecarts);
                    proche(&format!("cas {i} echelle"), e.echelle, &a["echelle"], &mut ecarts);
                }
                autre => panic!("genre de cas inconnu : {autre}"),
            }
        }
        assert!(ecarts.is_empty(), "{} écarts, dont : {:?}", ecarts.len(), &ecarts[..ecarts.len().min(10)]);
    }

    #[test]
    fn transitions_vues_des_deux_clips() {
        let el = |id: &str, debut: f64, fin: f64, transition: Option<&str>| ElementAnime {
            id: id.into(),
            genre: "video".into(),
            x: 0.0,
            y: 0.0,
            largeur: 10.0,
            hauteur: 10.0,
            rotation: 0.0,
            opacite: 1.0,
            visible: true,
            temps: Some(Temps { debut, fin }),
            piste: Some(0.0),
            animations: None,
            cles: None,
            transition: transition.map(|n| Animation { nom: n.into(), duree: 1000.0 }),
            volume: None,
            fondu_entree: None,
            fondu_sortie: None,
            taille_police: None,
        };
        let page = [el("a", 0.0, 4000.0, None), el("b", 3000.0, 7000.0, Some("fondu"))];
        let c = contextes_transitions(&page);
        assert_eq!(c["b"].0.as_ref().unwrap(), &Fenetre { nom: "fondu".into(), debut: 3000.0, fin: 4000.0 });
        assert_eq!(c["a"].1.as_ref().unwrap().debut, 3000.0);
        assert!(c["a"].0.is_none());
    }
}
