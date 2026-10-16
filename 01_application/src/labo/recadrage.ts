// Le recadrage d'une photo ou d'un clip dans le labo (étape 5, lot 5) : le mode recadrage de la
// page (cadre, poignées, grille des tiers, `CadreRognage.tsx`), les proportions prêtes, le
// redressement (curseur, « Auto », tracer l'horizon). Chaque geste est une modification du
// document : le recadrage de l'élément et sa boîte, qui suit le cadre gardé.

import { create } from "zustand";
import { elementsCourants, useEditeur } from "../etat/editeur";
import {
  agrandir,
  boiteApresRognage,
  boiteMemeCentre,
  deplacer,
  normaliserRognage,
  tirer,
  type Poignee,
  proportionner,
  rapportDe,
  redresser,
  rognageOuEntier,
  ROGNAGE_ENTIER,
  type Rognage,
} from "../modele/rognage";
import type { ElementImage, ElementPage, ElementVideo } from "../modele/types";
import { horizonLabo } from "../pont/tauri";
import { useLabo } from "./retouche";

export type PhotoOuClip = ElementImage | ElementVideo;

/** Ce que la page dessine en ce moment pour chaque photo ou clip (sa toile retouchée, sa vidéo) :
 *  le mode recadrage montre le reste de la même image autour du cadre. */
export const imagesAffichees = new Map<string, CanvasImageSource>();

interface Entree {
  id: string;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  rognage?: Rognage;
}

interface EtatRecadrage {
  /** L'élément dont la page montre le cadre et ses poignées, ou `null`. */
  id: string | null;
  /** La boîte et le recadrage à l'entrée du mode : Échap y revient. */
  entree: Entree | null;
  /** Les proportions gardées par les poignées (`libre` : aucune) et leur sens. */
  proportions: string;
  portrait: boolean;
  /** Le curseur d'angle est tiré : la page montre une grille fine. */
  redressement: boolean;
  /** « Tracer l'horizon » : le prochain glisser sur la page trace la ligne à remettre droite. */
  niveau: boolean;
}

export const useRecadrage = create<EtatRecadrage>(() => ({ id: null, entree: null, proportions: "libre", portrait: false, redressement: false, niveau: false }));

/** La photo ou le clip `id` de la page affichée. */
export function photoOuClip(id: string | null | undefined): PhotoOuClip | undefined {
  if (!id) return undefined;
  const e = elementsCourants(useEditeur.getState()).find((x) => x.id === id);
  return e && (e.type === "image" || e.type === "video") ? e : undefined;
}

/** Les dimensions de l'original d'une photo ou d'un clip (ses proportions). */
export function dimensionsOriginal(el: PhotoOuClip): [number, number] | null {
  const r = useEditeur.getState().ressources[el.ressource];
  return r && r.largeur > 0 && r.hauteur > 0 ? [r.largeur, r.hauteur] : null;
}

/** Le rapport (largeur sur hauteur) des proportions choisies, ou `null` pour libre. */
export function rapportChoisi(el: PhotoOuClip): number | null {
  const d = dimensionsOriginal(el);
  if (!d) return null;
  const { proportions, portrait } = useRecadrage.getState();
  return rapportDe(proportions, d[0], d[1], useEditeur.getState().document.format, portrait);
}

/**
 * Pose un nouveau recadrage sur l'élément. `mode` : `contenu`, la photo reste à sa place sur la
 * page et la boîte suit le cadre (poignées, proportions) ; `centre`, la boîte garde son centre
 * (et ses côtés si les proportions ne changent pas : redresser) ; `fixe`, la boîte ne bouge pas
 * et la photo glisse dessous (le cadre garde sa taille). `etiquette` : les gestes de même
 * étiquette font une seule étape d'annulation.
 */
export function poserRognage(el: PhotoOuClip, nouveau: Rognage | undefined, mode: "contenu" | "centre" | "fixe", etiquette: string): void {
  const d = dimensionsOriginal(el);
  if (!d) return;
  const [W, H] = d;
  const rognage = normaliserRognage(nouveau ?? ROGNAGE_ENTIER, W, H);
  if (mode === "fixe") {
    useEditeur.getState().modifierElements({ [el.id]: { rognage } as Partial<ElementPage> }, etiquette);
    return;
  }
  const apres = rognageOuEntier(rognage);
  const boiteDe = mode === "contenu" && Math.abs(apres.angle - rognageOuEntier(el.rognage).angle) < 1e-9 ? boiteApresRognage : boiteMemeCentre;
  const b = boiteDe(el, el.rognage, apres, W, H);
  useEditeur.getState().modifierElements({ [el.id]: { x: b.x, y: b.y, largeur: b.largeur, hauteur: b.hauteur, rognage } as Partial<ElementPage> }, etiquette);
}

/** Un déplacement sur la page (`dx`, `dy`), dans le repère de l'image redressée d'un élément
 *  (pixels de l'original) : sans sa rotation, sans ses retournements, à son échelle. */
export function versRepereImage(el: PhotoOuClip, dx: number, dy: number): [number, number] | null {
  const d = dimensionsOriginal(el);
  if (!d) return null;
  const g = rognageOuEntier(el.rognage);
  const t = (-el.rotation * Math.PI) / 180;
  let lx = dx * Math.cos(t) - dy * Math.sin(t);
  let ly = dx * Math.sin(t) + dy * Math.cos(t);
  if (el.retourneH) lx = -lx;
  if (el.retourneV) ly = -ly;
  return [lx / (el.largeur / (g.largeur * d[0])), ly / (el.hauteur / (g.hauteur * d[1]))];
}

/** La photo glisse sous le cadre de `dx`, `dy` (pixels de la page), depuis l'élément tel qu'il
 *  était au début du geste (`depart`). */
export function glisserImage(depart: PhotoOuClip, dx: number, dy: number, etiquette: string): void {
  const d = dimensionsOriginal(depart);
  const v = versRepereImage(depart, dx, dy);
  const actuel = photoOuClip(depart.id);
  if (!d || !v || !actuel) return;
  poserRognage(actuel, deplacer(depart.rognage, -v[0], -v[1], d[0], d[1]), "fixe", etiquette);
}

/** Une poignée du cadre tirée de `dx`, `dy` (pixels de la page) depuis le début du geste ;
 *  `garder` : garder les proportions du cadre de départ (Maj, en libre). */
export function tirerPoignee(depart: PhotoOuClip, poignee: Poignee, dx: number, dy: number, garder: boolean, etiquette: string): void {
  const d = dimensionsOriginal(depart);
  const v = versRepereImage(depart, dx, dy);
  const actuel = photoOuClip(depart.id);
  if (!d || !v || !actuel) return;
  const g = rognageOuEntier(depart.rognage);
  const ratio = rapportChoisi(depart) ?? (garder ? (g.largeur * d[0]) / (g.hauteur * d[1]) : null);
  poserRognage(actuel, tirer(depart.rognage, poignee, v[0], v[1], ratio, d[0], d[1]), "contenu", etiquette);
}

/** La molette sur le cadre : la photo grandit ou rapetisse sous le cadre (`k` > 1 : le cadre
 *  garde plus de la photo, elle paraît plus petite). */
export function zoomerSousLeCadre(id: string, k: number): void {
  const el = photoOuClip(id);
  const d = el && dimensionsOriginal(el);
  if (!el || !d) return;
  poserRognage(el, agrandir(el.rognage, k, d[0], d[1]), "fixe", `rogner-zoom:${id}`);
}

/** Le mode recadrage sur la page pour l'élément `id` (le labo s'ouvre dessus). */
export function commencerRecadrage(id: string): void {
  const el = photoOuClip(id);
  if (!el || el.verrouille) return;
  // En perspective (lot 6), le cadre de la boîte n'est plus celui du visuel : à plat d'abord.
  if (el.perspective) {
    useEditeur.getState().notifier("Ce visuel est en perspective : remets-le à plat (section Perspective) pour le recadrer.");
    return;
  }
  if (useLabo.getState().ouvert !== id) useLabo.setState({ ouvert: id });
  if (useRecadrage.getState().id === id) return;
  const etat = useEditeur.getState();
  if (etat.selection.length !== 1 || etat.selection[0] !== id) etat.selectionner([id]);
  useRecadrage.setState({ id, entree: { id, x: el.x, y: el.y, largeur: el.largeur, hauteur: el.hauteur, rognage: el.rognage }, niveau: false, redressement: false });
}

/** Fin du mode recadrage ; `annuler` : la boîte et le recadrage d'avant reviennent. */
export function finirRecadrage(annuler = false): void {
  const { id, entree } = useRecadrage.getState();
  useRecadrage.setState({ id: null, entree: null, niveau: false, redressement: false });
  if (!annuler || !id || !entree) return;
  const el = photoOuClip(id);
  if (!el) return;
  if (el.x === entree.x && el.y === entree.y && el.largeur === entree.largeur && el.hauteur === entree.hauteur && JSON.stringify(el.rognage) === JSON.stringify(entree.rognage)) return;
  useEditeur.getState().modifierElements({ [id]: { x: entree.x, y: entree.y, largeur: entree.largeur, hauteur: entree.hauteur, rognage: entree.rognage } as Partial<ElementPage> }, `rogner-annuler:${id}`);
}

/** Des proportions prêtes, appliquées tout de suite (le plus grand cadre de ces proportions). */
export function choisirProportions(id: string, proportions: string, portrait = useRecadrage.getState().portrait): void {
  useRecadrage.setState({ proportions, portrait });
  const el = photoOuClip(id);
  const d = el && dimensionsOriginal(el);
  if (!el || !d) return;
  const rapport = rapportDe(proportions, d[0], d[1], useEditeur.getState().document.format, portrait);
  if (rapport) poserRognage(el, proportionner(el.rognage, rapport, d[0], d[1]), "contenu", `rogner-proportions:${id}:${Date.now()}`);
}

/** Tourne le sens des proportions choisies (en largeur ou en hauteur). */
export function pivoterProportions(id: string): void {
  const { proportions, portrait } = useRecadrage.getState();
  if (proportions === "libre") {
    // Libre : le cadre actuel tourne d'un quart (ses proportions s'inversent).
    const el = photoOuClip(id);
    const d = el && dimensionsOriginal(el);
    if (!el || !d) return;
    const g = rognageOuEntier(el.rognage);
    poserRognage(el, proportionner(el.rognage, (g.hauteur * d[1]) / (g.largeur * d[0]), d[0], d[1]), "contenu", `rogner-pivoter:${id}:${Date.now()}`);
    return;
  }
  choisirProportions(id, proportions, !portrait);
}

/** Redresse l'élément de `angle` degrés depuis `depart` (le recadrage au début du geste : revenir
 *  à l'angle de départ rend le cadre d'avant). */
export function redresserElement(id: string, angle: number, depart: Rognage | undefined, etiquette: string): void {
  const el = photoOuClip(id);
  const d = el && dimensionsOriginal(el);
  if (!el || !d) return;
  poserRognage(el, redresser(depart, angle, d[0], d[1]), "centre", etiquette);
}

/** « Auto » : le noyau cherche la ligne la plus marquée et l'élément est redressé d'autant.
 *  Renvoie l'angle posé, ou `null` sans ligne assez nette. */
export async function redresserAuto(id: string): Promise<number | null> {
  const el = photoOuClip(id);
  const projet = useEditeur.getState().projet;
  if (!el || !projet) return null;
  const angle = await horizonLabo(projet, el.ressource);
  if (angle === null) return null;
  const actuel = photoOuClip(id);
  if (!actuel) return null;
  redresserElement(id, angle, actuel.rognage, `rogner-auto:${id}:${Date.now()}`);
  return angle;
}

/** La ligne tracée sur la page (`dx`, `dy` : sa direction dans la page) devient horizontale, ou
 *  verticale si elle est plus près de la verticale. */
export function redresserSelonLigne(id: string, dx: number, dy: number): number | null {
  const el = photoOuClip(id);
  if (!el || Math.hypot(dx, dy) < 1e-6) return null;
  // La direction dans le repère de l'image : sans la rotation de l'élément, sans retournement.
  const t = (-el.rotation * Math.PI) / 180;
  let lx = dx * Math.cos(t) - dy * Math.sin(t);
  let ly = dx * Math.sin(t) + dy * Math.cos(t);
  if (el.retourneH) lx = -lx;
  if (el.retourneV) ly = -ly;
  let a = (Math.atan2(ly, lx) * 180) / Math.PI;
  // De -90 à 90 ; puis l'écart à l'axe le plus proche.
  a = ((((a + 90) % 180) + 180) % 180) - 90;
  const ecart = Math.abs(a) <= 45 ? a : a > 0 ? a - 90 : a + 90;
  const angle = rognageOuEntier(el.rognage).angle - ecart;
  if (Math.abs(angle) > 45) return null;
  redresserElement(id, angle, el.rognage, `rogner-ligne:${id}:${Date.now()}`);
  return angle;
}

/** Toute l'image, droite : la boîte garde son centre et l'échelle de la photo. */
export function remettreRognage(id: string): void {
  const el = photoOuClip(id);
  const d = el && dimensionsOriginal(el);
  if (!el || !d || !el.rognage) return;
  const g = rognageOuEntier(el.rognage);
  const echelle = el.largeur / (g.largeur * d[0]);
  const t = (el.rotation * Math.PI) / 180;
  const cx = el.x + (el.largeur / 2) * Math.cos(t) - (el.hauteur / 2) * Math.sin(t);
  const cy = el.y + (el.largeur / 2) * Math.sin(t) + (el.hauteur / 2) * Math.cos(t);
  const largeur = d[0] * echelle;
  const hauteur = d[1] * echelle;
  useEditeur.getState().modifierElements(
    { [id]: { x: cx - (largeur / 2) * Math.cos(t) + (hauteur / 2) * Math.sin(t), y: cy - (largeur / 2) * Math.sin(t) - (hauteur / 2) * Math.cos(t), largeur, hauteur, rognage: undefined } as Partial<ElementPage> },
    `rogner-remettre:${id}`,
  );
}

// Le mode recadrage se termine quand l'élément n'est plus le seul choisi, ou n'est plus là, et
// quand le labo se ferme ou passe à une autre photo.
useEditeur.subscribe((s, avant) => {
  const id = useRecadrage.getState().id;
  if (!id) return;
  if (s.projet !== avant.projet || s.pageActive !== avant.pageActive || s.selection.length !== 1 || s.selection[0] !== id || !photoOuClip(id)) finirRecadrage();
});
useLabo.subscribe((s) => {
  const id = useRecadrage.getState().id;
  if (id && s.ouvert !== id) finirRecadrage();
});
