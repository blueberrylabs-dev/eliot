// La lecture des vidéos dans la fenêtre (étape 4). Une balise `<video>`, hors de la page HTML,
// joue la copie d'aperçu fabriquée par le noyau (jamais l'original, règle 5). Konva dessine
// l'image courante de la balise ; à chaque nouvelle image de la vidéo, le calque est redessiné
// (mesuré fluide par le banc du lot 0, page de 200 objets comprise).
//
// Sur une page fixe, chaque élément vidéo a sa balise. Sur une page vidéo (lot 7), une seule
// balise par fichier, conduite par le clip de ce fichier que la tête montre (ou montrera dans
// moins de 3 s) : les morceaux d'une vidéo coupée se suivent dans la même balise, qui saute
// d'une coupe à l'autre sans s'arrêter. Mesuré dans WebKitGTK : deux balises qui lisent la même
// copie en même temps échouent (erreur « source non prise en charge »), et une balise qu'on
// relance met jusqu'à 0,3 s à repartir.

import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { pageCourante, useEditeur } from "../etat/editeur";
import { contextesTransitions, gainSon } from "../modele/animation";
import { useTemps } from "../etat/temps";
import { estPageVideo, tempsMedia, visibleA } from "../modele/frise";
import type { ElementVideo, RefRessources, Ressource } from "../modele/types";
import { urlCopie, urlCopieNeuve } from "../pont/tauri";

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

// ---- Page vidéo : une balise par fichier ----

/** Un clip qui commence dans moins de 3 s prend déjà la balise : elle a le temps de charger et
 *  de se placer sur sa première image. */
export const AVANCE_BALISE = 3000;

interface Partagee {
  video: VideoAvecImages;
  prete: boolean;
  /** Le clip qui la conduit. */
  proprietaire: string | null;
  /** Ce qu'il faut redessiner à chaque image (les images Konva du clip). */
  dessins: Set<() => void>;
  /** Une recherche demandée pendant qu'une autre se fait. */
  attente: number | null;
  /** Quand la recherche en cours a commencé (0 : aucune) ; le dernier instant du fichier vu
   *  avancer pendant la lecture, et quand. */
  recherche: number;
  progres: { ct: number; quand: number };
  /** Rend l'adresse de la copie. */
  liberer: () => void;
  rappel: number;
  image: number;
}

const partagees = new Map<string, Partagee>();
/** Les balises refaites après un échec, par fichier : au-delà de trois, on attend 10 s. */
const essais = new Map<string, { n: number; quand: number }>();
const ESSAIS_MAX = 3;
const OUBLI_ESSAIS = 10_000;
/** Une balise qui n'a toujours rien chargé au bout de 4 s est refaite ; de même, une recherche
 *  qui dure plus de 1,5 s, ou une lecture dont l'image n'avance plus depuis 1,5 s. */
const ATTENTE_BALISE = 4000;
const BLOCAGE = 1500;

/** Qui conduit chaque balise, et si elle est prête : les composants se redessinent quand ça
 *  change. */
const useBalises = create<{ etats: Record<string, { proprietaire: string | null; prete: boolean }> }>(() => ({ etats: {} }));

const cleBalise = (projet: RefRessources, ressource: string) => `${projet.rayon}/${projet.id}/${ressource}`;

function annoncer(cle: string, proprietaire: string | null, prete: boolean) {
  const e = useBalises.getState().etats[cle];
  if (e?.proprietaire === proprietaire && e.prete === prete) return;
  useBalises.setState((s) => ({ etats: { ...s.etats, [cle]: { proprietaire, prete } } }));
}

function dessiner(b: Partagee) {
  for (const d of b.dessins) d();
}

/** Le clip qui conduit la balise d'un fichier : celui que la tête montre, sinon le prochain
 *  qui commence dans moins de 3 s. */
export function proprietaire(clips: readonly ElementVideo[], tete: number): ElementVideo | null {
  const visible = clips.find((e) => visibleA(e, tete));
  if (visible) return visible;
  const prochains = clips.filter((e) => e.temps!.debut > tete && e.temps!.debut - tete <= AVANCE_BALISE).sort((a, b) => a.temps!.debut - b.temps!.debut);
  return prochains[0] ?? null;
}

function creerPartagee(cle: string, projet: RefRessources, ressource: Ressource): Partagee {
  const video = document.createElement("video") as VideoAvecImages;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  const b: Partagee = { video, prete: false, proprietaire: null, dessins: new Set(), attente: null, recherche: 0, progres: { ct: 0, quand: 0 }, liberer: () => undefined, rappel: 0, image: 0 };
  // Mesuré dans WebKitGTK : une balise qui vient de naître échoue parfois à lire sa copie
  // (erreur, ou rien pendant des secondes) ; elle est alors refaite, trois fois au plus.
  const echec = () => {
    clearTimeout(garde);
    if (partagees.get(cle) === b) refaire(cle);
  };
  const garde = setTimeout(() => !b.prete && echec(), ATTENTE_BALISE);
  video.addEventListener("error", echec);
  video.addEventListener(
    "loadeddata",
    () => {
      clearTimeout(garde);
      if (partagees.get(cle) !== b) return;
      b.prete = true;
      essais.delete(cle);
      regler();
      dessiner(b);
    },
    { once: true },
  );
  video.addEventListener("seeked", () => {
    b.recherche = 0;
    dessiner(b);
    if (b.attente === null) return;
    const s = b.attente;
    b.attente = null;
    chercher(b, s);
  });
  // Une image peinte à chaque image de la vidéo pendant qu'elle joue.
  const peindre = () => {
    dessiner(b);
    if (video.paused) return;
    if (video.requestVideoFrameCallback) b.rappel = video.requestVideoFrameCallback(peindre);
    else b.image = requestAnimationFrame(peindre);
  };
  video.addEventListener("play", peindre);
  partagees.set(cle, b);
  void urlCopieNeuve(projet, ressource).then(
    (a) => {
      if (partagees.get(cle) !== b) return a.liberer();
      b.liberer = a.liberer;
      video.src = a.url;
    },
    () => undefined,
  );
  return b;
}

function libererPartagee(cle: string) {
  const b = partagees.get(cle);
  if (!b) return;
  partagees.delete(cle);
  if (b.rappel) b.video.cancelVideoFrameCallback?.(b.rappel);
  if (b.image) cancelAnimationFrame(b.image);
  b.video.pause();
  b.video.removeAttribute("src");
  b.video.load();
  b.liberer();
  annoncer(cle, null, false);
}

/** Refait la balise d'un fichier (échec, recherche ou lecture bloquée). */
function refaire(cle: string) {
  essais.set(cle, { n: (essais.get(cle)?.n ?? 0) + 1, quand: performance.now() });
  libererPartagee(cle);
  setTimeout(reglerBientot, 200);
}

function chercher(b: Partagee, s: number) {
  if (b.video.seeking) {
    b.attente = s;
    return;
  }
  if (Math.abs(b.video.currentTime - s) <= 0.002) return;
  b.recherche = performance.now();
  b.video.currentTime = s;
}

/**
 * Règle les balises de la page vidéo affichée sur la tête de lecture : qui conduit chacune,
 * lecture ou pause, l'instant du fichier (recalé si elle s'écarte de plus d'un quart de
 * seconde), la vitesse et le volume du clip (ses fondus, ceux d'une transition). Une balise que
 * plus aucun clip ne demande est rendue.
 */
function regler() {
  // Aucun clip vidéo affiché ni balise en cours : rien à faire (la tête bouge à chaque image).
  if (abonnes.size === 0 && partagees.size === 0) return;
  const editeur = useEditeur.getState();
  const projet = editeur.projet;
  const page = pageCourante(editeur);
  const temps = useTemps.getState();
  const demandees = new Set<string>();
  if (projet && estPageVideo(page)) {
    const parFichier = new Map<string, ElementVideo[]>();
    for (const e of page.elements) {
      if (e.type !== "video" || !e.temps || !e.visible || !editeur.ressources[e.ressource]?.video) continue;
      parFichier.set(e.ressource, [...(parFichier.get(e.ressource) ?? []), e]);
    }
    for (const [ressource, clips] of parFichier) {
      if (!abonnes.has(ressource)) continue;
      const e = proprietaire(clips, temps.tete);
      if (!e) continue;
      const cle = cleBalise(projet, ressource);
      demandees.add(cle);
      const r = editeur.ressources[ressource]!;
      const essai = essais.get(cle);
      if (essai && performance.now() - essai.quand > OUBLI_ESSAIS) essais.delete(cle);
      if (!partagees.has(cle) && (essais.get(cle)?.n ?? 0) > ESSAIS_MAX) continue;
      const b = partagees.get(cle) ?? creerPartagee(cle, projet, r);
      b.proprietaire = e.id;
      annoncer(cle, e.id, b.prete);
      if (!b.prete) continue;
      const v = b.video;
      const visible = visibleA(e, temps.tete);
      // Une recherche qui ne finit pas, ou une lecture dont l'image n'avance plus : la balise
      // est refaite (mesuré dans WebKitGTK, rarement).
      const maintenant = performance.now();
      const enLecture = temps.joue && visible && !v.paused;
      if (!enLecture || v.currentTime !== b.progres.ct) b.progres = { ct: v.currentTime, quand: maintenant };
      if ((b.recherche && maintenant - b.recherche > BLOCAGE) || (enLecture && maintenant - b.progres.quand > BLOCAGE)) {
        refaire(cle);
        continue;
      }
      const cible = tempsMedia(e, temps.tete, r.video!.duree) / 1000;
      v.playbackRate = Math.max(0.25, Math.min(4, e.vitesse ?? 1));
      // Le volume de l'instant : celui du clip, ses fondus, ceux d'une transition.
      const transitions = contextesTransitions(page).get(e.id);
      v.volume = gainSon(e, temps.tete, { transitionEntree: transitions?.entree, transitionSortie: transitions?.sortie });
      // Pendant une prise de voix « son coupé », le montage se tait (le micro ne l'entend pas).
      v.muted = (e.volume ?? 1) === 0 || !!temps.prise?.muet;
      if (temps.joue && visible) {
        if (v.paused) {
          chercher(b, cible);
          void v.play().catch((err: unknown) => {
            if ((err as { name?: string })?.name !== "NotAllowedError" || v.muted) return;
            v.muted = true;
            return v.play().catch(() => undefined);
          });
        } else if (Math.abs(v.currentTime - cible) > 0.25) chercher(b, cible);
        continue;
      }
      if (!v.paused) v.pause();
      // À l'arrêt, l'image de l'instant ; juste avant son entrée, la première image du clip.
      chercher(b, visible ? cible : (e.coupe?.debut ?? 0) / 1000);
    }
  }
  for (const cle of [...partagees.keys()]) if (!demandees.has(cle)) libererPartagee(cle);
}

/** Les fichiers dont un clip est affiché (ou dessiné dans l'aperçu), avec leur nombre. */
const abonnes = new Map<string, number>();
let reglageDemande = false;
const reglerBientot = () => {
  if (reglageDemande) return;
  reglageDemande = true;
  queueMicrotask(() => {
    reglageDemande = false;
    regler();
  });
};
useTemps.subscribe(regler);
useEditeur.subscribe((s, avant) => {
  if (s.document !== avant.document || s.pageActive !== avant.pageActive || s.projet !== avant.projet || s.ressources !== avant.ressources) reglerBientot();
});

/** Pour les essais : les balises partagées, le clip qui conduit chacune, l'instant du fichier. */
export const balisesPartagees = () => [...partagees.entries()].map(([cle, b]) => ({ cle, proprietaire: b.proprietaire, prete: b.prete, instant: b.video.currentTime, pause: b.video.paused }));

/** La balise partagée d'un clip d'une page vidéo, quand c'est lui qui la conduit et qu'elle est
 *  prête ; `inutile` : rendu figé, rien n'est demandé. */
function useBalisePartagee(el: ElementVideo, noeud: React.RefObject<Konva.Image | null>, inutile: boolean): HTMLVideoElement | undefined {
  const cle = useEditeur((s) => (inutile || !s.projet ? null : cleBalise(s.projet, el.ressource)));
  const mienne = useBalises((s) => (cle ? s.etats[cle]?.proprietaire === el.id && s.etats[cle].prete : false));
  // Le fichier est demandé tant que le clip est affiché.
  useEffect(() => {
    if (!cle) return;
    abonnes.set(el.ressource, (abonnes.get(el.ressource) ?? 0) + 1);
    reglerBientot();
    return () => {
      const n = (abonnes.get(el.ressource) ?? 1) - 1;
      if (n > 0) abonnes.set(el.ressource, n);
      else abonnes.delete(el.ressource);
      reglerBientot();
    };
  }, [cle, el.ressource]);
  const b = cle && mienne ? partagees.get(cle) : undefined;
  useEffect(() => {
    if (!b) return;
    const redessiner = () => noeud.current?.getLayer()?.batchDraw();
    b.dessins.add(redessiner);
    redessiner();
    return () => {
      b.dessins.delete(redessiner);
    };
  }, [b, noeud]);
  return b?.video;
}

/**
 * La balise `<video>` d'un élément, prête à être dessinée (sa première image est arrivée), ou
 * `undefined` en attendant. `joue` : en lecture ; `son` : le volume de l'élément s'entend.
 * `noeud` : l'image Konva à redessiner à chaque image de la vidéo. `inutile` : rendu figé,
 * aucune balise n'est créée.
 *
 * Sur une page vidéo (l'élément a un `temps`), c'est la balise partagée de son fichier, qui suit
 * la tête de lecture de la frise : `joue` ne compte plus, c'est la lecture de la page qui
 * décide.
 */
export function useLecteurVideo(el: ElementVideo, joue: boolean, son: boolean, noeud: React.RefObject<Konva.Image | null>, inutile = false): HTMLVideoElement | undefined {
  const temporel = el.temps !== undefined;
  const fixe = useLecteurFixe(el, joue, son, noeud, inutile || temporel);
  const partagee = useBalisePartagee(el, noeud, inutile || !temporel);
  return temporel ? partagee : fixe;
}

/** Page fixe : la balise propre de l'élément ; lecture, pause, vitesse, volume, boucle sur la
 *  coupe. */
function useLecteurFixe(el: ElementVideo, joue: boolean, son: boolean, noeud: React.RefObject<Konva.Image | null>, inutile: boolean): HTMLVideoElement | undefined {
  const projet = useEditeur((s) => (inutile ? null : s.projet));
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
    void urlCopie(projet, ressource).then(
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

  // Lecture, pause, vitesse, volume, boucle sur la coupe.
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

  // À l'arrêt : une nouvelle coupe montre sa première image.
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
