// Poser un son d'un panneau (étape 4, lot 5) : un clic le pose à la tête de lecture, sur la
// piste audio qui convient ; un glisser jusqu'aux pistes des sons de la frise le pose sous le
// pointeur. Lâché sur la page, il se pose aussi à la tête de lecture (un son n'a pas de place
// sur la page).

import type { PointerEvent as PointeurReact } from "react";
import { useEditeur } from "../etat/editeur";
import type { Ressource, RoleSon } from "../modele/types";
import { friseSons } from "./frise/Frise";
import { pointDansLaPage } from "./scene";

const SEUIL_PX = 5;

/** À brancher sur `onPointerDown` d'une ligne de son. `obtenir` donne la ressource (après un
 *  téléchargement, pour Freesound) ; `null` : rien à poser. */
export function glisserSon(evenement: PointeurReact<HTMLElement>, obtenir: () => Promise<Ressource | null>, options: { role?: RoleSon } = {}): void {
  if (evenement.button !== 0) return;
  // Un bouton dans la ligne (écouter) garde son clic.
  if ((evenement.target as HTMLElement).closest("[data-garder-clic]")) return;
  evenement.preventDefault();
  const depart = { x: evenement.clientX, y: evenement.clientY };
  const source = evenement.currentTarget;
  let fantome: HTMLElement | null = null;

  const bouger = (e: PointerEvent) => {
    if (!fantome && Math.hypot(e.clientX - depart.x, e.clientY - depart.y) < SEUIL_PX) return;
    if (!fantome) {
      fantome = source.cloneNode(true) as HTMLElement;
      const r = source.getBoundingClientRect();
      Object.assign(fantome.style, {
        position: "fixed",
        width: `${Math.min(r.width, 220)}px`,
        pointerEvents: "none",
        opacity: "0.9",
        zIndex: "100",
        transform: "translate(-50%, -50%) scale(0.95)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        background: "white",
        borderRadius: "10px",
      });
      document.body.appendChild(fantome);
      document.body.style.cursor = "grabbing";
    }
    fantome.style.left = `${e.clientX}px`;
    fantome.style.top = `${e.clientY}px`;
  };

  const lacher = async (e: PointerEvent) => {
    window.removeEventListener("pointermove", bouger);
    window.removeEventListener("pointerup", lacher as (e: PointerEvent) => void);
    const glisse = !!fantome;
    fantome?.remove();
    document.body.style.cursor = "";
    const cible = glisse ? friseSons.cible?.(e.clientX, e.clientY) ?? null : null;
    if (glisse && !cible && !pointDansLaPage(e.clientX, e.clientY)) return;
    try {
      const r = await obtenir();
      if (!r) return;
      useEditeur.getState().ajouterSon(r, { ...options, ...(cible ? { debut: cible.debut, piste: cible.piste } : {}) });
    } catch (erreur) {
      useEditeur.getState().notifier(`Son non posé : ${String(erreur)}`, { erreur: true });
    }
  };

  window.addEventListener("pointermove", bouger);
  window.addEventListener("pointerup", lacher as (e: PointerEvent) => void);
}
