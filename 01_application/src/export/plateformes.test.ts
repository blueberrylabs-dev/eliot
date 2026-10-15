import { describe, expect, it } from "vitest";
import { OPTIONS_FILM_DEFAUT, PLATEFORMES, reglagesFilm, remarquesFilm, type OptionsFilm } from "./plateformes";

const STORY = { largeur: 1080, hauteur: 1920 };
const PAYSAGE = { largeur: 1920, hauteur: 1080 };
const options = (o: Partial<OptionsFilm>): OptionsFilm => ({ ...OPTIONS_FILM_DEFAUT, ...o });

describe("réglages par plateforme", () => {
  it("YouTube : 1080p à 8 Mbit/s jusqu'à 30 images/s, 12 au-delà, GOP d'une demi-seconde, son à 384 kbit/s", () => {
    const r = reglagesFilm(options({ plateforme: "youtube" }), PAYSAGE);
    expect(r).toMatchObject({ format: "mp4", largeur: 1920, hauteur: 1080, imagesParSeconde: 30, debitMaxKbps: 8000, gopSecondes: 0.5, debitSonKbps: 384, son: true });
    expect(reglagesFilm(options({ plateforme: "youtube", imagesParSeconde: 60 }), PAYSAGE).debitMaxKbps).toBe(12000);
    expect(reglagesFilm(options({ plateforme: "youtube", definition: 720 }), PAYSAGE)).toMatchObject({ largeur: 1280, hauteur: 720, debitMaxKbps: 5000 });
    expect(reglagesFilm(options({ plateforme: "youtube", definition: 720, imagesParSeconde: 50 }), PAYSAGE).debitMaxKbps).toBe(7500);
  });

  it("le petit côté fait la définition, les côtés restent pairs", () => {
    expect(reglagesFilm(options({ plateforme: "tiktok" }), STORY)).toMatchObject({ largeur: 1080, hauteur: 1920 });
    expect(reglagesFilm(options({ definition: 720 }), STORY)).toMatchObject({ largeur: 720, hauteur: 1280 });
    const r = reglagesFilm(options({}), { largeur: 1001, hauteur: 1333 });
    expect(r.largeur % 2).toBe(0);
    expect(r.hauteur % 2).toBe(0);
    expect(r.largeur).toBe(1080);
  });

  it("GIF : la largeur choisie (jamais plus que la page), la hauteur suit, sans son", () => {
    const r = reglagesFilm(options({ format: "gif", largeurGif: 480, imagesParSeconde: 15 }), STORY);
    expect(r).toMatchObject({ format: "gif", largeur: 480, hauteur: 853, imagesParSeconde: 15, son: false });
    expect(reglagesFilm(options({ format: "gif", largeurGif: 640 }), { largeur: 500, hauteur: 500 }).largeur).toBe(500);
  });

  it("les remarques : proportions, durée, cadence", () => {
    expect(remarquesFilm(options({ plateforme: "youtube" }), STORY, 10_000)[0]).toMatch(/16:9/);
    expect(remarquesFilm(options({ plateforme: "youtube" }), PAYSAGE, 10_000)).toEqual([]);
    expect(remarquesFilm(options({ plateforme: "shorts" }), { largeur: 1080, hauteur: 1080 }, 10_000)).toEqual([]);
    expect(remarquesFilm(options({ plateforme: "reels" }), STORY, 4 * 60_000)[0]).toMatch(/3 minutes/);
    expect(remarquesFilm(options({ plateforme: "tiktok", imagesParSeconde: 15 }), STORY, 10_000)[0]).toMatch(/23 images/);
    expect(remarquesFilm(options({ plateforme: "libre" }), { largeur: 800, hauteur: 300 }, 600_000)).toEqual([]);
    expect(remarquesFilm(options({ format: "gif" }), STORY, 20_000)[0]).toMatch(/MP4/);
  });

  it("chaque plateforme a un nom, un conseil et des débits croissants avec la cadence", () => {
    for (const p of PLATEFORMES) {
      expect(p.nom.length).toBeGreaterThan(2);
      expect(p.conseil.length).toBeGreaterThan(10);
      expect(p.debit(60, 1080)).toBeGreaterThanOrEqual(p.debit(30, 1080));
      expect(p.debit(30, 1080)).toBeGreaterThan(p.debit(30, 720));
    }
  });
});
