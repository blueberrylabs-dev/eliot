import { describe, expect, it } from "vitest";
import { detacherFond, estFondPhoto, fondPhoto, mettreEnFond, peutAllerEnFond, rangerFond } from "./fond";
import type { ElementCadre, ElementImage, ElementPage, PageEliot } from "./types";

const format = { largeur: 1080, hauteur: 1350 };
const base = { rotation: 0, opacite: 1, visible: true, verrouille: false };
const photo: ElementImage = { ...base, id: "p", type: "image", x: 100, y: 200, largeur: 400, hauteur: 300, ressource: "a".repeat(64), retourneH: false, retourneV: false, reglages: { exposition: 0.3 } as ElementImage["reglages"], groupe: "g1", libelle: "Plage" };
const texte = { ...base, id: "t", type: "texte", x: 0, y: 0, largeur: 500, hauteur: 80, texte: "Titre", police: "Inter", taillePolice: 60, gras: true, italique: false, souligne: false, couleur: "#111111", alignement: "center", interligne: 1.2, espacement: 0 } as ElementPage;
const page = (elements: ElementPage[], video = false): PageEliot => ({ id: "pg", fond: "#ffffff", elements, ...(video ? { duree: 5000 } : {}) }) as PageEliot;

describe("la photo en fond", () => {
  it("une photo devient un cadre qui couvre la page, ses réglages et son nom gardés", () => {
    expect(peutAllerEnFond(photo)).toBe(true);
    expect(peutAllerEnFond(texte)).toBe(false);
    const f = mettreEnFond(photo, format);
    expect(f).toMatchObject({ id: "p", type: "cadre", x: 0, y: 0, largeur: 1080, hauteur: 1350, rotation: 0, forme: "rectangle", ressource: photo.ressource, recadrage: { zoom: 1, x: 0.5, y: 0.5 }, enFond: true, libelle: "Plage" });
    expect(f.reglages).toEqual({ exposition: 0.3 });
    expect(f.groupe).toBeUndefined();
    expect(estFondPhoto(f)).toBe(true);
    // Déjà en fond : on ne l'y remet pas.
    expect(peutAllerEnFond(f)).toBe(false);
  });

  it("un cadre garde son cadrage en allant au fond", () => {
    const c: ElementCadre = { ...base, id: "c", type: "cadre", x: 10, y: 10, largeur: 300, hauteur: 300, forme: "coeur", ressource: "b".repeat(64), recadrage: { zoom: 2, x: 0.3, y: 0.6 }, fond: "#dcd8cf" };
    expect(mettreEnFond(c, format)).toMatchObject({ forme: "rectangle", recadrage: { zoom: 2, x: 0.3, y: 0.6 }, largeur: 1080, enFond: true });
  });

  it("toujours tout en dessous, couvrant la page, même après un déplacement ou un autre format", () => {
    const f = { ...mettreEnFond(photo, format), x: 40, y: -20, largeur: 500 };
    const p = rangerFond(page([texte, f]), format);
    expect(p.elements.map((e) => e.id)).toEqual(["p", "t"]);
    expect(p.elements[0]).toMatchObject({ x: 0, y: 0, largeur: 1080, hauteur: 1350 });
    const carre = rangerFond(p, { largeur: 1080, hauteur: 1080 });
    expect(carre.elements[0]).toMatchObject({ largeur: 1080, hauteur: 1080 });
    // Rien à ranger : la même page.
    expect(rangerFond(p, format)).toBe(p);
    expect(rangerFond(page([texte]), format).elements).toEqual([texte]);
  });

  it("une seule photo du fond ; sur une page vidéo, plus de fond", () => {
    const a = mettreEnFond(photo, format);
    const b = { ...mettreEnFond({ ...photo, id: "q" }, format) };
    const p = rangerFond(page([texte, a, b]), format);
    expect(p.elements.filter(estFondPhoto).map((e) => e.id)).toEqual(["p"]);
    expect(fondPhoto(p)?.id).toBe("p");
    const v = rangerFond(page([a, texte], true), format);
    expect(v.elements.some(estFondPhoto)).toBe(false);
    expect(detacherFond(a).enFond).toBeUndefined();
  });
});
