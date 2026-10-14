import { describe, expect, it } from "vitest";
import { chercher, normaliser, termesPour, type EntreeIndex } from "./recherche";

const dictionnaire = { maison: ["home", "house"], velo: ["bike", "bicycle"], panier: ["shopping-cart", "basket"] };

const index: EntreeIndex[] = [
  ["tabler", "home-dollar", "home dollar money"],
  ["tabler", "home", "home house building"],
  ["tabler", "bike", "bike bicycle cycling"],
  ["tabler", "shopping-cart", "shopping cart buy"],
  ["fluent", "red-heart", "red heart coeur rouge amour"],
  ["openmoji", "1f6b2", "bicycle velo"],
];

describe("recherche dans la bibliothèque", () => {
  it("normalise les accents, les majuscules et la ponctuation", () => {
    expect(normaliser("  Vélo, Cœur l’Été ! ")).toBe("velo coeur l ete");
  });

  it("traduit un mot français et ses débuts de mots", () => {
    expect(termesPour("maison", dictionnaire)).toEqual(expect.arrayContaining(["maison", "home", "house"]));
    expect(termesPour("vel", dictionnaire)).toEqual(expect.arrayContaining(["bike", "bicycle"]));
    expect(termesPour("panier", dictionnaire)).toEqual(expect.arrayContaining(["shopping", "cart"]));
  });

  it("trouve une icône par un mot français, la plus simple d'abord", () => {
    const r = chercher(index, "Maison", dictionnaire);
    expect(r.map((e) => e[1])).toEqual(["home", "home-dollar"]);
  });

  it("garde seulement ce qui contient tous les mots", () => {
    expect(chercher(index, "maison argent", { ...dictionnaire, argent: ["money"] }).map((e) => e[1])).toEqual(["home-dollar"]);
  });

  it("trouve un emoji par son nom français et filtre par collection", () => {
    expect(chercher(index, "cœur", dictionnaire).map((e) => e[1])).toEqual(["red-heart"]);
    expect(chercher(index, "vélo", dictionnaire, (c) => c !== "tabler").map((e) => e[0])).toEqual(["openmoji"]);
  });

  it("un mot du nom passe devant un mot-clé seul", () => {
    const liste: EntreeIndex[] = [
      ["fluent", "wedding", "wedding chapelle coeur mariage"],
      ["fluent", "red-heart", "red heart coeur rouge"],
    ];
    expect(chercher(liste, "cœur", { coeur: ["heart"] })[0][1]).toBe("red-heart");
  });

  it("une requête vide ne renvoie rien", () => {
    expect(chercher(index, "   ", dictionnaire)).toEqual([]);
  });
});
