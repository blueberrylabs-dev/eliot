import { describe, expect, it } from "vitest";
import { aligner, boiteEnglobante, redimensionnerElements, repartir } from "./geometrie";
import type { ElementForme, ElementPage, ElementTexte } from "./types";

const forme = (id: string, x: number, y: number, largeur = 100, hauteur = 50, rotation = 0, groupe?: string): ElementForme => ({
  id, type: "forme", forme: "rectangle", x, y, largeur, hauteur, rotation, opacite: 1, visible: true, verrouille: false,
  remplissage: "#000000", contour: "#000000", epaisseurContour: 4, arrondi: 10, ...(groupe ? { groupe } : {}),
});

describe("géométrie", () => {
  it("la boîte d'un élément tourné de 90° autour de son coin", () => {
    const b = boiteEnglobante(forme("a", 100, 100, 200, 50, 90));
    expect(b.x).toBeCloseTo(50);
    expect(b.y).toBeCloseTo(100);
    expect(b.largeur).toBeCloseTo(50);
    expect(b.hauteur).toBeCloseTo(200);
  });

  it("aligne sur la gauche et au centre d'une référence", () => {
    const blocs = [[forme("a", 40, 0)], [forme("b", 300, 80)]];
    const ref = { x: 0, y: 0, largeur: 1000, hauteur: 500 };
    expect(aligner(blocs, "gauche", ref)).toEqual({ a: { x: 0, y: 0 }, b: { x: 0, y: 80 } });
    expect(aligner(blocs, "centre", ref).b).toEqual({ x: 450, y: 80 });
    expect(aligner(blocs, "bas", ref).a).toEqual({ x: 40, y: 450 });
  });

  it("un groupe s'aligne en bloc", () => {
    const groupe = [forme("a", 100, 0, 100, 50, 0, "g"), forme("b", 300, 0, 100, 50, 0, "g")];
    const sortie = aligner([groupe], "gauche", { x: 0, y: 0, largeur: 1000, hauteur: 500 });
    expect(sortie).toEqual({ a: { x: 0, y: 0 }, b: { x: 200, y: 0 } });
  });

  it("répartit l'espace également entre trois objets", () => {
    const sortie = repartir([[forme("a", 0, 0)], [forme("c", 900, 0)], [forme("b", 150, 0)]], "horizontal");
    expect(sortie.a.x).toBe(0);
    expect(sortie.c.x).toBe(900);
    expect(sortie.b.x).toBe(450);
  });

  it("passer de 1080 × 1080 à 1080 × 1920 garde la composition centrée", () => {
    const texte: ElementTexte = {
      id: "t", type: "texte", x: 540, y: 540, largeur: 200, hauteur: 60, rotation: 0, opacite: 1, visible: true, verrouille: false,
      texte: "x", police: "Inter", taillePolice: 40, gras: false, italique: false, souligne: false, alignement: "left", couleur: "#000", interligne: 1.2, espacement: 2,
    };
    const [f, t] = redimensionnerElements([forme("f", 0, 0, 1080, 1080), texte] as ElementPage[], { largeur: 1080, hauteur: 1080 }, { largeur: 1080, hauteur: 1920 });
    expect(f).toMatchObject({ x: 0, y: 420, largeur: 1080, hauteur: 1080 });
    expect(t).toMatchObject({ x: 540, y: 960, taillePolice: 40 });
    const [petit] = redimensionnerElements([forme("f", 0, 0, 1080, 1080)], { largeur: 1080, hauteur: 1080 }, { largeur: 540, hauteur: 540 });
    expect(petit).toMatchObject({ largeur: 540, epaisseurContour: 2, arrondi: 5 });
  });
});
