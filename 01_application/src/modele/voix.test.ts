import { describe, expect, it } from "vitest";
import { borneNettoyage, cleNettoyage, estVoixNette, nettoyageActif, sourceDuClip, VOIX_NETTE } from "./voix";

describe("nettoyage de la voix", () => {
  it("borne les réglages comme le noyau", () => {
    expect(borneNettoyage({ bruit: 1.7, graves: false, chaleur: -9, presence: 0, compresseur: 0.333, niveau: true })).toEqual({ bruit: 1, chaleur: -6, compresseur: 0.33, niveau: true });
    expect(borneNettoyage({ chaleur: 0.04, presence: -0.04, deesseur: 0.004 })).toEqual({});
    expect(borneNettoyage(undefined)).toEqual({});
  });

  it("reconnaît des réglages qui ne font rien ou qui sont les mêmes", () => {
    expect(nettoyageActif({ graves: false })).toBe(false);
    expect(nettoyageActif(VOIX_NETTE)).toBe(true);
    expect(cleNettoyage({ niveau: true, bruit: 0.5 })).toBe(cleNettoyage({ bruit: 0.501, niveau: true, graves: false }));
    expect(estVoixNette({ ...VOIX_NETTE })).toBe(true);
    expect(estVoixNette({ ...VOIX_NETTE, bruit: 0.5 })).toBe(false);
  });

  it("dit ce qu'un clip fait jouer", () => {
    expect(sourceDuClip({ ressource: "a" })).toEqual({ ressource: "a", cle: "a" });
    expect(sourceDuClip({ ressource: "a", nettoyage: { graves: false } })).toEqual({ ressource: "a", cle: "a" });
    const s = sourceDuClip({ ressource: "a", nettoyage: { graves: true } });
    expect(s.nettoyage).toEqual({ graves: true });
    expect(s.cle).toBe(`a|${cleNettoyage({ graves: true })}`);
  });
});
