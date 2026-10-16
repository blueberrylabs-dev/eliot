// Le store : une seule porte d'écriture vers le document (BRIEF, règle 2). Chaque action qui
// modifie le document passe par `appliquer`, qui garde l'état précédent pour « annuler ».
// Les actions sur les éléments visent la page affichée (`pageActive`).

import { create } from "zustand";
import { documentVide, dupliquerPage, dupliquerTous, estTrait, hauteurTrait, mesurerHauteurTexte, nouvelId, nouvellePage } from "../modele/fabriques";
import { aligner, boiteDe, redimensionnerElements, repartir, type SensAlignement } from "../modele/geometrie";
import type { ReglagesDessin } from "../modele/dessin";
import { mesurePolice } from "../modele/mesure";
import { ajouterRangee, disposerTableau } from "../modele/tableaux";
import { recalerPersonnage } from "../modele/personnages";
import { catalogueConnu } from "../bibliotheque/personnages";
import { recoitPhoto, type ClipAudio, type Couleur, type DocumentEliot, type ElementPage, type ElementTableau, type ElementTexte, type Format, type NettoyageVoix, type PageEliot, type RefProjet, type Ressource, type RoleSon } from "../modele/types";
import { deplacerClip, deplacerSon, dupliquerDansLeTemps, dupliquerSon, dureeClip, estPageVideo, normaliser, PISTE_PRINCIPALE, placer, placerSon, rogner, rognerSon, scinder, scinderSons, supprimerSons, versFixe, versVideo, visibleA, type Durees } from "../modele/frise";
import { FONDU_FIN_MUSIQUE } from "../modele/son";
import { borneNettoyage, nettoyageActif } from "../modele/voix";
import { cleProche, deplacerCle, DUREE_TRANSITION, poseA, poserCle, retirerCle, type GenreAnimation, type Pose } from "../modele/animation";
import type { Animation, Transition } from "../modele/types";
import { useTemps } from "./temps";

const LIMITE_HISTORIQUE = 100;
/** Deux modifications de même nature à moins de 700 ms forment une seule étape à annuler
 *  (glisser une couleur, appuyer plusieurs fois sur une flèche). */
const FENETRE_FUSION_MS = 700;
/** Les étiquettes d'un geste (un curseur tiré, un coin glissé) portent cette marque et un
 *  numéro propre au geste : ses étapes forment une seule étape à annuler, même quand le geste
 *  marque une pause de plus de 700 ms (une main qui hésite, une machine lente). */
const MARQUE_GESTE = "#geste";
let gestes = 0;
export function etiquetteDeGeste(base: string): string {
  gestes += 1;
  return `${base}${MARQUE_GESTE}${gestes}`;
}

export interface Notification {
  numero: number;
  texte: string;
  erreur?: boolean;
  chemin?: string;
}

export type SensPile = "premier" | "avant" | "arriere" | "dernier";
export type EtatEnregistrement = "enregistre" | "en-attente" | "en-cours" | "erreur";

/** Un état du document gardé pour « annuler », avec la page où l'on travaillait. */
interface Instantane {
  document: DocumentEliot;
  page: string;
}

/** Propriétés recopiées par « Copier le style », selon le type de l'objet source. */
const STYLE_PAR_TYPE: Record<ElementPage["type"], string[]> = {
  texte: ["police", "taillePolice", "gras", "italique", "souligne", "barre", "majuscules", "alignement", "couleur", "interligne", "espacement", "contour", "surlignage", "opacite", "ombre", "animations"],
  forme: ["remplissage", "contour", "epaisseurContour", "arrondi", "tirets", "opacite", "ombre", "animations"],
  // La retouche du labo (étape 5) passe d'une photo ou d'un clip à l'autre.
  image: ["arrondi", "bordure", "opacite", "ombre", "animations", "reglages"],
  video: ["arrondi", "bordure", "opacite", "ombre", "animations", "reglages"],
  icone: ["couleur", "trait", "opacite", "ombre", "animations"],
  emoji: ["opacite", "ombre", "animations"],
  personnage: ["couleurs", "opacite", "ombre", "animations"],
  qr: ["couleur", "fond", "opacite", "animations"],
  cadre: ["forme", "bordure", "opacite", "ombre", "animations"],
  maquette: ["couleur", "opacite", "ombre", "animations"],
  dessin: ["couleur", "epaisseur", "opacite", "ombre", "animations"],
  graphique: ["police", "taillePolice", "couleurTexte", "legende", "valeurs", "grille", "opacite", "ombre", "animations"],
  tableau: ["police", "taillePolice", "couleurTexte", "fond", "fondEntete", "texteEntete", "rayures", "bordure", "alignement", "marge", "opacite", "ombre", "animations"],
};

export interface StyleCopie {
  type: ElementPage["type"];
  valeurs: Record<string, unknown>;
}

interface EtatEditeur {
  vue: "accueil" | "editeur";
  projet: RefProjet | null;
  document: DocumentEliot;
  pageActive: string;
  ressources: Record<string, Ressource>;
  ordreRessources: string[];
  selection: string[];
  /** Les sons choisis dans la frise (lot 5), à part des éléments : choisir l'un vide l'autre. */
  selectionAudio: string[];
  enEdition: string | null;
  /** Cadre ou maquette dont on déplace la photo à l'intérieur (double-clic). */
  enAjustement: string | null;
  passe: Instantane[];
  futur: Instantane[];
  derniereEtiquette: string | null;
  dernierInstant: number;
  pressePapiers: { projet: RefProjet | null; elements: ElementPage[] };
  styleCopie: StyleCopie | null;
  notification: Notification | null;
  enregistrement: EtatEnregistrement;
  /** `null` : la page s'ajuste à la zone. Sinon, pixels d'écran par pixel de page. */
  zoom: number | null;
  /** L'échelle qui fait tenir la page dans la zone (écrite par la zone de travail). */
  zoomAjuste: number;
  vueGrille: boolean;
  apercu: boolean;
  /** Dernier outil appelé par une IA (pont MCP), pour le signal « l'IA travaille ». */
  iaDernierAppel: { outil: string; quand: number } | null;
  reglagesOuverts: boolean;
  /** Mode dessin (onglet Dessin) : l'outil et ses réglages ; `null` : on sélectionne. */
  dessin: ReglagesDessin | null;
  /** Cellule de tableau en cours d'écriture. */
  celluleEnEdition: { id: string; ligne: number; colonne: number } | null;

  chargerProjet: (projet: RefProjet | null, document: DocumentEliot, ressources: Ressource[]) => void;
  allerALAccueil: () => void;
  definirProjet: (projet: RefProjet) => void;
  definirNom: (nom: string) => void;
  definirEnregistrement: (etat: EtatEnregistrement) => void;

  appliquer: (recette: (d: DocumentEliot) => DocumentEliot, etiquette?: string) => void;
  appliquerPage: (recette: (p: PageEliot) => PageEliot, etiquette?: string) => void;
  annuler: () => void;
  retablir: () => void;

  /** Ajoute des éléments à la page affichée. Sur une page vidéo, une vidéo neuve de la piste
   *  principale remplit la page, sauf `garderBoite` (position et taille voulues). */
  ajouterElements: (elements: ElementPage[], options?: { garderBoite?: boolean }) => void;
  modifierElements: (modifs: Record<string, Partial<ElementPage>>, etiquette?: string) => void;
  supprimerSelection: () => void;
  dupliquerSelection: () => void;
  copierSelection: () => void;
  coller: () => void;
  deplacerDansPile: (sens: SensPile) => void;
  deplacerSelection: (dx: number, dy: number) => void;
  basculerVerrou: () => void;
  basculerVisibilite: (id: string) => void;
  grouperSelection: () => void;
  degrouperSelection: () => void;
  alignerSelection: (sens: SensAlignement) => void;
  repartirSelection: (axe: "horizontal" | "vertical") => void;
  copierStyle: () => void;
  appliquerStyle: (id: string) => void;
  oublierStyle: () => void;

  modifierFond: (fond: Couleur, etiquette?: string) => void;
  modifierFormat: (format: Format, adapter: boolean) => void;
  ajouterPage: () => void;
  dupliquerPageActive: () => void;
  supprimerPage: (id: string) => void;
  deplacerPage: (id: string, rang: number) => void;
  allerALaPage: (id: string) => void;

  selectionner: (ids: string[], ajout?: boolean) => void;
  selectionnerSeul: (id: string) => void;
  basculerDansSelection: (id: string) => void;
  toutSelectionner: () => void;
  deselectionner: () => void;

  commencerEdition: (id: string) => void;
  terminerEdition: (texte: string | null) => void;
  commencerAjustement: (id: string) => void;
  definirDessin: (reglages: ReglagesDessin | null) => void;
  commencerCellule: (id: string, ligne: number, colonne: number) => void;
  /** Valide la cellule (`null` : abandon) ; `aller` passe à la cellule voisine (Tab ajoute une
   *  rangée après la dernière cellule). */
  terminerCellule: (texte: string | null, aller?: "suivante" | "precedente") => void;
  terminerAjustement: () => void;
  /** Met une photo du design dans un cadre ou un écran de maquette (cadrage remis au centre). */
  remplirPhoto: (id: string, ressource: string) => void;
  retirerPhoto: (id: string) => void;

  ajouterRessources: (ressources: Ressource[]) => void;

  // ---- Frise d'une page vidéo (étape 4) ----
  /** Fait de la page affichée une vidéo (frise ouverte) ou une image fixe. */
  basculerPageVideo: (video: boolean) => void;
  /** Glisse un clip : nouveau début (ms) et piste voulue. */
  deplacerClip: (id: string, debut: number, piste: number) => void;
  /** Tire le bord d'un clip jusqu'à l'instant `t`. */
  rognerClip: (id: string, cote: "debut" | "fin", t: number) => void;
  /** Coupe à la tête de lecture les clips choisis (sinon celui de la piste principale). */
  scinderALaTete: () => void;
  /** Les animations d'entrée, de sortie ou en boucle des éléments ; `null` en retire une. */
  definirAnimations: (ids: string[], genre: GenreAnimation, animation: Animation | null) => void;
  /** Change la pose des éléments à la tête de lecture : une image clé quand l'élément en a
   *  (posée ou reprise à cet instant), sinon l'élément lui-même. */
  modifierPose: (modifs: Record<string, Partial<Pose>>, etiquette?: string) => void;
  /** Pose une image clé à la tête de lecture, ou retire celle qui y est déjà. */
  basculerCle: (id: string) => void;
  /** Déplace une image clé (ms depuis le début du clip). */
  deplacerCle: (id: string, de: number, vers: number) => void;
  /** Retire toutes les images clés d'un élément. */
  effacerCles: (id: string) => void;
  /** La transition par laquelle un clip de la piste principale entre ; `null` la retire. */
  definirTransition: (id: string, transition: Transition | null) => void;

  // ---- Sons d'une page vidéo (étape 4, lot 5) ----
  /** Pose un son du design à la tête de lecture (ou à `debut`), sur la piste audio qui
   *  convient ; une page fixe devient une vidéo. Une musique va jusqu'au bout de la page, avec
   *  un fondu de fin. Un jingle se pose au début ou à la fin. Une prise au micro ou une voix de
   *  synthèse (lot 6) se pose au rôle voix ; `coupe` et `nettoyage` la posent déjà coupée et
   *  nettoyée. Renvoie l'identifiant du clip. */
  ajouterSon: (ressource: Ressource, options?: { role?: RoleSon; debut?: number; piste?: number; jingle?: "ouverture" | "fin"; coupe?: { debut: number; fin?: number }; nettoyage?: NettoyageVoix }) => string | null;
  deplacerSon: (id: string, debut: number, piste: number) => void;
  rognerSon: (id: string, cote: "debut" | "fin", t: number) => void;
  modifierSons: (modifs: Record<string, Partial<ClipAudio>>, etiquette?: string) => void;
  selectionnerSons: (ids: string[], ajout?: boolean) => void;
  /** Détache le son d'une vidéo (vitesse normale) : un clip de voix sur une piste audio, à la
   *  même place, et la vidéo devient muette. Renvoie l'identifiant du clip. */
  detacherSon: (id: string) => string | null;
  notifier: (texte: string, options?: { erreur?: boolean; chemin?: string }) => void;
  fermerNotification: () => void;
  definirZoom: (zoom: number | null) => void;
  definirZoomAjuste: (zoom: number) => void;
  basculerVueGrille: () => void;
  basculerApercu: (actif?: boolean) => void;
  signalerIa: (outil: string) => void;
}

// ---- Lecture ----

/** La page affichée (la première si l'identifiant ne correspond plus à rien). */
export function pageDe(document: DocumentEliot, id: string): PageEliot {
  return document.pages.find((p) => p.id === id) ?? document.pages[0];
}

export const pageCourante = (etat: Pick<EtatEditeur, "document" | "pageActive">) => pageDe(etat.document, etat.pageActive);
export const elementsCourants = (etat: Pick<EtatEditeur, "document" | "pageActive">) => pageCourante(etat).elements;

/** L'élément a-t-il des images clés, et la tête de lecture est-elle sur son clip ? Ses gestes
 *  posent alors des clés au lieu de le changer lui-même. */
export const clesActives = (e: ElementPage, tete = useTemps.getState().tete): boolean => !!e.cles?.length && !!e.temps && visibleA(e, tete);

/** Les éléments sélectionnés, dans l'ordre d'empilement. */
export const elementsSelectionnes = (etat: Pick<EtatEditeur, "document" | "pageActive" | "selection">) =>
  elementsCourants(etat).filter((e) => etat.selection.includes(e.id));

const parId = (elements: ElementPage[]) => new Map(elements.map((e) => [e.id, e]));

/** Ajoute aux identifiants les autres membres de leurs groupes. */
function avecGroupes(ids: string[], elements: ElementPage[]): string[] {
  const groupes = new Set(elements.filter((e) => ids.includes(e.id) && e.groupe).map((e) => e.groupe));
  if (groupes.size === 0) return ids;
  return [...new Set([...ids, ...elements.filter((e) => e.groupe && groupes.has(e.groupe)).map((e) => e.id)])];
}

/** Les éléments regroupés en blocs : un bloc par groupe, un bloc par élément seul. */
function blocs(elements: ElementPage[]): ElementPage[][] {
  const parGroupe = new Map<string, ElementPage[]>();
  const seuls: ElementPage[][] = [];
  for (const e of elements) {
    if (!e.groupe) seuls.push([e]);
    else parGroupe.set(e.groupe, [...(parGroupe.get(e.groupe) ?? []), e]);
  }
  return [...seuls, ...parGroupe.values()];
}

const avecPage = (d: DocumentEliot, id: string, recette: (p: PageEliot) => PageEliot): DocumentEliot => {
  let change = false;
  const pages = d.pages.map((p) => {
    if (p.id !== id) return p;
    const suivante = recette(p);
    if (suivante !== p) change = true;
    return suivante;
  });
  return change ? { ...d, pages } : d;
};

/** La durée des fichiers vidéo et des sons du design, d'après les ressources connues. */
export const dureesDe = (ressources: Record<string, Ressource>): Durees => (id) => ressources[id]?.video?.duree ?? ressources[id]?.son?.duree;

/** Remet d'aplomb les pages vidéo qu'une modification a touchées (voir `modele/frise.ts`). */
function normaliserPages(suivant: DocumentEliot, avant: DocumentEliot, durees: Durees): DocumentEliot {
  let change = false;
  const pages = suivant.pages.map((p) => {
    if (!estPageVideo(p) || avant.pages.includes(p)) return p;
    const n = normaliser(p, durees);
    if (n !== p) change = true;
    return n;
  });
  return change ? { ...suivant, pages } : suivant;
}

/** Un élément agrandi ou réduit pour tenir en entier dans la page, centré. */
function ajusterALaPage(e: ElementPage, format: Format): ElementPage {
  const echelle = Math.min(format.largeur / e.largeur, format.hauteur / e.hauteur);
  const largeur = Math.round(e.largeur * echelle * 100) / 100;
  const hauteur = Math.round(e.hauteur * echelle * 100) / 100;
  return { ...e, largeur, hauteur, x: Math.round(((format.largeur - largeur) / 2) * 100) / 100, y: Math.round(((format.hauteur - hauteur) / 2) * 100) / 100, rotation: 0 } as ElementPage;
}

/** Sans temps ni piste : des copies qui viennent d'ailleurs se posent à la tête de lecture. */
const sansTemps = (e: ElementPage): ElementPage => {
  const { temps: _t, piste: _p, ...reste } = e;
  return reste as ElementPage;
};

const NOUVEAU = documentVide();

export const useEditeur = create<EtatEditeur>()((set, get) => ({
  vue: "accueil",
  projet: null,
  document: NOUVEAU,
  pageActive: NOUVEAU.pages[0].id,
  ressources: {},
  ordreRessources: [],
  selection: [],
  selectionAudio: [],
  enEdition: null,
  enAjustement: null,
  passe: [],
  futur: [],
  derniereEtiquette: null,
  dernierInstant: 0,
  pressePapiers: { projet: null, elements: [] },
  styleCopie: null,
  notification: null,
  enregistrement: "enregistre",
  zoom: null,
  zoomAjuste: 0.5,
  vueGrille: false,
  apercu: false,
  iaDernierAppel: null,
  reglagesOuverts: false,
  dessin: null,
  celluleEnEdition: null,

  chargerProjet(projet, document, ressources) {
    useTemps.getState().remettre();
    set({
      vue: "editeur",
      projet,
      document,
      pageActive: document.pages[0].id,
      ressources: Object.fromEntries(ressources.map((r) => [r.id, r])),
      ordreRessources: ressources.map((r) => r.id),
      selection: [],
      selectionAudio: [],
      enEdition: null,
      enAjustement: null,
      celluleEnEdition: null,
      passe: [],
      futur: [],
      derniereEtiquette: null,
      enregistrement: "enregistre",
      zoom: null,
      vueGrille: false,
      apercu: false,
      styleCopie: null,
    });
  },

  allerALAccueil() {
    set({ vue: "accueil", selection: [], selectionAudio: [], enEdition: null, enAjustement: null, celluleEnEdition: null, dessin: null, apercu: false, vueGrille: false, styleCopie: null });
  },

  definirProjet(projet) {
    set({ projet });
  },

  definirNom(nom) {
    // Le nom vit hors de l'historique : annuler ne doit pas défaire un renommage.
    const renommer = (d: DocumentEliot) => ({ ...d, nom });
    const { document, passe, futur } = get();
    set({
      document: renommer(document),
      passe: passe.map((i) => ({ ...i, document: renommer(i.document) })),
      futur: futur.map((i) => ({ ...i, document: renommer(i.document) })),
    });
  },

  definirEnregistrement(enregistrement) {
    if (get().enregistrement !== enregistrement) set({ enregistrement });
  },

  appliquer(recette, etiquette) {
    const { document, passe, derniereEtiquette, dernierInstant, pageActive } = get();
    let suivant = recette(document);
    if (suivant === document) return;
    suivant = normaliserPages(suivant, document, dureesDe(get().ressources));
    const maintenant = Date.now();
    const fusion = etiquette !== undefined && etiquette === derniereEtiquette && (etiquette.includes(MARQUE_GESTE) || maintenant - dernierInstant < FENETRE_FUSION_MS);
    const page = pageDe(suivant, pageActive);
    const ids = new Set(page.elements.map((e) => e.id));
    const sons = new Set((page.audio ?? []).map((c) => c.id));
    set({
      document: suivant,
      pageActive: page.id,
      passe: fusion ? passe : [...passe, { document, page: pageActive }].slice(-LIMITE_HISTORIQUE),
      futur: [],
      derniereEtiquette: etiquette ?? null,
      dernierInstant: maintenant,
      selection: get().selection.filter((id) => ids.has(id)),
      selectionAudio: get().selectionAudio.filter((id) => sons.has(id)),
    });
  },

  appliquerPage(recette, etiquette) {
    const id = get().pageActive;
    get().appliquer((d) => avecPage(d, id, recette), etiquette);
  },

  annuler() {
    const { passe, futur, document, pageActive } = get();
    const precedent = passe[passe.length - 1];
    if (!precedent) return;
    const page = pageDe(precedent.document, precedent.page);
    const ids = new Set(page.elements.map((e) => e.id));
    const sons = new Set((page.audio ?? []).map((c) => c.id));
    set({
      document: precedent.document,
      pageActive: page.id,
      passe: passe.slice(0, -1),
      futur: [{ document, page: pageActive }, ...futur],
      selection: get().selection.filter((id) => ids.has(id)),
      selectionAudio: get().selectionAudio.filter((id) => sons.has(id)),
      enEdition: null,
      derniereEtiquette: null,
    });
  },

  retablir() {
    const { passe, futur, document, pageActive } = get();
    const suivant = futur[0];
    if (!suivant) return;
    const page = pageDe(suivant.document, suivant.page);
    const ids = new Set(page.elements.map((e) => e.id));
    const sons = new Set((page.audio ?? []).map((c) => c.id));
    set({
      document: suivant.document,
      pageActive: page.id,
      passe: [...passe, { document, page: pageActive }],
      futur: futur.slice(1),
      selection: get().selection.filter((id) => ids.has(id)),
      selectionAudio: get().selectionAudio.filter((id) => sons.has(id)),
      enEdition: null,
      derniereEtiquette: null,
    });
  },

  // ---- Éléments de la page affichée ----

  ajouterElements(elements, options = {}) {
    if (elements.length === 0) return;
    const durees = dureesDe(get().ressources);
    const page = pageCourante(get());
    // Une vidéo posée sur une page fixe en fait une page vidéo (la frise s'ouvre) ; sur une
    // page vidéo, les éléments neufs se posent à la tête de lecture.
    if (estPageVideo(page) || elements.some((e) => e.type === "video")) {
      const dureeVideos = Math.max(0, ...elements.map((e) => (e.type === "video" ? dureeClip(e, durees) : 0)));
      const tete = estPageVideo(page) ? useTemps.getState().tete : 0;
      const neufs = new Set(elements.filter((e) => !e.temps).map((e) => e.id));
      const format = get().document.format;
      get().appliquerPage((p) => {
        const placee = placer(estPageVideo(p) ? p : versVideo(p, durees, dureeVideos), elements, tete, durees);
        // Un média neuf de la piste principale remplit la page (en entier, sans rognure),
        // comme dans CapCut.
        const ajustes = placee.elements.map((e) => (!options.garderBoite && neufs.has(e.id) && e.piste === PISTE_PRINCIPALE ? ajusterALaPage(e, format) : e));
        return ajustes.some((e, i) => e !== placee.elements[i]) ? { ...placee, elements: ajustes } : placee;
      });
    } else get().appliquerPage((p) => ({ ...p, elements: [...p.elements, ...elements] }));
    set({ selection: elements.map((e) => e.id), selectionAudio: [] });
  },

  modifierElements(modifs, etiquette) {
    get().appliquerPage((p) => {
      let change = false;
      const elements = p.elements.map((e) => {
        const modif = modifs[e.id];
        if (!modif) return e;
        change = true;
        const suivant = { ...e, ...modif } as ElementPage;
        // Un texte dont la police, la taille ou la largeur change doit remesurer sa hauteur.
        if (suivant.type === "texte" && ("texte" in modif || "police" in modif || "taillePolice" in modif || "largeur" in modif || "gras" in modif || "italique" in modif || "interligne" in modif || "espacement" in modif || "majuscules" in modif) && !("hauteur" in modif)) {
          (suivant as ElementTexte).hauteur = mesurerHauteurTexte(suivant);
        }
        // Un tableau garde la hauteur qu'il faut à son contenu, plus ce qu'on lui avait ajouté
        // en l'étirant.
        if (suivant.type === "tableau" && e.type === "tableau") {
          const naturelle = (t: ElementTableau) => disposerTableau(t, mesurePolice(t.police)).hauteurNaturelle;
          const apres = naturelle(suivant);
          suivant.hauteur = "hauteur" in modif ? Math.max(suivant.hauteur, apres) : Math.round(apres + Math.max(0, e.hauteur - naturelle(e)));
        }
        // Un personnage composé dont une pièce change : sa boîte suit le dessin.
        if (suivant.type === "personnage" && e.type === "personnage" && ("pieces" in modif || "posture" in modif) && !("largeur" in modif)) {
          return recalerPersonnage(e, suivant, catalogueConnu()?.collections.find((c) => c.id === suivant.collection));
        }
        // Une ligne ou une flèche plus épaisse grandit autour de son axe.
        if (suivant.type === "forme" && estTrait(suivant.forme) && ("epaisseurContour" in modif || "forme" in modif) && !("hauteur" in modif)) {
          const hauteur = hauteurTrait(suivant.forme, suivant.epaisseurContour);
          suivant.y = e.y + (e.hauteur - hauteur) / 2;
          suivant.hauteur = hauteur;
        }
        return suivant;
      });
      return change ? { ...p, elements } : p;
    }, etiquette);
  },

  supprimerSelection() {
    const etat = get();
    if (etat.selectionAudio.length) {
      const ids = etat.selectionAudio;
      etat.appliquerPage((p) => supprimerSons(p, ids, dureesDe(get().ressources)));
      set({ selectionAudio: [] });
      return;
    }
    const elements = parId(elementsCourants(etat));
    const aSupprimer = new Set(etat.selection.filter((id) => !elements.get(id)?.verrouille));
    if (aSupprimer.size === 0) return;
    etat.appliquerPage((p) => ({ ...p, elements: p.elements.filter((e) => !aSupprimer.has(e.id)) }));
    set({ selection: etat.selection.filter((id) => !aSupprimer.has(id)) });
  },

  dupliquerSelection() {
    const sons = get().selectionAudio;
    if (sons.length) {
      const copies = sons.map(() => nouvelId("s"));
      get().appliquerPage((p) => sons.reduce((q, id, i) => dupliquerSon(q, id, copies[i], dureesDe(get().ressources)), p));
      set({ selectionAudio: copies.filter((id) => pageCourante(get()).audio?.some((c) => c.id === id)) });
      return;
    }
    const originaux = elementsSelectionnes(get());
    if (originaux.length === 0) return;
    if (!estPageVideo(pageCourante(get()))) {
      get().ajouterElements(dupliquerTous(originaux));
      return;
    }
    // Sur une page vidéo, la copie suit l'original dans le temps, à la même place ; la tête
    // va au début de la copie, pour qu'on la voie.
    const copies = dupliquerTous(originaux);
    get().appliquerPage((p) => dupliquerDansLeTemps(p, originaux, copies, dureesDe(get().ressources)));
    set({ selection: copies.map((e) => e.id) });
    const debuts = elementsCourants(get()).filter((e) => copies.some((c) => c.id === e.id) && e.temps).map((e) => e.temps!.debut);
    if (debuts.length) {
      useTemps.getState().pause();
      useTemps.getState().allerA(Math.min(...debuts));
    }
  },

  copierSelection() {
    const etat = get();
    const elements = elementsSelectionnes(etat);
    if (elements.length) set({ pressePapiers: { projet: etat.projet, elements } });
  },

  coller() {
    const copies = dupliquerTous(get().pressePapiers.elements, 32);
    get().ajouterElements(estPageVideo(pageCourante(get())) ? copies.map(sansTemps) : copies.map((e) => (e.temps || e.piste !== undefined ? sansTemps(e) : e)));
  },

  deplacerDansPile(sens) {
    const ids = new Set(get().selection);
    if (ids.size === 0) return;
    // Sur une page vidéo, l'empilement, ce sont les pistes : un clip de superposition monte ou
    // descend d'une piste (sur une piste neuve si la place est prise).
    if (estPageVideo(pageCourante(get()))) {
      get().appliquerPage((p) => {
        const max = Math.max(0, ...p.elements.map((e) => e.piste ?? 0));
        const libre = (e: ElementPage, piste: number) => !p.elements.some((x) => x.id !== e.id && x.piste === piste && x.temps && e.temps && x.temps.debut < e.temps.fin && e.temps.debut < x.temps.fin);
        const elements = p.elements.map((e) => {
          if (!ids.has(e.id) || e.piste === undefined || e.piste === PISTE_PRINCIPALE) return e;
          let piste = e.piste;
          if (sens === "premier") piste = max + 1;
          else if (sens === "dernier") piste = 0.5;
          else if (sens === "avant") piste = libre(e, e.piste + 1) ? e.piste + 1 : e.piste + 1.5;
          else piste = e.piste === 1 ? 0.5 : libre(e, e.piste - 1) ? e.piste - 1 : e.piste - 0.5;
          return piste === e.piste ? e : ({ ...e, piste } as ElementPage);
        });
        return elements.every((e, i) => e === p.elements[i]) ? p : { ...p, elements };
      });
      return;
    }
    get().appliquerPage((p) => {
      const choisis = p.elements.filter((e) => ids.has(e.id));
      const autres = p.elements.filter((e) => !ids.has(e.id));
      let elements: ElementPage[];
      if (sens === "premier") elements = [...autres, ...choisis];
      else if (sens === "dernier") elements = [...choisis, ...autres];
      else {
        elements = [...p.elements];
        const pas = sens === "avant" ? 1 : -1;
        const indices = elements.map((e, i) => (ids.has(e.id) ? i : -1)).filter((i) => i >= 0);
        const ordre = pas === 1 ? [...indices].reverse() : indices;
        for (const i of ordre) {
          const j = i + pas;
          if (j < 0 || j >= elements.length || ids.has(elements[j].id)) continue;
          [elements[i], elements[j]] = [elements[j], elements[i]];
        }
      }
      return elements.every((e, i) => e === p.elements[i]) ? p : { ...p, elements };
    });
  },

  deplacerSelection(dx, dy) {
    const tete = useTemps.getState().tete;
    const poses: Record<string, Partial<Pose>> = {};
    for (const e of elementsSelectionnes(get())) {
      if (e.verrouille) continue;
      // Un élément à images clés bouge depuis sa pose de l'instant.
      const p = clesActives(e, tete) ? poseA(e, tete - e.temps!.debut) : e;
      poses[e.id] = { x: p.x + dx, y: p.y + dy };
    }
    get().modifierPose(poses, "fleches");
  },

  basculerVerrou() {
    const choisis = elementsSelectionnes(get());
    const verrouiller = choisis.some((e) => !e.verrouille);
    get().modifierElements(Object.fromEntries(choisis.map((e) => [e.id, { verrouille: verrouiller }])));
  },

  basculerVisibilite(id) {
    const e = parId(elementsCourants(get())).get(id);
    if (e) get().modifierElements({ [id]: { visible: !e.visible } });
  },

  grouperSelection() {
    const choisis = elementsSelectionnes(get());
    if (choisis.length < 2) return;
    const groupe = nouvelId("g");
    get().modifierElements(Object.fromEntries(choisis.map((e) => [e.id, { groupe }])));
  },

  degrouperSelection() {
    // Dégrouper défait les groupes entiers des objets choisis, même si un seul est sélectionné.
    const groupes = new Set(elementsSelectionnes(get()).flatMap((e) => (e.groupe ? [e.groupe] : [])));
    if (groupes.size === 0) return;
    const membres = elementsCourants(get()).filter((e) => e.groupe && groupes.has(e.groupe));
    get().modifierElements(Object.fromEntries(membres.map((e) => [e.id, { groupe: undefined }])));
  },

  alignerSelection(sens) {
    const etat = get();
    const choisis = elementsSelectionnes(etat).filter((e) => !e.verrouille);
    if (choisis.length === 0) return;
    const groupes = blocs(choisis);
    // Un seul bloc s'aligne sur la page ; plusieurs s'alignent entre eux.
    const reference = groupes.length === 1 ? { x: 0, y: 0, largeur: etat.document.format.largeur, hauteur: etat.document.format.hauteur } : boiteDe(choisis);
    get().modifierElements(aligner(groupes, sens, reference));
  },

  repartirSelection(axe) {
    const choisis = elementsSelectionnes(get()).filter((e) => !e.verrouille);
    get().modifierElements(repartir(blocs(choisis), axe));
  },

  copierStyle() {
    const [source] = elementsSelectionnes(get());
    if (!source) return;
    const valeurs = Object.fromEntries(STYLE_PAR_TYPE[source.type].map((cle) => [cle, (source as unknown as Record<string, unknown>)[cle]]));
    set({ styleCopie: { type: source.type, valeurs } });
  },

  appliquerStyle(id) {
    const style = get().styleCopie;
    const cible = parId(elementsCourants(get())).get(id);
    if (!style || !cible || cible.verrouille) return;
    // Entre deux types différents, seule la transparence passe ; une photo et une vidéo
    // partagent leurs coins, leur bordure et leur ombre.
    const photoEtVideo = (t: string) => t === "image" || t === "video";
    const valeurs: Record<string, unknown> = cible.type === style.type || (photoEtVideo(cible.type) && photoEtVideo(style.type)) ? { ...style.valeurs } : { opacite: style.valeurs.opacite };
    get().modifierElements({ [id]: valeurs as Partial<ElementPage> });
    set({ styleCopie: null, selection: avecGroupes([id], elementsCourants(get())) });
  },

  oublierStyle() {
    if (get().styleCopie) set({ styleCopie: null });
  },

  // ---- Pages ----

  modifierFond(fond, etiquette) {
    get().appliquerPage((p) => ({ ...p, fond }), etiquette);
  },

  modifierFormat(format, adapter) {
    get().appliquer((d) => {
      if (d.format.largeur === format.largeur && d.format.hauteur === format.hauteur) return d;
      const pages = adapter ? d.pages.map((p) => ({ ...p, elements: redimensionnerElements(p.elements, d.format, format) })) : d.pages;
      return { ...d, format: { ...format }, pages };
    });
  },

  ajouterPage() {
    const { document, pageActive } = get();
    const rang = document.pages.findIndex((p) => p.id === pageActive);
    const page = nouvellePage();
    get().appliquer((d) => ({ ...d, pages: [...d.pages.slice(0, rang + 1), page, ...d.pages.slice(rang + 1)] }));
    set({ pageActive: page.id, selection: [] });
  },

  dupliquerPageActive() {
    const { document, pageActive } = get();
    const rang = document.pages.findIndex((p) => p.id === pageActive);
    const copie = dupliquerPage(pageDe(document, pageActive));
    get().appliquer((d) => ({ ...d, pages: [...d.pages.slice(0, rang + 1), copie, ...d.pages.slice(rang + 1)] }));
    set({ pageActive: copie.id, selection: [] });
  },

  supprimerPage(id) {
    const { document, pageActive } = get();
    if (document.pages.length <= 1) return;
    const rang = document.pages.findIndex((p) => p.id === id);
    if (rang < 0) return;
    const restantes = document.pages.filter((p) => p.id !== id);
    const suivante = pageActive === id ? restantes[Math.min(rang, restantes.length - 1)].id : pageActive;
    get().appliquer((d) => ({ ...d, pages: d.pages.filter((p) => p.id !== id) }));
    set({ pageActive: suivante, selection: [] });
  },

  deplacerPage(id, rang) {
    get().appliquer((d) => {
      const actuel = d.pages.findIndex((p) => p.id === id);
      const cible = Math.max(0, Math.min(d.pages.length - 1, rang));
      if (actuel < 0 || actuel === cible) return d;
      const pages = [...d.pages];
      const [page] = pages.splice(actuel, 1);
      pages.splice(cible, 0, page);
      return { ...d, pages };
    });
  },

  allerALaPage(id) {
    if (get().pageActive === id || !get().document.pages.some((p) => p.id === id)) return;
    if (typeof window !== "undefined" && window.document.activeElement instanceof HTMLTextAreaElement) window.document.activeElement.blur();
    useTemps.getState().remettre();
    set({ pageActive: id, selection: [], selectionAudio: [], enEdition: null, enAjustement: null, celluleEnEdition: null });
  },

  // ---- Sélection ----

  selectionner(ids, ajout = false) {
    const complets = avecGroupes(ids, elementsCourants(get()));
    const actuelle = get().selection;
    const selection = ajout ? [...new Set([...actuelle, ...complets])] : complets;
    const enAjustement = get().enAjustement && selection.length === 1 && selection[0] === get().enAjustement ? get().enAjustement : null;
    set({ selection, enAjustement, ...(selection.length ? { selectionAudio: [] } : {}) });
  },

  selectionnerSeul(id) {
    set({ selection: [id], selectionAudio: [] });
  },

  basculerDansSelection(id) {
    const membres = avecGroupes([id], elementsCourants(get()));
    const actuelle = get().selection;
    set({ selection: actuelle.includes(id) ? actuelle.filter((i) => !membres.includes(i)) : [...new Set([...actuelle, ...membres])], selectionAudio: [] });
  },

  toutSelectionner() {
    set({ selection: elementsCourants(get()).filter((e) => e.visible).map((e) => e.id), selectionAudio: [] });
  },

  deselectionner() {
    if (get().selection.length || get().selectionAudio.length || get().enAjustement) set({ selection: [], selectionAudio: [], enAjustement: null });
  },

  commencerEdition(id) {
    const e = parId(elementsCourants(get())).get(id);
    if (e?.type === "texte" && !e.verrouille) set({ enEdition: id, selection: [id] });
    // Entrée sur un tableau : on écrit dans sa première cellule.
    if (e?.type === "tableau") get().commencerCellule(id, 0, 0);
  },

  definirDessin(reglages) {
    set(reglages ? { dessin: reglages, selection: [], enAjustement: null, celluleEnEdition: null } : { dessin: null });
  },

  commencerCellule(id, ligne, colonne) {
    const e = parId(elementsCourants(get())).get(id);
    if (e?.type !== "tableau" || e.verrouille || !e.cellules[ligne] || colonne >= e.colonnes.length) return;
    set({ celluleEnEdition: { id, ligne, colonne }, selection: [id], enEdition: null });
  },

  terminerCellule(texte, aller) {
    const c = get().celluleEnEdition;
    if (!c) return;
    set({ celluleEnEdition: null });
    let e = parId(elementsCourants(get())).get(c.id);
    if (e?.type !== "tableau") return;
    if (texte !== null && e.cellules[c.ligne]?.[c.colonne] !== texte) {
      const cellules = e.cellules.map((r) => [...r]);
      cellules[c.ligne][c.colonne] = texte;
      get().modifierElements({ [e.id]: { cellules } }, `cellule:${e.id}`);
      e = parId(elementsCourants(get())).get(c.id) as ElementTableau;
    }
    if (!aller) return;
    const nbCol = e.colonnes.length;
    let rang = c.ligne * nbCol + c.colonne + (aller === "suivante" ? 1 : -1);
    if (rang < 0) rang = 0;
    if (rang >= e.cellules.length * nbCol) {
      // Tab après la dernière cellule : une rangée de plus, comme dans un tableur.
      get().modifierElements({ [e.id]: ajouterRangee(e) }, `cellule:${e.id}`);
    }
    get().commencerCellule(e.id, Math.floor(rang / nbCol), rang % nbCol);
  },

  commencerAjustement(id) {
    const e = parId(elementsCourants(get())).get(id);
    if (e && recoitPhoto(e) && e.ressource && !e.verrouille) set({ enAjustement: id, selection: [id] });
  },

  terminerAjustement() {
    if (get().enAjustement) set({ enAjustement: null });
  },

  remplirPhoto(id, ressource) {
    const e = parId(elementsCourants(get())).get(id);
    if (!e || !recoitPhoto(e) || e.verrouille) return;
    get().modifierElements({ [id]: { ressource, recadrage: { zoom: 1, x: 0.5, y: 0.5 } } as Partial<ElementPage> });
    set({ selection: [id] });
  },

  retirerPhoto(id) {
    const e = parId(elementsCourants(get())).get(id);
    if (!e || !recoitPhoto(e) || !e.ressource) return;
    get().modifierElements({ [id]: { ressource: undefined } as Partial<ElementPage> });
    if (get().enAjustement === id) set({ enAjustement: null });
  },

  terminerEdition(texte) {
    const id = get().enEdition;
    set({ enEdition: null });
    if (!id || texte === null) return;
    const e = parId(elementsCourants(get())).get(id);
    if (!e || e.type !== "texte" || e.texte === texte) return;
    if (texte.trim() === "") {
      // Un texte vidé disparaît, comme dans Canva.
      get().appliquerPage((p) => ({ ...p, elements: p.elements.filter((x) => x.id !== id) }));
      return;
    }
    get().modifierElements({ [id]: { texte } });
  },

  ajouterRessources(ressources) {
    const { ordreRessources } = get();
    const nouvelles = ressources.filter((r) => !ordreRessources.includes(r.id));
    set({
      ressources: { ...get().ressources, ...Object.fromEntries(ressources.map((r) => [r.id, r])) },
      ordreRessources: [...nouvelles.map((r) => r.id).reverse(), ...ordreRessources],
    });
  },

  // ---- Frise ----

  basculerPageVideo(video) {
    const durees = dureesDe(get().ressources);
    useTemps.getState().pause();
    get().appliquerPage((p) => (video ? versVideo(p, durees) : versFixe(p)));
    if (!video) useTemps.getState().remettre();
  },

  deplacerClip(id, debut, piste) {
    get().appliquerPage((p) => deplacerClip(p, id, debut, piste, dureesDe(get().ressources)));
  },

  rognerClip(id, cote, t) {
    get().appliquerPage((p) => rogner(p, id, cote, t, dureesDe(get().ressources)));
  },

  scinderALaTete() {
    const etat = get();
    const page = pageCourante(etat);
    if (!estPageVideo(page)) return;
    const tete = useTemps.getState().tete;
    if (etat.selectionAudio.length) {
      let nouveauxSons: string[] = [];
      etat.appliquerPage((p) => {
        const r = scinderSons(p, etat.selectionAudio, tete, dureesDe(get().ressources), () => nouvelId("s"));
        nouveauxSons = r.nouveaux;
        return r.page;
      });
      if (nouveauxSons.length) set({ selectionAudio: nouveauxSons });
      return;
    }
    const sous = page.elements.filter((e) => visibleA(e, tete) && !e.verrouille);
    const choisis = sous.filter((e) => etat.selection.includes(e.id)).map((e) => e.id);
    const ids = choisis.length ? choisis : sous.filter((e) => e.piste === PISTE_PRINCIPALE).map((e) => e.id);
    if (ids.length === 0) return;
    let nouveaux: string[] = [];
    etat.appliquerPage((p) => {
      const r = scinder(p, ids, tete, dureesDe(get().ressources), () => nouvelId());
      nouveaux = r.nouveaux;
      return r.page;
    });
    // La sélection passe sur les secondes moitiés, comme dans CapCut.
    if (nouveaux.length) set({ selection: nouveaux });
  },

  definirAnimations(ids, genre, animation) {
    const choisis = new Set(ids);
    const durees = dureesDe(get().ressources);
    // Une animation posée sur une image fixe en fait une page vidéo (la frise s'ouvre), en une
    // seule étape d'annulation.
    get().appliquerPage((avant) => {
      const p = animation && !estPageVideo(avant) ? versVideo(avant, durees) : avant;
      let change = p !== avant;
      const elements = p.elements.map((e) => {
        if (!choisis.has(e.id) || !e.temps) return e;
        const animations = { ...e.animations };
        if (animation) animations[genre] = animation;
        else delete animations[genre];
        change = true;
        const { animations: _a, ...sans } = e;
        return (Object.keys(animations).length ? { ...e, animations } : sans) as ElementPage;
      });
      return change ? { ...p, elements } : p;
    }, `animations:${genre}:${ids.join(",")}`);
  },

  modifierPose(modifs, etiquette) {
    const tete = useTemps.getState().tete;
    const elements = parId(elementsCourants(get()));
    const directes: Record<string, Partial<ElementPage>> = {};
    for (const [id, m] of Object.entries(modifs)) {
      const e = elements.get(id);
      if (!e) continue;
      if (clesActives(e, tete)) directes[id] = { cles: poserCle(e, tete - e.temps!.debut, m) };
      else {
        const { echelle: _e, ...reste } = m;
        directes[id] = reste;
      }
    }
    get().modifierElements(directes, etiquette);
  },

  basculerCle(id) {
    const e = parId(elementsCourants(get())).get(id);
    const tete = useTemps.getState().tete;
    if (!e?.temps || !visibleA(e, tete)) return;
    const tr = tete - e.temps.debut;
    get().modifierElements({ [id]: { cles: cleProche(e, tr) ? retirerCle(e, tr) : poserCle(e, tr) } });
  },

  deplacerCle(id, de, vers) {
    const e = parId(elementsCourants(get())).get(id);
    if (!e?.cles) return;
    get().modifierElements({ [id]: { cles: deplacerCle(e, de, vers) } });
  },

  effacerCles(id) {
    get().modifierElements({ [id]: { cles: undefined } });
  },

  definirTransition(id, transition) {
    // Au plus la moitié du plus court des deux clips (le chevauchement ne peut pas davantage).
    const principale = elementsCourants(get()).filter((e) => e.piste === PISTE_PRINCIPALE && e.temps).sort((a, b) => a.temps!.debut - b.temps!.debut);
    const i = principale.findIndex((e) => e.id === id);
    const longueur = (e: ElementPage | undefined) => (e?.temps ? e.temps.fin - e.temps.debut : 0);
    const max = Math.floor(Math.min(longueur(principale[i]), longueur(principale[i - 1])) / 2);
    const duree = transition ? Math.max(100, Math.min(max, Math.round(transition.duree || DUREE_TRANSITION))) : 0;
    get().modifierElements({ [id]: { transition: transition && i > 0 ? { nom: transition.nom, duree } : undefined } }, `transition:${id}`);
  },

  // ---- Sons ----

  ajouterSon(ressource, options = {}) {
    const dureeFichier = ressource.son?.duree ?? (ressource.video?.son ? ressource.video.duree : undefined);
    if (dureeFichier === undefined) return null;
    const role: RoleSon = options.role ?? (options.jingle ? "musique" : ressource.son?.origine ? "voix" : dureeFichier >= 20_000 ? "musique" : "bruitage");
    const id = nouvelId("s");
    const durees = dureesDe({ ...get().ressources, [ressource.id]: ressource });
    // Une musique (pas un jingle) couvre la page jusqu'au bout, avec un fondu de fin.
    const fond = role === "musique" && !options.jingle;
    const son = {
      id,
      ressource: ressource.id,
      role,
      ...(fond ? { jusquALaFin: true, fonduSortie: FONDU_FIN_MUSIQUE } : {}),
      // Une prise reprise de la liste des sons commence au top, après le compte à rebours.
      ...(options.coupe ? { coupe: { ...options.coupe } } : ressource.son?.marque ? { coupe: { debut: ressource.son.marque } } : {}),
      ...(options.nettoyage && nettoyageActif(options.nettoyage) ? { nettoyage: borneNettoyage(options.nettoyage) } : {}),
    } as Omit<ClipAudio, "temps" | "piste">;
    const etaitVideo = estPageVideo(pageCourante(get()));
    const tete = etaitVideo ? useTemps.getState().tete : 0;
    get().appliquerPage((p) => {
      const v = estPageVideo(p) ? p : versVideo(p, durees, fond ? 0 : dureeFichier);
      let debut = options.debut ?? tete;
      if (options.jingle === "ouverture") debut = 0;
      if (options.jingle === "fin") debut = Math.max(0, (v.duree ?? 0) - dureeFichier);
      const posee = placerSon(v, son, debut, durees);
      // Lâché sur une piste précise de la frise : il y va (ou juste dessous si elle est prise).
      const c = posee.audio?.find((x) => x.id === id);
      return c && options.piste !== undefined && options.piste !== c.piste ? deplacerSon(posee, id, c.temps.debut, options.piste, durees) : posee;
    });
    if (!pageCourante(get()).audio?.some((c) => c.id === id)) return null;
    set({ selection: [], selectionAudio: [id] });
    return id;
  },

  deplacerSon(id, debut, piste) {
    get().appliquerPage((p) => deplacerSon(p, id, debut, piste, dureesDe(get().ressources)));
  },

  rognerSon(id, cote, t) {
    get().appliquerPage((p) => rognerSon(p, id, cote, t, dureesDe(get().ressources)));
  },

  modifierSons(modifs, etiquette) {
    get().appliquerPage((p) => {
      if (!p.audio?.some((c) => modifs[c.id])) return p;
      return { ...p, audio: p.audio.map((c) => (modifs[c.id] ? ({ ...c, ...modifs[c.id] } as ClipAudio) : c)) };
    }, etiquette);
  },

  selectionnerSons(ids, ajout = false) {
    const existants = new Set((pageCourante(get()).audio ?? []).map((c) => c.id));
    const choisis = ids.filter((id) => existants.has(id));
    const selectionAudio = ajout ? [...new Set([...get().selectionAudio, ...choisis])] : choisis;
    set({ selectionAudio, ...(selectionAudio.length ? { selection: [], enAjustement: null } : {}) });
  },

  detacherSon(id) {
    const e = parId(elementsCourants(get())).get(id);
    if (e?.type !== "video" || !e.temps || (e.vitesse ?? 1) !== 1 || (e.volume ?? 1) === 0) return null;
    if (!get().ressources[e.ressource]?.video?.son) return null;
    const sonId = nouvelId("s");
    const son = {
      id: sonId,
      ressource: e.ressource,
      role: "voix",
      ...(e.coupe ? { coupe: { ...e.coupe } } : {}),
      ...(e.volume !== undefined && e.volume !== 1 ? { volume: e.volume } : {}),
      ...(e.fonduEntree ? { fonduEntree: e.fonduEntree } : {}),
      ...(e.fonduSortie ? { fonduSortie: e.fonduSortie } : {}),
    } as Omit<ClipAudio, "temps" | "piste">;
    const debut = e.temps.debut;
    get().appliquerPage((p) => placerSon({ ...p, elements: p.elements.map((x) => (x.id === id ? ({ ...x, volume: 0 } as ElementPage) : x)) }, son, debut, dureesDe(get().ressources)));
    set({ selection: [], selectionAudio: [sonId] });
    return sonId;
  },

  notifier(texte, options = {}) {
    set({ notification: { numero: Date.now(), texte, ...options } });
  },

  fermerNotification() {
    set({ notification: null });
  },

  definirZoom(zoom) {
    set({ zoom: zoom === null ? null : Math.max(0.05, Math.min(8, zoom)) });
  },

  definirZoomAjuste(zoomAjuste) {
    if (Math.abs(get().zoomAjuste - zoomAjuste) > 1e-6) set({ zoomAjuste });
  },

  basculerVueGrille() {
    set({ vueGrille: !get().vueGrille });
  },

  basculerApercu(actif) {
    set({ apercu: actif ?? !get().apercu, selection: [], enEdition: null, celluleEnEdition: null });
  },

  signalerIa(outil) {
    set({ iaDernierAppel: { outil, quand: Date.now() } });
  },
}));
