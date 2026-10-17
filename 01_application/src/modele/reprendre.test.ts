import { describe, expect, it } from "vitest";
import { mettreEnFond } from "./fond";
import { correspond, pagesReprises, ressourcesDesElements, ressourcesDesPages } from "./reprendre";
import type { ClipAudio, ElementImage, ElementPage, PageEliot } from "./types";

const base = { rotation: 0, opacite: 1, visible: true, verrouille: false };
const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);
const H = "d".repeat(64);
const photo: ElementImage = { ...base, id: "p", type: "image", x: 100, y: 200, largeur: 400, hauteur: 300, ressource: A, retourneH: false, retourneV: false, groupe: "g1" };
const texte = { ...base, id: "t", type: "texte", x: 0, y: 0, largeur: 500, hauteur: 80, texte: "Titre", police: "Inter", taillePolice: 60, gras: true, italique: false, souligne: false, couleur: "#111111", alignement: "center", interligne: 1.2, espacement: 0, groupe: "g1" } as ElementPage;
const objet = { ...base, id: "o", type: "objet3d", x: 0, y: 0, largeur: 400, hauteur: 400, ressource: B, lumiere: { environnement: { id: H } } } as unknown as ElementPage;
const objetFourni = { ...objet, id: "o2", lumiere: { environnement: { id: "studio" } } } as unknown as ElementPage;
const son: ClipAudio = { id: "s1", ressource: C, temps: { debut: 0, fin: 3000 }, piste: 0, role: "musique" };

describe("reprendre d'un autre design", () => {
  it("les ressources des éléments : photo, photo du fond, modèle 3D et son environnement importé", () => {
    const fond = mettreEnFond({ ...photo, id: "f", ressource: H.replace(/d/g, "e") }, { largeur: 1080, hauteur: 1080 });
    expect(ressourcesDesElements([photo, texte, { ...photo, id: "p2" }, fond, objet, objetFourni])).toEqual([A, "e".repeat(64), B, H]);
  });

  it("celles des pages : leurs sons en plus, une fois chacune", () => {
    const pages = [{ id: "x", fond: "#fff", elements: [photo], duree: 3000, audio: [son] }, { id: "y", fond: "#fff", elements: [photo] }] as PageEliot[];
    expect(ressourcesDesPages(pages)).toEqual([A, C]);
  });

  it("des pages reprises : nouveaux identifiants, groupes gardés ensemble, même format inchangé", () => {
    const page = { id: "x", fond: "#123456", elements: [photo, texte], duree: 3000, audio: [son] } as PageEliot;
    const [copie] = pagesReprises([page], { largeur: 1080, hauteur: 1080 }, { largeur: 1080, hauteur: 1080 });
    expect(copie.id).not.toBe("x");
    expect(copie.fond).toBe("#123456");
    expect(copie.duree).toBe(3000);
    expect(copie.elements.map((e) => e.id)).not.toContain("p");
    expect(copie.elements[0]).toMatchObject({ x: 100, y: 200, largeur: 400, hauteur: 300, ressource: A });
    expect(copie.elements[0].groupe).toBeDefined();
    expect(copie.elements[0].groupe).toBe(copie.elements[1].groupe);
    expect(copie.elements[0].groupe).not.toBe("g1");
    expect(copie.audio).toHaveLength(1);
    expect(copie.audio![0]).toMatchObject({ ressource: C, temps: { debut: 0, fin: 3000 }, role: "musique" });
    expect(copie.audio![0].id).not.toBe("s1");
    // La page d'origine n'est pas touchée.
    expect(page.elements[0].id).toBe("p");
  });

  it("un autre format : mis à l'échelle et centré, comme Redimensionner", () => {
    const [copie] = pagesReprises([{ id: "x", fond: "#fff", elements: [photo, texte] } as PageEliot], { largeur: 1080, hauteur: 1920 }, { largeur: 1080, hauteur: 1080 });
    const s = 1080 / 1920;
    const ox = (1080 - 1080 * s) / 2;
    expect(copie.elements[0].largeur).toBeCloseTo(400 * s, 1);
    expect(copie.elements[0].x).toBeCloseTo(ox + 100 * s, 1);
    expect((copie.elements[1] as { taillePolice: number }).taillePolice).toBeCloseTo(60 * s, 1);
  });

  it("chercher un design : chaque mot, sans accents ni majuscules", () => {
    expect(correspond("Soldes d'été — Café", "cafe ete")).toBe(true);
    expect(correspond("Soldes d'été — Café", "CAFÉ")).toBe(true);
    expect(correspond("Soldes d'été", "hiver")).toBe(false);
    expect(correspond("Bœuf bourguignon", "boeuf")).toBe(true);
    expect(correspond("N'importe quoi", "")).toBe(true);
  });
});
