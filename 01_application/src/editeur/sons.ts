// La lecture des sons d'une page vidéo dans la fenêtre (étape 4, lot 5), par le Web Audio : la
// copie d'écoute de chaque son (jamais l'original, règle 5) est décodée une fois, puis, à chaque
// lecture, chaque son est programmé sur l'horloge du son, à l'échantillon près : son départ, sa
// partie jouée, sa boucle, et la courbe de son volume (le volume du clip, ses fondus, la musique
// qui baisse sous la voix : `modele/son.ts`, les mêmes formules que l'export).
//
// Écarté : une balise `<audio>` par son, recalée sur la tête de lecture. Mesuré dans WebKit, une
// balise part avec un délai variable (jusqu'à 0,3 s quand la fenêtre est chargée, la tête
// n'avançant qu'à chaque image dessinée), et chaque recalage s'entend.

import { useEffect, useRef } from "react";
import { pageCourante, useEditeur } from "../etat/editeur";
import { useTemps } from "../etat/temps";
import { boucle, gainClipSon, partieJouee, sonActifA, tempsMediaSon } from "../modele/son";
import type { ClipAudio, RefRessources, Ressource } from "../modele/types";
import { urlCopie } from "../pont/tauri";

/** Points par seconde de la courbe du volume d'un son. */
const POINTS_PAR_SECONDE = 50;
/** Délai laissé à l'horloge du son avant le premier départ, en secondes. */
const MARGE = 0.02;
/** Écart (ms) entre la tête et l'horloge du son au-delà duquel on reprogramme (un saut de la
 *  tête pendant la lecture). */
const SAUT = 250;

/** Pour les essais : ce que joue chaque son en ce moment (identifiant du clip → état). */
export const lectureSons = new Map<string, { joue: boolean; instant: number; volume: number }>();

// L'horloge du son ne tourne que pendant la lecture : un contexte en marche calcule du silence
// sans arrêt, ce qui prend du processeur à la fenêtre (mesuré dans WebKit).
let contexte: AudioContext | null = null;
const contexteAudio = (): AudioContext => (contexte ??= new AudioContext({ latencyHint: "interactive" }));
/** Le décodage passe par un contexte hors ligne, qui ne joue rien. */
let decodeur: OfflineAudioContext | null = null;
const contexteDecodage = (): OfflineAudioContext => (decodeur ??= new OfflineAudioContext(2, 1, 48_000));

/** Les sons décodés, par design et par ressource. */
const tampons = new Map<string, Promise<AudioBuffer | null>>();
const cleTampon = (ref: RefRessources, id: string) => `${ref.rayon}/${ref.id}/${id}`;

function tamponDe(ref: RefRessources, r: Ressource): Promise<AudioBuffer | null> {
  const cle = cleTampon(ref, r.id);
  let promesse = tampons.get(cle);
  if (!promesse) {
    promesse = urlCopie(ref, r)
      .then((url) => fetch(url))
      .then((reponse) => reponse.arrayBuffer())
      .then((octets) => contexteDecodage().decodeAudioData(octets))
      .catch(() => null);
    tampons.set(cle, promesse);
  }
  return promesse;
}

/** Oublie les sons décodés d'un design qu'on quitte. */
function oublierTampons(ref: RefRessources | null) {
  if (!ref) return;
  const prefixe = `${ref.rayon}/${ref.id}/`;
  for (const cle of [...tampons.keys()]) if (cle.startsWith(prefixe)) tampons.delete(cle);
}

interface Programme {
  sources: { source: AudioBufferSourceNode; gain: GainNode }[];
  /** L'heure de l'horloge du son où la tête valait `tete0`. */
  t0: number;
  tete0: number;
  /** Les sons programmés. */
  ids: Set<string>;
}

/** Les sons de la page affichée suivent la tête de lecture. À monter une fois dans l'éditeur. */
export function useLecteurSons(): void {
  const projet = useEditeur((s) => s.projet);
  const audio = useEditeur((s) => (pageCourante(s).duree !== undefined ? pageCourante(s).audio : undefined));
  const ressources = useEditeur((s) => s.ressources);
  const sons = useRef<ClipAudio[]>([]);
  sons.current = audio ?? [];
  const prets = useRef(new Map<string, AudioBuffer>());
  const programme = useRef<Programme | null>(null);
  /** Chaque lancement ou arrêt l'avance : un lancement qui attendait l'horloge du son et
   *  qu'un autre a remplacé ne programme rien. */
  const generation = useRef(0);

  /** Arrête les sons programmés ; `garder` : l'horloge du son continue (on relance aussitôt). */
  const arreter = (garder = false) => {
    generation.current++;
    for (const { source, gain } of programme.current?.sources ?? []) {
      try {
        source.stop();
      } catch {
        // Déjà arrêtée.
      }
      source.disconnect();
      gain.disconnect();
    }
    programme.current = null;
    if (!garder && contexte?.state === "running") void contexte.suspend();
  };

  /** Programme tous les sons à partir de l'instant de la tête de lecture. L'horloge du son
   *  arrêtée repart d'abord : les sons sont programmés une fois qu'elle tourne. */
  const lancer = (tete: number) => {
    arreter(true);
    const tous = sons.current;
    // Rien à jouer d'ici la fin : l'horloge du son s'arrête.
    if (!tous.some((c) => prets.current.has(c.ressource) && (c.volume ?? 1) > 0 && c.temps.fin > tete)) {
      if (contexte?.state === "running") void contexte.suspend();
      return;
    }
    const ctx = contexteAudio();
    const gen = generation.current;
    if (ctx.state === "running") programmer(ctx, tete);
    else
      void ctx.resume().then(() => {
        const t = useTemps.getState();
        if (gen === generation.current && t.joue) programmer(ctx, t.tete);
        else if (!t.joue) void ctx.suspend();
      });
  };

  const programmer = (ctx: AudioContext, tete: number) => {
    const tous = sons.current;
    const t0 = ctx.currentTime + MARGE;
    const p: Programme = { sources: [], t0, tete0: tete, ids: new Set() };
    for (const c of tous) {
      const tampon = prets.current.get(c.ressource);
      if (!tampon || (c.volume ?? 1) <= 0 || c.temps.fin <= tete) continue;
      const fichier = tampon.duration * 1000;
      const debut = Math.max(c.temps.debut, tete);
      const quand = t0 + (debut - tete) / 1000;
      const duree = (c.temps.fin - debut) / 1000;
      const partie = partieJouee(c, fichier);
      const offset = tempsMediaSon(c, debut, fichier) / 1000;
      const source = ctx.createBufferSource();
      source.buffer = tampon;
      if (boucle(c) && partie.fin > partie.debut) {
        source.loop = true;
        source.loopStart = partie.debut / 1000;
        source.loopEnd = partie.fin / 1000;
        source.start(quand, offset);
        source.stop(quand + duree);
      } else {
        const restant = Math.min(duree, partie.fin / 1000 - offset);
        if (restant <= 0.001) continue;
        source.start(quand, offset, restant);
      }
      // La courbe du volume, de l'entrée à la fin du son.
      const n = Math.max(2, Math.ceil(duree * POINTS_PAR_SECONDE) + 1);
      const courbe = new Float32Array(n);
      for (let i = 0; i < n; i++) courbe[i] = Math.max(0, Math.min(1, gainClipSon(c, Math.min(c.temps.fin - 1, debut + (i / (n - 1)) * (c.temps.fin - debut)), tous)));
      const gain = ctx.createGain();
      gain.gain.value = courbe[0];
      gain.gain.setValueCurveAtTime(courbe, quand, Math.max(0.01, duree));
      source.connect(gain).connect(ctx.destination);
      p.sources.push({ source, gain });
      p.ids.add(c.id);
    }
    programme.current = p;
  };

  /** Ce que joue chaque son à cet instant, pour les essais. */
  const noter = (etat: { tete: number; joue: boolean }) => {
    const tous = sons.current;
    lectureSons.clear();
    for (const c of tous) {
      const actif = sonActifA(c, etat.tete);
      const tampon = prets.current.get(c.ressource);
      lectureSons.set(c.id, {
        joue: etat.joue && actif && !!programme.current?.ids.has(c.id),
        instant: Math.round(tempsMediaSon(c, etat.tete, tampon ? tampon.duration * 1000 : undefined)),
        volume: actif ? gainClipSon(c, etat.tete, tous) : 0,
      });
    }
  };

  // La tête de lecture mène : lire programme les sons, la pause les arrête, un saut de la tête
  // pendant la lecture les reprogramme.
  useEffect(() => {
    const suivre = (etat: { tete: number; joue: boolean }, avant?: { tete: number; joue: boolean }) => {
      if (!etat.joue) {
        if (programme.current || contexte?.state === "running") arreter();
      } else if (!avant?.joue) lancer(etat.tete);
      else if (programme.current && contexte) {
        const p = programme.current;
        const attendue = p.tete0 + (contexte.currentTime - p.t0) * 1000;
        if (Math.abs(etat.tete - attendue) > SAUT) lancer(etat.tete);
      } else if (etat.tete !== avant.tete && Math.abs(etat.tete - avant.tete) > SAUT) lancer(etat.tete);
      noter(etat);
    };
    suivre(useTemps.getState());
    const fin = useTemps.subscribe(suivre);
    return () => {
      fin();
      arreter();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Les sons de la page sont décodés dès qu'ils y sont ; un son modifié pendant la lecture, ou
  // décodé pendant la lecture, fait reprogrammer depuis la tête.
  useEffect(() => {
    if (!projet) return;
    let actif = true;
    for (const c of audio ?? []) {
      const r = ressources[c.ressource];
      if (!r || prets.current.has(c.ressource)) continue;
      void tamponDe(projet, r).then((tampon) => {
        if (!actif || !tampon) return;
        prets.current.set(c.ressource, tampon);
        const t = useTemps.getState();
        if (t.joue) lancer(t.tete);
      });
    }
    const t = useTemps.getState();
    if (t.joue) lancer(t.tete);
    noter(t);
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projet, audio, ressources]);

  // Un autre design : ses sons décodés partent avec lui.
  useEffect(
    () => () => {
      arreter();
      oublierTampons(projet);
      prets.current.clear();
    },
    [projet],
  );
}
