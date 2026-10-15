// Étape 4, lot 0 : quelle copie d'aperçu de vidéo joue de façon fluide dans la fenêtre ?
// Les copies sont fabriquées par `outils/generer_copies.py`, qui écrit leur liste, leur durée
// de fabrication et leur poids dans `public/donnees/copies/copies.json`.
//
// Pour chaque copie, trois mesures, montées comme le fera Eliot (règle 11 du BRIEF : la vidéo
// vit sur son propre calque, la page de 200 objets n'est dessinée qu'une fois) :
// - la lecture : images par seconde de la fenêtre, images de la vidéo affichées et perdues,
//   vitesse réelle de lecture (1 = temps réel) ;
// - deux vidéos à la fois (une vidéo principale et une incrustation) ;
// - la vidéo posée dans la page elle-même, la page entière (200 objets) redessinée à chaque
//   image : le montage le plus simple, à comparer au calque à part ;
// - la tête de lecture : temps d'un saut à un instant précis, vidéo en pause (médiane, 95e
//   centile, pire, sauts sans réponse), puis un glisser continu de la tête de lecture pendant 3 secondes (combien
//   d'images différentes arrivent à l'écran par seconde).

import Konva from "konva";
import { PAGE } from "./scene";
import { centile, juger, mediane, mesurerAnimation } from "./mesure";
import type { Contexte, Resultat, Scenario } from "./scenarios";

export interface Copie {
  id: string;
  fichier: string;
  type: string;
  description: string;
  fabrication_s: number;
  vitesse_fabrication: number;
  poids_octets: number;
  debit_ko_s: number;
}

export interface ListeCopies {
  version: number;
  duree_source_s: number;
  ffmpeg: string;
  processeur: string;
  fils: number;
  copies: Copie[];
}

const BASE = "/donnees/copies";
const DUREE_LECTURE_MS = 5000;
const arrondi = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

export async function listeCopies(): Promise<ListeCopies | null> {
  try {
    const r = await fetch(`${BASE}/copies.json`, { cache: "no-store" });
    if (!r.ok || !(r.headers.get("content-type") ?? "").includes("json")) return null;
    return (await r.json()) as ListeCopies;
  } catch {
    return null;
  }
}

function attendre<T extends keyof HTMLVideoElementEventMap>(video: HTMLVideoElement, evenement: T, delaiMs: number): Promise<void> {
  return new Promise((ok, ko) => {
    const minuterie = setTimeout(() => ko(new Error(`« ${evenement} » n'arrive pas (délai de ${delaiMs / 1000} s dépassé)`)), delaiMs);
    video.addEventListener(evenement, () => {
      clearTimeout(minuterie);
      ok();
    }, { once: true });
    video.addEventListener("error", () => {
      clearTimeout(minuterie);
      ko(new Error(`lecture impossible, code ${video.error?.code ?? "?"} (codec absent ?)`));
    }, { once: true });
  });
}

async function ouvrir(src: string): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.muted = true;
  // Pas de boucle : chaque mesure tient dans les 20 s de la vidéo, la vitesse se lit donc
  // directement sur l'avance de la lecture.
  video.loop = false;
  video.playsInline = true;
  video.preload = "auto";
  video.src = src;
  await attendre(video, "canplay", 10000);
  return video;
}

function fermer(video: HTMLVideoElement): void {
  video.pause();
  video.removeAttribute("src");
  video.load();
}

/** Le calque de la vidéo, entre la page et les poignées, comme dans Eliot. */
function calqueVideo(ctx: Contexte): Konva.Layer {
  const calque = new Konva.Layer({ listening: false });
  ctx.scene.stage.add(calque);
  calque.zIndex(ctx.scene.calquePage.zIndex() + 1);
  // Même mise à l'échelle et même découpe que le groupe de la page.
  const groupe = ctx.scene.groupePage;
  calque.position(groupe.getAbsolutePosition());
  calque.scale(groupe.getAbsoluteScale());
  calque.clip({ x: 0, y: 0, width: PAGE, height: PAGE });
  return calque;
}

const qualite = (video: HTMLVideoElement) => video.getVideoPlaybackQuality?.();

async function mesurerLecture(ctx: Contexte, copie: Copie, nombre: 1 | 2, dansLaPage = false): Promise<Resultat> {
  const id = `${copie.id}_${dansLaPage ? "dans_la_page" : nombre === 1 ? "lecture" : "deux_videos"}`;
  const titre = `${copie.description} : ${dansLaPage ? "dans la page, tout redessiné" : nombre === 1 ? "lecture" : "deux vidéos à la fois"}`;
  const videos: HTMLVideoElement[] = [];
  // Dans la page : la vidéo rejoint le groupe de la page, juste au-dessus du fond, sous les
  // 200 objets, et c'est le calque de la page entière qui se redessine à chaque image.
  const calque = dansLaPage ? ctx.scene.calquePage : calqueVideo(ctx);
  const conteneur: Konva.Container = dansLaPage ? ctx.scene.groupePage : calque;
  const ajoutes: Konva.Node[] = [];
  try {
    // Une adresse différente pour la seconde vidéo : le moteur ne doit pas partager un lecteur
    // entre les deux, comme pour deux clips différents dans Eliot.
    for (let i = 0; i < nombre; i++) videos.push(await ouvrir(`${BASE}/${copie.fichier}${i ? "?incrustation" : ""}`));
    // Vidéo principale en 16:9 sur la largeur de la page ; l'incrustation en bas à droite.
    ajoutes.push(new Konva.Image({ image: videos[0], x: 0, y: (PAGE - 607) / 2, width: PAGE, height: 607 }));
    if (videos[1]) {
      videos[1].currentTime = 7;
      ajoutes.push(new Konva.Image({ image: videos[1], x: PAGE - 420, y: PAGE - 270, width: 384, height: 216, stroke: "#ffffff", strokeWidth: 6 }));
    }
    for (const noeud of ajoutes) {
      conteneur.add(noeud);
      if (dansLaPage) {
        noeud.moveToBottom();
        noeud.moveUp(); // juste au-dessus du fond de page
      }
    }
    ctx.scene.stage.batchDraw();
    await Promise.all(videos.map((v) => v.play()));
    const avant = videos.map(qualite);
    const temps = videos.map((v) => v.currentTime);
    const debut = performance.now();
    const stats = await mesurerAnimation(DUREE_LECTURE_MS, () => undefined, () => calque.draw());
    const ecoule = (performance.now() - debut) / 1000;
    const mesures: Record<string, number | string> = {};
    videos.forEach((v, i) => {
      const avance = v.currentTime - temps[i];
      const apres = qualite(v);
      const suffixe = nombre === 2 ? (i === 0 ? " (principale)" : " (incrustation)") : "";
      mesures[`vitesse de lecture${suffixe}`] = arrondi(avance / ecoule, 2);
      // Certains moteurs remettent leurs compteurs à zéro en route : un écart négatif ne veut
      // rien dire, il est noté comme inconnu.
      if (avant[i] && apres) {
        const affichees = apres.totalVideoFrames - avant[i]!.totalVideoFrames;
        const perdues = apres.droppedVideoFrames - avant[i]!.droppedVideoFrames;
        mesures[`images vidéo affichées${suffixe}`] = affichees >= 0 ? affichees : "?";
        mesures[`images vidéo perdues${suffixe}`] = perdues >= 0 ? perdues : "?";
      }
    });
    return { id, titre, statut: "ok", stats, verdict: juger(stats, ctx.frequenceHz), mesures };
  } catch (erreur) {
    return { id, titre, statut: "impossible", note: String((erreur as Error).message) };
  } finally {
    videos.forEach(fermer);
    if (dansLaPage) ajoutes.forEach((n) => n.destroy());
    else calque.destroy();
    ctx.scene.stage.batchDraw();
  }
}

/**
 * Un saut de la tête de lecture, vidéo en pause : temps jusqu'à l'évènement `seeked`, plus
 * une image de la fenêtre pour la dessiner. `null` si la vidéo ne répond pas en 3 secondes
 * (un saut perdu ne doit jamais bloquer la série : c'est ce qui arrivait avec
 * `requestVideoFrameCallback`, qui ne se déclenche pas toujours sur une vidéo en pause).
 */
async function sauter(video: HTMLVideoElement, cible: number, dessiner: () => void): Promise<number | null> {
  const t0 = performance.now();
  const arrivee = attendre(video, "seeked", 3000);
  video.currentTime = cible;
  try {
    await arrivee;
  } catch {
    return null;
  }
  dessiner();
  await new Promise((ok) => requestAnimationFrame(() => ok(undefined)));
  return performance.now() - t0;
}

async function mesurerTete(ctx: Contexte, copie: Copie, duree: number): Promise<Resultat> {
  const id = `${copie.id}_tete_de_lecture`;
  const titre = `${copie.description} : tête de lecture`;
  const calque = calqueVideo(ctx);
  let video: HTMLVideoElement | null = null;
  try {
    video = await ouvrir(`${BASE}/${copie.fichier}`);
    video.loop = false;
    const noeud = new Konva.Image({ image: video, x: 0, y: (PAGE - 607) / 2, width: PAGE, height: 607 });
    calque.add(noeud);
    // 1. Sauts isolés, vidéo en pause, à des instants fixés (les mêmes pour chaque copie).
    const sauts: number[] = [];
    let perdus = 0;
    for (let i = 0; i < 15; i++) {
      const cible = ((i * 7919) % Math.floor((duree - 1) * 10)) / 10 + 0.37;
      const duree_ms = await sauter(video, cible, () => calque.draw());
      if (duree_ms === null) perdus++;
      else sauts.push(duree_ms);
      await new Promise((ok) => setTimeout(ok, 60));
    }
    // 2. Glisser continu de la tête de lecture : un aller de 0 à la fin en 3 secondes, un
    // nouvel instant demandé à chaque image de la fenêtre.
    let arrivees = 0;
    video.addEventListener("seeked", () => arrivees++);
    const debut = performance.now();
    await new Promise<void>((ok) => {
      const tic = (t: number) => {
        const avance = (t - debut) / 3000;
        if (avance >= 1) return ok();
        if (!video!.seeking) video!.currentTime = avance * (duree - 0.5);
        calque.draw();
        requestAnimationFrame(tic);
      };
      requestAnimationFrame(tic);
    });
    const secondes = (performance.now() - debut) / 1000;
    return {
      id,
      titre,
      statut: "ok",
      mesures: {
        "saut, médiane (ms)": sauts.length ? arrondi(mediane(sauts)) : "aucun",
        "saut, 95e centile (ms)": sauts.length ? arrondi(centile(sauts, 95)) : "aucun",
        "saut, pire (ms)": sauts.length ? arrondi(Math.max(...sauts)) : "aucun",
        "sauts sans réponse en 3 s": perdus,
        "glisser de la tête : images par seconde": arrondi(arrivees / secondes),
      },
    };
  } catch (erreur) {
    return { id, titre, statut: "impossible", note: String((erreur as Error).message) };
  } finally {
    if (video) fermer(video);
    calque.destroy();
    ctx.scene.stage.batchDraw();
  }
}

/** Les tests des copies présentes, plus une ligne de résumé de leur fabrication. */
export function scenariosCopies(liste: ListeCopies): Scenario[] {
  const scenarios: Scenario[] = [];
  for (const copie of liste.copies) {
    const essai = document.createElement("video").canPlayType(copie.type) || "non";
    scenarios.push({
      id: `${copie.id}_fabrication`,
      titre: `${copie.description} : fabrication`,
      async executer() {
        return {
          id: `${copie.id}_fabrication`,
          titre: this.titre,
          statut: "ok",
          mesures: {
            "durée de fabrication (s)": copie.fabrication_s,
            "fois le temps réel": copie.vitesse_fabrication,
            "poids (Mo)": arrondi(copie.poids_octets / 1e6, 1),
            "débit (Ko/s)": copie.debit_ko_s,
            canPlayType: essai,
          },
        };
      },
    });
    scenarios.push({ id: `${copie.id}_lecture`, titre: `${copie.description} : lecture`, executer: (ctx) => mesurerLecture(ctx, copie, 1) });
    scenarios.push({ id: `${copie.id}_deux_videos`, titre: `${copie.description} : deux vidéos à la fois`, executer: (ctx) => mesurerLecture(ctx, copie, 2) });
    scenarios.push({ id: `${copie.id}_dans_la_page`, titre: `${copie.description} : dans la page, tout redessiné`, executer: (ctx) => mesurerLecture(ctx, copie, 1, true) });
    scenarios.push({ id: `${copie.id}_tete_de_lecture`, titre: `${copie.description} : tête de lecture`, executer: (ctx) => mesurerTete(ctx, copie, liste.duree_source_s) });
  }
  return scenarios;
}
