import { describe, expect, it } from "vitest";
import { alerteContraste, alerteTaille, centile, contrasteCouleurs, couleurLisible, dilater, ecrireRapport, estGrandTexte, hexEnRgb, lecturePage, luminance, mesurerContraste, rapport, rgbEnHex, seuilContraste, tailleMinimale, tailleVue, type Rgb } from "./lisibilite";

/** Deux rendus de 20 × 10 : un fond (une couleur à gauche, une autre à droite) et un bloc de
 *  lettres au milieu. */
function rendus(fondGauche: Rgb, fondDroite: Rgb, lettres: Rgb, x0 = 5, x1 = 15) {
  const l = 20;
  const h = 10;
  const fond = new Uint8ClampedArray(l * h * 4);
  const texte = new Uint8ClampedArray(l * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < l; x++) {
      const i = (y * l + x) * 4;
      fond.set([...(x < l / 2 ? fondGauche : fondDroite), 255], i);
      if (x >= x0 && x < x1 && y >= 3 && y < 7) texte.set([...lettres, 255], i);
    }
  return { fond, texte, l, h };
}

describe("le contraste selon le WCAG", () => {
  it("luminances et rapports de référence", () => {
    expect(luminance([0, 0, 0])).toBe(0);
    expect(luminance([255, 255, 255])).toBeCloseTo(1, 6);
    expect(contrasteCouleurs([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 6);
    expect(contrasteCouleurs([255, 255, 255], [255, 255, 255])).toBe(1);
    // Le gris #767676 sur blanc est le plus clair qui tient 4,5 : 1.
    expect(contrasteCouleurs(hexEnRgb("#767676")!, [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
    expect(contrasteCouleurs(hexEnRgb("#777777")!, [255, 255, 255])).toBeLessThan(4.5);
    expect(rapport(0.5, 0.5)).toBe(1);
    expect(ecrireRapport(4.5)).toBe("4,5 : 1");
    expect(ecrireRapport(3)).toBe("3 : 1");
    expect(ecrireRapport(2.19)).toBe("2,1 : 1");
    expect(rgbEnHex([255, 0, 17])).toBe("#ff0011");
    expect(hexEnRgb("rouge")).toBeNull();
    expect(centile([5, 1, 3, 2, 4], 0.5)).toBe(3);
  });

  it("la couleur qui se lit le mieux : blanc sur sombre, noir sur clair", () => {
    expect(couleurLisible([20, 30, 60])).toBe("#ffffff");
    expect(couleurLisible([250, 240, 200])).toBe("#111111");
  });

  it("dilater un masque d'un rayon", () => {
    const m = new Uint8Array(25);
    m[12] = 1; // le centre d'un carré de 5 × 5
    expect(dilater(m, 5, 5, 1).reduce((a, b) => a + b, 0)).toBe(9);
    expect(dilater(m, 5, 5, 2).reduce((a, b) => a + b, 0)).toBe(25);
    expect(dilater(m, 5, 5, 0)).toEqual(m);
  });
});

describe("la mesure sur les rendus", () => {
  it("des lettres blanches sur un fond noir : 21 : 1", () => {
    const r = rendus([0, 0, 0], [0, 0, 0], [255, 255, 255]);
    const m = mesurerContraste(r.fond, r.texte, r.l, r.h, { rayon: 2 })!;
    expect(m.rapport).toBeCloseTo(21, 3);
    expect(m.texte).toEqual([255, 255, 255]);
    expect(m.fond).toEqual([0, 0, 0]);
    expect(m.blanc).toBeCloseTo(21, 3);
    expect(m.noir).toBeLessThan(1.2);
  });

  it("à cheval sur un fond noir et un fond blanc : la moitié perdue fait tomber la mesure", () => {
    const r = rendus([0, 0, 0], [255, 255, 255], [255, 255, 255]);
    const m = mesurerContraste(r.fond, r.texte, r.l, r.h, { rayon: 2 })!;
    expect(m.rapport).toBeLessThan(1.5);
    // Ni des lettres blanches ni des noires ne se liraient partout.
    expect(Math.max(m.blanc, m.noir)).toBeLessThan(1.5);
    // Presque tout sur le noir, un coin sur le blanc : le texte reste lisible.
    const presque = rendus([0, 0, 0], [255, 255, 255], [255, 255, 255], 2, 10);
    expect(mesurerContraste(presque.fond, presque.texte, presque.l, presque.h, { rayon: 1 })!.rapport).toBeGreaterThan(15);
  });

  it("l'opacité mêle les lettres au fond", () => {
    const r = rendus([0, 0, 0], [0, 0, 0], [255, 255, 255]);
    const m = mesurerContraste(r.fond, r.texte, r.l, r.h, { rayon: 2, opacite: 0.2 })!;
    expect(m.rapport).toBeLessThan(3);
  });

  it("un contour qui tranche sauve des lettres claires sur un fond clair", () => {
    const r = rendus([255, 255, 255], [255, 255, 255], [255, 255, 255]);
    expect(mesurerContraste(r.fond, r.texte, r.l, r.h, { rayon: 2 })!.rapport).toBe(1);
    expect(mesurerContraste(r.fond, r.texte, r.l, r.h, { rayon: 2, contour: [0, 0, 0] })!.rapport).toBeCloseTo(21, 3);
    // Un contour blanc ne sert à rien.
    expect(mesurerContraste(r.fond, r.texte, r.l, r.h, { rayon: 2, contour: [255, 255, 255] })!.rapport).toBe(1);
  });

  it("sans lettres, pas de mesure", () => {
    const r = rendus([0, 0, 0], [0, 0, 0], [255, 255, 255], 0, 0);
    expect(mesurerContraste(r.fond, r.texte, r.l, r.h, { rayon: 2 })).toBeNull();
  });
});

describe("la taille vue", () => {
  it("un post carré sur un téléphone : 390 px de large", () => {
    const l = lecturePage({ largeur: 1080, hauteur: 1080 });
    expect(l.support).toBe("telephone");
    expect(tailleVue(108, l)).toBeCloseTo(39, 6);
    expect(tailleMinimale(l)).toBe(34);
    // Une story tient en largeur ; une vidéo paysage aussi, en plus petit.
    expect(lecturePage({ largeur: 1080, hauteur: 1920 }).facteur).toBeCloseTo(390 / 1080, 6);
    expect(tailleMinimale(lecturePage({ largeur: 1920, hauteur: 1080 }))).toBe(60);
  });

  it("une affiche A4 : en points, 8 au moins", () => {
    const l = lecturePage({ largeur: 2480, hauteur: 3508 });
    expect(l.support).toBe("papier");
    // 300 dpi : 25 px font 6 points.
    expect(tailleVue(25, l)).toBeCloseTo(6, 6);
    expect(tailleMinimale(l)).toBe(34);
  });

  it("le grand texte du WCAG demande 3 : 1, le reste 4,5 : 1", () => {
    const l = lecturePage({ largeur: 1080, hauteur: 1080 });
    // 24 px vus : 66,5 px de page ; en gras, 18,66 px vus : 51,7 px de page.
    expect(estGrandTexte(70, false, l)).toBe(true);
    expect(estGrandTexte(60, false, l)).toBe(false);
    expect(estGrandTexte(55, true, l)).toBe(true);
    expect(seuilContraste(70, false, l)).toBe(3);
    expect(seuilContraste(40, false, l)).toBe(4.5);
  });

  it("les alertes et leurs conseils", () => {
    const l = lecturePage({ largeur: 1080, hauteur: 1080 });
    expect(alerteTaille("t", 40, l)).toBeNull();
    const a = alerteTaille("t", 24, l)!;
    expect(a).toMatchObject({ id: "t", genre: "taille", seuil: 12, conseil: 34 });
    expect(a.valeur).toBeCloseTo(8.7, 1);
    expect(a.message).toContain("8,7 px");
    const p = alerteTaille("t", 25, lecturePage({ largeur: 2480, hauteur: 3508 }))!;
    expect(p.message).toContain("6 points");
    expect(alerteContraste("t", { rapport: 5, texte: [0, 0, 0], fond: [255, 255, 255], blanc: 1, noir: 18 }, 4.5)).toBeNull();
    const c = alerteContraste("t", { rapport: 1.6, texte: [200, 200, 200], fond: [240, 240, 240], blanc: 1.1, noir: 16 }, 4.5)!;
    expect(c).toMatchObject({ genre: "contraste", valeur: 1.6, seuil: 4.5, conseil: "#111111" });
    // Un fond trop varié : ni le blanc ni le noir ne suffisent, pas de couleur conseillée.
    expect(alerteContraste("t", { rapport: 1.2, texte: [255, 255, 255], fond: [120, 120, 120], blanc: 1.3, noir: 1.4 }, 3)!.conseil).toBeNull();
    expect(c.message).toContain("1,6 : 1");
    expect(c.message).toContain("4,5 : 1");
  });
});
