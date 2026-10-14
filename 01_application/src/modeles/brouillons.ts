// Petites fonctions pour écrire les modèles de départ lisiblement : chacune décrit un objet par
// sa place et ses réglages, sans identifiant ni hauteur de texte. `instancier.ts` en fait des
// éléments complets (polices chargées, textes mesurés, groupes).

import type { Alignement, Couleur, Degrade, ElementCadre, ElementForme, ElementGraphique, ElementTableau, ElementTexte, FormeCadre, GenreForme, GenreGraphique, Ombre } from "../modele/types";

/** Un objet de modèle, encore incomplet : `instancier` ajoute le reste. */
export type Brouillon = Record<string, unknown> & { type: string; x: number; y: number; largeur: number; hauteur?: number; groupe?: string; rotation?: number; opacite?: number; ombre?: Ombre };

type OptionsTexte = Partial<Pick<ElementTexte, "police" | "couleur" | "gras" | "italique" | "souligne" | "alignement" | "interligne" | "espacement" | "majuscules" | "barre" | "contour" | "surlignage">> & { groupe?: string; rotation?: number; opacite?: number; ombre?: Ombre };

export function texte(t: string, x: number, y: number, largeur: number, taille: number, o: OptionsTexte = {}): Brouillon {
  return {
    type: "texte",
    texte: t,
    x,
    y,
    largeur,
    taillePolice: taille,
    police: "Inter",
    gras: false,
    italique: false,
    souligne: false,
    alignement: "center" as Alignement,
    couleur: "#1f1f1d",
    interligne: 1.12,
    espacement: 0,
    ...o,
  };
}

type OptionsForme = Partial<Pick<ElementForme, "contour" | "epaisseurContour" | "arrondi" | "cotes" | "tirets" | "pointes">> & { groupe?: string; rotation?: number; opacite?: number; ombre?: Ombre };

export function forme(genre: GenreForme, x: number, y: number, largeur: number, hauteur: number, remplissage: Couleur, o: OptionsForme = {}): Brouillon {
  return { type: "forme", forme: genre, x, y, largeur, hauteur, remplissage, contour: "#000000", epaisseurContour: 0, arrondi: 0, ...o };
}

export const rect = (x: number, y: number, largeur: number, hauteur: number, remplissage: Couleur, o: OptionsForme = {}) => forme("rectangle", x, y, largeur, hauteur, remplissage, o);
export const rond = (x: number, y: number, largeur: number, hauteur: number, remplissage: Couleur, o: OptionsForme = {}) => forme("ellipse", x, y, largeur, hauteur, remplissage, o);

/** Une ligne horizontale de `largeur`, posée par son axe à la hauteur `y`. */
export function ligne(x: number, y: number, largeur: number, couleur: string, epaisseur: number, o: OptionsForme = {}): Brouillon {
  const h = Math.max(4, epaisseur);
  return { type: "forme", forme: "ligne", x, y: y - h / 2, largeur, hauteur: h, remplissage: couleur, contour: couleur, epaisseurContour: epaisseur, arrondi: 0, ...o };
}

export function cadre(f: FormeCadre, x: number, y: number, largeur: number, hauteur: number, o: Partial<Pick<ElementCadre, "fond" | "bordure">> & { groupe?: string; rotation?: number; ombre?: Ombre } = {}): Brouillon {
  return { type: "cadre", forme: f, x, y, largeur, hauteur, recadrage: { zoom: 1, x: 0.5, y: 0.5 }, fond: "#dcd8cf", ...o };
}

export function icone(nom: string, x: number, y: number, taille: number, couleur: string, collection = "tabler", o: { groupe?: string; rotation?: number; trait?: number } = {}): Brouillon {
  return { type: "icone", collection, nom, x, y, largeur: taille, hauteur: taille, couleur, ...o };
}

export function emoji(nom: string, x: number, y: number, taille: number, o: { groupe?: string; rotation?: number } = {}): Brouillon {
  return { type: "emoji", collection: "fluent", nom, x, y, largeur: taille, hauteur: taille, ...o };
}

export function qr(contenu: string, x: number, y: number, taille: number, couleur: string, fond: string | null): Brouillon {
  return { type: "qr", contenu, x, y, largeur: taille, hauteur: taille, couleur, fond, correction: "M" };
}

export function graphique(genre: GenreGraphique, x: number, y: number, largeur: number, hauteur: number, o: Partial<ElementGraphique> = {}): Brouillon {
  return { type: "graphique", genre, x, y, largeur, hauteur, ...o };
}

export function tableau(cellules: string[][], x: number, y: number, largeur: number, o: Partial<ElementTableau> = {}): Brouillon {
  return { type: "tableau", cellules, x, y, largeur, ...o };
}

/** Cinq étoiles pleines, centrées sur `centre`. */
export function etoiles(centre: number, y: number, taille: number, ecart: number, couleur: string): Brouillon[] {
  const total = 5 * taille + 4 * ecart;
  return Array.from({ length: 5 }, (_, i) => icone("star", centre - total / 2 + i * (taille + ecart), y, taille, couleur, "tabler-plein", { groupe: "etoiles" }));
}

export const degrade = (angle: number, a: string, b: string): Degrade => ({ type: "lineaire", angle, arrets: [{ position: 0, couleur: a }, { position: 1, couleur: b }] });
export const radial = (a: string, b: string): Degrade => ({ type: "radial", angle: 0, arrets: [{ position: 0, couleur: a }, { position: 1, couleur: b }] });

export const OMBRE_DOUCE: Ombre = { couleur: "#0f172a", flou: 36, x: 0, y: 14, opacite: 0.12 };
