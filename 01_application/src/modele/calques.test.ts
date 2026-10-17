import { describe, expect, it } from "vitest";
import { lignesCalques, placerDansPile, rassemblerGroupe, sortirDuGroupe } from "./calques";
import { creerForme, creerIcone, nomElement } from "./fabriques";
import type { ElementPage, PageEliot } from "./types";

const format = { largeur: 1080, hauteur: 1080 };
const el = (id: string, extra: Partial<ElementPage> = {}): ElementPage => ({ ...creerForme(format, "rectangle"), id, ...extra }) as ElementPage;
const page = (elements: ElementPage[], extra: Partial<PageEliot> = {}): PageEliot => ({ id: "p", fond: "#ffffff", elements, ...extra });
const ids = (p: PageEliot) => p.elements.map((e) => e.id).join("");

describe("panneau des calques : les lignes", () => {
  it("du premier plan vers le fond ; un groupe qui se suit a sa ligne, ses membres en retrait", () => {
    const lignes = lignesCalques([el("a"), el("b", { groupe: "g" }), el("c", { groupe: "g" }), el("d")]);
    expect(lignes.map((l) => (l.genre === "groupe" ? `G${l.numero}:${l.membres.map((m) => m.id).join("")}` : `${l.el.id}${l.retrait ? "»" : ""}`))).toEqual(["d", "G1:cb", "c»", "b»", "a"]);
  });

  it("replié, le groupe cache ses membres ; éparpillé, chacun reste à sa place, marqué", () => {
    const replie = lignesCalques([el("a", { groupe: "g" }), el("b", { groupe: "g" })], new Set(["g"]));
    expect(replie.map((l) => l.genre)).toEqual(["groupe"]);
    const epars = lignesCalques([el("a", { groupe: "g" }), el("b"), el("c", { groupe: "g" })]);
    expect(epars.map((l) => (l.genre === "element" ? `${l.el.id}:${l.groupe ?? ""}:${l.retrait}` : "G"))).toEqual(["c:g:false", "b::false", "a:g:false"]);
  });
});

describe("panneau des calques : l'ordre", () => {
  it("page fixe : au-dessus ou au-dessous d'un autre, en gardant leur ordre", () => {
    const p = page([el("a"), el("b"), el("c"), el("d")]);
    expect(ids(placerDansPile(p, ["a"], "c", "dessus"))).toBe("bcad");
    expect(ids(placerDansPile(p, ["d"], "a", "dessous"))).toBe("dabc");
    expect(ids(placerDansPile(p, ["d", "a"], "b", "dessus"))).toBe("badc");
    expect(placerDansPile(p, ["a"], "a", "dessus")).toBe(p);
    expect(placerDansPile(p, ["b"], "a", "dessus")).toBe(p);
  });

  it("page vidéo : une piste entre celle du repère et sa voisine ; la principale ne bouge pas", () => {
    const v = (id: string, piste: number) => el(id, { piste, temps: { debut: 0, fin: 5000 } });
    const p = page([v("fond", 0), v("a", 1), v("b", 2)], { duree: 5000 });
    expect(placerDansPile(p, ["b"], "a", "dessous").elements.find((e) => e.id === "b")?.piste).toBe(0.5);
    expect(placerDansPile(p, ["a"], "b", "dessus").elements.find((e) => e.id === "a")?.piste).toBe(2.5);
    expect(placerDansPile(p, ["b"], "fond", "dessous").elements.find((e) => e.id === "b")?.piste).toBe(0.5);
    expect(placerDansPile(p, ["fond"], "b", "dessus")).toBe(p);
  });

  it("grouper range le groupe d'un bloc ; un membre qui sort défait un groupe d'un seul", () => {
    const p = page([el("a", { groupe: "g" }), el("b"), el("c", { groupe: "g" }), el("d")]);
    expect(ids(rassemblerGroupe(p, "g"))).toBe("bacd");
    const sorti = sortirDuGroupe(page([el("a", { groupe: "g" }), el("b", { groupe: "g" }), el("c", { groupe: "g" })]), ["a"]);
    expect(sorti.elements.map((e) => e.groupe ?? "-")).toEqual(["-", "g", "g"]);
    const seul = sortirDuGroupe(page([el("a", { groupe: "g" }), el("b", { groupe: "g" })]), ["a"]);
    expect(seul.elements.map((e) => e.groupe ?? "-")).toEqual(["-", "-"]);
  });
});

describe("panneau des calques : le nom", () => {
  it("le nom donné passe avant celui du contenu ; une icône n'affiche pas l'identifiant de son dessin", () => {
    expect(nomElement(el("a", { libelle: "  Bouton  " }))).toBe("Bouton");
    expect(nomElement(el("a"))).toBe("Rectangle");
    const icone = creerIcone(format, "tabler", "heart");
    expect(nomElement(icone)).toBe("Icône heart");
    expect(nomElement({ ...icone, libelle: "Cœur" })).toBe("Cœur");
  });
});
