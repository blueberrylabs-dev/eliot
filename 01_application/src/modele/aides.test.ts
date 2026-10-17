import { describe, expect, it } from "vitest";
import { ecrireValeur, estPapier, graduations, lignesGrille, lignesTiers, margeSecurite, MM_PAR_PIXEL_PAPIER, pasGrilleParDefaut, pasRond, rectangleMarges, unitePage } from "./aides";

const carre = { largeur: 1080, hauteur: 1080 };
const a4 = { largeur: 2480, hauteur: 3508 };

describe("les aides", () => {
  it("une page A4 ou A5, dans les deux sens, se mesure en millimètres", () => {
    expect(estPapier(a4)).toBe(true);
    expect(estPapier({ largeur: 3508, hauteur: 2480 })).toBe(true);
    expect(estPapier({ largeur: 1748, hauteur: 2480 })).toBe(true);
    expect(estPapier(carre)).toBe(false);
    expect(unitePage(carre)).toEqual({ nom: "px", parPixel: 1 });
    expect(unitePage(a4).nom).toBe("mm");
    // 2480 pixels à 300 dpi : 210 mm.
    expect(2480 * unitePage(a4).parPixel).toBeCloseTo(210, 1);
  });

  it("des pas ronds : 1, 2, 5, 10…", () => {
    expect(pasRond(0.7)).toBe(1);
    expect(pasRond(1.2)).toBe(2);
    expect(pasRond(3)).toBe(5);
    expect(pasRond(60)).toBe(100);
    expect(pasRond(150)).toBe(200);
  });

  it("les graduations : un grand trait chiffré tous les 60 px d'écran au moins, le zéro sur le bord de la page", () => {
    // Page carrée à 50 %, son bord gauche à 100 px de l'écran.
    const g = graduations(800, 100, 0.5, unitePage(carre));
    const grands = g.filter((t) => t.majeure);
    // 60 px d'écran font 120 px de page : un grand trait tous les 200.
    expect(grands.map((t) => t.valeur).slice(0, 4)).toEqual([-200, 0, 200, 400]);
    expect(grands.find((t) => t.valeur === 0)!.position).toBe(100);
    expect(grands[1].position - grands[0].position).toBeGreaterThanOrEqual(60);
    // Entre deux grands traits, des petits, à 5 px d'écran au moins.
    expect(g.length).toBeGreaterThan(grands.length);
    const ecarts = g.slice(1).map((t, i) => t.position - g[i].position);
    expect(Math.min(...ecarts)).toBeGreaterThanOrEqual(5);
    expect(g.every((t) => t.position >= 0 && t.position <= 800)).toBe(true);
  });

  it("sur une page A4, la règle compte en millimètres", () => {
    // A4 à 20 % : un millimètre fait 2,36 px d'écran ; un grand trait tous les 50 mm.
    const g = graduations(1000, 0, 0.2, unitePage(a4));
    const grands = g.filter((t) => t.majeure).map((t) => t.valeur);
    expect(grands.slice(0, 3)).toEqual([0, 50, 100]);
    expect(g.find((t) => t.valeur === 50)!.position).toBeCloseTo((50 / MM_PAR_PIXEL_PAPIER) * 0.2, 3);
  });

  it("la grille : au pas voulu, sans les bords, 200 lignes au plus par sens", () => {
    const g = lignesGrille(carre, 270);
    expect(g.verticales).toEqual([270, 540, 810]);
    expect(g.horizontales).toEqual([270, 540, 810]);
    expect(lignesGrille(carre, 1).verticales.length).toBeLessThanOrEqual(200);
    expect(pasGrilleParDefaut(carre)).toBe(60);
    // 10 mm sur une page de papier.
    expect(pasGrilleParDefaut(a4) * MM_PAR_PIXEL_PAPIER).toBeCloseTo(10, 1);
  });

  it("les tiers et les marges de sécurité", () => {
    expect(lignesTiers({ largeur: 1080, hauteur: 1920 })).toEqual({ verticales: [360, 720], horizontales: [640, 1280] });
    expect(margeSecurite(carre)).toBe(54);
    expect(margeSecurite({ largeur: 1920, hauteur: 1080 })).toBe(54);
    // 5 mm sur une A4 : 59 px à 300 dpi.
    expect(margeSecurite(a4)).toBe(59);
    expect(rectangleMarges(carre)).toEqual({ x: 54, y: 54, largeur: 972, hauteur: 972 });
    expect(ecrireValeur(12.5)).toBe("12,5");
    expect(ecrireValeur(-200)).toBe("-200");
  });
});
