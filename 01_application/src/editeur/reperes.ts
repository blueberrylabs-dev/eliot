// Repères magnétiques : pendant un glisser, l'objet s'aimante aux bords et aux centres de la
// page et des autres objets. Calcul pur, sur des boîtes en pixels de la page.

export interface Boite {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export interface Cibles {
  verticales: number[];
  horizontales: number[];
}

export interface Aimantation {
  dx: number;
  dy: number;
  verticales: number[];
  horizontales: number[];
}

export function cibles(page: { largeur: number; hauteur: number }, autres: Boite[]): Cibles {
  const verticales = [0, page.largeur / 2, page.largeur];
  const horizontales = [0, page.hauteur / 2, page.hauteur];
  for (const b of autres) {
    verticales.push(b.x, b.x + b.largeur / 2, b.x + b.largeur);
    horizontales.push(b.y, b.y + b.hauteur / 2, b.y + b.hauteur);
  }
  return { verticales, horizontales };
}

/** Plus petit décalage qui amène un bord ou le centre de `valeurs` sur une cible proche. */
function meilleurEcart(valeurs: number[], lignes: number[], seuil: number): number | null {
  let meilleur: number | null = null;
  for (const v of valeurs) {
    for (const l of lignes) {
      const ecart = l - v;
      if (Math.abs(ecart) <= seuil && (meilleur === null || Math.abs(ecart) < Math.abs(meilleur))) meilleur = ecart;
    }
  }
  return meilleur;
}

export function aimanter(boite: Boite, c: Cibles, seuil: number): Aimantation {
  const xs = [boite.x, boite.x + boite.largeur / 2, boite.x + boite.largeur];
  const ys = [boite.y, boite.y + boite.hauteur / 2, boite.y + boite.hauteur];
  const dx = meilleurEcart(xs, c.verticales, seuil) ?? 0;
  const dy = meilleurEcart(ys, c.horizontales, seuil) ?? 0;
  // Les repères à montrer : toutes les cibles atteintes une fois le décalage appliqué.
  const proche = (a: number, b: number) => Math.abs(a - b) < 0.5;
  const verticales = c.verticales.filter((l) => xs.some((v) => proche(v + dx, l)));
  const horizontales = c.horizontales.filter((l) => ys.some((v) => proche(v + dy, l)));
  return { dx, dy, verticales: [...new Set(verticales)], horizontales: [...new Set(horizontales)] };
}
