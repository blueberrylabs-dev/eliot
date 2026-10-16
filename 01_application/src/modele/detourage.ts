// Le détourage d'une photo (étape 5, lot 7) : le masque du modèle agrandi à la taille voulue,
// puis les coups de pinceau, dans l'ordre. Le même calcul que le noyau (`noyau/src/detourage.rs`),
// contrôlé par le tableau commun `detourage.attendus.json` : la fenêtre montre ce que l'export
// posera sur l'original.

import type { CoupPinceau, Detourage } from "./types";

/** La part du pinceau à la distance `d` (pixels) de son trait : 1 au cœur, 0 au-delà du rayon
 *  `r`, une courbe douce entre les deux, sur au moins un pixel. */
export function couverture(d: number, r: number, durete: number): number {
  const largeur = Math.min(Math.max(r * (1 - Math.min(1, Math.max(0, durete))), 1), Math.max(r, 1e-9));
  if (d >= r) return 0;
  const t = Math.min((r - d) / largeur, 1);
  return t * t * (3 - 2 * t);
}

/** Le masque `source` (`ls` x `hs`, de 0 à 255) agrandi ou réduit à `l` x `h`, de 0 à 1 :
 *  bilinéaire, centres des pixels alignés, bords prolongés. */
export function agrandir(source: Uint8Array, ls: number, hs: number, l: number, h: number): Float32Array {
  const sortie = new Float32Array(l * h);
  if (ls <= 0 || hs <= 0 || source.length < ls * hs) return sortie;
  const ex = ls / l;
  const ey = hs / h;
  const x0s = new Int32Array(l);
  const x1s = new Int32Array(l);
  const fxs = new Float64Array(l);
  for (let x = 0; x < l; x++) {
    const sx = Math.min(Math.max((x + 0.5) * ex - 0.5, 0), ls - 1);
    const x0 = Math.floor(sx);
    x0s[x] = x0;
    x1s[x] = Math.min(x0 + 1, ls - 1);
    fxs[x] = sx - x0;
  }
  for (let y = 0; y < h; y++) {
    const sy = Math.min(Math.max((y + 0.5) * ey - 0.5, 0), hs - 1);
    const y0 = Math.floor(sy);
    const y1 = Math.min(y0 + 1, hs - 1);
    const fy = sy - y0;
    const a = y0 * ls;
    const b = y1 * ls;
    const ligne = y * l;
    for (let x = 0; x < l; x++) {
      const fx = fxs[x];
      const haut = source[a + x0s[x]] + (source[a + x1s[x]] - source[a + x0s[x]]) * fx;
      const bas = source[b + x0s[x]] + (source[b + x1s[x]] - source[b + x0s[x]]) * fx;
      sortie[ligne + x] = (haut + (bas - haut) * fy) / 255;
    }
  }
  return sortie;
}

function distanceSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const n = dx * dx + dy * dy;
  const t = n > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / n)) : 0;
  return Math.sqrt((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2);
}

/** Une zone de l'image, en pixels : de `x0` (compris) à `x1` (exclu). */
export interface Zone {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** La zone que couvre un segment de rayon `r` (pixels), bornée à `limite`. */
function zoneSegment(ax: number, ay: number, bx: number, by: number, r: number, limite: Zone): Zone {
  return {
    x0: Math.max(Math.floor(Math.max(Math.min(ax, bx) - r, limite.x0)), limite.x0),
    y0: Math.max(Math.floor(Math.max(Math.min(ay, by) - r, limite.y0)), limite.y0),
    x1: Math.min(Math.ceil(Math.max(Math.max(ax, bx) + r, 0)), limite.x1),
    y1: Math.min(Math.ceil(Math.max(Math.max(ay, by) + r, 0)), limite.y1),
  };
}

/**
 * La part d'un segment du pinceau (de `a` à `b`, pixels) ajoutée à `part`, une grille de
 * `largeurPart` colonnes qui commence en (`ox`, `oy`) : le plus fort l'emporte. Renvoie la zone
 * touchée (vide si rien).
 */
export function couvrirSegment(part: Float64Array | Float32Array, largeurPart: number, ox: number, oy: number, limite: Zone, a: [number, number], b: [number, number], r: number, durete: number): Zone {
  const z = zoneSegment(a[0], a[1], b[0], b[1], r, limite);
  for (let y = z.y0; y < z.y1; y++) {
    for (let x = z.x0; x < z.x1; x++) {
      const c = couverture(distanceSegment(x + 0.5, y + 0.5, a[0], a[1], b[0], b[1]), r, durete);
      const i = (y - oy) * largeurPart + (x - ox);
      if (c > part[i]) part[i] = c;
    }
  }
  return z;
}

/** Pose sur `alpha` (de 0 à 1) la part d'un coup : « garder » rapproche de 1 ce qu'il couvre,
 *  « effacer » le rapproche de 0. `depart` : l'alpha d'avant le coup (le même tableau, sinon). */
export function combiner(alpha: Float32Array, depart: Float32Array, l: number, part: Float64Array | Float32Array, largeurPart: number, ox: number, oy: number, z: Zone, mode: CoupPinceau["mode"]): void {
  for (let y = z.y0; y < z.y1; y++) {
    for (let x = z.x0; x < z.x1; x++) {
      const c = part[(y - oy) * largeurPart + (x - ox)];
      const i = y * l + x;
      const v = depart[i];
      if (c <= 0) {
        alpha[i] = v;
        continue;
      }
      alpha[i] = mode === "garder" ? v + (1 - v) * c : v * (1 - c);
    }
  }
}

/** Les points d'un coup, en pixels d'une image de `l` x `h`, et son rayon. */
export function enPixels(coup: CoupPinceau, l: number, h: number): { points: [number, number][]; r: number } {
  return { points: coup.points.map(([u, v]) => [u * l, v * h]), r: coup.rayon * Math.max(l, h) };
}

/** Les coups de pinceau, dans l'ordre, sur `alpha` (`l` x `h`, de 0 à 1). */
export function appliquerCoups(alpha: Float32Array, l: number, h: number, coups: CoupPinceau[]): void {
  if (l <= 0 || h <= 0 || alpha.length < l * h) return;
  for (const coup of coups) {
    if (!coup.points.length || !(coup.rayon > 0)) continue;
    const { points, r } = enPixels(coup, l, h);
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const zone: Zone = {
      x0: Math.max(Math.floor(Math.min(...xs) - r), 0),
      y0: Math.max(Math.floor(Math.min(...ys) - r), 0),
      x1: Math.min(Math.max(Math.ceil(Math.max(...xs) + r), 0), l),
      y1: Math.min(Math.max(Math.ceil(Math.max(...ys) + r), 0), h),
    };
    if (zone.x0 >= zone.x1 || zone.y0 >= zone.y1) continue;
    const lb = zone.x1 - zone.x0;
    const part = new Float64Array(lb * (zone.y1 - zone.y0));
    const segments: [[number, number], [number, number]][] = points.length === 1 ? [[points[0], points[0]]] : points.slice(1).map((p, i) => [points[i], p]);
    for (const [a, b] of segments) couvrirSegment(part, lb, zone.x0, zone.y0, zone, a, b, r, coup.durete);
    combiner(alpha, alpha, l, part, lb, zone.x0, zone.y0, zone, coup.mode);
  }
}

/** Le masque complet à `l` x `h` : celui du modèle, puis les coups. */
export function masqueALaTaille(masque: { largeur: number; hauteur: number; pixels: Uint8Array }, coups: CoupPinceau[] | undefined, l: number, h: number): Float32Array {
  const a = agrandir(masque.pixels, masque.largeur, masque.hauteur, l, h);
  if (coups?.length) appliquerCoups(a, l, h, coups);
  return a;
}

/** Le détourage tel que le document le garde : sans coups vides, sans liste vide. */
export function normaliserDetourage(d: Detourage | undefined): Detourage | undefined {
  if (!d?.masque) return undefined;
  const coups = (d.coups ?? []).filter((c) => c.points.length > 0 && c.rayon > 0);
  return coups.length ? { masque: d.masque, coups } : { masque: d.masque };
}

/** Un trait de pinceau allégé : on ne garde un point que s'il s'éloigne du dernier gardé d'au
 *  moins `pas` (même unité que les points). Le dernier point est toujours gardé. */
export function alleger(points: [number, number][], pas: number): [number, number][] {
  if (points.length <= 2) return points.slice();
  const garde: [number, number][] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = garde[garde.length - 1];
    if (Math.hypot(points[i][0] - x, points[i][1] - y) >= pas) garde.push(points[i]);
  }
  garde.push(points[points.length - 1]);
  return garde;
}
