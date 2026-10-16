import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { echantillon, estAPlat, homographie, inverser, normaliserPerspective, projeter, quadrilatereValide, recaler, taillePlate, type Homographie, type Point } from "./perspective";

interface Cas {
  nom: string;
  coins: Point[];
  homographie: number[];
  inverse: number[];
  points: { plat: Point; page: Point; retour: Point }[];
  echantillons: { page: Point; couverture: number; bord: number; source: Point; tailleSource: number }[];
}

const tableau = JSON.parse(readFileSync(new URL("./perspective.attendus.json", import.meta.url), "utf8")) as { plat: [number, number]; arrondi: number; bordure: number; source: [number, number]; cas: Cas[] };

describe("perspective (étape 5, lot 6)", () => {
  it("les homographies, les points et les bords du tableau commun du noyau", () => {
    for (const c of tableau.cas) {
      const h = homographie(c.coins)!;
      h.forEach((v, i) => expect(v).toBeCloseTo(c.homographie[i], 9));
      const inv = inverser(h)!;
      inv.forEach((v, i) => expect(v).toBeCloseTo(c.inverse[i], 9));
      for (const p of c.points) {
        const q = projeter(h, p.plat[0], p.plat[1]);
        expect(q[0]).toBeCloseTo(p.page[0], 7);
        expect(q[1]).toBeCloseTo(p.page[1], 7);
      }
      const pc = { plan: h, source: [1, 0, 0, 1, 0, 0] as [number, number, number, number, number, number], plat: tableau.plat, arrondi: tableau.arrondi, bordure: { couleur: "#ffffff", epaisseur: tableau.bordure } };
      for (const e of c.echantillons) {
        const r = echantillon(inv as Homographie, pc, e.page[0], e.page[1], tableau.source[0], tableau.source[1]);
        expect(r.couverture).toBeCloseTo(e.couverture, 7);
        expect(r.bord).toBeCloseTo(e.bord, 7);
        expect(r.source[0]).toBeCloseTo(e.source[0], 7);
        expect(r.tailleSource).toBeCloseTo(e.tailleSource, 5);
      }
    }
  });

  it("un quadrilatère croisé, retourné ou trop mince est refusé", () => {
    expect(quadrilatereValide([[0, 0], [10, 0], [10, 10], [0, 10]])).toBe(true);
    expect(quadrilatereValide([[0, 0], [10, 10], [10, 0], [0, 10]])).toBe(false);
    expect(quadrilatereValide([[0, 0], [0, 10], [10, 10], [10, 0]])).toBe(false);
    // Presque plat d'un côté : sa surface est trop petite pour sa boîte.
    expect(quadrilatereValide([[0, 0], [10, 0], [10, 10], [9.95, 0.05]])).toBe(false);
    // Concave : un coin rentré.
    expect(quadrilatereValide([[0, 0], [10, 0], [3, 3], [0, 10]])).toBe(false);
  });

  it("des coins posés n'importe où : la boîte devient leur boîte", () => {
    const r = recaler([[-20, 10], [200, 0], [210, 110], [0, 100]])!;
    expect(r).toMatchObject({ x: -20, y: 0, largeur: 230, hauteur: 110 });
    expect(r.perspective.coins[0]).toEqual([0, Math.round((10 / 110) * 1e5) / 1e5]);
    expect(r.perspective.coins[2]).toEqual([1, 1]);
    expect(recaler([[0, 0], [10, 10], [10, 0], [0, 10]])).toBeNull();
    // Moins d'un pixel de haut : refusé.
    expect(recaler([[0, 0], [10, 0], [10, 0.5], [0, 0.5]])).toBeNull();
  });

  it("le document ne garde qu'une vraie perspective", () => {
    expect(normaliserPerspective(undefined)).toBeUndefined();
    expect(normaliserPerspective({ coins: [[0, 0], [1, 0], [1, 1], [0, 1]] })).toBeUndefined();
    expect(estAPlat(undefined)).toBe(true);
    const p = normaliserPerspective({ coins: [[0, 0.1], [1, 0], [1, 1], [0, 0.9]] });
    expect(p?.coins[0]).toEqual([0, 0.1]);
    expect(normaliserPerspective({ coins: [[0, 0], [1, 1], [1, 0], [0, 1]] })).toBeUndefined();
    expect(normaliserPerspective({ coins: [[0, 0], [2, 0], [1, 1], [0, 1]] })).toBeUndefined();
    expect(taillePlate([[0, 0], [100, 0], [100, 50], [0, 50]])).toEqual([100, 50]);
  });
});
