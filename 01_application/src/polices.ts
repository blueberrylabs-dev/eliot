// Polices embarquées dans l'application (licence SIL OFL 1.1, paquets @fontsource) : le même
// texte se compose de la même façon sur toutes les machines, et l'export aussi.

import "@fontsource/inter/400.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/400-italic.css";
import "@fontsource/inter/700-italic.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/400-italic.css";
import "@fontsource/montserrat/700-italic.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/700.css";
import "@fontsource/poppins/400-italic.css";
import "@fontsource/poppins/700-italic.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/playfair-display/400-italic.css";
import "@fontsource/playfair-display/700-italic.css";
import "@fontsource/lora/400.css";
import "@fontsource/lora/700.css";
import "@fontsource/lora/400-italic.css";
import "@fontsource/lora/700-italic.css";
import "@fontsource/oswald/400.css";
import "@fontsource/oswald/700.css";
import "@fontsource/bebas-neue/400.css";
import "@fontsource/dancing-script/400.css";
import "@fontsource/dancing-script/700.css";

export interface Police {
  famille: string;
  /** Pour apprendre : à quoi elle sert le mieux. */
  usage: string;
  gras: boolean;
  italique: boolean;
}

export const POLICES: Police[] = [
  { famille: "Inter", usage: "texte courant, interface", gras: true, italique: true },
  { famille: "Montserrat", usage: "titres modernes", gras: true, italique: true },
  { famille: "Poppins", usage: "titres ronds et amicaux", gras: true, italique: true },
  { famille: "Playfair Display", usage: "titres élégants, luxe", gras: true, italique: true },
  { famille: "Lora", usage: "texte long, ton éditorial", gras: true, italique: true },
  { famille: "Oswald", usage: "accroches serrées, sport", gras: true, italique: false },
  { famille: "Bebas Neue", usage: "gros titres en capitales", gras: false, italique: false },
  { famille: "Dancing Script", usage: "touche manuscrite", gras: true, italique: false },
];

export const POLICE_PAR_DEFAUT = "Inter";

/** Chaîne `font-family` utilisable par le navigateur et par Konva. */
export const pilePolice = (famille: string) => `"${famille}", Inter, sans-serif`;

/**
 * Charge toutes les variantes avant le premier dessin : sinon Konva mesure le texte avec une
 * police de secours et les retours à la ligne tombent faux.
 */
export async function chargerPolices(): Promise<void> {
  const demandes: Promise<unknown>[] = [];
  for (const p of POLICES) {
    const variantes = ["normal 400", ...(p.gras ? ["normal 700"] : []), ...(p.italique ? ["italic 400"] : []), ...(p.italique && p.gras ? ["italic 700"] : [])];
    for (const v of variantes) demandes.push(document.fonts.load(`${v} 32px "${p.famille}"`));
  }
  await Promise.allSettled(demandes);
}
