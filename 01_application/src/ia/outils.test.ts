import { describe, expect, it } from "vitest";
import definitions from "./outils.json";
import { OUTILS_CODES, OUTILS_DECRITS } from "./outils";

describe("outils de l'IA", () => {
  it("chaque outil décrit a son code, et inversement", () => {
    expect([...OUTILS_DECRITS].sort()).toEqual([...OUTILS_CODES].sort());
  });
  it("les noms respectent la règle MCP et chaque outil a un schéma objet", () => {
    for (const d of definitions as { name: string; description: string; inputSchema: { type: string } }[]) {
      expect(d.name).toMatch(/^[a-z0-9_]{1,64}$/);
      expect(d.description.length).toBeGreaterThan(20);
      expect(d.inputSchema.type).toBe("object");
    }
  });
});
