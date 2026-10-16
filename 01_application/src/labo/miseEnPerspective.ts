// La perspective d'une photo ou d'un clip dans le labo (étape 5, lot 6) : le mode « coins » de
// la page (quatre poignées, `CadrePerspective.tsx`), les perspectives prêtes, remettre à plat.
// Chaque geste est une modification du document : les coins et la boîte de l'élément, qui reste
// la plus petite boîte autour d'eux.

import { create } from "zustand";
import { useEditeur } from "../etat/editeur";
import { coinsEnPixels, PERSPECTIVES_PRETES, recaler, type Perspective, type Point } from "../modele/perspective";
import { versPage } from "../modele/rognage";
import type { ElementPage } from "../modele/types";
import { photoOuClip, type PhotoOuClip } from "./recadrage";
import { useLabo } from "./retouche";

interface Entree {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  perspective?: Perspective;
}

interface EtatPerspective {
  /** L'élément dont la page montre les quatre coins, ou `null`. */
  id: string | null;
  entree: Entree | null;
  /** Le dernier coin tiré (0 à 3) : les flèches le poussent. */
  coin: number | null;
}

export const usePerspective = create<EtatPerspective>(() => ({ id: null, entree: null, coin: null }));

/** Les quatre coins du visuel, en pixels de la boîte (repère de l'image, avant retournement). */
export function coinsDe(el: PhotoOuClip): Point[] {
  return el.perspective
    ? coinsEnPixels(el.perspective, el.largeur, el.hauteur)
    : [
        [0, 0],
        [el.largeur, 0],
        [el.largeur, el.hauteur],
        [0, el.hauteur],
      ];
}

/**
 * Pose de nouveaux coins (pixels de la boîte de `el`, repère de l'image) : la boîte devient leur
 * boîte, les coins y sont rangés en fractions. Renvoie faux si le quadrilatère ne tient pas
 * (croisé, retourné, trop mince) : rien ne change.
 */
export function poserCoins(el: PhotoOuClip, coins: Point[], etiquette: string): boolean {
  const r = recaler(coins);
  if (!r) return false;
  // Le nouveau coin de la boîte sur la page ; retournée, la boîte se lit de l'autre côté.
  const coin = versPage(el, el.retourneH ? r.x + r.largeur : r.x, el.retourneV ? r.y + r.hauteur : r.y);
  const plat = r.perspective.coins.every((c, i) => Math.abs(c[0] - [0, 1, 1, 0][i]) < 1e-5 && Math.abs(c[1] - [0, 0, 1, 1][i]) < 1e-5);
  useEditeur.getState().modifierElements({ [el.id]: { x: coin.x, y: coin.y, largeur: r.largeur, hauteur: r.hauteur, perspective: plat ? undefined : r.perspective } as Partial<ElementPage> }, etiquette);
  return true;
}

/** Un déplacement sur la page, dans le repère de la boîte d'un élément (sans sa rotation ni ses
 *  retournements). */
export function versBoite(el: PhotoOuClip, dx: number, dy: number): Point {
  const t = (-el.rotation * Math.PI) / 180;
  let lx = dx * Math.cos(t) - dy * Math.sin(t);
  let ly = dx * Math.sin(t) + dy * Math.cos(t);
  if (el.retourneH) lx = -lx;
  if (el.retourneV) ly = -ly;
  return [lx, ly];
}

/** Le coin `i` tiré de `dx`, `dy` (pixels de la page) depuis l'élément tel qu'il était au début
 *  du geste. */
export function tirerCoin(depart: PhotoOuClip, i: number, dx: number, dy: number, etiquette: string): boolean {
  const actuel = photoOuClip(depart.id);
  if (!actuel) return false;
  const [lx, ly] = versBoite(depart, dx, dy);
  const coins = coinsDe(depart).map((c, k) => (k === i ? [c[0] + lx, c[1] + ly] : c) as Point);
  // Le départ sert de repère : la boîte actuelle a pu bouger, on repart de celle du départ.
  return poserCoins(depart, coins, etiquette);
}

/** Le mode « coins » sur la page pour l'élément `id` (le labo s'ouvre dessus). */
export function commencerPerspective(id: string): void {
  const el = photoOuClip(id);
  if (!el || el.verrouille) return;
  if (useLabo.getState().ouvert !== id) useLabo.setState({ ouvert: id });
  if (usePerspective.getState().id === id) return;
  const etat = useEditeur.getState();
  if (etat.selection.length !== 1 || etat.selection[0] !== id) etat.selectionner([id]);
  usePerspective.setState({ id, entree: { x: el.x, y: el.y, largeur: el.largeur, hauteur: el.hauteur, perspective: el.perspective }, coin: null });
}

/** Fin du mode « coins » ; `annuler` : les coins et la boîte d'avant reviennent. */
export function finirPerspective(annuler = false): void {
  const { id, entree } = usePerspective.getState();
  usePerspective.setState({ id: null, entree: null, coin: null });
  if (!annuler || !id || !entree) return;
  const el = photoOuClip(id);
  if (!el) return;
  if (el.x === entree.x && el.y === entree.y && el.largeur === entree.largeur && el.hauteur === entree.hauteur && JSON.stringify(el.perspective) === JSON.stringify(entree.perspective)) return;
  useEditeur.getState().modifierElements({ [id]: { ...entree } as Partial<ElementPage> }, `perspective-annuler:${id}`);
}

/** Une perspective prête, posée sur la boîte de l'objet (un point de départ à ajuster). */
export function appliquerPerspectivePrete(id: string, pret: string): boolean {
  const el = photoOuClip(id);
  const p = PERSPECTIVES_PRETES.find((x) => x.id === pret);
  if (!el || !p) return false;
  return poserCoins(
    el,
    p.coins.map(([x, y]) => [x * el.largeur, y * el.hauteur] as Point),
    `perspective-prete:${id}:${Date.now()}`,
  );
}

/** Le visuel remis à plat : la boîte garde sa place, le visuel la remplit. */
export function remettreAPlat(id: string): void {
  const el = photoOuClip(id);
  if (!el?.perspective) return;
  useEditeur.getState().modifierElements({ [id]: { perspective: undefined } as Partial<ElementPage> }, `perspective-a-plat:${id}`);
}

// Le mode se termine quand l'élément n'est plus le seul choisi ou n'est plus là, et quand le
// labo se ferme ou passe à une autre photo.
useEditeur.subscribe((s, avant) => {
  const id = usePerspective.getState().id;
  if (!id) return;
  if (s.projet !== avant.projet || s.pageActive !== avant.pageActive || s.selection.length !== 1 || s.selection[0] !== id || !photoOuClip(id)) finirPerspective();
});
useLabo.subscribe((s) => {
  const id = usePerspective.getState().id;
  if (id && s.ouvert !== id) finirPerspective();
});
