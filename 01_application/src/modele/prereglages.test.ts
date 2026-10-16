import { describe, expect, it } from "vitest";
import { normaliserReglages } from "./labo";
import { appliquerPrereglage, CATEGORIES_FOURNIES, echelonner, gardes, memeStyle, PREREGLAGES_FOURNIS, style, trouverPrereglage, type Prereglage } from "./prereglages";

describe("préréglages du labo (étape 5, lot 3)", () => {
  it("une vingtaine fournis, rangés dans leurs catégories, déjà normalisés", () => {
    expect(PREREGLAGES_FOURNIS.length).toBeGreaterThanOrEqual(18);
    expect(new Set(PREREGLAGES_FOURNIS.map((p) => p.id)).size).toBe(PREREGLAGES_FOURNIS.length);
    for (const p of PREREGLAGES_FOURNIS) {
      expect(CATEGORIES_FOURNIES).toContain(p.categorie);
      expect(normaliserReglages(p.reglages)).toEqual(p.reglages);
      expect(style(p.reglages)).toEqual(p.reglages);
    }
    for (const c of CATEGORIES_FOURNIES) expect(PREREGLAGES_FOURNIS.some((p) => p.categorie === c)).toBe(true);
  });

  it("appliquer un préréglage remplace le style et garde l'exposition, la netteté, le bruit", () => {
    const p: Prereglage = { id: "x", nom: "Essai", categorie: "Couleur", reglages: { contraste: 20, saturation: -30, courbe: { rgb: [[0, 20], [255, 255]] } } };
    const actuels = { exposition: 0.6, nettete: 30, bruit: 10, vibrance: 40, temperature: 15 };
    expect(appliquerPrereglage(actuels, p)).toEqual({ exposition: 0.6, nettete: 30, bruit: 10, contraste: 20, saturation: -30, courbe: { rgb: [[0, 20], [255, 255]] } });
    expect(gardes(actuels)).toEqual({ exposition: 0.6, nettete: 30, bruit: 10 });
    // Un préréglage qui porterait une exposition (fichier abîmé) ne la change pas.
    expect(appliquerPrereglage({ exposition: 1 }, { ...p, reglages: { exposition: -2, contraste: 10 } })).toEqual({ exposition: 1, contraste: 10 });
  });

  it("l'intensité rapproche chaque valeur de zéro et la courbe de la diagonale", () => {
    const p: Prereglage = { id: "x", nom: "Essai", categorie: "Couleur", reglages: { contraste: 20, melangeur: { bleu: { saturation: 40 } }, courbe: { rgb: [[0, 40], [255, 215]] } } };
    expect(appliquerPrereglage(undefined, p, 50)).toEqual({ contraste: 10, melangeur: { bleu: { saturation: 20 } }, courbe: { rgb: [[0, 20], [255, 235]] } });
    expect(appliquerPrereglage({ exposition: 0.5 }, p, 0)).toEqual({ exposition: 0.5 });
    expect(appliquerPrereglage(undefined, p, 0)).toBeUndefined();
    expect(echelonner({ grain: 30 }, 2 / 3)).toEqual({ grain: 20 });
  });

  it("même style à l'exposition près ; recherche par nom sans accents", () => {
    expect(memeStyle({ contraste: 10, exposition: 1 }, { contraste: 10 })).toBe(true);
    expect(memeStyle({ contraste: 10 }, { contraste: 11 })).toBe(false);
    expect(trouverPrereglage(PREREGLAGES_FOURNIS, "chaud dore")?.id).toBe("chaud-dore");
    expect(trouverPrereglage(PREREGLAGES_FOURNIS, "NOIR ET BLANC")?.id).toBe("noir-blanc");
    expect(trouverPrereglage(PREREGLAGES_FOURNIS, "film-froid")?.nom).toBe("Film froid");
    expect(trouverPrereglage(PREREGLAGES_FOURNIS, "inconnu")).toBeUndefined();
  });
});
