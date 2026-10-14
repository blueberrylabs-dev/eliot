import { describe, expect, it } from "vitest";
import { creerTrait, distanceAuTrait, simplifierTrait } from "./dessin";
import { disposerGraphique, donneesDeDepart, donneesDepuisCollage, ecrireValeur, graduations, mesureEstimee, seriesValides, type Primitive } from "./graphiques";
import { ajouterColonne, ajouterRangee, cellulesDepuisCollage, cellulesValides, celluleSous, couperEnLignes, disposerTableau, retirerColonne } from "./tableaux";
import type { ElementGraphique, ElementTableau } from "./types";

const base = { id: "x", x: 0, y: 0, rotation: 0, opacite: 1, visible: true, verrouille: false };

describe("dessin à main levée", () => {
  it("un trait presque droit perd ses points inutiles, pas ses extrémités", () => {
    const points = [0, 0, 10, 0.2, 20, -0.1, 30, 0.1, 40, 0, 40, 30];
    expect(simplifierTrait(points, 1)).toEqual([0, 0, 40, 0, 40, 30]);
  });

  it("un trait devient un élément calé sur sa boîte, épaisseur comprise", () => {
    const t = creerTrait([100, 200, 300, 260], "stylo", "#000000", 10, "t1");
    expect(t.x).toBe(95);
    expect(t.y).toBe(195);
    expect(t.largeur).toBe(210);
    expect(t.hauteur).toBe(70);
    expect(t.points).toEqual([5, 5, 205, 65]);
    expect(t.vue).toEqual({ largeur: 210, hauteur: 70 });
  });

  it("la gomme touche un trait agrandi et tourné, pas à côté", () => {
    const t = creerTrait([0, 0, 100, 0], "marqueur", "#000000", 10, "t1");
    // Agrandi deux fois, tourné d'un quart de tour autour de son coin : il descend le long de x = 5.
    const tourne = { ...t, x: 10, y: 0, largeur: t.largeur * 2, hauteur: t.hauteur * 2, rotation: 90 };
    expect(distanceAuTrait(tourne, 0, 100)).toBeLessThanOrEqual(0);
    expect(distanceAuTrait(tourne, 80, 100)).toBeGreaterThan(20);
  });
});

const graphique = (genre: ElementGraphique["genre"], extra: Partial<ElementGraphique> = {}): ElementGraphique => ({
  ...base,
  type: "graphique",
  genre,
  largeur: 800,
  hauteur: 500,
  police: "Inter",
  taillePolice: 20,
  couleurTexte: "#222222",
  grille: true,
  ...donneesDeDepart(genre),
  ...extra,
});

const dans = (f: Primitive, l: number, h: number) => {
  if (f.k === "rect") return f.x >= -0.01 && f.y >= -0.01 && f.x + f.l <= l + 0.01 && f.y + f.h <= h + 0.01;
  if (f.k === "arc") return f.cx - f.exterieur >= -0.01 && f.cx + f.exterieur <= l + 0.01 && f.cy + f.exterieur <= h + 0.01;
  return true;
};

describe("graphiques", () => {
  it("les graduations sont rondes et couvrent les valeurs", () => {
    expect(graduations(0, 95)).toEqual([0, 25, 50, 75, 100]);
    expect(graduations(-12, 40)).toEqual([-20, 0, 20, 40]);
    expect(graduations(0, 0)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it("une valeur s'écrit à la française", () => {
    expect(ecrireValeur(1234567)).toBe("1 234 567");
    expect(ecrireValeur(12.34, "%")).toBe("12,3 %");
  });

  it("des colonnes : une barre par valeur, toutes dans la boîte, la plus haute pour la plus grande valeur", () => {
    const g = graphique("colonnes");
    const barres = disposerGraphique(g, mesureEstimee).filter((f): f is Extract<Primitive, { k: "rect" }> => f.k === "rect" && !!f.ombre);
    expect(barres).toHaveLength(8);
    expect(barres.every((b) => dans(b, g.largeur, g.hauteur))).toBe(true);
    const plusHaute = barres.reduce((a, b) => (b.h > a.h ? b : a));
    expect(plusHaute.couleur).toBe(g.series[1].couleur);
  });

  it("un camembert fait le tour complet, parts proportionnelles", () => {
    const g = graphique("secteurs");
    const arcs = disposerGraphique(g, mesureEstimee).filter((f): f is Extract<Primitive, { k: "arc" }> => f.k === "arc");
    expect(arcs).toHaveLength(4);
    expect(arcs.reduce((s, a) => s + a.angle, 0)).toBeCloseTo(360);
    expect(arcs[0].angle).toBeCloseTo(0.42 * 360);
    expect(arcs.every((a) => dans(a, g.largeur, g.hauteur))).toBe(true);
  });

  it("une progression de 93 % écrit son chiffre au centre", () => {
    const formes = disposerGraphique(graphique("progression", { largeur: 400, hauteur: 400 }), mesureEstimee);
    const arcs = formes.filter((f): f is Extract<Primitive, { k: "arc" }> => f.k === "arc");
    expect(arcs[1].angle).toBeCloseTo(0.93 * 360);
    expect(formes.some((f) => f.k === "texte" && f.texte === "93 %")).toBe(true);
  });

  it("un collage de tableur donne étiquettes et séries ; des séries reçues sont remises d'aplomb", () => {
    const d = donneesDepuisCollage("\t2025\t2026\nJanv.\t12\t14,5\nFévr.\t\t20\n")!;
    expect(d.etiquettes).toEqual(["Janv.", "Févr."]);
    expect(d.series[1]).toEqual({ nom: "2026", valeurs: [14.5, 20] });
    expect(d.series[0].valeurs).toEqual([12, null]);
    const s = seriesValides(["a", "b", "c"], [{ nom: "", valeurs: ["3,5", "x"], couleur: "rouge" }]);
    expect(s[0].valeurs).toEqual([3.5, null, null]);
    expect(s[0].nom).toBe("Série 1");
    expect(s[0].couleur).toMatch(/^#[0-9a-f]{6}$/);
  });
});

const tableau = (cellules: string[][], extra: Partial<ElementTableau> = {}): ElementTableau => ({
  ...base,
  type: "tableau",
  largeur: 600,
  hauteur: 0,
  cellules,
  colonnes: cellules[0].map(() => 1),
  entete: true,
  police: "Inter",
  taillePolice: 20,
  couleurTexte: "#000000",
  fond: "#ffffff",
  fondEntete: "#000000",
  texteEntete: "#ffffff",
  bordure: { couleur: "#cccccc", epaisseur: 2 },
  alignement: "left",
  marge: 10,
  ...extra,
});

describe("tableaux", () => {
  it("un texte trop long passe à la ligne, un mot trop long est coupé", () => {
    expect(couperEnLignes("un deux trois", 80, 20, mesureEstimee)).toEqual(["un deux", "trois"]);
    expect(couperEnLignes("abcdefghij", 50, 20, mesureEstimee)).toEqual(["abcd", "efgh", "ij"]);
    expect(couperEnLignes("a\nb", 500, 20, mesureEstimee)).toEqual(["a", "b"]);
  });

  it("chaque rangée prend la hauteur de sa case la plus remplie", () => {
    const t = tableau([["Titre", "B"], ["un texte bien plus long que la case", "c"]]);
    const d = disposerTableau(t, mesureEstimee);
    const ligne = 20 * 1.25;
    expect(d.rangees[1] - d.rangees[0]).toBeCloseTo(ligne + 20);
    expect(d.rangees[2] - d.rangees[1]).toBeGreaterThan(2 * ligne);
    expect(d.colonnes).toEqual([0, 300, 600]);
    expect(celluleSous(d, 450, d.rangees[1] + 5)).toEqual({ ligne: 1, colonne: 1 });
    // Un tableau étiré partage le surplus entre ses rangées.
    const etire = disposerTableau({ ...t, hauteur: d.hauteurNaturelle + 100 }, mesureEstimee);
    expect(etire.rangees[2]).toBeCloseTo(d.rangees[2] + 100);
  });

  it("rangées et colonnes s'ajoutent et se retirent sans casser la grille", () => {
    const t = tableau([["a", "b"], ["c", "d"]]);
    expect(ajouterRangee(t).cellules).toEqual([["a", "b"], ["c", "d"], ["", ""]]);
    const plus = { ...t, ...ajouterColonne(t, 0) };
    expect(plus.cellules).toEqual([["a", "", "b"], ["c", "", "d"]]);
    expect(plus.colonnes).toHaveLength(3);
    expect({ ...plus, ...retirerColonne(plus, 1) }.cellules).toEqual(t.cellules);
  });

  it("des cellules reçues ou collées deviennent une grille régulière", () => {
    expect(cellulesValides([["a"], ["b", 2, null]])).toEqual([["a", "", ""], ["b", "2", ""]]);
    expect(cellulesDepuisCollage("Nom\tPrix\nPro\t49 €\n")).toEqual([["Nom", "Prix"], ["Pro", "49 €"]]);
    expect(cellulesDepuisCollage("juste un mot")).toBeNull();
  });
});
