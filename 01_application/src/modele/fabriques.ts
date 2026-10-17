// Fabriques : les valeurs par défaut de chaque nouvel élément, au centre de la page.

import Konva from "konva";
import { POLICE_PAR_DEFAUT, pilePolice, variantesPossibles } from "../polices";
import { APPAREILS, casesDeGrille, DISPOSITIONS, RECADRAGE_PAR_DEFAUT } from "./cadres";
import { donneesDeDepart, GENRES_GRAPHIQUE, PALETTE_GRAPHIQUE } from "./graphiques";
import { mesurePolice } from "./mesure";
import { disposerTableau } from "./tableaux";
import { boiteDeDepart, type Boite } from "./personnages";
import { CAMERA_PAR_DEFAUT } from "./objet3d";
import { dispositionListe, estCourbe, garderCentre, geometrieCourbe, marqueListe, paragraphesListe, retraitListe, type GenreListe } from "./texteCourbe";
import {
  COULEUR_PAR_DEFAUT_FOND,
  VERSION_DOCUMENT,
  type DocumentEliot,
  type Appareil,
  type ElementCadre,
  type ElementEmoji,
  type ElementForme,
  type ElementGraphique,
  type ElementMaquette,
  type ElementTableau,
  type GenreGraphique,
  type FormeCadre,
  type ElementIcone,
  type ElementImage,
  type ElementObjet3d,
  type ElementVideo,
  type ElementQr,
  type ElementPersonnage,
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

type TexteMesure = Pick<ElementTexte, "texte" | "largeur" | "police" | "taillePolice" | "gras" | "italique" | "interligne" | "espacement"> & { majuscules?: boolean; liste?: GenreListe };

/** Un texte mesuré par Konva avec la même police que l'écran : `largeur` absente, sur une ligne. */
function mesurer(el: Omit<TexteMesure, "largeur" | "texte">, texte: string, largeur?: number): { largeur: number; hauteur: number } {
  const mesure = new Konva.Text({
    text: texte || " ",
    ...(largeur !== undefined ? { width: largeur } : {}),
    fontFamily: pilePolice(el.police),
    fontSize: el.taillePolice,
    fontStyle: styleTexte(el.gras, el.italique),
    lineHeight: el.interligne,
    letterSpacing: el.espacement,
  });
  const taille = { largeur: mesure.width(), hauteur: mesure.height() };
  mesure.destroy();
  return taille;
}

/** Le retrait d'une liste (étape 7, lot 2) : la place de sa marque la plus large. */
export function retraitDeListe(el: Omit<TexteMesure, "largeur">): number {
  const n = paragraphesListe(el.texte).length;
  const marque = el.liste === "numeros" ? marqueListe("numeros", n - 1).replace(/\d/g, "8") : marqueListe("puces", 0);
  return retraitListe(mesurer(el, marque).largeur, el.taillePolice);
}

/** Une liste, paragraphe par paragraphe : la marque, le texte, son haut ; et le retrait. */
export function disposerListe(el: TexteMesure): { retrait: number; items: { marque: string; texte: string; y: number; hauteur: number }[]; hauteur: number } {
  const retrait = retraitDeListe(el);
  const paragraphes = paragraphesListe(texteAffiche(el));
  const hauteurs = paragraphes.map((p) => mesurer(el, p, Math.max(20, el.largeur - retrait)).hauteur);
  const { hauts, hauteur } = dispositionListe(hauteurs);
  return { retrait, items: paragraphes.map((p, i) => ({ marque: marqueListe(el.liste ?? "puces", i), texte: p, y: hauts[i], hauteur: hauteurs[i] })), hauteur };
}

/** Hauteur réelle d'un texte, mesurée par Konva avec la même police que l'écran (une liste :
 *  ses paragraphes l'un sous l'autre, dans la largeur qu'il leur reste). */
export function mesurerHauteurTexte(el: TexteMesure): number {
  if (el.liste) return disposerListe(el).hauteur;
  return mesurer(el, texteAffiche(el), el.largeur).hauteur;
}

/** Le texte d'un texte courbé, sur une seule ligne. */
export const texteCourbe = (el: Pick<ElementTexte, "texte"> & { majuscules?: boolean }) => texteAffiche(el).replace(/\s*\n\s*/g, " ");

/** La géométrie d'un texte courbé (étape 7, lot 2), d'après sa ligne mesurée ; `null` s'il est
 *  droit. */
export function geometrieTexte(el: Omit<TexteMesure, "largeur"> & { courbe?: number }) {
  if (!estCourbe(el.courbe)) return null;
  return geometrieCourbe(longueurSurChemin(el), el.taillePolice, el.courbe);
}

/** La longueur d'arc qu'il faut à la ligne d'un texte courbé. Konva pose les lettres sur le
 *  chemin une à une, à leur largeur seule (sans le crénage de leurs voisines) : la ligne est un
 *  peu plus longue que mesurée d'un bloc, et une lettre qui dépasse le bout de l'arc n'est pas
 *  dessinée. D'où la mesure à sa façon, avec un peu de marge pour le tracé de l'arc. */
function longueurSurChemin(el: Omit<TexteMesure, "largeur">): number {
  const texte = texteCourbe(el) || " ";
  const mesure = new Konva.TextPath({ text: texte, data: "", fontFamily: pilePolice(el.police), fontSize: el.taillePolice, fontStyle: styleTexte(el.gras, el.italique), letterSpacing: el.espacement });
  const largeur = mesure.getTextWidth() + Math.max(0, [...texte].length - 1) * el.espacement;
  mesure.destroy();
  return largeur * 1.005 + 2;
}

/**
 * Un texte remis à sa taille après un changement (`avant` : tel qu'il était) : un texte courbé
 * prend la boîte de son arc, un texte qui se redresse reprend une ligne à sa largeur, et le centre
 * ne bouge pas ; un texte droit ou une liste remesure sa hauteur.
 */
export function recomposerTexte(avant: ElementTexte, apres: ElementTexte): ElementTexte {
  // Le centre gardé est celui de la boîte d'`apres` avant la nouvelle mesure : celle d'avant,
  // ou celle qu'un geste vient de donner.
  const geo = geometrieTexte(apres);
  if (geo) return { ...apres, ...garderCentre(apres, geo.largeur, geo.hauteur), largeur: geo.largeur, hauteur: geo.hauteur };
  if (estCourbe(avant.courbe)) {
    const largeur = Math.ceil(mesurer(apres, texteCourbe(apres)).largeur + apres.taillePolice * 0.2);
    const hauteur = mesurerHauteurTexte({ ...apres, largeur });
    return { ...apres, ...garderCentre(apres, largeur, hauteur), largeur, hauteur };
  }
  return { ...apres, hauteur: mesurerHauteurTexte(apres) };
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

/** Un personnage tout fait (`dessin`) ou composé (`posture`, `pieces`), à la taille de son
 *  cadrage (`vue`, donné par le catalogue), au centre de la page. */
export function creerPersonnage(page: Format, source: Pick<ElementPersonnage, "collection" | "dessin" | "posture" | "pieces" | "couleurs">, vue: Boite): ElementPersonnage {
  const b = boiteDeDepart(page, vue);
  const propre = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined)) as typeof source;
  return { ...elementCentre(page, b.largeur, b.hauteur), ...propre, type: "personnage" };
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

/** Un graphique avec des données de départ, à la taille qui convient à son genre. */
export function creerGraphique(page: Format, genre: GenreGraphique, couleurs: string[] = PALETTE_GRAPHIQUE): ElementGraphique {
  const cote = Math.min(page.largeur, page.hauteur);
  const echelle = Math.max(page.largeur, page.hauteur) / 1080;
  const [l, h] =
    genre === "progression" ? [cote * 0.42, cote * 0.42] : genre === "secteurs" || genre === "anneau" ? [cote * 0.56, cote * 0.66] : [Math.min(page.largeur * 0.78, cote * 0.9), cote * 0.56];
  return {
    ...elementCentre(page, Math.round(l), Math.round(h)),
    type: "graphique",
    genre,
    police: POLICE_PAR_DEFAUT,
    taillePolice: Math.round(24 * echelle),
    couleurTexte: "#1f1f1d",
    grille: true,
    ...donneesDeDepart(genre, couleurs),
  };
}

/** Un tableau : `cellules` donne ses rangées ; la hauteur suit le contenu. */
export function creerTableau(page: Format, cellules: string[][], options: Partial<ElementTableau> = {}): ElementTableau {
  const echelle = Math.max(page.largeur, page.hauteur) / 1080;
  const nbCol = Math.max(1, ...cellules.map((r) => r.length));
  const largeur = Math.round(Math.min(page.largeur * 0.8, 260 * echelle * nbCol));
  const base: ElementTableau = {
    ...elementCentre(page, largeur, 100),
    type: "tableau",
    cellules: cellules.map((r) => [...r, ...Array(nbCol - r.length).fill("")]),
    colonnes: Array(nbCol).fill(1),
    entete: true,
    police: POLICE_PAR_DEFAUT,
    taillePolice: Math.round(26 * echelle),
    couleurTexte: "#1f1f1d",
    fond: "#ffffff",
    fondEntete: "#1f1f1d",
    texteEntete: "#ffffff",
    rayures: "#f4f3ef",
    bordure: { couleur: "#d6d3cc", epaisseur: Math.max(1, Math.round(2 * echelle)) },
    alignement: "left",
    marge: Math.round(14 * echelle),
    ...options,
  };
  const hauteur = Math.round(disposerTableau({ ...base, hauteur: 0 }, mesurePolice(base.police)).hauteurNaturelle);
  return { ...base, hauteur, y: Math.round((page.hauteur - hauteur) / 2) };
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

/** Un objet 3D (étape 6) entre au centre, dans un carré de 60 % du petit côté de la page,
 *  vu de trois quarts. */
export function creerObjet3d(page: Format, ressource: Ressource): ElementObjet3d {
  const cote = Math.round(Math.min(page.largeur, page.hauteur) * 0.6);
  return {
    id: nouvelId(),
    type: "objet3d",
    ressource: ressource.id,
    x: Math.round((page.largeur - cote) / 2),
    y: Math.round((page.hauteur - cote) / 2),
    largeur: cote,
    hauteur: cote,
    rotation: 0,
    opacite: 1,
    visible: true,
    verrouille: false,
    nom: ressource.nom,
    camera: { ...CAMERA_PAR_DEFAUT },
  };
}

/** La vidéo entre comme une image : à 60 % de la page au plus, proportions gardées, au
 *  centre ; tout le fichier joue, à vitesse normale. */
export function creerVideo(page: Format, ressource: Ressource): ElementVideo {
  const image = creerImage(page, ressource);
  return { ...image, type: "video" };
}

/** L'élément qui montre une ressource importée : une photo, un clip ou un objet 3D. */
export function creerDepuisRessource(page: Format, ressource: Ressource): ElementImage | ElementVideo | ElementObjet3d {
  if (ressource.modele3d) return creerObjet3d(page, ressource);
  return ressource.video ? creerVideo(page, ressource) : creerImage(page, ressource);
}

/** Durée qui joue d'une vidéo, en millisecondes du fichier, vitesse comprise. */
export function dureeJouee(el: ElementVideo, dureeFichier: number): number {
  const debut = el.coupe?.debut ?? 0;
  const fin = Math.min(el.coupe?.fin ?? dureeFichier, dureeFichier);
  return Math.max(0, fin - debut) / (el.vitesse ?? 1);
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
  if (el.libelle?.trim()) return el.libelle.trim();
  // La photo du fond (étape 7, lot 4) se dit telle, avant le nom de son fichier.
  if (el.type === "cadre" && el.enFond) return "Photo du fond";
  if (el.nom && el.type !== "icone") return el.nom;
  switch (el.type) {
    case "texte":
      return el.texte.replace(/\s+/g, " ").slice(0, 28) || "Texte vide";
    case "image":
      return "Image";
    case "video":
      return "Vidéo";
    case "icone":
      return `Icône ${el.nom.replace(/-/g, " ")}`;
    case "emoji":
      return "Emoji";
    case "personnage":
      return el.dessin?.startsWith("decor-") ? "Décor" : "Personnage";
    case "qr":
      return "QR code";
    case "forme":
      return el.forme === "rectangle" && el.arrondi > 0 ? "Rectangle arrondi" : NOMS_FORMES[el.forme];
    case "cadre":
      return el.ressource ? "Cadre photo" : "Cadre vide";
    case "maquette":
      return APPAREILS[el.appareil].libelle;
    case "dessin":
      return el.outil === "surligneur" ? "Surlignage" : "Dessin";
    case "graphique":
      return `Graphique ${GENRES_GRAPHIQUE.find((g) => g.id === el.genre)?.libelle.toLowerCase() ?? ""}`.trim();
    case "tableau":
      return "Tableau";
    case "objet3d":
      return "Objet 3D";
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
