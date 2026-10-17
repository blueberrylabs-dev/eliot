import { describe, expect, it } from "vitest";
import { prendreCouleur, usePipette } from "./pipette";

describe("la pipette", () => {
  it("la couleur prise va à qui l'attend, une fois ; renoncer ne donne rien", () => {
    const recues: string[] = [];
    usePipette.getState().commencer((hex) => recues.push(hex));
    expect(usePipette.getState().attente).not.toBeNull();
    prendreCouleur("#1d3557");
    expect(recues).toEqual(["#1d3557"]);
    expect(usePipette.getState().attente).toBeNull();
    prendreCouleur("#ffffff");
    usePipette.getState().commencer((hex) => recues.push(hex));
    usePipette.getState().finir();
    prendreCouleur("#000000");
    expect(recues).toEqual(["#1d3557"]);
  });
});
