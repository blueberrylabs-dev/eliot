// La lisibilité d'un texte (étape 7, lot 3), en fonctions pures : le contraste selon le WCAG
// (le rapport des luminances relatives, de 1 à 21), la taille à laquelle le texte sera lu (sur
// un téléphone tenu droit, ou imprimé), et la mesure du contraste sur des pixels : ceux des
// lettres et ceux de ce qui est derrière elles. Les rendus viennent de l'appelant.

import { estPapier } from "./aides";
import type { Format } from "./types";

export type Rgb = [number, number, number];

/** Un téléphone tenu droit, en pixels CSS (la largeur d'un iPhone récent, 390 × 844) : une page
 *  y tient entière, à la plus grande taille possible. */
export const ECRAN_TELEPHONE = { largeur: 390, hauteur: 844 };

export interface Lecture {
  support: "telephone" | "papier";
  /** Pixels vus (ou points imprimés) par pixel de la page. */
  facteur: number;
  unite: "px" | "pt";
  /** En dessous, un texte se lit mal : 12 px vus sur un téléphone, 8 points imprimés. */
  minimum: number;
  /** Un « grand texte » au sens du WCAG (3 : 1 lui suffit) : 24 px (18 points), ou 18,66 px
   *  (14 points) en gras. */
  grand: number;
  grandGras: number;
}

export function lecturePage(format: Format): Lecture {
  if (estPapier(format)) return { support: "papier", facteur: 72 / 300, unite: "pt", minimum: 8, grand: 18, grandGras: 14 };
  return {
    support: "telephone",
    facteur: Math.min(ECRAN_TELEPHONE.largeur / format.largeur, ECRAN_TELEPHONE.hauteur / format.hauteur),
    unite: "px",
    minimum: 12,
    grand: 24,
    grandGras: 18.66,
  };
}

/** La taille à laquelle un texte de `taillePolice` pixels de page sera lu. */
export const tailleVue = (taillePolice: number, lecture: Lecture) => taillePolice * lecture.facteur;

/** La plus petite taille de police (pixels de page) qui se lit encore bien. */
export const tailleMinimale = (lecture: Lecture) => Math.ceil(lecture.minimum / lecture.facteur);

export const estGrandTexte = (taillePolice: number, gras: boolean, lecture: Lecture) => tailleVue(taillePolice, lecture) >= (gras ? lecture.grandGras : lecture.grand) - 1e-9;

/** Le rapport demandé par le WCAG (niveau AA) : 4,5 : 1, ou 3 : 1 pour un grand texte. */
export const seuilContraste = (taillePolice: number, gras: boolean, lecture: Lecture) => (estGrandTexte(taillePolice, gras, lecture) ? 3 : 4.5);

/** Luminance relative d'une couleur sRGB (0 à 255 par canal), selon le WCAG 2. */
export function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Rapport de contraste entre deux luminances, de 1 (aucun) à 21 (noir sur blanc). */
export function rapport(l1: number, l2: number): number {
  const [a, b] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}

export const contrasteCouleurs = (a: Rgb, b: Rgb) => rapport(luminance(a), luminance(b));

export function hexEnRgb(hex: string): Rgb | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

export const rgbEnHex = ([r, g, b]: Rgb) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;

/** Le `p`-ième centile (0 à 1) d'une liste de nombres. */
export function centile(valeurs: number[], p: number): number {
  if (valeurs.length === 0) return NaN;
  const t = [...valeurs].sort((a, b) => a - b);
  const i = Math.min(t.length - 1, Math.max(0, Math.round(p * (t.length - 1))));
  return t[i];
}

/** Agrandit un masque de `rayon` pixels (un carré autour de chaque pixel), en deux passes. */
export function dilater(masque: Uint8Array, largeur: number, hauteur: number, rayon: number): Uint8Array {
  if (rayon <= 0) return masque.slice();
  const h = new Uint8Array(masque.length);
  for (let y = 0; y < hauteur; y++) {
    let dernier = -Infinity;
    // Distance au dernier pixel allumé à gauche, puis à droite.
    for (let x = 0; x < largeur; x++) {
      if (masque[y * largeur + x]) dernier = x;
      if (x - dernier <= rayon) h[y * largeur + x] = 1;
    }
    dernier = Infinity;
    for (let x = largeur - 1; x >= 0; x--) {
      if (masque[y * largeur + x]) dernier = x;
      if (dernier - x <= rayon) h[y * largeur + x] = 1;
    }
  }
  const v = new Uint8Array(masque.length);
  for (let x = 0; x < largeur; x++) {
    let dernier = -Infinity;
    for (let y = 0; y < hauteur; y++) {
      if (h[y * largeur + x]) dernier = y;
      if (y - dernier <= rayon) v[y * largeur + x] = 1;
    }
    dernier = Infinity;
    for (let y = hauteur - 1; y >= 0; y--) {
      if (h[y * largeur + x]) dernier = y;
      if (dernier - y <= rayon) v[y * largeur + x] = 1;
    }
  }
  return v;
}

export interface MesureContraste {
  /** Le rapport tenu par presque tout le texte (le 15e centile : un texte dont un sixième se
   *  perd sur son fond compte comme peu lisible). */
  rapport: number;
  /** La couleur des lettres et celle du fond, représentatives (médianes). */
  texte: Rgb;
  fond: Rgb;
  /** Le même rapport si les lettres étaient blanches, ou presque noires (#111111) : la
   *  correction d'un clic n'est proposée que si elle suffit. */
  blanc: number;
  noir: number;
}

const mediane = (valeurs: number[]) => centile(valeurs, 0.5);

/**
 * Le contraste d'un texte, mesuré sur deux rendus de la même zone, de même taille : `fond`, ce
 * qui est derrière le texte (la page jusqu'à lui, son surlignage compris), opaque ; `lettres`,
 * ses lettres seules, sans effet ni opacité, sur un fond transparent. Le fond se lit sous les
 * lettres et autour d'elles, à `rayon` pixels. Avec `opacite`, la couleur des lettres se mêle à
 * celle du fond ; avec un `contour` épais, des lettres cernées d'une couleur qui tranche à la
 * fois sur le fond et sur elles se lisent aussi.
 */
export function mesurerContraste(fond: Uint8ClampedArray, lettres: Uint8ClampedArray, largeur: number, hauteur: number, options: { rayon: number; opacite?: number; contour?: Rgb | null }): MesureContraste | null {
  const n = largeur * hauteur;
  const glyphes = new Uint8Array(n);
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  let compte = 0;
  for (let i = 0; i < n; i++) {
    const a = lettres[i * 4 + 3];
    if (a >= 128) {
      glyphes[i] = 1;
      compte++;
      // Les pixels pleins seulement pour la couleur : les bords sont mêlés de transparent.
      if (a >= 220) {
        r.push(lettres[i * 4]);
        g.push(lettres[i * 4 + 1]);
        b.push(lettres[i * 4 + 2]);
      }
    }
  }
  if (compte < 4) return null;
  const texte: Rgb = r.length ? [mediane(r), mediane(g), mediane(b)] : [lettres[0], lettres[1], lettres[2]];
  const zone = dilater(glyphes, largeur, hauteur, Math.max(1, Math.round(options.rayon)));
  const op = Math.max(0, Math.min(1, options.opacite ?? 1));
  const lumContour = options.contour ? luminance(options.contour) : null;
  const contrasteTexteContour = lumContour === null ? 0 : rapport(luminance(texte), lumContour);
  const rapports: number[] = [];
  const blancs: number[] = [];
  const noirs: number[] = [];
  const lumNoir = luminance([17, 17, 17]);
  const fr: number[] = [];
  const fg: number[] = [];
  const fb: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!zone[i]) continue;
    const f: Rgb = [fond[i * 4], fond[i * 4 + 1], fond[i * 4 + 2]];
    fr.push(f[0]);
    fg.push(f[1]);
    fb.push(f[2]);
    const vu: Rgb = op >= 1 ? texte : [op * texte[0] + (1 - op) * f[0], op * texte[1] + (1 - op) * f[1], op * texte[2] + (1 - op) * f[2]];
    const lf = luminance(f);
    let c = rapport(luminance(vu), lf);
    if (lumContour !== null) c = Math.max(c, Math.min(rapport(lumContour, lf), contrasteTexteContour));
    rapports.push(c);
    blancs.push(rapport(1, lf));
    noirs.push(rapport(lumNoir, lf));
  }
  return { rapport: centile(rapports, 0.15), texte, fond: [mediane(fr), mediane(fg), mediane(fb)], blanc: centile(blancs, 0.15), noir: centile(noirs, 0.15) };
}

/** Écrit un rapport de contraste comme on le lit : « 2,1 : 1 ». */
export function ecrireRapport(r: number): string {
  const v = Math.floor(r * 10 + 1e-9) / 10;
  return `${(Number.isInteger(v) ? String(v) : v.toFixed(1)).replace(".", ",")} : 1`;
}

/** La couleur unie (noir ou blanc) qui se lit le mieux sur `fond`. */
export const couleurLisible = (fond: Rgb): string => (contrasteCouleurs([255, 255, 255], fond) >= contrasteCouleurs([17, 17, 17], fond) ? "#ffffff" : "#111111");

export type GenreAlerte = "contraste" | "taille";

export interface Alerte {
  /** L'élément (un texte) visé. */
  id: string;
  genre: GenreAlerte;
  /** Ce que l'alerte dit, en une phrase. */
  message: string;
  /** Contraste : le rapport mesuré ; taille : la taille vue (px ou points). */
  valeur: number;
  /** Contraste : le rapport demandé ; taille : la taille vue minimale. */
  seuil: number;
  /** Contraste : la couleur unie qui suffirait (blanc ou presque noir ; `null` si aucune ne
   *  suffit, sur un fond trop varié : un surlignage, alors) ; taille : la taille de police
   *  conseillée. */
  conseil: string | number | null;
}

/** L'alerte de taille d'un texte, s'il est trop petit pour être lu là où la page sera vue. */
export function alerteTaille(id: string, taillePolice: number, lecture: Lecture): Alerte | null {
  const vue = tailleVue(taillePolice, lecture);
  if (vue >= lecture.minimum - 1e-9) return null;
  const v = (Math.round(vue * 10) / 10).toString().replace(".", ",");
  const message =
    lecture.support === "papier"
      ? `Imprimé, ce texte fait ${v} points : sous ${lecture.minimum} points, il se lit mal. Au moins ${tailleMinimale(lecture)} px.`
      : `Sur un téléphone tenu droit, ce texte se lit à ${v} px : sous ${lecture.minimum} px, il se lit mal. Au moins ${tailleMinimale(lecture)} px.`;
  return { id, genre: "taille", message, valeur: Math.round(vue * 10) / 10, seuil: lecture.minimum, conseil: tailleMinimale(lecture) };
}

/** L'alerte de contraste d'un texte, d'après sa mesure, si elle passe sous le seuil du WCAG. */
export function alerteContraste(id: string, mesure: MesureContraste, seuil: number): Alerte | null {
  if (mesure.rapport >= seuil) return null;
  const message = `Contraste ${ecrireRapport(mesure.rapport)} entre les lettres et ce qui est derrière elles : il faut ${ecrireRapport(seuil)} pour un texte de cette taille.`;
  const [couleur, meilleur] = mesure.blanc >= mesure.noir ? ["#ffffff", mesure.blanc] : ["#111111", mesure.noir];
  return { id, genre: "contraste", message, valeur: Math.floor(mesure.rapport * 100) / 100, seuil, conseil: meilleur >= seuil ? couleur : null };
}
