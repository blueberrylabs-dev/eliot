import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aDesVoisins, cleReglages, COULEURS_MELANGEUR, CURSEURS_LABO, lireValeur, normaliserReglages, texteValeur } from "./labo";

describe("réglages du labo (étape 5, lot 2)", () => {
  it("le document ne garde que les curseurs différents de zéro, dans leur plage", () => {
    expect(normaliserReglages({ exposition: 0, contraste: 0 })).toBeUndefined();
    expect(normaliserReglages({ exposition: 12, contraste: -250, grain: -5, bruit: 40.4, ombres: 0.2 })).toEqual({ exposition: 5, contraste: -100, bruit: 40 });
    expect(normaliserReglages({ exposition: 0.333 })).toEqual({ exposition: 0.33 });
    expect(normaliserReglages({ melangeur: { bleu: { saturation: 30, teinte: 0 }, rouge: { luminance: 0 } } })).toEqual({ melangeur: { bleu: { saturation: 30 } } });
    expect(normaliserReglages({ contraste: Number.NaN })).toBeUndefined();
  });

  it("les réglages qui regardent les voisins sont reconnus", () => {
    expect(aDesVoisins({ exposition: 1, vignetage: -30, grain: 20 })).toBe(false);
    for (const k of ["bruit", "nettete", "texture", "clarte", "voile"] as const) expect(aDesVoisins({ [k]: 10 })).toBe(true);
  });

  it("la clé ne dépend pas de l'ordre des champs", () => {
    expect(cleReglages({ contraste: 10, exposition: 1 })).toBe(cleReglages({ exposition: 1, contraste: 10 }));
    expect(cleReglages({ contraste: 10 })).not.toBe(cleReglages({ contraste: 11 }));
    expect(cleReglages({ contraste: 0 })).toBe("");
  });

  it("valeurs affichées et tapées au clavier", () => {
    expect(texteValeur("exposition", 0.4)).toBe("+0,40 IL");
    expect(texteValeur("contraste", -25)).toBe("−25");
    expect(texteValeur("grain", 30)).toBe("30");
    expect(lireValeur("exposition", "0,4")).toBe(0.4);
    expect(lireValeur("exposition", "+1.5 IL")).toBe(1.5);
    expect(lireValeur("contraste", "−250")).toBe(-100);
    expect(lireValeur("contraste", "beaucoup")).toBeUndefined();
  });

  it("les noms des réglages sont ceux du noyau (tableau commun)", () => {
    const tableau = JSON.parse(readFileSync(new URL("./labo.attendus.json", import.meta.url), "utf8")) as { cas: { reglages: Record<string, unknown> }[] };
    const cles = Object.keys(tableau.cas[0].reglages).sort();
    expect(cles).toEqual([...CURSEURS_LABO.map((c) => c.cle), "melangeur"].sort());
    expect(Object.keys(tableau.cas[0].reglages.melangeur as object).sort()).toEqual([...COULEURS_MELANGEUR].sort());
  });
});
