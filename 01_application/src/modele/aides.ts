// Les aides pour apprendre (étape 7, lot 3), en fonctions pures : l'unité des règles (pixels,
// ou millimètres pour une page A4 ou A5), leurs graduations, la grille, la grille des tiers et
// les marges de sécurité. Rien de tout cela n'entre dans le document ni dans un export.

import { FORMATS_PAGE, type Format } from "./types";

/** Une page au format A4 ou A5 (300 dpi), dans un sens ou dans l'autre : elle se mesure en
 *  millimètres et ses tailles de texte en points. */
export function estPapier(format: Format): boolean {
  return FORMATS_PAGE.some((f) => (f.id === "a4" || f.id === "a5") && ((f.largeur === format.largeur && f.hauteur === format.hauteur) || (f.largeur === format.hauteur && f.hauteur === format.largeur)));
}

/** Un pixel d'une page de papier, à 300 points par pouce, en millimètres. */
export const MM_PAR_PIXEL_PAPIER = 25.4 / 300;

export interface Unite {
  nom: "px" | "mm";
  /** Unités par pixel de la page. */
  parPixel: number;
}

export const unitePage = (format: Format): Unite => (estPapier(format) ? { nom: "mm", parPixel: MM_PAR_PIXEL_PAPIER } : { nom: "px", parPixel: 1 });

export interface Graduation {
  /** Position sur la règle, en pixels de l'écran. */
  position: number;
  /** La valeur, en unités de la page (pixels ou millimètres) ; seulement sur un grand trait. */
  valeur?: number;
  majeure: boolean;
}

/** Le pas « rond » (1, 2 ou 5 fois une puissance de dix) le plus petit qui atteint `minimum`. */
export function pasRond(minimum: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(minimum, 1e-9))));
  for (const m of [1, 2, 5, 10]) if (m * p >= minimum - 1e-9) return m * p;
  return 10 * p;
}

/** Les graduations d'une règle de `longueur` pixels d'écran, dont le zéro de la page tombe à
 *  `origine` et où un pixel de la page fait `echelle` pixels d'écran. Un grand trait, chiffré,
 *  tous les 60 pixels d'écran au moins ; des petits traits entre, s'ils restent lisibles. */
export function graduations(longueur: number, origine: number, echelle: number, unite: Unite): Graduation[] {
  const ecranParUnite = echelle / unite.parPixel;
  if (!(ecranParUnite > 0) || !(longueur > 0)) return [];
  const majeur = pasRond(60 / ecranParUnite);
  const mantisse = Math.round(majeur / Math.pow(10, Math.floor(Math.log10(majeur))));
  const division = [10, 5, 2].find((d) => (majeur / d) * ecranParUnite >= 6 && (mantisse !== 2 || d !== 5) && (mantisse !== 5 || d !== 2)) ?? 1;
  const mineur = majeur / division;
  const premier = Math.ceil(-origine / ecranParUnite / mineur);
  const dernier = Math.floor((longueur - origine) / ecranParUnite / mineur);
  const res: Graduation[] = [];
  for (let k = premier; k <= dernier && res.length < 4000; k++) {
    const valeur = Math.round(k * mineur * 1e6) / 1e6 || 0;
    const majeure = k % division === 0;
    res.push({ position: origine + valeur * ecranParUnite, majeure, ...(majeure ? { valeur } : {}) });
  }
  return res;
}

/** Le pas de la grille par défaut : 60 pixels, ou 10 mm sur une page de papier. */
export const pasGrilleParDefaut = (format: Format): number => (estPapier(format) ? Math.round(10 / MM_PAR_PIXEL_PAPIER) : 60);

/** Au plus 200 lignes par sens : un pas trop fin pour la page se rallonge. */
const LIGNES_MAX = 200;

export interface Lignes {
  verticales: number[];
  horizontales: number[];
}

/** Les lignes d'une grille au pas donné (pixels de la page), depuis le coin en haut à gauche,
 *  sans les bords. */
export function lignesGrille(format: Format, pas: number): Lignes {
  const p = Math.max(pas, format.largeur / LIGNES_MAX, format.hauteur / LIGNES_MAX, 1);
  const suite = (n: number) => {
    const res: number[] = [];
    for (let v = p; v < n - 0.5; v += p) res.push(Math.round(v * 100) / 100);
    return res;
  };
  return { verticales: suite(format.largeur), horizontales: suite(format.hauteur) };
}

/** La grille des tiers : deux lignes dans chaque sens, aux tiers de la page. Les points forts
 *  d'une image se placent sur leurs croisements. */
export const lignesTiers = (format: Format): Lignes => ({
  verticales: [format.largeur / 3, (2 * format.largeur) / 3],
  horizontales: [format.hauteur / 3, (2 * format.hauteur) / 3],
});

/** La marge de sécurité : 5 mm sur une page de papier (ce que l'imprimeur peut rogner), 5 % du
 *  plus petit côté sur un écran (le bord d'un téléphone, un cadre arrondi, un recadrage). */
export const margeSecurite = (format: Format): number => (estPapier(format) ? Math.round(5 / MM_PAR_PIXEL_PAPIER) : Math.round(Math.min(format.largeur, format.hauteur) * 0.05));

/** Le rectangle à l'intérieur des marges de sécurité. */
export function rectangleMarges(format: Format): { x: number; y: number; largeur: number; hauteur: number } {
  const m = margeSecurite(format);
  return { x: m, y: m, largeur: format.largeur - 2 * m, hauteur: format.hauteur - 2 * m };
}

/** Une valeur en unités de la page, telle qu'une règle ou un champ l'écrit : « 120 », « 12,5 ». */
export function ecrireValeur(v: number): string {
  const r = Math.round(v * 10) / 10;
  return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace(".", ",");
}
