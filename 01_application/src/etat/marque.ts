// Le kit de marque en mémoire : lu une fois au lancement, enregistré par le Rust peu après
// chaque changement. Les logos vivent dans le dossier du kit ; poser un logo le copie d'abord
// dans le design ouvert.

import { create } from "zustand";
import { kitValide, kitVide, LOGOS_MAX, type KitMarque } from "../modele/marque";
import { REF_MARQUE, type Ressource } from "../modele/types";
import { choisirEtImporterImages, copierRessources, enregistrerMarque, listerRessources, lireMarque } from "../pont/tauri";
import { useEditeur } from "./editeur";

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
      set({ kit: { ...kit, logos: kit.logos.filter((id) => id in connues) }, images: connues, charge: true });
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
}));

/** Copie un logo du kit dans le design ouvert et renvoie l'image copiée. */
export async function logoDansDesign(id: string): Promise<Ressource> {
  const projet = useEditeur.getState().projet;
  if (!projet) throw new Error("aucun design ouvert");
  const [copie] = await copierRessources(REF_MARQUE, projet, [id]);
  if (!copie) throw new Error("logo introuvable dans le kit");
  if (useEditeur.getState().projet !== projet) throw new Error("le design a changé pendant la copie");
  useEditeur.getState().ajouterRessources([copie]);
  return copie;
}
