// La pipette (étape 7, lot 4) : un choix de couleur attend un clic sur la page. WebKitGTK n'a
// pas la pipette du système (l'EyeDropper des navigateurs) ; c'est la page qui la remplace.
// Un état de la vue : ni dans le document, ni dans l'historique.

import { create } from "zustand";

interface EtatPipette {
  /** Ce qui reçoit la couleur prise (#rrggbb) ; `null` : pas de pipette en cours. */
  attente: ((hex: string) => void) | null;
  /** Ce que la couleur remplira, dit dans la bulle d'aide (« le texte », « le départ du
   *  dégradé »). */
  pour: string;
  commencer: (recevoir: (hex: string) => void, pour?: string) => void;
  finir: () => void;
}

export const usePipette = create<EtatPipette>((set) => ({
  attente: null,
  pour: "",
  commencer: (recevoir, pour = "") => set({ attente: recevoir, pour }),
  finir: () => set({ attente: null, pour: "" }),
}));

/** Prend la couleur : la donne à qui l'attend, puis finit. */
export function prendreCouleur(hex: string): void {
  const { attente, finir } = usePipette.getState();
  finir();
  attente?.(hex);
}
