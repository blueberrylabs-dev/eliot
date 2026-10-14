// Glisser un objet d'un panneau vers la page, comme dans Canva : un clic le pose au centre,
// un glisser le pose sous le pointeur. Fait à la main, avec les événements du pointeur, pour
// ne pas dépendre du glisser-déposer HTML, que l'enveloppe peut intercepter.

import type { PointerEvent as PointeurReact } from "react";
import { useEditeur } from "../etat/editeur";
import { boiteDe } from "../modele/geometrie";
import type { ElementPage, Format } from "../modele/types";
import { pointDansLaPage } from "./scene";

const SEUIL_PX = 5;

/** Déplace des éléments pour que le centre de leur ensemble tombe sur `point`. */
export function centrerSur(elements: ElementPage[], point: { x: number; y: number }): ElementPage[] {
  const b = boiteDe(elements);
  const dx = point.x - (b.x + b.largeur / 2);
  const dy = point.y - (b.y + b.hauteur / 2);
  return elements.map((e) => ({ ...e, x: Math.round(e.x + dx), y: Math.round(e.y + dy) }));
}

/**
 * À brancher sur `onPointerDown` d'un bouton de panneau. `fabriquer` crée les éléments au
 * centre de la page ; `vignette` est le nœud montré sous le pointeur pendant le glisser.
 */
export function glisserDepuisPanneau(evenement: PointeurReact<HTMLElement>, fabriquer: (format: Format) => ElementPage[]): void {
  if (evenement.button !== 0) return;
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
        width: `${Math.min(r.width, 160)}px`,
        pointerEvents: "none",
        opacity: "0.85",
        zIndex: "100",
        transform: "translate(-50%, -50%) scale(0.9)",
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

  const lacher = (e: PointerEvent) => {
    window.removeEventListener("pointermove", bouger);
    window.removeEventListener("pointerup", lacher);
    const glisse = !!fantome;
    fantome?.remove();
    document.body.style.cursor = "";
    const etat = useEditeur.getState();
    const elements = fabriquer(etat.document.format);
    if (elements.length === 0) return;
    if (!glisse) {
      etat.ajouterElements(elements);
      return;
    }
    const point = pointDansLaPage(e.clientX, e.clientY);
    if (point) etat.ajouterElements(centrerSur(elements, point));
  };

  window.addEventListener("pointermove", bouger);
  window.addEventListener("pointerup", lacher);
}
