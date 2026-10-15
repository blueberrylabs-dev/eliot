import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deplacerSon, dupliquerSon, normaliser, placerSon, rognerSon, scinderSons, supprimerSons } from "./frise";
import { ATTAQUE_VOIX, creditsDesSons, gainClipSon, presenceVoix, RELACHE_VOIX, SOUS_LA_VOIX, tempsMediaSon } from "./son";
import type { ClipAudio, ElementVideo, PageEliot } from "./types";

const base = { x: 0, y: 0, largeur: 100, hauteur: 100, rotation: 0, opacite: 1, visible: true, verrouille: false };
const video = (id: string, extra: Partial<ElementVideo> = {}): ElementVideo => ({ ...base, id, type: "video", ressource: "v10s", retourneH: false, retourneV: false, piste: 0, ...extra });
const son = (id: string, extra: Partial<ClipAudio> = {}): ClipAudio => ({ id, ressource: "s4s", temps: { debut: 0, fin: 4000 }, piste: 0, role: "bruitage", ...extra });
const durees = (r: string) => ({ v10s: 10_000, s4s: 4000, s60s: 60_000 })[r as "v10s"];
const page = (audio: ClipAudio[], elements = [video("v", { temps: { debut: 0, fin: 10_000 } })], duree = 10_000): PageEliot => ({ id: "p", fond: "#000000", elements, duree, audio });
let n = 0;
const nouvelId = () => `n${++n}`;

describe("son : instant du fichier", () => {
  it("un son joue sa coupe, de son début à sa fin", () => {
    const c = son("a", { coupe: { debut: 1000, fin: 3000 }, temps: { debut: 2000, fin: 4000 } });
    expect(tempsMediaSon(c, 2000, 4000)).toBe(1000);
    expect(tempsMediaSon(c, 3500, 4000)).toBe(2500);
    expect(tempsMediaSon(c, 9000, 4000)).toBe(3000);
  });

  it("un son qui boucle repart du début de sa coupe, phase comprise", () => {
    const c = son("a", { coupe: { debut: 500 }, temps: { debut: 1000, fin: 20_000 }, jusquALaFin: true });
    // Partie jouée de 3 500 ms : à 1 000 + 3 500, on revient au début.
    expect(tempsMediaSon(c, 1000, 4000)).toBe(500);
    expect(tempsMediaSon(c, 4500, 4000)).toBe(500);
    expect(tempsMediaSon(c, 5000, 4000)).toBe(1000);
    expect(tempsMediaSon({ ...c, phase: 1000 }, 1000, 4000)).toBe(1500);
  });
});

describe("son : la musique baisse sous la voix", () => {
  const voix = son("voix", { role: "voix", temps: { debut: 3000, fin: 5000 } });
  const musique = son("m", { role: "musique", temps: { debut: 0, fin: 10_000 }, jusquALaFin: true });

  it("la présence d'une voix monte avant elle et redescend après", () => {
    expect(presenceVoix([voix], 3000 - ATTAQUE_VOIX - 1)).toBe(0);
    expect(presenceVoix([voix], 3000 - ATTAQUE_VOIX / 2)).toBeCloseTo(0.5);
    expect(presenceVoix([voix], 4000)).toBe(1);
    expect(presenceVoix([voix], 5000 + RELACHE_VOIX / 2)).toBeCloseTo(0.5);
    expect(presenceVoix([voix], 5000 + RELACHE_VOIX)).toBe(0);
    // Une voix muette ne fait rien baisser.
    expect(presenceVoix([{ ...voix, volume: 0 }], 4000)).toBe(0);
  });

  it("la musique garde 30 % sous la voix, ou ce qu'on lui règle", () => {
    expect(gainClipSon(musique, 1000, [musique, voix])).toBe(1);
    expect(gainClipSon(musique, 4000, [musique, voix])).toBeCloseTo(SOUS_LA_VOIX);
    expect(gainClipSon({ ...musique, sousLaVoix: 0.5, volume: 0.8 }, 4000, [musique, voix])).toBeCloseTo(0.4);
    // Un bruitage ne baisse pas.
    expect(gainClipSon(son("b", { temps: { debut: 3000, fin: 7000 } }), 4000, [voix])).toBe(1);
  });

  it("les fondus d'entrée et de sortie", () => {
    const c = son("a", { temps: { debut: 1000, fin: 5000 }, fonduEntree: 1000, fonduSortie: 2000 });
    expect(gainClipSon(c, 1500, [c])).toBeCloseTo(0.5);
    expect(gainClipSon(c, 2500, [c])).toBe(1);
    expect(gainClipSon(c, 4000, [c])).toBeCloseTo(0.5);
  });
});

describe("son : la frise", () => {
  it("un son a la longueur de sa coupe ; une musique « jusqu'à la fin » va au bout de la page", () => {
    const p = normaliser(page([son("a", { temps: { debut: 1000, fin: 1200 } }), son("m", { ressource: "s4s", role: "musique", jusquALaFin: true, temps: { debut: 0, fin: 100 }, piste: 1 })]), durees);
    expect(p.audio!.find((c) => c.id === "a")!.temps).toEqual({ debut: 1000, fin: 5000 });
    expect(p.audio!.find((c) => c.id === "m")!.temps).toEqual({ debut: 0, fin: 10_000 });
    expect(p.duree).toBe(10_000);
  });

  it("un son plus long que les clips allonge la page, pas une musique jusqu'à la fin", () => {
    const p = normaliser(page([son("a", { ressource: "s60s", temps: { debut: 0, fin: 1 } })]), durees);
    expect(p.duree).toBe(60_000);
    const q = normaliser(page([son("m", { ressource: "s60s", role: "musique", jusquALaFin: true })]), durees);
    expect(q.duree).toBe(10_000);
  });

  it("une page sans clip garde sa durée : un son plus court ne la raccourcit pas", () => {
    const vide = { id: "p", fond: "#ffffff", elements: [], duree: 5000 } as PageEliot;
    const p = normaliser({ ...vide, audio: [son("m", { ressource: "s60s", role: "musique", jusquALaFin: true }), son("a", { temps: { debut: 1000, fin: 1200 }, piste: 1 })] }, durees);
    expect(p.duree).toBe(5000);
    expect(p.audio!.find((c) => c.id === "m")!.temps).toEqual({ debut: 0, fin: 5000 });
    const q = normaliser({ ...vide, audio: [son("a", { ressource: "s60s", temps: { debut: 0, fin: 1 } })] }, durees);
    expect(q.duree).toBe(60_000);
  });

  it("deux sons d'une même piste ne se chevauchent pas, pistes sans trou", () => {
    const p = normaliser(page([son("a", { piste: 3 }), son("b", { piste: 3, temps: { debut: 2000, fin: 6000 } })]), durees);
    expect(p.audio!.map((c) => [c.id, c.piste])).toEqual([["a", 0], ["b", 1]]);
  });

  it("poser un son : à la tête, sur une piste libre, de préférence celle de son rôle", () => {
    let p = page([son("m", { role: "musique", jusquALaFin: true }), son("b", { piste: 1 })]);
    p = normaliser(p, durees);
    p = placerSon(p, { id: "b2", ressource: "s4s", role: "bruitage" }, 6000, durees);
    expect(p.audio!.find((c) => c.id === "b2")).toMatchObject({ piste: 1, temps: { debut: 6000, fin: 10_000 } });
    p = placerSon(p, { id: "m2", ressource: "s60s", role: "musique", jusquALaFin: true }, 2000, durees);
    // La piste 0 est prise par la première musique : une piste neuve.
    expect(p.audio!.find((c) => c.id === "m2")).toMatchObject({ piste: 2, temps: { debut: 2000, fin: 10_000 } });
  });

  it("déplacer, rogner, couper, dupliquer, supprimer", () => {
    let p = normaliser(page([son("a", { temps: { debut: 1000, fin: 5000 } })]), durees);
    p = deplacerSon(p, "a", 2000, 0, durees);
    expect(p.audio![0].temps).toEqual({ debut: 2000, fin: 6000 });
    p = rognerSon(p, "a", "debut", 3000, durees);
    expect(p.audio![0]).toMatchObject({ coupe: { debut: 1000 }, temps: { debut: 3000, fin: 6000 } });
    p = rognerSon(p, "a", "fin", 5000, durees);
    expect(p.audio![0]).toMatchObject({ coupe: { debut: 1000, fin: 3000 }, temps: { debut: 3000, fin: 5000 } });
    const coupe = scinderSons(p, ["a"], 4000, durees, nouvelId);
    expect(coupe.page.audio!.map((c) => [c.temps.debut, c.temps.fin, c.coupe?.debut, c.coupe?.fin])).toEqual([[3000, 4000, 1000, 2000], [4000, 5000, 2000, 3000]]);
    const double = dupliquerSon(p, "a", "copie", durees);
    expect(double.audio!.find((c) => c.id === "copie")!.temps).toEqual({ debut: 5000, fin: 7000 });
    expect(supprimerSons(double, ["a", "copie"], durees).audio).toEqual([]);
  });

  it("une musique qui boucle, coupée en deux, continue sans sauter", () => {
    const p = normaliser(page([son("m", { role: "musique", jusquALaFin: true, coupe: { debut: 1000 } })]), durees);
    const { page: q, nouveaux } = scinderSons(p, ["m"], 4500, durees, nouvelId);
    const [a, b] = q.audio!;
    expect(a.jusquALaFin).toBeUndefined();
    expect(b.jusquALaFin).toBe(true);
    expect(b.id).toBe(nouveaux[0]);
    for (const t of [4500, 6000, 9000]) expect(tempsMediaSon(b, t, 4000)).toBe(tempsMediaSon(p.audio![0], t, 4000));
    expect(tempsMediaSon(a, 4000, 4000)).toBe(tempsMediaSon(p.audio![0], 4000, 4000));
    // Tirer la fin d'une musique jusqu'à la fin l'arrête là, sans cesser de boucler.
    const r = rognerSon(p, "m", "fin", 7000, durees).audio![0];
    expect(r).toMatchObject({ boucle: true, temps: { debut: 0, fin: 7000 } });
    expect(r.jusquALaFin).toBeUndefined();
  });

  it("les crédits des sons, une fois chacun", () => {
    const p = page([son("a"), son("b"), son("c", { ressource: "perso" })]);
    const lignes = creditsDesSons(p, { s4s: { nom: "pluie.ogg", credit: { source: "Freesound", auteur: "Anna", lien: "https://freesound.org/s/1/", licence: "CC BY 4.0", titre: "Pluie douce" } }, perso: { nom: "voix.wav" } });
    expect(lignes).toEqual(["« Pluie douce » par Anna (https://freesound.org/s/1/), licence CC BY 4.0, via Freesound"]);
  });

  it("une voix de synthèse a une ligne, quel que soit le nombre de ses phrases", () => {
    const voix = (titre: string) => ({ nom: titre, credit: { source: "Piper", auteur: "siwis", lien: "https://datashare.is.ed.ac.uk/handle/10283/2353", licence: "CC BY 4.0", titre } });
    const p = page([son("a", { ressource: "v1" }), son("b", { ressource: "v2" })]);
    expect(creditsDesSons(p, { v1: voix("Bonjour"), v2: voix("Au revoir") })).toEqual(["Voix de synthèse « siwis » (Piper), données https://datashare.is.ed.ac.uk/handle/10283/2353, licence CC BY 4.0"]);
  });
});

// ---- Le tableau commun avec le Rust ----
// `ECRIRE_ATTENDUS=1 npx vitest run src/modele/son.test.ts` le réécrit ; sinon, il est relu.

const CHEMIN_ATTENDUS = new URL("./son.attendus.json", import.meta.url);
const arrondi = (v: number) => Math.round(v * 1e6) / 1e6 + 0;

function casDuTableau() {
  const cas: Record<string, unknown>[] = [];
  const voix = [son("v1", { role: "voix", temps: { debut: 3000, fin: 5000 } }), son("v2", { role: "voix", temps: { debut: 5300, fin: 6000 }, volume: 0.7 })];
  const clips: ClipAudio[] = [
    son("simple", { coupe: { debut: 500, fin: 3500 }, temps: { debut: 1000, fin: 4000 }, volume: 0.8, fonduEntree: 400, fonduSortie: 900 }),
    son("musique", { role: "musique", jusquALaFin: true, coupe: { debut: 250 }, temps: { debut: 0, fin: 9000 }, fonduSortie: 2000 }),
    son("douce", { role: "musique", boucle: true, phase: 700, sousLaVoix: 0.15, volume: 0.6, temps: { debut: 2000, fin: 8000 } }),
  ];
  const instants = [0, 999, 1000, 1200, 2799, 2800, 2900, 3000, 4000, 4999, 5000, 5150, 5300, 5800, 6000, 6200, 6400, 7000, 8500, 8999];
  for (const c of clips)
    for (const t of instants) {
      const sons = [c, ...voix];
      cas.push({ son: c, voix, t, dureeFichier: 4000, media: arrondi(tempsMediaSon(c, t, 4000)), presence: arrondi(presenceVoix(sons, t, c.id)), gain: arrondi(gainClipSon(c, t, sons)) });
    }
  return cas;
}

describe("son : tableau de valeurs attendues", () => {
  it("les formules donnent les valeurs du tableau commun", () => {
    const calcules = casDuTableau();
    if (process.env.ECRIRE_ATTENDUS === "1" || !existsSync(CHEMIN_ATTENDUS)) {
      const entete = JSON.stringify({ version: 1, description: "Valeurs attendues des sons d'Eliot (modele/son.ts) : le Rust de l'export (noyau/src/son.rs) doit retrouver les mêmes, à un millionième près." }).slice(0, -1);
      writeFileSync(CHEMIN_ATTENDUS, `${entete},"cas":[\n${calcules.map((c) => JSON.stringify(c)).join(",\n")}\n]}\n`);
    }
    const attendus = JSON.parse(readFileSync(CHEMIN_ATTENDUS, "utf8")) as { cas: { media: number; presence: number; gain: number }[] };
    expect(attendus.cas.length).toBe(calcules.length);
    calcules.forEach((c, i) => {
      for (const k of ["media", "presence", "gain"] as const) expect(Math.abs((c[k] as number) - attendus.cas[i][k])).toBeLessThan(1e-6);
    });
  });
});
