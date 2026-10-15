import { describe, expect, it } from "vitest";
import { estVerticale916, rectangleSur, ZONES_SURES, type IdZones } from "./zonesSures";

describe("zones sûres", () => {
  it("ne valent que pour une page verticale en 9:16", () => {
    expect(estVerticale916({ largeur: 1080, hauteur: 1920 })).toBe(true);
    expect(estVerticale916({ largeur: 720, hauteur: 1280 })).toBe(true);
    expect(estVerticale916({ largeur: 1080, hauteur: 1350 })).toBe(false);
    expect(estVerticale916({ largeur: 1920, hauteur: 1080 })).toBe(false);
  });

  it("TikTok : 130 px en haut, 484 en bas, 44 à gauche, 140 à droite (sur 1080 × 1920)", () => {
    const r = rectangleSur("tiktok");
    expect(r.x * 1080).toBeCloseTo(44, 6);
    expect(r.y * 1920).toBeCloseTo(130, 6);
    expect((1 - r.x - r.largeur) * 1080).toBeCloseTo(140, 6);
    expect((1 - r.y - r.hauteur) * 1920).toBeCloseTo(484, 6);
  });

  it("Shorts et Reels : les marges relevées", () => {
    const s = rectangleSur("shorts");
    expect([s.x * 1080, s.y * 1920, (1 - s.x - s.largeur) * 1080, (1 - s.y - s.hauteur) * 1920].map(Math.round)).toEqual([48, 288, 192, 672]);
    const r = rectangleSur("reels");
    expect([r.x, r.y, 1 - r.x - r.largeur, 1 - r.y - r.hauteur].map((v) => Math.round(v * 100))).toEqual([6, 14, 6, 35]);
  });

  it("toutes les zones restent dans la page", () => {
    for (const id of Object.keys(ZONES_SURES) as IdZones[]) {
      for (const z of ZONES_SURES[id].zones) {
        expect(z.x).toBeGreaterThanOrEqual(0);
        expect(z.y).toBeGreaterThanOrEqual(0);
        expect(z.x + z.largeur).toBeLessThanOrEqual(1 + 1e-9);
        expect(z.y + z.hauteur).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });
});
