// La perspective d'une photo ou d'un clip (étape 5, lot 6) : le visuel, tel qu'il remplirait sa
// boîte à plat (recadrage compris), posé sur quatre coins quelconques, comme sur l'écran
// incliné d'un ordinateur, la face d'une boîte ou une affiche en biais. Valeur de l'élément
// (règle 13) : les quatre coins, en fractions de la boîte de l'objet, qui reste la plus petite
// boîte autour d'eux. La fenêtre dessine la perspective dans un shader (`labo/moteurPerspective.ts`),
// le noyau la refait à l'export depuis l'original (`noyau/src/perspective.rs`, mêmes formules,
// tableau commun `perspective.attendus.json`).

export type Point = [number, number];

/** Les quatre coins du visuel : haut gauche, haut droit, bas droit, bas gauche, en fractions
 *  de la largeur et de la hauteur de la boîte de l'élément (de 0 à 1). */
export interface Perspective {
  coins: [Point, Point, Point, Point];
}

/** Une homographie, en lignes : x' = (h0 x + h1 y + h2) / (h6 x + h7 y + h8), etc. */
export type Homographie = [number, number, number, number, number, number, number, number, number];

/** La plus petite surface d'un quadrilatère, en part de sa boîte. */
const AIRE_MIN = 0.01;

/**
 * L'homographie qui envoie le carré unité (0, 0), (1, 0), (1, 1), (0, 1) sur les quatre coins
 * `q` (méthode de Heckbert, 1989). `null` pour un quadrilatère dégénéré.
 */
export function homographie(q: readonly Point[]): Homographie | null {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  if (Math.abs(sx) < 1e-12 && Math.abs(sy) < 1e-12) {
    // Un parallélogramme : une transformation affine.
    return [x1 - x0, x3 - x0, x0, y1 - y0, y3 - y0, y0, 0, 0, 1];
  }
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-12) return null;
  const g = (sx * dy2 - dx2 * sy) / det;
  const h = (dx1 * sy - sx * dy1) / det;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}

/** L'homographie inverse (par la matrice adjointe), ramenée à un dernier terme de 1 si possible. */
export function inverser(m: Homographie): Homographie | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-18) return null;
  const r: Homographie = [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d];
  const k = Math.abs(r[8]) > 1e-12 ? r[8] : det;
  return r.map((v) => v / k) as Homographie;
}

/** L'image du point `(x, y)`. */
export function projeter(m: Homographie, x: number, y: number): Point {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
}

/** `a` après `b` (le point passe d'abord par `b`). */
export function composer(a: Homographie, b: Homographie): Homographie {
  const r = new Array(9).fill(0) as Homographie;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
}

/** Une matrice de canevas `[a, b, c, d, e, f]` (x' = a x + c y + e) en homographie. */
export function depuisAffine(m: readonly number[]): Homographie {
  return [m[0], m[2], m[4], m[1], m[3], m[5], 0, 0, 1];
}

/** Les coins d'une perspective dans la boîte `w` × `h`, en pixels. */
export function coinsEnPixels(p: Perspective, w: number, h: number): [Point, Point, Point, Point] {
  return p.coins.map(([x, y]) => [x * w, y * h]) as [Point, Point, Point, Point];
}

/** Un quadrilatère convexe, dans le bon sens (haut gauche, haut droit, bas droit, bas gauche),
 *  d'une surface d'au moins un centième de sa boîte. */
export function quadrilatereValide(q: readonly Point[]): boolean {
  if (q.length !== 4 || !q.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))) return false;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = q[i];
    const [bx, by] = q[(i + 1) % 4];
    const [cx, cy] = q[(i + 2) % 4];
    if ((bx - ax) * (cy - by) - (by - ay) * (cx - bx) <= 0) return false;
  }
  const xs = q.map((p) => p[0]);
  const ys = q.map((p) => p[1]);
  const boite = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  let aire = 0;
  for (let i = 0; i < 4; i++) aire += q[i][0] * q[(i + 1) % 4][1] - q[(i + 1) % 4][0] * q[i][1];
  return boite > 0 && aire / 2 >= AIRE_MIN * boite;
}

/**
 * Des coins posés n'importe où (pixels, dans le repère de la boîte actuelle) : la nouvelle boîte
 * (son coin dans la boîte actuelle, ses côtés) et les coins en fractions de celle-ci. `null` si
 * le quadrilatère ne tient pas (croisé, retourné, trop mince).
 */
export function recaler(q: readonly Point[]): { x: number; y: number; largeur: number; hauteur: number; perspective: Perspective } | null {
  if (!quadrilatereValide(q)) return null;
  const xs = q.map((p) => p[0]);
  const ys = q.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const largeur = Math.max(...xs) - x;
  const hauteur = Math.max(...ys) - y;
  if (largeur < 1 || hauteur < 1) return null;
  const f = (v: number) => Math.round(v * 1e5) / 1e5;
  return { x, y, largeur, hauteur, perspective: { coins: q.map(([a, b]) => [f((a - x) / largeur), f((b - y) / hauteur)]) as Perspective["coins"] } };
}

/** Le rectangle à plat : aucune perspective (les coins sont ceux de la boîte). */
export function estAPlat(p: Perspective | undefined): boolean {
  if (!p) return true;
  const plats: Point[] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  return p.coins.every((c, i) => Math.abs(c[0] - plats[i][0]) < 1e-5 && Math.abs(c[1] - plats[i][1]) < 1e-5);
}

/** Ce que le document garde : des coins valides, en fractions de 0 à 1 ; `undefined` à plat ou
 *  pour une valeur illisible. */
export function normaliserPerspective(p: unknown): Perspective | undefined {
  if (!p || typeof p !== "object") return undefined;
  const coins = (p as { coins?: unknown }).coins;
  if (!Array.isArray(coins) || coins.length !== 4) return undefined;
  const q = coins.map((c) => (Array.isArray(c) && c.length === 2 ? [Number(c[0]), Number(c[1])] : [Number.NaN, Number.NaN])) as Point[];
  if (!q.every(([x, y]) => x >= -1e-6 && x <= 1 + 1e-6 && y >= -1e-6 && y <= 1 + 1e-6)) return undefined;
  if (!quadrilatereValide(q)) return undefined;
  const r: Perspective = { coins: q.map(([x, y]) => [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))]) as Perspective["coins"] };
  return estAPlat(r) ? undefined : r;
}

/** La taille du visuel à plat, en pixels de la page : la moyenne des côtés opposés (l'arrondi
 *  des coins et l'épaisseur de la bordure se comptent dans ces pixels-là). */
export function taillePlate(q: readonly Point[]): [number, number] {
  const d = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [(d(q[0], q[1]) + d(q[3], q[2])) / 2, (d(q[0], q[3]) + d(q[1], q[2])) / 2];
}

/** Des perspectives prêtes, sur la boîte de l'objet (un point de départ à ajuster) : le côté
 *  qui fuit est le plus court, comme s'il était plus loin. */
export const PERSPECTIVES_PRETES: { id: string; nom: string; aide: string; coins: Perspective["coins"] }[] = [
  {
    id: "fuit-gauche",
    nom: "Fuit à gauche",
    aide: "Un mur, un écran tourné vers la droite",
    coins: [
      [0, 0.12],
      [1, 0],
      [1, 1],
      [0, 0.88],
    ],
  },
  {
    id: "fuit-droite",
    nom: "Fuit à droite",
    aide: "Un mur, un écran tourné vers la gauche",
    coins: [
      [0, 0],
      [1, 0.12],
      [1, 0.88],
      [0, 1],
    ],
  },
  {
    id: "fuit-haut",
    nom: "Fuit vers le haut",
    aide: "Une table, un sol, vus de biais",
    coins: [
      [0.16, 0],
      [0.84, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    id: "fuit-bas",
    nom: "Fuit vers le bas",
    aide: "Un plafond, une enseigne vue d'en bas",
    coins: [
      [0, 0],
      [1, 0],
      [0.84, 1],
      [0.16, 1],
    ],
  },
];

/**
 * Tout ce qu'il faut pour dessiner le visuel en perspective dans la boîte `w` × `h` : `plan`,
 * l'homographie du visuel à plat (carré unité) vers la boîte ; `inverse`, de la boîte vers le
 * visuel à plat ; la taille du visuel à plat (pixels de la page).
 */
export function planPerspective(p: Perspective, w: number, h: number): { plan: Homographie; inverse: Homographie; plat: [number, number]; coins: Point[] } | null {
  const coins = coinsEnPixels(p, w, h);
  const plan = homographie(coins);
  const inverse = plan && inverser(plan);
  if (!plan || !inverse) return null;
  return { plan, inverse, plat: taillePlate(coins), coins };
}

/**
 * La distance signée (en pixels du visuel à plat ; négative dedans) au bord d'un rectangle
 * `l` × `h` aux coins arrondis de rayon `r`, au point `(x, y)` du visuel à plat. La même
 * formule dans le shader et dans le noyau.
 */
export function distanceRectangleArrondi(x: number, y: number, l: number, h: number, r: number): number {
  const rr = Math.max(0, Math.min(r, l / 2, h / 2));
  const qx = Math.abs(x - l / 2) - (l / 2 - rr);
  const qy = Math.abs(y - h / 2) - (h / 2 - rr);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
}

/** Le contour du visuel à plat (coins arrondis compris) projeté dans la boîte : l'ombre portée
 *  d'un visuel en perspective, à l'export. */
export function contourProjete(plan: Homographie, plat: [number, number], rayon: number, pas = 8): Point[] {
  const [l, h] = plat;
  const r = Math.max(0, Math.min(rayon, l / 2, h / 2));
  const points: Point[] = [];
  const arc = (cx: number, cy: number, debut: number) => {
    for (let i = 0; i <= pas; i++) {
      const t = ((debut + (90 * i) / pas) * Math.PI) / 180;
      points.push([(cx + r * Math.cos(t)) / l, (cy + r * Math.sin(t)) / h]);
    }
  };
  if (r < 0.5) points.push([0, 0], [1, 0], [1, 1], [0, 1]);
  else {
    arc(l - r, r, -90);
    arc(l - r, h - r, 0);
    arc(r, h - r, 90);
    arc(r, r, 180);
  }
  return points.map(([u, v]) => projeter(plan, u, v));
}

/** Le point de `m` en `(x, y)` et sa dérivée : `[point, d/dx, d/dy]`. */
export function projeterDerivee(m: Homographie, x: number, y: number): [Point, Point, Point] {
  const u = m[0] * x + m[1] * y + m[2];
  const v = m[3] * x + m[4] * y + m[5];
  const w = m[6] * x + m[7] * y + m[8];
  const w2 = w * w;
  return [
    [u / w, v / w],
    [(m[0] * w - u * m[6]) / w2, (m[3] * w - v * m[6]) / w2],
    [(m[1] * w - u * m[7]) / w2, (m[4] * w - v * m[7]) / w2],
  ];
}

/** Ce que l'enregistrement de la page dit d'un visuel en perspective au noyau (`plan` : du
 *  visuel à plat vers le repère de l'élément ; `source` : du visuel à plat vers l'image entière,
 *  en fractions, le recadrage ; le reste en pixels de la page à plat). */
export interface PerspectiveCalque {
  plan: Homographie;
  source: [number, number, number, number, number, number];
  plat: [number, number];
  arrondi: number;
  bordure?: { couleur: string; epaisseur: number };
}

/**
 * Ce que le pixel de sortie `(x, y)` (son centre) voit d'un visuel en perspective : sa
 * couverture (0 à 1, le bord lissé sur un pixel), sa part de bordure, le point de la source
 * (fractions) et la taille du pixel dans la source (pixels de la source). Le même calcul dans le
 * shader et dans le noyau (`echantillon`).
 */
export function echantillon(sortieVersPlat: Homographie, p: PerspectiveCalque, x: number, y: number, sourceL: number, sourceH: number): { couverture: number; bord: number; source: Point; tailleSource: number } {
  const [f, fx, fy] = projeterDerivee(sortieVersPlat, x, y);
  const [pl, ph] = p.plat;
  const px = f[0] * pl;
  const py = f[1] * ph;
  const gx = Math.hypot(fx[0] * pl, fx[1] * ph);
  const gy = Math.hypot(fy[0] * pl, fy[1] * ph);
  const w = Math.max(0.5 * (gx + gy), 1e-9);
  const s = distanceRectangleArrondi(px, py, pl, ph, p.arrondi);
  const demi = p.bordure ? Math.max(0, p.bordure.epaisseur) / 2 : 0;
  const borne = (v: number) => Math.min(1, Math.max(0, v));
  const m = p.source;
  const dsx = [(m[0] * fx[0] + m[2] * fx[1]) * sourceL, (m[1] * fx[0] + m[3] * fx[1]) * sourceH];
  const dsy = [(m[0] * fy[0] + m[2] * fy[1]) * sourceL, (m[1] * fy[0] + m[3] * fy[1]) * sourceH];
  return {
    couverture: borne(0.5 - (s - demi) / w),
    bord: demi > 0 ? borne(0.5 + (s + demi) / w) : 0,
    source: [m[0] * f[0] + m[2] * f[1] + m[4], m[1] * f[0] + m[3] * f[1] + m[5]],
    tailleSource: Math.max(Math.hypot(dsx[0], dsx[1]), Math.hypot(dsy[0], dsy[1])),
  };
}

/** La boîte du visuel en perspective dans le repère de la boîte de l'élément, bordure comprise
 *  (la même que `boite` du noyau). */
export function boiteDuVisuel(p: PerspectiveCalque): [number, number, number, number] {
  const demi = p.bordure ? Math.max(0, p.bordure.epaisseur) / 2 : 0;
  const ex = demi / Math.max(p.plat[0], 1e-9);
  const ey = demi / Math.max(p.plat[1], 1e-9);
  const coins = [
    [-ex, -ey],
    [1 + ex, -ey],
    [1 + ex, 1 + ey],
    [-ex, 1 + ey],
  ].map(([u, v]) => projeter(p.plan, u, v));
  const xs = coins.map((c) => c[0]);
  const ys = coins.map((c) => c[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
