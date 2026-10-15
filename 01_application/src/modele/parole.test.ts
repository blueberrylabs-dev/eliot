import { describe, expect, it } from "vitest";
import { clipsACouper, couperEnMorceaux, estHesitation, FONDU_COUPE, OPTIONS_BLANCS, partiesAGarder, reunir, soustraire, tempsRetire, type AnalyseParole } from "./parole";
import type { ClipAudio, ElementPage, ElementVideo, PageEliot } from "./types";

const base = { x: 0, y: 0, largeur: 100, hauteur: 100, rotation: 0, opacite: 1, visible: true, verrouille: false };
const video = (id: string, extra: Partial<ElementVideo> = {}): ElementVideo => ({ ...base, id, type: "video", ressource: "v10s", retourneH: false, retourneV: false, piste: 0, ...extra });
const son = (id: string, extra: Partial<ClipAudio> = {}): ClipAudio => ({ id, ressource: "s4s", temps: { debut: 0, fin: 4000 }, piste: 0, role: "voix", ...extra });
const durees = (r: string) => ({ v10s: 10_000, v4s: 4000, s4s: 4000 })[r as "v10s"];
const page = (elements: ElementPage[], audio?: ClipAudio[], duree = 10_000): PageEliot => ({ id: "p", fond: "#000000", elements, duree, ...(audio ? { audio } : {}) });
const resume = (p: PageEliot) => p.elements.map((e) => `${e.id}:${e.piste}:${e.temps?.debut}-${e.temps?.fin}`);
let n = 0;
const nouvelId = (prefixe = "e") => `${prefixe}${++n}`;

/** La phrase d'essai du noyau (voix Piper, silences posés à la main), telle que l'analyse et
 *  Whisper l'ont rendue dans le conteneur. */
const PHRASE: AnalyseParole = {
  version: 1,
  duree: 11_454,
  parole: [
    [360, 1520],
    [2730, 3080],
    [3660, 4260],
    [4490, 6590],
    [7060, 7500],
    [9190, 9830],
    [9980, 10_850],
  ],
  transcription: {
    modele: "faster-whisper-small",
    langue: "fr",
    mots: [
      { texte: "Bonjour", debut: 360, fin: 800, proba: 0.88 },
      { texte: "à", debut: 800, fin: 1020, proba: 0.99 },
      { texte: "tous.", debut: 1020, fin: 1520, proba: 0.98 },
      { texte: "Euh,", debut: 2730, fin: 3080, proba: 0.05 },
      { texte: "aujourd'hui,", debut: 3660, fin: 4260, proba: 0.98 },
      { texte: "je", debut: 4490, fin: 4640, proba: 1 },
      { texte: "vais", debut: 4640, fin: 4760, proba: 1 },
      { texte: "café.", debut: 6120, fin: 6590, proba: 0.99 },
      { texte: "Homme.", debut: 7060, fin: 7500, proba: 0.73 },
      { texte: "D'abord,", debut: 9190, fin: 9830, proba: 0.96 },
      { texte: "l'eau.", debut: 10_600, fin: 10_850, proba: 0.98 },
    ],
  },
};

describe("parole : hésitations", () => {
  it("les « euh » et les « hum » se reconnaissent, pas les vrais mots", () => {
    for (const m of ["euh", "Euh,", "Euuuh...", "heu", "HUM", "Hmm.", "mmh", "mm", "um", "uh", "erm"]) expect(estHesitation(m), m).toBe(true);
    for (const m of ["eu", "e", "m", "un", "hume", "bah", "ben", "Homme.", "heureux", "mais"]) expect(estHesitation(m), m).toBe(false);
  });
});

describe("parole : intervalles", () => {
  it("soustraire et réunir", () => {
    expect(soustraire([{ debut: 0, fin: 10 }], [{ debut: 2, fin: 4 }, { debut: 8, fin: 12 }])).toEqual([{ debut: 0, fin: 2 }, { debut: 4, fin: 8 }]);
    expect(reunir([{ debut: 5, fin: 8 }, { debut: 0, fin: 2 }, { debut: 2, fin: 3 }, { debut: 7, fin: 9 }])).toEqual([{ debut: 0, fin: 3 }, { debut: 5, fin: 9 }]);
  });
});

describe("parole : ce qu'on garde", () => {
  const tout = { debut: 0, fin: 11_454 };

  it("les longs blancs raccourcis, l'hésitation et ses blancs retirés", () => {
    const g = partiesAGarder(tout, PHRASE, OPTIONS_BLANCS);
    expect(g).toEqual([
      { debut: 0, fin: 1640 },
      { debut: 3540, fin: 7620 },
      { debut: 9070, fin: 10_970 },
    ]);
    expect(tempsRetire(tout, g)).toBe(3834);
  });

  it("sans les hésitations, le « euh » reste avec un blanc court devant lui", () => {
    expect(partiesAGarder(tout, PHRASE, { ...OPTIONS_BLANCS, hesitations: false })).toEqual([
      { debut: 0, fin: 1640 },
      { debut: 2610, fin: 7620 },
      { debut: 9070, fin: 10_970 },
    ]);
  });

  it("les hésitations seules : rien d'autre ne bouge", () => {
    expect(partiesAGarder(tout, PHRASE, { ...OPTIONS_BLANCS, silenceMin: Number.POSITIVE_INFINITY })).toEqual([
      { debut: 0, fin: 2730 },
      { debut: 3080, fin: 11_454 },
    ]);
  });

  it("une hésitation au milieu de la parole part, les blancs courts restent", () => {
    const a: AnalyseParole = { version: 1, duree: 5000, parole: [[0, 5000]], transcription: { modele: "m", langue: "fr", mots: [{ texte: "euh", debut: 2000, fin: 2300, proba: 0.2 }] } };
    expect(partiesAGarder({ debut: 0, fin: 5000 }, a, OPTIONS_BLANCS)).toEqual([
      { debut: 0, fin: 2000 },
      { debut: 2300, fin: 5000 },
    ]);
  });

  it("la fenêtre d'un clip coupé, un fichier muet, une musique continue", () => {
    // Le clip ne joue que de 3 000 à 9 000 : le bout du « euh » et le blanc du début partent,
    // le blanc de la fin aussi (il touche le bord : rien n'en reste).
    expect(partiesAGarder({ debut: 3000, fin: 9000 }, PHRASE, OPTIONS_BLANCS)).toEqual([{ debut: 3540, fin: 7620 }]);
    // De 3 000 à 8 000, le blanc de la fin ne dure que 500 ms : il reste.
    expect(partiesAGarder({ debut: 3000, fin: 8000 }, PHRASE, OPTIONS_BLANCS)).toEqual([{ debut: 3540, fin: 8000 }]);
    expect(partiesAGarder({ debut: 0, fin: 4000 }, { version: 1, duree: 4000, parole: [] }, OPTIONS_BLANCS)).toEqual([]);
    expect(partiesAGarder({ debut: 0, fin: 4000 }, { version: 1, duree: 4000, parole: [[0, 4000]] }, OPTIONS_BLANCS)).toEqual([{ debut: 0, fin: 4000 }]);
  });
});

describe("parole : couper en morceaux", () => {
  it("une vidéo de la piste principale : morceaux bout à bout, la suite se resserre", () => {
    const v = video("v", {
      temps: { debut: 0, fin: 10_000 },
      animations: { entree: { nom: "fondu", duree: 300 }, sortie: { nom: "zoom", duree: 400 }, boucle: { nom: "pulsation", duree: 1000 } },
      fonduEntree: 200,
      fonduSortie: 500,
    });
    const w = video("w", { ressource: "v4s", temps: { debut: 10_000, fin: 14_000 }, transition: { nom: "fondu-enchaine", duree: 400 } });
    const r = couperEnMorceaux(page([v, w], undefined, 14_000), "v", [{ debut: 0, fin: 2000 }, { debut: 3000, fin: 6000 }, { debut: 8000, fin: 10_000 }], durees, nouvelId);
    expect(r.morceaux[0]).toBe("v");
    expect(r.morceaux).toHaveLength(3);
    const [a, b, c] = r.morceaux.map((id) => r.page.elements.find((e) => e.id === id) as ElementVideo);
    expect(resume(r.page)).toEqual([`v:0:0-2000`, `${b.id}:0:2000-5000`, `${c.id}:0:5000-7000`, "w:0:6600-10600"]);
    expect([a.coupe, b.coupe, c.coupe]).toEqual([{ debut: 0, fin: 2000 }, { debut: 3000, fin: 6000 }, { debut: 8000 }]);
    expect([a.animations, b.animations, c.animations]).toEqual([
      { entree: { nom: "fondu", duree: 300 }, boucle: { nom: "pulsation", duree: 1000 } },
      { boucle: { nom: "pulsation", duree: 1000 } },
      { sortie: { nom: "zoom", duree: 400 }, boucle: { nom: "pulsation", duree: 1000 } },
    ]);
    expect([a.fonduEntree, a.fonduSortie, b.fonduEntree, b.fonduSortie, c.fonduEntree, c.fonduSortie]).toEqual([200, FONDU_COUPE, FONDU_COUPE, FONDU_COUPE, FONDU_COUPE, 500]);
    expect(r.page.duree).toBe(10_600);
  });

  it("une vidéo en superposition : les morceaux se suivent depuis son début, les clés suivent", () => {
    const v = video("v", { piste: 1, coupe: { debut: 1000, fin: 7000 }, temps: { debut: 1000, fin: 7000 }, cles: [{ t: 0, x: 0, y: 0, courbe: "lineaire" }, { t: 6000, x: 600, y: 0 }] });
    const fond = video("f", { temps: { debut: 0, fin: 10_000 } });
    const r = couperEnMorceaux(page([fond, v]), "v", [{ debut: 1000, fin: 2000 }, { debut: 5000, fin: 7000 }], durees, nouvelId);
    const [a, b] = r.morceaux.map((id) => r.page.elements.find((e) => e.id === id) as ElementVideo);
    expect([a.piste, a.temps, b.piste, b.temps]).toEqual([1, { debut: 1000, fin: 2000 }, 1, { debut: 2000, fin: 4000 }]);
    // Le second morceau reprend le mouvement là où était le contenu : x passe de 400 à 600.
    const l = "lineaire" as const;
    expect(a.cles).toEqual([{ t: 0, x: 0, y: 0, courbe: l }, { t: 1000, x: 100, y: 0, courbe: l }]);
    expect(b.cles).toEqual([{ t: 0, x: 400, y: 0, courbe: l }, { t: 2000, x: 600, y: 0 }]);
  });

  it("un son détaché se coupe avec sa vidéo, et inversement", () => {
    const v = video("v", { temps: { debut: 0, fin: 10_000 }, volume: 0 });
    const s = son("s", { ressource: "v10s", temps: { debut: 0, fin: 10_000 }, piste: 0 });
    const p = page([v], [s]);
    expect(clipsACouper(p, "s")?.video?.id).toBe("v");
    const r = couperEnMorceaux(p, "s", [{ debut: 0, fin: 3000 }, { debut: 6000, fin: 10_000 }], durees, nouvelId);
    expect(resume(r.page)).toEqual(["v:0:0-3000", `${r.morceaux[1]}:0:3000-7000`]);
    const sons = r.page.audio!;
    expect(sons.map((c) => [c.temps, c.coupe])).toEqual([
      [{ debut: 0, fin: 3000 }, { debut: 0, fin: 3000 }],
      [{ debut: 3000, fin: 7000 }, { debut: 6000, fin: 10_000 }],
    ]);
    expect(sons[0].id).toBe("s");
  });

  it("un son seul : morceaux à la suite depuis son début", () => {
    const s = son("s", { temps: { debut: 500, fin: 4500 }, fonduEntree: 100 });
    const r = couperEnMorceaux(page([], [s]), "s", [{ debut: 0, fin: 1000 }, { debut: 2000, fin: 4000 }], durees, nouvelId);
    expect(r.page.audio!.map((c) => [c.id === "s", c.temps, c.coupe, c.fonduEntree, c.fonduSortie])).toEqual([
      [true, { debut: 500, fin: 1500 }, { debut: 0, fin: 1000 }, 100, FONDU_COUPE],
      [false, { debut: 1500, fin: 3500 }, { debut: 2000, fin: 4000 }, FONDU_COUPE, undefined],
    ]);
    // Une musique qui boucle, une forme : rien à couper.
    expect(clipsACouper(page([], [son("m", { role: "musique", jusquALaFin: true })]), "m")).toBeNull();
    expect(couperEnMorceaux(page([], [s]), "s", [], durees, nouvelId).morceaux).toEqual([]);
  });
});
