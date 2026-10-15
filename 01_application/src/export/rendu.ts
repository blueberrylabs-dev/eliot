// Rendu d'une page hors écran, à sa taille native (règle 7), avec les mêmes composants que la
// zone de travail : export, miniature de l'accueil. Les images sont chargées avant le rendu.

import type Konva from "konva";
import { createElement, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Group, Layer, Stage } from "react-konva";
import { prechargerPage } from "../editeur/images";
import { PageStatique } from "../editeur/RenduElement";
import { useEditeur } from "../etat/editeur";
import { tempsMedia, visibleA } from "../modele/frise";
import type { Format, PageEliot } from "../modele/types";
import { imageVideo } from "../pont/tauri";

export interface OptionsRendu {
  pixelRatio: number;
  type: "image/png" | "image/jpeg";
  /** PNG seulement : le fond de la page n'est pas dessiné. */
  transparent?: boolean;
  qualite?: number;
  /** Page vidéo : l'instant montré, en ms (0 par défaut). */
  instant?: number;
}

/** Les images exactes des vidéos qui se voient à l'instant `instant` d'une page vidéo, tirées
 *  de leurs copies d'aperçu ; une vidéo dont l'image manque garde sa couverture. */
async function imagesDesVideos(page: PageEliot, instant: number): Promise<Map<string, CanvasImageSource>> {
  const etat = useEditeur.getState();
  const images = new Map<string, CanvasImageSource>();
  if (page.duree === undefined || !etat.projet) return images;
  const projet = etat.projet;
  await Promise.all(
    page.elements.map(async (e) => {
      if (e.type !== "video" || !visibleA(e, instant)) return;
      const ressource = etat.ressources[e.ressource];
      if (!ressource) return;
      try {
        const blob = await imageVideo(projet, ressource, tempsMedia(e, instant, ressource.video?.duree));
        images.set(e.id, await createImageBitmap(blob));
      } catch {
        // Couverture.
      }
    }),
  );
  return images;
}

function Rendu({ page, format, instant, imagesVideo, pret }: { page: PageEliot; format: Format; instant?: number; imagesVideo: Map<string, CanvasImageSource>; pret: (g: Konva.Group) => void }) {
  const groupe = useRef<Konva.Group>(null);
  useEffect(() => {
    if (groupe.current) pret(groupe.current);
  }, [pret]);
  return createElement(
    Stage,
    { width: 1, height: 1 },
    createElement(Layer, null, createElement(Group, { ref: groupe }, createElement(PageStatique, { page, format, instant, imagesVideo }))),
  );
}

export async function rendrePage(page: PageEliot, format: Format, options: OptionsRendu): Promise<Blob> {
  const instant = options.instant ?? 0;
  const [, imagesVideo] = await Promise.all([prechargerPage(page), imagesDesVideos(page, instant)]);
  const support = document.createElement("div");
  const racine = createRoot(support);
  try {
    const groupe = await new Promise<Konva.Group>((pret) => racine.render(createElement(Rendu, { page, format, instant, imagesVideo, pret })));
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
