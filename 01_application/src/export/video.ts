// L'export d'une page vidéo en MP4 ou en GIF (étape 4, lot 4) : la page est décrite en calques
// (`calques.ts`), le noyau fait le film avec les réglages de la plateforme choisie
// (`plateformes.ts`). Un objet 3D qui bouge (étape 6, lot 5) : la fenêtre le rend d'abord image
// par image, à la taille du film (la 3D est en WebGL, que le noyau n'a pas), et range ses images
// pour le noyau, qui les pose comme le reste.

import { create } from "zustand";
import { pageCourante, useEditeur } from "../etat/editeur";
import { agrandissementMax } from "../modele/animation";
import { cameraA, objetsQuiBougent, rangsDuClip } from "../modele/mouvement3d";
import type { Format, PageEliot } from "../modele/types";
import { annulerFilm, ecrireImageFilm3d, exporterFilm, oublierFilm3d, type AvancementFilm, type ReglagesFilm, type ResultatFilm } from "../pont/tauri";
import { COTE_MAX_RENDU, oublierRendu, prechargerModeles, reglagesDe, rendreObjet } from "../trois/moteur";
import { decrirePage } from "./calques";
import { nomDate } from "./exporter";
import { reglagesFilm, type OptionsFilm } from "./plateformes";

export * from "./plateformes";

// ---- Suivi ----

interface EtatExportVideo {
  /** `null` : rien en cours. */
  enCours: { format: "mp4" | "gif"; avancement: AvancementFilm | null; annulation: boolean } | null;
}

export const useExportVideo = create<EtatExportVideo>(() => ({ enCours: null }));

export function annulerExportVideo(): void {
  const e = useExportVideo.getState().enCours;
  if (!e) return;
  useExportVideo.setState({ enCours: { ...e, annulation: true } });
  void annulerFilm();
}

/**
 * Rend chaque image des objets 3D qui bougent, à la taille où le film les montre (celle du film,
 * fois leur agrandissement le plus fort), et les range pour le noyau (`film`). `suivi` reçoit la
 * part faite ; `annule` dit si l'on a annulé. Renvoie le nombre d'images et la durée (ms).
 */
export async function rendreImages3d(page: PageEliot, format: Format, reglages: Pick<ReglagesFilm, "largeur" | "hauteur" | "imagesParSeconde">, film: string, suivi: (fait: number, total: number) => void, annule: () => boolean): Promise<{ images: number; duree: number }> {
  const debut = performance.now();
  const objets = objetsQuiBougent(page);
  await prechargerModeles(page);
  const ressources = useEditeur.getState().ressources;
  const echelle = Math.max(reglages.largeur / format.largeur, reglages.hauteur / format.hauteur);
  const plages = objets.map((el) => rangsDuClip(el, reglages.imagesParSeconde));
  const total = plages.reduce((n, p) => n + p.dernier - p.premier + 1, 0);
  let fait = 0;
  for (const [i, el] of objets.entries()) {
    const ressource = ressources[el.ressource];
    if (!ressource) continue;
    const k = Math.min(echelle * agrandissementMax(el), COTE_MAX_RENDU / Math.max(el.largeur, el.hauteur));
    const [l, h] = [Math.max(1, Math.round(el.largeur * k)), Math.max(1, Math.round(el.hauteur * k))];
    const cle = `${el.id}#film`;
    try {
      for (let rang = plages[i].premier; rang <= plages[i].dernier; rang++) {
        if (annule()) throw new Error("export annulé");
        const tr = (rang * 1000) / reglages.imagesParSeconde - el.temps!.debut;
        const rendu = rendreObjet(ressource, reglagesDe(el, cameraA(el, tr), undefined, tr), l, h, cle);
        if (rendu.etat !== "pret") throw new Error(rendu.etat === "erreur" ? `objet 3D « ${el.nom ?? el.id} » : ${rendu.erreur}` : `objet 3D « ${el.nom ?? el.id} » pas encore chargé`);
        const blob = await new Promise<Blob | null>((ok) => rendu.toile.toBlob(ok, "image/png"));
        if (!blob) throw new Error("image d'un objet 3D impossible");
        await ecrireImageFilm3d(film, el.id, rang, new Uint8Array(await blob.arrayBuffer()));
        suivi(++fait, total);
      }
    } finally {
      oublierRendu(cle);
    }
  }
  return { images: total, duree: performance.now() - debut };
}

/** Exporte la page affichée (page vidéo) et renvoie ce qui a été écrit (le film, la version
 *  sans musique, le niveau final du son). */
export async function exporterVideo(o: OptionsFilm): Promise<ResultatFilm & { images3d?: { images: number; duree: number } }> {
  if (document.activeElement instanceof HTMLTextAreaElement) document.activeElement.blur();
  if (useExportVideo.getState().enCours) throw new Error("un export vidéo est déjà en cours");
  const etat = useEditeur.getState();
  const page = pageCourante(etat);
  if (page.duree === undefined) throw new Error("cette page n'est pas une vidéo : passe-la en Vidéo (barre du haut) pour l'exporter en film");
  if (!etat.projet) throw new Error("aucun design ouvert");
  useExportVideo.setState({ enCours: { format: o.format, avancement: null, annulation: false } });
  const reglages = reglagesFilm(o, etat.document.format);
  const objets = objetsQuiBougent(page);
  const film = objets.length ? `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}` : undefined;
  const annule = () => !!useExportVideo.getState().enCours?.annulation;
  try {
    // Les objets 3D qui bougent : leurs images d'abord, rendues par la fenêtre.
    let images3d: { images: number; duree: number } | undefined;
    if (film) {
      images3d = await rendreImages3d(page, etat.document.format, reglages, film, (fait, total) => {
        const e = useExportVideo.getState().enCours;
        if (e) useExportVideo.setState({ enCours: { ...e, avancement: { etape: "objets3d", image: fait, images: total, part: fait / Math.max(1, total) } } });
      }, annule);
    }
    const description = await decrirePage(page, etat.document.format, undefined, film ? new Set(objets.map((x) => x.id)) : undefined);
    // Annulé pendant la préparation : le noyau n'a encore rien commencé.
    if (annule()) throw new Error("export annulé");
    const resultat = await exporterFilm(etat.projet, { ...description, ...(film ? { film3d: film } : {}) }, reglages, nomDate(), o.chemin, (a) => {
      const e = useExportVideo.getState().enCours;
      if (e) useExportVideo.setState({ enCours: { ...e, avancement: a } });
      // Annulé juste avant que le noyau ne commence (il remet sa marque à zéro en partant) : on
      // le lui redit dès son premier signe.
      if (e?.annulation) void annulerFilm();
    });
    return images3d ? { ...resultat, images3d: { images: images3d.images, duree: Math.round(images3d.duree) } } : resultat;
  } finally {
    useExportVideo.setState({ enCours: null });
    if (film) void oublierFilm3d(film).catch(() => undefined);
  }
}
