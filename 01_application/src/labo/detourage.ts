// Le détourage d'une photo dans la fenêtre (étape 5, lot 7) : « Retirer le fond » lance le modèle
// (dans le noyau, sur le processeur), le masque rendu est gardé avec la photo et désigné par le
// document (`detourage.masque`) ; le pinceau reprend les bords, coup par coup, chaque coup une
// valeur du document. La page montre la photo composée avec son masque (le même calcul que
// l'export, `modele/detourage.ts`) ; l'export pose le masque sur l'original.

import { create } from "zustand";
import { elementsCourants, etiquetteDeGeste, useEditeur } from "../etat/editeur";
import { marquerToile } from "../editeur/images";
import { agrandir, appliquerCoups, combiner, couvrirSegment, normaliserDetourage, type Zone } from "../modele/detourage";
import { planPerspective, projeter } from "../modele/perspective";
import { matriceRognage } from "../modele/rognage";
import { sourcePlate } from "./moteurPerspective";
import type { CoupPinceau, Detourage, ElementImage, ElementPage } from "../modele/types";
import { annulerDetourage, etatDetourage, lancerDetourage, masqueDetourage, type EtatDetourage, type MasqueBrut } from "../pont/tauri";
import { cleContenu, useLabo } from "./retouche";

/** Le pinceau : garder ou effacer, son diamètre en pixels de l'écran, sa dureté (0 à 1). */
export interface ReglagePinceau {
  mode: CoupPinceau["mode"];
  taille: number;
  durete: number;
}

interface EtatDetourageFenetre {
  /** Le programme et le modèle (`undefined` : pas encore lu ; `null` : hors de la fenêtre). */
  programme: EtatDetourage | null | undefined;
  /** Le détourage en cours : quelle photo, où il en est (de 0 à 1). */
  enCours: { id: string; avancement: number } | null;
  /** La photo dont la page montre le pinceau, ou `null`. */
  pinceau: string | null;
  /** Son détourage à l'entrée du pinceau (Échap y revient). */
  entree: Detourage | null;
  reglage: ReglagePinceau;
}

export const TAILLE_PINCEAU_MIN = 4;
export const TAILLE_PINCEAU_MAX = 300;

export const useDetourage = create<EtatDetourageFenetre>(() => ({ programme: undefined, enCours: null, pinceau: null, entree: null, reglage: { mode: "effacer", taille: 40, durete: 0.6 } }));

/** Lit (ou relit) l'état du programme et du modèle. */
export async function lireEtatDetourage(): Promise<EtatDetourage | null> {
  try {
    const e = await etatDetourage();
    useDetourage.setState({ programme: e });
    return e;
  } catch {
    useDetourage.setState({ programme: null });
    return null;
  }
}

/** La photo `id` de la page affichée, si c'en est une. */
export function photoDetourable(id: string | null | undefined): ElementImage | undefined {
  if (!id) return undefined;
  const e = elementsCourants(useEditeur.getState()).find((x) => x.id === id);
  return e?.type === "image" ? e : undefined;
}

// ----------------------------------------------------------------------------------------
// Les masques du modèle, chargés une fois par design
// ----------------------------------------------------------------------------------------

const masques = new Map<string, MasqueBrut | "attente" | "erreur">();
const abonnes = new Map<string, Set<() => void>>();

/** Prévenu quand ce que la page doit montrer d'une photo détourée change. */
export function abonnerDetourage(id: string, f: () => void): () => void {
  if (!abonnes.has(id)) abonnes.set(id, new Set());
  abonnes.get(id)!.add(f);
  return () => abonnes.get(id)?.delete(f);
}

function prevenir(id?: string): void {
  if (id) for (const f of abonnes.get(id) ?? []) f();
  else for (const s of abonnes.values()) for (const f of s) f();
}

function cleMasque(nom: string): string | null {
  const p = useEditeur.getState().projet;
  return p ? `${p.rayon}/${p.id}/${nom}` : null;
}

/** Le masque `nom` s'il est déjà là ; sinon il est demandé, et la page prévenue à son arrivée. */
function masqueCharge(nom: string): MasqueBrut | undefined {
  const cle = cleMasque(nom);
  const projet = useEditeur.getState().projet;
  if (!cle || !projet) return undefined;
  const m = masques.get(cle);
  if (m && m !== "attente" && m !== "erreur") return m;
  if (!m) {
    masques.set(cle, "attente");
    masqueDetourage(projet, nom).then(
      (lu) => {
        masques.set(cle, lu);
        prevenir();
      },
      (e) => {
        console.warn(`masque du détourage : ${String(e)}`);
        masques.set(cle, "erreur");
      },
    );
  }
  return undefined;
}

/** Le masque d'une photo est-il prêt à être montré ? */
export function masquePret(nom: string): boolean {
  return !!masqueCharge(nom);
}

/** Le masque d'une photo n'a pas pu être lu (un design copié à la main sans ses masques) :
 *  il faut refaire le détourage. */
export function masqueIllisible(nom: string): boolean {
  const cle = cleMasque(nom);
  return !!cle && masques.get(cle) === "erreur";
}

// ----------------------------------------------------------------------------------------
// La photo composée avec son masque
// ----------------------------------------------------------------------------------------

interface Affichage {
  /** Le détourage du document que `alpha` montre. */
  detourage: Detourage;
  masque: MasqueBrut;
  l: number;
  h: number;
  alpha: Float32Array;
  donnees: ImageData;
  toileAlpha: HTMLCanvasElement;
  toile: HTMLCanvasElement;
  /** Ce qui est composé : contenu de la source, version du masque, fantôme. */
  compose: string;
  version: number;
}

const affichages = new Map<string, Affichage>();
/** Les toiles composées, pour l'export : l'ombre d'une photo détourée suit sa silhouette. */
const composees = new WeakMap<object, Affichage>();
/** La silhouette d'export de chaque affichage (son masque en PNG), gardée par version. */
const silhouettes = new WeakMap<Affichage, { version: number; href: string }>();
/** Le plus grand côté d'une silhouette d'ombre : l'ombre est floutée, ce côté suffit. */
const COTE_SILHOUETTE = 2048;

/**
 * La silhouette d'une image que la page dessine, si c'est une photo détourée : son masque, en
 * PNG (noir, transparent hors du premier plan), pour l'ombre que l'export pose sous elle. Sinon
 * `undefined`.
 */
export function silhouetteDetouree(source: unknown): string | undefined {
  const a = typeof source === "object" && source ? composees.get(source) : undefined;
  if (!a) return undefined;
  const gardee = silhouettes.get(a);
  if (gardee?.version === a.version) return gardee.href;
  const k = Math.min(1, COTE_SILHOUETTE / Math.max(a.l, a.h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(a.l * k));
  c.height = Math.max(1, Math.round(a.h * k));
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(a.toileAlpha, 0, 0, c.width, c.height);
  const href = c.toDataURL("image/png");
  silhouettes.set(a, { version: a.version, href });
  return href;
}

// Un autre design : ses masques et ses affichages ne servent plus.
useEditeur.subscribe((s, avant) => {
  if (s.projet !== avant.projet) {
    affichages.clear();
    coup = null;
    useDetourage.setState({ pinceau: null, enCours: null });
  }
});

/** Recopie `alpha` dans la toile du masque (sa transparence), sur `zone` ou partout. */
function ecrireAlpha(a: Affichage, zone?: Zone): void {
  const z = zone ?? { x0: 0, y0: 0, x1: a.l, y1: a.h };
  if (z.x0 >= z.x1 || z.y0 >= z.y1) return;
  const d = a.donnees.data;
  for (let y = z.y0; y < z.y1; y++) {
    for (let x = z.x0; x < z.x1; x++) {
      const i = y * a.l + x;
      d[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, a.alpha[i])) * 255);
    }
  }
  a.toileAlpha.getContext("2d")!.putImageData(a.donnees, 0, 0, z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0);
  a.version++;
}

function nouvelAffichage(d: Detourage, masque: MasqueBrut, l: number, h: number, existant?: Affichage): Affichage {
  const alpha = agrandir(masque.pixels, masque.largeur, masque.hauteur, l, h);
  if (d.coups?.length) appliquerCoups(alpha, l, h, d.coups);
  const toileAlpha = existant?.toileAlpha ?? document.createElement("canvas");
  const toile = existant?.toile ?? document.createElement("canvas");
  for (const t of [toileAlpha, toile]) {
    if (t.width !== l || t.height !== h) {
      t.width = l;
      t.height = h;
    }
  }
  const a: Affichage = { detourage: d, masque, l, h, alpha, donnees: new ImageData(l, h), toileAlpha, toile, compose: "", version: (existant?.version ?? 0) + 1 };
  ecrireAlpha(a);
  composees.set(toile, a);
  return a;
}

function tailleImage(i: CanvasImageSource): [number, number] {
  const s = i as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  return [s.naturalWidth || s.width || 1, s.naturalHeight || s.height || 1];
}

/**
 * Ce que la page dessine pour une photo détourée : sa source (aperçu ou toile retouchée) dont
 * la transparence suit le masque. `vivant` : la zone de travail (le pinceau y montre, à peine
 * visible, ce qui est retiré) ; sinon une vignette ou l'export. Sans détourage, ou tant que le
 * masque arrive, la source telle quelle.
 */
export function imageDetouree(el: ElementImage, image: CanvasImageSource, vivant: boolean): CanvasImageSource {
  const d = el.detourage;
  if (!d) return image;
  const masque = masqueCharge(d.masque);
  if (!masque) return image;
  const [l, h] = tailleImage(image);
  const cle = `${el.id}|${vivant ? "v" : "s"}`;
  let a = affichages.get(cle);
  if (!a || a.l !== l || a.h !== h || a.masque !== masque || (a.detourage !== d && !(coup?.id === el.id && vivant))) {
    a = nouvelAffichage(d, masque, l, h, a);
    affichages.set(cle, a);
  }
  const fantome = vivant && useDetourage.getState().pinceau === el.id;
  const contenu = cleContenu(image);
  const compose = contenu === null ? "" : `${contenu}|${a.version}|${fantome ? 1 : 0}`;
  if (compose === "" || compose !== a.compose) {
    const ctx = a.toile.getContext("2d")!;
    ctx.save();
    ctx.globalCompositeOperation = "copy";
    ctx.drawImage(image, 0, 0, l, h);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(a.toileAlpha, 0, 0);
    if (fantome) {
      // Ce qui est retiré, à peine visible sous la photo détourée : on voit où reprendre.
      ctx.globalCompositeOperation = "destination-over";
      ctx.globalAlpha = 0.28;
      ctx.drawImage(image, 0, 0, l, h);
    }
    ctx.restore();
    a.compose = compose;
  }
  marquerToile(a.toile, el.ressource);
  return a.toile;
}

// ----------------------------------------------------------------------------------------
// Retirer le fond, le remettre
// ----------------------------------------------------------------------------------------

/** Retire le fond de la photo `id` : le modèle (une fois par photo ; `forcer` le refait), puis
 *  le document. Renvoie le nom du masque ; une erreur dit pourquoi c'est impossible. */
export async function detourerPhoto(id: string, forcer = false): Promise<string> {
  const el = photoDetourable(id);
  const projet = useEditeur.getState().projet;
  if (!el || !projet) throw new Error("une photo de la page affichée");
  if (el.verrouille) throw new Error("cette photo est verrouillée");
  if (useDetourage.getState().enCours) throw new Error("un détourage est déjà en cours");
  useDetourage.setState({ enCours: { id, avancement: 0 } });
  try {
    const nom = await lancerDetourage(projet, el.ressource, forcer, (p) => {
      const e = useDetourage.getState().enCours;
      if (e?.id === id) useDetourage.setState({ enCours: { id, avancement: p } });
    });
    if (useEditeur.getState().projet !== projet || !photoDetourable(id)) throw new Error("la photo n'est plus là");
    // Refait par le modèle : un nouveau départ, sans les coups d'avant.
    const masque = cleMasque(nom);
    if (forcer && masque) masques.delete(masque);
    useEditeur.getState().modifierElements({ [id]: { detourage: { masque: nom } } as Partial<ElementPage> }, `detourer:${id}:${Date.now()}`);
    return nom;
  } finally {
    useDetourage.setState({ enCours: null });
  }
}

/** Le même depuis un bouton : le refus ou l'échec part en notification ; `null` alors. */
export async function retirerLeFond(id: string, forcer = false): Promise<string | null> {
  try {
    return await detourerPhoto(id, forcer);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (!/annul/i.test(m)) useEditeur.getState().notifier(`Détourage impossible : ${m}`);
    return null;
  }
}

/** Arrête le détourage en cours. */
export function arreterDetourage(): void {
  annulerDetourage();
}

/** Le fond rendu : la photo entière, sans masque ni coups. */
export function remettreLeFond(id: string): void {
  const el = photoDetourable(id);
  if (!el?.detourage) return;
  if (useDetourage.getState().pinceau === id) finirPinceau();
  useEditeur.getState().modifierElements({ [id]: { detourage: undefined } as Partial<ElementPage> }, `remettre-fond:${id}`);
}

/** Les coups de pinceau retirés : le masque du modèle seul. */
export function effacerLesCoups(id: string): void {
  const el = photoDetourable(id);
  if (!el?.detourage?.coups?.length) return;
  useEditeur.getState().modifierElements({ [id]: { detourage: { masque: el.detourage.masque } } as Partial<ElementPage> }, `coups-effaces:${id}`);
}

// ----------------------------------------------------------------------------------------
// Le pinceau
// ----------------------------------------------------------------------------------------

/** Le mode pinceau sur la page pour la photo `id` (détourée). */
export function commencerPinceau(id: string): boolean {
  const el = photoDetourable(id);
  if (!el?.detourage || el.verrouille) return false;
  if (useLabo.getState().ouvert !== id) useLabo.setState({ ouvert: id });
  const etat = useEditeur.getState();
  if (etat.selection.length !== 1 || etat.selection[0] !== id) etat.selectionner([id]);
  if (useDetourage.getState().pinceau !== id) useDetourage.setState({ pinceau: id, entree: el.detourage });
  prevenir(id);
  return true;
}

/** Fin du pinceau ; `annuler` : le détourage d'avant revient (une étape d'annulation). */
export function finirPinceau(annuler = false): void {
  const { pinceau: id, entree } = useDetourage.getState();
  if (coup) finirCoup();
  useDetourage.setState({ pinceau: null, entree: null });
  if (!id) return;
  const el = photoDetourable(id);
  if (annuler && el && entree && el.detourage !== entree && JSON.stringify(el.detourage) !== JSON.stringify(entree)) {
    useEditeur.getState().modifierElements({ [id]: { detourage: entree } as Partial<ElementPage> }, `pinceau-annule:${id}`);
  }
  prevenir(id);
}

/** Passe de « effacer » à « garder », et l'inverse (touche X). */
export function basculerModePinceau(): void {
  reglerPinceau({ mode: useDetourage.getState().reglage.mode === "effacer" ? "garder" : "effacer" });
}

/**
 * Le point `(x, y)` de la page vers l'image de la photo (fractions de sa largeur et de sa
 * hauteur ; hors de [0, 1] en dehors) : sans la position, la rotation et les retournements de
 * l'objet, puis sans sa perspective (lot 6) ou son recadrage (lot 5). `W` x `H` : l'original.
 */
export function pageVersImage(el: ElementImage, W: number, H: number, x: number, y: number): [number, number] | null {
  const t = (-el.rotation * Math.PI) / 180;
  const dx = x - el.x;
  const dy = y - el.y;
  let lx = dx * Math.cos(t) - dy * Math.sin(t);
  let ly = dx * Math.sin(t) + dy * Math.cos(t);
  if (el.retourneH) lx = el.largeur - lx;
  if (el.retourneV) ly = el.hauteur - ly;
  if (el.perspective) {
    const plan = planPerspective(el.perspective, el.largeur, el.hauteur);
    if (!plan) return null;
    const [u, v] = projeter(plan.inverse, lx, ly);
    const s = sourcePlate(el.rognage, W, H);
    return [s[0] * u + s[2] * v + s[4], s[1] * u + s[3] * v + s[5]];
  }
  const m = matriceRognage(el.rognage, W, H, el.largeur, el.hauteur);
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-12) return null;
  const ix = (m[3] * (lx - m[4]) - m[2] * (ly - m[5])) / det;
  const iy = (-m[1] * (lx - m[4]) + m[0] * (ly - m[5])) / det;
  return [ix / W, iy / H];
}

/** Combien de pixels de l'image tiennent dans un pixel de la page, autour de `(x, y)`. */
export function pixelsImageParPixelPage(el: ElementImage, W: number, H: number, x: number, y: number): number {
  const p = pageVersImage(el, W, H, x, y);
  const a = pageVersImage(el, W, H, x + 1, y);
  const b = pageVersImage(el, W, H, x, y + 1);
  if (!p || !a || !b) return 1;
  const la = Math.hypot((a[0] - p[0]) * W, (a[1] - p[1]) * H);
  const lb = Math.hypot((b[0] - p[0]) * W, (b[1] - p[1]) * H);
  return (la + lb) / 2 || 1;
}

export function reglerPinceau(r: Partial<ReglagePinceau>): void {
  const actuel = useDetourage.getState().reglage;
  const taille = Math.round(Math.min(TAILLE_PINCEAU_MAX, Math.max(TAILLE_PINCEAU_MIN, r.taille ?? actuel.taille)));
  const durete = Math.min(1, Math.max(0, r.durete ?? actuel.durete));
  useDetourage.setState({ reglage: { ...actuel, ...r, taille, durete } });
}

interface CoupEnCours {
  id: string;
  affichage: Affichage;
  depart: Float32Array;
  part: Float32Array;
  coup: CoupPinceau;
  /** Les points en pixels de l'image, et le rayon. */
  pixels: [number, number][];
  r: number;
  /** Le pas minimal entre deux points gardés (pixels de l'image). */
  pas: number;
}

let coup: CoupEnCours | null = null;

/** Un coup qui commence au point `p` (fractions de l'image) ; `rayon` en fraction de son grand
 *  côté. Faux si la photo n'est pas affichée détourée. */
export function commencerCoup(id: string, p: [number, number], rayon: number): boolean {
  const a = affichages.get(`${id}|v`);
  const el = photoDetourable(id);
  if (!a || !el?.detourage || !(rayon > 0)) return false;
  if (coup) finirCoup();
  const { mode, durete } = useDetourage.getState().reglage;
  const r = rayon * Math.max(a.l, a.h);
  coup = {
    id,
    affichage: a,
    depart: a.alpha.slice(),
    part: new Float32Array(a.l * a.h),
    coup: { mode, rayon, durete, points: [p] },
    pixels: [[p[0] * a.l, p[1] * a.h]],
    r,
    pas: Math.max(1, r / 4),
  };
  peindre(coup.pixels[0], coup.pixels[0]);
  return true;
}

function peindre(de: [number, number], vers: [number, number]): void {
  if (!coup) return;
  const a = coup.affichage;
  const image: Zone = { x0: 0, y0: 0, x1: a.l, y1: a.h };
  const z = couvrirSegment(coup.part, a.l, 0, 0, image, de, vers, coup.r, coup.coup.durete);
  combiner(a.alpha, coup.depart, a.l, coup.part, a.l, 0, 0, z, coup.coup.mode);
  ecrireAlpha(a, z);
  prevenir(coup.id);
}

/** Le coup passe par `p` (fractions de l'image). */
export function prolongerCoup(p: [number, number]): void {
  if (!coup) return;
  const a = coup.affichage;
  const px: [number, number] = [p[0] * a.l, p[1] * a.h];
  const dernier = coup.pixels[coup.pixels.length - 1];
  if (Math.hypot(px[0] - dernier[0], px[1] - dernier[1]) < coup.pas) return;
  coup.pixels.push(px);
  coup.coup.points.push(p);
  peindre(dernier, px);
}

/** Le coup fini entre dans le document (une étape d'annulation). */
export function finirCoup(): CoupPinceau | null {
  const c = coup;
  coup = null;
  if (!c) return null;
  const el = photoDetourable(c.id);
  if (!el?.detourage) return null;
  const detourage = normaliserDetourage({ masque: el.detourage.masque, coups: [...(el.detourage.coups ?? []), c.coup] })!;
  useEditeur.getState().modifierElements({ [c.id]: { detourage } as Partial<ElementPage> }, etiquetteDeGeste(`pinceau:${c.id}`));
  // L'affichage montre déjà ce coup : il devient celui du nouveau détourage, sans recalcul.
  const apres = photoDetourable(c.id)?.detourage;
  if (apres && c.affichage.detourage === el.detourage) c.affichage.detourage = apres;
  return c.coup;
}

// Le pinceau s'arrête quand la photo n'est plus la seule choisie, n'est plus là ou n'est plus
// détourée, et quand le labo se ferme ou passe à une autre photo.
useEditeur.subscribe((s, avant) => {
  const id = useDetourage.getState().pinceau;
  if (!id) return;
  if (s.projet !== avant.projet || s.pageActive !== avant.pageActive || s.selection.length !== 1 || s.selection[0] !== id || !photoDetourable(id)?.detourage) finirPinceau();
});
useLabo.subscribe((s) => {
  const id = useDetourage.getState().pinceau;
  if (id && s.ouvert !== id) finirPinceau();
});
