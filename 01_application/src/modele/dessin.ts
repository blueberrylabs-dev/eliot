// Dessin à main levée : un trait devient un élément `dessin`. Les points sont allégés à la fin
// du geste (moins de points, même allure), puis rapportés à la boîte du trait.

import type { ElementDessin, OutilDessin } from "./types";

export type OutilCrayon = OutilDessin | "gomme";

export interface ReglagesDessin {
  outil: OutilCrayon;
  couleur: string;
  /** Épaisseur en pixels de la page. */
  epaisseur: number;
}

/** Ce que chaque outil change au trait : épaisseur proposée, transparence, bouts. */
export const OUTILS_DESSIN: Record<OutilDessin, { libelle: string; epaisseur: number; opacite: number; bout: "round" | "butt" }> = {
  stylo: { libelle: "Stylo", epaisseur: 6, opacite: 1, bout: "round" },
  marqueur: { libelle: "Marqueur", epaisseur: 18, opacite: 1, bout: "round" },
  surligneur: { libelle: "Surligneur", epaisseur: 40, opacite: 0.42, bout: "butt" },
};

/** Distance d'un point au segment [a, b]. */
function distanceSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Allège un tracé (Ramer-Douglas-Peucker) : les points à moins de `tolerance` de la ligne
 *  qui les entoure sont retirés. Les extrémités restent. */
export function simplifierTrait(points: number[], tolerance: number): number[] {
  const n = points.length / 2;
  if (n <= 2) return [...points];
  const garder = new Uint8Array(n);
  garder[0] = 1;
  garder[n - 1] = 1;
  const pile: [number, number][] = [[0, n - 1]];
  while (pile.length) {
    const [debut, fin] = pile.pop()!;
    let pire = -1;
    let ecart = 0;
    for (let i = debut + 1; i < fin; i++) {
      const d = distanceSegment(points[2 * i], points[2 * i + 1], points[2 * debut], points[2 * debut + 1], points[2 * fin], points[2 * fin + 1]);
      if (d > ecart) {
        ecart = d;
        pire = i;
      }
    }
    if (pire >= 0 && ecart > tolerance) {
      garder[pire] = 1;
      pile.push([debut, pire], [pire, fin]);
    }
  }
  const sortie: number[] = [];
  for (let i = 0; i < n; i++) if (garder[i]) sortie.push(points[2 * i], points[2 * i + 1]);
  return sortie;
}

/** Un trait tracé sur la page (points en pixels de la page) devient un élément. Un simple clic
 *  donne un point : il est dessiné comme un rond de l'épaisseur du trait. */
export function creerTrait(pointsPage: number[], outil: OutilDessin, couleur: string, epaisseur: number, id: string): ElementDessin {
  const allege = simplifierTrait(pointsPage, Math.max(0.6, epaisseur * 0.08));
  const points = allege.length === 2 ? [allege[0], allege[1], allege[0] + 0.01, allege[1]] : allege;
  const xs = points.filter((_, i) => i % 2 === 0);
  const ys = points.filter((_, i) => i % 2 === 1);
  const marge = epaisseur / 2;
  const x = Math.min(...xs) - marge;
  const y = Math.min(...ys) - marge;
  const largeur = Math.max(1, Math.max(...xs) + marge - x);
  const hauteur = Math.max(1, Math.max(...ys) + marge - y);
  const arrondi = (v: number) => Math.round(v * 10) / 10;
  return {
    id,
    type: "dessin",
    outil,
    couleur,
    epaisseur,
    points: points.map((v, i) => arrondi(i % 2 === 0 ? v - x : v - y)),
    vue: { largeur: arrondi(largeur), hauteur: arrondi(hauteur) },
    x: arrondi(x),
    y: arrondi(y),
    largeur: arrondi(largeur),
    hauteur: arrondi(hauteur),
    rotation: 0,
    opacite: 1,
    visible: true,
    verrouille: false,
  };
}

/** Distance (pixels de la page) entre un point de la page et un trait, rotation et
 *  agrandissement compris, moins la moitié de l'épaisseur : 0 ou moins, le point touche. */
export function distanceAuTrait(el: ElementDessin, px: number, py: number): number {
  // Le point dans le repère de la boîte (rotation autour du coin haut gauche, comme Konva).
  const a = (-el.rotation * Math.PI) / 180;
  const dx = px - el.x;
  const dy = py - el.y;
  const lx = dx * Math.cos(a) - dy * Math.sin(a);
  const ly = dx * Math.sin(a) + dy * Math.cos(a);
  const sx = el.largeur / el.vue.largeur;
  const sy = el.hauteur / el.vue.hauteur;
  const p = el.points;
  let mini = Infinity;
  for (let i = 0; i + 3 < p.length; i += 2) {
    mini = Math.min(mini, distanceSegment(lx, ly, p[i] * sx, p[i + 1] * sy, p[i + 2] * sx, p[i + 3] * sy));
  }
  if (p.length === 2) mini = Math.hypot(lx - p[0] * sx, ly - p[1] * sy);
  return mini - (el.epaisseur * Math.min(sx, sy)) / 2;
}
