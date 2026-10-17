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
import { dansTauri, imageVideo } from "../pont/tauri";
import { reglagesDeRendu } from "../modele/labo";
import { retoucherFixe } from "../labo/retouche";
import { graineDuTemps } from "../labo/shader";

export interface OptionsRendu {
  pixelRatio: number;
  type: "image/png" | "image/jpeg";
  /** PNG seulement : le fond de la page n'est pas dessiné. */
  transparent?: boolean;
  qualite?: number;
  /** Page vidéo : l'instant montré, en ms (0 par défaut). */
  instant?: number;
  /** Page vidéo : sans les effets d'animation, la pose seule (miniatures : un titre qui entre
   *  en fondu au début se voit quand même). */
  sansEffets?: boolean;
}

/** Les images exactes des vidéos qui se voient à l'instant `instant` d'une page vidéo, tirées
 *  de leurs copies d'aperçu (retouchées par le labo) ; une vidéo dont l'image manque garde sa
 *  couverture. */
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
        const ms = tempsMedia(e, instant, ressource.video?.duree);
        // Un clip retouché (étape 5, lot 4) : le noyau rend l'image retouchée en entier ; dans
        // le navigateur, le shader la retouche ici (réglages d'un pixel seulement).
        const reglages = reglagesDeRendu(e.reglages, e.rognage);
        const bitmap = await createImageBitmap(await imageVideo(projet, ressource, ms, reglages));
        images.set(e.id, reglages && !dansTauri ? retoucherFixe(bitmap, reglages, graineDuTemps(ms)) : bitmap);
      } catch {
        // Couverture.
      }
    }),
  );
  return images;
}

function Rendu({ page, format, instant, imagesVideo, sansEffets, pret }: { page: PageEliot; format: Format; instant?: number; imagesVideo: Map<string, CanvasImageSource>; sansEffets?: boolean; pret: (g: Konva.Group) => void }) {
  const groupe = useRef<Konva.Group>(null);
  useEffect(() => {
    if (groupe.current) pret(groupe.current);
  }, [pret]);
  return createElement(
    Stage,
    { width: 1, height: 1 },
    createElement(Layer, null, createElement(Group, { ref: groupe }, createElement(PageStatique, { page, format, instant, imagesVideo, sansEffets }))),
  );
}

/** Monte la page hors écran, images chargées, et passe son groupe Konva à `faire`. */
async function avecRendu<T>(page: PageEliot, format: Format, options: { instant?: number; sansEffets?: boolean; transparent?: boolean }, faire: (groupe: Konva.Group) => Promise<T>): Promise<T> {
  const instant = options.instant ?? 0;
  const [, imagesVideo] = await Promise.all([prechargerPage(page), imagesDesVideos(page, instant)]);
  const support = document.createElement("div");
  const racine = createRoot(support);
  try {
    const groupe = await new Promise<Konva.Group>((pret) => racine.render(createElement(Rendu, { page, format, instant, imagesVideo, sansEffets: options.sansEffets, pret })));
    // Une image laisse au moteur le temps de finir ses décodages en cours.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    if (options.transparent) groupe.findOne(".fond-page")?.visible(false);
    return await faire(groupe);
  } finally {
    racine.unmount();
  }
}

export async function rendrePage(page: PageEliot, format: Format, options: OptionsRendu): Promise<Blob> {
  return avecRendu(page, format, { instant: options.instant, sansEffets: options.sansEffets, transparent: options.transparent && options.type === "image/png" }, async (groupe) => {
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
  });
}

export interface DemandeZone {
  page: PageEliot;
  /** La zone, en pixels de la page. */
  zone: { x: number; y: number; largeur: number; hauteur: number };
  pixelRatio: number;
  /** Page vidéo : l'instant montré, en ms. */
  instant?: number;
  /** Sans le fond de la page (transparent). */
  transparent?: boolean;
}

/** Plusieurs pages, chacune dans son groupe, montées ensemble hors écran. */
function RenduMultiple({ format, demandes, sansEffets, pret }: { format: Format; demandes: (DemandeZone & { imagesVideo: Map<string, CanvasImageSource> })[]; sansEffets?: boolean; pret: (g: Konva.Group[]) => void }) {
  const groupes = useRef<Konva.Group[]>([]);
  useEffect(() => {
    pret(groupes.current);
  }, [pret]);
  return createElement(
    Stage,
    { width: 1, height: 1 },
    createElement(
      Layer,
      null,
      demandes.map((d, i) =>
        createElement(
          Group,
          {
            key: i,
            ref: (g: Konva.Group | null) => {
              if (g) groupes.current[i] = g;
            },
          },
          createElement(PageStatique, { page: d.page, format, instant: d.instant, imagesVideo: d.imagesVideo, sansEffets }),
        ),
      ),
    ),
  );
}

/** Ce qui demande au moteur de finir un décodage avant d'être dessiné (photos, vidéos, dessins
 *  en SVG) ; des textes et des formes se dessinent tout de suite. */
const aDesImages = (page: PageEliot) => page.elements.some((e) => !["texte", "forme", "qr", "tableau", "graphique", "dessin"].includes(e.type));

/**
 * Les pixels de zones de pages, rendues hors écran : pour mesurer ce qui s'y voit (les alertes
 * de lisibilité, étape 7, lot 3). Toutes les demandes se montent d'un coup (un seul montage,
 * une seule attente d'image) : chacun de ces temps coûte cher dans WebKitGTK. `source` : la
 * page d'où viennent les demandes, dont les images et celles des vidéos se chargent une fois
 * par instant.
 */
export async function rendreZones(format: Format, source: PageEliot, demandes: DemandeZone[], options: { sansEffets?: boolean } = {}): Promise<ImageData[]> {
  if (demandes.length === 0) return [];
  const parInstant = new Map<number, Promise<Map<string, CanvasImageSource>>>();
  const images = (instant: number) => {
    if (!parInstant.has(instant)) parInstant.set(instant, imagesDesVideos(source, instant));
    return parInstant.get(instant)!;
  };
  await prechargerPage(source);
  const prets = await Promise.all(demandes.map(async (d) => ({ ...d, imagesVideo: await images(d.instant ?? 0) })));
  const support = document.createElement("div");
  const racine = createRoot(support);
  try {
    const groupes = await new Promise<Konva.Group[]>((pret) => racine.render(createElement(RenduMultiple, { format, demandes: prets, sansEffets: options.sansEffets, pret })));
    if (prets.some((d) => aDesImages(d.page))) await new Promise((r) => requestAnimationFrame(() => r(null)));
    return groupes.map((g, i) => {
      const d = prets[i];
      if (d.transparent) g.findOne(".fond-page")?.visible(false);
      const toile = g.toCanvas({ x: d.zone.x, y: d.zone.y, width: d.zone.largeur, height: d.zone.hauteur, pixelRatio: d.pixelRatio });
      const ctx = toile.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("le rendu est vide");
      return ctx.getImageData(0, 0, toile.width, toile.height);
    });
  } finally {
    racine.unmount();
  }
}
