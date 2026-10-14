// Le store : une seule porte d'écriture vers le document (BRIEF, règle 2). Chaque action qui
// modifie le document passe par `appliquer`, qui garde l'état précédent pour « annuler ».

import { create } from "zustand";
import { documentVide, dupliquer, mesurerHauteurTexte } from "../modele/fabriques";
import type { DocumentEliot, ElementPage, ElementTexte, Page, Ressource } from "../modele/types";

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

interface EtatEditeur {
  document: DocumentEliot;
  ressources: Record<string, Ressource>;
  ordreRessources: string[];
  selection: string[];
  enEdition: string | null;
  passe: DocumentEliot[];
  futur: DocumentEliot[];
  derniereEtiquette: string | null;
  dernierInstant: number;
  pressePapiers: ElementPage[];
  notification: Notification | null;

  appliquer: (recette: (d: DocumentEliot) => DocumentEliot, etiquette?: string) => void;
  annuler: () => void;
  retablir: () => void;
  nouveauDocument: () => void;

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
  modifierPage: (page: Partial<Page>, etiquette?: string) => void;

  selectionner: (ids: string[], ajout?: boolean) => void;
  basculerDansSelection: (id: string) => void;
  toutSelectionner: () => void;
  deselectionner: () => void;

  commencerEdition: (id: string) => void;
  terminerEdition: (texte: string | null) => void;

  ajouterRessources: (ressources: Ressource[]) => void;
  notifier: (texte: string, options?: { erreur?: boolean; chemin?: string }) => void;
  fermerNotification: () => void;
}

const parId = (d: DocumentEliot) => new Map(d.elements.map((e) => [e.id, e]));

export const useEditeur = create<EtatEditeur>()((set, get) => ({
  document: documentVide(),
  ressources: {},
  ordreRessources: [],
  selection: [],
  enEdition: null,
  passe: [],
  futur: [],
  derniereEtiquette: null,
  dernierInstant: 0,
  pressePapiers: [],
  notification: null,

  appliquer(recette, etiquette) {
    const { document, passe, derniereEtiquette, dernierInstant } = get();
    const suivant = recette(document);
    if (suivant === document) return;
    const maintenant = Date.now();
    const fusion = etiquette !== undefined && etiquette === derniereEtiquette && maintenant - dernierInstant < FENETRE_FUSION_MS;
    const ids = new Set(suivant.elements.map((e) => e.id));
    set({
      document: suivant,
      passe: fusion ? passe : [...passe, document].slice(-LIMITE_HISTORIQUE),
      futur: [],
      derniereEtiquette: etiquette ?? null,
      dernierInstant: maintenant,
      selection: get().selection.filter((id) => ids.has(id)),
    });
  },

  annuler() {
    const { passe, futur, document } = get();
    const precedent = passe[passe.length - 1];
    if (!precedent) return;
    const ids = new Set(precedent.elements.map((e) => e.id));
    set({
      document: precedent,
      passe: passe.slice(0, -1),
      futur: [document, ...futur],
      selection: get().selection.filter((id) => ids.has(id)),
      enEdition: null,
      derniereEtiquette: null,
    });
  },

  retablir() {
    const { passe, futur, document } = get();
    const suivant = futur[0];
    if (!suivant) return;
    const ids = new Set(suivant.elements.map((e) => e.id));
    set({
      document: suivant,
      passe: [...passe, document],
      futur: futur.slice(1),
      selection: get().selection.filter((id) => ids.has(id)),
      enEdition: null,
      derniereEtiquette: null,
    });
  },

  nouveauDocument() {
    get().appliquer((d) => ({ ...documentVide(), page: { ...d.page, fond: "#ffffff" } }), "nouveau");
    set({ selection: [], enEdition: null });
  },

  ajouterElements(elements) {
    if (elements.length === 0) return;
    get().appliquer((d) => ({ ...d, elements: [...d.elements, ...elements] }));
    set({ selection: elements.map((e) => e.id) });
  },

  modifierElements(modifs, etiquette) {
    get().appliquer((d) => {
      let change = false;
      const elements = d.elements.map((e) => {
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
      return change ? { ...d, elements } : d;
    }, etiquette);
  },

  supprimerSelection() {
    const { selection, document } = get();
    const elements = parId(document);
    const aSupprimer = new Set(selection.filter((id) => !elements.get(id)?.verrouille));
    if (aSupprimer.size === 0) return;
    get().appliquer((d) => ({ ...d, elements: d.elements.filter((e) => !aSupprimer.has(e.id)) }));
    set({ selection: selection.filter((id) => !aSupprimer.has(id)) });
  },

  dupliquerSelection() {
    const { selection, document } = get();
    const copies = document.elements.filter((e) => selection.includes(e.id)).map((e) => dupliquer(e));
    get().ajouterElements(copies);
  },

  copierSelection() {
    const { selection, document } = get();
    set({ pressePapiers: document.elements.filter((e) => selection.includes(e.id)) });
  },

  coller() {
    get().ajouterElements(get().pressePapiers.map((e) => dupliquer(e, 32)));
  },

  deplacerDansPile(sens) {
    const ids = new Set(get().selection);
    if (ids.size === 0) return;
    get().appliquer((d) => {
      const choisis = d.elements.filter((e) => ids.has(e.id));
      const autres = d.elements.filter((e) => !ids.has(e.id));
      let elements: ElementPage[];
      if (sens === "premier") elements = [...autres, ...choisis];
      else if (sens === "dernier") elements = [...choisis, ...autres];
      else {
        elements = [...d.elements];
        const pas = sens === "avant" ? 1 : -1;
        const indices = elements.map((e, i) => (ids.has(e.id) ? i : -1)).filter((i) => i >= 0);
        const ordre = pas === 1 ? [...indices].reverse() : indices;
        for (const i of ordre) {
          const j = i + pas;
          if (j < 0 || j >= elements.length || ids.has(elements[j].id)) continue;
          [elements[i], elements[j]] = [elements[j], elements[i]];
        }
      }
      return elements.every((e, i) => e === d.elements[i]) ? d : { ...d, elements };
    });
  },

  deplacerSelection(dx, dy) {
    const { selection, document } = get();
    const elements = parId(document);
    const modifs: Record<string, Partial<ElementPage>> = {};
    for (const id of selection) {
      const e = elements.get(id);
      if (e && !e.verrouille) modifs[id] = { x: e.x + dx, y: e.y + dy };
    }
    get().modifierElements(modifs, "fleches");
  },

  basculerVerrou() {
    const { selection, document } = get();
    const choisis = document.elements.filter((e) => selection.includes(e.id));
    const verrouiller = choisis.some((e) => !e.verrouille);
    get().modifierElements(Object.fromEntries(choisis.map((e) => [e.id, { verrouille: verrouiller }])));
  },

  basculerVisibilite(id) {
    const e = parId(get().document).get(id);
    if (e) get().modifierElements({ [id]: { visible: !e.visible } });
  },

  modifierPage(page, etiquette) {
    get().appliquer((d) => ({ ...d, page: { ...d.page, ...page } }), etiquette);
  },

  selectionner(ids, ajout = false) {
    const actuelle = get().selection;
    set({ selection: ajout ? [...new Set([...actuelle, ...ids])] : ids });
  },

  basculerDansSelection(id) {
    const actuelle = get().selection;
    set({ selection: actuelle.includes(id) ? actuelle.filter((i) => i !== id) : [...actuelle, id] });
  },

  toutSelectionner() {
    set({ selection: get().document.elements.filter((e) => e.visible).map((e) => e.id) });
  },

  deselectionner() {
    if (get().selection.length) set({ selection: [] });
  },

  commencerEdition(id) {
    const e = parId(get().document).get(id);
    if (e?.type === "texte" && !e.verrouille) set({ enEdition: id, selection: [id] });
  },

  terminerEdition(texte) {
    const id = get().enEdition;
    set({ enEdition: null });
    if (!id || texte === null) return;
    const e = parId(get().document).get(id);
    if (!e || e.type !== "texte" || e.texte === texte) return;
    if (texte.trim() === "") {
      // Un texte vidé disparaît, comme dans Canva.
      get().appliquer((d) => ({ ...d, elements: d.elements.filter((x) => x.id !== id) }));
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
}));

/** Les éléments sélectionnés, dans l'ordre d'empilement. */
export const elementsSelectionnes = (etat: Pick<EtatEditeur, "document" | "selection">) =>
  etat.document.elements.filter((e) => etat.selection.includes(e.id));
