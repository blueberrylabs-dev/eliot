import { describe, expect, it } from "vitest";
// La fabrique des personnages (outils/) : lecture et mesure des SVG des archives.
import { analyserSvg, boiteSvg, contenuSvg, hexNormalise } from "../../outils/personnages.mjs";
import {
  appliquerCouleurs,
  boiteApresPiece,
  boiteApresPosture,
  boiteDeDepart,
  corpsCompose,
  couleursDuDessin,
  piecesAuHasard,
  piecesValides,
  svgPersonnage,
  vueComposee,
  type Composition,
} from "./personnages";

/** Une petite composition : un corps, une tête, une barbe facultative. */
const COMPO: Composition = {
  fichier: "essai-pieces.json",
  postures: [
    {
      id: "buste",
      libelle: "Buste",
      emplacements: [
        { id: "corps", groupe: "corps-buste", x: 0, y: 100 },
        { id: "tete", groupe: "tete", x: 20, y: 0 },
        { id: "barbe", groupe: "barbe", x: 30, y: 60, facultatif: true },
      ],
      defaut: { corps: "tee" },
    },
    {
      id: "debout",
      libelle: "Debout",
      emplacements: [
        { id: "corps", groupe: "corps-debout", x: -10, y: 100 },
        { id: "tete", groupe: "tete", x: 20, y: 0 },
      ],
    },
  ],
  emplacements: [
    { id: "corps", libelle: "Tenue" },
    { id: "tete", libelle: "Coiffure" },
    { id: "barbe", libelle: "Barbe" },
  ],
  couleurs: [
    { id: "trait", libelle: "Trait", defaut: "#000000" },
    { id: "tete", libelle: "Tête", defaut: "#FFFFFF" },
    { id: "corps", libelle: "Tenue", defaut: "#FFFFFF" },
  ],
  defaut: { posture: "buste", pieces: { tete: "court" } },
  groupes: {
    "corps-buste": [
      { id: "robe", libelle: "Robe", boite: [0, 0, 100, 80] },
      { id: "tee", libelle: "Tee-shirt", boite: [0, 0, 120, 90] },
    ],
    "corps-debout": [{ id: "marche", libelle: "Marche", boite: [0, 0, 80, 300] }],
    tete: [
      { id: "afro", libelle: "Afro", boite: [-10, -10, 100, 110] },
      { id: "court", libelle: "Courts", boite: [0, 0, 80, 90] },
    ],
    barbe: [{ id: "pleine", libelle: "Barbe", boite: [0, 0, 60, 50] }],
  },
};

describe("composer un personnage", () => {
  it("garde les pièces connues, remplace les inconnues par le défaut", () => {
    expect(piecesValides(COMPO, "buste", { corps: "robe", tete: "afro" })).toEqual({ posture: "buste", pieces: { corps: "robe", tete: "afro" } });
    expect(piecesValides(COMPO, "buste", { corps: "inconnu" }).pieces).toEqual({ corps: "tee", tete: "court" });
    // Posture inconnue : celle du défaut ; barbe inconnue : rien.
    expect(piecesValides(COMPO, "volant", { barbe: "x" })).toEqual({ posture: "buste", pieces: { corps: "tee", tete: "court" } });
    // « "" » : retirée exprès, gardée telle quelle.
    expect(piecesValides(COMPO, "buste", { barbe: "" }).pieces.barbe).toBe("");
  });

  it("change de posture : la tenue suit, les autres pièces restent", () => {
    const debout = piecesValides(COMPO, "debout", { corps: "robe", tete: "afro", barbe: "pleine" });
    expect(debout.pieces).toEqual({ corps: "marche", tete: "afro", barbe: "pleine" });
  });

  it("cadre toutes les pièces posées, avec une petite marge", () => {
    const vue = vueComposee(COMPO, "buste", { corps: "tee", tete: "afro" });
    // Tête de 10 à 110 en x (20 - 10), de -10 à 100 en y ; corps de 0 à 120, de 100 à 190.
    const marge = 200 * 0.006;
    expect(vue[0]).toBeCloseTo(0 - marge);
    expect(vue[1]).toBeCloseTo(-10 - marge);
    expect(vue[2]).toBeCloseTo(120 + 2 * marge);
    expect(vue[3]).toBeCloseTo(200 + 2 * marge);
    // Vignette de la tête seule.
    expect(vueComposee(COMPO, "buste", { corps: "tee", tete: "court" }, ["tete"])[2]).toBeCloseTo(80 + 2 * 90 * 0.006);
  });

  it("assemble le dessin dans l'ordre, chaque pièce à sa place", () => {
    const contenus = { "corps-buste": { tee: "<path data-p='tee'/>" }, tete: { court: "<path data-p='court'/>" }, barbe: { pleine: "<path data-p='barbe'/>" } };
    const corps = corpsCompose(COMPO, "buste", { corps: "tee", tete: "court", barbe: "pleine" }, contenus);
    expect(corps).toBe(`<g transform="translate(0 100)"><path data-p='tee'/></g><g transform="translate(20 0)"><path data-p='court'/></g><g transform="translate(30 60)"><path data-p='barbe'/></g>`);
    expect(corpsCompose(COMPO, "buste", { corps: "tee", tete: "court", barbe: "" }, contenus)).not.toContain("barbe");
  });

  it("tire au hasard des pièces valides, toujours les mêmes avec le même hasard", () => {
    let graine = 3;
    const hasard = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 20; i++) {
      const r = piecesAuHasard(COMPO, undefined, hasard);
      expect(piecesValides(COMPO, r.posture, r.pieces)).toEqual(r);
    }
    graine = 5;
    const a = piecesAuHasard(COMPO, "buste", hasard);
    graine = 5;
    expect(piecesAuHasard(COMPO, "buste", hasard)).toEqual(a);
  });
});

describe("couleurs d'un personnage", () => {
  const dessin = '<path fill="#FFFFFF" data-c="f-tete" d="M0 0"/><path fill="#000000" data-c="i" d="M1 1"/><path fill="#FFFFFF" data-c="f-corps" d="M2 2"/><path fill="#D08B5B" d="M3 3"/><path fill="#D08B5B"/><rect stroke="#4F66AF"/>';

  it("liste les parties marquées puis les autres couleurs, les plus présentes d'abord", () => {
    expect(couleursDuDessin(dessin, COMPO.couleurs)).toEqual([
      { cle: "trait", libelle: "Trait", origine: "#000000" },
      { cle: "tete", libelle: "Tête", origine: "#FFFFFF" },
      { cle: "corps", libelle: "Tenue", origine: "#FFFFFF" },
      { cle: "#D08B5B", libelle: "#D08B5B", origine: "#D08B5B" },
      { cle: "#4F66AF", libelle: "#4F66AF", origine: "#4F66AF" },
    ]);
  });

  it("change une partie sans toucher aux autres de même couleur", () => {
    const r = appliquerCouleurs(dessin, { corps: "#ff0000", "#d08b5b": "#00ff00", trait: "#123456" });
    expect(r).toContain('fill="#FFFFFF" data-c="f-tete"');
    expect(r).toContain('fill="#ff0000" data-c="f-corps"');
    expect(r).toContain('fill="#123456" data-c="i"');
    expect(r.match(/#00ff00/g)).toHaveLength(2);
    expect(r).toContain('stroke="#4F66AF"');
    expect(appliquerCouleurs(dessin, {})).toBe(dessin);
  });
});

describe("place d'un personnage sur la page", () => {
  it("une pièce qui change ne déplace pas le reste", () => {
    const el = { x: 100, y: 200, largeur: 300, hauteur: 600, rotation: 0 };
    // Le dessin s'agrandit vers le haut de 10 unités (échelle 3) : la boîte monte de 30 px.
    expect(boiteApresPiece(el, [0, 0, 100, 200], [0, -10, 100, 210])).toEqual({ x: 100, y: 170, largeur: 300, hauteur: 630 });
    // Retourné : ce qui s'ajoute à gauche du dessin s'ajoute à droite sur la page.
    const r = boiteApresPiece({ ...el, retourneH: true }, [0, 0, 100, 200], [-20, 0, 120, 200]);
    expect(r).toEqual({ x: 100, y: 200, largeur: 360, hauteur: 600 });
    // Tourné d'un quart de tour : un décalage vers le haut du dessin part vers la droite.
    const t = boiteApresPiece({ ...el, rotation: 90 }, [0, 0, 100, 200], [0, -10, 100, 210]);
    expect(t.x).toBeCloseTo(130);
    expect(t.y).toBeCloseTo(200);
  });

  it("une posture qui change garde la hauteur et le centre du bas", () => {
    expect(boiteApresPosture({ x: 100, y: 200, largeur: 300, hauteur: 600, rotation: 0 }, [0, 0, 50, 300])).toEqual({ x: 200, y: 200, largeur: 100, hauteur: 600 });
  });

  it("un nouveau personnage tient dans la page, au centre", () => {
    expect(boiteDeDepart({ largeur: 1080, hauteur: 1080 }, [0, 0, 100, 300])).toEqual({ x: 414, y: 162, largeur: 252, hauteur: 756 });
    expect(boiteDeDepart({ largeur: 1080, hauteur: 1080 }, [0, 0, 200, 100])).toEqual({ x: 297, y: 419, largeur: 486, hauteur: 243 });
  });

  it("le SVG complet garde les proportions à la taille demandée", () => {
    expect(svgPersonnage([10, 20, 100, 200], "<g/>", 512)).toContain('viewBox="10 20 100 200" width="256" height="512"');
  });
});

describe("fabrique des personnages (archives)", () => {
  it("mesure ce qui se voit, transformations comprises, sans les masques", () => {
    const svg = analyserSvg(`<svg viewBox="0 0 500 500"><defs><rect id="r" x="0" y="0" width="999" height="999"/></defs>
      <g transform="translate(100, 50)"><rect x="10" y="10" width="20" height="30" fill="#000"/>
      <g transform="rotate(90)"><path d="M0 0 L10 0 L10 5 Z" fill="#fff"/></g></g>
      <path d="M0 0 L400 400" fill="none"/></svg>`);
    const b = boiteSvg(svg);
    // Rectangle : x 110 à 130, y 60 à 90 ; triangle tourné : x 95 à 100, y 50 à 60.
    expect(b[0]).toBeCloseTo(95);
    expect(b[1]).toBeCloseTo(50);
    expect(b[0] + b[2]).toBeCloseTo(130);
    expect(b[1] + b[3]).toBeCloseTo(90);
  });

  it("nettoie le SVG, marque fonds et encre, préfixe les identifiants utiles", () => {
    const svg = analyserSvg(`<?xml version="1.0"?><svg viewBox="0 0 10 10"><title>x</title><!-- Sketch -->
      <g id="head/mono/Afro" fill="#000"><path id="🎨-Background" fill="#fff" d="M1.23456 2 L3 4"/><path id="🖍-Ink" d="M0 0"/>
      <mask id="mask-2"><use xlink:href="#path-1"/></mask><path id="path-1" mask="url(#mask-2)" d="M0 0"/></g></svg>`);
    const c = contenuSvg(svg, { prefixe: "o7-", marquer: true });
    expect(c).not.toContain("title");
    expect(c).not.toContain("Sketch");
    expect(c).toContain('fill="#FFFFFF" data-c="f-tete" d="M1.23 2 L3 4"');
    expect(c).toContain('fill="#000000" data-c="i"');
    expect(c).toContain('<mask id="o7-1">');
    expect(c).toContain('xlink:href="#o7-0"');
    expect(c).toContain('mask="url(#o7-1)"');
    expect(c).not.toContain("head/mono");
    expect(hexNormalise("#abc")).toBe("#AABBCC");
  });
});
