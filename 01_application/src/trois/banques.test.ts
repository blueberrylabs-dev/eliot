import { describe, expect, it } from "vitest";
import { traduireRequete } from "./banques";

describe("les mots français pour les banques 3D", () => {
  it("traduit les mots connus et retire les petits mots", () => {
    expect(traduireRequete("Flacon de parfum")).toBe("bottle perfume");
    expect(traduireRequete("une chaise en bois")).toBe("chair wood");
  });

  it("garde les mots inconnus, les accents en moins, et accepte le pluriel", () => {
    expect(traduireRequete("Bouteilles vintage")).toBe("bottle vintage");
    expect(traduireRequete("forêt nuageux")).toBe("forest cloudy");
    expect(traduireRequete("sneaker")).toBe("sneaker");
    expect(traduireRequete("  ")).toBe("");
    expect(traduireRequete("Œufs au fromage")).toBe("egg cheese");
  });
});
