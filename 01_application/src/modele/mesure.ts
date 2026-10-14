// Largeur d'un texte dans une police, mesurée par le canevas du navigateur (la même que Konva
// utilise pour dessiner). Sans navigateur (tests), une estimation.

import { pilePolice } from "../polices";
import { mesureEstimee, type Mesure } from "./graphiques";

let contexte: CanvasRenderingContext2D | null | undefined;

function ctx(): CanvasRenderingContext2D | null {
  if (contexte === undefined) {
    contexte = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  }
  return contexte;
}

/** Une mesure pour une police donnée. */
export function mesurePolice(police: string): Mesure {
  return (texte, taille, gras) => {
    const c = ctx();
    if (!c) return mesureEstimee(texte, taille, gras);
    c.font = `${gras ? "bold " : ""}${taille}px ${pilePolice(police)}`;
    return c.measureText(texte).width;
  };
}
