// L'aperçu d'une animation qu'on vient de choisir (étape 4, lot 3) : l'élément la joue une fois,
// seul, à sa place sur la page, sans bouger la tête de lecture ni lancer les vidéos. Pendant
// l'aperçu, son instant avance de `debut` à `fin` (ms de la page).

import { create } from "zustand";
import { useTemps } from "../etat/temps";
import type { GenreAnimation } from "../modele/animation";
import type { Animation } from "../modele/types";

/** Une animation essayée sans être posée (survol d'une vignette du panneau Animer). */
export interface Essai {
  genre: GenreAnimation;
  animation: Animation | null;
}

interface EtatApercu {
  id: string | null;
  t: number;
  essai?: Essai;
}

export const useApercuAnimation = create<EtatApercu>(() => ({ id: null, t: 0 }));

let image = 0;

export function arreterApercu() {
  if (image) cancelAnimationFrame(image);
  image = 0;
  if (useApercuAnimation.getState().id !== null) useApercuAnimation.setState({ id: null, t: 0, essai: undefined });
}

/** Joue l'élément `id` de l'instant `debut` à l'instant `fin` de la page, en temps réel ;
 *  `essai` : avec cette animation à la place de la sienne. */
export function montrerAnimation(id: string, debut: number, fin: number, essai?: Essai) {
  arreterApercu();
  if (fin <= debut) return;
  const depart = performance.now();
  const pas = (maintenant: number) => {
    const t = debut + (maintenant - depart);
    if (t >= fin) {
      image = 0;
      useApercuAnimation.setState({ id: null, t: 0, essai: undefined });
      return;
    }
    useApercuAnimation.setState({ id, t, essai });
    image = requestAnimationFrame(pas);
  };
  useApercuAnimation.setState({ id, t: debut, essai });
  image = requestAnimationFrame(pas);
}

// La lecture de la page reprend la main.
useTemps.subscribe((s, avant) => {
  if (s.joue && !avant.joue) arreterApercu();
});
