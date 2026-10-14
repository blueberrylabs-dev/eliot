// Les tests, dans l'ordre où ils tournent. Chaque test remet la scène dans son état initial.

import Konva from "konva";
import { invoke } from "@tauri-apps/api/core";
import { PAGE, type Scene } from "./scene";
import { chronometrer, juger, mesurerAnimation, mediane, type Statistiques, type Verdict } from "./mesure";

const DUREE_MS = 5000;

export interface Resultat {
  id: string;
  titre: string;
  statut: "ok" | "impossible" | "sans objet" | "erreur";
  stats?: Statistiques;
  verdict?: Verdict;
  mesures?: Record<string, number | string>;
  note?: string;
}

export interface Contexte {
  scene: Scene;
  frequenceHz: number;
  dansTauri: boolean;
}

export interface Scenario {
  id: string;
  titre: string;
  executer: (ctx: Contexte) => Promise<Resultat>;
}

/** Trajectoire circulaire, un tour toutes les deux secondes : un glisser continu à la souris. */
const surCercle = (ecouleMs: number, rayon: number) => {
  const angle = (ecouleMs / 2000) * 2 * Math.PI;
  return { dx: Math.cos(angle) * rayon, dy: Math.sin(angle) * rayon };
};

function dessinerTout(scene: Scene): void {
  scene.calquePage.draw();
  scene.calqueInterface.draw();
}

async function animerSelection(
  ctx: Contexte,
  noeuds: Konva.Node[],
  animer: (ecouleMs: number, bases: { x: number; y: number }[]) => void,
): Promise<Statistiques> {
  const { scene } = ctx;
  const bases = noeuds.map((n) => n.position());
  const etats = noeuds.map((n) => ({ rotation: n.rotation(), scaleX: n.scaleX(), scaleY: n.scaleY() }));
  scene.transformer.nodes(noeuds);
  try {
    return await mesurerAnimation(
      DUREE_MS,
      (ecoule) => {
        animer(ecoule, bases);
        scene.transformer.forceUpdate();
      },
      () => dessinerTout(scene),
    );
  } finally {
    noeuds.forEach((n, i) => n.setAttrs({ ...bases[i], ...etats[i] }));
    scene.transformer.nodes([]);
    scene.stage.batchDraw();
  }
}

/**
 * Trois façons de monter un glisser, à comparer avec `glisser_un` (page et poignées sur deux
 * calques, redessinés tous les deux à chaque image) :
 * - `sans_poignees` : un seul calque redessiné, sans poignées ;
 * - `calque_unique` : les poignées rejoignent le calque de la page, un seul calque redessiné ;
 * - `calque_glisse` : l'objet glissé et ses poignées passent sur un calque à part, seul
 *   redessiné ; les 199 autres objets restent dessinés une fois pour toutes.
 * Chaque calque Konva est un `<canvas>` : on mesure ce que coûte au moteur web d'en mettre
 * plusieurs à jour à chaque image.
 */
type MontageGlisser = "sans_poignees" | "calque_unique" | "calque_glisse";

async function glisserAvecMontage(
  ctx: Contexte,
  noeuds: Konva.Shape[],
  montage: MontageGlisser,
  rayon: number,
): Promise<Statistiques> {
  const { scene } = ctx;
  const { transformer, groupePage } = scene;
  const bases = noeuds.map((n) => n.position());
  const rangs = noeuds.map((n) => n.zIndex());
  let calqueGlisse: Konva.Layer | null = null;
  let dessiner: () => void;

  if (montage === "sans_poignees") {
    dessiner = () => scene.calquePage.draw();
  } else if (montage === "calque_unique") {
    transformer.moveTo(scene.calquePage);
    transformer.nodes(noeuds);
    dessiner = () => scene.calquePage.draw();
  } else {
    calqueGlisse = new Konva.Layer();
    scene.stage.add(calqueGlisse);
    const groupe = new Konva.Group({
      x: groupePage.x(),
      y: groupePage.y(),
      scaleX: groupePage.scaleX(),
      scaleY: groupePage.scaleY(),
      clipX: 0,
      clipY: 0,
      clipWidth: PAGE,
      clipHeight: PAGE,
    });
    calqueGlisse.add(groupe);
    noeuds.forEach((n) => n.moveTo(groupe));
    transformer.moveTo(calqueGlisse);
    transformer.nodes(noeuds);
    scene.calquePage.draw();
    scene.calqueInterface.draw();
    const calque = calqueGlisse;
    dessiner = () => calque.draw();
  }

  try {
    return await mesurerAnimation(
      DUREE_MS,
      (ecoule) => {
        const { dx, dy } = surCercle(ecoule, rayon);
        noeuds.forEach((n, i) => n.position({ x: bases[i].x + dx, y: bases[i].y + dy }));
        if (montage !== "sans_poignees") transformer.forceUpdate();
      },
      dessiner,
    );
  } finally {
    transformer.nodes([]);
    transformer.moveTo(scene.calqueInterface);
    noeuds.forEach((n, i) => {
      n.position(bases[i]);
      if (calqueGlisse) n.moveTo(groupePage);
    });
    // Remise dans l'ordre d'empilement d'origine, du plus bas au plus haut.
    noeuds
      .map((n, i) => ({ n, rang: rangs[i] }))
      .sort((a, b) => a.rang - b.rang)
      .forEach(({ n, rang }) => n.zIndex(rang));
    calqueGlisse?.destroy();
    scene.stage.batchDraw();
  }
}

/** Vérifie qu'un fichier de test existe vraiment (le serveur renvoie sa page HTML sinon). */
async function fichierPresent(url: string): Promise<boolean> {
  try {
    const reponse = await fetch(url, { method: "HEAD", cache: "no-store" });
    const type = reponse.headers.get("content-type") ?? "";
    return reponse.ok && !type.startsWith("text/html");
  } catch {
    return false;
  }
}

export const FICHIERS_DE_TEST = [
  "/donnees/photo_24mpx.jpg",
  "/donnees/photo_apercu_2560.jpg",
  "/donnees/video_1080p_h264.mp4",
  "/donnees/video_1080p_vp9.webm",
];

export async function fichiersManquants(): Promise<string[]> {
  const presences = await Promise.all(FICHIERS_DE_TEST.map(fichierPresent));
  return FICHIERS_DE_TEST.filter((_, i) => !presences[i]);
}

const NOTE_FICHIER_ABSENT = "fichier de test absent : lance la commande 4 bis du CLAUDE.md";

function resultatAnimation(id: string, titre: string, ctx: Contexte, stats: Statistiques, mesures?: Record<string, number | string>): Resultat {
  return { id, titre, statut: "ok", stats, verdict: juger(stats, ctx.frequenceHz), mesures };
}

async function chargerImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

async function chargerVideo(src: string, delaiMs = 10000): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = src;
  await new Promise<void>((ok, ko) => {
    const minuterie = setTimeout(() => ko(new Error("la vidéo ne démarre pas (délai de 10 s dépassé)")), delaiMs);
    video.addEventListener("canplay", () => { clearTimeout(minuterie); ok(); }, { once: true });
    video.addEventListener(
      "error",
      () => {
        clearTimeout(minuterie);
        ko(new Error(`lecture impossible, code ${video.error?.code ?? "?"} (codec absent ?)`));
      },
      { once: true },
    );
  });
  await video.play();
  return video;
}

function scenarioPhoto(id: string, titre: string, src: string): Scenario {
  return {
    id,
    titre,
    async executer(ctx) {
      const { scene } = ctx;
      if (!(await fichierPresent(src))) return { id, titre, statut: "impossible", note: NOTE_FICHIER_ABSENT };
      const t0 = performance.now();
      const image = await chargerImage(src);
      const chargementMs = performance.now() - t0;
      const noeud = new Konva.Image({ image, x: 180, y: 300, width: 720, height: 480, name: "objet", draggable: true });
      scene.groupePage.add(noeud);
      // Premier affichage : le moteur doit transférer l'image à la carte graphique.
      const t1 = performance.now();
      scene.calquePage.draw();
      await new Promise(requestAnimationFrame);
      const premierAffichageMs = performance.now() - t1;
      try {
        const stats = await animerSelection(ctx, [noeud], (ecoule, bases) => {
          const { dx, dy } = surCercle(ecoule, 150);
          noeud.position({ x: bases[0].x + dx, y: bases[0].y + dy });
        });
        return resultatAnimation(id, titre, ctx, stats, {
          "chargement et décodage (ms)": Math.round(chargementMs),
          "premier affichage (ms)": Math.round(premierAffichageMs),
          "taille source": `${image.naturalWidth} x ${image.naturalHeight}`,
        });
      } finally {
        noeud.destroy();
        scene.stage.batchDraw();
      }
    },
  };
}

function scenarioVideo(id: string, titre: string, src: string, type: string): Scenario {
  return {
    id,
    titre,
    async executer(ctx) {
      const { scene } = ctx;
      const essai = document.createElement("video").canPlayType(type) || "non";
      if (!(await fichierPresent(src))) {
        return { id, titre, statut: "impossible", note: NOTE_FICHIER_ABSENT, mesures: { canPlayType: essai } };
      }
      let video: HTMLVideoElement;
      try {
        video = await chargerVideo(src);
      } catch (erreur) {
        return { id, titre, statut: "impossible", note: String((erreur as Error).message), mesures: { "canPlayType": essai } };
      }
      const noeud = new Konva.Image({ image: video, x: 60, y: 270, width: 960, height: 540 });
      scene.groupePage.add(noeud);
      noeud.moveToBottom();
      noeud.moveUp(); // juste au-dessus du fond de page
      const qualiteAvant = video.getVideoPlaybackQuality?.();
      const tempsAvant = video.currentTime;
      try {
        const stats = await animerSelection(ctx, [scene.objets[7]], (ecoule, bases) => {
          const { dx, dy } = surCercle(ecoule, 120);
          scene.objets[7].position({ x: bases[0].x + dx, y: bases[0].y + dy });
        });
        const qualiteApres = video.getVideoPlaybackQuality?.();
        const mesures: Record<string, number | string> = { canPlayType: essai };
        if (qualiteAvant && qualiteApres) {
          mesures["images vidéo affichées"] = qualiteApres.totalVideoFrames - qualiteAvant.totalVideoFrames;
          mesures["images vidéo perdues"] = qualiteApres.droppedVideoFrames - qualiteAvant.droppedVideoFrames;
        }
        let avance = video.currentTime - tempsAvant;
        if (avance < 0) avance += video.duration; // la vidéo a bouclé
        mesures["secondes de vidéo lues"] = Math.round(avance * 10) / 10;
        return resultatAnimation(id, titre, ctx, stats, mesures);
      } finally {
        video.pause();
        noeud.destroy();
        video.removeAttribute("src");
        video.load();
        scene.stage.batchDraw();
      }
    },
  };
}

/**
 * Export de la page à sa taille native (x2 = 2160 px). La page est remise à l'échelle 1 le temps
 * du rendu, qui est synchrone : l'écran ne voit jamais l'état intermédiaire.
 */
async function exporterPage(scene: Scene, pixelRatio: number, mimeType: string): Promise<Blob> {
  const groupe = scene.groupePage;
  const position = groupe.position();
  const echelle = groupe.scale() ?? { x: 1, y: 1 };
  groupe.setAttrs({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
  let promesse: Promise<unknown>;
  try {
    promesse = groupe.toBlob({ x: 0, y: 0, width: PAGE, height: PAGE, pixelRatio, mimeType });
  } finally {
    groupe.setAttrs({ x: position.x, y: position.y, scaleX: echelle.x, scaleY: echelle.y });
  }
  const blob = await promesse;
  if (!(blob instanceof Blob)) throw new Error("export vide");
  return blob;
}

interface Reduction {
  lecture_ms: number;
  decodage_ms: number;
  reduction_ms: number;
  encodage_ms: number;
  total_ms: number;
  octets_apercu: number;
}

async function reductionNavigateur(): Promise<Reduction> {
  const t0 = performance.now();
  const blob = await (await fetch("/donnees/photo_24mpx.jpg")).blob();
  const t1 = performance.now();
  const source = await createImageBitmap(blob);
  const t2 = performance.now();
  const hauteur = Math.round((2560 * source.height) / source.width);
  const reduite = await createImageBitmap(source, { resizeWidth: 2560, resizeHeight: hauteur, resizeQuality: "high" });
  const t3 = performance.now();
  const toile = document.createElement("canvas");
  toile.width = reduite.width;
  toile.height = reduite.height;
  toile.getContext("2d")!.drawImage(reduite, 0, 0);
  const sortie = await new Promise<Blob>((ok, ko) =>
    toile.toBlob((b) => (b ? ok(b) : ko(new Error("encodage impossible"))), "image/jpeg", 0.85),
  );
  const t4 = performance.now();
  source.close();
  reduite.close();
  const r = (v: number) => Math.round(v * 10) / 10;
  return {
    lecture_ms: r(t1 - t0),
    decodage_ms: r(t2 - t1),
    reduction_ms: r(t3 - t2),
    encodage_ms: r(t4 - t3),
    total_ms: r(t4 - t0),
    octets_apercu: sortie.size,
  };
}

function mesuresReduction(r: Reduction): Record<string, number | string> {
  return {
    "lecture (ms)": r.lecture_ms,
    "décodage (ms)": r.decodage_ms,
    "réduction à 2560 px (ms)": r.reduction_ms,
    "encodage JPEG (ms)": r.encodage_ms,
    "total (ms)": r.total_ms,
    "poids de l'aperçu (octets)": r.octets_apercu,
  };
}

export const SCENARIOS: Scenario[] = [
  {
    id: "redessin_page",
    titre: "Redessiner les 200 objets à chaque image",
    async executer(ctx) {
      const stats = await mesurerAnimation(DUREE_MS, () => {}, () => ctx.scene.calquePage.draw());
      return resultatAnimation("redessin_page", this.titre, ctx, stats);
    },
  },
  {
    id: "glisser_un",
    titre: "Glisser un objet (poignées affichées)",
    async executer(ctx) {
      const o = ctx.scene.objets[12];
      const stats = await animerSelection(ctx, [o], (ecoule, bases) => {
        const { dx, dy } = surCercle(ecoule, 260);
        o.position({ x: bases[0].x + dx, y: bases[0].y + dy });
      });
      return resultatAnimation("glisser_un", this.titre, ctx, stats);
    },
  },
  {
    id: "glisser_cinquante",
    titre: "Glisser 50 objets sélectionnés ensemble",
    async executer(ctx) {
      const noeuds = ctx.scene.objets.slice(0, 50);
      const stats = await animerSelection(ctx, noeuds, (ecoule, bases) => {
        const { dx, dy } = surCercle(ecoule, 120);
        noeuds.forEach((n, i) => n.position({ x: bases[i].x + dx, y: bases[i].y + dy }));
      });
      return resultatAnimation("glisser_cinquante", this.titre, ctx, stats);
    },
  },
  {
    id: "glisser_un_sans_poignees",
    titre: "Glisser un objet, sans poignées (un seul calque)",
    async executer(ctx) {
      const stats = await glisserAvecMontage(ctx, [ctx.scene.objets[12]], "sans_poignees", 260);
      return resultatAnimation("glisser_un_sans_poignees", this.titre, ctx, stats);
    },
  },
  {
    id: "glisser_un_calque_unique",
    titre: "Glisser un objet, poignées dans le calque de la page",
    async executer(ctx) {
      const stats = await glisserAvecMontage(ctx, [ctx.scene.objets[12]], "calque_unique", 260);
      return resultatAnimation("glisser_un_calque_unique", this.titre, ctx, stats);
    },
  },
  {
    id: "glisser_un_calque_glisse",
    titre: "Glisser un objet sur un calque à part",
    async executer(ctx) {
      const stats = await glisserAvecMontage(ctx, [ctx.scene.objets[12]], "calque_glisse", 260);
      return resultatAnimation("glisser_un_calque_glisse", this.titre, ctx, stats);
    },
  },
  {
    id: "glisser_cinquante_calque_glisse",
    titre: "Glisser 50 objets sur un calque à part",
    async executer(ctx) {
      const stats = await glisserAvecMontage(ctx, ctx.scene.objets.slice(0, 50), "calque_glisse", 120);
      return resultatAnimation("glisser_cinquante_calque_glisse", this.titre, ctx, stats);
    },
  },
  {
    id: "tourner_redimensionner",
    titre: "Tourner et redimensionner 10 objets",
    async executer(ctx) {
      const noeuds = ctx.scene.objets.slice(100, 110);
      const stats = await animerSelection(ctx, noeuds, (ecoule) => {
        const facteur = 1 + 0.35 * Math.sin((ecoule / 1000) * Math.PI);
        noeuds.forEach((n) => {
          n.rotation((ecoule / 20) % 360);
          n.scale({ x: facteur, y: facteur });
        });
      });
      return resultatAnimation("tourner_redimensionner", this.titre, ctx, stats);
    },
  },
  scenarioPhoto("photo_pleine", "Glisser une photo 24 Mpx en pleine résolution", "/donnees/photo_24mpx.jpg"),
  scenarioPhoto("photo_apercu", "Glisser la même photo en aperçu 2560 px", "/donnees/photo_apercu_2560.jpg"),
  scenarioVideo("video_h264", "Vidéo 1080p H.264 dans la page + glisser", "/donnees/video_1080p_h264.mp4", 'video/mp4; codecs="avc1.640028"'),
  scenarioVideo("video_vp9", "Vidéo 1080p VP9 dans la page + glisser", "/donnees/video_1080p_vp9.webm", 'video/webm; codecs="vp9"'),
  {
    id: "export_png",
    titre: "Exporter la page en PNG 2160 x 2160",
    async executer(ctx) {
      const { medianeMs, dernier } = await chronometrer(3, () => exporterPage(ctx.scene, 2, "image/png"));
      const verification = await createImageBitmap(dernier);
      const mesures = {
        "durée médiane de 3 exports (ms)": medianeMs,
        "taille obtenue": `${verification.width} x ${verification.height}`,
        "poids (octets)": dernier.size,
      };
      verification.close();
      return { id: "export_png", titre: this.titre, statut: "ok", mesures };
    },
  },
  {
    id: "reduction_moteur_web",
    titre: "Photo 24 Mpx vers aperçu 2560 px, par le moteur web",
    async executer() {
      if (!(await fichierPresent("/donnees/photo_24mpx.jpg"))) {
        return { id: "reduction_moteur_web", titre: this.titre, statut: "impossible", note: NOTE_FICHIER_ABSENT };
      }
      const passes: Reduction[] = [];
      for (let i = 0; i < 3; i++) passes.push(await reductionNavigateur());
      const totalMedian = mediane(passes.map((p) => p.total_ms));
      const retenue = passes.find((p) => p.total_ms === totalMedian) ?? passes[0];
      return { id: "reduction_moteur_web", titre: this.titre, statut: "ok", mesures: mesuresReduction(retenue) };
    },
  },
  {
    id: "reduction_rust",
    titre: "Photo 24 Mpx vers aperçu 2560 px, par le Rust",
    async executer(ctx) {
      if (!ctx.dansTauri) {
        return { id: "reduction_rust", titre: this.titre, statut: "sans objet", note: "le Rust ne tourne que dans la fenêtre Tauri" };
      }
      const r = await invoke<Reduction>("mesurer_reduction_rust");
      return { id: "reduction_rust", titre: this.titre, statut: "ok", mesures: mesuresReduction(r) };
    },
  },
];
