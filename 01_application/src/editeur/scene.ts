// Références partagées vers la scène Konva, pour l'export et les éléments posés par-dessus
// (mini-barre, saisie du texte). Écrites par ZoneDeTravail, lues ailleurs.

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

// Petit signal « un geste est en cours » : la mini-barre s'efface pendant un glisser sans
// passer par le store (règle 3 : rien ne doit faire travailler React pendant le geste).
type Ecouteur = (actif: boolean) => void;
const ecouteurs = new Set<Ecouteur>();
export const surGeste = (fn: Ecouteur) => {
  ecouteurs.add(fn);
  return () => void ecouteurs.delete(fn);
};
export const signalerGeste = (actif: boolean) => ecouteurs.forEach((fn) => fn(actif));
