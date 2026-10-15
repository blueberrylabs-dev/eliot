// La parole des sons et des vidéos (étape 4, lot 7), en fonctions pures : où couper les blancs
// et les hésitations d'un clip, puis le couper en morceaux qui se suivent. Le noyau mesure où
// l'on parle et transcrit mot par mot (`noyau/src/parole.rs`) ; ici, on décide ce qu'on garde.
// Comme CapCut, la coupe se voit dans la frise : chaque morceau est un clip qu'on peut rallonger
// pour rendre ce qui a été coupé (l'original n'est jamais touché, règle 13).

import { couperCles } from "./animation";
import { dureeClip, normaliser, PISTE_PRINCIPALE, type Durees } from "./frise";
import { boucle, partieJouee } from "./son";
import type { Animations, ClipAudio, CleAnimation, ElementPage, ElementVideo, PageEliot, Temps } from "./types";

/** Un mot dit, en ms du fichier. */
export interface MotTranscrit {
  /** Tel que Whisper l'écrit, ponctuation comprise. */
  texte: string;
  debut: number;
  fin: number;
  /** La confiance de Whisper, de 0 à 1. */
  proba: number;
}

/** Ce que le noyau sait de la parole d'un fichier (son ou vidéo). */
export interface AnalyseParole {
  version: number;
  /** Durée du son, en ms. */
  duree: number;
  /** Les passages où l'on parle, `[début, fin]` en ms du fichier. */
  parole: [number, number][];
  transcription?: { modele: string; langue: string; mots: MotTranscrit[] };
}

/** Une langue de transcription : le français, l'anglais, ou celle que Whisper reconnaît. */
export type LangueParole = "fr" | "en" | "auto";

/**
 * Une hésitation : « euh », « heu », « hum », « hmm », « mmh » (et « um », « uh », « erm » en
 * anglais), quelle que soit la façon dont Whisper l'écrit (« Euuuh… »). « eu » (le verbe avoir)
 * n'en est pas une.
 */
export function estHesitation(texte: string): boolean {
  const t = texte.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
  return /^(e+u+h+|h+e+u+h*|e+u{2,}h*|h+u+m+|h+m+|m+h+|m{2,}|h+m+h+|u+m+|u+h+m*|e+r+m+)$/.test(t);
}

const rond = (v: number) => Math.round(v);

/** `a` privé de `b` (intervalles triés ou non, sans chevauchement dans `a`). */
export function soustraire(a: readonly Temps[], b: readonly Temps[]): Temps[] {
  let reste = a.map((x) => ({ ...x }));
  for (const c of b) {
    reste = reste.flatMap((x) => {
      if (c.fin <= x.debut || c.debut >= x.fin) return [x];
      const morceaux: Temps[] = [];
      if (c.debut > x.debut) morceaux.push({ debut: x.debut, fin: c.debut });
      if (c.fin < x.fin) morceaux.push({ debut: c.fin, fin: x.fin });
      return morceaux;
    });
  }
  return reste.sort((x, y) => x.debut - y.debut);
}

/** Les intervalles réunis quand ils se touchent ou se chevauchent. */
export function reunir(a: readonly Temps[]): Temps[] {
  const tries = [...a].sort((x, y) => x.debut - y.debut);
  const sortie: Temps[] = [];
  for (const x of tries) {
    const d = sortie[sortie.length - 1];
    if (d && x.debut <= d.fin) d.fin = Math.max(d.fin, x.fin);
    else sortie.push({ ...x });
  }
  return sortie;
}

export interface OptionsBlancs {
  /** Un blanc plus long que cela (ms) est raccourci. */
  silenceMin: number;
  /** Ce qu'on garde de chaque blanc raccourci, de chaque côté de la voix (ms). */
  marge: number;
  /** Retirer aussi les hésitations (il faut la transcription). */
  hesitations: boolean;
}

export const OPTIONS_BLANCS: OptionsBlancs = { silenceMin: 600, marge: 120, hesitations: true };
/** Les bornes du réglage « blancs de plus de… » (ms). */
export const SILENCE_MIN = { min: 300, max: 2000 };
/** Un morceau gardé plus court que cela est retiré lui aussi (un bout de souffle). */
export const MORCEAU_MIN = 100;
/** Le son monte et descend en 10 ms à chaque coupe : pas de clic. */
export const FONDU_COUPE = 10;

/** Les hésitations dites dans la fenêtre `[debut, fin]` (ms du fichier). */
export function hesitationsDans(analyse: AnalyseParole, fenetre: Temps): Temps[] {
  return (analyse.transcription?.mots ?? [])
    .filter((m) => estHesitation(m.texte) && m.fin > fenetre.debut && m.debut < fenetre.fin)
    .map((m) => ({ debut: Math.max(fenetre.debut, m.debut), fin: Math.min(fenetre.fin, m.fin) }));
}

/**
 * Ce qu'on garde de la fenêtre `[debut, fin]` d'un fichier (ms) : un blanc plus long que
 * `silenceMin` est raccourci (on garde `marge` ms contre la voix ; au début et à la fin de la
 * fenêtre, rien), une hésitation est retirée, avec le blanc qui l'entoure s'il est long. Renvoie
 * les parties gardées, dans l'ordre ; toute la fenêtre si rien n'est à couper.
 */
export function partiesAGarder(fenetre: Temps, analyse: AnalyseParole, o: OptionsBlancs): Temps[] {
  const { debut: a, fin: b } = fenetre;
  if (!(b > a)) return [];
  const hesitations = o.hesitations ? hesitationsDans(analyse, fenetre) : [];
  // La voix sans les hésitations ; les blancs sont tout le reste (hésitations comprises).
  const passages = analyse.parole.map(([d, f]) => ({ debut: Math.max(a, d), fin: Math.min(b, f) })).filter((x) => x.fin > x.debut);
  const voix = soustraire(passages, hesitations);
  const blancs = soustraire([{ debut: a, fin: b }], voix);
  const coupes: Temps[] = [];
  for (const s of blancs) {
    const dedans = hesitations.filter((h) => h.debut < s.fin && h.fin > s.debut);
    if (s.fin - s.debut >= o.silenceMin) {
      let d = s.debut === a ? a : s.debut + o.marge;
      let f = s.fin === b ? b : s.fin - o.marge;
      // L'hésitation part toute entière, même si la marge la touchait.
      for (const h of dedans) {
        d = Math.min(d, h.debut);
        f = Math.max(f, h.fin);
      }
      if (f > d) coupes.push({ debut: d, fin: f });
    } else coupes.push(...dedans);
  }
  return soustraire([{ debut: a, fin: b }], reunir(coupes))
    .filter((x) => x.fin - x.debut >= MORCEAU_MIN)
    .map((x) => ({ debut: rond(x.debut), fin: rond(x.fin) }));
}

/** Le temps retiré par une coupe : la fenêtre moins ce qu'on garde (ms du fichier). */
export const tempsRetire = (fenetre: Temps, garder: readonly Temps[]): number => fenetre.fin - fenetre.debut - garder.reduce((n, g) => n + g.fin - g.debut, 0);

// ---- Les clips à couper ----

/** La partie du fichier que joue une vidéo, en ms du fichier. */
export function fenetreVideo(e: ElementVideo, dureeFichier: number | undefined): Temps {
  const debut = Math.max(0, e.coupe?.debut ?? 0);
  const fin = Math.min(e.coupe?.fin ?? Number.POSITIVE_INFINITY, dureeFichier ?? Number.POSITIVE_INFINITY);
  return { debut, fin: Math.max(debut, fin) };
}

/** Un son détaché de cette vidéo : même fichier, même partie, même moment, même vitesse. */
const lies = (v: ElementVideo, c: ClipAudio) =>
  c.ressource === v.ressource && !!v.temps && Math.abs(c.temps.debut - v.temps.debut) <= 1 && (c.coupe?.debut ?? 0) === (v.coupe?.debut ?? 0) && (v.vitesse ?? 1) === 1 && !boucle(c);

/** Ce qu'une coupe touche : la vidéo (si c'en est une) et les sons qui en jouent la même
 *  partie au même moment (son détaché) ; ou un son seul. `null` : rien à couper ici. */
export function clipsACouper(page: PageEliot, id: string): { video?: ElementVideo; sons: ClipAudio[]; ressource: string } | null {
  const e = page.elements.find((x) => x.id === id);
  if (e) {
    if (e.type !== "video" || !e.temps) return null;
    return { video: e, sons: (page.audio ?? []).filter((c) => lies(e, c)), ressource: e.ressource };
  }
  const c = page.audio?.find((x) => x.id === id);
  if (!c || boucle(c)) return null;
  const v = page.elements.find((x): x is ElementVideo => x.type === "video" && lies(x, c));
  return v ? { video: v, sons: (page.audio ?? []).filter((x) => lies(v, x)), ressource: c.ressource } : { sons: [c], ressource: c.ressource };
}

/** La fenêtre du fichier que joue ce qu'on coupe. */
export function fenetreACouper(cible: NonNullable<ReturnType<typeof clipsACouper>>, durees: Durees): Temps {
  return cible.video ? fenetreVideo(cible.video, durees(cible.ressource)) : partieJouee(cible.sons[0], durees(cible.ressource));
}

/** Les clés d'un clip entre `t1` et `t2` ms de son début, ramenées au début du morceau. */
function clesEntre(el: ElementPage, t1: number, t2: number): CleAnimation[] | undefined {
  if (!el.cles?.length) return undefined;
  const apres = t1 > 0 ? couperCles(el, t1).apres : el.cles;
  if (!apres?.length) return undefined;
  return couperCles({ ...el, cles: apres } as ElementPage, t2 - t1).avant;
}

/** Les animations d'un morceau : l'entrée au premier, la sortie au dernier, la boucle à tous. */
function animationsDuMorceau(a: Animations | undefined, premier: boolean, dernier: boolean): { animations?: Animations } {
  if (!a) return {};
  const propre: Animations = {};
  if (premier && a.entree) propre.entree = a.entree;
  if (dernier && a.sortie) propre.sortie = a.sortie;
  if (a.boucle) propre.boucle = a.boucle;
  return Object.keys(propre).length ? { animations: propre } : {};
}

/**
 * Coupe un clip (vidéo ou son) pour ne garder que `garder` (ms du fichier, dans l'ordre, dans
 * la partie jouée) : un morceau par partie gardée, à la suite les uns des autres. Le premier
 * garde l'identifiant, l'entrée et la transition ; le dernier la sortie et le fondu de fin ; à
 * chaque coupe, le son passe par un fondu de 10 ms. Sur la piste principale, la suite se
 * resserre ; ailleurs, les morceaux se suivent depuis le début du clip. Un son détaché de la
 * vidéo est coupé avec elle, morceau pour morceau. Renvoie la page et les identifiants des
 * morceaux de la vidéo (ou du son).
 */
export function couperEnMorceaux(page: PageEliot, id: string, garder: readonly Temps[], durees: Durees, nouvelId: (prefixe?: string) => string): { page: PageEliot; morceaux: string[] } {
  const cible = clipsACouper(page, id);
  if (!cible || garder.length === 0) return { page, morceaux: [] };
  const fenetre = fenetreACouper(cible, durees);
  const parts = garder.map((g) => ({ debut: rond(Math.max(fenetre.debut, g.debut)), fin: rond(Math.min(fenetre.fin, g.fin)) })).filter((g) => g.fin - g.debut >= 1);
  if (parts.length === 0) return { page, morceaux: [] };
  const n = parts.length;
  const fondus = (k: number, entree: number | undefined, sortie: number | undefined) => ({
    ...(k === 0 ? (entree ? { fonduEntree: entree } : {}) : { fonduEntree: FONDU_COUPE }),
    ...(k === n - 1 ? (sortie ? { fonduSortie: sortie } : {}) : { fonduSortie: FONDU_COUPE }),
  });
  let elements = page.elements;
  const morceaux: string[] = [];
  if (cible.video) {
    const e = cible.video;
    const v = e.vitesse ?? 1;
    const fichier = durees(e.ressource);
    const principale = e.piste === PISTE_PRINCIPALE;
    let curseur = e.temps!.debut;
    const nouveaux = parts.map((g, k) => {
      const idMorceau = k === 0 ? e.id : nouvelId();
      morceaux.push(idMorceau);
      const sansFin = e.coupe?.fin === undefined && fichier !== undefined && g.fin >= fichier;
      const coupe = { debut: g.debut, ...(sansFin ? {} : { fin: g.fin }) };
      // La durée que la normalisation lui donnera (à la milliseconde) : les morceaux d'une
      // superposition se suivent sans se chevaucher.
      const longueur = dureeClip({ ...e, coupe } as ElementVideo, durees);
      // Sur la piste principale, l'ordre suffit : la normalisation les met bout à bout.
      const debut = principale ? e.temps!.debut + k * 0.001 : curseur;
      curseur += longueur;
      const t1 = (g.debut - fenetre.debut) / v;
      const cles = clesEntre(e, t1, t1 + (g.fin - g.debut) / v);
      const { animations: _a, cles: _c, transition, fonduEntree: _fe, fonduSortie: _fs, coupe: _cp, ...reste } = e;
      return {
        ...reste,
        id: idMorceau,
        coupe,
        temps: { debut, fin: debut + longueur },
        ...animationsDuMorceau(e.animations, k === 0, k === n - 1),
        ...(cles ? { cles } : {}),
        ...(k === 0 && transition ? { transition } : {}),
        ...fondus(k, e.fonduEntree, e.fonduSortie),
      } as ElementVideo;
    });
    const rang = elements.indexOf(e);
    elements = [...elements.slice(0, rang), ...nouveaux, ...elements.slice(rang + 1)];
  }
  let audio = page.audio;
  if (cible.sons.length) {
    // Les sons détachés se recalent sur les morceaux de la vidéo une fois la suite resserrée.
    const posee = cible.video ? normaliser({ ...page, elements }, durees) : null;
    const tempsVideo = posee ? morceaux.map((m) => posee.elements.find((x) => x.id === m)!.temps!) : null;
    audio = (page.audio ?? []).flatMap((c) => {
      if (!cible.sons.includes(c)) return [c];
      let curseur = c.temps.debut;
      return parts.map((g, k) => {
        const idMorceau = k === 0 ? c.id : nouvelId("s");
        if (!cible.video) morceaux.push(idMorceau);
        const longueur = g.fin - g.debut;
        const temps = tempsVideo ? { ...tempsVideo[k] } : { debut: curseur, fin: curseur + longueur };
        curseur += longueur;
        const { fonduEntree: _fe, fonduSortie: _fs, coupe: _cp, ...reste } = c;
        return { ...reste, id: idMorceau, coupe: { debut: g.debut, fin: g.fin }, temps, ...fondus(k, c.fonduEntree, c.fonduSortie) } as ClipAudio;
      });
    });
  }
  return { page: normaliser({ ...page, elements, ...(audio ? { audio } : {}) }, durees), morceaux };
}
