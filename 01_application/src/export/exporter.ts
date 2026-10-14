// Export : la page est rendue à sa taille native, quel que soit le zoom (règle 7), puis le
// noyau Rust écrit le fichier.

import { useEditeur } from "../etat/editeur";
import { scene } from "../editeur/scene";
import { ecrireExport, type FormatExport } from "../pont/tauri";

export interface OptionsExport {
  format: FormatExport;
  /** 1 ou 2 : multiplie la définition (une page de 1080 px donne 2160 px en x2). */
  ratio: number;
  /** PNG seulement : le fond de la page n'est pas dessiné. */
  transparent: boolean;
  /** Chemin choisi dans « Enregistrer sous » ; sinon le dossier par défaut. */
  chemin?: string;
}

export function nomDate(): string {
  const d = new Date();
  const deux = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}_${deux(d.getHours())}${deux(d.getMinutes())}${deux(d.getSeconds())}_eliot`;
}

/** Rend la page en octets PNG ou JPEG. La page est mise à l'échelle 1 le temps du rendu, qui
 *  est synchrone : l'écran ne voit jamais l'état intermédiaire. */
export async function rendrePage(options: Omit<OptionsExport, "chemin">): Promise<Uint8Array> {
  const groupe = scene.groupePage;
  if (!groupe) throw new Error("la page n'est pas prête");
  const { page } = useEditeur.getState().document;
  const fond = groupe.findOne(".fond-page");
  const position = groupe.position();
  const echelle = groupe.scale() ?? { x: 1, y: 1 };
  const transparent = options.transparent && options.format === "png";

  groupe.setAttrs({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
  if (transparent) fond?.visible(false);
  let promesse: Promise<unknown>;
  try {
    promesse = groupe.toBlob({
      x: 0,
      y: 0,
      width: page.largeur,
      height: page.hauteur,
      pixelRatio: options.ratio,
      mimeType: options.format === "png" ? "image/png" : "image/jpeg",
      quality: 0.92,
    });
  } finally {
    groupe.setAttrs({ x: position.x, y: position.y, scaleX: echelle.x, scaleY: echelle.y });
    fond?.visible(true);
  }
  const blob = await promesse;
  if (!(blob instanceof Blob)) throw new Error("le rendu est vide");
  return new Uint8Array(await blob.arrayBuffer());
}

export async function exporter(options: OptionsExport): Promise<string> {
  // Un texte en cours de saisie est validé avant le rendu.
  if (document.activeElement instanceof HTMLTextAreaElement) document.activeElement.blur();
  const octets = await rendrePage(options);
  return ecrireExport(octets, options.format, nomDate(), options.chemin);
}
