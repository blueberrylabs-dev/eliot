import { describe, expect, it } from "vitest";
import { bornerCourbe, dispositionListe, estCourbe, garderCentre, geometrieCourbe, marqueListe, paragraphesListe, retraitListe } from "./texteCourbe";

/** Les points de départ et d'arrivée de l'arc, lus dans ses données de tracé. */
function bouts(chemin: string) {
  const n = chemin.match(/-?\d+(\.\d+)?/g)!.map(Number);
  return { x0: n[0], y0: n[1], x1: n[n.length - 2], y1: n[n.length - 1], grand: n[5], sens: n[6] };
}

describe("texte courbé", () => {
  it("droit sous 1, borné de -100 à 100", () => {
    expect(estCourbe(undefined)).toBe(false);
    expect(estCourbe(0.4)).toBe(false);
    expect(estCourbe(-1)).toBe(true);
    expect(geometrieCourbe(600, 80, 0)).toBeNull();
    expect(bornerCourbe(250)).toBe(100);
    expect(bornerCourbe(-180.4)).toBe(-100);
  });

  it("l'arc a la longueur du texte et ses deux bouts à la même hauteur", () => {
    const g = geometrieCourbe(600, 80, 50)!;
    // À 50, l'angle vaut un peu moins d'un demi-tour : rayon × angle = longueur.
    expect(g.rayon * Math.PI * 0.95).toBeCloseTo(600, 3);
    const b = bouts(g.chemin);
    expect(b.y0).toBeCloseTo(b.y1, 1);
    expect(b.x0).toBeLessThan(b.x1);
    // Symétrique autour du milieu de la boîte.
    expect((b.x0 + b.x1) / 2).toBeCloseTo(g.largeur / 2, 0);
    expect(b.grand).toBe(0);
    expect(b.sens).toBe(1);
  });

  it("en arche, les bouts sont en bas de la boîte ; en sourire, en haut", () => {
    const arche = geometrieCourbe(600, 80, 40)!;
    const sourire = geometrieCourbe(600, 80, -40)!;
    // Les lettres d'une arche dépassent l'arc vers l'extérieur : sa boîte est plus large.
    expect(arche.largeur).toBeGreaterThan(sourire.largeur);
    expect(bouts(arche.chemin).y0).toBeGreaterThan(arche.hauteur / 2);
    expect(bouts(sourire.chemin).y0).toBeLessThan(sourire.hauteur / 2);
    expect(bouts(sourire.chemin).sens).toBe(0);
  });

  it("plus la courbe monte, plus la boîte se resserre et s'arrondit", () => {
    const peu = geometrieCourbe(600, 80, 10)!;
    const beaucoup = geometrieCourbe(600, 80, 100)!;
    expect(peu.largeur).toBeGreaterThan(beaucoup.largeur);
    expect(peu.hauteur).toBeLessThan(beaucoup.hauteur);
    // Presque un cercle : le grand arc, une boîte presque carrée.
    expect(bouts(beaucoup.chemin).grand).toBe(1);
    expect(Math.abs(beaucoup.largeur - beaucoup.hauteur)).toBeLessThan(beaucoup.largeur * 0.15);
  });

  it("un texte très court ne se referme pas sur lui-même", () => {
    const g = geometrieCourbe(10, 80, -100)!;
    expect(g.rayon).toBeGreaterThanOrEqual(80 * 0.95 * 1.2);
  });

  it("garder le centre, même tourné", () => {
    const avant = { x: 100, y: 200, largeur: 400, hauteur: 100, rotation: 0 };
    expect(garderCentre(avant, 200, 300)).toEqual({ x: 200, y: 100 });
    const tourne = { ...avant, rotation: 90 };
    const p = garderCentre(tourne, 200, 300);
    // Tourné d'un quart de tour autour de son coin : le centre est en (50, 400).
    const r = Math.PI / 2;
    const cx = p.x + 100 * Math.cos(r) - 150 * Math.sin(r);
    const cy = p.y + 100 * Math.sin(r) + 150 * Math.cos(r);
    expect(cx).toBeCloseTo(50, 0);
    expect(cy).toBeCloseTo(400, 0);
  });
});

describe("listes", () => {
  it("une puce ou un numéro par paragraphe", () => {
    expect(paragraphesListe("Pain\nLait\n\nŒufs")).toEqual(["Pain", "Lait", "", "Œufs"]);
    expect(marqueListe("puces", 3)).toBe("•");
    expect(marqueListe("numeros", 0)).toBe("1.");
    expect(marqueListe("numeros", 11)).toBe("12.");
  });

  it("les éléments s'empilent, la hauteur est leur somme", () => {
    expect(dispositionListe([48, 96, 48])).toEqual({ hauts: [0, 48, 144], hauteur: 192 });
    expect(dispositionListe([])).toEqual({ hauts: [], hauteur: 0 });
  });

  it("le retrait laisse la marque la plus large et un demi-cadratin", () => {
    expect(retraitListe(30.2, 40)).toBe(51);
  });
});
