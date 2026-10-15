// Les réglages d'export vidéo par plateforme (étape 4, lot 4) : des fonctions pures, testées
// seules. Les valeurs viennent des pages d'aide des plateformes, relevées le 2026-10-15
// (sources dans le JOURNAL et ci-dessous).

import type { Format } from "../modele/types";
import type { ReglagesFilm, ResultatFilm } from "../pont/tauri";

export type IdPlateforme = "youtube" | "shorts" | "tiktok" | "reels" | "libre";

export interface Plateforme {
  id: IdPlateforme;
  nom: string;
  /** Les proportions attendues (largeur sur hauteur) ; `null` : toutes. */
  proportions: { valeur: number; libelle: string }[] | null;
  /** Durée la plus longue acceptée, en ms. */
  dureeMax?: number;
  /** Débit vidéo plafond (kbit/s) selon la cadence et la définition (petit côté). */
  debit: (imagesParSeconde: number, cote: number) => number;
  /** Une image clé toutes les… (secondes). */
  gopSecondes: number;
  debitSon: number;
  /** Le niveau sonore visé (LUFS intégrés, EBU R128), crête vraie plafonnée à -1 dBTP. */
  niveauLufs: number;
  /** Ce qu'il faut savoir, en une phrase. */
  conseil: string;
}

const MINUTE = 60_000;

/** Le niveau sonore : YouTube ramène les vidéos plus fortes à -14 LUFS (et conseille une crête
 *  vraie sous -1 dBTP) ; TikTok et Instagram ne publient pas de cible, les mesures tournent
 *  autour de -14 aussi (forasoft.com, « LUFS for video platforms », 2026-06-05). */
const NIVEAU_LUFS = -14;

/** YouTube : « Recommended upload encoding settings » (support.google.com/youtube/answer/1722171)
 *  : H.264, AAC-LC 48 kHz stéréo à 384 kbit/s, GOP fermé d'une demi-cadence, 1080p à 8 Mbit/s
 *  (24 à 30 images/s) ou 12 Mbit/s (48 à 60), 720p à 5 ou 7,5 Mbit/s. */
const debitYoutube = (ips: number, cote: number) => (cote >= 1080 ? (ips > 30 ? 12_000 : 8_000) : ips > 30 ? 7_500 : 5_000);

export const PLATEFORMES: Plateforme[] = [
  {
    id: "youtube",
    nom: "YouTube",
    proportions: [{ valeur: 16 / 9, libelle: "16:9" }],
    debit: debitYoutube,
    gopSecondes: 0.5,
    debitSon: 384,
    niveauLufs: NIVEAU_LUFS,
    conseil: "16:9, H.264 et son AAC 48 kHz, réglages recommandés par YouTube.",
  },
  {
    id: "shorts",
    nom: "Shorts",
    // support.google.com/youtube/answer/15424877 : vidéo carrée ou verticale, 3 minutes au plus.
    proportions: [
      { valeur: 9 / 16, libelle: "9:16" },
      { valeur: 1, libelle: "1:1" },
    ],
    dureeMax: 3 * MINUTE,
    debit: debitYoutube,
    gopSecondes: 0.5,
    debitSon: 384,
    niveauLufs: NIVEAU_LUFS,
    conseil: "Vertical (9:16) ou carré, 3 minutes au plus ; mêmes réglages d'encodage que YouTube.",
  },
  {
    id: "tiktok",
    nom: "TikTok",
    // developers.tiktok.com, Content Posting API, Media Transfer Guide : MP4 et H.264 conseillés,
    // 23 à 60 images/s, 360 à 4096 px de côté, 10 minutes et 4 Go au plus.
    proportions: [{ valeur: 9 / 16, libelle: "9:16" }],
    dureeMax: 10 * MINUTE,
    debit: (ips, cote) => (cote >= 1080 ? (ips > 30 ? 15_000 : 10_000) : ips > 30 ? 9_000 : 6_000),
    gopSecondes: 1,
    debitSon: 192,
    niveauLufs: NIVEAU_LUFS,
    conseil: "Vertical 9:16 (1080 × 1920), 23 à 60 images/s, 10 minutes au plus.",
  },
  {
    id: "reels",
    nom: "Reels",
    // Instagram Reels (relevé par argil.ai, 2026-05-10) : 1080 × 1920, 23 à 60 images/s (30 par
    // défaut), H.264 et AAC, 3 minutes au plus depuis l'application.
    proportions: [{ valeur: 9 / 16, libelle: "9:16" }],
    dureeMax: 3 * MINUTE,
    debit: (ips, cote) => (cote >= 1080 ? (ips > 30 ? 15_000 : 10_000) : ips > 30 ? 9_000 : 6_000),
    gopSecondes: 1,
    debitSon: 192,
    niveauLufs: NIVEAU_LUFS,
    conseil: "Vertical 9:16 (1080 × 1920), 30 images/s, 3 minutes au plus.",
  },
  {
    id: "libre",
    nom: "Autre",
    proportions: null,
    debit: (ips, cote) => (cote >= 1080 ? (ips > 30 ? 16_000 : 12_000) : ips > 30 ? 10_000 : 7_500),
    gopSecondes: 1,
    debitSon: 320,
    niveauLufs: NIVEAU_LUFS,
    conseil: "Les proportions de la page, très bonne qualité.",
  },
];

export const plateforme = (id: IdPlateforme) => PLATEFORMES.find((p) => p.id === id) ?? PLATEFORMES[PLATEFORMES.length - 1];

export interface OptionsFilm {
  format: "mp4" | "gif";
  plateforme: IdPlateforme;
  /** MP4 : le petit côté du film (1080 ou 720). */
  definition: 1080 | 720;
  imagesParSeconde: number;
  /** MP4 : garder le son (celui des vidéos et les sons de la page). */
  son: boolean;
  /** MP4 : caler le niveau sonore sur la cible de la plateforme. */
  niveau: boolean;
  /** MP4 : faire aussi une version sans musique (voix et bruitages gardés). */
  sansMusique: boolean;
  /** GIF : la largeur du film. */
  largeurGif: number;
  /** Chemin choisi dans « Enregistrer sous ». */
  chemin?: string;
}

export const OPTIONS_FILM_DEFAUT: OptionsFilm = { format: "mp4", plateforme: "libre", definition: 1080, imagesParSeconde: 30, son: true, niveau: true, sansMusique: false, largeurGif: 480 };

const pair = (v: number) => Math.max(2, Math.round(v / 2) * 2);

/** Les réglages qu'attend le noyau, pour une page de ce format. */
export function reglagesFilm(o: OptionsFilm, format: Format): ReglagesFilm {
  const p = plateforme(o.plateforme);
  if (o.format === "gif") {
    const largeur = Math.min(Math.round(o.largeurGif), Math.round(format.largeur));
    return { format: "gif", largeur, hauteur: Math.max(16, Math.round((largeur * format.hauteur) / format.largeur)), imagesParSeconde: o.imagesParSeconde, crf: 18, debitMaxKbps: 8_000, gopSecondes: 1, debitSonKbps: 128, son: false, niveauLufs: null, sansMusique: false };
  }
  const echelle = o.definition / Math.min(format.largeur, format.hauteur);
  const largeur = pair(format.largeur * echelle);
  const hauteur = pair(format.hauteur * echelle);
  return { format: "mp4", largeur, hauteur, imagesParSeconde: o.imagesParSeconde, crf: 18, debitMaxKbps: p.debit(o.imagesParSeconde, o.definition), gopSecondes: p.gopSecondes, debitSonKbps: p.debitSon, son: o.son, niveauLufs: o.son && o.niveau ? p.niveauLufs : null, sansMusique: o.son && o.sansMusique };
}

/** Ce qui ne va pas pour la plateforme choisie : proportions, durée. */
export function remarquesFilm(o: OptionsFilm, format: Format, duree: number): string[] {
  if (o.format === "gif") return duree > 15_000 ? ["Un GIF de plus de 15 secondes devient lourd : le MP4 convient mieux."] : [];
  const p = plateforme(o.plateforme);
  const remarques: string[] = [];
  const ratio = format.largeur / format.hauteur;
  if (p.proportions && !p.proportions.some((x) => Math.abs(x.valeur - ratio) < 0.02)) {
    remarques.push(`${p.nom} attend du ${p.proportions.map((x) => x.libelle).join(" ou du ")} : la page n'a pas ces proportions (Redimensionner, dans la barre du haut).`);
  }
  if (p.dureeMax && duree > p.dureeMax) remarques.push(`${p.nom} accepte ${Math.round(p.dureeMax / MINUTE)} minutes au plus : la page dure plus longtemps.`);
  if ((o.plateforme === "tiktok" || o.plateforme === "reels") && o.imagesParSeconde < 23) remarques.push(`${p.nom} demande 23 images par seconde au moins.`);
  return remarques;
}

const nombre = (v: number) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(1).replace(".", ",");

/** Ce que dit la notification à la fin d'un export vidéo. */
export function messageFilm(r: ResultatFilm): string {
  const morceaux = [`Vidéo exportée : ${r.chemin}`];
  const n = r.niveau;
  if (n && n.lufs !== null) morceaux.push(`son à ${nombre(n.lufs)} LUFS${n.crete !== null ? `, crête à ${nombre(n.crete)} dBTP` : ""}${n.gain ? ` (${n.gain > 0 ? "+" : ""}${nombre(n.gain)} dB)` : ""}`);
  if (r.sansMusique) morceaux.push(`version sans musique : ${r.sansMusique.split("/").pop()}`);
  return morceaux.join(" ; ");
}
