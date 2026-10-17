// Le kit de marque en mémoire : lu une fois au lancement, enregistré par le Rust peu après
// chaque changement. Les logos et les jingles vivent dans le dossier du kit ; poser un logo ou
// un jingle le copie d'abord dans le design ouvert.

import { create } from "zustand";
import { useSuiviImport } from "../editeur/SuiviImport";
import { kitValide, kitVide, LOGOS_MAX, type KitMarque, type RoleJingle } from "../modele/marque";
import { modificationsDuStyle, STYLES_MAX, styleDepuisTexte, type StyleTexte } from "../modele/stylesTexte";
import { nouvelId } from "../modele/fabriques";
import { assurerPolice } from "../polices";
import type { ElementTexte } from "../modele/types";
import { REF_MARQUE, type Ressource } from "../modele/types";
import { choisirEtImporterImages, choisirEtImporterSons, copierRessources, enregistrerMarque, listerRessources, lireMarque } from "../pont/tauri";
import { useEditeur } from "./editeur";
import { copierPoliceDansDesign } from "./projets";

const DELAI_ENREGISTREMENT_MS = 400;

interface EtatMarque {
  kit: KitMarque;
  /** Les images du dossier du kit, par identifiant. */
  images: Record<string, Ressource>;
  charge: boolean;
  charger: () => Promise<void>;
  modifier: (recette: (kit: KitMarque) => KitMarque) => void;
  importerLogos: () => Promise<void>;
  retirerLogo: (id: string) => void;
  /** Choisit un son du poste comme jingle d'ouverture ou de fin. */
  importerJingle: (role: RoleJingle) => Promise<void>;
  retirerJingle: (role: RoleJingle) => void;
  /** Garde l'allure d'un texte sous `nom` (étape 7, lot 2) ; un style du même nom est remplacé,
   *  à sa place. Renvoie le style gardé. */
  enregistrerStyle: (texte: ElementTexte, nom: string) => StyleTexte;
  supprimerStyle: (id: string) => void;
  renommerStyle: (id: string, nom: string) => void;
}

let minuterie: ReturnType<typeof setTimeout> | null = null;
let enAttente: KitMarque | null = null;

async function enregistrer(kit: KitMarque): Promise<void> {
  try {
    await enregistrerMarque(kit);
  } catch (e) {
    useEditeur.getState().notifier(`Kit de marque non enregistré : ${String(e)}`, { erreur: true });
  }
}

function enregistrerBientot(kit: KitMarque) {
  if (minuterie) clearTimeout(minuterie);
  enAttente = kit;
  minuterie = setTimeout(() => {
    minuterie = null;
    enAttente = null;
    void enregistrer(kit);
  }, DELAI_ENREGISTREMENT_MS);
}

/** Avant de fermer la fenêtre : le dernier changement du kit part tout de suite. */
export async function enregistrerMarqueMaintenant(): Promise<void> {
  if (!enAttente) return;
  if (minuterie) clearTimeout(minuterie);
  minuterie = null;
  const kit = enAttente;
  enAttente = null;
  await enregistrer(kit);
}

export const useMarque = create<EtatMarque>()((set, get) => ({
  kit: kitVide(),
  images: {},
  charge: false,

  async charger() {
    try {
      const [brut, images] = await Promise.all([lireMarque(), listerRessources(REF_MARQUE)]);
      const kit = kitValide(brut);
      const connues = Object.fromEntries(images.map((r) => [r.id, r]));
      const jingles = Object.fromEntries(Object.entries(kit.jingles).filter(([, id]) => id && connues[id]?.son));
      set({ kit: { ...kit, logos: kit.logos.filter((id) => id in connues && !connues[id].son), jingles }, images: connues, charge: true });
    } catch (e) {
      set({ charge: true });
      useEditeur.getState().notifier(`Kit de marque illisible : ${String(e)}`, { erreur: true });
    }
  },

  modifier(recette) {
    const kit = kitValide(recette(get().kit));
    set({ kit });
    enregistrerBientot(kit);
  },

  async importerLogos() {
    const bilan = await choisirEtImporterImages(REF_MARQUE);
    if (!bilan) return;
    if (bilan.erreurs.length) useEditeur.getState().notifier(`Non importé : ${bilan.erreurs.join(" ; ")}`, { erreur: true });
    if (bilan.ressources.length === 0) return;
    set({ images: { ...get().images, ...Object.fromEntries(bilan.ressources.map((r) => [r.id, r])) } });
    get().modifier((k) => ({ ...k, logos: [...k.logos, ...bilan.ressources.map((r) => r.id).filter((id) => !k.logos.includes(id))].slice(0, LOGOS_MAX) }));
  },

  retirerLogo(id) {
    // Le fichier reste dans le dossier du kit : seul le panneau l'oublie.
    get().modifier((k) => ({ ...k, logos: k.logos.filter((l) => l !== id) }));
  },

  async importerJingle(role) {
    const suivi = useSuiviImport.getState();
    try {
      const bilan = await choisirEtImporterSons(REF_MARQUE, (_, part) => suivi.montrer("Préparation du jingle", part));
      if (!bilan) return;
      if (bilan.erreurs.length) useEditeur.getState().notifier(`Non importé : ${bilan.erreurs.join(" ; ")}`, { erreur: true });
      const r = bilan.ressources.find((x) => x.son);
      if (!r) return;
      set({ images: { ...get().images, [r.id]: r } });
      get().modifier((k) => ({ ...k, jingles: { ...k.jingles, [role]: r.id } }));
    } finally {
      suivi.finir();
    }
  },

  retirerJingle(role) {
    get().modifier((k) => {
      const jingles = { ...k.jingles };
      delete jingles[role];
      return { ...k, jingles };
    });
  },

  enregistrerStyle(texte, nom) {
    const propre = nom.replace(/\s+/g, " ").trim().slice(0, 40) || "Mon style";
    const meme = get().kit.styles.find((s) => s.nom.toLocaleLowerCase("fr") === propre.toLocaleLowerCase("fr"));
    const style = styleDepuisTexte(texte, propre, meme?.id ?? nouvelId("s"));
    get().modifier((k) => ({ ...k, styles: meme ? k.styles.map((s) => (s.id === meme.id ? style : s)) : [...k.styles, style].slice(-STYLES_MAX) }));
    return style;
  },

  supprimerStyle(id) {
    get().modifier((k) => ({ ...k, styles: k.styles.filter((s) => s.id !== id) }));
  },

  renommerStyle(id, nom) {
    const propre = nom.replace(/\s+/g, " ").trim().slice(0, 40);
    if (!propre) return;
    get().modifier((k) => ({ ...k, styles: k.styles.map((s) => (s.id === id ? { ...s, nom: propre } : s)) }));
  },
}));

/** Pose un style de texte enregistré sur des textes de la page (police chargée d'abord, pour
 *  qu'ils se mesurent avec elle). Une étape d'annulation. Renvoie les textes changés. */
export async function poserStyleTexte(style: StyleTexte, ids: string[]): Promise<string[]> {
  await assurerPolice(style.police, style.gras, style.italique).catch(() => undefined);
  // Une police du poste part avec le design, comme quand on la choisit.
  void copierPoliceDansDesign(style.police).catch(() => undefined);
  const etat = useEditeur.getState();
  const page = etat.document.pages.find((p) => p.id === etat.pageActive);
  const textes = (page?.elements ?? []).filter((e): e is ElementTexte => e.type === "texte" && ids.includes(e.id) && !e.verrouille);
  if (textes.length === 0) return [];
  etat.modifierElements(Object.fromEntries(textes.map((t) => [t.id, modificationsDuStyle(style)])));
  return textes.map((t) => t.id);
}

/** Copie un logo (ou un jingle) du kit dans le design ouvert et renvoie la ressource copiée. */
export async function logoDansDesign(id: string): Promise<Ressource> {
  const projet = useEditeur.getState().projet;
  if (!projet) throw new Error("aucun design ouvert");
  const [copie] = await copierRessources(REF_MARQUE, projet, [id]);
  if (!copie) throw new Error("introuvable dans le kit");
  if (useEditeur.getState().projet !== projet) throw new Error("le design a changé pendant la copie");
  useEditeur.getState().ajouterRessources([copie]);
  return copie;
}

/** Pose un jingle du kit dans la page affichée : au début (ouverture) ou finissant avec la
 *  page (fin). La page devient une vidéo au besoin. Renvoie l'identifiant du son posé. */
export async function poserJingle(role: RoleJingle): Promise<string | null> {
  const id = useMarque.getState().kit.jingles[role];
  if (!id) throw new Error(role === "ouverture" ? "pas de jingle d'ouverture dans le kit (onglet Marque)" : "pas de jingle de fin dans le kit (onglet Marque)");
  const copie = await logoDansDesign(id);
  return useEditeur.getState().ajouterSon(copie, { jingle: role });
}
