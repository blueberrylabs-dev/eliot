// Un contexte de dessin 2D qui écrit du SVG au lieu de pixels (étape 4, lot 4). Konva y dessine
// un élément exactement comme à l'écran (mêmes formes, mêmes coupures de lignes, mêmes
// positions de lettres) ; le noyau Rust rend ensuite ce SVG avec `resvg`, avec les mêmes
// fichiers de police, pour l'export vidéo.
//
// Chaque opération de peinture (remplir, tracer, écrire, poser une image) devient un morceau à
// part, un « calque » : à l'écran, Konva applique l'opacité d'un élément à chacune de ses
// opérations, une par une ; le noyau fait de même en posant chaque calque avec l'opacité du
// moment. Les photos et les vidéos ne passent pas par le SVG : le noyau les pose lui-même,
// depuis les originaux, avec leur découpe.
//
// Seules les opérations dont Konva se sert sont reprises : chemins (droites, courbes, arcs,
// ellipses), remplissage et contour (couleur ou dégradé), texte, images, découpes,
// transformations, opacité, ombre portée, mode de fusion, tirets. Les coordonnées des chemins
// sont écrites dans le repère de base (la transformation courante appliquée point par point),
// comme le fait un vrai canevas.

import { boiteDuVisuel, composer, contourProjete, depuisAffine, type PerspectiveCalque } from "../modele/perspective";

export type Matrice = [number, number, number, number, number, number];

const IDENTITE: Matrice = [1, 0, 0, 1, 0, 0];

/** `m × n` : `n` s'applique d'abord (canevas : `transform(n)` donne `ctm × n`). */
export function multiplier(m: Matrice, n: Matrice): Matrice {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}

export function appliquer(m: Matrice, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function inverse(m: Matrice): Matrice {
  const det = m[0] * m[3] - m[1] * m[2] || 1e-12;
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
}

const echelleDe = (m: Matrice) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

/** Un nombre court et stable pour le SVG (millième de pixel). */
export function n(v: number): string {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
}

export const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const matriceSvg = (m: Matrice) => `matrix(${m.map(n).join(" ")})`;

/** Un dégradé créé pendant l'enregistrement (Konva en crée un par forme). */
export class DegradeSvg {
  arrets: [number, string][] = [];
  constructor(
    public genre: "lineaire" | "radial",
    public coords: number[],
  ) {}
  addColorStop(position: number, couleur: string) {
    this.arrets.push([position, couleur]);
  }
}

export interface Boite {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const VIDE: Boite = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
const TOUT: Boite = { x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity };
export const unirBoites = (a: Boite, b: Boite): Boite => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });
const croiser = (a: Boite, b: Boite): Boite => ({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });
export const boiteVide = (b: Boite) => !(b.x1 > b.x0 && b.y1 > b.y0);
const elargir = (b: Boite, m: number): Boite => ({ x0: b.x0 - m, y0: b.y0 - m, x1: b.x1 + m, y1: b.y1 + m });
const boiteDePoints = (points: [number, number][]): Boite => points.reduce<Boite>((b, [x, y]) => ({ x0: Math.min(b.x0, x), y0: Math.min(b.y0, y), x1: Math.max(b.x1, x), y1: Math.max(b.y1, y) }), VIDE);
/** Arrondie au pixel vers l'extérieur : les bords des calques tombent juste. */
const arrondirBoite = (b: Boite): Boite => ({ x0: Math.floor(b.x0), y0: Math.floor(b.y0), x1: Math.ceil(b.x1), y1: Math.ceil(b.y1) });

/** Une couleur CSS entièrement transparente : rien à peindre. */
function transparente(c: string): boolean {
  const s = c.replace(/\s/g, "").toLowerCase();
  return s === "transparent" || /^rgba\(.*,0(\.0+)?\)$/.test(s) || /^hsla\(.*,0(\.0+)?\)$/.test(s) || /^#[0-9a-f]{6}00$/.test(s) || /^#[0-9a-f]{3}0$/.test(s);
}

/** `rgba(10,20,30,0.5)` en couleur opaque et opacité, pour les attributs SVG. */
function couleurEtOpacite(c: string): { couleur: string; opacite: number } {
  const m = c.replace(/\s/g, "").match(/^rgba?\((\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)(?:,(\d*(?:\.\d+)?))?\)$/i);
  if (m) return { couleur: `rgb(${m[1]},${m[2]},${m[3]})`, opacite: m[4] === undefined ? 1 : Number(m[4]) };
  const h = c.match(/^#([0-9a-f]{6})([0-9a-f]{2})$/i);
  if (h) return { couleur: `#${h[1]}`, opacite: parseInt(h[2], 16) / 255 };
  return { couleur: c, opacite: 1 };
}

/** Le décalage d'une ombre, que le noyau applique dans le repère de la page (comme un canevas :
 *  l'ombre ne tourne pas avec la forme). */
export interface OmbreCalque {
  dx: number;
  dy: number;
}

/** Une lettre d'un texte qui entre ou sort par morceaux : ses rangs et le point autour duquel
 *  elle grandit (repère de base). */
export interface UniteCalque {
  lettre: number;
  mot: number;
  ligne: number;
  cx: number;
  cy: number;
  /** La taille de police, dans le repère de base : le décalage se compte en tailles. */
  taille: number;
  /** Sous-titre (lot 7) : la variante de la lettre pour son mot prononcé, et le milieu de son
   *  mot (repère de base), autour duquel il grandit. */
  actif?: boolean;
  mx?: number;
  my?: number;
}

interface Commun {
  /** Opacité propre de l'opération (l'opacité de l'élément est à part). */
  opacite: number;
  /** Mode de fusion du canevas, s'il n'est pas l'ordinaire. */
  fusion?: string;
  unite?: UniteCalque;
}

/** Un calque dessiné en SVG : document autonome cadré sur `boite` (repère de base). */
export interface CalqueSvg extends Commun {
  genre: "svg";
  svg: string;
  boite: Boite;
  ombre?: OmbreCalque;
}

/** Une photo du design ou l'image d'une vidéo, posée par le noyau depuis l'original :
 *  `matrice` envoie le carré unité (toute l'image) dans le repère de base ; `decoupes` sont
 *  des tracés SVG (`d`) du repère de base qui la découpent. */
export interface CalqueImage extends Commun {
  genre: "image" | "video";
  ressource: string;
  matrice: Matrice;
  decoupes: string[];
  /** La place de l'image sur la page (repère de base), pour la taille de rendu. */
  boite: Boite;
  /** Un visuel en perspective (étape 5, lot 6) : le noyau le déforme lui-même, depuis
   *  l'original ; `matrice` envoie alors le carré unité sur la boîte du visuel déformé. */
  perspective?: PerspectiveCalque;
}

export type Calque = CalqueSvg | CalqueImage;

/** Comment l'enregistrement reconnaît une image. */
export interface SourcesImages {
  /** `{ ressource }` pour une photo du design, `{ video }` pour l'image d'une vidéo, `{ href }`
   *  pour une adresse que `resvg` sait lire (SVG en `data:`), `undefined` : recopiée en PNG. */
  reconnaitre: (source: unknown) => { ressource: string } | { video: string } | { href: string } | undefined;
}

interface Etat {
  m: Matrice;
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  miterLimit: number;
  tirets: number[];
  lineDashOffset: number;
  globalAlpha: number;
  globalCompositeOperation: string;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  letterSpacing: string;
  direction: string;
  /** Les découpes actives : tracés `d` du repère de base et leurs groupes SVG. */
  decoupes: string[];
  ouvertures: string[];
  boiteDecoupe: Boite;
}

const FUSIONS = new Set(["multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"]);

/** Le canevas qu'il imite (Konva lit parfois `canvas.width`). */
interface FauxCanevas {
  width: number;
  height: number;
}

/**
 * Le canevas de la fenêtre applique-t-il la taille optique (l'axe `opsz` des polices variables :
 * Inter, Fraunces, DM Sans…) ? Chromium oui, WebKitGTK non, et `resvg` l'applique si on ne lui
 * dit rien (étape 5, lot 1). Mesuré une fois par police : la largeur d'un texte au canevas,
 * comparée à celle du même texte dans la page, avec et sans taille optique. Sans écart entre
 * les deux (police sans cet axe, ou pas de page), la réponse ne change rien : non.
 */
const tailleOptiqueParPolice = new Map<string, boolean>();
export function canevasAvecTailleOptique(police: string): boolean {
  const connue = tailleOptiqueParPolice.get(police);
  if (connue !== undefined) return connue;
  let reponse = false;
  try {
    const essai = "Hamburgefonstiv 0123456789";
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx && document.body) {
      ctx.font = police;
      const canevas = ctx.measureText(essai).width;
      const dansLaPage = (optique: "auto" | "none") => {
        const s = document.createElement("span");
        s.style.cssText = "position:absolute;left:-10000px;top:0;visibility:hidden;white-space:pre";
        s.style.font = police;
        s.style.setProperty("font-optical-sizing", optique);
        s.textContent = essai;
        document.body.appendChild(s);
        const largeur = s.getBoundingClientRect().width;
        s.remove();
        return largeur;
      };
      const avec = dansLaPage("auto");
      const sans = dansLaPage("none");
      reponse = Math.abs(avec - sans) > 0.5 && Math.abs(canevas - avec) < Math.abs(canevas - sans);
    }
  } catch {
    // Pas de page (essais) : sans taille optique.
  }
  tailleOptiqueParPolice.set(police, reponse);
  return reponse;
}

export class ContexteSvg {
  canvas: FauxCanevas = { width: 1, height: 1 };
  // Propriétés que Konva lit et écrit directement.
  imageSmoothingEnabled = true;
  imageSmoothingQuality = "high";
  fontKerning = "auto";
  filter = "none";

  private etat: Etat = {
    m: IDENTITE,
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    miterLimit: 10,
    tirets: [],
    lineDashOffset: 0,
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    shadowColor: "rgba(0,0,0,0)",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    font: "10px sans-serif",
    textAlign: "start",
    textBaseline: "alphabetic",
    letterSpacing: "0px",
    direction: "ltr",
    decoupes: [],
    ouvertures: [],
    boiteDecoupe: TOUT,
  };
  private sauvegardes: Etat[] = [];
  private defs: string[] = [];
  private compteur = 0;
  private chemin: string[] = [];
  private pointsChemin: [number, number][] = [];
  private courant: [number, number] | null = null;
  private debutSousChemin: [number, number] | null = null;
  private mesureCanevas: CanvasRenderingContext2D | null = null;
  private bruts: { calque: Calque; contenu?: string }[] = [];
  /** La lettre en cours d'un texte par morceaux, jusqu'au `restore` qui la referme. */
  private morceau: { unite: UniteCalque; profondeur: number } | null = null;

  constructor(
    private sources: SourcesImages,
    private prefixe = "e",
  ) {}

  // ---- Propriétés de style (Konva fait `ctx[attr] = valeur`) ----

  get fillStyle() {
    return this.etat.fillStyle as string;
  }
  set fillStyle(v: unknown) {
    this.etat.fillStyle = v;
  }
  get strokeStyle() {
    return this.etat.strokeStyle as string;
  }
  set strokeStyle(v: unknown) {
    this.etat.strokeStyle = v;
  }
  get lineWidth() {
    return this.etat.lineWidth;
  }
  set lineWidth(v: number) {
    this.etat.lineWidth = v;
  }
  get lineCap() {
    return this.etat.lineCap;
  }
  set lineCap(v: string) {
    this.etat.lineCap = v;
  }
  get lineJoin() {
    return this.etat.lineJoin;
  }
  set lineJoin(v: string) {
    this.etat.lineJoin = v;
  }
  get miterLimit() {
    return this.etat.miterLimit;
  }
  set miterLimit(v: number) {
    this.etat.miterLimit = v;
  }
  get lineDashOffset() {
    return this.etat.lineDashOffset;
  }
  set lineDashOffset(v: number) {
    this.etat.lineDashOffset = v;
  }
  get globalAlpha() {
    return this.etat.globalAlpha;
  }
  set globalAlpha(v: number) {
    this.etat.globalAlpha = v;
  }
  get globalCompositeOperation() {
    return this.etat.globalCompositeOperation;
  }
  set globalCompositeOperation(v: string) {
    this.etat.globalCompositeOperation = v;
  }
  get shadowColor() {
    return this.etat.shadowColor;
  }
  set shadowColor(v: string) {
    this.etat.shadowColor = v;
  }
  get shadowBlur() {
    return this.etat.shadowBlur;
  }
  set shadowBlur(v: number) {
    this.etat.shadowBlur = v;
  }
  get shadowOffsetX() {
    return this.etat.shadowOffsetX;
  }
  set shadowOffsetX(v: number) {
    this.etat.shadowOffsetX = v;
  }
  get shadowOffsetY() {
    return this.etat.shadowOffsetY;
  }
  set shadowOffsetY(v: number) {
    this.etat.shadowOffsetY = v;
  }
  get font() {
    return this.etat.font;
  }
  set font(v: string) {
    this.etat.font = v;
  }
  get textAlign() {
    return this.etat.textAlign;
  }
  set textAlign(v: string) {
    this.etat.textAlign = v;
  }
  get textBaseline() {
    return this.etat.textBaseline;
  }
  set textBaseline(v: string) {
    this.etat.textBaseline = v;
  }
  get letterSpacing() {
    return this.etat.letterSpacing;
  }
  set letterSpacing(v: string) {
    this.etat.letterSpacing = v;
  }
  get direction() {
    return this.etat.direction;
  }
  set direction(v: string) {
    this.etat.direction = v;
  }

  // ---- Pile d'états et transformations ----

  save() {
    this.sauvegardes.push({ ...this.etat, tirets: [...this.etat.tirets], decoupes: [...this.etat.decoupes], ouvertures: [...this.etat.ouvertures] });
  }

  restore() {
    const e = this.sauvegardes.pop();
    if (!e) return;
    this.etat = e;
    if (this.morceau && this.sauvegardes.length < this.morceau.profondeur) this.morceau = null;
  }

  getTransform() {
    const [a, b, c, d, e, f] = this.etat.m;
    return { a, b, c, d, e, f };
  }

  setTransform(a: number | { a: number; b: number; c: number; d: number; e: number; f: number }, b?: number, c?: number, d?: number, e?: number, f?: number) {
    this.etat.m = typeof a === "object" ? [a.a, a.b, a.c, a.d, a.e, a.f] : [a, b!, c!, d!, e!, f!];
  }

  resetTransform() {
    this.etat.m = IDENTITE;
  }

  transform(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.etat.m = multiplier(this.etat.m, [a, b, c, d, e, f]);
  }

  translate(x: number, y: number) {
    this.transform(1, 0, 0, 1, x, y);
  }

  scale(x: number, y: number) {
    this.transform(x, 0, 0, y, 0, 0);
  }

  rotate(angle: number) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    this.transform(c, s, -s, c, 0, 0);
  }

  setLineDash(t: number[]) {
    this.etat.tirets = [...t];
  }

  getLineDash() {
    return [...this.etat.tirets];
  }

  // ---- Chemins ----

  beginPath() {
    this.chemin = [];
    this.pointsChemin = [];
    this.courant = null;
    this.debutSousChemin = null;
  }

  moveTo(x: number, y: number) {
    const p = appliquer(this.etat.m, x, y);
    this.chemin.push(`M${n(p[0])} ${n(p[1])}`);
    this.pointsChemin.push(p);
    this.courant = p;
    this.debutSousChemin = p;
  }

  lineTo(x: number, y: number) {
    if (!this.courant) return this.moveTo(x, y);
    const p = appliquer(this.etat.m, x, y);
    this.chemin.push(`L${n(p[0])} ${n(p[1])}`);
    this.pointsChemin.push(p);
    this.courant = p;
  }

  private cubique(c1: [number, number], c2: [number, number], p: [number, number]) {
    if (!this.courant) {
      this.chemin.push(`M${n(c1[0])} ${n(c1[1])}`);
      this.courant = c1;
      this.debutSousChemin = c1;
    }
    this.chemin.push(`C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p[0])} ${n(p[1])}`);
    this.pointsChemin.push(c1, c2, p);
    this.courant = p;
  }

  bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
    const m = this.etat.m;
    this.cubique(appliquer(m, x1, y1), appliquer(m, x2, y2), appliquer(m, x, y));
  }

  quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    if (!this.courant) this.moveTo(cx, cy);
    const local = appliquer(inverse(this.etat.m), this.courant![0], this.courant![1]);
    const c1: [number, number] = [local[0] + (2 / 3) * (cx - local[0]), local[1] + (2 / 3) * (cy - local[1])];
    const c2: [number, number] = [x + (2 / 3) * (cx - x), y + (2 / 3) * (cy - y)];
    this.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], x, y);
  }

  closePath() {
    if (!this.chemin.length) return;
    this.chemin.push("Z");
    if (this.debutSousChemin) this.courant = this.debutSousChemin;
  }

  rect(x: number, y: number, l: number, h: number) {
    this.moveTo(x, y);
    this.lineTo(x + l, y);
    this.lineTo(x + l, y + h);
    this.lineTo(x, y + h);
    this.closePath();
  }

  roundRect(x: number, y: number, l: number, h: number, rayons: number | number[] = 0) {
    const r = Array.isArray(rayons) ? rayons : [rayons];
    const [a, b, c, d] = r.length === 1 ? [r[0], r[0], r[0], r[0]] : r.length === 2 ? [r[0], r[1], r[0], r[1]] : r.length === 3 ? [r[0], r[1], r[2], r[1]] : r;
    this.moveTo(x + a, y);
    this.lineTo(x + l - b, y);
    this.arc(x + l - b, y + b, b, -Math.PI / 2, 0);
    this.lineTo(x + l, y + h - c);
    this.arc(x + l - c, y + h - c, c, 0, Math.PI / 2);
    this.lineTo(x + d, y + h);
    this.arc(x + d, y + h - d, d, Math.PI / 2, Math.PI);
    this.lineTo(x, y + a);
    this.arc(x + a, y + a, a, Math.PI, (Math.PI * 3) / 2);
    this.closePath();
  }

  arc(cx: number, cy: number, r: number, a0: number, a1: number, ccw = false) {
    this.ellipse(cx, cy, r, r, 0, a0, a1, ccw);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, rotation: number, a0: number, a1: number, ccw = false) {
    const tour = Math.PI * 2;
    let balayage: number;
    if (!ccw && a1 - a0 >= tour) balayage = tour;
    else if (ccw && a0 - a1 >= tour) balayage = -tour;
    else {
      balayage = a1 - a0;
      if (!ccw) {
        balayage %= tour;
        if (balayage < 0) balayage += tour;
      } else {
        balayage = -((a0 - a1) % tour);
        if (balayage > 0) balayage -= tour;
      }
    }
    const m = this.etat.m;
    const cr = Math.cos(rotation);
    const sr = Math.sin(rotation);
    const point = (ux: number, uy: number): [number, number] => {
      const x = ux * rx;
      const y = uy * ry;
      return appliquer(m, cx + x * cr - y * sr, cy + x * sr + y * cr);
    };
    const debut = point(Math.cos(a0), Math.sin(a0));
    this.chemin.push(`${this.courant ? "L" : "M"}${n(debut[0])} ${n(debut[1])}`);
    this.pointsChemin.push(debut);
    if (!this.courant) this.debutSousChemin = debut;
    this.courant = debut;
    if (balayage === 0) return;
    const segments = Math.max(1, Math.ceil(Math.abs(balayage) / (Math.PI / 2) - 1e-9));
    const pas = balayage / segments;
    const k = (4 / 3) * Math.tan(pas / 4);
    let t = a0;
    for (let i = 0; i < segments; i++) {
      const c0 = Math.cos(t);
      const s0 = Math.sin(t);
      const c3 = Math.cos(t + pas);
      const s3 = Math.sin(t + pas);
      this.cubique(point(c0 - k * s0, s0 + k * c0), point(c3 + k * s3, s3 - k * c3), point(c3, s3));
      t += pas;
    }
  }

  arcTo(x1: number, y1: number, x2: number, y2: number, r: number) {
    if (!this.courant) this.moveTo(x1, y1);
    const [x0, y0] = appliquer(inverse(this.etat.m), this.courant![0], this.courant![1]);
    const v1 = [x0 - x1, y0 - y1];
    const v2 = [x2 - x1, y2 - y1];
    const l1 = Math.hypot(v1[0], v1[1]);
    const l2 = Math.hypot(v2[0], v2[1]);
    const croix = v1[0] * v2[1] - v1[1] * v2[0];
    if (r === 0 || l1 === 0 || l2 === 0 || Math.abs(croix) < 1e-9) return this.lineTo(x1, y1);
    const angle = Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2))));
    const d = r / Math.tan(angle / 2);
    const t1 = [x1 + (v1[0] / l1) * d, y1 + (v1[1] / l1) * d];
    const t2 = [x1 + (v2[0] / l2) * d, y1 + (v2[1] / l2) * d];
    // Le centre est sur la bissectrice, à distance r des deux côtés.
    const bx = v1[0] / l1 + v2[0] / l2;
    const by = v1[1] / l1 + v2[1] / l2;
    const lb = Math.hypot(bx, by) || 1;
    const dc = r / Math.sin(angle / 2);
    const cx = x1 + (bx / lb) * dc;
    const cy = y1 + (by / lb) * dc;
    const a0 = Math.atan2(t1[1] - cy, t1[0] - cx);
    const a1 = Math.atan2(t2[1] - cy, t2[0] - cx);
    // Le petit arc, dans le sens qu'il faut.
    let ecart = a1 - a0;
    while (ecart > Math.PI) ecart -= 2 * Math.PI;
    while (ecart <= -Math.PI) ecart += 2 * Math.PI;
    this.lineTo(t1[0], t1[1]);
    this.arc(cx, cy, r, a0, a1, ecart < 0);
  }

  private d(): string {
    return this.chemin.join("");
  }

  // ---- Remplir, tracer, découper ----

  /** La couleur ou le dégradé d'un remplissage ou d'un contour, en attributs SVG ; les dégradés
   *  vont dans les définitions (`transformation` : le repère où ils ont été créés). */
  private peinture(style: unknown, transformation: Matrice | null, propriete: "fill" | "stroke"): string | null {
    if (style instanceof DegradeSvg) {
      const id = `${this.prefixe}d${++this.compteur}`;
      const arrets = style.arrets
        .map(([p, c]) => {
          const { couleur, opacite } = couleurEtOpacite(c);
          return `<stop offset="${n(p)}" stop-color="${echapper(couleur)}"${opacite < 1 ? ` stop-opacity="${n(opacite)}"` : ""}/>`;
        })
        .join("");
      const t = transformation ? ` gradientTransform="${matriceSvg(transformation)}"` : "";
      const c = style.coords;
      if (style.genre === "lineaire") this.defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n(c[0])}" y1="${n(c[1])}" x2="${n(c[2])}" y2="${n(c[3])}"${t}>${arrets}</linearGradient>`);
      else this.defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" fx="${n(c[0])}" fy="${n(c[1])}" fr="${n(c[2])}" cx="${n(c[3])}" cy="${n(c[4])}" r="${n(c[5])}"${t}>${arrets}</radialGradient>`);
      return `${propriete}="url(#${id})"`;
    }
    if (typeof style === "string") {
      if (transparente(style)) return null;
      const { couleur, opacite } = couleurEtOpacite(style);
      return `${propriete}="${echapper(couleur)}"${opacite < 1 ? ` ${propriete}-opacity="${n(opacite)}"` : ""}`;
    }
    // Motif ou valeur inconnue : gris neutre.
    return `${propriete}="#808080"`;
  }

  private ombreActive(): boolean {
    const e = this.etat;
    if (!(e.shadowBlur > 0 || e.shadowOffsetX !== 0 || e.shadowOffsetY !== 0)) return false;
    return !transparente(e.shadowColor);
  }

  /** Ce qui est commun aux calques posés maintenant : opacité, fusion, lettre en cours. */
  private commun(): Commun {
    const e = this.etat;
    return {
      opacite: e.globalAlpha,
      ...(FUSIONS.has(e.globalCompositeOperation) ? { fusion: e.globalCompositeOperation } : {}),
      ...(this.morceau ? { unite: this.morceau.unite } : {}),
    };
  }

  /** Entoure un dessin des découpes actives. */
  private dansDecoupes(svg: string): string {
    const o = this.etat.ouvertures;
    return `${o.join("")}${svg}${"</g>".repeat(o.length)}`;
  }

  /** Ajoute un dessin : d'abord son ombre (calque à part, que le noyau décale dans le repère de
   *  la page), puis le dessin lui-même. */
  private poser(element: string, boite: Boite) {
    const e = this.etat;
    const commun = this.commun();
    if (this.ombreActive()) this.poserOmbre(element, boite, commun);
    const visible = croiser(boite, e.boiteDecoupe);
    if (boiteVide(visible)) return;
    this.bruts.push({ calque: { genre: "svg", svg: "", boite: arrondirBoite(visible), ...commun }, contenu: this.dansDecoupes(element) });
  }

  /** L'ombre seule d'un dessin, sans décalage : la forme en silhouette, floutée, teintée. */
  private poserOmbre(element: string, boite: Boite, commun: Commun) {
    const e = this.etat;
    const id = `${this.prefixe}o${++this.compteur}`;
    const sigma = e.shadowBlur / 2;
    const zone = croiser(elargir(boite, 3 * sigma + 1), e.boiteDecoupe);
    if (boiteVide(zone)) return;
    const { couleur, opacite } = couleurEtOpacite(e.shadowColor);
    const flou = sigma > 0 ? `<feGaussianBlur in="SourceAlpha" stdDeviation="${n(sigma)}" result="flou"/>` : `<feOffset in="SourceAlpha" dx="0" dy="0" result="flou"/>`;
    this.defs.push(
      `<filter id="${id}" filterUnits="userSpaceOnUse" x="${n(zone.x0)}" y="${n(zone.y0)}" width="${n(zone.x1 - zone.x0)}" height="${n(zone.y1 - zone.y0)}" color-interpolation-filters="sRGB">${flou}<feFlood flood-color="${echapper(couleur)}" flood-opacity="${n(opacite)}"/><feComposite in2="flou" operator="in"/></filter>`,
    );
    this.bruts.push({
      calque: { genre: "svg", svg: "", boite: arrondirBoite(zone), ombre: { dx: e.shadowOffsetX, dy: e.shadowOffsetY }, ...commun },
      contenu: this.dansDecoupes(`<g filter="url(#${id})">${element}</g>`),
    });
  }

  fill(regle?: unknown) {
    const d = this.d();
    if (!d) return;
    const p = this.peinture(this.etat.fillStyle, this.etat.m, "fill");
    if (!p) return;
    const r = regle === "evenodd" ? ` fill-rule="evenodd"` : "";
    this.poser(`<path d="${d}" ${p}${r}/>`, boiteDePoints(this.pointsChemin));
  }

  stroke() {
    const d = this.d();
    if (!d) return;
    const e = this.etat;
    const p = this.peinture(e.strokeStyle, e.m, "stroke");
    if (!p || e.lineWidth <= 0) return;
    const k = echelleDe(e.m);
    const largeur = e.lineWidth * k;
    const tirets = e.tirets.length ? ` stroke-dasharray="${e.tirets.map((t) => n(t * k)).join(" ")}" stroke-dashoffset="${n(e.lineDashOffset * k)}"` : "";
    const debord = largeur * (e.lineJoin === "miter" ? Math.max(1, e.miterLimit / 2) : 1) + 1;
    this.poser(`<path d="${d}" fill="none" ${p} stroke-width="${n(largeur)}" stroke-linecap="${e.lineCap}" stroke-linejoin="${e.lineJoin}" stroke-miterlimit="${n(e.miterLimit)}"${tirets}/>`, elargir(boiteDePoints(this.pointsChemin), debord));
  }

  clip(regle?: unknown) {
    const d = this.d() || "M0 0Z";
    const id = `${this.prefixe}c${++this.compteur}`;
    const r = regle === "evenodd" ? ` clip-rule="evenodd"` : "";
    this.defs.push(`<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path d="${d}"${r}/></clipPath>`);
    this.etat.ouvertures = [...this.etat.ouvertures, `<g clip-path="url(#${id})">`];
    this.etat.decoupes = [...this.etat.decoupes, d];
    this.etat.boiteDecoupe = croiser(this.etat.boiteDecoupe, this.chemin.length ? boiteDePoints(this.pointsChemin) : { x0: 0, y0: 0, x1: 0, y1: 0 });
  }

  private avecRectangle(x: number, y: number, l: number, h: number, faire: () => void) {
    const sauve = { chemin: this.chemin, points: this.pointsChemin, courant: this.courant, debut: this.debutSousChemin };
    this.beginPath();
    this.rect(x, y, l, h);
    faire();
    this.chemin = sauve.chemin;
    this.pointsChemin = sauve.points;
    this.courant = sauve.courant;
    this.debutSousChemin = sauve.debut;
  }

  fillRect(x: number, y: number, l: number, h: number) {
    this.avecRectangle(x, y, l, h, () => this.fill());
  }

  strokeRect(x: number, y: number, l: number, h: number) {
    this.avecRectangle(x, y, l, h, () => this.stroke());
  }

  clearRect() {
    // Rien à effacer : l'enregistrement part d'une page vide.
  }

  isPointInPath() {
    return false;
  }

  isPointInStroke() {
    return false;
  }

  // ---- Texte ----

  /** Mesure avec un vrai canevas (créé à la première mesure). */
  measureText(texte: string) {
    this.mesureCanevas ??= document.createElement("canvas").getContext("2d")!;
    const m = this.mesureCanevas;
    m.font = this.etat.font;
    (m as unknown as { letterSpacing: string }).letterSpacing = this.etat.letterSpacing;
    return m.measureText(texte);
  }

  /** `italic bold 96px "Inter", Inter, sans-serif` en attributs SVG. */
  private attributsPolice(): { attributs: string; taille: number } {
    const f = this.etat.font;
    const m = f.match(/^(.*?)(\d+(?:\.\d+)?)px\s*(?:\/\s*\S+\s+)?(.*)$/);
    if (!m) return { attributs: `font-size="10"`, taille: 10 };
    const mots = m[1].trim().split(/\s+/).filter(Boolean);
    const taille = Number(m[2]);
    const famille = m[3].trim();
    const poids = mots.find((x) => /^(bold|bolder|lighter|[1-9]00)$/.test(x));
    const style = mots.includes("italic") ? "italic" : mots.includes("oblique") ? "oblique" : undefined;
    const variante = mots.includes("small-caps") ? ` font-variant="small-caps"` : "";
    const espacement = Number.parseFloat(this.etat.letterSpacing) || 0;
    return {
      // La taille optique (axe `opsz` des polices variables) comme le canevas de la fenêtre.
      attributs: `font-family="${echapper(famille)}" font-size="${n(taille)}"${poids ? ` font-weight="${poids === "bold" ? 700 : poids}"` : ""}${style ? ` font-style="${style}"` : ""}${variante}${espacement ? ` letter-spacing="${n(espacement)}"` : ""} font-optical-sizing="${canevasAvecTailleOptique(f) ? "auto" : "none"}"`,
      taille,
    };
  }

  private texte(texte: string, x: number, y: number, contour: boolean) {
    if (!texte || !texte.trim()) return;
    const e = this.etat;
    const { attributs, taille } = this.attributsPolice();
    const ancre = e.textAlign === "center" ? "middle" : e.textAlign === "right" || (e.textAlign === "end" && e.direction !== "rtl") || (e.textAlign === "start" && e.direction === "rtl") ? "end" : "start";
    const ligneDeBase = e.textBaseline === "middle" ? ` dominant-baseline="central"` : e.textBaseline === "top" || e.textBaseline === "hanging" ? ` dominant-baseline="hanging"` : e.textBaseline === "bottom" || e.textBaseline === "ideographic" ? ` dominant-baseline="ideographic"` : "";
    // Le dégradé d'un texte se lit dans le repère du texte (l'élément porte la transformation).
    const p = this.peinture(contour ? e.strokeStyle : e.fillStyle, null, contour ? "stroke" : "fill");
    if (!p) return;
    const peinture = contour ? `fill="none" ${p} stroke-width="${n(e.lineWidth)}" stroke-linejoin="${e.lineJoin}" stroke-miterlimit="${n(e.miterLimit)}"` : p;
    const largeur = this.measureText(texte).width;
    const debut = ancre === "middle" ? x - largeur / 2 : ancre === "end" ? x - largeur : x;
    const marge = (contour ? e.lineWidth : 0) + taille * 0.25;
    // Hauteur prise large : accents des capitales, jambages, polices décoratives.
    const coins: [number, number][] = [
      appliquer(e.m, debut - marge, y - taille * 1.25 - marge),
      appliquer(e.m, debut + largeur + marge, y - taille * 1.25 - marge),
      appliquer(e.m, debut + largeur + marge, y + taille * 0.6 + marge),
      appliquer(e.m, debut - marge, y + taille * 0.6 + marge),
    ];
    const direction = e.direction === "rtl" ? ` direction="rtl"` : "";
    // La ligne garde la longueur que la fenêtre lui mesure : le moteur du noyau espace ses
    // lettres un rien autrement (les avances de la fenêtre sont arrondies par son moteur de
    // polices, jusqu'à 3 px sur une ligne de 740 px) ; la fin de la ligne tombe ainsi au même
    // endroit qu'à l'écran (étape 5, lot 1).
    const longueur = [...texte].length > 1 && largeur > 0 ? ` textLength="${n(largeur)}" lengthAdjust="spacing"` : "";
    this.poser(`<text x="${n(x)}" y="${n(y)}" ${attributs} text-anchor="${ancre}"${ligneDeBase}${direction}${longueur} ${peinture} xml:space="preserve" transform="${matriceSvg(e.m)}">${echapper(texte)}</text>`, boiteDePoints(coins));
  }

  fillText(texte: string, x: number, y: number) {
    this.texte(texte, x, y, false);
  }

  strokeText(texte: string, x: number, y: number) {
    this.texte(texte, x, y, true);
  }

  /** Une lettre d'un texte par morceaux commence : ce qui est dessiné jusqu'au `restore` qui
   *  referme son `save` en fait partie. `(cx, cy)` et `taille` sont dans le repère courant. */
  debutMorceau(rangs: { lettre: number; mot: number; ligne: number }, cx: number, cy: number, taille: number, actif?: { mx: number; my: number }) {
    const [x, y] = appliquer(this.etat.m, cx, cy);
    const mot = actif ? appliquer(this.etat.m, actif.mx, actif.my) : null;
    this.morceau = { unite: { ...rangs, cx: x, cy: y, taille: taille * echelleDe(this.etat.m), ...(mot ? { actif: true, mx: mot[0], my: mot[1] } : {}) }, profondeur: this.sauvegardes.length };
  }

  // ---- Images ----

  drawImage(source: unknown, ...args: number[]) {
    const s = source as { naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number; width?: number; height?: number };
    const ls = s.naturalWidth || s.videoWidth || s.width || 1;
    const hs = s.naturalHeight || s.videoHeight || s.height || 1;
    let [sx, sy, sl, sh, dx, dy, dl, dh] = [0, 0, ls, hs, 0, 0, ls, hs];
    if (args.length === 2) [dx, dy] = args;
    else if (args.length === 4) [dx, dy, dl, dh] = args;
    else if (args.length >= 8) [sx, sy, sl, sh, dx, dy, dl, dh] = args;
    if (dl === 0 || dh === 0 || sl === 0 || sh === 0) return;
    const e = this.etat;
    const coins = [appliquer(e.m, dx, dy), appliquer(e.m, dx + dl, dy), appliquer(e.m, dx + dl, dy + dh), appliquer(e.m, dx, dy + dh)];
    const boite = boiteDePoints(coins);
    const pleine = sx === 0 && sy === 0 && sl === ls && sh === hs;
    const vue = this.sources.reconnaitre(source);
    if (vue && ("ressource" in vue || "video" in vue)) {
      // Le carré unité de l'image entière, vers le repère de base.
      const matrice = multiplier(e.m, [(dl / sl) * ls, 0, 0, (dh / sh) * hs, dx - (sx * dl) / sl, dy - (sy * dh) / sh]);
      const rectangle = `M${coins.map((c) => `${n(c[0])} ${n(c[1])}`).join("L")}Z`;
      if (this.ombreActive()) {
        // L'ombre d'une photo ou d'une vidéo : celle de son rectangle (une photo avec des parties
        // transparentes garde ici l'ombre de sa forme, tirée de son aperçu).
        const silhouette = "ressource" in vue ? this.imageSvg(`eliot:apercu/${vue.ressource}`, ls, hs, sx, sy, sl, sh, dx, dy, dl, dh) : `<path d="${rectangle}" fill="#000000"/>`;
        this.poserOmbre(silhouette, boite, this.commun());
      }
      const visible = croiser(boite, e.boiteDecoupe);
      if (boiteVide(visible)) return;
      this.bruts.push({
        calque: {
          genre: "ressource" in vue ? "image" : "video",
          ressource: "ressource" in vue ? vue.ressource : vue.video,
          matrice,
          decoupes: pleine ? [...e.decoupes] : [...e.decoupes, rectangle],
          boite: arrondirBoite(visible),
          ...this.commun(),
        },
      });
      return;
    }
    const href = vue?.href ?? enPng(source, ls, hs);
    this.poser(this.imageSvg(href, ls, hs, sx, sy, sl, sh, dx, dy, dl, dh), boite);
  }

  /**
   * Un visuel en perspective (étape 5, lot 6) : la photo ou l'image de la vidéo `source`, posée
   * comme le dit `p` (repère courant). Le noyau le déforme depuis l'original ; son ombre suit son
   * contour, coins arrondis compris. Une source que le noyau ne connaît pas n'est pas posée.
   */
  poserEnPerspective(source: unknown, p: PerspectiveCalque) {
    const vue = this.sources.reconnaitre(source);
    if (!vue || !("ressource" in vue || "video" in vue)) return;
    const e = this.etat;
    const plan = composer(depuisAffine(e.m), p.plan);
    const q: PerspectiveCalque = { ...p, plan };
    const [x0, y0, x1, y1] = boiteDuVisuel(q);
    const boite = { x0, y0, x1, y1 };
    if (this.ombreActive()) {
      const contour = contourProjete(plan, p.plat, p.arrondi);
      this.poserOmbre(`<path d="M${contour.map((c) => `${n(c[0])} ${n(c[1])}`).join("L")}Z" fill="#000000"/>`, boite, this.commun());
    }
    const visible = croiser(boite, e.boiteDecoupe);
    if (boiteVide(visible)) return;
    this.bruts.push({
      calque: {
        genre: "ressource" in vue ? "image" : "video",
        ressource: "ressource" in vue ? vue.ressource : vue.video,
        matrice: [x1 - x0, 0, 0, y1 - y0, x0, y0],
        decoupes: [...e.decoupes],
        boite: arrondirBoite(visible),
        perspective: q,
        ...this.commun(),
      },
    });
  }

  /** Une image en SVG, entière ou par une fenêtre. */
  private imageSvg(href: string, ls: number, hs: number, sx: number, sy: number, sl: number, sh: number, dx: number, dy: number, dl: number, dh: number): string {
    const m = this.etat.m;
    if (sx === 0 && sy === 0 && sl === ls && sh === hs) return `<image x="${n(dx)}" y="${n(dy)}" width="${n(dl)}" height="${n(dh)}" preserveAspectRatio="none" href="${echapper(href)}" transform="${matriceSvg(m)}"/>`;
    return `<g transform="${matriceSvg(multiplier(m, [dl / sl, 0, 0, dh / sh, dx - (sx * dl) / sl, dy - (sy * dh) / sh]))}"><svg x="${n(sx)}" y="${n(sy)}" width="${n(sl)}" height="${n(sh)}" viewBox="${n(sx)} ${n(sy)} ${n(sl)} ${n(sh)}" overflow="hidden"><image width="${n(ls)}" height="${n(hs)}" preserveAspectRatio="none" href="${echapper(href)}"/></svg></g>`;
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
    return new DegradeSvg("lineaire", [x0, y0, x1, y1]);
  }

  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
    return new DegradeSvg("radial", [x0, y0, r0, x1, y1, r1]);
  }

  createPattern() {
    return null;
  }

  createImageData(l: number, h: number) {
    return new ImageData(Math.max(1, l), Math.max(1, h));
  }

  getImageData(_x: number, _y: number, l: number, h: number) {
    return new ImageData(Math.max(1, l), Math.max(1, h));
  }

  putImageData() {
    // Les filtres de Konva ne servent pas dans Eliot.
  }

  // ---- Résultat ----

  /** Les calques enregistrés, chacun en document SVG autonome cadré sur sa boîte. */
  calques(): Calque[] {
    const defs = this.defs.join("");
    return this.bruts.map(({ calque, contenu }) => {
      if (calque.genre !== "svg") return calque;
      const b = calque.boite;
      return {
        ...calque,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${n(b.x1 - b.x0)}" height="${n(b.y1 - b.y0)}" viewBox="${n(b.x0)} ${n(b.y0)} ${n(b.x1 - b.x0)} ${n(b.y1 - b.y0)}">${defs ? `<defs>${defs}</defs>` : ""}${contenu}</svg>`,
      };
    });
  }
}

/** Dernier recours pour une image inconnue : recopiée en PNG dans le SVG. */
function enPng(source: unknown, l: number, h: number): string {
  try {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(l));
    c.height = Math.max(1, Math.round(h));
    c.getContext("2d")!.drawImage(source as CanvasImageSource, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  } catch {
    return "data:image/png;base64,";
  }
}
