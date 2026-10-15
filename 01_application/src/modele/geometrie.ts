// Calculs de position, sans Konva ni React : aligner, répartir, redimensionner un design.
// Une boîte tournée pivote autour de son coin haut gauche (types.ts), comme dans Konva.

import type { ElementPage, Format } from "./types";

export interface Boite {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

/** Le rectangle droit qui contient l'élément une fois tourné. */
export function boiteEnglobante(el: Pick<ElementPage, "x" | "y" | "largeur" | "hauteur" | "rotation">): Boite {
  const a = (el.rotation * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const coins = [
    [0, 0],
    [el.largeur, 0],
    [el.largeur, el.hauteur],
    [0, el.hauteur],
  ].map(([px, py]) => [el.x + px * cos - py * sin, el.y + px * sin + py * cos]);
  const xs = coins.map((c) => c[0]);
  const ys = coins.map((c) => c[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, largeur: Math.max(...xs) - x, hauteur: Math.max(...ys) - y };
}

/** La boîte qui contient tous les éléments. */
export function boiteDe(elements: ElementPage[]): Boite {
  const boites = elements.map(boiteEnglobante);
  const x = Math.min(...boites.map((b) => b.x));
  const y = Math.min(...boites.map((b) => b.y));
  return {
    x,
    y,
    largeur: Math.max(...boites.map((b) => b.x + b.largeur)) - x,
    hauteur: Math.max(...boites.map((b) => b.y + b.hauteur)) - y,
  };
}

export type SensAlignement = "gauche" | "centre" | "droite" | "haut" | "milieu" | "bas";

const arrondi = (v: number) => Math.round(v * 100) / 100;

/**
 * Déplacements pour aligner chaque élément sur la référence (la page pour un objet seul, la
 * boîte de la sélection pour plusieurs). Les éléments d'un même groupe bougent ensemble : on
 * passe alors des « blocs » (un tableau par groupe).
 */
export function aligner(blocs: ElementPage[][], sens: SensAlignement, reference: Boite): Record<string, { x: number; y: number }> {
  const sortie: Record<string, { x: number; y: number }> = {};
  for (const bloc of blocs) {
    const b = boiteDe(bloc);
    let dx = 0;
    let dy = 0;
    if (sens === "gauche") dx = reference.x - b.x;
    if (sens === "centre") dx = reference.x + reference.largeur / 2 - (b.x + b.largeur / 2);
    if (sens === "droite") dx = reference.x + reference.largeur - (b.x + b.largeur);
    if (sens === "haut") dy = reference.y - b.y;
    if (sens === "milieu") dy = reference.y + reference.hauteur / 2 - (b.y + b.hauteur / 2);
    if (sens === "bas") dy = reference.y + reference.hauteur - (b.y + b.hauteur);
    for (const el of bloc) sortie[el.id] = { x: arrondi(el.x + dx), y: arrondi(el.y + dy) };
  }
  return sortie;
}

/** Espace égal entre les blocs, le premier et le dernier restant à leur place (3 blocs au
 *  moins). */
export function repartir(blocs: ElementPage[][], axe: "horizontal" | "vertical"): Record<string, { x: number; y: number }> {
  const sortie: Record<string, { x: number; y: number }> = {};
  if (blocs.length < 3) return sortie;
  const h = axe === "horizontal";
  const avecBoite = blocs
    .map((bloc) => ({ bloc, b: boiteDe(bloc) }))
    .sort((p, q) => (h ? p.b.x + p.b.largeur / 2 - (q.b.x + q.b.largeur / 2) : p.b.y + p.b.hauteur / 2 - (q.b.y + q.b.hauteur / 2)));
  const debut = h ? avecBoite[0].b.x : avecBoite[0].b.y;
  const dernier = avecBoite[avecBoite.length - 1].b;
  const fin = h ? dernier.x + dernier.largeur : dernier.y + dernier.hauteur;
  const tailles = avecBoite.reduce((s, { b }) => s + (h ? b.largeur : b.hauteur), 0);
  const ecart = (fin - debut - tailles) / (avecBoite.length - 1);
  let curseur = debut;
  for (const { bloc, b } of avecBoite) {
    const delta = curseur - (h ? b.x : b.y);
    for (const el of bloc) sortie[el.id] = { x: arrondi(el.x + (h ? delta : 0)), y: arrondi(el.y + (h ? 0 : delta)) };
    curseur += (h ? b.largeur : b.hauteur) + ecart;
  }
  return sortie;
}

/**
 * Passe des éléments d'un format à un autre : tout est mis à l'échelle d'un même facteur
 * (le plus grand qui tient), puis centré. Les proportions de la composition sont gardées.
 */
export function redimensionnerElements(elements: ElementPage[], ancien: Format, nouveau: Format): ElementPage[] {
  const s = Math.min(nouveau.largeur / ancien.largeur, nouveau.hauteur / ancien.hauteur);
  const ox = (nouveau.largeur - ancien.largeur * s) / 2;
  const oy = (nouveau.hauteur - ancien.hauteur * s) / 2;
  const bord = (b: { couleur: string; epaisseur: number } | undefined) => (b ? { ...b, epaisseur: arrondi(b.epaisseur * s) } : b);
  return elements.map((el) => {
    const base = {
      ...el,
      x: arrondi(ox + el.x * s),
      y: arrondi(oy + el.y * s),
      largeur: Math.max(1, arrondi(el.largeur * s)),
      hauteur: Math.max(1, arrondi(el.hauteur * s)),
      ...(el.ombre ? { ombre: { ...el.ombre, flou: arrondi(el.ombre.flou * s), x: arrondi(el.ombre.x * s), y: arrondi(el.ombre.y * s) } } : {}),
    };
    switch (el.type) {
      case "texte":
        return {
          ...base,
          type: "texte",
          taillePolice: arrondi(el.taillePolice * s),
          espacement: arrondi(el.espacement * s),
          ...(el.contour ? { contour: bord(el.contour) } : {}),
          ...(el.surlignage ? { surlignage: { ...el.surlignage, marge: arrondi(el.surlignage.marge * s), arrondi: arrondi(el.surlignage.arrondi * s) } } : {}),
        } as ElementPage;
      case "forme":
        return { ...base, type: "forme", epaisseurContour: arrondi(el.epaisseurContour * s), arrondi: arrondi(el.arrondi * s) } as ElementPage;
      case "image":
      case "video":
        return { ...base, ...(el.arrondi ? { arrondi: arrondi(el.arrondi * s) } : {}), ...(el.bordure ? { bordure: bord(el.bordure) } : {}) } as ElementPage;
      case "cadre":
        return { ...base, type: "cadre", ...(el.bordure ? { bordure: bord(el.bordure) } : {}) } as ElementPage;
      case "graphique":
        return { ...base, type: "graphique", taillePolice: arrondi(el.taillePolice * s) } as ElementPage;
      case "tableau":
        return { ...base, type: "tableau", taillePolice: arrondi(el.taillePolice * s), marge: arrondi(el.marge * s), bordure: bord(el.bordure)! } as ElementPage;
      default:
        return base as ElementPage;
    }
  });
}
