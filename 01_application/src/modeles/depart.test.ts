import { describe, expect, it } from "vitest";
import catalogue from "../bibliotheque/polices.json";
import { FORMATS_PAGE } from "../modele/types";
import { MODELES_DEPART } from "./depart";

const familles = new Set((catalogue as { famille: string }[]).map((p) => p.famille));

describe("modèles de départ", () => {
  it("une quarantaine, chacun avec un identifiant unique et un format connu", () => {
    expect(MODELES_DEPART.length).toBeGreaterThanOrEqual(40);
    expect(new Set(MODELES_DEPART.map((m) => m.id)).size).toBe(MODELES_DEPART.length);
    for (const m of MODELES_DEPART) expect(FORMATS_PAGE.some((f) => f.id === m.format), m.id).toBe(true);
  });

  it("chaque format de page a ses modèles", () => {
    for (const f of FORMATS_PAGE) expect(MODELES_DEPART.some((m) => m.format === f.id), f.id).toBe(true);
  });

  it("toutes les polices viennent de la bibliothèque d'Eliot", () => {
    for (const m of MODELES_DEPART) {
      for (const e of m.elements) if (typeof e.police === "string") expect(familles.has(e.police), `${m.id} : ${e.police}`).toBe(true);
    }
  });

  it("les textes tiennent dans la largeur de la page", () => {
    for (const m of MODELES_DEPART) {
      const f = FORMATS_PAGE.find((x) => x.id === m.format)!;
      for (const e of m.elements.filter((x) => x.type === "texte")) {
        expect(e.x >= 0 && e.x + e.largeur <= f.largeur, `${m.id} : « ${String(e.texte).slice(0, 20)} »`).toBe(true);
      }
    }
  });
});
