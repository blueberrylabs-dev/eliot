import { describe, expect, it } from "vitest";
import { modificationsDuStyle, STYLES_MAX, styleDepuisTexte, styleValide, stylesValides, trouverStyle } from "./stylesTexte";

import type { ElementTexte } from "./types";

/** Un texte tout simple, sans passer par la mesure de Konva. */
const texte = (t: string): ElementTexte => ({ id: "t1", type: "texte", x: 10, y: 20, largeur: 600, hauteur: 60, rotation: 0, opacite: 1, visible: true, verrouille: false, texte: t, police: "Inter", taillePolice: 48, gras: false, italique: false, souligne: false, couleur: "#111111", alignement: "center", interligne: 1.2, espacement: 0 });

describe("styles de texte enregistrés", () => {
  it("un style garde l'allure des lettres, pas la place ni le contenu", () => {
    const t = { ...texte("Bonjour"), police: "Anton", taillePolice: 96, couleur: "#c62828", contour: { couleur: "#000000", epaisseur: 6 }, courbe: 40 };
    const s = styleDepuisTexte(t, "  Titre   choc ", "s1");
    expect(s.nom).toBe("Titre choc");
    expect(s).toMatchObject({ id: "s1", police: "Anton", taillePolice: 96, couleur: "#c62828", contour: { couleur: "#000000", epaisseur: 6 } });
    expect(s).not.toHaveProperty("texte");
    expect(s).not.toHaveProperty("x");
    expect(s).not.toHaveProperty("courbe");
    // Une copie : changer le texte ne change pas le style.
    t.contour.epaisseur = 1;
    expect(s.contour?.epaisseur).toBe(6);
  });

  it("poser un style retire les effets qu'il n'a pas", () => {
    const s = styleDepuisTexte(texte("a"), "Simple", "s2");
    const m = modificationsDuStyle(s);
    expect(m.police).toBe("Inter");
    expect("contour" in m && m.contour === undefined).toBe(true);
    expect("ombre" in m && m.ombre === undefined).toBe(true);
    expect(m.barre).toBe(false);
    expect(m.majuscules).toBe(false);
  });

  it("un style lu sur le disque est remis d'aplomb", () => {
    expect(styleValide(null)).toBeNull();
    expect(styleValide({ id: "s1", police: "Inter", taillePolice: 40 })).toBeNull(); // sans couleur
    expect(styleValide({ id: "../x", police: "Inter", taillePolice: 40, couleur: "#000000" })).toBeNull();
    const s = styleValide({ id: "s1", nom: "", police: " Inter ", taillePolice: 5000, couleur: "#ABCDEF", alignement: "justify", gras: "oui", contour: { couleur: "noir" }, ombre: { couleur: "#000000", opacite: 3 } })!;
    expect(s).toMatchObject({ nom: "Mon style", police: "Inter", taillePolice: 800, couleur: "#abcdef", alignement: "center", gras: false, interligne: 1.2, espacement: 0 });
    expect(s.contour).toBeUndefined();
    expect(s.ombre).toEqual({ couleur: "#000000", flou: 10, x: 0, y: 0, opacite: 1 });
    const d = styleValide({ id: "s2", police: "Inter", taillePolice: 40, couleur: { type: "lineaire", angle: 90, arrets: [{ position: 0, couleur: "#FF0000" }, { position: 2, couleur: "#0000ff" }] } })!;
    expect(d.couleur).toEqual({ type: "lineaire", angle: 90, arrets: [{ position: 0, couleur: "#ff0000" }, { position: 1, couleur: "#0000ff" }] });
    expect(styleValide({ id: "s3", police: "Inter", taillePolice: 40, couleur: { type: "lineaire", arrets: [{ position: 0, couleur: "#ff0000" }] } })).toBeNull();
  });

  it("une liste de styles : sans doublon, 24 au plus", () => {
    const un = (id: string) => ({ id, nom: id, police: "Inter", taillePolice: 40, couleur: "#000000" });
    expect(stylesValides("rien")).toEqual([]);
    expect(stylesValides([un("a"), un("a"), { id: "b" }, un("c")]).map((s) => s.id)).toEqual(["a", "c"]);
    expect(stylesValides(Array.from({ length: 30 }, (_, i) => un(`s${i}`)))).toHaveLength(STYLES_MAX);
  });

  it("trouver un style par son identifiant ou son nom", () => {
    const styles = stylesValides([{ id: "s1", nom: "Titre Été", police: "Inter", taillePolice: 40, couleur: "#000000" }]);
    expect(trouverStyle(styles, "s1")?.nom).toBe("Titre Été");
    expect(trouverStyle(styles, " titre été ")?.id).toBe("s1");
    expect(trouverStyle(styles, "autre")).toBeUndefined();
  });
});
