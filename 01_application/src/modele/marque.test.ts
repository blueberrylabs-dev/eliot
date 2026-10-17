import { describe, expect, it } from "vitest";
import { creerForme, creerQr } from "./fabriques";
import { kitValide, kitVide, modifCouleur } from "./marque";

describe("kit de marque", () => {
  it("un kit lu sur le disque est remis d'aplomb, sans rien inventer", () => {
    const kit = kitValide({
      nom: "  Nimeria  ",
      couleurs: [{ valeur: "#0B3D91", nom: "Bleu nuit" }, "#f2a900", { valeur: "#0b3d91" }, { valeur: "rouge" }, 12],
      polices: { titre: { famille: "Anton", gras: true }, texte: { famille: "" }, inconnu: { famille: "Inter" } },
      logos: ["a".repeat(64), "pas-une-empreinte", "a".repeat(64)],
    });
    expect(kit.nom).toBe("Nimeria");
    // Les doublons et les couleurs mal écrites sont écartés, la casse est ramenée en minuscules.
    expect(kit.couleurs).toEqual([{ valeur: "#0b3d91", nom: "Bleu nuit" }, { valeur: "#f2a900" }]);
    expect(kit.polices).toEqual({ titre: { famille: "Anton", gras: true } });
    expect(kit.logos).toEqual(["a".repeat(64)]);
    expect(kit.styles).toEqual([]);
    // Les styles de texte enregistrés (étape 7, lot 2) : les bons restent, les autres s'en vont.
    const avecStyles = kitValide({ styles: [{ id: "s1", nom: "Titre", police: "Anton", taillePolice: 96, couleur: "#0b3d91" }, { id: "s2" }] });
    expect(avecStyles.styles.map((s) => s.nom)).toEqual(["Titre"]);
    expect(kitValide(null)).toEqual(kitVide());
    expect(kitValide("n'importe quoi")).toEqual(kitVide());
  });

  it("une couleur de la marque va au bon endroit selon l'objet", () => {
    const format = { largeur: 1080, hauteur: 1080 };
    expect(modifCouleur(creerForme(format, "rectangle"), "#123456")).toEqual({ remplissage: "#123456" });
    // Une ligne ou une flèche porte la couleur de son trait dans son remplissage.
    expect(modifCouleur(creerForme(format, "fleche"), "#123456")).toEqual({ remplissage: "#123456" });
    expect(modifCouleur(creerQr(format, "https://exemple.fr", "#000000"), "#123456")).toEqual({ couleur: "#123456" });
  });
});
