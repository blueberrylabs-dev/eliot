// Les sons d'une page vidéo (étape 4, lot 5), en fonctions pures : la fenêtre s'en sert pour
// jouer les sons au rythme de la tête de lecture, le noyau Rust reprend les mêmes formules pour
// l'export (`noyau/src/son.rs`), contrôlées par le tableau de valeurs attendues commun
// `son.attendus.json`.
//
// Un son a un rôle : musique, voix ou bruitage. La musique baisse toute seule pendant les clips
// de voix (elle garde `sousLaVoix` de son volume, 30 % par défaut), en commençant un peu avant
// la voix et en remontant un peu après ; elle baisse aussi là où l'on parle dans une vidéo de la
// page (les passages de parole que le noyau y trouve, décision d'Alexandre du 2026-10-16). Une
// musique « jusqu'à la fin » couvre la page jusqu'au bout et se répète au besoin.

import type { ClipAudio, PageEliot, RoleSon } from "./types";

export const ROLES_SON: { id: RoleSon; libelle: string }[] = [
  { id: "musique", libelle: "Musique" },
  { id: "voix", libelle: "Voix" },
  { id: "bruitage", libelle: "Bruitage" },
];

/** La part du volume d'une musique gardée sous une voix : environ −10 dB. */
export const SOUS_LA_VOIX = 0.3;
/** La musique commence à baisser ces ms avant une voix… */
export const ATTAQUE_VOIX = 200;
/** … et remonte en autant de ms après. */
export const RELACHE_VOIX = 400;
/** Le fondu de fin posé d'office sur une musique qui va jusqu'au bout de la page. */
export const FONDU_FIN_MUSIQUE = 2000;
export const DUREE_MIN_SON = 100;

const borne = (v: number) => Math.max(0, Math.min(1, v));

/** Le son joue-t-il à l'instant `t` de la page ? */
export const sonActifA = (c: ClipAudio, t: number): boolean => t >= c.temps.debut && t < c.temps.fin;

/** Le son se répète-t-il dans son clip ? */
export const boucle = (c: Pick<ClipAudio, "boucle" | "jusquALaFin">): boolean => !!(c.boucle || c.jusquALaFin);

/** La partie du fichier qui joue, en ms du fichier. */
export function partieJouee(c: Pick<ClipAudio, "coupe">, dureeFichier?: number): { debut: number; fin: number } {
  const debut = Math.max(0, c.coupe?.debut ?? 0);
  const fin = Math.min(c.coupe?.fin ?? Number.POSITIVE_INFINITY, dureeFichier ?? Number.POSITIVE_INFINITY);
  return { debut, fin: Math.max(debut, fin) };
}

/**
 * La longueur d'un clip sur la frise : la partie jouée de son fichier ; un clip qui boucle
 * garde la sienne (il peut durer plus que son fichier).
 */
export function longueurSon(c: ClipAudio, dureeFichier?: number): number {
  if (boucle(c)) return Math.max(DUREE_MIN_SON, Math.round(c.temps.fin - c.temps.debut));
  const { debut, fin } = partieJouee(c, dureeFichier);
  return Number.isFinite(fin) ? Math.max(DUREE_MIN_SON, Math.round(fin - debut)) : Math.max(DUREE_MIN_SON, Math.round(c.temps.fin - c.temps.debut));
}

/** L'instant du fichier (ms) joué à l'instant `t` de la page ; un clip qui boucle repart du
 *  début de sa partie jouée chaque fois qu'il l'a finie. */
export function tempsMediaSon(c: ClipAudio, t: number, dureeFichier?: number): number {
  const { debut, fin } = partieJouee(c, dureeFichier);
  const depuis = t - c.temps.debut;
  const longueur = fin - debut;
  if (boucle(c) && longueur > 0 && Number.isFinite(longueur)) {
    const x = (depuis + (c.phase ?? 0)) % longueur;
    return debut + (x < 0 ? x + longueur : x);
  }
  return Math.max(debut, Math.min(fin, debut + depuis));
}

/** Un passage de la page, `[début, fin]` en ms. */
export type Passage = readonly [number, number];

/** Deux passages de parole d'une vidéo à moins de 1,2 s l'un de l'autre n'en font qu'un : la
 *  musique ne remonte pas entre deux phrases. */
export const FUSION_PAROLE = 1200;

/** Ce qu'il faut savoir d'une vidéo de la page pour la baisse de la musique. */
export interface ClipQuiParle {
  temps?: { debut: number; fin: number };
  coupe?: { debut: number; fin?: number };
  vitesse?: number;
  volume?: number;
  visible?: boolean;
  /** Les passages où l'on parle, en ms du fichier (l'analyse du noyau) ; absent : pas de son,
   *  ou pas encore analysé. */
  parole?: readonly Passage[];
}

/**
 * Où l'on parle dans les vidéos d'une page, en ms de la page : chaque passage de parole de leur
 * fichier mis à sa place (coupe, vitesse), dans le temps du clip, ceux à moins de
 * `FUSION_PAROLE` l'un de l'autre réunis. Une vidéo cachée ou muette ne compte pas (l'export ne
 * la mixe pas). Les mêmes règles que `paroles_des_clips` du noyau.
 */
export function parolesDesClips(clips: readonly ClipQuiParle[]): Passage[] {
  const bruts: [number, number][] = [];
  for (const c of clips) {
    if (!c.temps || !c.parole?.length || (c.volume ?? 1) <= 0 || c.visible === false) continue;
    const vitesse = Math.max(0.25, Math.min(4, c.vitesse ?? 1));
    const depart = c.coupe?.debut ?? 0;
    for (const [a, b] of c.parole) {
      const debut = Math.max(c.temps.debut, c.temps.debut + (a - depart) / vitesse);
      const fin = Math.min(c.temps.fin, c.temps.debut + (b - depart) / vitesse);
      if (fin > debut) bruts.push([debut, fin]);
    }
  }
  bruts.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const sortie: [number, number][] = [];
  for (const [debut, fin] of bruts) {
    const dernier = sortie[sortie.length - 1];
    if (dernier && debut - dernier[1] < FUSION_PAROLE) dernier[1] = Math.max(dernier[1], fin);
    else sortie.push([debut, fin]);
  }
  return sortie;
}

/** La présence d'une voix de `debut` à `fin` à l'instant `t`, de 0 à 1, avec la montée avant et
 *  la descente après. */
function presence(debut: number, fin: number, t: number): number {
  if (t < debut - ATTAQUE_VOIX || t >= fin + RELACHE_VOIX) return 0;
  if (t < debut) return (t - (debut - ATTAQUE_VOIX)) / ATTAQUE_VOIX;
  if (t < fin) return 1;
  return 1 - (t - fin) / RELACHE_VOIX;
}

/** Une voix parle-t-elle à l'instant `t` ? De 0 à 1, avec la montée avant la voix et la
 *  descente après (`sauf` : un clip à ne pas compter). `paroles` : où l'on parle dans les
 *  vidéos de la page (`parolesDesClips`). */
export function presenceVoix(sons: readonly ClipAudio[], t: number, sauf?: string, paroles: readonly Passage[] = []): number {
  let p = 0;
  for (const v of sons) {
    if (v.role !== "voix" || v.id === sauf || (v.volume ?? 1) <= 0) continue;
    p = Math.max(p, presence(v.temps.debut, v.temps.fin, t));
  }
  for (const [debut, fin] of paroles) p = Math.max(p, presence(debut, fin, t));
  return borne(p);
}

/** Le volume d'un son à l'instant `t` : son volume, ses fondus et, pour une musique, la baisse
 *  sous la voix. `sons` : tous les sons de la page ; `paroles` : où l'on parle dans ses
 *  vidéos. */
export function gainClipSon(c: ClipAudio, t: number, sons: readonly ClipAudio[], paroles: readonly Passage[] = []): number {
  let v = c.volume ?? 1;
  const tr = t - c.temps.debut;
  const longueur = c.temps.fin - c.temps.debut;
  const fi = c.fonduEntree ?? 0;
  const fo = c.fonduSortie ?? 0;
  if (fi > 0 && tr < fi) v *= borne(tr / fi);
  if (fo > 0 && tr > longueur - fo) v *= borne((longueur - tr) / fo);
  if (c.role === "musique") v *= 1 - (1 - borne(c.sousLaVoix ?? SOUS_LA_VOIX)) * presenceVoix(sons, t, c.id, paroles);
  return borne(v);
}

const chevauche = (a: { debut: number; fin: number }, b: { debut: number; fin: number }) => a.debut < b.fin && b.debut < a.fin;

/**
 * Remet les sons d'une page vidéo d'aplomb : chacun à sa longueur (sa partie jouée), une
 * musique « jusqu'à la fin » jusqu'au bout de la page, deux sons d'une même piste ne se
 * chevauchent pas (le second descend d'une piste), pistes numérotées 0, 1, 2… sans trou, tableau
 * trié par piste. `finVisuelle` : la fin du dernier clip de la page (`null` s'il n'y en a pas :
 * la page garde alors `dureeParDefaut`, sa durée actuelle, au moins).
 * Renvoie les sons et la durée de la page qu'ils imposent avec les clips.
 */
export function normaliserSons(audio: ClipAudio[] | undefined, finVisuelle: number | null, dureeParDefaut: number, dureeFichier: (ressource: string) => number | undefined): { audio: ClipAudio[] | undefined; duree: number } {
  const liste = audio ?? [];
  let clips = liste.map((c, rang) => {
    const debut = Math.max(0, c.temps.debut);
    return { c, rang, piste: Number.isFinite(c.piste) ? Math.max(0, c.piste) : 0, debut, fin: debut + longueurSon(c, dureeFichier(c.ressource)) };
  });
  // Sans clip, la page garde sa durée (5 s pour une page neuve), que les sons peuvent allonger.
  const fins = [finVisuelle ?? Math.max(DUREE_MIN_SON, dureeParDefaut), ...clips.filter((x) => !x.c.jusquALaFin).map((x) => x.fin)];
  let duree = Math.max(DUREE_MIN_SON, ...fins);
  for (const x of clips) {
    if (!x.c.jusquALaFin) continue;
    x.debut = Math.min(x.debut, Math.max(0, duree - DUREE_MIN_SON));
    x.fin = Math.max(x.debut + DUREE_MIN_SON, duree);
  }
  duree = Math.max(duree, ...clips.map((x) => x.fin));

  // Deux sons d'une même piste ne se chevauchent pas : le second descend sur une piste glissée
  // juste en dessous (numérotée à l'étape suivante).
  let pistes = [...new Set(clips.map((x) => x.piste))].sort((a, b) => a - b);
  for (let i = 0; i < pistes.length; i++) {
    const p = pistes[i];
    const surPiste = clips.filter((x) => x.piste === p).sort((a, b) => a.debut - b.debut || a.rang - b.rang);
    const gardes: typeof surPiste = [];
    const descendus: typeof surPiste = [];
    for (const x of surPiste) (gardes.some((g) => chevauche(g, x)) ? descendus : gardes).push(x);
    if (descendus.length) {
      const suivante = pistes[i + 1];
      const nouvelle = suivante === undefined ? p + 1 : (p + suivante) / 2;
      for (const x of descendus) x.piste = nouvelle;
      pistes = [...new Set([...pistes, nouvelle])].sort((a, b) => a - b);
    }
  }
  const rangs = new Map(pistes.map((p, i) => [p, i]));
  for (const x of clips) {
    x.piste = rangs.get(x.piste)!;
    const longueur = Math.round(x.fin - x.debut);
    x.debut = Math.round(x.debut);
    x.fin = x.debut + longueur;
  }
  clips = clips.sort((a, b) => a.piste - b.piste || a.debut - b.debut || a.rang - b.rang);
  let change = false;
  const sortie = clips.map((x, i) => {
    if (liste[i] !== x.c) change = true;
    if (x.c.piste === x.piste && x.c.temps.debut === x.debut && x.c.temps.fin === x.fin) return x.c;
    change = true;
    return { ...x.c, piste: x.piste, temps: { debut: x.debut, fin: x.fin } };
  });
  return { audio: audio === undefined ? undefined : change ? sortie : audio, duree: Math.round(duree) };
}

/** Les pistes audio d'une page, de la première (juste sous la principale) à la dernière. */
export function pistesAudio(p: PageEliot): { piste: number; sons: ClipAudio[] }[] {
  const audio = p.audio ?? [];
  const max = Math.max(-1, ...audio.map((c) => c.piste));
  return Array.from({ length: max + 1 }, (_, n) => ({ piste: n, sons: audio.filter((c) => c.piste === n) }));
}

/** Les crédits des sons d'une page à coller dans la description d'une vidéo : un par son venu
 *  d'une banque, une fois chacun ; une ligne par voix de synthèse. */
export function creditsDesSons(p: PageEliot, ressources: Record<string, { nom: string; credit?: { source: string; auteur: string; lien: string; licence?: string; titre?: string } }>): string[] {
  const vus = new Set<string>();
  const lignes: string[] = [];
  for (const c of p.audio ?? []) {
    if (vus.has(c.ressource)) continue;
    vus.add(c.ressource);
    const r = ressources[c.ressource];
    const k = r?.credit;
    if (!k) continue;
    // Une voix de synthèse (lot 6) : la voix et ses données, une fois pour toutes ses phrases.
    const ligne =
      k.source === "Piper"
        ? `Voix de synthèse « ${k.auteur} » (Piper), données ${k.lien}${k.licence ? `, licence ${k.licence}` : ""}`
        : `« ${k.titre ?? r.nom.replace(/\.[a-z0-9]+$/i, "")} » par ${k.auteur} (${k.lien})${k.licence ? `, licence ${k.licence}` : ""}, via ${k.source}`;
    if (!lignes.includes(ligne)) lignes.push(ligne);
  }
  return lignes;
}
