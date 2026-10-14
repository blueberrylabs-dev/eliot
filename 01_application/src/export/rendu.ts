// Rendu d'une page hors écran, à sa taille native (règle 7), avec les mêmes composants que la
// zone de travail : export, miniature de l'accueil. Les images sont chargées avant le rendu.

import type Konva from "konva";
import { createElement, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Group, Layer, Stage } from "react-konva";
import { prechargerPage } from "../editeur/images";
import { PageStatique } from "../editeur/RenduElement";
import type { Format, PageEliot } from "../modele/types";

export interface OptionsRendu {
  pixelRatio: number;
  type: "image/png" | "image/jpeg";
  /** PNG seulement : le fond de la page n'est pas dessiné. */
  transparent?: boolean;
  qualite?: number;
}

function Rendu({ page, format, pret }: { page: PageEliot; format: Format; pret: (g: Konva.Group) => void }) {
  const groupe = useRef<Konva.Group>(null);
  useEffect(() => {
    if (groupe.current) pret(groupe.current);
  }, [pret]);
  return createElement(
    Stage,
    { width: 1, height: 1 },
    createElement(Layer, null, createElement(Group, { ref: groupe }, createElement(PageStatique, { page, format }))),
  );
}

export async function rendrePage(page: PageEliot, format: Format, options: OptionsRendu): Promise<Blob> {
  await prechargerPage(page);
  const support = document.createElement("div");
  const racine = createRoot(support);
  try {
    const groupe = await new Promise<Konva.Group>((pret) => racine.render(createElement(Rendu, { page, format, pret })));
    // Une image laisse au moteur le temps de finir ses décodages en cours.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const fond = groupe.findOne(".fond-page");
    if (options.transparent && options.type === "image/png") fond?.visible(false);
    const blob = await groupe.toBlob({
      x: 0,
      y: 0,
      width: format.largeur,
      height: format.hauteur,
      pixelRatio: options.pixelRatio,
      mimeType: options.type,
      quality: options.qualite ?? 0.92,
    });
    if (!(blob instanceof Blob)) throw new Error("le rendu est vide");
    return blob;
  } finally {
    racine.unmount();
  }
}
