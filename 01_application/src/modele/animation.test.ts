import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  contextesTransitions,
  couperCles,
  dos,
  douce,
  dureeConseillee,
  dureesEntreeSortie,
  effetA,
  etatAnime,
  etatUnite,
  gainSon,
  poseA,
  poserCle,
  rebondi,
  retirerCle,
  type ContexteAnimation,
  type Unites,
} from "./animation";
import { normaliser, placer, rogner, scinder } from "./frise";
import type { ElementPage, ElementTexte, ElementVideo, PageEliot } from "./types";

const FORMAT = { largeur: 1080, hauteur: 1920 };
const CTX: ContexteAnimation = { format: FORMAT };
const base = { x: 100, y: 200, largeur: 400, hauteur: 200, rotation: 0, opacite: 1, visible: true, verrouille: false };
const texte = (extra: Partial<ElementTexte> = {}): ElementTexte => ({
  ...base, id: "t", type: "texte", texte: "Bonjour à tous", police: "Inter", taillePolice: 60, gras: false, italique: false, souligne: false, alignement: "left", couleur: "#000000", interligne: 1.2, espacement: 0, temps: { debut: 1000, fin: 4000 }, piste: 1, ...extra,
});
const video = (id: string, extra: Partial<ElementVideo> = {}): ElementVideo => ({ ...base, id, type: "video", ressource: "v4s", retourneH: false, retourneV: false, piste: 0, ...extra });
const durees = (r: string) => ({ v4s: 4000, v10s: 10_000 })[r as "v4s"];
const page = (elements: ElementPage[], duree = 5000): PageEliot => ({ id: "p", fond: "#000000", elements, duree });
const proche = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;

describe("animation : courbes", () => {
  it("partent de 0 et arrivent à 1", () => {
    for (const f of [douce, dos, rebondi]) {
      expect(proche(f(0), 0)).toBe(true);
      expect(proche(f(1), 1)).toBe(true);
    }
    expect(douce(0.5)).toBe(0.5);
    // Le rebond dépasse l'arrivée avant d'y revenir.
    expect(Math.max(...Array.from({ length: 101 }, (_, i) => dos(i / 100)))).toBeGreaterThan(1.05);
  });
});

describe("animation : entrées, sorties, boucles", () => {
  it("un fondu d'entrée de 500 ms et une sortie qui monte", () => {
    const t = texte({ animations: { entree: { nom: "fondu", duree: 500 }, sortie: { nom: "glissement-haut", duree: 600 } } });
    expect(effetA(t, 1250, CTX).opacite).toBeCloseTo(0.5);
    expect(effetA(t, 1600, CTX)).toEqual({ dx: 0, dy: 0, echelle: 1, rotation: 0, opacite: 1 });
    // Sortie à mi-chemin (300 ms sur 600) : x = 0,5³ = 0,125 de 15 % de la hauteur.
    const e = effetA(t, 3700, CTX);
    expect(e.dy).toBeCloseTo(-0.125 * 0.15 * 1920);
    expect(e.opacite).toBe(1);
  });

  it("entrée et sortie plus longues que le clip se partagent sa durée", () => {
    const t = texte({ temps: { debut: 0, fin: 1000 }, animations: { entree: { nom: "fondu", duree: 1500 }, sortie: { nom: "fondu", duree: 500 } } });
    expect(dureesEntreeSortie(t)).toEqual({ entree: 750, sortie: 250 });
  });

  it("une boucle tourne sur sa période, un zoom lent couvre le clip", () => {
    const t = texte({ animations: { boucle: { nom: "balancement", duree: 1600 } } });
    expect(effetA(t, 1000 + 400, CTX).rotation).toBeCloseTo(5);
    const z = texte({ animations: { boucle: { nom: "zoom-lent", duree: 0 } } });
    expect(effetA(z, 4000, CTX).echelle).toBeCloseTo(1.15);
    expect(effetA(z, 2500, CTX).echelle).toBeCloseTo(1.075);
  });

  it("un texte qui entre par morceaux porte l'avancement, pas une opacité", () => {
    const t = texte({ animations: { entree: { nom: "machine-a-ecrire", duree: 1000 } } });
    const e = effetA(t, 1350, CTX);
    expect(e.unites).toEqual({ genre: "machine-a-ecrire", sens: "entree", p: 0.35 });
    expect(e.opacite).toBe(1);
    expect(effetA(t, 2100, CTX).unites).toBeUndefined();
  });

  it("machine à écrire, lettres, lignes : chaque morceau à son tour", () => {
    const m: Unites = { genre: "machine-a-ecrire", sens: "entree", p: 0.35 };
    expect(Array.from({ length: 10 }, (_, i) => etatUnite(m, i, 10).opacite)).toEqual([1, 1, 1, 1, 0, 0, 0, 0, 0, 0]);
    const efface: Unites = { genre: "machine-a-ecrire", sens: "sortie", p: 0.35 };
    expect(Array.from({ length: 10 }, (_, i) => etatUnite(efface, i, 10).opacite)).toEqual([1, 1, 1, 1, 1, 1, 1, 0, 0, 0]);
    const l: Unites = { genre: "lignes", sens: "entree", p: 0.5 };
    const [a, b, c] = [0, 1, 2].map((i) => etatUnite(l, i, 3));
    expect(a.opacite).toBeGreaterThan(b.opacite);
    expect(b.opacite).toBeGreaterThan(c.opacite);
    expect(etatUnite({ genre: "lettres", sens: "entree", p: 1 }, 7, 8)).toEqual({ opacite: 1, dyEm: 0, echelle: 1 });
  });

  it("la durée conseillée d'un texte par morceaux suit sa longueur", () => {
    const court = texte({ texte: "Oui" });
    const long = texte({ texte: "Une phrase bien plus longue que la première" });
    expect(dureeConseillee("entree", "machine-a-ecrire", long)).toBeGreaterThan(dureeConseillee("entree", "machine-a-ecrire", court));
    expect(dureeConseillee("entree", "fondu", long)).toBe(500);
  });
});

describe("animation : images clés", () => {
  it("une clé d'échelle grandit autour du centre", () => {
    const t = texte({ cles: [{ t: 0, echelle: 1, courbe: "lineaire" }, { t: 1000, echelle: 2 }] });
    const p = poseA(t, 500);
    expect(p.echelle).toBeCloseTo(1.5);
    // Centre (300, 300) immobile : coin = centre − la moitié de la boîte agrandie.
    expect(p.x).toBeCloseTo(300 - 300);
    expect(p.y).toBeCloseTo(300 - 150);
  });

  it("des poses complètes : exactes sur les clés, le centre glisse entre elles", () => {
    const t = texte({ cles: [{ t: 0, x: 0, y: 0, echelle: 1, rotation: 0 }, { t: 1000, x: 600, y: 0, echelle: 1, rotation: 90 }] });
    const fin = poseA(t, 1000);
    expect(fin.x).toBeCloseTo(600);
    expect(fin.y).toBeCloseTo(0);
    expect(fin.rotation).toBe(90);
    // Centres : (200, 100) puis, tourné de 90°, (600 − 100, 200) = (500, 200) ; à mi-chemin (350, 150).
    const m = poseA(t, 500);
    const a = (m.rotation * Math.PI) / 180;
    expect(m.x + 200 * Math.cos(a) - 100 * Math.sin(a)).toBeCloseTo(350);
    expect(m.y + 200 * Math.sin(a) + 100 * Math.cos(a)).toBeCloseTo(150);
    expect(poseA(t, -500).x).toBeCloseTo(0);
    expect(poseA(t, 5000).x).toBeCloseTo(600);
  });

  it("poser une clé : neuve avec toute la pose, ou reprise à 40 ms près", () => {
    const t = texte();
    const une = poserCle(t, 0);
    expect(une).toEqual([{ t: 0, x: 100, y: 200, echelle: 1, rotation: 0, opacite: 1 }]);
    const deux = poserCle({ ...t, cles: une }, 1000, { x: 500 });
    expect(deux.map((c) => [c.t, c.x])).toEqual([[0, 100], [1000, 500]]);
    const reprise = poserCle({ ...t, cles: deux }, 1030, { opacite: 0.5 });
    expect(reprise).toHaveLength(2);
    expect(reprise[1]).toMatchObject({ t: 1000, x: 500, opacite: 0.5 });
    expect(retirerCle({ ...t, cles: reprise }, 990)).toHaveLength(1);
    expect(retirerCle({ ...t, cles: une }, 0)).toBeUndefined();
  });

  it("couper un clip garde le mouvement d'une moitié à l'autre", () => {
    const t = texte({ cles: [{ t: 0, x: 0, y: 0, echelle: 1 }, { t: 3000, x: 900, y: 300, echelle: 2 }] });
    const { avant, apres } = couperCles(t, 1200);
    const avantPose = poseA({ ...t, cles: avant }, 1200);
    const apresPose = poseA({ ...t, cles: apres }, 0);
    const origine = poseA(t, 1200);
    for (const k of ["x", "y", "echelle"] as const) {
      expect(avantPose[k]).toBeCloseTo(origine[k], 1);
      expect(apresPose[k]).toBeCloseTo(origine[k], 1);
    }
    expect(poseA({ ...t, cles: apres }, 1800).x).toBeCloseTo(poseA(t, 3000).x, 1);
  });

  it("la pose seule pour l'élément choisi : sans les effets", () => {
    const t = texte({ animations: { entree: { nom: "fondu", duree: 500 } } });
    expect(etatAnime(t, 1100, CTX, true).effet.opacite).toBe(1);
    expect(etatAnime(t, 1100, CTX).effet.opacite).toBeCloseTo(0.2);
  });
});

describe("animation : transitions et son", () => {
  const scene = () =>
    normaliser(
      page([video("a", { temps: { debut: 0, fin: 4000 }, volume: 0.8 }), video("b", { temps: { debut: 4000, fin: 8000 }, transition: { nom: "glissement", duree: 1000 } })]),
      durees,
    );

  it("une transition fait chevaucher les deux clips et raccourcit la page", () => {
    const p = scene();
    expect(p.elements.map((e) => [e.id, e.temps!.debut, e.temps!.fin])).toEqual([["a", 0, 4000], ["b", 3000, 7000]]);
    expect(p.duree).toBe(7000);
    const ctx = contextesTransitions(p);
    expect(ctx.get("b")?.entree).toEqual({ nom: "glissement", debut: 3000, fin: 4000 });
    expect(ctx.get("a")?.sortie).toEqual({ nom: "glissement", debut: 3000, fin: 4000 });
    const vue = (id: string) => ({ format: FORMAT, transitionEntree: ctx.get(id)?.entree, transitionSortie: ctx.get(id)?.sortie });
    // À mi-chemin : « b » arrive de la droite, « a » part à gauche, de la moitié de la page.
    expect(effetA(p.elements[1], 3500, vue("b")).dx).toBeCloseTo(540);
    expect(effetA(p.elements[0], 3500, vue("a")).dx).toBeCloseTo(-540);
    // Le son passe de l'un à l'autre.
    expect(gainSon(p.elements[0] as ElementVideo, 3500, vue("a"))).toBeCloseTo(0.4);
    expect(gainSon(p.elements[1] as ElementVideo, 3500, vue("b"))).toBeCloseTo(0.5);
  });

  it("une transition se limite à la moitié du plus court, n'existe qu'entre deux clips de la principale", () => {
    let p = normaliser(page([video("a", { temps: { debut: 0, fin: 4000 } }), video("b", { temps: { debut: 4000, fin: 8000 }, transition: { nom: "fondu", duree: 9000 } })]), durees);
    expect(p.elements[1].temps).toEqual({ debut: 2000, fin: 6000 });
    p = normaliser(page([video("a", { temps: { debut: 0, fin: 4000 }, transition: { nom: "fondu", duree: 500 } })]), durees);
    expect(p.elements[0].transition).toBeUndefined();
  });

  it("placer, scinder pendant et hors d'une transition", () => {
    let p = scene();
    // Tête dans « a » : la vidéo neuve passe entre « a » et « b ».
    p = placer(p, [video("c")], 1000, durees);
    expect(p.elements.filter((e) => e.piste === 0).map((e) => e.id)).toEqual(["a", "c", "b"]);
    p = scene();
    expect(scinder(p, ["a", "b"], 3500, durees, () => "x").nouveaux).toEqual([]);
    const r = scinder(p, ["b"], 5000, durees, () => "b2");
    const b = r.page.elements.find((e) => e.id === "b")!;
    const b2 = r.page.elements.find((e) => e.id === "b2")!;
    expect(b.transition?.nom).toBe("glissement");
    expect(b2.transition).toBeUndefined();
  });

  it("fondus du son au début et à la fin du clip", () => {
    const v = video("v", { temps: { debut: 0, fin: 4000 }, fonduEntree: 1000, fonduSortie: 2000 });
    expect(gainSon(v, 500, {})).toBeCloseTo(0.5);
    expect(gainSon(v, 1500, {})).toBe(1);
    expect(gainSon(v, 3000, {})).toBeCloseTo(0.5);
  });
});

describe("animation : la frise garde animations et clés", () => {
  it("scinder partage entrée, sortie, boucle et clés", () => {
    const t = texte({ animations: { entree: { nom: "fondu", duree: 500 }, sortie: { nom: "fondu", duree: 500 }, boucle: { nom: "pulsation", duree: 1000 } }, cles: [{ t: 0, echelle: 1 }, { t: 3000, echelle: 2 }] });
    const r = scinder(page([t]), ["t"], 2500, durees, () => "t2");
    const [a, b] = r.page.elements;
    expect(a.animations).toEqual({ entree: { nom: "fondu", duree: 500 }, boucle: { nom: "pulsation", duree: 1000 } });
    expect(b.animations).toEqual({ sortie: { nom: "fondu", duree: 500 }, boucle: { nom: "pulsation", duree: 1000 } });
    expect(a.cles?.map((c) => c.t)).toEqual([0, 1500]);
    expect(b.cles?.map((c) => c.t)).toEqual([0, 1500]);
    expect(b.cles?.[0].echelle).toBeCloseTo(poseA(t, 1500).echelle, 2);
  });

  it("rogner le début garde les clés sur le même moment", () => {
    const t = texte({ cles: [{ t: 0, echelle: 1 }, { t: 2000, echelle: 2 }] });
    const p = rogner(page([t]), "t", "debut", 1500, durees);
    expect(p.elements[0].temps).toEqual({ debut: 1500, fin: 4000 });
    expect(p.elements[0].cles?.map((c) => c.t)).toEqual([-500, 1500]);
  });
});

// ---- Le tableau commun avec le Rust (lot 4) ----
// `ECRIRE_ATTENDUS=1 npx vitest run src/modele/animation.test.ts` le réécrit ; sinon, il est relu
// et chaque valeur doit se retrouver à un millionième près.

const CHEMIN_ATTENDUS = new URL("./animation.attendus.json", import.meta.url);
const arrondi = (v: unknown): unknown => {
  if (typeof v === "number") return Math.round(v * 1e6) / 1e6 + 0;
  if (Array.isArray(v)) return v.map(arrondi);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, arrondi(x)]));
  return v;
};

/** Ce qui compte pour les formules : le reste d'un élément n'entre pas dans le tableau. */
const CHAMPS_UTILES = ["type", "x", "y", "largeur", "hauteur", "rotation", "opacite", "temps", "animations", "cles", "volume", "fonduEntree", "fonduSortie"];
const minimal = (el: ElementPage) => Object.fromEntries(Object.entries(el).filter(([k]) => CHAMPS_UTILES.includes(k)));

function casDuTableau() {
  const cas: Record<string, unknown>[] = [];
  const instants = [1000, 1150, 1300, 1500, 2000, 2600, 3200, 3500, 3800, 3999];
  const genres = ["entree", "sortie"] as const;
  const noms = ["fondu", "glissement-haut", "glissement-bas", "glissement-gauche", "glissement-droite", "zoom", "zoom-arriere", "rebond", "chute", "tourbillon", "volet", "machine-a-ecrire", "lettres", "mots", "lignes"];
  for (const g of genres)
    for (const nom of noms) {
      const el = texte({ animations: { [g]: { nom, duree: 600 } } });
      for (const t of instants) cas.push({ genre: "element", element: minimal(el), contexte: { format: FORMAT }, t, ...etatAnime(el, t, { format: FORMAT }) });
    }
  for (const nom of ["pulsation", "battement", "flottement", "balancement", "tremblement", "clignotement", "rotation", "zoom-lent"]) {
    const el = texte({ animations: { boucle: { nom, duree: nom === "zoom-lent" ? 0 : 1000 } } });
    for (const t of instants) cas.push({ genre: "element", element: minimal(el), contexte: { format: FORMAT }, t, ...etatAnime(el, t, { format: FORMAT }) });
  }
  const clefs = texte({ cles: [{ t: 0, x: 0, y: 0, echelle: 1, rotation: 0, opacite: 1 }, { t: 1500, x: 500, y: 300, echelle: 1.5, rotation: 45, opacite: 0.5, courbe: "lineaire" }, { t: 3000, echelle: 0.8 }] });
  for (const t of instants) cas.push({ genre: "element", element: minimal(clefs), contexte: { format: FORMAT }, t, ...etatAnime(clefs, t, { format: FORMAT }) });
  for (const nom of ["fondu", "glissement", "zoom", "volet"])
    for (const role of ["transitionEntree", "transitionSortie"] as const) {
      const contexte = { format: FORMAT, [role]: { nom, debut: 3000, fin: 4000 } } as ContexteAnimation;
      const el = video("v", { temps: { debut: role === "transitionEntree" ? 3000 : 0, fin: role === "transitionEntree" ? 7000 : 4000 }, volume: 0.8, fonduEntree: 300, fonduSortie: 300 });
      for (const t of [3000, 3250, 3500, 3750, 3999]) cas.push({ genre: "element", element: minimal(el), contexte, t, ...etatAnime(el, t, contexte), gain: gainSon(el, t, contexte) });
    }
  for (const genre of ["machine-a-ecrire", "lettres", "mots", "lignes"] as const)
    for (const sens of ["entree", "sortie"] as const)
      for (const p of [0, 0.2, 0.5, 0.8, 1])
        for (const i of [0, 3, 9]) cas.push({ genre: "unite", unites: { genre, sens, p }, i, n: 10, etat: etatUnite({ genre, sens, p }, i, 10) });
  return arrondi(cas) as Record<string, unknown>[];
}

describe("animation : tableau de valeurs attendues", () => {
  it("les formules donnent les valeurs du tableau commun", () => {
    const calcules = casDuTableau();
    if (process.env.ECRIRE_ATTENDUS === "1" || !existsSync(CHEMIN_ATTENDUS)) {
      // Un cas par ligne : le fichier reste lisible et ses différences aussi.
      const entete = JSON.stringify({ version: 1, description: "Valeurs attendues des animations d'Eliot (modele/animation.ts) : le Rust de l'export (lot 4) doit retrouver les mêmes, à un millionième près." }).slice(0, -1);
      writeFileSync(CHEMIN_ATTENDUS, `${entete},"cas":[\n${calcules.map((c) => JSON.stringify(c)).join(",\n")}\n]}\n`);
    }
    const attendus = JSON.parse(readFileSync(CHEMIN_ATTENDUS, "utf8")) as { cas: Record<string, unknown>[] };
    expect(attendus.cas.length).toBe(calcules.length);
    const ecarts: string[] = [];
    const comparer = (a: unknown, b: unknown, chemin: string) => {
      if (typeof a === "number" && typeof b === "number") {
        if (Math.abs(a - b) > 1e-6) ecarts.push(`${chemin} : ${a} au lieu de ${b}`);
      } else if (a && b && typeof a === "object" && typeof b === "object") {
        const cles = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const k of cles) comparer((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${chemin}.${k}`);
      } else if (a !== b) ecarts.push(`${chemin} : ${String(a)} au lieu de ${String(b)}`);
    };
    calcules.forEach((c, i) => comparer(c, attendus.cas[i], `cas[${i}]`));
    expect(ecarts.slice(0, 10)).toEqual([]);
  });
});
