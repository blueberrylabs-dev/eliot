// Tableaux : des cellules de texte. La mise en page (lignes coupées, hauteur de chaque rangée)
// se calcule ici, avec une mesure de texte fournie par l'appelant : l'écran, l'export et
// l'édition d'une cellule tombent ainsi exactement au même endroit.

import type { Mesure } from "./graphiques";
import type { ElementTableau } from "./types";

export const INTERLIGNE_TABLEAU = 1.25;
export const LIGNES_MAX = 60;
export const COLONNES_MAX = 20;

/** Coupe un texte en lignes qui tiennent dans `largeur` (retours à la ligne gardés ; un mot
 *  trop long est coupé). */
export function couperEnLignes(texte: string, largeur: number, taille: number, mesurer: Mesure, gras = false): string[] {
  const sortie: string[] = [];
  for (const paragraphe of texte.split("\n")) {
    const mots = paragraphe.split(/ +/);
    let ligne = "";
    for (const mot of mots) {
      const essai = ligne ? `${ligne} ${mot}` : mot;
      if (mesurer(essai, taille, gras) <= largeur || !ligne) {
        if (!ligne && mesurer(mot, taille, gras) > largeur && mot.length > 1) {
          // Mot plus large que la cellule : coupé lettre par lettre.
          let morceau = "";
          for (const lettre of mot) {
            if (morceau && mesurer(morceau + lettre, taille, gras) > largeur) {
              sortie.push(morceau);
              morceau = "";
            }
            morceau += lettre;
          }
          ligne = morceau;
        } else ligne = essai;
      } else {
        sortie.push(ligne);
        ligne = mot;
      }
    }
    sortie.push(ligne);
  }
  return sortie;
}

export interface CelluleDisposee {
  ligne: number;
  colonne: number;
  x: number;
  y: number;
  l: number;
  h: number;
  lignes: string[];
  gras: boolean;
}

export interface DispositionTableau {
  /** Haut de chaque rangée, et une valeur de plus : le bas du tableau. */
  rangees: number[];
  /** Gauche de chaque colonne, et une valeur de plus : le bord droit. */
  colonnes: number[];
  cellules: CelluleDisposee[];
  /** La hauteur qu'il faut au contenu, sans étirer les rangées. */
  hauteurNaturelle: number;
}

export function disposerTableau(el: ElementTableau, mesurer: Mesure): DispositionTableau {
  const nbCol = Math.max(1, el.colonnes.length);
  const total = el.colonnes.reduce((a, b) => a + Math.max(0.05, b), 0) || 1;
  const colonnes = [0];
  for (let c = 0; c < nbCol; c++) colonnes.push(colonnes[c] + (Math.max(0.05, el.colonnes[c] ?? 1) / total) * el.largeur);
  const t = el.taillePolice;
  const hLigne = t * INTERLIGNE_TABLEAU;
  const cellules: CelluleDisposee[] = [];
  const hauteurs = el.cellules.map((rangee, r) => {
    let maxi = 1;
    for (let c = 0; c < nbCol; c++) {
      const gras = el.entete && r === 0;
      const l = colonnes[c + 1] - colonnes[c];
      const lignes = couperEnLignes(rangee[c] ?? "", Math.max(1, l - 2 * el.marge), t, mesurer, gras);
      maxi = Math.max(maxi, lignes.length);
      cellules.push({ ligne: r, colonne: c, x: colonnes[c], y: 0, l, h: 0, lignes, gras });
    }
    return maxi * hLigne + 2 * el.marge;
  });
  const naturelle = hauteurs.reduce((a, b) => a + b, 0);
  // Un tableau plus haut que son contenu partage le surplus entre ses rangées.
  const surplus = Math.max(0, el.hauteur - naturelle) / Math.max(1, hauteurs.length);
  const rangees = [0];
  hauteurs.forEach((h, r) => rangees.push(rangees[r] + h + surplus));
  for (const c of cellules) {
    c.y = rangees[c.ligne];
    c.h = rangees[c.ligne + 1] - rangees[c.ligne];
  }
  return { rangees, colonnes, cellules, hauteurNaturelle: naturelle };
}

/** La cellule sous un point de la boîte du tableau (repère de l'élément). */
export function celluleSous(d: DispositionTableau, x: number, y: number): { ligne: number; colonne: number } | null {
  const ligne = d.rangees.findIndex((v, i) => i < d.rangees.length - 1 && y >= v && y < d.rangees[i + 1]);
  const colonne = d.colonnes.findIndex((v, i) => i < d.colonnes.length - 1 && x >= v && x < d.colonnes[i + 1]);
  return ligne >= 0 && colonne >= 0 ? { ligne, colonne } : null;
}

/** Ajoute une rangée vide après `apres` (à la fin par défaut). */
export function ajouterRangee(el: ElementTableau, apres = el.cellules.length - 1): Partial<ElementTableau> {
  if (el.cellules.length >= LIGNES_MAX) return {};
  const cellules = el.cellules.map((r) => [...r]);
  cellules.splice(apres + 1, 0, el.colonnes.map(() => ""));
  return { cellules };
}

export function retirerRangee(el: ElementTableau, rang = el.cellules.length - 1): Partial<ElementTableau> {
  if (el.cellules.length <= 1) return {};
  return { cellules: el.cellules.filter((_, i) => i !== rang) };
}

export function ajouterColonne(el: ElementTableau, apres = el.colonnes.length - 1): Partial<ElementTableau> {
  if (el.colonnes.length >= COLONNES_MAX) return {};
  const moyenne = el.colonnes.reduce((a, b) => a + b, 0) / el.colonnes.length;
  const colonnes = [...el.colonnes];
  colonnes.splice(apres + 1, 0, moyenne);
  return { colonnes, cellules: el.cellules.map((r) => [...r.slice(0, apres + 1), "", ...r.slice(apres + 1)]) };
}

export function retirerColonne(el: ElementTableau, rang = el.colonnes.length - 1): Partial<ElementTableau> {
  if (el.colonnes.length <= 1) return {};
  return { colonnes: el.colonnes.filter((_, i) => i !== rang), cellules: el.cellules.map((r) => r.filter((_, i) => i !== rang)) };
}

/** Cellules reçues de l'extérieur (une IA, un collage) : du texte, des rangées de même
 *  longueur, dans les limites. */
export function cellulesValides(brut: unknown): string[][] {
  const lignes = (Array.isArray(brut) ? brut : []).slice(0, LIGNES_MAX).map((r) => (Array.isArray(r) ? r : [r]).slice(0, COLONNES_MAX).map((c) => (c === null || c === undefined ? "" : String(c)).slice(0, 500)));
  const largeur = Math.max(1, ...lignes.map((r) => r.length));
  const propres = lignes.map((r) => [...r, ...Array(largeur - r.length).fill("")]);
  return propres.length ? propres : [[""]];
}

/** Un collage depuis un tableur (tabulations et retours à la ligne) devient des cellules. */
export function cellulesDepuisCollage(texte: string): string[][] | null {
  const lignes = texte.replace(/\r/g, "").replace(/\n+$/, "").split("\n");
  if (lignes.length < 2 && !lignes[0]?.includes("\t")) return null;
  return cellulesValides(lignes.map((l) => l.split("\t")));
}
