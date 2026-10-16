// Les préréglages du labo photo (étape 5, lot 3) : ceux qu'Eliot fournit (`prereglages.json`,
// dessinés par Claude) et ceux qu'Alexandre enregistre (rangés hors des designs, voir
// `labo/prereglages.ts`). Un préréglage est un style : il ne touche ni à l'exposition, ni à la
// netteté, ni à la réduction du bruit, qui restent propres à chaque photo. L'appliquer remplace
// tout le reste de la retouche ; son intensité, de 0 à 100 %, rapproche chaque valeur de zéro
// (et chaque point de la courbe de la diagonale).

import fournis from "./prereglages.json";
import { CANAUX_COURBE, cleReglages, COULEURS_MELANGEUR, CURSEURS_LABO, normaliserReglages, type CourbeTonalites, type ReglagesPhoto } from "./labo";

export interface Prereglage {
  id: string;
  nom: string;
  /** Une des catégories des préréglages fournis, ou « Les miens ». */
  categorie: string;
  reglages: ReglagesPhoto;
}

export const CATEGORIE_MIENS = "Les miens";
export const CATEGORIES_FOURNIES: string[] = fournis.categories;
export const PREREGLAGES_FOURNIS: Prereglage[] = (fournis.prereglages as unknown as Prereglage[]).map((p) => ({ ...p, reglages: normaliserReglages(p.reglages) ?? {} }));

/** Les réglages propres à chaque photo, qu'un préréglage ne touche pas. */
export const GARDES_PAR_LA_PHOTO = ["exposition", "nettete", "bruit"] as const;

/** Les réglages sans ceux que la photo garde : le style. */
export function style(r: ReglagesPhoto | undefined): ReglagesPhoto | undefined {
  if (!r) return undefined;
  const copie: ReglagesPhoto = { ...r };
  for (const k of GARDES_PAR_LA_PHOTO) delete copie[k];
  return normaliserReglages(copie);
}

/** Les seuls réglages que la photo garde. */
export function gardes(r: ReglagesPhoto | undefined): ReglagesPhoto {
  const sortie: ReglagesPhoto = {};
  for (const k of GARDES_PAR_LA_PHOTO) if (r?.[k] !== undefined) sortie[k] = r[k];
  return sortie;
}

/** Les réglages rapprochés de zéro : `k` de 0 (rien) à 1 (tels quels). */
export function echelonner(r: ReglagesPhoto | undefined, k: number): ReglagesPhoto | undefined {
  if (!r) return undefined;
  const sortie: ReglagesPhoto = {};
  for (const d of CURSEURS_LABO) if (r[d.cle] !== undefined) sortie[d.cle] = r[d.cle]! * k;
  if (r.melangeur) {
    sortie.melangeur = {};
    for (const c of COULEURS_MELANGEUR) {
      const m = r.melangeur[c];
      if (m) sortie.melangeur[c] = { teinte: (m.teinte ?? 0) * k, saturation: (m.saturation ?? 0) * k, luminance: (m.luminance ?? 0) * k };
    }
  }
  if (r.courbe) {
    const courbe: CourbeTonalites = {};
    for (const canal of CANAUX_COURBE) {
      const p = r.courbe[canal];
      if (p) courbe[canal] = p.map(([x, y]) => [x, x + (y - x) * k]);
    }
    sortie.courbe = courbe;
  }
  return normaliserReglages(sortie);
}

/**
 * Les réglages d'une photo après un préréglage : le style du préréglage, à l'intensité voulue
 * (en %), et ce que la photo garde (exposition, netteté, réduction du bruit).
 */
export function appliquerPrereglage(actuels: ReglagesPhoto | undefined, p: Prereglage, intensite = 100): ReglagesPhoto | undefined {
  const k = Math.min(100, Math.max(0, intensite)) / 100;
  return normaliserReglages({ ...echelonner(style(p.reglages), k), ...gardes(actuels) });
}

/** Deux retouches ont-elles le même style (à l'exposition, la netteté et le bruit près) ? */
export function memeStyle(a: ReglagesPhoto | undefined, b: ReglagesPhoto | undefined): boolean {
  return cleReglages(style(a)) === cleReglages(style(b));
}

function simplifier(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Un préréglage par son identifiant ou son nom (sans tenir compte des accents ni des
 *  majuscules). */
export function trouverPrereglage(liste: Prereglage[], nomOuId: string): Prereglage | undefined {
  const cherche = simplifier(nomOuId);
  return liste.find((p) => p.id === nomOuId) ?? liste.find((p) => simplifier(p.nom) === cherche);
}
