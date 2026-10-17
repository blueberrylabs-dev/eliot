// Tourner un objet 3D sur la page (étape 6, lot 1) : un double-clic sur l'objet, ou « Tourner »
// dans la barre, ouvre le mode : glisser tourne l'objet, la molette le rapproche, Maj et glisser
// le décale, les flèches le tournent de 5° (Maj : 15°). Entrée finit, Échap revient à la vue
// d'avant. Pendant un glisser, la caméra vit ici (règle 3) ; le document la reçoit au lâcher,
// une étape d'annulation par geste.
//
// Sur une page vidéo (lot 4), les gestes et les réglages changent la caméra de base de
// l'instant de la tête de lecture : celle de l'objet, ou, s'il a des images clés et que la tête
// est sur son clip, une image clé à cet instant (posée ou reprise), comme pour sa position. Le
// plateau tournant s'ajoute à ce qu'on montre, jamais à ce qu'on règle.

import { create } from "zustand";
import { clesActives, elementsCourants, etiquetteDeGeste, useEditeur } from "../etat/editeur";
import { useTemps } from "../etat/temps";
import { useLabo } from "../labo/retouche";
import { poserCle } from "../modele/animation";
import { cameraA, cameraDeBase, normaliserAnimationModele, normaliserPlateau } from "../modele/mouvement3d";
import { decaler, lumiereDe, normaliserCamera, normaliserLumiere, normaliserMatieres, normaliserOmbreSol, tourner, vuePrete, zoomer } from "../modele/objet3d";
import type { AnimationModele3d, Camera3d, CleAnimation, ElementObjet3d, ElementPage, Lumiere3d, Matiere3d, OmbreSol3d, Plateau3d } from "../modele/types";

interface EtatOrbite {
  /** L'objet en cours de réglage. */
  id: string | null;
  /** La caméra et les images clés d'avant le mode, pour Échap. */
  entree: { camera: Camera3d; cles?: CleAnimation[] } | null;
  /** La caméra pendant un glisser, avant d'aller au document. */
  geste: Camera3d | null;
  /** L'objet dont on tire un curseur du panneau 3D (sa toile s'affiche en direct). */
  curseur: string | null;
  /** Une matière désignée dans le panneau : l'objet la montre en couleur d'accent. */
  surligne: { id: string; matiere: string } | null;
}

export const useOrbite = create<EtatOrbite>(() => ({ id: null, entree: null, geste: null, curseur: null, surligne: null }));

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

/** La caméra montrée pour l'objet `id`, `tr` ms après le début de son clip : celle du geste en
 *  cours, sinon celle du document (ou de ses images clés), le plateau tournant ajouté. */
export function cameraAffichee(el: ElementObjet3d, geste: Camera3d | null, idGeste: string | null, tr = 0): Camera3d {
  return cameraA(el, tr, idGeste === el.id && geste ? geste : cameraDeBase(el, tr));
}

/** Où en est la tête de lecture dans le clip de l'objet (ms) ; 0 sur une image fixe. */
export const trALaTete = (el: ElementObjet3d): number => (el.temps ? useTemps.getState().tete - el.temps.debut : 0);

/** La caméra que les gestes et les réglages changent : celle de l'instant de la tête de lecture,
 *  sans le plateau. */
export const cameraCourante = (el: ElementObjet3d): Camera3d => cameraDeBase(el, trALaTete(el));

/** Le mode « Tourner » sur la page pour l'objet `id`. */
export function commencerOrbite(id: string): void {
  const el = objet3d(id);
  if (!el || el.verrouille) return;
  const etat = useEditeur.getState();
  if (etat.selection.length !== 1 || etat.selection[0] !== id) etat.selectionner([id]);
  if (useOrbite.getState().id === id) return;
  useOrbite.setState({ id, entree: { camera: el.camera, cles: el.cles }, geste: null });
}

/** Fin du mode ; `annuler` : la vue d'avant revient (une étape d'annulation). */
export function finirOrbite(annuler = false): void {
  const { id, entree, geste } = useOrbite.getState();
  if (geste && id) poserCamera(id, geste, etiquetteDeGeste(`tourner-3d:${id}`));
  useOrbite.setState({ id: null, entree: null, geste: null });
  const el = objet3d(id);
  if (annuler && el && entree && (JSON.stringify(el.camera) !== JSON.stringify(entree.camera) || JSON.stringify(el.cles) !== JSON.stringify(entree.cles))) {
    useEditeur.getState().modifierElements({ [el.id]: { camera: entree.camera, cles: entree.cles } as Partial<ElementPage> }, `tourner-3d-annuler:${el.id}`);
  }
}

/** La caméra d'un objet dans le document : la sienne, ou, s'il a des images clés et que la tête
 *  de lecture est sur son clip, une image clé à cet instant (lot 4). */
export function poserCamera(id: string, camera: Camera3d, etiquette?: string): void {
  const el = objet3d(id);
  if (!el || el.verrouille) return;
  const c = normaliserCamera(camera);
  const tete = useTemps.getState().tete;
  if (clesActives(el, tete)) {
    const tr = tete - el.temps!.debut;
    if (JSON.stringify(c) === JSON.stringify(normaliserCamera(cameraDeBase(el, tr)))) return;
    useEditeur.getState().modifierElements({ [id]: { cles: poserCle(el, tr, { camera: c }) } as Partial<ElementPage> }, etiquette);
    return;
  }
  if (JSON.stringify(c) === JSON.stringify(el.camera)) return;
  useEditeur.getState().modifierElements({ [id]: { camera: c } as Partial<ElementPage> }, etiquette);
}

/** La lumière d'un objet (lot 2) : `changer` reçoit la lumière actuelle, complète, et rend la
 *  nouvelle ; le document ne la garde que si elle n'est pas celle de départ. */
export function poserLumiere(id: string, changer: (l: Lumiere3d) => Lumiere3d, etiquette?: string): void {
  const el = objet3d(id);
  if (!el || el.verrouille) return;
  const l = normaliserLumiere(changer(lumiereDe(el.lumiere)));
  if (JSON.stringify(l) === JSON.stringify(el.lumiere)) return;
  useEditeur.getState().modifierElements({ [id]: { lumiere: l } as Partial<ElementPage> }, etiquette);
}

/** L'ombre au sol d'un objet ; `null` la retire. */
export function poserOmbreSol(id: string, ombre: Partial<OmbreSol3d> | null, etiquette?: string): void {
  const el = objet3d(id);
  if (!el || el.verrouille) return;
  const o = ombre === null ? undefined : normaliserOmbreSol({ ...el.ombreSol, ...ombre });
  if (JSON.stringify(o) === JSON.stringify(el.ombreSol)) return;
  useEditeur.getState().modifierElements({ [id]: { ombreSol: o } as Partial<ElementPage> }, etiquette);
}

/** Une matière d'un objet repeinte (`null` : remise comme dans le modèle), ou toutes
 *  (`nom` absent et `null`). */
export function poserMatiere(id: string, nom: string | null, matiere: Matiere3d | null, etiquette?: string): void {
  const el = objet3d(id);
  if (!el || el.verrouille) return;
  let suivantes: Record<string, Matiere3d> | undefined;
  if (nom === null) suivantes = matiere === null ? undefined : el.matieres;
  else {
    const toutes = { ...el.matieres };
    if (matiere === null) delete toutes[nom];
    else toutes[nom] = { ...toutes[nom], ...matiere };
    suivantes = normaliserMatieres(toutes);
  }
  if (JSON.stringify(suivantes) === JSON.stringify(el.matieres)) return;
  useEditeur.getState().modifierElements({ [id]: { matieres: suivantes } as Partial<ElementPage> }, etiquette);
}

/** Le plateau tournant d'un objet (lot 4) ; `null` le retire. */
export function poserPlateau(id: string, plateau: Partial<Plateau3d> | null, etiquette?: string): void {
  const el = objet3d(id);
  if (!el || el.verrouille) return;
  const p = plateau === null ? undefined : normaliserPlateau({ ...el.plateau, ...plateau });
  if (JSON.stringify(p) === JSON.stringify(el.plateau)) return;
  useEditeur.getState().modifierElements({ [id]: { plateau: p } as Partial<ElementPage> }, etiquette);
}

/** L'animation du modèle que joue un objet (lot 4) ; `null` la retire. */
export function poserAnimationModele(id: string, animation: Partial<AnimationModele3d> | null, etiquette?: string): void {
  const el = objet3d(id);
  if (!el || el.verrouille) return;
  const a = animation === null ? undefined : normaliserAnimationModele({ ...el.animationModele, ...animation });
  if (JSON.stringify(a) === JSON.stringify(el.animationModele)) return;
  useEditeur.getState().modifierElements({ [id]: { animationModele: a } as Partial<ElementPage> }, etiquette);
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
  poserCamera(id, zoomer(cameraCourante(el), facteur), `zoom-3d:${id}`);
}

/** Les flèches : tourner de 5° (15° avec Maj). */
export function flechesOrbite(id: string, touche: string, maj: boolean): void {
  const el = objet3d(id);
  if (!el) return;
  const pas = (maj ? 15 : 5) / 0.4;
  const dx = touche === "ArrowLeft" ? -pas : touche === "ArrowRight" ? pas : 0;
  const dy = touche === "ArrowUp" ? -pas : touche === "ArrowDown" ? pas : 0;
  poserCamera(id, tourner(cameraCourante(el), dx, dy), `fleches-3d:${id}`);
}

/** Une vue prête, posée tout de suite. */
export function appliquerVue(id: string, vue: string): boolean {
  const el = objet3d(id);
  const c = el && vuePrete(cameraCourante(el), vue);
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
