// La frise d'une page vidéo (étape 4, lot 2), en fonctions pures : le store les appelle, les
// tests les vérifient. Le temps se compte en millisecondes entières de la page.
//
// Les pistes (BRIEF § 6) : la piste 0 est la piste principale, où les vidéos et les photos se
// suivent bout à bout, sans trou (supprimer un clip resserre la suite) ; au-dessus, les pistes
// 1, 2, 3… de superposition, où chaque clip a son début et sa fin, sans chevauchement sur une
// même piste. L'ordre d'empilement découle des pistes : le tableau `elements` est trié par
// piste, une piste plus haute passe devant.

import { dureeJouee } from "./fabriques";
import type { ElementPage, ElementVideo, PageEliot, Temps } from "./types";

export const PISTE_PRINCIPALE = 0;
/** Durée d'un texte, d'une forme ou d'une photo posés sur la frise. */
export const DUREE_CLIP = 3000;
/** Durée d'une page vidéo qui n'a pas encore de vidéo (post animé). */
export const DUREE_PAGE_DEFAUT = 5000;
export const DUREE_MIN = 100;

/** Durée d'un fichier vidéo, en millisecondes, d'après sa ressource ; `undefined` si inconnue. */
export type Durees = (ressource: string) => number | undefined;

export const estPageVideo = (p: PageEliot): boolean => p.duree !== undefined;
export const estMedia = (e: ElementPage): boolean => e.type === "video" || e.type === "image";
const arrondi = (t: number) => Math.round(t);

/** Durée d'un clip vidéo d'après sa coupe et sa vitesse (au moins 100 ms). */
function dureeVideo(e: ElementVideo, durees: Durees): number | undefined {
  const fichier = durees(e.ressource);
  return fichier === undefined ? undefined : Math.max(DUREE_MIN, arrondi(dureeJouee(e, fichier)));
}

/** Durée d'un clip sur la frise. */
export function dureeClip(e: ElementPage, durees: Durees): number {
  if (e.type === "video") {
    const d = dureeVideo(e, durees);
    if (d !== undefined) return d;
  }
  return e.temps ? Math.max(DUREE_MIN, e.temps.fin - e.temps.debut) : DUREE_CLIP;
}

/** L'élément se voit-il à l'instant `t` ? (Sans `temps`, toujours.) */
export const visibleA = (e: ElementPage, t: number): boolean => !e.temps || (t >= e.temps.debut && t < e.temps.fin);

/** L'instant à montrer quand la tête est au bout de la page : la dernière image, pas le noir. */
export const instantAffiche = (p: PageEliot, t: number): number => (p.duree !== undefined ? Math.max(0, Math.min(t, p.duree - 1)) : t);

/** Pour une vidéo, l'instant du fichier (ms) qui correspond à l'instant `t` de la page. */
export function tempsMedia(e: ElementVideo, t: number, dureeFichier?: number): number {
  const debut = e.coupe?.debut ?? 0;
  const fin = Math.min(e.coupe?.fin ?? Number.POSITIVE_INFINITY, dureeFichier ?? Number.POSITIVE_INFINITY);
  const depuis = e.temps ? t - e.temps.debut : t;
  return Math.max(debut, Math.min(fin, debut + depuis * (e.vitesse ?? 1)));
}

const chevauche = (a: Temps, b: Temps) => a.debut < b.fin && b.debut < a.fin;

/**
 * Remet une page vidéo d'aplomb après n'importe quelle modification : chaque élément a son
 * temps et sa piste, une vidéo dure ce que dit sa coupe, la piste principale n'a que des
 * vidéos et des photos posées bout à bout depuis 0, deux clips d'une même piste ne se
 * chevauchent pas (le second monte d'une piste), les pistes sont numérotées sans trou, le
 * tableau est trié par piste et la page dure jusqu'à la fin du dernier clip. Renvoie la même
 * page si rien ne change.
 */
export function normaliser(page: PageEliot, durees: Durees): PageEliot {
  if (!estPageVideo(page)) return page;
  const dureeParDefaut = Math.max(page.duree ?? DUREE_PAGE_DEFAUT, DUREE_MIN);
  // 1. Temps, piste et durée de chaque clip.
  // Les débuts gardent ici leurs décimales : un clip inséré à « bord − 0,5 » doit passer
  // avant le clip qui commence au bord. Tout est arrondi à la milliseconde à la fin.
  let clips = page.elements.map((e, rang) => {
    const piste = e.piste === undefined ? Number.POSITIVE_INFINITY : e.piste === PISTE_PRINCIPALE && !estMedia(e) ? 1 : Math.max(0, e.piste);
    const debut = e.temps?.debut ?? 0;
    const longueur = e.type === "video" ? dureeClip(e, durees) : e.temps ? Math.max(DUREE_MIN, arrondi(e.temps.fin - e.temps.debut)) : dureeParDefaut;
    return { e, rang, piste, debut, fin: debut + longueur };
  });
  // Un élément sans piste passe au-dessus de tout.
  const plusHaute = Math.max(0, ...clips.filter((c) => Number.isFinite(c.piste)).map((c) => c.piste));
  clips = clips.map((c) => (Number.isFinite(c.piste) ? c : { ...c, piste: plusHaute + 1 }));

  // 2. La piste principale : bout à bout depuis 0, dans l'ordre de leurs débuts.
  const principale = clips.filter((c) => c.piste === PISTE_PRINCIPALE).sort((a, b) => a.debut - b.debut || a.rang - b.rang);
  let curseur = 0;
  for (const c of principale) {
    const longueur = c.fin - c.debut;
    c.debut = curseur;
    c.fin = curseur + longueur;
    curseur = c.fin;
  }

  // 3. Les superpositions : un clip qui en chevauche un autre de sa piste monte d'un cran,
  //    sur une piste glissée juste au-dessus (elle est numérotée à l'étape suivante).
  let pistes = [...new Set(clips.filter((c) => c.piste > 0).map((c) => c.piste))].sort((a, b) => a - b);
  for (let i = 0; i < pistes.length; i++) {
    const p = pistes[i];
    const surPiste = clips.filter((c) => c.piste === p).sort((a, b) => a.debut - b.debut || a.rang - b.rang);
    const gardes: typeof surPiste = [];
    const montes: typeof surPiste = [];
    for (const c of surPiste) (gardes.some((g) => chevauche(g, c)) ? montes : gardes).push(c);
    if (montes.length) {
      const suivante = pistes[i + 1];
      const nouvelle = suivante === undefined ? p + 1 : (p + suivante) / 2;
      for (const c of montes) c.piste = nouvelle;
      pistes = [...new Set([...pistes, nouvelle])].sort((a, b) => a - b);
    }
  }

  // 4. Pistes numérotées 1, 2, 3… sans trou ; temps à la milliseconde.
  const rangs = new Map(pistes.map((p, i) => [p, i + 1]));
  for (const c of clips) {
    if (c.piste > 0) c.piste = rangs.get(c.piste)!;
    const longueur = arrondi(c.fin - c.debut);
    c.debut = Math.max(0, arrondi(c.debut));
    c.fin = c.debut + longueur;
  }

  // 5. Ordre d'empilement : par piste ; sur une même piste, où rien ne se chevauche, par
  //    ordre d'apparition.
  clips.sort((a, b) => a.piste - b.piste || a.debut - b.debut || a.rang - b.rang);
  const duree = clips.length ? Math.max(DUREE_MIN, ...clips.map((c) => c.fin)) : dureeParDefaut;

  let change = duree !== page.duree;
  const elements = clips.map((c, i) => {
    const e = c.e;
    if (page.elements[i] !== e) change = true;
    if (e.piste === c.piste && e.temps?.debut === c.debut && e.temps?.fin === c.fin) return e;
    change = true;
    return { ...e, piste: c.piste, temps: { debut: c.debut, fin: c.fin } } as ElementPage;
  });
  return change ? { ...page, elements, duree } : page;
}

/** La fin de la piste principale (0 si elle est vide). */
export const finPrincipale = (p: PageEliot): number => Math.max(0, ...p.elements.filter((e) => e.piste === PISTE_PRINCIPALE && e.temps).map((e) => e.temps!.fin));

/**
 * Fait d'une page fixe une page vidéo. Ses éléments gardent leur ordre d'empilement : chacun
 * sur sa piste de superposition, visible du début à la fin. La page dure autant que sa plus
 * longue vidéo, 5 s au moins (`dureeMin` l'allonge, pour une vidéo qu'on ajoute).
 */
export function versVideo(page: PageEliot, durees: Durees, dureeMin = 0): PageEliot {
  if (estPageVideo(page)) return page;
  const videos = page.elements.flatMap((e) => (e.type === "video" ? [dureeClip(e, durees)] : []));
  const duree = Math.max(DUREE_PAGE_DEFAUT, dureeMin, ...videos);
  const elements = page.elements.map((e, i) => ({ ...e, piste: i + 1, temps: { debut: 0, fin: e.type === "video" ? dureeClip(e, durees) : duree } }) as ElementPage);
  return normaliser({ ...page, duree, elements }, durees);
}

/** Fait d'une page vidéo une image fixe : les éléments perdent leur temps et leur piste. */
export function versFixe(page: PageEliot): PageEliot {
  if (!estPageVideo(page)) return page;
  const { duree: _duree, audio: _audio, ...reste } = page;
  return {
    ...reste,
    elements: page.elements.map((e) => {
      const { temps: _t, piste: _p, ...sans } = e;
      return sans as ElementPage;
    }),
  };
}

/** Les bords des clips de la piste principale, du début à la fin. */
function bordsPrincipale(p: PageEliot): number[] {
  return [0, ...p.elements.filter((e) => e.piste === PISTE_PRINCIPALE && e.temps).map((e) => e.temps!.fin)].sort((a, b) => a - b);
}

/**
 * Pose sur la frise des éléments neufs (sans `temps`), à la tête de lecture `tete` :
 * - une vidéo va sur la piste principale quand elle a déjà des clips, ou quand la page n'a
 *   rien d'autre ; elle se met au bout de la suite, ou juste après le clip sous la tête quand
 *   la tête est à l'intérieur de la suite (ni au début, ni au bout) ;
 * - le reste va au-dessus de tout ce qui se voit à ce moment-là, de la tête pendant 3 s (une
 *   vidéo : sa durée). Une photo aussi : un logo ou un autocollant ne doit pas couvrir la page.
 *   Glissée ensuite sur la piste principale, elle s'y range comme une vidéo (diaporama).
 */
export function placer(page: PageEliot, nouveaux: ElementPage[], tete: number, durees: Durees): PageEliot {
  if (!estPageVideo(page)) return { ...page, elements: [...page.elements, ...nouveaux] };
  let elements = [...page.elements];
  const principaleOccupee = () => elements.some((e) => e.piste === PISTE_PRINCIPALE);
  const pageSansRien = page.elements.length === 0;
  for (const e of nouveaux) {
    if (e.temps && e.piste !== undefined) {
      elements.push(e);
      continue;
    }
    const longueur = e.type === "video" ? dureeClip(e, durees) : DUREE_CLIP;
    if (e.type === "video" && (principaleOccupee() || pageSansRien)) {
      // Le bord qui suit la tête (ou la fin) ; le clip passe juste avant ce bord.
      const bords = bordsPrincipale({ ...page, elements });
      const fin = bords[bords.length - 1];
      const bord = tete > 0 && tete < fin ? bords.find((b) => b > tete)! : fin;
      elements.push({ ...e, piste: PISTE_PRINCIPALE, temps: { debut: bord - 0.5, fin: bord - 0.5 + longueur } } as ElementPage);
      // Les clips qui suivent glissent d'autant : la normalisation les remet bout à bout.
      elements = normaliser({ ...page, elements }, durees).elements;
      continue;
    }
    const temps = { debut: Math.max(0, arrondi(tete)), fin: Math.max(0, arrondi(tete)) + longueur };
    const dessous = elements.filter((x) => x.temps && x.piste !== undefined && chevauche(x.temps, temps));
    const piste = Math.max(0, ...dessous.map((x) => x.piste!)) + 1;
    elements.push({ ...e, piste, temps } as ElementPage);
  }
  return normaliser({ ...page, elements }, durees);
}

/**
 * Déplace un clip : nouveau début (ms) et piste voulue. Sur la piste principale, l'ordre suit
 * les débuts (le clip s'insère entre ses voisins) ; une piste de superposition occupée à cet
 * endroit fait monter le clip sur une piste neuve juste au-dessus. Un élément qui n'est ni une
 * vidéo ni une photo ne va pas sur la piste principale. `piste` au-dessus de la plus haute :
 * une piste neuve en haut.
 */
export function deplacerClip(page: PageEliot, id: string, debut: number, piste: number, durees: Durees): PageEliot {
  const e = page.elements.find((x) => x.id === id);
  if (!e || !e.temps || !estPageVideo(page)) return page;
  const longueur = dureeClip(e, durees);
  let cible = Math.max(0, Math.round(piste));
  if (cible === PISTE_PRINCIPALE && !estMedia(e)) cible = 1;
  let d = Math.max(0, arrondi(debut));
  if (cible === PISTE_PRINCIPALE) {
    // Le clip se glisse avant le premier voisin dont le milieu est après son propre début.
    const voisins = page.elements.filter((x) => x.id !== id && x.piste === PISTE_PRINCIPALE && x.temps);
    const apres = voisins.map((x) => x.temps!).filter((t) => (t.debut + t.fin) / 2 > d).sort((a, b) => a.debut - b.debut)[0];
    d = apres ? apres.debut - 0.5 : 1e12;
  }
  const temps = { debut: d, fin: d + longueur };
  let pisteFinale = cible;
  if (cible > PISTE_PRINCIPALE && page.elements.some((x) => x.id !== id && x.piste === cible && x.temps && chevauche(x.temps, temps))) pisteFinale = cible + 0.5;
  const elements = page.elements.map((x) => (x.id === id ? ({ ...x, piste: pisteFinale, temps } as ElementPage) : x));
  return normaliser({ ...page, elements }, durees);
}

/**
 * Tire un bord d'un clip jusqu'à l'instant `t` de la page. Une vidéo change sa coupe (sans
 * dépasser son fichier) ; un autre clip change son début ou sa fin. Un clip de superposition
 * s'arrête au bord de son voisin de piste. Au moins 100 ms restent.
 */
export function rogner(page: PageEliot, id: string, cote: "debut" | "fin", t: number, durees: Durees): PageEliot {
  const e = page.elements.find((x) => x.id === id);
  if (!e || !e.temps || !estPageVideo(page)) return page;
  const { debut, fin } = e.temps;
  let cible = arrondi(t);
  // Les voisins d'une superposition (et le début de la page) bornent le geste. Sur la piste
  // principale, tirer le bord gauche avant 0 rallonge le clip par le début.
  if (e.piste !== PISTE_PRINCIPALE) {
    const voisins = page.elements.filter((x) => x.id !== id && x.piste === e.piste && x.temps).map((x) => x.temps!);
    if (cote === "debut") cible = Math.max(cible, 0, ...voisins.filter((v) => v.fin <= debut).map((v) => v.fin));
    else cible = Math.min(cible, ...voisins.filter((v) => v.debut >= fin).map((v) => v.debut));
  } else if (cote === "fin") cible = Math.max(0, cible);
  if (e.type === "video") {
    const v = e.vitesse ?? 1;
    const fichier = durees(e.ressource) ?? Number.POSITIVE_INFINITY;
    const coupeDebut = e.coupe?.debut ?? 0;
    const coupeFin = Math.min(e.coupe?.fin ?? fichier, fichier);
    let coupe: { debut: number; fin?: number };
    let temps: Temps;
    if (cote === "debut") {
      const nouveau = Math.max(0, Math.min(coupeFin - DUREE_MIN * v, coupeDebut + (cible - debut) * v));
      coupe = { debut: arrondi(nouveau), ...(e.coupe?.fin !== undefined ? { fin: e.coupe.fin } : {}) };
      temps = { debut: arrondi(debut + (nouveau - coupeDebut) / v), fin };
    } else {
      const nouvelle = Math.min(fichier, Math.max(coupeDebut + DUREE_MIN * v, coupeDebut + (cible - debut) * v));
      coupe = { debut: coupeDebut, ...(nouvelle < fichier ? { fin: arrondi(nouvelle) } : {}) };
      temps = { debut, fin: arrondi(debut + (nouvelle - coupeDebut) / v) };
    }
    const sansCoupe = coupe.debut === 0 && coupe.fin === undefined;
    const elements = page.elements.map((x) => (x.id === id ? ({ ...x, coupe: sansCoupe ? undefined : coupe, temps } as ElementPage) : x));
    return normaliser({ ...page, elements }, durees);
  }
  const temps = cote === "debut" ? { debut: Math.min(cible, fin - DUREE_MIN), fin } : { debut, fin: Math.max(cible, debut + DUREE_MIN) };
  // Sur la piste principale, rogner le début raccourcit le clip (il garde sa place).
  const tempsFinal = e.piste === PISTE_PRINCIPALE && cote === "debut" ? { debut, fin: debut + (fin - temps.debut) } : temps;
  const elements = page.elements.map((x) => (x.id === id ? ({ ...x, temps: tempsFinal } as ElementPage) : x));
  return normaliser({ ...page, elements }, durees);
}

/**
 * Coupe en deux, à l'instant `t`, les clips dont `t` tombe à l'intérieur (100 ms au moins de
 * chaque côté). La seconde moitié reçoit un nouvel identifiant (`nouvelId`) ; une vidéo garde
 * la suite de son fichier. Renvoie la page et les identifiants des secondes moitiés.
 */
export function scinder(page: PageEliot, ids: string[], t: number, durees: Durees, nouvelId: () => string): { page: PageEliot; nouveaux: string[] } {
  const nouveaux: string[] = [];
  const instant = arrondi(t);
  const elements = page.elements.flatMap((e) => {
    if (!ids.includes(e.id) || !e.temps || instant - e.temps.debut < DUREE_MIN || e.temps.fin - instant < DUREE_MIN) return [e];
    const id = nouvelId();
    nouveaux.push(id);
    const premier = { ...e, temps: { debut: e.temps.debut, fin: instant } } as ElementPage;
    const second = { ...e, id, temps: { debut: instant, fin: e.temps.fin } } as ElementPage;
    if (e.type === "video") {
      const v = e.vitesse ?? 1;
      const coupeDebut = e.coupe?.debut ?? 0;
      const milieu = arrondi(coupeDebut + (instant - e.temps.debut) * v);
      (premier as ElementVideo).coupe = { debut: coupeDebut, fin: milieu };
      (second as ElementVideo).coupe = { debut: milieu, ...(e.coupe?.fin !== undefined ? { fin: e.coupe.fin } : {}) };
    }
    return [premier, second];
  });
  return { page: nouveaux.length ? normaliser({ ...page, elements }, durees) : page, nouveaux };
}

/**
 * Copies de clips placées juste après leur original : sur la piste principale, la copie
 * s'insère après lui ; sur une superposition, elle le suit sur la même piste si la place est
 * libre, sinon sur une piste neuve au-dessus. Les copies (déjà munies d'un nouvel identifiant)
 * arrivent dans `copies`, dans l'ordre des originaux `originaux`.
 */
export function dupliquerDansLeTemps(page: PageEliot, originaux: ElementPage[], copies: ElementPage[], durees: Durees): PageEliot {
  const elements = [...page.elements];
  copies.forEach((c, i) => {
    const o = originaux[i];
    if (!o?.temps) {
      elements.push(c);
      return;
    }
    const longueur = o.temps.fin - o.temps.debut;
    const temps = { debut: o.piste === PISTE_PRINCIPALE ? o.temps.fin - 0.5 : o.temps.fin, fin: o.temps.fin + longueur };
    let piste = o.piste ?? 1;
    if (piste > PISTE_PRINCIPALE && elements.some((x) => x.piste === piste && x.temps && chevauche(x.temps, temps))) piste += 0.5;
    elements.push({ ...c, x: o.x, y: o.y, piste, temps } as ElementPage);
  });
  return normaliser({ ...page, elements }, durees);
}

/** L'instant le plus proche parmi `cibles`, s'il est à moins de `seuil` ms ; sinon `t`. */
export function aimanter(t: number, cibles: number[], seuil: number): number {
  let meilleur = t;
  let ecart = seuil;
  for (const c of cibles) {
    const d = Math.abs(c - t);
    if (d <= ecart) {
      ecart = d;
      meilleur = c;
    }
  }
  return meilleur;
}

/** Les bords de tous les clips d'une page (sauf ceux de `sauf`), pour l'aimantation. */
export const bordsDesClips = (p: PageEliot, sauf?: string): number[] =>
  [0, ...p.elements.flatMap((e) => (e.id !== sauf && e.temps ? [e.temps.debut, e.temps.fin] : []))];

/** Les pistes d'une page vidéo, de la plus haute à la principale, avec leurs clips. */
export function pistesDe(p: PageEliot): { piste: number; clips: ElementPage[] }[] {
  const max = Math.max(0, ...p.elements.map((e) => e.piste ?? 0));
  const pistes: { piste: number; clips: ElementPage[] }[] = [];
  for (let n = max; n >= 0; n--) pistes.push({ piste: n, clips: p.elements.filter((e) => (e.piste ?? 0) === n) });
  return pistes;
}

/** Temps lisible pour la frise : « 0:03.2 », « 1:05.0 ». */
export function tempsLisible(ms: number): string {
  const total = Math.max(0, ms) / 1000;
  const minutes = Math.floor(total / 60);
  const secondes = total - minutes * 60;
  return `${minutes}:${secondes.toFixed(1).padStart(4, "0")}`;
}
