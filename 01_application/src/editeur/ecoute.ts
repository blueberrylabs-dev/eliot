// L'écoute d'un son dans un panneau (un extrait de Freesound, un son du design, un jingle),
// avant de le poser : une seule balise `<audio>`, un seul son à la fois.

import { create } from "zustand";

interface EtatEcoute {
  /** La clé du son qui joue (`null` : rien). */
  enCours: string | null;
  /** Joue le son de `url` (ou l'arrête s'il jouait déjà). */
  basculer: (cle: string, url: () => Promise<string>) => void;
  arreter: () => void;
}

let balise: HTMLAudioElement | null = null;

export const useEcoute = create<EtatEcoute>((set, get) => ({
  enCours: null,
  basculer(cle, url) {
    if (get().enCours === cle) {
      get().arreter();
      return;
    }
    get().arreter();
    set({ enCours: cle });
    void url().then(
      (adresse) => {
        if (get().enCours !== cle) return;
        balise ??= new Audio();
        balise.src = adresse;
        balise.onended = () => get().enCours === cle && set({ enCours: null });
        void balise.play().catch(() => get().enCours === cle && set({ enCours: null }));
      },
      () => get().enCours === cle && set({ enCours: null }),
    );
  },
  arreter() {
    balise?.pause();
    if (get().enCours !== null) set({ enCours: null });
  },
}));
