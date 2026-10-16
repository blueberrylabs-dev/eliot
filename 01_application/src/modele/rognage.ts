// Le recadrage et le redressement d'une photo ou d'un clip (étape 5, lot 5), valeur de l'élément
// (règle 13 : le fichier n'est jamais touché). Le rectangle gardé vit dans l'image redressée,
// qui a le même centre que l'original ; il ne déborde jamais de l'image (pas de coin vide), comme
// dans Lightroom. La fenêtre le pose en dessinant la page (`matriceRognage`), et l'export suit : le
// SVG de la page porte la même découpe et la même rotation. Le noyau n'en lit que le repère du
// vignetage (`noyau/src/labo.rs`, `Rognage::repere`, même calcul).

export interface Rognage {
  /** Le coin haut gauche du rectangle gardé, dans l'image redressée, en fractions de la
   *  largeur et de la hauteur de l'original (0, 0 : le coin de l'original quand l'angle est nul). */
  x: number;
  y: number;
  /** Ses côtés, en fractions de la largeur et de la hauteur de l'original. */
  largeur: number;
  hauteur: number;
  /** Le redressement, en degrés, de -45 à 45 ; positif : l'image tourne dans le sens des
   *  aiguilles d'une montre. */
  angle: number;
}

export const ANGLE_MAX_ROGNAGE = 45;
/** Le plus petit côté gardé, en fraction du côté de l'original. */
export const COTE_MIN_ROGNAGE = 0.02;
/** Toute l'image, droite. */
export const ROGNAGE_ENTIER: Rognage = { x: 0, y: 0, largeur: 1, hauteur: 1, angle: 0 };

/** Une matrice de canevas `[a, b, c, d, e, f]` : x' = a x + c y + e, y' = b x + d y + f. */
export type MatriceRognage = [number, number, number, number, number, number];

interface Pt {
  x: number;
  y: number;
}

const RAD = Math.PI / 180;
const borner = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Du repère redressé à l'original (tous deux centrés sur l'image, en pixels). */
function versOriginal(p: Pt, angle: number): Pt {
  const t = -angle * RAD;
  return { x: p.x * Math.cos(t) - p.y * Math.sin(t), y: p.x * Math.sin(t) + p.y * Math.cos(t) };
}

function versRedresse(p: Pt, angle: number): Pt {
  return versOriginal(p, -angle);
}

/** Le rectangle gardé dans le repère redressé, en pixels de l'original, l'image centrée en 0. */
export function rectangleRedresse(r: Rognage, W: number, H: number): { gauche: number; haut: number; largeur: number; hauteur: number } {
  return { gauche: (r.x - 0.5) * W, haut: (r.y - 0.5) * H, largeur: r.largeur * W, hauteur: r.hauteur * H };
}

function centreDe(r: Rognage, W: number, H: number): Pt {
  return { x: (r.x + r.largeur / 2 - 0.5) * W, y: (r.y + r.hauteur / 2 - 0.5) * H };
}

function depuisCentre(c: Pt, l: number, h: number, angle: number, W: number, H: number): Rognage {
  return { x: (c.x - l / 2) / W + 0.5, y: (c.y - h / 2) / H + 0.5, largeur: l / W, hauteur: h / H, angle };
}

/** Les quatre coins du rectangle gardé dans l'original, en pixels (coin haut gauche en 0). */
export function coinsDansOriginal(r: Rognage, W: number, H: number): Pt[] {
  const g = rectangleRedresse(r, W, H);
  return [
    { x: g.gauche, y: g.haut },
    { x: g.gauche + g.largeur, y: g.haut },
    { x: g.gauche + g.largeur, y: g.haut + g.hauteur },
    { x: g.gauche, y: g.haut + g.hauteur },
  ].map((p) => {
    const q = versOriginal(p, r.angle);
    return { x: q.x + W / 2, y: q.y + H / 2 };
  });
}

/** Le rectangle gardé tient-il dans l'image (à un millième de pixel près) ? */
export function dansImage(r: Rognage, W: number, H: number, tolerance = 1e-3): boolean {
  return coinsDansOriginal(r, W, H).every((p) => p.x >= -tolerance && p.x <= W + tolerance && p.y >= -tolerance && p.y <= H + tolerance);
}

/** Le plus grand facteur `k` tel que le rectangle centré en `c` (repère redressé), de demi-côtés
 *  `a·k` et `b·k`, tienne dans l'image tournée de `angle`. */
function facteurMax(c: Pt, a: number, b: number, angle: number, W: number, H: number): number {
  const q = versOriginal(c, angle);
  let k = Infinity;
  for (const [sx, sy] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    const d = versOriginal({ x: sx * a, y: sy * b }, angle);
    for (const [qv, dv, demi] of [
      [q.x, d.x, W / 2],
      [q.y, d.y, H / 2],
    ]) {
      if (dv > 1e-12) k = Math.min(k, (demi - qv) / dv);
      else if (dv < -1e-12) k = Math.min(k, (demi + qv) / -dv);
    }
  }
  return Math.max(0, k);
}

/** Le centre ramené dans l'image. */
function centreDansImage(c: Pt, angle: number, W: number, H: number): Pt {
  const q = versOriginal(c, angle);
  const m = 1e-6;
  return versRedresse({ x: borner(q.x, -W / 2 + m, W / 2 - m), y: borner(q.y, -H / 2 + m, H / 2 - m) }, angle);
}

/** Un recadrage dans les règles : angle borné, côtés d'au moins 2 %, rectangle dans l'image
 *  (rétréci autour de son centre s'il le faut, en gardant ses proportions). */
export function contraindre(r: Rognage, W: number, H: number): Rognage {
  const angle = borner(Number.isFinite(r.angle) ? r.angle : 0, -ANGLE_MAX_ROGNAGE, ANGLE_MAX_ROGNAGE);
  const c = centreDansImage(centreDe(r, W, H), angle, W, H);
  let l = Math.max(r.largeur, COTE_MIN_ROGNAGE) * W;
  let h = Math.max(r.hauteur, COTE_MIN_ROGNAGE) * H;
  const k = facteurMax(c, l / 2, h / 2, angle, W, H);
  if (k < 1) {
    l *= k;
    h *= k;
  }
  return depuisCentre(c, l, h, angle, W, H);
}

const arrondir = (v: number, pas: number) => Math.round(v / pas) * pas;

/** Toute l'image, droite (à l'arrondi près) ? */
export function estEntier(r: Rognage | undefined): boolean {
  return !r || (Math.abs(r.x) < 1e-5 && Math.abs(r.y) < 1e-5 && Math.abs(r.largeur - 1) < 1e-5 && Math.abs(r.hauteur - 1) < 1e-5 && Math.abs(r.angle) < 0.005);
}

/**
 * Ce que le document garde : un recadrage contraint, arrondi (cinq décimales, l'angle au
 * centième de degré, rétréci d'un cheveu s'il le faut pour tenir dans l'image) ; `undefined`
 * pour toute l'image droite ou une valeur illisible.
 */
export function normaliserRognage(r: unknown, W: number, H: number): Rognage | undefined {
  if (!r || typeof r !== "object" || !(W > 0) || !(H > 0)) return undefined;
  const v = r as Record<string, unknown>;
  const n = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? x : d);
  let g = contraindre({ x: n(v.x, 0), y: n(v.y, 0), largeur: n(v.largeur, 1), hauteur: n(v.hauteur, 1), angle: n(v.angle, 0) }, W, H);
  const fige = (q: Rognage): Rognage => ({ x: arrondir(q.x, 1e-5), y: arrondir(q.y, 1e-5), largeur: arrondir(q.largeur, 1e-5), hauteur: arrondir(q.hauteur, 1e-5), angle: arrondir(q.angle, 0.01) });
  let f = fige(g);
  // L'arrondi peut faire déborder un coin d'une fraction de pixel : on resserre un peu.
  for (let i = 0; i < 4 && !dansImage(f, W, H, 0.05); i++) {
    const c = centreDe(g, W, H);
    g = depuisCentre(c, g.largeur * W * 0.9999, g.hauteur * H * 0.9999, g.angle, W, H);
    f = fige(contraindre({ ...g, angle: f.angle }, W, H));
  }
  if (estEntier(f)) return undefined;
  return { ...f, x: f.x || 0, y: f.y || 0, angle: f.angle || 0 };
}

/** Le recadrage tel qu'il s'applique (toute l'image droite s'il n'y en a pas). */
export function rognageOuEntier(r: Rognage | undefined): Rognage {
  return r ?? ROGNAGE_ENTIER;
}

/**
 * La matrice qui pose l'image (`W` × `H`, dans ses propres unités) dans la boîte de l'élément
 * (`w` × `h`) : rotation du redressement autour du centre de l'image, puis le rectangle gardé
 * étiré sur la boîte. Vers une boîte de 1 × 1, c'est le repère du vignetage du noyau.
 */
export function matriceRognage(r: Rognage | undefined, W: number, H: number, w: number, h: number): MatriceRognage {
  const g = rognageOuEntier(r);
  const t = g.angle * RAD;
  const co = Math.cos(t);
  const si = Math.sin(t);
  const gauche = (g.x - 0.5) * W;
  const haut = (g.y - 0.5) * H;
  const sx = w / (g.largeur * W);
  const sy = h / (g.hauteur * H);
  return [sx * co, sy * si, -sx * si, sy * co, sx * (-co * (W / 2) + si * (H / 2) - gauche), sy * (-si * (W / 2) - co * (H / 2) - haut)];
}

/** Les proportions du rectangle gardé, en pixels (largeur sur hauteur). */
export function proportionsDe(r: Rognage | undefined, W: number, H: number): number {
  const g = rognageOuEntier(r);
  return (g.largeur * W) / (g.hauteur * H);
}

/**
 * Redresser : l'image tourne autour du centre du rectangle gardé (qui reste sur le même point de
 * la photo) ; le rectangle se resserre, en gardant ses proportions, autant qu'il le faut pour
 * ne pas montrer de coin vide.
 */
export function redresser(r: Rognage | undefined, angle: number, W: number, H: number): Rognage {
  const g = rognageOuEntier(r);
  const a = borner(Number.isFinite(angle) ? angle : 0, -ANGLE_MAX_ROGNAGE, ANGLE_MAX_ROGNAGE);
  const q = versOriginal(centreDe(g, W, H), g.angle);
  return contraindre(depuisCentre(versRedresse(q, a), g.largeur * W, g.hauteur * H, a, W, H), W, H);
}

/**
 * Des proportions toutes prêtes (`ratio` : largeur sur hauteur, en pixels) : le plus grand
 * rectangle de ces proportions qui tient dans l'image redressée, centré sur le rectangle actuel
 * autant que possible (ramené vers le centre de l'image s'il touche un bord).
 */
export function proportionner(r: Rognage | undefined, ratio: number, W: number, H: number): Rognage {
  const g = rognageOuEntier(r);
  const a = ratio / 2;
  const b = 0.5;
  // Le plus grand, centré sur l'image ; puis le plus près possible du centre actuel.
  const k0 = facteurMax({ x: 0, y: 0 }, a, b, g.angle, W, H) * (1 - 1e-9);
  const c = centrePossible(centreDe(g, W, H), a * k0, b * k0, g.angle, W, H);
  return contraindre(depuisCentre(c, 2 * a * k0, 2 * b * k0, g.angle, W, H), W, H);
}

/** Le centre le plus proche de `voulu` où un rectangle de demi-côtés `a`, `b` (repère redressé)
 *  tient dans l'image : vu depuis l'original, chaque coin borne le centre sur chaque axe. */
function centrePossible(voulu: Pt, a: number, b: number, angle: number, W: number, H: number): Pt {
  const q = versOriginal(voulu, angle);
  const coins = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ].map(([sx, sy]) => versOriginal({ x: sx * a, y: sy * b }, angle));
  const xs = coins.map((d) => d.x);
  const ys = coins.map((d) => d.y);
  const bx = [-W / 2 - Math.min(...xs), W / 2 - Math.max(...xs)];
  const by = [-H / 2 - Math.min(...ys), H / 2 - Math.max(...ys)];
  return versRedresse({ x: bx[0] <= bx[1] ? borner(q.x, bx[0], bx[1]) : 0, y: by[0] <= by[1] ? borner(q.y, by[0], by[1]) : 0 }, angle);
}

/** La part `t` (de 0 à 1) la plus grande d'un changement qui garde le rectangle dans l'image. */
function plusGrandePart(essai: (t: number) => Rognage, W: number, H: number): Rognage {
  const complet = essai(1);
  if (dansImage(complet, W, H)) return complet;
  let bas = 0;
  let haut = 1;
  for (let i = 0; i < 24; i++) {
    const t = (bas + haut) / 2;
    if (dansImage(essai(t), W, H)) bas = t;
    else haut = t;
  }
  return essai(bas);
}

/** Déplace le rectangle gardé de `dx`, `dy` (pixels de l'original, repère redressé), sans sortir
 *  de l'image : il glisse le long d'un bord qu'il touche. */
export function deplacer(r: Rognage | undefined, dx: number, dy: number, W: number, H: number): Rognage {
  const g = rognageOuEntier(r);
  const enX = plusGrandePart((t) => ({ ...g, x: g.x + (dx * t) / W }), W, H);
  return plusGrandePart((t) => ({ ...enX, y: enX.y + (dy * t) / H }), W, H);
}

export type Poignee = "n" | "s" | "e" | "o" | "ne" | "no" | "se" | "so";

/**
 * Tire une poignée du rectangle gardé de `dx`, `dy` (pixels de l'original, repère redressé) ; le
 * côté ou le coin opposé reste en place. `ratio` (largeur sur hauteur) : des proportions
 * gardées ; un côté tiré seul fait alors grandir l'autre autour de son milieu. Le rectangle
 * s'arrête au bord de l'image et ne descend pas sous 2 % de l'original.
 */
export function tirer(r: Rognage | undefined, poignee: Poignee, dx: number, dy: number, ratio: number | null, W: number, H: number): Rognage {
  const g0 = rognageOuEntier(r);
  const rect = rectangleRedresse(g0, W, H);
  const minL = COTE_MIN_ROGNAGE * W;
  const minH = COTE_MIN_ROGNAGE * H;
  const ouest = poignee.includes("o");
  const est = poignee.includes("e");
  const nord = poignee.includes("n");
  const sud = poignee.includes("s");
  const essai = (t: number): Rognage => {
    let g = rect.gauche;
    let d = rect.gauche + rect.largeur;
    let hh = rect.haut;
    let b = rect.haut + rect.hauteur;
    if (ouest) g = Math.min(g + dx * t, d - minL);
    if (est) d = Math.max(d + dx * t, g + minL);
    if (nord) hh = Math.min(hh + dy * t, b - minH);
    if (sud) b = Math.max(b + dy * t, hh + minH);
    if (ratio && ratio > 0) {
      let l = d - g;
      let h = b - hh;
      const horizontal = ouest || est;
      const vertical = nord || sud;
      if (horizontal && vertical) {
        // Un coin : la dimension qui a le plus grandi (en proportion) mène.
        if (l / rect.largeur >= h / rect.hauteur) h = l / ratio;
        else l = h * ratio;
      } else if (horizontal) h = l / ratio;
      else l = h * ratio;
      // L'ancre : le côté opposé (ou le milieu pour un côté tiré seul).
      if (ouest) g = d - l;
      else if (est) d = g + l;
      else {
        const m = rect.gauche + rect.largeur / 2;
        g = m - l / 2;
        d = m + l / 2;
      }
      if (nord) hh = b - h;
      else if (sud) b = hh + h;
      else {
        const m = rect.haut + rect.hauteur / 2;
        hh = m - h / 2;
        b = m + h / 2;
      }
    }
    return { x: g / W + 0.5, y: hh / H + 0.5, largeur: (d - g) / W, hauteur: (b - hh) / H, angle: g0.angle };
  };
  return plusGrandePart(essai, W, H);
}

/** Changer la taille du rectangle gardé autour de son centre (`k` : 2 le double), sans sortir
 *  de l'image ni descendre sous 2 %. */
export function agrandir(r: Rognage | undefined, k: number, W: number, H: number): Rognage {
  const g = rognageOuEntier(r);
  const c = centreDe(g, W, H);
  const kMin = Math.max(COTE_MIN_ROGNAGE / g.largeur, COTE_MIN_ROGNAGE / g.hauteur);
  const kk = Math.max(k, kMin);
  const kMax = facteurMax(c, (g.largeur * W) / 2, (g.hauteur * H) / 2, g.angle, W, H);
  const f = Math.min(kk, kMax);
  return depuisCentre(c, g.largeur * W * f, g.hauteur * H * f, g.angle, W, H);
}

/** Ce qu'il faut savoir de la boîte d'un élément pour la recadrer. */
export interface BoiteElement {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  rotation: number;
  retourneH: boolean;
  retourneV: boolean;
}

/** Le point `(px, py)` de la boîte de l'élément (avant retournement), vers la page. */
export function versPage(el: BoiteElement, px: number, py: number): Pt {
  const lx = el.retourneH ? el.largeur - px : px;
  const ly = el.retourneV ? el.hauteur - py : py;
  const t = el.rotation * RAD;
  return { x: el.x + lx * Math.cos(t) - ly * Math.sin(t), y: el.y + lx * Math.sin(t) + ly * Math.cos(t) };
}

/**
 * La boîte de l'élément après un nouveau rectangle gardé de même angle, la photo restant à sa
 * place sur la page (même échelle) : tirer une poignée déplace un bord de la boîte, rien d'autre.
 */
export function boiteApresRognage(el: BoiteElement, avant: Rognage | undefined, apres: Rognage, W: number, H: number): { x: number; y: number; largeur: number; hauteur: number } {
  const a = rectangleRedresse(rognageOuEntier(avant), W, H);
  const b = rectangleRedresse(apres, W, H);
  const sx = el.largeur / a.largeur;
  const sy = el.hauteur / a.hauteur;
  const largeur = b.largeur * sx;
  const hauteur = b.hauteur * sy;
  // Le nouveau coin dans la boîte d'avant (repère de l'image, avant retournement).
  const px = (b.gauche - a.gauche) * sx;
  const py = (b.haut - a.haut) * sy;
  // Retournée, la boîte se lit de l'autre côté : son coin de page est le coin opposé.
  const coin = versPage(el, el.retourneH ? px + largeur : px, el.retourneV ? py + hauteur : py);
  return { x: coin.x, y: coin.y, largeur, hauteur };
}

/**
 * La boîte de l'élément quand le cadre change d'angle (redresser) ou de forme sans que la photo
 * puisse rester en place : même centre sur la page ; mêmes côtés si les proportions n'ont pas
 * changé, sinon la même surface.
 */
export function boiteMemeCentre(el: BoiteElement, avant: Rognage | undefined, apres: Rognage, W: number, H: number): { x: number; y: number; largeur: number; hauteur: number } {
  const p0 = proportionsDe(avant, W, H);
  const p1 = proportionsDe(apres, W, H);
  let largeur = el.largeur;
  let hauteur = el.hauteur;
  if (Math.abs(p1 - p0) > 1e-6 * p0) {
    const surface = el.largeur * el.hauteur;
    largeur = Math.sqrt(surface * p1);
    hauteur = largeur / p1;
  }
  const t = el.rotation * RAD;
  const cx = el.x + (el.largeur / 2) * Math.cos(t) - (el.hauteur / 2) * Math.sin(t);
  const cy = el.y + (el.largeur / 2) * Math.sin(t) + (el.hauteur / 2) * Math.cos(t);
  return { x: cx - (largeur / 2) * Math.cos(t) + (hauteur / 2) * Math.sin(t), y: cy - (largeur / 2) * Math.sin(t) - (hauteur / 2) * Math.cos(t), largeur, hauteur };
}

/** Les proportions prêtes : identifiant, nom, rapport (largeur sur hauteur ; `null` : libre ;
 *  `"original"` et `"page"` se calculent). */
export const PROPORTIONS: { id: string; nom: string; rapport: number | "original" | "page" | null }[] = [
  { id: "libre", nom: "Libre", rapport: null },
  { id: "original", nom: "Original", rapport: "original" },
  { id: "page", nom: "Page", rapport: "page" },
  { id: "1:1", nom: "1:1", rapport: 1 },
  { id: "4:5", nom: "4:5", rapport: 4 / 5 },
  { id: "3:2", nom: "3:2", rapport: 3 / 2 },
  { id: "4:3", nom: "4:3", rapport: 4 / 3 },
  { id: "16:9", nom: "16:9", rapport: 16 / 9 },
];

/** Le rapport d'une proportion prête (`portrait` : retournée) ; `null` pour libre. Les noms
 *  « 5:4 », « 2:3 », « 3:4 », « 9:16 » sont lus aussi (le pont IA). */
export function rapportDe(id: string, W: number, H: number, page: { largeur: number; hauteur: number }, portrait = false): number | null {
  const p = PROPORTIONS.find((x) => x.id === id);
  let r: number | null;
  if (p) r = p.rapport === "original" ? W / H : p.rapport === "page" ? page.largeur / page.hauteur : p.rapport;
  else {
    const m = /^(\d+(?:[.,]\d+)?):(\d+(?:[.,]\d+)?)$/.exec(id.trim());
    if (!m) return null;
    const a = Number(m[1].replace(",", "."));
    const b = Number(m[2].replace(",", "."));
    r = a > 0 && b > 0 ? a / b : null;
  }
  if (r === null) return null;
  // Retournée : en hauteur (« Original » aussi, comme dans Lightroom).
  return portrait ? 1 / r : r;
}
