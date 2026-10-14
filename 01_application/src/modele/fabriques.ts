// Fabriques : les valeurs par défaut de chaque nouvel élément, au centre de la page.

import Konva from "konva";
import { POLICE_PAR_DEFAUT, pilePolice, variantesPossibles } from "../polices";
import { APPAREILS, casesDeGrille, DISPOSITIONS, RECADRAGE_PAR_DEFAUT } from "./cadres";
import {
  COULEUR_PAR_DEFAUT_FOND,
  VERSION_DOCUMENT,
  type DocumentEliot,
  type Appareil,
  type ElementCadre,
  type ElementEmoji,
  type ElementForme,
  type ElementMaquette,
  type FormeCadre,
  type ElementIcone,
  type ElementImage,
  type ElementQr,
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

/** Le texte tel qu'il s'affiche (en capitales si l'effet est choisi). */
export const texteAffiche = (el: Pick<ElementTexte, "texte"> & { majuscules?: boolean }) => (el.majuscules ? el.texte.toLocaleUpperCase("fr") : el.texte);

/** Hauteur réelle d'un texte, mesurée par Konva avec la même police que l'écran. */
export function mesurerHauteurTexte(el: Pick<ElementTexte, "texte" | "largeur" | "police" | "taillePolice" | "gras" | "italique" | "interligne" | "espacement"> & { majuscules?: boolean }): number {
  const mesure = new Konva.Text({
    text: texteAffiche(el) || " ",
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
  Object.assign(base, variantesPossibles(base.police, base));
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

export const estTrait = (forme: GenreForme) => forme === "ligne" || forme === "fleche";

/** Hauteur de la boîte d'une ligne ou d'une flèche : le trait, ou la pointe de la flèche. */
export const hauteurTrait = (forme: GenreForme, epaisseur: number) => Math.max(4, forme === "fleche" ? epaisseur * 3.2 : epaisseur);

const elementCentre = (page: Format, largeur: number, hauteur: number) => ({
  id: nouvelId(),
  x: Math.round((page.largeur - largeur) / 2),
  y: Math.round((page.hauteur - hauteur) / 2),
  largeur,
  hauteur,
  rotation: 0,
  opacite: 1,
  visible: true,
  verrouille: false,
});

export function creerForme(page: Format, forme: GenreForme, options: Partial<ElementForme> = {}): ElementForme {
  const cote = Math.round(Math.min(page.largeur, page.hauteur) * 0.35);
  if (estTrait(forme)) {
    const epaisseur = Math.max(4, Math.round(Math.min(page.largeur, page.hauteur) / 160));
    const largeur = Math.round(Math.min(page.largeur, page.hauteur) * 0.45);
    return {
      ...elementCentre(page, largeur, hauteurTrait(forme, epaisseur)),
      type: "forme",
      forme,
      remplissage: "#1f1f1d",
      contour: "#1f1f1d",
      epaisseurContour: epaisseur,
      arrondi: 0,
      ...(forme === "fleche" ? { pointes: { debut: false, fin: true } } : {}),
      ...options,
    };
  }
  return {
    ...elementCentre(page, cote, cote),
    type: "forme",
    forme,
    remplissage: "#4f46e5",
    contour: "#1f1f1d",
    epaisseurContour: 0,
    arrondi: 0,
    ...(forme === "polygone" ? { cotes: 6 } : {}),
    ...options,
  };
}

/** Une icône de la bibliothèque, carrée, au quart de la page. */
export function creerIcone(page: Format, collection: string, nom: string, couleur = "#1f1f1d"): ElementIcone {
  const cote = Math.round(Math.min(page.largeur, page.hauteur) * 0.25);
  return { ...elementCentre(page, cote, cote), type: "icone", collection, nom, couleur };
}

export function creerEmoji(page: Format, collection: string, nom: string): ElementEmoji {
  const cote = Math.round(Math.min(page.largeur, page.hauteur) * 0.25);
  return { ...elementCentre(page, cote, cote), type: "emoji", collection, nom };
}

/** Un cadre vide, carré, au tiers de la page. */
export function creerCadre(page: Format, forme: FormeCadre, ressource?: string): ElementCadre {
  const cote = Math.round(Math.min(page.largeur, page.hauteur) * 0.45);
  return { ...elementCentre(page, cote, forme === "arche" ? Math.round(cote * 1.3) : cote), type: "cadre", forme, recadrage: { ...RECADRAGE_PAR_DEFAUT }, fond: "#dcd8cf", ...(ressource ? { ressource } : {}) };
}

/** Une grille de cadres qui remplit la page, groupée, avec un petit écart entre les cases. */
export function creerGrille(page: Format, disposition: string): ElementCadre[] {
  const d = DISPOSITIONS.find((x) => x.id === disposition) ?? DISPOSITIONS[0];
  const ecart = Math.round(Math.min(page.largeur, page.hauteur) * 0.012);
  const groupe = nouvelId("g");
  return casesDeGrille(d, { x: 0, y: 0, largeur: page.largeur, hauteur: page.hauteur }, ecart).map((c) => ({
    ...elementCentre(page, c.largeur, c.hauteur),
    x: c.x,
    y: c.y,
    type: "cadre",
    forme: "rectangle",
    recadrage: { ...RECADRAGE_PAR_DEFAUT },
    fond: "#dcd8cf",
    groupe,
  }));
}

/** Une maquette d'appareil aux bonnes proportions, haute de 70 % de la page au plus. */
export function creerMaquette(page: Format, appareil: Appareil, couleur = "#1c1c1e", ressource?: string): ElementMaquette {
  const proportion = APPAREILS[appareil].proportion;
  let hauteur = page.hauteur * 0.7;
  let largeur = hauteur * proportion;
  if (largeur > page.largeur * 0.8) {
    largeur = page.largeur * 0.8;
    hauteur = largeur / proportion;
  }
  return { ...elementCentre(page, Math.round(largeur), Math.round(hauteur)), type: "maquette", appareil, couleur, recadrage: { ...RECADRAGE_PAR_DEFAUT }, ...(ressource ? { ressource } : {}) };
}

export function creerQr(page: Format, contenu = "https://", couleur = "#1f1f1d"): ElementQr {
  const cote = Math.round(Math.min(page.largeur, page.hauteur) * 0.3);
  return { ...elementCentre(page, cote, cote), type: "qr", contenu, couleur, fond: "#ffffff", correction: "M" };
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

/** Creux d'une étoile : une étoile à beaucoup de branches devient un badge dentelé. */
export const creuxEtoile = (branches: number) => (branches >= 10 ? 0.8 : 0.45);

/** Sommets d'une étoile inscrite dans la boîte (étirable avec elle). */
export function pointsEtoile(largeur: number, hauteur: number, branches = 5, creux = 0.45): number[] {
  const points: number[] = [];
  for (let i = 0; i < branches * 2; i++) {
    const rayon = i % 2 === 0 ? 0.5 : 0.5 * creux;
    const angle = -Math.PI / 2 + (i * Math.PI) / branches;
    points.push((0.5 + rayon * Math.cos(angle)) * largeur, (0.5 + rayon * Math.sin(angle)) * hauteur);
  }
  return points;
}

const NOMS_FORMES: Record<GenreForme, string> = {
  rectangle: "Rectangle",
  ellipse: "Cercle",
  triangle: "Triangle",
  etoile: "Étoile",
  polygone: "Polygone",
  coeur: "Cœur",
  ligne: "Ligne",
  fleche: "Flèche",
};

export function nomElement(el: ElementPage): string {
  if (el.nom) return el.nom;
  switch (el.type) {
    case "texte":
      return el.texte.replace(/\s+/g, " ").slice(0, 28) || "Texte vide";
    case "image":
      return "Image";
    case "icone":
      return `Icône ${el.nom.replace(/-/g, " ")}`;
    case "emoji":
      return "Emoji";
    case "qr":
      return "QR code";
    case "forme":
      return el.forme === "rectangle" && el.arrondi > 0 ? "Rectangle arrondi" : NOMS_FORMES[el.forme];
    case "cadre":
      return el.ressource ? "Cadre photo" : "Cadre vide";
    case "maquette":
      return APPAREILS[el.appareil].libelle;
  }
}

/** Sommets d'un polygone régulier inscrit dans la boîte, pointe en haut. */
export function pointsPolygone(largeur: number, hauteur: number, cotes = 6): number[] {
  const points: number[] = [];
  for (let i = 0; i < cotes; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / cotes;
    points.push((0.5 + 0.5 * Math.cos(angle)) * largeur, (0.5 + 0.5 * Math.sin(angle)) * hauteur);
  }
  return points;
}
