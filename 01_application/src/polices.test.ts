import { describe, expect, it } from "vitest";
import { policeSystemeUtile } from "./polices";

describe("polices du poste", () => {
  it("garde les polices utiles et écarte les écritures d'autres langues et les symboles", () => {
    for (const f of ["Ubuntu", "Noto Sans", "Noto Serif Display", "DejaVu Sans", "Liberation Serif", "Nimbus Roman"]) expect(policeSystemeUtile(f), f).toBe(true);
    for (const f of ["Noto Sans Tamil", "Noto Serif Khmer", "MathJax_Main", "Unifont Upper", "Noto Color Emoji", "OpenSymbol", "IPAGothic"]) expect(policeSystemeUtile(f), f).toBe(false);
  });
});
