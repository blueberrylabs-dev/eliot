import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aDesVoisins, cleReglages, COULEURS_MELANGEUR, CURSEURS_LABO, lireValeur, normaliserPoints, normaliserReglages, PAS_COURBE, POINTS_COURBE_MAX, spline, tableCourbe, texteValeur, type PointCourbe } from "./labo";

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
    expect(cles).toEqual([...CURSEURS_LABO.map((c) => c.cle), "melangeur", "courbe"].sort());
    expect(Object.keys(tableau.cas[0].reglages.melangeur as object).sort()).toEqual([...COULEURS_MELANGEUR].sort());
  });
});

describe("courbe des tonalités (étape 5, lot 3)", () => {
  it("les points suivent les règles du noyau", () => {
    // Les mêmes cas que `la_courbe_fait_ce_qu_elle_dit` dans `noyau/src/labo.rs`.
    expect(normaliserPoints([[192, 200], [64, 50], [64, 40]])).toEqual([[0, 0], [64, 40], [192, 200], [255, 255]]);
    expect(normaliserPoints([[300, -4]])).toEqual([[0, 0], [255, 0]]);
    const beaucoup: PointCourbe[] = Array.from({ length: 40 }, (_, i) => [i * 6, i * 6 + 3]);
    const n = normaliserPoints(beaucoup);
    expect(n.length).toBe(POINTS_COURBE_MAX);
    expect(n[n.length - 1]).toEqual([255, 255]);
    expect(normaliserPoints([[0, 0], [100, 100], [255, 255]])).toEqual([]);
    expect(normaliserPoints("n'importe quoi")).toEqual([]);
    expect(normaliserPoints([[10.4, 20.6], ["a", 3], [Number.NaN, 1]])).toEqual([[0, 0], [10, 21], [255, 255]]);
  });

  it("une diagonale sort du document, une vraie courbe y reste", () => {
    expect(normaliserReglages({ courbe: { rgb: [[0, 0], [255, 255]], bleu: [] } })).toBeUndefined();
    expect(normaliserReglages({ courbe: { bleu: [[0, 30], [255, 220]] } })).toEqual({ courbe: { bleu: [[0, 30], [255, 220]] } });
    expect(cleReglages({ courbe: { rgb: [[64, 50]] } })).toBe(cleReglages({ courbe: { rgb: [[0, 0], [64, 50], [255, 255]] } }));
    expect(cleReglages({ courbe: { rgb: [[64, 50]] } })).not.toBe(cleReglages({ courbe: { rgb: [[64, 51]] } }));
  });

  it("la courbe passe par ses points sans repartir en arrière", () => {
    const f = spline([[0, 0], [30, 120], [60, 130], [255, 255]]);
    let avant = -1;
    for (let i = 0; i <= 1000; i++) {
      const v = f(i / 1000);
      expect(v).toBeGreaterThanOrEqual(avant - 1e-9);
      expect(v).toBeLessThanOrEqual(1);
      avant = v;
    }
    expect(f(30 / 255) * 255).toBeCloseTo(120, 6);
    expect(f(60 / 255) * 255).toBeCloseTo(130, 6);
    expect(spline(undefined)(0.37)).toBeCloseTo(0.37, 12);
  });

  it("la table du shader : la courbe de l'image entière, puis celle du canal", () => {
    expect(tableCourbe(undefined)).toBeNull();
    expect(tableCourbe({ rgb: [[0, 0], [255, 255]] })).toBeNull();
    const t = tableCourbe({ rgb: [[0, 40], [255, 228]], bleu: [[0, 0], [128, 160], [255, 255]] })!;
    expect(t.length).toBe(PAS_COURBE * 4);
    // Le noir : 40 en sortie de la courbe RVB ; le bleu passe ensuite par sa propre courbe.
    expect(t[0] * 255).toBeCloseTo(40, 4);
    expect(t[2] * 255).toBeGreaterThan(40);
    expect(t[(PAS_COURBE - 1) * 4] * 255).toBeCloseTo(228, 4);
  });
});

describe("clips vidéo au labo (étape 5, lot 4)", () => {
  it("la graine du grain change 24 fois par seconde, comme dans le noyau", async () => {
    const { graineDuTemps } = await import("../labo/shader");
    // Les mêmes cas que `le_grain_d_un_clip_change_d_une_image_a_l_autre` du noyau.
    expect(graineDuTemps(0)).toBe(0);
    expect(graineDuTemps(41)).toBe(0);
    expect(graineDuTemps(1000 / 24)).toBe(1);
    expect(graineDuTemps(1000)).toBe(24);
    expect(graineDuTemps(Number.NaN)).toBe(0);
  });

  it("le tableau commun porte un cas de grain d'un clip", () => {
    const tableau = JSON.parse(readFileSync(new URL("./labo.attendus.json", import.meta.url), "utf8")) as { cas: { nom: string; graine: number }[] };
    expect(tableau.cas.some((c) => c.graine === 37)).toBe(true);
    expect(tableau.cas.filter((c) => c.graine !== 0).length).toBe(1);
  });
});
