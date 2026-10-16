import { describe, expect, it } from "vitest";
import { echellesPossibles, formatPapier } from "./exporter";

describe("tailles de l'export (étape 5, lot 1)", () => {
  it("l'A4 et l'A5, dans les deux sens, se disent en dpi : 150 et 300", () => {
    expect(formatPapier({ largeur: 2480, hauteur: 3508 })).toBe(true);
    expect(formatPapier({ largeur: 3508, hauteur: 2480 })).toBe(true);
    expect(formatPapier({ largeur: 1748, hauteur: 2480 })).toBe(true);
    expect(formatPapier({ largeur: 1080, hauteur: 1080 })).toBe(false);
    expect(echellesPossibles({ largeur: 2480, hauteur: 3508 })).toEqual([0.5, 1]);
  });

  it("les autres formats vont de ×1 à ×4, sans dépasser 12 000 px de côté ni 100 millions de pixels", () => {
    expect(echellesPossibles({ largeur: 1080, hauteur: 1350 })).toEqual([1, 2, 3, 4]);
    // 1920 × 1080 à ×4 : 7680 × 4320, 33 millions de pixels.
    expect(echellesPossibles({ largeur: 1920, hauteur: 1080 })).toEqual([1, 2, 3, 4]);
    // 4000 × 3000 : ×3 ferait 12 000 × 9000 = 108 millions de pixels.
    expect(echellesPossibles({ largeur: 4000, hauteur: 3000 })).toEqual([1, 2]);
    // Une page immense garde au moins sa taille.
    expect(echellesPossibles({ largeur: 20000, hauteur: 20000 })).toEqual([1]);
  });
});
