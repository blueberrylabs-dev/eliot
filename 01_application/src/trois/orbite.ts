// Tourner un objet 3D sur la page (étape 6, lot 1) : un double-clic sur l'objet, ou « Tourner »
// dans la barre, ouvre le mode : glisser tourne l'objet, la molette le rapproche, Maj et glisser
// le décale, les flèches le tournent de 5° (Maj : 15°). Entrée finit, Échap revient à la vue
// d'avant. Pendant un glisser, la caméra vit ici (règle 3) ; le document la reçoit au lâcher,
// une étape d'annulation par geste.

import { create } from "zustand";
import { elementsCourants, etiquetteDeGeste, useEditeur } from "../etat/editeur";
import { useLabo } from "../labo/retouche";
import { decaler, normaliserCamera, tourner, vuePrete, zoomer } from "../modele/objet3d";
import type { Camera3d, ElementObjet3d, ElementPage } from "../modele/types";

interface EtatOrbite {
  /** L'objet en cours de réglage. */
  id: string | null;
  /** La caméra d'avant le mode, pour Échap. */
  entree: Camera3d | null;
  /** La caméra pendant un glisser, avant d'aller au document. */
  geste: Camera3d | null;
}

export const useOrbite = create<EtatOrbite>(() => ({ id: null, entree: null, geste: null }));

/** Le panneau « 3D » de gauche, ouvert pour un objet (à la place du panneau de l'onglet, comme
 *  le labo d'une photo). */
export const usePanneau3d = create<{ ouvert: string | null }>(() => ({ ouvert: null }));

export function ouvrirPanneau3d(id: string): void {
  if (!objet3d(id)) return;
  useLabo.setState({ ouvert: null });
  usePanneau3d.setState({ ouvert: id });
}

export function objet3d(id: string | null | undefined): ElementObjet3d | undefined {
  if (!id) return undefined;
  const e = elementsCourants(useEditeur.getState()).find((x) => x.id === id);
  return e?.type === "objet3d" ? e : undefined;
}

/** La caméra montrée pour l'objet `id` : celle du geste en cours, sinon celle du document. */
export function cameraAffichee(el: ElementObjet3d, geste: Camera3d | null, idGeste: string | null): Camera3d {
  return idGeste === el.id && geste ? geste : el.camera;
}

/** Le mode « Tourner » sur la page pour l'objet `id`. */
export function commencerOrbite(id: string): void {
  const el = objet3d(id);
  if (!el || el.verrouille) return;
  const etat = useEditeur.getState();
  if (etat.selection.length !== 1 || etat.selection[0] !== id) etat.selectionner([id]);
  if (useOrbite.getState().id === id) return;
  useOrbite.setState({ id, entree: el.camera, geste: null });
}

/** Fin du mode ; `annuler` : la vue d'avant revient (une étape d'annulation). */
export function finirOrbite(annuler = false): void {
  const { id, entree, geste } = useOrbite.getState();
  if (geste && id) poserCamera(id, geste, etiquetteDeGeste(`tourner-3d:${id}`));
  useOrbite.setState({ id: null, entree: null, geste: null });
  const el = objet3d(id);
  if (annuler && el && entree && JSON.stringify(el.camera) !== JSON.stringify(entree)) poserCamera(el.id, entree, `tourner-3d-annuler:${el.id}`);
}

/** La caméra d'un objet dans le document. */
export function poserCamera(id: string, camera: Camera3d, etiquette?: string): void {
  const el = objet3d(id);
  if (!el || el.verrouille) return;
  const c = normaliserCamera(camera);
  if (JSON.stringify(c) === JSON.stringify(el.camera)) return;
  useEditeur.getState().modifierElements({ [id]: { camera: c } as Partial<ElementPage> }, etiquette);
}

/** Un glisser en cours : `dx`, `dy` depuis le début, en pixels de l'écran ; `maj` décale au
 *  lieu de tourner. `hauteur` : la hauteur de l'objet à l'écran. */
export function glisserOrbite(depart: Camera3d, dx: number, dy: number, maj: boolean, hauteur: number, aspect: number): void {
  const camera = maj ? decaler(depart, dx, dy, hauteur, aspect) : tourner(depart, dx, dy);
  useOrbite.setState({ geste: camera });
}

/** Le lâcher : le geste va au document, une étape d'annulation. */
export function lacherOrbite(id: string): void {
  const { geste } = useOrbite.getState();
  // Le document d'abord : la page ne remontre pas un instant la vue d'avant le geste.
  if (geste) poserCamera(id, geste, etiquetteDeGeste(`tourner-3d:${id}`));
  useOrbite.setState({ geste: null });
}

/** La molette : `facteur` plus grand que 1 rapproche ; les crans qui se suivent font une seule
 *  étape d'annulation. */
export function molette(id: string, facteur: number): void {
  const el = objet3d(id);
  if (!el) return;
  poserCamera(id, zoomer(el.camera, facteur), `zoom-3d:${id}`);
}

/** Les flèches : tourner de 5° (15° avec Maj). */
export function flechesOrbite(id: string, touche: string, maj: boolean): void {
  const el = objet3d(id);
  if (!el) return;
  const pas = (maj ? 15 : 5) / 0.4;
  const dx = touche === "ArrowLeft" ? -pas : touche === "ArrowRight" ? pas : 0;
  const dy = touche === "ArrowUp" ? -pas : touche === "ArrowDown" ? pas : 0;
  poserCamera(id, tourner(el.camera, dx, dy), `fleches-3d:${id}`);
}

/** Une vue prête, posée tout de suite. */
export function appliquerVue(id: string, vue: string): boolean {
  const el = objet3d(id);
  const c = el && vuePrete(el.camera, vue);
  if (!c) return false;
  poserCamera(id, c, `vue-3d:${id}:${vue}`);
  return true;
}

// Le mode se ferme si l'objet disparaît, change de page ou n'est plus le seul choisi.
useEditeur.subscribe((s, avant) => {
  const { id } = useOrbite.getState();
  if (!id) return;
  if (s.projet !== avant.projet || s.pageActive !== avant.pageActive || s.selection.length !== 1 || s.selection[0] !== id || !objet3d(id)) finirOrbite();
});
