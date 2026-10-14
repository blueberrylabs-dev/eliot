// Le document : la seule vérité d'Eliot (BRIEF, règle 1). Konva ne fait que le dessiner.
// Version 2 (étape 2) : un nom, un format commun à toutes les pages, plusieurs pages. Le noyau
// convertit un document de version 1 à l'ouverture (noyau/src/projet.rs).
// Version 3 (étape 3) : icônes, emojis, QR code, lignes et flèches, ombres, effets de texte.
// Les nouveaux champs sont facultatifs : un document de version 2 reste valable tel quel.

export const VERSION_DOCUMENT = 3 as const;

export type Alignement = "left" | "center" | "right";

/** Un arrêt de dégradé : position de 0 à 1, couleur `#rrggbb`. */
export interface ArretDegrade {
  position: number;
  couleur: string;
}

export interface Degrade {
  type: "lineaire" | "radial";
  /** Linéaire seulement, en degrés : 0 de gauche à droite, 90 de haut en bas. */
  angle: number;
  arrets: ArretDegrade[];
}

/** Une couleur unie (`#rrggbb`) ou un dégradé. */
export type Couleur = string | Degrade;

/** Ombre portée, en pixels de la page. */
export interface Ombre {
  couleur: string;
  /** Rayon du flou. */
  flou: number;
  x: number;
  y: number;
  /** De 0 à 1. */
  opacite: number;
}

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
  /** Étiquette de groupe : les éléments qui la partagent se sélectionnent ensemble. */
  groupe?: string;
  ombre?: Ombre;
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
  couleur: Couleur;
  /** Multiple de la taille de police. */
  interligne: number;
  /** Espacement des lettres, en pixels de la page. */
  espacement: number;
  barre?: boolean;
  /** Affiché en capitales ; le texte saisi garde ses minuscules. */
  majuscules?: boolean;
  /** Contour des lettres. */
  contour?: { couleur: string; epaisseur: number };
  /** Bande de couleur derrière le texte, comme un surligneur. */
  surlignage?: { couleur: string; marge: number; arrondi: number };
}

export type GenreForme = "rectangle" | "ellipse" | "triangle" | "etoile" | "polygone" | "coeur" | "ligne" | "fleche";

export interface ElementForme extends ElementBase {
  type: "forme";
  forme: GenreForme;
  /** Remplissage ; pour une ligne ou une flèche, la couleur du trait. */
  remplissage: Couleur;
  contour: string;
  /** Épaisseur du contour ; pour une ligne ou une flèche, l'épaisseur du trait. */
  epaisseurContour: number;
  /** Rayon des coins (rectangle seulement). */
  arrondi: number;
  /** Polygone : nombre de côtés ; étoile : nombre de branches. */
  cotes?: number;
  /** Ligne ou flèche : trait en tirets. */
  tirets?: boolean;
  /** Flèche : pointe au début (gauche de la boîte) et à la fin (droite). */
  pointes?: { debut: boolean; fin: boolean };
}

/** Une icône de la bibliothèque, d'une seule couleur, dessinée en vecteurs. */
export interface ElementIcone extends ElementBase {
  type: "icone";
  /** Collection de la bibliothèque (`tabler`, `phosphor-regular`…). */
  collection: string;
  nom: string;
  couleur: string;
  /** Épaisseur du trait, pour les icônes au trait (Tabler). */
  trait?: number;
}

/** Un emoji de la bibliothèque, avec ses couleurs, dessiné en vecteurs. */
export interface ElementEmoji extends ElementBase {
  type: "emoji";
  collection: string;
  nom: string;
}

/** Un QR code : le contenu (adresse, texte) et ses couleurs ; les carrés sont recalculés. */
export interface ElementQr extends ElementBase {
  type: "qr";
  contenu: string;
  couleur: string;
  /** `null` : fond transparent. */
  fond: string | null;
  /** Niveau de correction d'erreur : plus il est haut, plus le code résiste aux taches. */
  correction: "L" | "M" | "Q" | "H";
}

export interface ElementImage extends ElementBase {
  type: "image";
  /** Empreinte SHA-256 du fichier d'origine : l'image entre par référence (règle 6). */
  ressource: string;
  retourneH: boolean;
  retourneV: boolean;
}

export type ElementPage = ElementTexte | ElementForme | ElementImage | ElementIcone | ElementEmoji | ElementQr;

export interface PageEliot {
  id: string;
  fond: Couleur;
  /** L'ordre du tableau est l'ordre d'empilement : le dernier est au-dessus. */
  elements: ElementPage[];
}

/** Taille commune à toutes les pages d'un design, en pixels. */
export interface Format {
  largeur: number;
  hauteur: number;
}

export interface DocumentEliot {
  version: typeof VERSION_DOCUMENT;
  nom: string;
  format: Format;
  pages: PageEliot[];
}

/** Une image importée, telle que l'interface la connaît : jamais l'original. L'aperçu et la
 *  miniature se demandent au pont, qui les garde en mémoire (`pont/tauri.ts`). */
export interface Ressource {
  id: string;
  nom: string;
  largeur: number;
  hauteur: number;
  transparence: boolean;
}

/** Où vit un design : son rayon (`designs` ou `modeles`) et son dossier. */
export interface RefProjet {
  rayon: "designs" | "modeles";
  id: string;
}

/** Ce que l'accueil affiche d'un design. */
export interface InfoProjet {
  id: string;
  nom: string;
  largeur: number;
  hauteur: number;
  pages: number;
  /** Millisecondes depuis 1970. */
  modifie: number;
  miniature: boolean;
}

export interface FormatPage {
  id: string;
  libelle: string;
  /** Où il sert, en quelques mots, pour l'accueil. */
  usage: string;
  largeur: number;
  hauteur: number;
}

export const FORMATS_PAGE: FormatPage[] = [
  { id: "carre", libelle: "Carré 1:1", usage: "Post Instagram, Facebook", largeur: 1080, hauteur: 1080 },
  { id: "portrait", libelle: "Portrait 4:5", usage: "Post et carrousel Instagram", largeur: 1080, hauteur: 1350 },
  { id: "story", libelle: "Story 9:16", usage: "Story, Reel, TikTok, Short", largeur: 1080, hauteur: 1920 },
  { id: "paysage", libelle: "Paysage 16:9", usage: "Vidéo YouTube, présentation", largeur: 1920, hauteur: 1080 },
  { id: "miniature", libelle: "Miniature vidéo", usage: "Miniature YouTube", largeur: 1280, hauteur: 720 },
  { id: "banniere", libelle: "Bannière", usage: "Bannière de site, en-tête", largeur: 1500, hauteur: 500 },
  // 210 x 297 mm à 300 points par pouce : 2480 x 3508 pixels.
  { id: "a4", libelle: "A4 portrait, 300 dpi", usage: "Affiche, flyer imprimé", largeur: 2480, hauteur: 3508 },
  { id: "a5", libelle: "A5 portrait, 300 dpi", usage: "Flyer, carte", largeur: 1748, hauteur: 2480 },
];

export const COULEUR_PAR_DEFAUT_FOND = "#ffffff";

/** Une couleur unie représentative (pour un aperçu, une pastille, un contraste). */
export function couleurPrincipale(c: Couleur): string {
  return typeof c === "string" ? c : (c.arrets[0]?.couleur ?? "#000000");
}
