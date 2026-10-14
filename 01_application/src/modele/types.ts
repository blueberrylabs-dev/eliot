// Le document : la seule vérité d'Eliot (BRIEF, règle 1). Konva ne fait que le dessiner.

export const VERSION_DOCUMENT = 1 as const;

export type Alignement = "left" | "center" | "right";

/** La boîte commune à tous les éléments, en pixels de la page, origine en haut à gauche ;
 *  la rotation (degrés) se fait autour de ce coin, comme dans Konva. */
interface ElementBase {
  id: string;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  rotation: number;
  /** De 0 à 1. */
  opacite: number;
  visible: boolean;
  verrouille: boolean;
  nom?: string;
}

export interface ElementTexte extends ElementBase {
  type: "texte";
  texte: string;
  police: string;
  taillePolice: number;
  gras: boolean;
  italique: boolean;
  souligne: boolean;
  alignement: Alignement;
  couleur: string;
  /** Multiple de la taille de police. */
  interligne: number;
  /** Espacement des lettres, en pixels de la page. */
  espacement: number;
}

export type GenreForme = "rectangle" | "ellipse" | "triangle" | "etoile";

export interface ElementForme extends ElementBase {
  type: "forme";
  forme: GenreForme;
  remplissage: string;
  contour: string;
  epaisseurContour: number;
  /** Rayon des coins (rectangle seulement). */
  arrondi: number;
}

export interface ElementImage extends ElementBase {
  type: "image";
  /** Empreinte SHA-256 du fichier d'origine : l'image entre par référence (règle 6). */
  ressource: string;
  retourneH: boolean;
  retourneV: boolean;
}

export type ElementPage = ElementTexte | ElementForme | ElementImage;

export interface Page {
  largeur: number;
  hauteur: number;
  fond: string;
}

export interface DocumentEliot {
  version: typeof VERSION_DOCUMENT;
  page: Page;
  /** L'ordre du tableau est l'ordre d'empilement : le dernier est au-dessus. */
  elements: ElementPage[];
}

/** Une image importée, telle que l'interface la connaît : jamais l'original, seulement des
 *  adresses vers son aperçu et sa miniature. */
export interface Ressource {
  id: string;
  nom: string;
  largeur: number;
  hauteur: number;
  transparence: boolean;
  urlApercu: string;
  urlMiniature: string;
}

export interface FormatPage {
  id: string;
  libelle: string;
  largeur: number;
  hauteur: number;
}

export const FORMATS_PAGE: FormatPage[] = [
  { id: "carre", libelle: "Carré 1:1", largeur: 1080, hauteur: 1080 },
  { id: "portrait", libelle: "Portrait 4:5", largeur: 1080, hauteur: 1350 },
  { id: "story", libelle: "Story 9:16", largeur: 1080, hauteur: 1920 },
  { id: "paysage", libelle: "Paysage 16:9", largeur: 1920, hauteur: 1080 },
  // 210 x 297 mm à 300 points par pouce : 2480 x 3508 pixels.
  { id: "a4", libelle: "A4 portrait, 300 dpi", largeur: 2480, hauteur: 3508 },
];
