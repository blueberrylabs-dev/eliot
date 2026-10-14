// Le store : une seule porte d'écriture vers le document (BRIEF, règle 2). Chaque action qui
// modifie le document passe par `appliquer`, qui garde l'état précédent pour « annuler ».
// Les actions sur les éléments visent la page affichée (`pageActive`).

import { create } from "zustand";
import { documentVide, dupliquerPage, dupliquerTous, mesurerHauteurTexte, nouvelId, nouvellePage } from "../modele/fabriques";
import { aligner, boiteDe, redimensionnerElements, repartir, type SensAlignement } from "../modele/geometrie";
import type { Couleur, DocumentEliot, ElementPage, ElementTexte, Format, PageEliot, RefProjet, Ressource } from "../modele/types";

const LIMITE_HISTORIQUE = 100;
/** Deux modifications de même nature à moins de 700 ms forment une seule étape à annuler
 *  (glisser une couleur, appuyer plusieurs fois sur une flèche). */
const FENETRE_FUSION_MS = 700;

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
  texte: ["police", "taillePolice", "gras", "italique", "souligne", "alignement", "couleur", "interligne", "espacement", "opacite"],
  forme: ["remplissage", "contour", "epaisseurContour", "arrondi", "opacite"],
  image: ["opacite"],
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
  enEdition: string | null;
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

  chargerProjet: (projet: RefProjet | null, document: DocumentEliot, ressources: Ressource[]) => void;
  allerALAccueil: () => void;
  definirProjet: (projet: RefProjet) => void;
  definirNom: (nom: string) => void;
  definirEnregistrement: (etat: EtatEnregistrement) => void;

  appliquer: (recette: (d: DocumentEliot) => DocumentEliot, etiquette?: string) => void;
  appliquerPage: (recette: (p: PageEliot) => PageEliot, etiquette?: string) => void;
  annuler: () => void;
  retablir: () => void;

  ajouterElements: (elements: ElementPage[]) => void;
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

  ajouterRessources: (ressources: Ressource[]) => void;
  notifier: (texte: string, options?: { erreur?: boolean; chemin?: string }) => void;
  fermerNotification: () => void;
  definirZoom: (zoom: number | null) => void;
  definirZoomAjuste: (zoom: number) => void;
  basculerVueGrille: () => void;
  basculerApercu: (actif?: boolean) => void;
}

// ---- Lecture ----

/** La page affichée (la première si l'identifiant ne correspond plus à rien). */
export function pageDe(document: DocumentEliot, id: string): PageEliot {
  return document.pages.find((p) => p.id === id) ?? document.pages[0];
}

export const pageCourante = (etat: Pick<EtatEditeur, "document" | "pageActive">) => pageDe(etat.document, etat.pageActive);
export const elementsCourants = (etat: Pick<EtatEditeur, "document" | "pageActive">) => pageCourante(etat).elements;

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

const NOUVEAU = documentVide();

export const useEditeur = create<EtatEditeur>()((set, get) => ({
  vue: "accueil",
  projet: null,
  document: NOUVEAU,
  pageActive: NOUVEAU.pages[0].id,
  ressources: {},
  ordreRessources: [],
  selection: [],
  enEdition: null,
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

  chargerProjet(projet, document, ressources) {
    set({
      vue: "editeur",
      projet,
      document,
      pageActive: document.pages[0].id,
      ressources: Object.fromEntries(ressources.map((r) => [r.id, r])),
      ordreRessources: ressources.map((r) => r.id),
      selection: [],
      enEdition: null,
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
    set({ vue: "accueil", selection: [], enEdition: null, apercu: false, vueGrille: false, styleCopie: null });
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
    const suivant = recette(document);
    if (suivant === document) return;
    const maintenant = Date.now();
    const fusion = etiquette !== undefined && etiquette === derniereEtiquette && maintenant - dernierInstant < FENETRE_FUSION_MS;
    const page = pageDe(suivant, pageActive);
    const ids = new Set(page.elements.map((e) => e.id));
    set({
      document: suivant,
      pageActive: page.id,
      passe: fusion ? passe : [...passe, { document, page: pageActive }].slice(-LIMITE_HISTORIQUE),
      futur: [],
      derniereEtiquette: etiquette ?? null,
      dernierInstant: maintenant,
      selection: get().selection.filter((id) => ids.has(id)),
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
    set({
      document: precedent.document,
      pageActive: page.id,
      passe: passe.slice(0, -1),
      futur: [{ document, page: pageActive }, ...futur],
      selection: get().selection.filter((id) => ids.has(id)),
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
    set({
      document: suivant.document,
      pageActive: page.id,
      passe: [...passe, { document, page: pageActive }],
      futur: futur.slice(1),
      selection: get().selection.filter((id) => ids.has(id)),
      enEdition: null,
      derniereEtiquette: null,
    });
  },

  // ---- Éléments de la page affichée ----

  ajouterElements(elements) {
    if (elements.length === 0) return;
    get().appliquerPage((p) => ({ ...p, elements: [...p.elements, ...elements] }));
    set({ selection: elements.map((e) => e.id) });
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
        if (suivant.type === "texte" && ("texte" in modif || "police" in modif || "taillePolice" in modif || "largeur" in modif || "gras" in modif || "italique" in modif || "interligne" in modif || "espacement" in modif) && !("hauteur" in modif)) {
          (suivant as ElementTexte).hauteur = mesurerHauteurTexte(suivant);
        }
        return suivant;
      });
      return change ? { ...p, elements } : p;
    }, etiquette);
  },

  supprimerSelection() {
    const etat = get();
    const elements = parId(elementsCourants(etat));
    const aSupprimer = new Set(etat.selection.filter((id) => !elements.get(id)?.verrouille));
    if (aSupprimer.size === 0) return;
    etat.appliquerPage((p) => ({ ...p, elements: p.elements.filter((e) => !aSupprimer.has(e.id)) }));
    set({ selection: etat.selection.filter((id) => !aSupprimer.has(id)) });
  },

  dupliquerSelection() {
    get().ajouterElements(dupliquerTous(elementsSelectionnes(get())));
  },

  copierSelection() {
    const etat = get();
    const elements = elementsSelectionnes(etat);
    if (elements.length) set({ pressePapiers: { projet: etat.projet, elements } });
  },

  coller() {
    get().ajouterElements(dupliquerTous(get().pressePapiers.elements, 32));
  },

  deplacerDansPile(sens) {
    const ids = new Set(get().selection);
    if (ids.size === 0) return;
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
    const modifs: Record<string, Partial<ElementPage>> = {};
    for (const e of elementsSelectionnes(get())) if (!e.verrouille) modifs[e.id] = { x: e.x + dx, y: e.y + dy };
    get().modifierElements(modifs, "fleches");
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
    // Entre deux types différents, seule la transparence passe.
    const valeurs = cible.type === style.type ? style.valeurs : { opacite: style.valeurs.opacite };
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
    set({ pageActive: id, selection: [], enEdition: null });
  },

  // ---- Sélection ----

  selectionner(ids, ajout = false) {
    const complets = avecGroupes(ids, elementsCourants(get()));
    const actuelle = get().selection;
    set({ selection: ajout ? [...new Set([...actuelle, ...complets])] : complets });
  },

  selectionnerSeul(id) {
    set({ selection: [id] });
  },

  basculerDansSelection(id) {
    const membres = avecGroupes([id], elementsCourants(get()));
    const actuelle = get().selection;
    set({ selection: actuelle.includes(id) ? actuelle.filter((i) => !membres.includes(i)) : [...new Set([...actuelle, ...membres])] });
  },

  toutSelectionner() {
    set({ selection: elementsCourants(get()).filter((e) => e.visible).map((e) => e.id) });
  },

  deselectionner() {
    if (get().selection.length) set({ selection: [] });
  },

  commencerEdition(id) {
    const e = parId(elementsCourants(get())).get(id);
    if (e?.type === "texte" && !e.verrouille) set({ enEdition: id, selection: [id] });
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
    set({ apercu: actif ?? !get().apercu, selection: [], enEdition: null });
  },
}));
