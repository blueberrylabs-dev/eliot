// Les animations d'une page vidéo (étape 4, lot 3), en fonctions pures : animations d'entrée,
// de sortie et en boucle, textes qui entrent par lettres, mots ou lignes, images clés,
// transitions entre deux clips de la piste principale, fondus du son.
//
// L'état d'un élément à un instant se lit en deux temps :
// - sa pose (position, échelle, rotation, opacité), que donnent ses images clés ; c'est ce que
//   montre l'éditeur quand l'élément est choisi, et ce que les gestes modifient ;
// - un effet posé par-dessus (décalage, échelle et rotation autour du centre, opacité, volet,
//   apparition des lettres), que donnent les animations et les transitions.
//
// Les mêmes formules serviront au Rust pour l'export MP4 (lot 4) : le tableau
// `animation.attendus.json` donne des valeurs calculées ici, que les deux côtés vérifient.

import { angleNormalise, normaliserCamera } from "./objet3d";
import type { Animation, Camera3d, CleAnimation, ElementPage, ElementVideo, Format, PageEliot } from "./types";

// ---- Courbes (p de 0 à 1) ----

/** Départ et arrivée en douceur. */
export const douce = (p: number) => p * p * (3 - 2 * p);
/** Rapide puis ralentit : pour ce qui arrive. */
export const sortieCubique = (p: number) => 1 - (1 - p) ** 3;
/** Lent puis accélère : pour ce qui part. */
export const entreeCubique = (p: number) => p ** 3;
const C1 = 1.70158;
const C3 = C1 + 1;
/** Dépasse un peu l'arrivée puis y revient (de 0 à 1, avec un sommet vers 1,1). */
export const dos = (p: number) => 1 + C3 * (p - 1) ** 3 + C1 * (p - 1) ** 2;
/** Rebondit sur l'arrivée, comme une balle. */
export function rebondi(p: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (p < 1 / d) return n * p * p;
  if (p < 2 / d) return n * (p - 1.5 / d) ** 2 + 0.75;
  if (p < 2.5 / d) return n * (p - 2.25 / d) ** 2 + 0.9375;
  return n * (p - 2.625 / d) ** 2 + 0.984375;
}
const borne = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));

// ---- Catalogue ----

export type GenreAnimation = "entree" | "sortie" | "boucle";

export interface DefinitionAnimation {
  nom: string;
  libelle: string;
  /** Durée par défaut (ms) ; pour une boucle, la durée d'un tour. */
  duree: number;
  /** Seulement pour un texte (il entre par morceaux). */
  texte?: boolean;
}

export const ENTREES: DefinitionAnimation[] = [
  { nom: "fondu", libelle: "Fondu", duree: 500 },
  { nom: "glissement-haut", libelle: "Monte", duree: 600 },
  { nom: "glissement-bas", libelle: "Descend", duree: 600 },
  { nom: "glissement-gauche", libelle: "Arrive de droite", duree: 600 },
  { nom: "glissement-droite", libelle: "Arrive de gauche", duree: 600 },
  { nom: "zoom", libelle: "Grossit", duree: 600 },
  { nom: "zoom-arriere", libelle: "Rétrécit", duree: 600 },
  { nom: "rebond", libelle: "Rebond", duree: 800 },
  { nom: "chute", libelle: "Tombe", duree: 900 },
  { nom: "tourbillon", libelle: "Tourbillon", duree: 800 },
  { nom: "volet", libelle: "Volet", duree: 700 },
  { nom: "machine-a-ecrire", libelle: "Machine à écrire", duree: 1500, texte: true },
  { nom: "lettres", libelle: "Lettre par lettre", duree: 1200, texte: true },
  { nom: "mots", libelle: "Mot par mot", duree: 1200, texte: true },
  { nom: "lignes", libelle: "Ligne par ligne", duree: 1000, texte: true },
];

export const SORTIES: DefinitionAnimation[] = [
  { nom: "fondu", libelle: "Fondu", duree: 500 },
  { nom: "glissement-haut", libelle: "Part en haut", duree: 600 },
  { nom: "glissement-bas", libelle: "Part en bas", duree: 600 },
  { nom: "glissement-gauche", libelle: "Part à gauche", duree: 600 },
  { nom: "glissement-droite", libelle: "Part à droite", duree: 600 },
  { nom: "zoom", libelle: "Rétrécit", duree: 600 },
  { nom: "zoom-arriere", libelle: "Grossit", duree: 600 },
  { nom: "rebond", libelle: "Rebond", duree: 700 },
  { nom: "chute", libelle: "Tombe", duree: 800 },
  { nom: "tourbillon", libelle: "Tourbillon", duree: 800 },
  { nom: "volet", libelle: "Volet", duree: 700 },
  { nom: "machine-a-ecrire", libelle: "Machine à écrire", duree: 1000, texte: true },
  { nom: "lettres", libelle: "Lettre par lettre", duree: 1000, texte: true },
  { nom: "mots", libelle: "Mot par mot", duree: 1000, texte: true },
  { nom: "lignes", libelle: "Ligne par ligne", duree: 800, texte: true },
];

export const BOUCLES: DefinitionAnimation[] = [
  { nom: "pulsation", libelle: "Pulsation", duree: 1000 },
  { nom: "battement", libelle: "Battement de cœur", duree: 1200 },
  { nom: "flottement", libelle: "Flottement", duree: 2400 },
  { nom: "balancement", libelle: "Balancement", duree: 1600 },
  { nom: "tremblement", libelle: "Tremblement", duree: 500 },
  { nom: "clignotement", libelle: "Clignotement", duree: 1000 },
  { nom: "rotation", libelle: "Rotation", duree: 3000 },
  { nom: "zoom-lent", libelle: "Zoom lent", duree: 0 },
];

export const CATALOGUE: Record<GenreAnimation, DefinitionAnimation[]> = { entree: ENTREES, sortie: SORTIES, boucle: BOUCLES };

export interface DefinitionTransition {
  nom: string;
  libelle: string;
}

export const TRANSITIONS: DefinitionTransition[] = [
  { nom: "fondu", libelle: "Fondu enchaîné" },
  { nom: "glissement", libelle: "Glissement" },
  { nom: "zoom", libelle: "Zoom" },
  { nom: "volet", libelle: "Volet" },
];
export const DUREE_TRANSITION = 500;

export const definitionAnimation = (genre: GenreAnimation, nom: string) => CATALOGUE[genre].find((d) => d.nom === nom);

/** Les animations par morceaux de texte. */
export type GenreUnites = "machine-a-ecrire" | "lettres" | "mots" | "lignes";
const UNITES: readonly string[] = ["machine-a-ecrire", "lettres", "mots", "lignes"];
export const estAnimationUnites = (nom: string | undefined): nom is GenreUnites => nom !== undefined && UNITES.includes(nom);

/** Un texte a-t-il une animation par morceaux (en entrée ou en sortie) ? */
export const aDesUnites = (el: ElementPage) => el.type === "texte" && (estAnimationUnites(el.animations?.entree?.nom) || estAnimationUnites(el.animations?.sortie?.nom));

/** La durée conseillée d'une animation pour cet élément : celle du catalogue, ou, pour un
 *  texte qui entre par morceaux, une durée qui suit sa longueur. */
export function dureeConseillee(genre: GenreAnimation, nom: string, el: ElementPage): number {
  const def = definitionAnimation(genre, nom);
  const base = def?.duree ?? 500;
  if (el.type !== "texte" || !estAnimationUnites(nom)) return base;
  const lettres = Array.from(el.texte.replace(/\s+/g, "")).length;
  const mots = el.texte.split(/\s+/).filter(Boolean).length;
  const sortie = genre === "sortie" ? 0.7 : 1;
  const brute = nom === "machine-a-ecrire" ? 50 * lettres : nom === "lettres" ? 35 * lettres + 400 : nom === "mots" ? 180 * mots + 300 : base;
  return Math.round(borne(brute * sortie, 500, 4000) / 100) * 100;
}

// ---- Effets ----

/** Une bande verticale visible, de `debut` à `fin` (fractions de la largeur de l'élément, ou
 *  de la page) : un volet qui découvre ou recouvre. */
export interface Volet {
  repere: "element" | "page";
  debut: number;
  fin: number;
}

/** Un texte qui apparaît par morceaux : `p` va de 0 à 1 pendant l'animation. */
export interface Unites {
  genre: GenreUnites;
  sens: "entree" | "sortie";
  p: number;
}

/** Ce que les animations posent sur l'élément, autour de son centre : décalage en pixels de la
 *  page, échelle, rotation (degrés) et opacité qui se multiplient à celles de sa pose. */
export interface Effet {
  dx: number;
  dy: number;
  echelle: number;
  rotation: number;
  opacite: number;
  volet?: Volet;
  unites?: Unites;
}

export const EFFET_NEUTRE: Effet = { dx: 0, dy: 0, echelle: 1, rotation: 0, opacite: 1 };
export const estNeutre = (e: Effet) => e.dx === 0 && e.dy === 0 && e.echelle === 1 && e.rotation === 0 && e.opacite === 1 && !e.volet && !e.unites;

function ajouter(effet: Effet, m: Partial<Effet>) {
  if (m.dx) effet.dx += m.dx;
  if (m.dy) effet.dy += m.dy;
  if (m.echelle !== undefined) effet.echelle *= m.echelle;
  if (m.rotation) effet.rotation += m.rotation;
  if (m.opacite !== undefined) effet.opacite *= m.opacite;
  if (m.volet) effet.volet = m.volet;
  if (m.unites) effet.unites = m.unites;
}

/** Distance d'un glissement : 15 % de la page dans le sens du mouvement ; d'une chute : 35 %. */
const GLISSEMENT = 0.15;
const CHUTE = 0.35;

/** L'effet d'une entrée à l'avancement `p` (0 : début, 1 : fini). */
export function effetEntree(nom: string, p: number, f: Format): Partial<Effet> {
  const e = sortieCubique(p);
  const apparait = borne(2 * p);
  switch (nom) {
    case "fondu":
      return { opacite: p };
    case "glissement-haut":
      return { dy: (1 - e) * GLISSEMENT * f.hauteur, opacite: apparait };
    case "glissement-bas":
      return { dy: -(1 - e) * GLISSEMENT * f.hauteur, opacite: apparait };
    case "glissement-gauche":
      return { dx: (1 - e) * GLISSEMENT * f.largeur, opacite: apparait };
    case "glissement-droite":
      return { dx: -(1 - e) * GLISSEMENT * f.largeur, opacite: apparait };
    case "zoom":
      return { echelle: 0.3 + 0.7 * e, opacite: apparait };
    case "zoom-arriere":
      return { echelle: 1.6 - 0.6 * e, opacite: p };
    case "rebond":
      return { echelle: Math.max(0, dos(p)), opacite: borne(4 * p) };
    case "chute":
      return { dy: -(1 - rebondi(p)) * CHUTE * f.hauteur, opacite: borne(4 * p) };
    case "tourbillon":
      return { rotation: -180 * (1 - e), echelle: 0.2 + 0.8 * e, opacite: apparait };
    case "volet":
      return { volet: { repere: "element", debut: 0, fin: e } };
    case "machine-a-ecrire":
    case "lettres":
    case "mots":
    case "lignes":
      return { unites: { genre: nom, sens: "entree", p } };
    default:
      return {};
  }
}

/** L'effet d'une sortie à l'avancement `q` (0 : encore là, 1 : parti). */
export function effetSortie(nom: string, q: number, f: Format): Partial<Effet> {
  const x = entreeCubique(q);
  const reste = borne(2 * (1 - q));
  switch (nom) {
    case "fondu":
      return { opacite: 1 - q };
    case "glissement-haut":
      return { dy: -x * GLISSEMENT * f.hauteur, opacite: reste };
    case "glissement-bas":
      return { dy: x * GLISSEMENT * f.hauteur, opacite: reste };
    case "glissement-gauche":
      return { dx: -x * GLISSEMENT * f.largeur, opacite: reste };
    case "glissement-droite":
      return { dx: x * GLISSEMENT * f.largeur, opacite: reste };
    case "zoom":
      return { echelle: 1 - 0.7 * x, opacite: reste };
    case "zoom-arriere":
      return { echelle: 1 + 0.6 * x, opacite: 1 - q };
    case "rebond":
      return { echelle: Math.max(0, dos(1 - q)), opacite: borne(4 * (1 - q)) };
    case "chute":
      return { dy: x * CHUTE * f.hauteur, opacite: 1 - q };
    case "tourbillon":
      return { rotation: 180 * x, echelle: 1 - 0.8 * x, opacite: reste };
    case "volet":
      return { volet: { repere: "element", debut: x, fin: 1 } };
    case "machine-a-ecrire":
    case "lettres":
    case "mots":
    case "lignes":
      return { unites: { genre: nom, sens: "sortie", p: q } };
    default:
      return {};
  }
}

/** Une demi-onde de largeur 0,2 centrée sur `c`, dans un tour (`ph` de 0 à 1). */
const bosse = (ph: number, c: number) => (Math.abs(ph - c) < 0.1 ? Math.sin((Math.PI * (ph - c + 0.1)) / 0.2) : 0);

/** L'effet d'une boucle, `tr` ms après le début d'un clip de `longueur` ms. */
export function effetBoucle(a: Animation, tr: number, longueur: number, f: Format): Partial<Effet> {
  const periode = Math.max(100, a.duree);
  const u = tr / periode;
  const w = 2 * Math.PI * u;
  const phase = u - Math.floor(u);
  switch (a.nom) {
    case "pulsation":
      return { echelle: 1 + 0.06 * Math.sin(w) };
    case "battement":
      return { echelle: 1 + 0.08 * (bosse(phase, 0.15) + 0.6 * bosse(phase, 0.4)) };
    case "flottement":
      return { dy: -0.01 * f.hauteur * Math.sin(w) };
    case "balancement":
      return { rotation: 5 * Math.sin(w) };
    case "tremblement":
      return { dx: 0.006 * f.largeur * Math.sin(3 * w), dy: 0.006 * f.largeur * Math.sin(2 * w + 1) };
    case "clignotement":
      return { opacite: 0.6 + 0.4 * Math.cos(w) };
    case "rotation":
      return { rotation: 360 * u };
    case "zoom-lent":
      return { echelle: 1 + 0.15 * borne(tr / Math.max(1, longueur)) };
    default:
      return {};
  }
}

/** L'effet d'une transition sur le clip qui entre ou sur celui qui sort, à l'avancement `p`. */
export function effetTransition(nom: string, role: "entrant" | "sortant", p: number, f: Format): Partial<Effet> {
  const s = douce(p);
  switch (nom) {
    case "fondu":
      return role === "entrant" ? { opacite: p } : {};
    case "glissement":
      return role === "entrant" ? { dx: (1 - s) * f.largeur } : { dx: -s * f.largeur };
    case "zoom":
      return role === "entrant" ? { echelle: 0.85 + 0.15 * s, opacite: p } : { echelle: 1 + 0.25 * s };
    case "volet":
      return role === "entrant" ? { volet: { repere: "page", debut: 0, fin: s } } : {};
    default:
      return {};
  }
}

/** Une morceau de texte (lettre, mot ou ligne `i` sur `n`) pendant une animation par morceaux :
 *  son opacité, son décalage vers le bas en tailles de police, son échelle. */
export function etatUnite(u: Unites, i: number, n: number): { opacite: number; dyEm: number; echelle: number } {
  if (n <= 0) return { opacite: 1, dyEm: 0, echelle: 1 };
  if (u.genre === "machine-a-ecrire") {
    const visibles = u.sens === "entree" ? u.p * n : (1 - u.p) * n;
    return { opacite: visibles > i ? 1 : 0, dyEm: 0, echelle: 1 };
  }
  const largeur = u.genre === "lettres" ? 0.3 : u.genre === "mots" ? 0.45 : 0.6;
  const amplitude = u.genre === "lettres" ? 0.35 : u.genre === "mots" ? 0.5 : 0.7;
  const w = n > 1 ? largeur : 1;
  const debut = n > 1 ? (i * (1 - w)) / (n - 1) : 0;
  const local = borne((u.p - debut) / w);
  if (u.sens === "entree") {
    const e = sortieCubique(local);
    return { opacite: local, dyEm: amplitude * (1 - e), echelle: u.genre === "lettres" ? 0.6 + 0.4 * e : 1 };
  }
  const x = entreeCubique(local);
  return { opacite: 1 - local, dyEm: -amplitude * x, echelle: u.genre === "lettres" ? 1 - 0.4 * x : 1 };
}

// ---- Transitions de la page ----

/** Une transition vue d'un clip : son nom et la fenêtre où les deux clips se chevauchent. */
export interface FenetreTransition {
  nom: string;
  debut: number;
  fin: number;
}

/** Ce qu'un élément doit savoir de sa page pour s'animer. */
export interface ContexteAnimation {
  format: Format;
  /** Le clip entre par une transition (il est le second des deux). */
  transitionEntree?: FenetreTransition;
  /** Le clip sort par la transition du suivant. */
  transitionSortie?: FenetreTransition;
}

/** Les transitions de la piste principale, vues de chaque clip concerné. */
export function contextesTransitions(page: PageEliot): Map<string, { entree?: FenetreTransition; sortie?: FenetreTransition }> {
  const sortie = new Map<string, { entree?: FenetreTransition; sortie?: FenetreTransition }>();
  const principale = page.elements.filter((e) => e.piste === 0 && e.temps).sort((a, b) => a.temps!.debut - b.temps!.debut);
  for (let i = 1; i < principale.length; i++) {
    const a = principale[i - 1];
    const b = principale[i];
    if (!b.transition || b.temps!.debut >= a.temps!.fin) continue;
    const fenetre = { nom: b.transition.nom, debut: b.temps!.debut, fin: a.temps!.fin };
    sortie.set(b.id, { ...sortie.get(b.id), entree: fenetre });
    sortie.set(a.id, { ...sortie.get(a.id), sortie: fenetre });
  }
  return sortie;
}

/** Fenêtre écrite en texte (« fondu:1000:1500 ») pour passer d'un composant à l'autre sans
 *  changer d'identité à chaque rendu ; `lireFenetre` la relit. */
export const ecrireFenetre = (f: FenetreTransition | undefined) => (f ? `${f.nom}:${f.debut}:${f.fin}` : undefined);
export function lireFenetre(s: string | undefined): FenetreTransition | undefined {
  if (!s) return undefined;
  const [nom, debut, fin] = s.split(":");
  return { nom, debut: Number(debut), fin: Number(fin) };
}

/** L'agrandissement le plus fort d'un élément pendant son clip (ses images clés, ses effets), de
 *  1 à 2 : la finesse de ses images dans un film, comme le noyau (`agrandissement_max`). */
export function agrandissementMax(el: ElementPage): number {
  const cles = (el.cles ?? []).reduce((m, c) => Math.max(m, c.echelle ?? 1), 1);
  const a = el.animations;
  let effets = 1;
  if (a?.entree?.nom === "zoom-arriere" || a?.sortie?.nom === "zoom-arriere") effets = Math.max(effets, 1.6);
  if (a?.entree?.nom === "rebond" || a?.sortie?.nom === "rebond") effets = Math.max(effets, 1.11);
  effets *= a?.boucle?.nom === "zoom-lent" ? 1.15 : a?.boucle?.nom === "battement" ? 1.08 : a?.boucle?.nom === "pulsation" ? 1.06 : 1;
  return borne(cles * effets, 1, 2);
}

/** Durées d'entrée et de sortie, réduites ensemble si elles dépassent la longueur du clip. */
export function dureesEntreeSortie(el: ElementPage): { entree: number; sortie: number } {
  const entree = Math.max(0, el.animations?.entree?.duree ?? 0);
  const sortie = Math.max(0, el.animations?.sortie?.duree ?? 0);
  const longueur = el.temps ? el.temps.fin - el.temps.debut : Number.POSITIVE_INFINITY;
  if (entree + sortie <= longueur) return { entree, sortie };
  const f = longueur / (entree + sortie);
  return { entree: entree * f, sortie: sortie * f };
}

/** L'effet des animations et des transitions sur l'élément à l'instant `t` de la page. */
export function effetA(el: ElementPage, t: number, ctx: ContexteAnimation): Effet {
  const effet: Effet = { ...EFFET_NEUTRE };
  if (!el.temps) return effet;
  const longueur = el.temps.fin - el.temps.debut;
  const tr = t - el.temps.debut;
  const { entree, sortie } = dureesEntreeSortie(el);
  const a = el.animations;
  if (a?.entree && entree > 0 && tr < entree) ajouter(effet, effetEntree(a.entree.nom, borne(tr / entree), ctx.format));
  if (a?.sortie && sortie > 0 && tr > longueur - sortie) ajouter(effet, effetSortie(a.sortie.nom, borne((tr - (longueur - sortie)) / sortie), ctx.format));
  if (a?.boucle) ajouter(effet, effetBoucle(a.boucle, tr, longueur, ctx.format));
  const te = ctx.transitionEntree;
  if (te && t < te.fin) ajouter(effet, effetTransition(te.nom, "entrant", borne((t - te.debut) / Math.max(1, te.fin - te.debut)), ctx.format));
  const ts = ctx.transitionSortie;
  if (ts && t >= ts.debut) ajouter(effet, effetTransition(ts.nom, "sortant", borne((t - ts.debut) / Math.max(1, ts.fin - ts.debut)), ctx.format));
  return effet;
}

// ---- Images clés ----

/** La pose d'un élément : coin haut gauche, échelle autour de ce coin, rotation, opacité. */
export interface Pose {
  x: number;
  y: number;
  echelle: number;
  rotation: number;
  opacite: number;
}

interface Jalon {
  t: number;
  courbe?: "douce" | "lineaire";
}

/** La valeur d'un canal à l'instant `t`, d'après les jalons qui le donnent ; avant le premier
 *  et après le dernier, la valeur reste ; sans jalon, `base`. */
export function valeurCanal<J extends Jalon>(jalons: J[], lire: (j: J) => number | undefined, t: number, base: number): number {
  const avec = jalons.filter((j) => lire(j) !== undefined);
  if (avec.length === 0) return base;
  if (t <= avec[0].t) return lire(avec[0])!;
  for (let i = 0; i < avec.length - 1; i++) {
    const a = avec[i];
    const b = avec[i + 1];
    if (t < b.t) {
      const u = (t - a.t) / (b.t - a.t);
      const k = a.courbe === "lineaire" ? u : douce(u);
      return lire(a)! + (lire(b)! - lire(a)!) * k;
    }
  }
  return lire(avec[avec.length - 1])!;
}

/** Le centre d'une boîte `l` × `h` posée en (`x`, `y`), agrandie de `e` et tournée de `r`
 *  degrés autour de son coin haut gauche. */
function centreDe(x: number, y: number, l: number, h: number, e: number, r: number) {
  const a = (r * Math.PI) / 180;
  const hx = (l * e) / 2;
  const hy = (h * e) / 2;
  return { cx: x + hx * Math.cos(a) - hy * Math.sin(a), cy: y + hx * Math.sin(a) + hy * Math.cos(a) };
}

const triees = (cles: CleAnimation[]) => [...cles].sort((a, b) => a.t - b.t);

/** La pose de l'élément `tr` ms après le début de son clip, d'après ses images clés. */
export function poseA(el: ElementPage, tr: number): Pose {
  if (!el.cles?.length) return { x: el.x, y: el.y, echelle: 1, rotation: el.rotation, opacite: el.opacite };
  const cles = triees(el.cles);
  const echelleA = (t: number) => Math.max(0.01, valeurCanal(cles, (c) => c.echelle, t, 1));
  const rotationA = (t: number) => valeurCanal(cles, (c) => c.rotation, t, el.rotation);
  const echelle = echelleA(tr);
  const rotation = rotationA(tr);
  const opacite = borne(valeurCanal(cles, (c) => c.opacite, tr, el.opacite));
  // Entre deux clés, c'est le centre qui avance : un élément qui grandit ou tourne reste en
  // place au lieu de pivoter autour de son coin.
  const positions = cles.filter((c) => c.x !== undefined && c.y !== undefined);
  let centre: { cx: number; cy: number };
  if (positions.length) {
    const centres = positions.map((c) => ({ t: c.t, courbe: c.courbe, ...centreDe(c.x!, c.y!, el.largeur, el.hauteur, echelleA(c.t), rotationA(c.t)) }));
    centre = { cx: valeurCanal(centres, (c) => c.cx, tr, 0), cy: valeurCanal(centres, (c) => c.cy, tr, 0) };
  } else centre = centreDe(el.x, el.y, el.largeur, el.hauteur, 1, el.rotation);
  const a = (rotation * Math.PI) / 180;
  const hx = (el.largeur * echelle) / 2;
  const hy = (el.hauteur * echelle) / 2;
  return { x: centre.cx - (hx * Math.cos(a) - hy * Math.sin(a)), y: centre.cy - (hx * Math.sin(a) + hy * Math.cos(a)), echelle, rotation, opacite };
}

// ---- La caméra d'un objet 3D (étape 6, lot 4) ----

/** Les clés qui donnent la caméra d'un objet 3D, triées, l'azimut déroulé : d'une clé à la
 *  suivante, il prend le chemin le plus court (jamais plus d'un demi-tour ; un tour complet,
 *  c'est le plateau tournant). */
function clesCamera(el: ElementPage): (Jalon & { camera: Camera3d })[] {
  if (el.type !== "objet3d" || !el.cles?.length) return [];
  let precedent: number | undefined;
  return triees(el.cles)
    .filter((c): c is CleAnimation & { camera: Camera3d } => !!c.camera)
    .map((c) => {
      const azimut = precedent === undefined ? c.camera.azimut : precedent + angleNormalise(c.camera.azimut - precedent);
      precedent = azimut;
      return { t: c.t, courbe: c.courbe, camera: { ...c.camera, azimut } };
    });
}

/** La caméra que donnent les images clés d'un objet 3D à `tr` ms du début de son clip, ou
 *  `undefined` s'il n'a pas de clé de caméra. Le zoom glisse en proportion (de 1 à 2 comme de
 *  2 à 4), le reste en ligne droite. */
export function cameraDesCles(el: ElementPage, tr: number): Camera3d | undefined {
  const cles = clesCamera(el);
  if (!cles.length) return undefined;
  const v = (lire: (c: Camera3d) => number) => valeurCanal(cles, (j) => lire(j.camera), tr, 0);
  const camera: Camera3d = { azimut: v((c) => c.azimut), elevation: v((c) => c.elevation), zoom: Math.exp(v((c) => Math.log(c.zoom))), focale: v((c) => c.focale) };
  const decalage = [0, 1, 2].map((i) => v((c) => c.decalage?.[i] ?? 0)) as [number, number, number];
  if (decalage.some((x) => Math.abs(x) > 1e-9)) camera.decalage = decalage;
  return camera;
}

/** Deux clés plus proches que ceci (ms) sont « au même endroit » : la tête de lecture posée
 *  sur une clé la reprend au lieu d'en créer une autre. */
export const TOLERANCE_CLE = 40;

export const cleProche = (el: ElementPage, tr: number, tolerance = TOLERANCE_CLE): CleAnimation | undefined =>
  el.cles?.reduce<CleAnimation | undefined>((m, c) => (Math.abs(c.t - tr) <= tolerance && (!m || Math.abs(c.t - tr) < Math.abs(m.t - tr)) ? c : m), undefined);

const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** La pose complète à l'instant `tr`, arrondie, prête à devenir une clé ; pour un objet 3D, sa
 *  caméra aussi (sans le plateau tournant, qui s'y ajoute). */
export function poseArrondie(el: ElementPage, tr: number): Omit<CleAnimation, "t" | "courbe"> {
  const p = poseA(el, tr);
  const camera = el.type === "objet3d" ? { camera: normaliserCamera(cameraDesCles(el, tr) ?? el.camera) } : {};
  return { x: r2(p.x), y: r2(p.y), echelle: r3(p.echelle), rotation: r2(p.rotation), opacite: r3(p.opacite), ...camera };
}

/**
 * Pose une clé à `tr` ms du début du clip : la clé déjà là (à 40 ms près) prend les valeurs
 * données ; sinon une clé neuve naît avec toute la pose de l'instant, puis ces valeurs. Les clés
 * restent triées.
 */
export function poserCle(el: ElementPage, tr: number, valeurs: Partial<Omit<CleAnimation, "t">> = {}): CleAnimation[] {
  const t = Math.round(tr);
  const proche = cleProche(el, t);
  const propres = Object.fromEntries(Object.entries(valeurs).filter(([, v]) => v !== undefined)) as Partial<CleAnimation>;
  if (proche) return triees((el.cles ?? []).map((c) => (c === proche ? { ...c, ...propres } : c)));
  return triees([...(el.cles ?? []), { t, ...poseArrondie(el, t), ...propres }]);
}

/** Retire la clé proche de `tr` ; `undefined` quand il n'en reste plus. */
export function retirerCle(el: ElementPage, tr: number): CleAnimation[] | undefined {
  const proche = cleProche(el, tr);
  const reste = (el.cles ?? []).filter((c) => c !== proche);
  return reste.length ? reste : undefined;
}

/** Déplace la clé de `de` à `vers` (ms depuis le début du clip). */
export function deplacerCle(el: ElementPage, de: number, vers: number): CleAnimation[] | undefined {
  const cle = el.cles?.find((c) => c.t === de);
  if (!cle) return el.cles;
  const t = Math.round(vers);
  return triees(el.cles!.filter((c) => c === cle || Math.abs(c.t - t) > 0).map((c) => (c === cle ? { ...c, t } : c)));
}

/** Les clés quand le début du clip avance de `delta` ms (rogné) : elles restent sur le même
 *  moment du contenu. */
export const decalerCles = (cles: CleAnimation[] | undefined, delta: number): CleAnimation[] | undefined =>
  cles?.map((c) => ({ ...c, t: Math.round(c.t - delta) }));

/**
 * Les clés des deux moitiés d'un clip coupé à `coupe` ms de son début : chacune garde les siennes
 * et reçoit, au bord, une clé de la pose de cet instant (seulement les canaux que les clés
 * donnent) ; le mouvement continue d'une moitié à l'autre.
 */
export function couperCles(el: ElementPage, coupe: number): { avant?: CleAnimation[]; apres?: CleAnimation[] } {
  if (!el.cles?.length) return {};
  const cles = triees(el.cles);
  const p = poseArrondie(el, coupe);
  const a = cles.some((c) => c.x !== undefined && c.y !== undefined);
  const bord: Omit<CleAnimation, "t"> = {
    ...(a ? { x: p.x, y: p.y } : {}),
    ...(cles.some((c) => c.echelle !== undefined) ? { echelle: p.echelle } : {}),
    ...(cles.some((c) => c.rotation !== undefined) ? { rotation: p.rotation } : {}),
    ...(cles.some((c) => c.opacite !== undefined) ? { opacite: p.opacite } : {}),
    ...(cles.some((c) => c.camera) && p.camera ? { camera: p.camera } : {}),
  };
  const precedente = [...cles].reverse().find((c) => c.t <= coupe);
  const courbe = precedente?.courbe ? { courbe: precedente.courbe } : {};
  const t = Math.round(coupe);
  return {
    avant: [...cles.filter((c) => c.t < t), { t, ...bord, ...courbe }],
    apres: [{ t: 0, ...bord, ...courbe }, ...cles.filter((c) => c.t > t).map((c) => ({ ...c, t: c.t - t }))],
  };
}

// ---- L'état complet ----

export interface EtatAnime {
  pose: Pose;
  effet: Effet;
}

/** L'élément bouge-t-il avec le temps (animations, clés, transitions) ? */
export const estAnime = (el: ElementPage, ctx?: Pick<ContexteAnimation, "transitionEntree" | "transitionSortie">): boolean =>
  !!el.temps && !!(el.animations?.entree || el.animations?.sortie || el.animations?.boucle || el.cles?.length || ctx?.transitionEntree || ctx?.transitionSortie);

/** Pose et effet de l'élément à l'instant `t` de la page ; `sansEffets` : la pose seule (l'élément
 *  choisi dans l'éditeur, une miniature). */
export function etatAnime(el: ElementPage, t: number, ctx: ContexteAnimation, sansEffets = false): EtatAnime {
  const tr = el.temps ? t - el.temps.debut : 0;
  return { pose: poseA(el, tr), effet: sansEffets ? { ...EFFET_NEUTRE } : effetA(el, t, ctx) };
}

// ---- Son ----

/** Le volume d'une vidéo à l'instant `t` : son volume, ses fondus et ceux des transitions. */
export function gainSon(el: ElementVideo, t: number, ctx: Pick<ContexteAnimation, "transitionEntree" | "transitionSortie">): number {
  let v = el.volume ?? 1;
  if (!el.temps) return borne(v);
  const tr = t - el.temps.debut;
  const longueur = el.temps.fin - el.temps.debut;
  const fi = el.fonduEntree ?? 0;
  const fo = el.fonduSortie ?? 0;
  if (fi > 0 && tr < fi) v *= borne(tr / fi);
  if (fo > 0 && tr > longueur - fo) v *= borne((longueur - tr) / fo);
  const te = ctx.transitionEntree;
  if (te && t < te.fin) v *= borne((t - te.debut) / Math.max(1, te.fin - te.debut));
  const ts = ctx.transitionSortie;
  if (ts && t >= ts.debut) v *= borne((ts.fin - t) / Math.max(1, ts.fin - ts.debut));
  return borne(v);
}
