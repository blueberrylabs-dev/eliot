// Références partagées vers la scène Konva, pour les éléments posés par-dessus (mini-barre,
// saisie du texte) et pour les dépôts (glisser depuis un panneau, fichiers). Écrites par
// ZoneDeTravail, lues ailleurs.

import type Konva from "konva";

export const scene = {
  stage: null as Konva.Stage | null,
  groupePage: null as Konva.Group | null,
  echelle: 1,
};

/** Retrouve le groupe Konva d'un élément, qu'il soit sur la page ou sur le calque de geste. */
export function noeudElement(id: string): Konva.Group | null {
  const stage = scene.stage;
  if (!stage) return null;
  return (stage.findOne((n: Konva.Node) => n.id() === id && n.hasName("element")) as Konva.Group | undefined) ?? null;
}

/** Un point de l'écran (coordonnées de la fenêtre) en pixels de la page, ou `null` s'il est
 *  hors de la zone de travail. */
export function pointDansLaPage(clientX: number, clientY: number): { x: number; y: number } | null {
  const { stage, groupePage } = scene;
  if (!stage || !groupePage) return null;
  const boite = stage.container().getBoundingClientRect();
  if (clientX < boite.left || clientX > boite.right || clientY < boite.top || clientY > boite.bottom) return null;
  const inverse = groupePage.getAbsoluteTransform().copy().invert();
  return inverse.point({ x: clientX - boite.left, y: clientY - boite.top });
}

// Petit signal « un geste est en cours » : la mini-barre s'efface pendant un glisser sans
// passer par le store (règle 3 : rien ne doit faire travailler React pendant le geste).
type Ecouteur = (actif: boolean) => void;
const ecouteurs = new Set<Ecouteur>();
export const surGeste = (fn: Ecouteur) => {
  ecouteurs.add(fn);
  return () => void ecouteurs.delete(fn);
};
export const signalerGeste = (actif: boolean) => ecouteurs.forEach((fn) => fn(actif));

// Le survol d'une ligne du panneau des calques (étape 7, lot 1) : la zone de travail entoure
// les éléments de la ligne (`null` : plus rien).
type EcouteurSurvol = (ids: string[] | null) => void;
const ecouteursSurvol = new Set<EcouteurSurvol>();
export const surSurvolCalques = (fn: EcouteurSurvol) => {
  ecouteursSurvol.add(fn);
  return () => void ecouteursSurvol.delete(fn);
};
export const survolerCalques = (ids: string[] | null) => ecouteursSurvol.forEach((fn) => fn(ids));
