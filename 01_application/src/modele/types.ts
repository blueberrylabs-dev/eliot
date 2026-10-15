// Le document : la seule vérité d'Eliot (BRIEF, règle 1). Konva ne fait que le dessiner.
// Version 2 (étape 2) : un nom, un format commun à toutes les pages, plusieurs pages. Le noyau
// convertit un document de version 1 à l'ouverture (noyau/src/projet.rs).
// Version 3 (étape 3) : icônes, emojis, QR code, lignes et flèches, ombres, effets de texte,
// cadres photo, maquettes d'appareils, dessin à main levée, graphiques, tableaux, personnages.
// Les nouveaux champs sont facultatifs : un document de version 2 reste valable tel quel.
// Version 4 (étape 4) : la vidéo. Une page qui a une `duree` est une vidéo ; ses éléments
// portent `temps` et `piste`, ses sons vont dans `audio`. Un élément `video` peut aussi vivre
// dans une page fixe (post animé). Tout est facultatif : un document de version 3 ne change
// que de numéro (noyau/src/projet.rs). Lot 3 : animations, images clés, transitions et fondus
// du son, tous facultatifs eux aussi (même version 4).

export const VERSION_DOCUMENT = 4 as const;

/** Un intervalle de temps, en millisecondes entières. */
export interface Temps {
  debut: number;
  fin: number;
}

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

/** Une animation d'entrée, de sortie ou en boucle (étape 4, lot 3) : son nom (catalogue dans
 *  `modele/animation.ts`) et sa durée en ms ; pour une boucle, la durée d'un tour. */
export interface Animation {
  nom: string;
  duree: number;
}

export interface Animations {
  entree?: Animation;
  sortie?: Animation;
  boucle?: Animation;
}

/**
 * Une image clé : la pose de l'élément à `t` ms du début de son clip. `x` et `y` vont ensemble
 * (le coin haut gauche, comme ceux de l'élément), `echelle` agrandit autour de ce coin comme
 * Konva ; entre deux clés, le centre de l'élément glisse en ligne droite. Un champ absent
 * reprend les autres clés, ou l'élément lui-même.
 */
export interface CleAnimation {
  t: number;
  x?: number;
  y?: number;
  echelle?: number;
  rotation?: number;
  opacite?: number;
  /** Le passage vers la clé suivante : « douce » (par défaut) ou « lineaire ». */
  courbe?: "douce" | "lineaire";
}

/** Une transition vers ce clip depuis le précédent de la piste principale : les deux clips se
 *  chevauchent pendant `duree` ms. */
export interface Transition {
  nom: string;
  duree: number;
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
  /** Page vidéo : quand l'élément est visible, en millisecondes depuis le début de la page. */
  temps?: Temps;
  /** Page vidéo : 0 pour la piste principale, plus pour celles du dessus. */
  piste?: number;
  /** Page vidéo : animations d'entrée, de sortie, en boucle. */
  animations?: Animations;
  /** Page vidéo : images clés, triées par `t`. */
  cles?: CleAnimation[];
  /** Page vidéo, piste principale : transition depuis le clip précédent. */
  transition?: Transition;
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

/**
 * Un personnage de la bibliothèque (Open Peeps, Humaaans), dessiné en vecteurs. Tout fait
 * (`dessin`), ou assemblé dans le composeur : une posture et une pièce par emplacement
 * (`pieces` : tête, visage, tenue…).
 */
export interface ElementPersonnage extends ElementBase {
  type: "personnage";
  /** `open-peeps` ou `humaaans`. */
  collection: string;
  /** Personnage tout fait : son nom dans la collection (`buste-12`, `debout-3`). */
  dessin?: string;
  /** Personnage composé : `buste`, `debout` ou `assis`. */
  posture?: string;
  /** Personnage composé : emplacement → pièce (`{ tete: "afro", visage: "smile" }`). */
  pieces?: Record<string, string>;
  /** Couleurs changées : par partie (`trait`, `tete`, `corps`…, Open Peeps) ou par couleur
   *  d'origine (`#B28B67`) ; la valeur est la nouvelle couleur `#rrggbb`. */
  couleurs?: Record<string, string>;
  retourneH?: boolean;
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
  /** Rayon des coins arrondis, en pixels de la page. */
  arrondi?: number;
  /** Bordure autour de la photo. */
  bordure?: { couleur: string; epaisseur: number };
}

/**
 * Une vidéo importée. À l'écran, la fenêtre joue sa copie d'aperçu, jamais l'original
 * (règle 5) ; figée (vignette, export en image), elle montre sa couverture.
 */
export interface ElementVideo extends ElementBase {
  type: "video";
  /** Empreinte SHA-256 du fichier d'origine, comme une image. */
  ressource: string;
  retourneH: boolean;
  retourneV: boolean;
  arrondi?: number;
  bordure?: { couleur: string; epaisseur: number };
  /** La partie du fichier qui joue, en millisecondes du fichier : de `debut` à `fin` (la fin
   *  du fichier si `fin` manque). Absente : tout le fichier. */
  coupe?: { debut: number; fin?: number };
  /** 1 : vitesse normale ; de 0,25 à 4. */
  vitesse?: number;
  /** De 0 (muet) à 1 ; 1 si absent. */
  volume?: number;
  /** Page vidéo : le son monte pendant ces ms au début du clip, et baisse pendant celles-ci à
   *  la fin. */
  fonduEntree?: number;
  fonduSortie?: number;
}

/**
 * Cadrage d'une photo dans un cadre ou un écran : elle couvre toujours toute la zone (comme
 * `object-fit: cover`), agrandie de `zoom` (1 au moins) ; `x` et `y`, de 0 à 1, disent quelle
 * partie de la photo se voit (0,5 : le centre ; 0 : le bord gauche ou haut).
 */
export interface Recadrage {
  zoom: number;
  x: number;
  y: number;
}

export type FormeCadre = "rectangle" | "arrondi" | "cercle" | "arche" | "etoile" | "coeur" | "hexagone" | "goutte";

/** Un cadre : une forme qui découpe une photo. Vide, il attend qu'on y glisse une image. */
export interface ElementCadre extends ElementBase {
  type: "cadre";
  forme: FormeCadre;
  /** La photo du cadre (ressource du design), absente tant qu'il est vide. */
  ressource?: string;
  recadrage: Recadrage;
  /** Couleur montrée tant que le cadre est vide. */
  fond: string;
  bordure?: { couleur: string; epaisseur: number };
}

export type Appareil = "telephone" | "tablette" | "ordinateur" | "montre";

/** Une maquette d'appareil : le dessin du téléphone (ou autre) et une capture dans son écran. */
export interface ElementMaquette extends ElementBase {
  type: "maquette";
  appareil: Appareil;
  /** Couleur du boîtier. */
  couleur: string;
  ressource?: string;
  recadrage: Recadrage;
}

export type OutilDessin = "stylo" | "marqueur" | "surligneur";

/** Un trait de dessin à main levée. Les points (x, y à la suite) se rapportent à la boîte
 *  qu'avait le trait quand il a été tracé (`vue`) : agrandir l'élément agrandit le trait. */
export interface ElementDessin extends ElementBase {
  type: "dessin";
  outil: OutilDessin;
  couleur: string;
  /** Épaisseur du trait à la taille d'origine, en pixels de la page. */
  epaisseur: number;
  points: number[];
  vue: { largeur: number; hauteur: number };
}

export type GenreGraphique = "colonnes" | "barres" | "lignes" | "aires" | "secteurs" | "anneau" | "progression";

export interface SerieGraphique {
  nom: string;
  couleur: string;
  /** Une valeur par étiquette ; `null` : pas de valeur. */
  valeurs: (number | null)[];
}

/** Un graphique : ses données et sa présentation. Le dessin est recalculé à chaque rendu. */
export interface ElementGraphique extends ElementBase {
  type: "graphique";
  genre: GenreGraphique;
  /** Les catégories (axe horizontal, ou parts d'un secteur). */
  etiquettes: string[];
  series: SerieGraphique[];
  /** Secteurs et anneau : une couleur par part (sinon la palette). */
  couleursParts?: string[];
  police: string;
  taillePolice: number;
  couleurTexte: string;
  legende: boolean;
  /** Écrire les valeurs sur le graphique. */
  valeurs: boolean;
  /** Lignes de repère horizontales. */
  grille: boolean;
  /** Ajouté après chaque valeur : « % », « € »… */
  unite?: string;
  /** Progression : la valeur pleine (100 par défaut). */
  maximum?: number;
}

/** Un tableau de texte : des lignes de cellules, la première pouvant servir d'en-tête. */
export interface ElementTableau extends ElementBase {
  type: "tableau";
  /** Lignes de cellules, toutes de même longueur. */
  cellules: string[][];
  /** Largeur relative de chaque colonne. */
  colonnes: number[];
  entete: boolean;
  police: string;
  taillePolice: number;
  couleurTexte: string;
  fond: string;
  fondEntete: string;
  texteEntete: string;
  /** Fond d'une ligne sur deux, ou rien. */
  rayures?: string;
  bordure: { couleur: string; epaisseur: number };
  alignement: Alignement;
  /** Marge intérieure des cellules, en pixels de la page. */
  marge: number;
}

export type ElementPage = ElementTexte | ElementForme | ElementImage | ElementVideo | ElementIcone | ElementEmoji | ElementPersonnage | ElementQr | ElementCadre | ElementMaquette | ElementDessin | ElementGraphique | ElementTableau;

/** Les éléments qui reçoivent une photo glissée dessus. */
export type ElementAPhoto = ElementCadre | ElementMaquette;
export const recoitPhoto = (e: ElementPage): e is ElementAPhoto => e.type === "cadre" || e.type === "maquette";

/** Un son posé sur une page vidéo (musique, voix, bruitage). Rempli à partir du lot 5. */
export interface ClipAudio {
  id: string;
  ressource: string;
  temps: Temps;
  /** La partie du fichier qui joue, en millisecondes du fichier. */
  coupe?: { debut: number; fin?: number };
  volume?: number;
  fonduEntree?: number;
  fonduSortie?: number;
  role?: "musique" | "voix" | "bruitage";
}

export interface PageEliot {
  id: string;
  fond: Couleur;
  /** L'ordre du tableau est l'ordre d'empilement : le dernier est au-dessus. */
  elements: ElementPage[];
  /** Présente : la page est une vidéo de cette durée, en millisecondes. */
  duree?: number;
  audio?: ClipAudio[];
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

/** Ce que l'interface sait d'une vidéo importée. */
export interface InfosVideo {
  /** Millisecondes. */
  duree: number;
  imagesParSeconde: number;
  /** La vidéo a-t-elle du son ? */
  son: boolean;
  /** Format de la copie d'aperçu. */
  copie: "webm" | "mp4";
  /** La bande des vignettes de la frise : `nombre` images côte à côte, une toutes les
   *  `intervalle` ms. */
  vignettes: { nombre: number; intervalle: number; largeur: number; hauteur: number };
}

/** Une image ou une vidéo importée, telle que l'interface la connaît : jamais l'original.
 *  L'aperçu, la miniature et la copie d'une vidéo se demandent au pont, qui les garde en
 *  mémoire (`pont/tauri.ts`). */
export interface Ressource {
  id: string;
  nom: string;
  largeur: number;
  hauteur: number;
  transparence: boolean;
  /** D'où vient l'image quand elle n'est pas d'Alexandre (photo ou vidéo Pixabay). */
  credit?: Credit;
  /** Présent pour une vidéo ; l'aperçu et la miniature sont alors sa couverture. */
  video?: InfosVideo;
}

/** Le crédit d'une photo venue d'une banque d'images : rangé avec l'image dans le design. */
export interface Credit {
  source: string;
  auteur: string;
  /** La page de la photo sur le site d'origine. */
  lien: string;
}

/** Où vit un design : son rayon (`designs` ou `modeles`) et son dossier. */
export interface RefProjet {
  rayon: "designs" | "modeles";
  id: string;
}

/** Un dossier d'images : celui d'un design, ou celui des logos du kit de marque. */
export type RefRessources = RefProjet | { rayon: "marque"; id: "kit" };
export const REF_MARQUE: RefRessources = { rayon: "marque", id: "kit" };

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
