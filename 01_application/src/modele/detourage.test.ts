import { describe, expect, it } from "vitest";
import attendus from "./detourage.attendus.json";
import { agrandir, alleger, appliquerCoups, combiner, couverture, couvrirSegment, masqueALaTaille, normaliserDetourage } from "./detourage";
import type { CoupPinceau } from "./types";

const proches = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) expect(Math.abs(a[i] - b[i])).toBeLessThanOrEqual(1e-6 * (1 + Math.abs(b[i])));
};

describe("détourage (étape 5, lot 7) : le même calcul que le noyau", () => {
  it("la courbe du pinceau", () => {
    for (const c of attendus.courbe) expect(couverture(c.d, c.r, c.durete)).toBeCloseTo(c.c, 12);
  });

  it("le masque du modèle agrandi et réduit", () => {
    const m = attendus.masque;
    const source = Uint8Array.from(m.valeurs);
    proches(agrandir(source, m.largeur, m.hauteur, attendus.agrandi.largeur, attendus.agrandi.hauteur), attendus.agrandi.valeurs);
    proches(agrandir(source, m.largeur, m.hauteur, attendus.reduit.largeur, attendus.reduit.hauteur), attendus.reduit.valeurs);
  });

  it("les coups de pinceau, dans l'ordre", () => {
    const m = attendus.masque;
    const a = attendus.avecCoups;
    proches(masqueALaTaille({ largeur: m.largeur, hauteur: m.hauteur, pixels: Uint8Array.from(m.valeurs) }, attendus.coups as CoupPinceau[], a.largeur, a.hauteur), a.valeurs);
  });

  it("un coup tracé au fil de la souris donne le même masque que le coup entier", () => {
    const l = 60;
    const h = 40;
    const base = new Float32Array(l * h).fill(0.3);
    const coup: CoupPinceau = { mode: "effacer", rayon: 0.08, durete: 0.4, points: [[0.1, 0.2], [0.4, 0.5], [0.8, 0.45]] };
    const entier = base.slice();
    appliquerCoups(entier, l, h, [coup]);
    // Segment après segment, dans une grille de toute l'image.
    const part = new Float32Array(l * h);
    const vivant = base.slice();
    const pts = coup.points.map(([u, v]) => [u * l, v * h] as [number, number]);
    const r = coup.rayon * Math.max(l, h);
    const image = { x0: 0, y0: 0, x1: l, y1: h };
    for (let i = 1; i < pts.length; i++) {
      const z = couvrirSegment(part, l, 0, 0, image, pts[i - 1], pts[i], r, coup.durete);
      combiner(vivant, base, l, part, l, 0, 0, z, coup.mode);
    }
    proches(vivant, entier);
  });

  it("le document ne garde que des coups utiles ; un trait s'allège", () => {
    expect(normaliserDetourage(undefined)).toBeUndefined();
    expect(normaliserDetourage({ masque: "x", coups: [] })).toEqual({ masque: "x" });
    expect(normaliserDetourage({ masque: "x", coups: [{ mode: "garder", rayon: 0, durete: 1, points: [[0, 0]] }] })).toEqual({ masque: "x" });
    const trait: [number, number][] = Array.from({ length: 101 }, (_, i) => [i, 0]);
    const leger = alleger(trait, 10);
    expect(leger.length).toBe(11);
    expect(leger[leger.length - 1]).toEqual([100, 0]);
  });
});
