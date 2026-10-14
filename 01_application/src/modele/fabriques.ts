// Fabriques : les valeurs par défaut de chaque nouvel élément, au centre de la page.

import Konva from "konva";
import { POLICE_PAR_DEFAUT, pilePolice } from "../polices";
import {
  COULEUR_PAR_DEFAUT_FOND,
  VERSION_DOCUMENT,
  type DocumentEliot,
  type ElementForme,
  type ElementImage,
  type ElementPage,
  type ElementTexte,
  type Format,
  type GenreForme,
  type PageEliot,
  type Ressource,
} from "./types";

let compteur = 0;
export function nouvelId(prefixe = "e"): string {
  compteur += 1;
  return `${prefixe}${Date.now().toString(36)}${compteur.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const NOM_PAR_DEFAUT = "Design sans titre";

export function nouvellePage(fond: PageEliot["fond"] = COULEUR_PAR_DEFAUT_FOND): PageEliot {
  return { id: nouvelId("p"), fond, elements: [] };
}

export function documentVide(format: Format = { largeur: 1080, hauteur: 1080 }, nom = NOM_PAR_DEFAUT): DocumentEliot {
  return { version: VERSION_DOCUMENT, nom, format: { ...format }, pages: [nouvellePage()] };
}

/** Hauteur réelle d'un texte, mesurée par Konva avec la même police que l'écran. */
export function mesurerHauteurTexte(el: Pick<ElementTexte, "texte" | "largeur" | "police" | "taillePolice" | "gras" | "italique" | "interligne" | "espacement">): number {
  const mesure = new Konva.Text({
    text: el.texte || " ",
    width: el.largeur,
    fontFamily: pilePolice(el.police),
    fontSize: el.taillePolice,
    fontStyle: styleTexte(el.gras, el.italique),
    lineHeight: el.interligne,
    letterSpacing: el.espacement,
  });
  const hauteur = mesure.height();
  mesure.destroy();
  return hauteur;
}

export const styleTexte = (gras: boolean, italique: boolean) =>
  `${italique ? "italic " : ""}${gras ? "bold" : "normal"}`;

type ModeleTexte = Pick<ElementTexte, "texte" | "taillePolice" | "gras"> & Partial<ElementTexte>;

export function creerTexte(page: Format, modele: ModeleTexte): ElementTexte {
  const largeur = Math.round(page.largeur * 0.75);
  const base = {
    police: POLICE_PAR_DEFAUT,
    italique: false,
    souligne: false,
    alignement: "center" as const,
    couleur: "#1f1f1d",
    interligne: 1.2,
    espacement: 0,
    ...modele,
    largeur,
  };
  const hauteur = mesurerHauteurTexte(base);
  return {
    id: nouvelId(),
    type: "texte",
    x: Math.round((page.largeur - largeur) / 2),
    y: Math.round((page.hauteur - hauteur) / 2),
    hauteur,
    rotation: 0,
    opacite: 1,
    visible: true,
    verrouille: false,
    ...base,
  };
}

const echelleTexte = (page: Format) => Math.max(page.largeur, page.hauteur) / 1080;

export const creerTitre = (page: Format, police?: string) =>
  creerTexte(page, { texte: "Ajouter un titre", taillePolice: Math.round(96 * echelleTexte(page)), gras: true, ...(police ? { police } : {}) });
export const creerSousTitre = (page: Format) =>
  creerTexte(page, { texte: "Ajouter un sous-titre", taillePolice: Math.round(56 * echelleTexte(page)), gras: true });
export const creerParagraphe = (page: Format) =>
  creerTexte(page, { texte: "Ajouter un paragraphe de texte", taillePolice: Math.round(32 * echelleTexte(page)), gras: false });

export function creerForme(page: Format, forme: GenreForme, arrondi = 0): ElementForme {
  const cote = Math.round(Math.min(page.largeur, page.hauteur) * 0.35);
  return {
    id: nouvelId(),
    type: "forme",
    forme,
    x: Math.round((page.largeur - cote) / 2),
    y: Math.round((page.hauteur - cote) / 2),
    largeur: cote,
    hauteur: cote,
    rotation: 0,
    opacite: 1,
    visible: true,
    verrouille: false,
    remplissage: "#4f46e5",
    contour: "#1f1f1d",
    epaisseurContour: 0,
    arrondi,
  };
}

/** L'image entre à 60 % de la page au plus, proportions gardées, au centre. */
export function creerImage(page: Format, ressource: Ressource): ElementImage {
  const echelle = Math.min((page.largeur * 0.6) / ressource.largeur, (page.hauteur * 0.6) / ressource.hauteur, 1);
  const largeur = Math.max(1, Math.round(ressource.largeur * echelle));
  const hauteur = Math.max(1, Math.round(ressource.hauteur * echelle));
  return {
    id: nouvelId(),
    type: "image",
    ressource: ressource.id,
    x: Math.round((page.largeur - largeur) / 2),
    y: Math.round((page.hauteur - hauteur) / 2),
    largeur,
    hauteur,
    rotation: 0,
    opacite: 1,
    visible: true,
    verrouille: false,
    retourneH: false,
    retourneV: false,
    nom: ressource.nom,
  };
}

/** Copie avec un nouvel identifiant, décalée pour qu'on la voie. Les éléments d'un même
 *  groupe copiés ensemble restent groupés entre eux, sous une nouvelle étiquette. */
export function dupliquer(el: ElementPage, decalage = 24, groupes?: Map<string, string>): ElementPage {
  const copie = { ...el, id: nouvelId(), x: el.x + decalage, y: el.y + decalage, verrouille: false };
  if (el.groupe) {
    if (!groupes) delete copie.groupe;
    else {
      if (!groupes.has(el.groupe)) groupes.set(el.groupe, nouvelId("g"));
      copie.groupe = groupes.get(el.groupe);
    }
  }
  return copie;
}

/** Copie de plusieurs éléments : les groupes copiés en entier gardent leur lien. */
export function dupliquerTous(elements: ElementPage[], decalage = 24): ElementPage[] {
  const groupes = new Map<string, string>();
  const compte = new Map<string, number>();
  for (const e of elements) if (e.groupe) compte.set(e.groupe, (compte.get(e.groupe) ?? 0) + 1);
  return elements.map((e) => dupliquer(e, decalage, e.groupe && (compte.get(e.groupe) ?? 0) > 1 ? groupes : undefined));
}

/** Copie d'une page entière : nouveaux identifiants, mêmes positions. */
export function dupliquerPage(page: PageEliot): PageEliot {
  return { ...page, id: nouvelId("p"), elements: dupliquerTous(page.elements, 0) };
}

/** Sommets d'une étoile à cinq branches inscrite dans la boîte (étirable avec elle). */
export function pointsEtoile(largeur: number, hauteur: number, branches = 5, creux = 0.45): number[] {
  const points: number[] = [];
  for (let i = 0; i < branches * 2; i++) {
    const rayon = i % 2 === 0 ? 0.5 : 0.5 * creux;
    const angle = -Math.PI / 2 + (i * Math.PI) / branches;
    points.push((0.5 + rayon * Math.cos(angle)) * largeur, (0.5 + rayon * Math.sin(angle)) * hauteur);
  }
  return points;
}

export function nomElement(el: ElementPage): string {
  if (el.nom) return el.nom;
  if (el.type === "texte") return el.texte.replace(/\s+/g, " ").slice(0, 28) || "Texte vide";
  if (el.type === "image") return "Image";
  return { rectangle: el.arrondi > 0 ? "Rectangle arrondi" : "Rectangle", ellipse: "Cercle", triangle: "Triangle", etoile: "Étoile" }[el.forme];
}
