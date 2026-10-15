// Les sous-titres automatiques (étape 4, lot 7). Whisper transcrit la voix dans le noyau ; ici,
// en fonctions pures, les mots sont ramenés au temps de la page, groupés en sous-titres courts,
// et chaque groupe devient un texte de la frise qui garde le temps de ses mots
// (`sousTitre.mots`). Pendant la lecture et à l'export, le mot prononcé est mis en valeur, à la
// façon des vidéos TikTok. Les deux formules du mot prononcé (`tempsDesMots`, `motActif`) sont
// reprises par le Rust de l'export (`noyau/src/sous_titres.rs`), contrôlées par le tableau
// commun `sousTitres.attendus.json`.

import { boucle, partieJouee } from "./son";
import { DUREE_MIN, normaliser, type Durees } from "./frise";
import { estHesitation, fenetreVideo, type AnalyseParole } from "./parole";
import { estVerticale916 } from "./zonesSures";
import type { Animations, ElementPage, ElementTexte, Format, PageEliot, Ressource, SousTitre, Temps } from "./types";

// ---- Le mot prononcé (formules communes avec le Rust) ----

export interface TempsMot {
  debut: number;
  fin: number;
}

/** Les temps des `n` mots du texte : ceux de la transcription quand le compte y est ; sinon (le
 *  texte a été retouché), la durée des mots partagée également entre eux. */
export function tempsDesMots(mots: readonly TempsMot[], n: number): TempsMot[] {
  if (n <= 0 || mots.length === 0) return [];
  if (mots.length === n) return mots.map((m) => ({ debut: m.debut, fin: m.fin }));
  const debut = mots[0].debut;
  const fin = Math.max(debut, mots[mots.length - 1].fin);
  const pas = (fin - debut) / n;
  return Array.from({ length: n }, (_, i) => ({ debut: debut + pas * i, fin: debut + pas * (i + 1) }));
}

/** Le rang du mot prononcé à `tr` ms du début du sous-titre : le dernier mot commencé (il le
 *  reste jusqu'au suivant) ; -1 avant le premier. */
export function motActif(mots: readonly TempsMot[], n: number, tr: number): number {
  const t = tempsDesMots(mots, n);
  let actif = -1;
  for (let i = 0; i < t.length; i++) if (t[i].debut <= tr) actif = i;
  return actif;
}

/** Le nombre de mots d'un texte, comme les compte le dessin lettre par lettre. */
export const nombreDeMots = (texte: string): number => texte.split(/\s+/).filter(Boolean).length;

export const estSousTitre = (e: ElementPage): e is ElementTexte & { sousTitre: SousTitre } => e.type === "texte" && !!e.sousTitre;

// ---- Les styles ----

export interface StyleSousTitres {
  id: string;
  libelle: string;
  /** En quelques mots, pour l'onglet Textes. */
  description: string;
  police: string;
  /** Taille de police pour une page de 1080 px de large. */
  taille: number;
  gras: boolean;
  couleur: string;
  /** Contour, bande, ombre, d'après la taille réelle. */
  effets: (taille: number) => Partial<ElementTexte>;
  majuscules: boolean;
  actif?: { couleur: string; echelle: number };
  progressif?: boolean;
  animations?: Animations;
  /** Au plus tant de mots, et tant de lettres (espaces comprises), par sous-titre. */
  maxMots: number;
  maxLettres: number;
  /** Sans points ni virgules en fin de mot (les ? et ! restent). */
  sansPoints: boolean;
  /** Largeur du texte, en part de la largeur de la page. */
  largeur: number;
}

export const STYLES_SOUS_TITRES: StyleSousTitres[] = [
  {
    id: "surligne",
    libelle: "Mot surligné",
    description: "Trois mots au plus, le mot dit en jaune",
    police: "Montserrat",
    taille: 70,
    gras: true,
    couleur: "#ffffff",
    effets: (t) => ({ contour: { couleur: "#000000", epaisseur: Math.max(2, Math.round(t * 0.09)) }, surlignage: undefined, ombre: undefined }),
    majuscules: false,
    actif: { couleur: "#ffd60a", echelle: 1.12 },
    maxMots: 3,
    maxLettres: 22,
    sansPoints: true,
    largeur: 0.84,
  },
  {
    id: "mot",
    libelle: "Un mot à la fois",
    description: "Un seul mot, en grand",
    police: "Anton",
    taille: 110,
    gras: false,
    couleur: "#ffffff",
    effets: (t) => ({ contour: { couleur: "#000000", epaisseur: Math.max(2, Math.round(t * 0.07)) }, surlignage: undefined, ombre: undefined }),
    majuscules: true,
    animations: { entree: { nom: "zoom", duree: 100 } },
    maxMots: 1,
    maxLettres: 20,
    sansPoints: true,
    largeur: 0.84,
  },
  {
    id: "progressif",
    libelle: "Mot après mot",
    description: "Les mots apparaissent quand ils sont dits",
    police: "Poppins",
    taille: 62,
    gras: true,
    couleur: "#ffffff",
    effets: (t) => ({ contour: { couleur: "#000000", epaisseur: Math.max(2, Math.round(t * 0.08)) }, surlignage: undefined, ombre: undefined }),
    majuscules: false,
    actif: { couleur: "#4ade80", echelle: 1 },
    progressif: true,
    maxMots: 5,
    maxLettres: 30,
    sansPoints: true,
    largeur: 0.84,
  },
  {
    id: "classique",
    libelle: "Classique",
    description: "Une phrase sur une bande noire",
    police: "Inter",
    taille: 44,
    gras: true,
    couleur: "#ffffff",
    effets: (t) => ({ surlignage: { couleur: "#000000", marge: Math.round(t * 0.28), arrondi: Math.round(t * 0.2) }, contour: undefined, ombre: undefined }),
    majuscules: false,
    maxMots: 9,
    maxLettres: 42,
    sansPoints: false,
    largeur: 0.84,
  },
];

export const styleSousTitres = (id: string | undefined): StyleSousTitres => STYLES_SOUS_TITRES.find((s) => s.id === id) ?? STYLES_SOUS_TITRES[0];

/** La hauteur du milieu des sous-titres, en part de la hauteur de la page : en 9:16, juste
 *  au-dessus de la zone où TikTok, Reels et Shorts écrivent ; ailleurs, dans le bas de l'image. */
export const centreParDefaut = (format: Format): number => (estVerticale916(format) ? 0.66 : 0.8);

// ---- Les mots de la page ----

/** Un clip dont la voix se sous-titre : une vidéo qu'on entend, ou un son au rôle voix. */
export interface SourceParole {
  id: string;
  genre: "video" | "son";
  ressource: string;
  /** Où il est sur la page (ms de la page). */
  temps: Temps;
  /** La partie du fichier qu'il joue (ms du fichier). */
  fenetre: Temps;
  vitesse: number;
}

export function sourcesDeParole(page: PageEliot, ressources: Record<string, Ressource>): SourceParole[] {
  const sources: SourceParole[] = [];
  for (const e of page.elements) {
    if (e.type !== "video" || !e.temps || (e.volume ?? 1) <= 0 || !ressources[e.ressource]?.video?.son) continue;
    sources.push({ id: e.id, genre: "video", ressource: e.ressource, temps: e.temps, fenetre: fenetreVideo(e, ressources[e.ressource].video!.duree), vitesse: e.vitesse ?? 1 });
  }
  for (const c of page.audio ?? []) {
    if (c.role !== "voix" || boucle(c) || (c.volume ?? 1) <= 0) continue;
    const duree = ressources[c.ressource]?.son?.duree ?? ressources[c.ressource]?.video?.duree;
    sources.push({ id: c.id, genre: "son", ressource: c.ressource, temps: c.temps, fenetre: partieJouee(c, duree), vitesse: 1 });
  }
  return sources;
}

/** Un mot dit, au temps de la page. */
export interface MotPlace {
  texte: string;
  debut: number;
  fin: number;
  /** La ressource d'où il vient. */
  source: string;
}

/** Les mots que la page fait entendre, dans l'ordre : ceux de la transcription de chaque source,
 *  dans la partie qu'elle joue, ramenés au temps de la page. Sans les hésitations, sauf demande. */
export function motsDeLaPage(sources: readonly SourceParole[], analyses: Record<string, AnalyseParole | undefined>, options: { hesitations?: boolean } = {}): MotPlace[] {
  const mots: MotPlace[] = [];
  for (const s of sources) {
    const t = analyses[s.ressource]?.transcription;
    if (!t) continue;
    const versPage = (x: number) => s.temps.debut + (Math.min(Math.max(x, s.fenetre.debut), s.fenetre.fin) - s.fenetre.debut) / s.vitesse;
    for (const m of t.mots) {
      if (!options.hesitations && estHesitation(m.texte)) continue;
      const milieu = (m.debut + m.fin) / 2;
      if (milieu < s.fenetre.debut || milieu >= s.fenetre.fin) continue;
      const debut = Math.round(Math.max(s.temps.debut, versPage(m.debut)));
      const fin = Math.round(Math.min(s.temps.fin, versPage(m.fin)));
      mots.push({ texte: m.texte, debut, fin: Math.max(fin, debut + 1), source: s.ressource });
    }
  }
  return mots.sort((a, b) => a.debut - b.debut);
}

/** Un mot tel qu'il s'écrit dans un sous-titre : sans le point ou la virgule de fin si le style
 *  le veut. Vide : rien à écrire (un signe seul). */
export function nettoyerMot(texte: string, sansPoints: boolean): string {
  let t = texte.trim();
  if (sansPoints) t = t.replace(/[.,;:…]+$/u, "");
  return /[\p{L}\p{N}%€$&+]/u.test(t) ? t : "";
}

const FIN_DE_PHRASE = /[.!?…]["»”)]*$/u;
const PAUSE_ECRITE = /[,;:]["»”)]*$/u;
/** Un silence plus long que cela entre deux mots commence un nouveau sous-titre. */
export const PAUSE_MAX = 600;

/**
 * Les mots groupés en sous-titres : une phrase, une pause (virgule, silence de plus de 0,6 s) ou
 * un changement de voix ferment un groupe ; un morceau de phrase trop long se partage en groupes
 * de tailles voisines (six mots par trois : 3 et 3, pas 3 et 1), dans les limites du style.
 */
export function grouperMots<M extends MotPlace>(mots: readonly M[], d: { maxMots: number; maxLettres: number }): M[][] {
  const maxMots = Math.max(1, Math.round(d.maxMots));
  const lettres = (g: readonly M[]) => g.reduce((n, m) => n + m.texte.length, 0) + Math.max(0, g.length - 1);
  // 1. Les morceaux de phrase.
  const morceaux: M[][] = [];
  let courant: M[] = [];
  for (const m of mots) {
    const p = courant[courant.length - 1];
    if (p && (FIN_DE_PHRASE.test(p.texte) || (PAUSE_ECRITE.test(p.texte) && courant.length >= 2) || m.debut - p.fin > PAUSE_MAX || m.source !== p.source)) {
      morceaux.push(courant);
      courant = [];
    }
    courant.push(m);
  }
  if (courant.length) morceaux.push(courant);
  // 2. Chaque morceau en groupes de tailles voisines, assez courts.
  const groupes: M[][] = [];
  for (const m of morceaux) {
    for (let n = Math.ceil(m.length / maxMots); n <= m.length; n++) {
      const parts: M[][] = [];
      let i = 0;
      for (let k = 0; k < n; k++) {
        const taille = Math.floor(m.length / n) + (k < m.length % n ? 1 : 0);
        parts.push(m.slice(i, i + taille));
        i += taille;
      }
      if (n === m.length || parts.every((g) => g.length <= maxMots && (g.length === 1 || lettres(g) <= d.maxLettres))) {
        groupes.push(...parts);
        break;
      }
    }
  }
  return groupes;
}

/** Un sous-titre reste 0,3 s après son dernier mot ; plus près du suivant que 0,7 s, il reste
 *  jusqu'à lui (pas de clignotement). */
export const TENUE = 300;
export const ENCHAINEMENT = 700;

/** Le temps de chaque sous-titre sur la page. */
export function tempsDesGroupes(groupes: readonly MotPlace[][], finPage?: number): Temps[] {
  return groupes.map((g, i) => {
    const debut = g[0].debut;
    const finMots = g[g.length - 1].fin;
    const suivant = groupes[i + 1]?.[0].debut;
    let fin = finMots + TENUE;
    if (suivant !== undefined) fin = suivant - finMots < ENCHAINEMENT ? suivant : Math.min(fin, suivant);
    if (finPage !== undefined) fin = Math.min(fin, finPage);
    return { debut, fin: Math.max(fin, debut + DUREE_MIN) };
  });
}

// ---- Les textes de la frise ----

/** Les réglages de l'onglet Textes. */
export interface ReglagesSousTitres {
  style: string;
  /** Le milieu des sous-titres, en part de la hauteur de la page. */
  centre?: number;
  /** Garder les hésitations à l'écrit. */
  hesitations?: boolean;
}

/** Ce qu'il faut savoir pour faire des sous-titres : le texte modèle (police, couleurs, effets,
 *  largeur, position, mise en valeur) et la façon de grouper les mots. */
export interface ModeleSousTitres {
  texte: ElementTexte;
  maxMots: number;
  maxLettres: number;
  sansPoints: boolean;
}

/** Le modèle d'un style pour une page : `base` est un texte neuf fait par `creerTexte` (avec la
 *  police, la taille et les effets du style), à placer et à compléter. */
export function modeleDuStyle(format: Format, style: StyleSousTitres, base: ElementTexte, centre = centreParDefaut(format)): ModeleSousTitres {
  const largeur = Math.round(format.largeur * style.largeur);
  const texte: ElementTexte = {
    ...base,
    largeur,
    x: Math.round((format.largeur - largeur) / 2),
    y: Math.round(centre * format.hauteur - base.hauteur / 2),
    ...(style.animations ? { animations: style.animations } : {}),
    sousTitre: { mots: [], style: style.id, ...(style.actif ? { actif: { ...style.actif } } : {}), ...(style.progressif ? { progressif: true } : {}) },
  };
  return { texte, maxMots: style.maxMots, maxLettres: style.maxLettres, sansPoints: style.sansPoints };
}

/** Le modèle tiré d'un sous-titre déjà posé (pour refaire les sous-titres pareils) : tout son
 *  aspect, et le groupement de son style. */
export function modeleDuSousTitre(el: ElementTexte): ModeleSousTitres {
  const style = styleSousTitres(el.sousTitre?.style);
  return { texte: el, maxMots: style.maxMots, maxLettres: style.maxLettres, sansPoints: style.sansPoints };
}

/**
 * Les sous-titres d'une suite de mots : un texte par groupe, copie du modèle (même milieu de
 * hauteur), avec son temps et celui de ses mots. `mesurer` donne la hauteur d'un texte (Konva
 * dans la fenêtre) ; `nouvelId` un identifiant neuf.
 */
export function creerSousTitres(mots: readonly MotPlace[], modele: ModeleSousTitres, mesurer: (el: ElementTexte) => number, nouvelId: () => string, finPage?: number): ElementTexte[] {
  // Le groupement lit la ponctuation d'origine ; l'écrit est nettoyé.
  const propres = mots.map((m) => ({ ...m, ecrit: nettoyerMot(m.texte, modele.sansPoints) })).filter((m) => m.ecrit);
  const groupes = grouperMots(propres, modele);
  const temps = tempsDesGroupes(groupes, finPage);
  const m = modele.texte;
  const milieu = m.y + m.hauteur / 2;
  return groupes.map((g, i) => {
    const t = temps[i];
    const texte = g.map((x) => x.ecrit).join(" ");
    const brouillon: ElementTexte = { ...m, id: nouvelId(), texte };
    const hauteur = mesurer(brouillon);
    const sousTitre: SousTitre = {
      ...m.sousTitre,
      mots: g.map((x) => ({ debut: x.debut - t.debut, fin: x.fin - t.debut })),
      source: g[0].source,
    };
    return { ...brouillon, hauteur, y: Math.round(milieu - hauteur / 2), temps: t, sousTitre };
  });
}

/**
 * Pose des sous-titres neufs sur la page, à la place des anciens de mêmes sources (`sources` :
 * les ressources dont on refait les sous-titres ; `null` : tous). Ils vont sur la piste des
 * anciens, sinon sur une piste neuve au-dessus de tout.
 */
export function poserSousTitres(page: PageEliot, nouveaux: readonly ElementTexte[], sources: ReadonlySet<string> | null, durees: Durees): PageEliot {
  const anciens = page.elements.filter((e) => estSousTitre(e) && (sources === null || sources.has(e.sousTitre.source ?? "")));
  const reste = page.elements.filter((e) => !anciens.includes(e));
  const piste = anciens.find((e) => e.piste !== undefined)?.piste ?? Math.max(0, ...reste.map((e) => e.piste ?? 0)) + 1;
  return normaliser({ ...page, elements: [...reste, ...nouveaux.map((n) => ({ ...n, piste }) as ElementTexte)] }, durees);
}

/** La fin de la page sans ses sous-titres (la fin des clips et des sons) : des sous-titres
 *  refaits ne la dépassent pas. */
export function finSansSousTitres(page: PageEliot): number {
  return Math.max(0, ...page.elements.filter((e) => !estSousTitre(e)).map((e) => e.temps?.fin ?? 0), ...(page.audio ?? []).map((c) => c.temps.fin));
}

/** Retire les sous-titres de la page. */
export function retirerSousTitres(page: PageEliot, durees: Durees): PageEliot {
  if (!page.elements.some(estSousTitre)) return page;
  return normaliser({ ...page, elements: page.elements.filter((e) => !estSousTitre(e)) }, durees);
}

/** Les modifications à porter sur tous les sous-titres de la page (taille, position, couleurs) :
 *  la taille change la hauteur (re-mesurée), la position garde le milieu commun. */
export function ajusterSousTitres(page: PageEliot, format: Format, changement: { taillePolice?: number; centre?: number; couleurActif?: string; majuscules?: boolean; couleur?: string }, mesurer: (el: ElementTexte) => number): Record<string, Partial<ElementTexte>> {
  const modifs: Record<string, Partial<ElementTexte>> = {};
  for (const e of page.elements) {
    if (!estSousTitre(e)) continue;
    const suivant: ElementTexte = {
      ...e,
      ...(changement.taillePolice !== undefined ? { taillePolice: changement.taillePolice } : {}),
      ...(changement.majuscules !== undefined ? { majuscules: changement.majuscules } : {}),
      ...(changement.couleur !== undefined ? { couleur: changement.couleur } : {}),
    };
    const hauteur = changement.taillePolice !== undefined || changement.majuscules !== undefined ? mesurer(suivant) : e.hauteur;
    const milieu = changement.centre !== undefined ? changement.centre * format.hauteur : e.y + e.hauteur / 2;
    const m: Partial<ElementTexte> = { hauteur, y: Math.round(milieu - hauteur / 2) };
    if (changement.taillePolice !== undefined) m.taillePolice = changement.taillePolice;
    if (changement.majuscules !== undefined) m.majuscules = changement.majuscules;
    if (changement.couleur !== undefined) m.couleur = changement.couleur;
    if (changement.couleurActif !== undefined && e.sousTitre.actif) m.sousTitre = { ...e.sousTitre, actif: { ...e.sousTitre.actif, couleur: changement.couleurActif } };
    modifs[e.id] = m;
  }
  return modifs;
}
