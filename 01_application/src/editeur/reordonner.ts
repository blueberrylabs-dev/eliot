// Réordonner des pages en les faisant glisser (bande du bas, vue en grille). Un clic sans
// mouvement reste un clic.

import type { PointerEvent as PointeurReact } from "react";

const SEUIL_PX = 5;

export interface Reordonnancement {
  /** Rang visé pendant le glisser, pour dessiner le repère d'insertion. */
  surCible: (rang: number | null) => void;
  /** Rang final : l'élément part à cette place. */
  surLacher: (rang: number) => void;
  surClic: () => void;
}

/**
 * `cases` renvoie les rectangles des cases, dans l'ordre. Le rang visé est celui de la case
 * dont le centre est le plus proche du pointeur.
 */
export function glisserPourReordonner(evenement: PointeurReact<HTMLElement>, cases: () => DOMRect[], rappels: Reordonnancement): void {
  if (evenement.button !== 0) return;
  const depart = { x: evenement.clientX, y: evenement.clientY };
  let actif = false;
  let cible: number | null = null;

  const viser = (x: number, y: number) => {
    const rects = cases();
    let meilleur = 0;
    let distance = Infinity;
    rects.forEach((r, i) => {
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      if (d < distance) {
        distance = d;
        meilleur = i;
      }
    });
    return meilleur;
  };

  const bouger = (e: PointerEvent) => {
    if (!actif && Math.hypot(e.clientX - depart.x, e.clientY - depart.y) < SEUIL_PX) return;
    actif = true;
    document.body.style.cursor = "grabbing";
    cible = viser(e.clientX, e.clientY);
    rappels.surCible(cible);
  };
  const lacher = () => {
    window.removeEventListener("pointermove", bouger);
    window.removeEventListener("pointerup", lacher);
    document.body.style.cursor = "";
    rappels.surCible(null);
    if (!actif) rappels.surClic();
    else if (cible !== null) rappels.surLacher(cible);
  };
  window.addEventListener("pointermove", bouger);
  window.addEventListener("pointerup", lacher);
}
