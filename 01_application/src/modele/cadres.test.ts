import { describe, expect, it } from "vitest";
import { casesDeGrille, deplacerRecadrage, DISPOSITIONS, ecranAppareil, elementAPhotoSous, placerPhoto } from "./cadres";
import { creerCadre, creerForme } from "./fabriques";

describe("cadres et grilles", () => {
  it("une photo couvre toujours son cadre, centrée par défaut", () => {
    // Photo paysage 2000 × 1000 dans un cadre carré de 500 : elle déborde à gauche et à droite.
    const p = placerPhoto(2000, 1000, 500, 500);
    expect(p.hauteur).toBe(500);
    expect(p.largeur).toBe(1000);
    expect(p.x).toBe(-250);
    expect(p.y).toBe(0);
  });

  it("le recadrage choisit la partie visible et le zoom agrandit", () => {
    expect(placerPhoto(2000, 1000, 500, 500, { zoom: 1, x: 0, y: 0.5 }).x).toBe(0);
    expect(placerPhoto(2000, 1000, 500, 500, { zoom: 1, x: 1, y: 0.5 }).x).toBe(-500);
    const z = placerPhoto(2000, 1000, 500, 500, { zoom: 2, x: 0.5, y: 0.5 });
    expect(z.largeur).toBe(2000);
    expect(z.y).toBe(-250);
  });

  it("glisser la photo déplace le cadrage sans jamais découvrir le fond", () => {
    const r = deplacerRecadrage(2000, 1000, 500, 500, { zoom: 1, x: 0.5, y: 0.5 }, 100, 0);
    // La photo suit le pointeur : 100 px vers la droite montrent plus de sa partie gauche.
    expect(r.x).toBeCloseTo(0.3);
    // Dans le sens où il n'y a rien à montrer, le cadrage reste centré.
    expect(r.y).toBe(0.5);
    expect(deplacerRecadrage(2000, 1000, 500, 500, r, -10000, 0).x).toBe(1);
  });

  it("une grille laisse un écart entre les cases, pas au bord", () => {
    const quatre = DISPOSITIONS.find((d) => d.id === "quatre")!;
    const cases = casesDeGrille(quatre, { x: 0, y: 0, largeur: 1000, hauteur: 1000 }, 20);
    expect(cases[0]).toEqual({ x: 0, y: 0, largeur: 490, hauteur: 490 });
    expect(cases[3]).toEqual({ x: 510, y: 510, largeur: 490, hauteur: 490 });
    // Avec un écart impair, la dernière case tombe quand même pile sur le bord.
    const page = casesDeGrille(quatre, { x: 0, y: 0, largeur: 1080, hauteur: 1080 }, 13);
    expect(page[1].x + page[1].largeur).toBe(1080);
    expect(page[1].x - (page[0].x + page[0].largeur)).toBe(13);
  });

  it("l'écran d'un téléphone tient dans son boîtier", () => {
    const e = ecranAppareil("telephone", 490, 1000);
    expect(e.x).toBeGreaterThan(0);
    expect(e.x + e.largeur).toBeLessThan(490);
    expect(e.y + e.hauteur).toBeLessThan(1000);
  });

  it("une photo lâchée va au cadre le plus haut sous le pointeur, même tourné", () => {
    const format = { largeur: 1000, hauteur: 1000 };
    const dessous = { ...creerCadre(format, "rectangle"), x: 0, y: 0, largeur: 600, hauteur: 600 };
    const dessus = { ...creerCadre(format, "cercle"), x: 300, y: 300, largeur: 400, hauteur: 400 };
    const forme = { ...creerForme(format, "rectangle"), x: 0, y: 0, largeur: 1000, hauteur: 1000 };
    expect(elementAPhotoSous([dessous, dessus, forme], { x: 350, y: 350 })?.id).toBe(dessus.id);
    expect(elementAPhotoSous([dessous, dessus], { x: 100, y: 100 })?.id).toBe(dessous.id);
    expect(elementAPhotoSous([dessous, dessus], { x: 900, y: 900 })).toBeNull();
    // Tourné de 90° autour de son coin haut gauche, le cadre occupe x de -600 à 0.
    const tourne = { ...dessous, rotation: 90 };
    expect(elementAPhotoSous([tourne], { x: -100, y: 100 })?.id).toBe(dessous.id);
    expect(elementAPhotoSous([tourne], { x: 100, y: 100 })).toBeNull();
  });
});
