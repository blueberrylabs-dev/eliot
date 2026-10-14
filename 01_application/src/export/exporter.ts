// Export : chaque page est rendue hors écran à sa taille native, quel que soit le zoom
// (règle 7), puis le noyau Rust écrit le fichier.

import { pageCourante, useEditeur } from "../etat/editeur";
import { ecrireExport, type FormatExport } from "../pont/tauri";
import { rendrePage } from "./rendu";

export interface OptionsExport {
  format: FormatExport;
  /** 1 ou 2 : multiplie la définition (une page de 1080 px donne 2160 px en x2). */
  ratio: number;
  /** PNG seulement : le fond de la page n'est pas dessiné. */
  transparent: boolean;
  /** La page affichée, ou toutes les pages (une image par page, numérotées). */
  pages: "courante" | "toutes";
  /** Chemin choisi dans « Enregistrer sous » (page affichée seulement). */
  chemin?: string;
}

const deux = (n: number) => String(n).padStart(2, "0");

/** `AAAA-MM-JJ_HHMMSS_eliot` (BRIEF § 6, export de bout en bout). */
export function nomDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}_${deux(d.getHours())}${deux(d.getMinutes())}${deux(d.getSeconds())}_eliot`;
}

/** Exporte et renvoie les chemins écrits (un par page). */
export async function exporter(options: OptionsExport, progression?: (fait: number, total: number) => void): Promise<string[]> {
  // Un texte en cours de saisie est validé avant le rendu.
  if (document.activeElement instanceof HTMLTextAreaElement) document.activeElement.blur();
  const etat = useEditeur.getState();
  const { document: doc } = etat;
  const pages = options.pages === "toutes" ? doc.pages : [pageCourante(etat)];
  const base = nomDate();
  const ecrits: string[] = [];
  for (const [rang, page] of pages.entries()) {
    progression?.(rang, pages.length);
    const blob = await rendrePage(page, doc.format, {
      pixelRatio: options.ratio,
      type: options.format === "png" ? "image/png" : "image/jpeg",
      transparent: options.transparent,
    });
    const octets = new Uint8Array(await blob.arrayBuffer());
    const nom = pages.length > 1 ? `${base}_page-${deux(rang + 1)}` : base;
    ecrits.push(await ecrireExport(octets, options.format, nom, pages.length === 1 ? options.chemin : undefined));
  }
  progression?.(pages.length, pages.length);
  return ecrits;
}
