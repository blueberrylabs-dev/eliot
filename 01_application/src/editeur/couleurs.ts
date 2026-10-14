// Une couleur du document (unie ou dégradé) traduite pour Konva ou pour une pastille CSS.

import type { Couleur, Degrade } from "../modele/types";

const arrets = (d: Degrade) => [...d.arrets].sort((a, b) => a.position - b.position).flatMap((a) => [a.position, a.couleur]);

/**
 * Propriétés de remplissage Konva pour une forme de `largeur` × `hauteur`. `origine` est la
 * position du coin haut gauche de la boîte dans le repère de la forme (une ellipse Konva a son
 * repère au centre).
 */
export function remplissageKonva(couleur: Couleur, largeur: number, hauteur: number, origine = { x: 0, y: 0 }): Record<string, unknown> {
  if (typeof couleur === "string") return { fill: couleur, fillPriority: "color" };
  const cx = origine.x + largeur / 2;
  const cy = origine.y + hauteur / 2;
  if (couleur.type === "radial") {
    return {
      fillPriority: "radial-gradient",
      fillRadialGradientStartPoint: { x: cx, y: cy },
      fillRadialGradientStartRadius: 0,
      fillRadialGradientEndPoint: { x: cx, y: cy },
      fillRadialGradientEndRadius: Math.hypot(largeur, hauteur) / 2,
      fillRadialGradientColorStops: arrets(couleur),
    };
  }
  // Comme en CSS : la ligne du dégradé passe par le centre et touche les coins opposés.
  const a = (couleur.angle * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const demi = (Math.abs(largeur * dx) + Math.abs(hauteur * dy)) / 2;
  return {
    fillPriority: "linear-gradient",
    fillLinearGradientStartPoint: { x: cx - dx * demi, y: cy - dy * demi },
    fillLinearGradientEndPoint: { x: cx + dx * demi, y: cy + dy * demi },
    fillLinearGradientColorStops: arrets(couleur),
  };
}

/** Valeur CSS `background` pour une pastille ou un aperçu. */
export function cssDeCouleur(couleur: Couleur): string {
  if (typeof couleur === "string") return couleur;
  const liste = [...couleur.arrets].sort((a, b) => a.position - b.position).map((a) => `${a.couleur} ${Math.round(a.position * 100)}%`).join(", ");
  // En CSS, 0° pointe vers le haut ; dans Eliot, 0° va de gauche à droite.
  return couleur.type === "radial" ? `radial-gradient(circle, ${liste})` : `linear-gradient(${couleur.angle + 90}deg, ${liste})`;
}

export const memeCouleur = (a: Couleur, b: Couleur) => JSON.stringify(a).toLowerCase() === JSON.stringify(b).toLowerCase();
