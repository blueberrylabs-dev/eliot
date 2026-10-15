// La lecture des vidéos dans la fenêtre (étape 4). Chaque élément vidéo a sa balise `<video>`,
// hors de la page HTML, qui joue la copie d'aperçu fabriquée par le noyau (jamais l'original,
// règle 5). Konva dessine l'image courante de la balise ; à chaque nouvelle image de la vidéo,
// le calque est redessiné (mesuré fluide par le banc du lot 0, page de 200 objets comprise).

import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { useEditeur } from "../etat/editeur";
import type { ElementVideo } from "../modele/types";
import { urlCopieVideo } from "../pont/tauri";

interface EtatLecture {
  /** Les éléments vidéo qui jouent, par identifiant. */
  enLecture: Record<string, true>;
  basculer: (id: string) => void;
  /** Arrête un élément, ou tous. */
  arreter: (id?: string) => void;
}

export const useLecture = create<EtatLecture>((set, get) => ({
  enLecture: {},
  basculer(id) {
    const enLecture = { ...get().enLecture };
    if (enLecture[id]) delete enLecture[id];
    else enLecture[id] = true;
    set({ enLecture });
  },
  arreter(id) {
    if (id === undefined) {
      if (Object.keys(get().enLecture).length) set({ enLecture: {} });
      return;
    }
    if (!get().enLecture[id]) return;
    const enLecture = { ...get().enLecture };
    delete enLecture[id];
    set({ enLecture });
  },
}));

// Changer de page ou de design arrête tout ce qui joue.
useEditeur.subscribe((s, avant) => {
  if (s.pageActive !== avant.pageActive || s.projet !== avant.projet) useLecture.getState().arreter();
});

/** Début et fin de la partie qui joue, en secondes du fichier. */
export function bornes(el: ElementVideo, dureeMs: number | undefined): { debut: number; fin: number } {
  const total = (dureeMs ?? Number.POSITIVE_INFINITY) / 1000;
  const debut = Math.max(0, Math.min((el.coupe?.debut ?? 0) / 1000, total));
  const fin = Math.max(debut, Math.min((el.coupe?.fin ?? Number.POSITIVE_INFINITY) / 1000, total));
  return { debut, fin };
}

type VideoAvecImages = HTMLVideoElement & {
  requestVideoFrameCallback?: (rappel: (maintenant: number, meta: { mediaTime: number }) => void) => number;
  cancelVideoFrameCallback?: (n: number) => void;
};

/**
 * La balise `<video>` d'un élément, prête à être dessinée (sa première image est arrivée), ou
 * `undefined` en attendant. `joue` : en lecture ; `son` : le volume de l'élément s'entend.
 * `noeud` : l'image Konva à redessiner à chaque image de la vidéo.
 */
export function useLecteurVideo(el: ElementVideo, joue: boolean, son: boolean, noeud: React.RefObject<Konva.Image | null>): HTMLVideoElement | undefined {
  const projet = useEditeur((s) => s.projet);
  const ressource = useEditeur((s) => s.ressources[el.ressource]);
  const balise = useRef<VideoAvecImages | null>(null);
  const [prete, setPrete] = useState<HTMLVideoElement | undefined>(undefined);
  const { debut, fin } = bornes(el, ressource?.video?.duree);
  const limites = useRef({ debut, fin });
  limites.current = { debut, fin };

  const redessiner = () => noeud.current?.getLayer()?.batchDraw();

  // La balise, créée une fois par élément et par fichier.
  useEffect(() => {
    if (!projet || !ressource?.video) return;
    let actif = true;
    const video = document.createElement("video") as VideoAvecImages;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    balise.current = video;
    const surDonnees = () => {
      if (!actif) return;
      setPrete(video);
      redessiner();
    };
    video.addEventListener("loadeddata", () => {
      video.currentTime = limites.current.debut;
      surDonnees();
    }, { once: true });
    video.addEventListener("seeked", redessiner);
    // Au bout du fichier (sans coupe de fin), on repart du début de la coupe.
    video.addEventListener("ended", () => {
      video.currentTime = limites.current.debut;
      if (!video.paused || video.dataset.joue === "1") void video.play().catch(() => undefined);
    });
    void urlCopieVideo(projet, ressource).then(
      (url) => {
        if (actif) video.src = url;
      },
      () => undefined,
    );
    return () => {
      actif = false;
      video.pause();
      video.removeAttribute("src");
      video.load();
      balise.current = null;
      setPrete(undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projet, ressource?.id, !!ressource?.video]);

  // Lecture, pause, vitesse, volume.
  useEffect(() => {
    const video = balise.current;
    if (!video || !prete) return;
    video.playbackRate = Math.max(0.25, Math.min(4, el.vitesse ?? 1));
    const volume = Math.max(0, Math.min(1, el.volume ?? 1));
    video.volume = volume;
    video.muted = !son || volume === 0;
    video.dataset.joue = joue ? "1" : "0";
    if (!joue) {
      video.pause();
      return;
    }
    if (video.currentTime < limites.current.debut || video.currentTime >= limites.current.fin - 0.02) video.currentTime = limites.current.debut;
    // Un moteur qui refuse le son sans geste de l'utilisateur joue quand même, sans le son.
    void video.play().catch((e: unknown) => {
      if ((e as { name?: string })?.name !== "NotAllowedError" || video.muted) return;
      video.muted = true;
      return video.play().catch(() => undefined);
    });
    // À chaque image : redessiner, et boucler sur la coupe sans jamais montrer une image qui
    // en sort (on repart au début dès que la suivante dépasserait la fin).
    let rappel = 0;
    let image = 0;
    const pas = video.playbackRate / (ressource?.video?.imagesParSeconde || 30);
    const suivante = (t: number) => {
      const { debut: d, fin: f } = limites.current;
      if (t >= f - 0.001) {
        video.currentTime = d;
        return;
      }
      redessiner();
      if (t + pas >= f - 0.001) video.currentTime = d;
    };
    if (video.requestVideoFrameCallback) {
      const boucle = (_: number, meta: { mediaTime: number }) => {
        suivante(meta.mediaTime);
        rappel = video.requestVideoFrameCallback!(boucle);
      };
      rappel = video.requestVideoFrameCallback(boucle);
    } else {
      const boucle = () => {
        suivante(video.currentTime);
        image = requestAnimationFrame(boucle);
      };
      image = requestAnimationFrame(boucle);
    }
    return () => {
      if (rappel) video.cancelVideoFrameCallback?.(rappel);
      if (image) cancelAnimationFrame(image);
      video.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prete, joue, son, el.vitesse, el.volume]);

  // À l'arrêt, une nouvelle coupe montre sa première image.
  useEffect(() => {
    const video = balise.current;
    if (!video || !prete || joue) return;
    if (Math.abs(video.currentTime - debut) > 0.01) video.currentTime = debut;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prete, debut]);

  return prete;
}

/** Durée lisible : « 0:07 », « 1:05 », « 1:02:03 ». */
export function dureeLisible(ms: number): string {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
