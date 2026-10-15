import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AnalyseParole } from "./parole";
import {
  ajusterSousTitres,
  centreParDefaut,
  creerSousTitres,
  estSousTitre,
  grouperMots,
  modeleDuSousTitre,
  motActif,
  motsDeLaPage,
  nettoyerMot,
  nombreDeMots,
  poserSousTitres,
  retirerSousTitres,
  sourcesDeParole,
  tempsDesGroupes,
  tempsDesMots,
  type MotPlace,
} from "./sousTitres";
import type { ClipAudio, ElementPage, ElementTexte, ElementVideo, PageEliot, Ressource } from "./types";

const base = { x: 0, y: 0, largeur: 100, hauteur: 100, rotation: 0, opacite: 1, visible: true, verrouille: false };
const video = (id: string, extra: Partial<ElementVideo> = {}): ElementVideo => ({ ...base, id, type: "video", ressource: "v10s", retourneH: false, retourneV: false, piste: 0, ...extra });
const son = (id: string, extra: Partial<ClipAudio> = {}): ClipAudio => ({ id, ressource: "s4s", temps: { debut: 0, fin: 4000 }, piste: 0, role: "voix", ...extra });
const texte = (id: string, extra: Partial<ElementTexte> = {}): ElementTexte => ({
  ...base, id, type: "texte", texte: id, police: "Inter", taillePolice: 40, gras: false, italique: false, souligne: false, alignement: "center", couleur: "#ffffff", interligne: 1.2, espacement: 0, ...extra,
});
const durees = (r: string) => ({ v10s: 10_000, s4s: 4000 })[r as "v10s"];
const page = (elements: ElementPage[], audio?: ClipAudio[], duree = 10_000): PageEliot => ({ id: "p", fond: "#000000", elements, duree, ...(audio ? { audio } : {}) });
const ressources: Record<string, Ressource> = {
  v10s: { id: "v10s", nom: "v", largeur: 1080, hauteur: 1920, transparence: false, video: { duree: 10_000, imagesParSeconde: 30, son: true, copie: "webm", vignettes: { nombre: 1, intervalle: 1000, largeur: 10, hauteur: 10 } } },
  muette: { id: "muette", nom: "m", largeur: 1080, hauteur: 1920, transparence: false, video: { duree: 10_000, imagesParSeconde: 30, son: false, copie: "webm", vignettes: { nombre: 1, intervalle: 1000, largeur: 10, hauteur: 10 } } },
  s4s: { id: "s4s", nom: "s", largeur: 0, hauteur: 0, transparence: false, son: { duree: 4000, copie: "webm" } },
};
const mot = (texte: string, debut: number, fin: number, source = "v10s"): MotPlace => ({ texte, debut, fin, source });
let n = 0;
const nouvelId = () => `st${++n}`;

describe("sous-titres : le mot prononcé", () => {
  const mots = [
    { debut: 0, fin: 300 },
    { debut: 300, fin: 500 },
    { debut: 900, fin: 1400 },
  ];

  it("le dernier mot commencé, jusqu'au suivant", () => {
    expect([-1, 0, 299, 300, 600, 899, 900, 5000].map((t) => motActif(mots, 3, t))).toEqual([-1, 0, 0, 1, 1, 1, 2, 2]);
    expect(motActif([], 3, 100)).toBe(-1);
    expect(motActif(mots, 0, 100)).toBe(-1);
  });

  it("un texte retouché partage la durée des mots également", () => {
    expect(tempsDesMots(mots, 2)).toEqual([
      { debut: 0, fin: 700 },
      { debut: 700, fin: 1400 },
    ]);
    expect(motActif(mots, 4, 349)).toBe(0);
    expect(motActif(mots, 4, 350)).toBe(1);
    expect(nombreDeMots("  D'abord,  on fait\nchauffer ")).toBe(4);
  });
});

// ---- Le tableau commun avec le Rust ----
// `ECRIRE_ATTENDUS=1 npx vitest run src/modele/sousTitres.test.ts` le réécrit ; sinon, il est relu.

const CHEMIN_ATTENDUS = new URL("./sousTitres.attendus.json", import.meta.url);
const arrondi = (v: number) => Math.round(v * 1e6) / 1e6 + 0;

function casDuTableau() {
  const series = [
    [],
    [{ debut: 0, fin: 250 }],
    [
      { debut: 0, fin: 300 },
      { debut: 300, fin: 500 },
      { debut: 900, fin: 1400 },
    ],
    [
      { debut: 120, fin: 380 },
      { debut: 380, fin: 380 },
      { debut: 700, fin: 1650 },
      { debut: 1700, fin: 2100 },
    ],
  ];
  const cas: Record<string, unknown>[] = [];
  for (const mots of series)
    for (const nombre of [0, 1, 2, 3, 4, 7])
      for (const tr of [-100, 0, 100, 299, 300, 450, 700, 1000, 1699, 1700, 3000]) {
        cas.push({ mots, n: nombre, tr, temps: tempsDesMots(mots, nombre).map((t) => [arrondi(t.debut), arrondi(t.fin)]), actif: motActif(mots, nombre, tr) });
      }
  return cas;
}

describe("sous-titres : tableau de valeurs attendues", () => {
  it("les formules donnent les valeurs du tableau commun", () => {
    const calcules = casDuTableau();
    if (process.env.ECRIRE_ATTENDUS === "1" || !existsSync(CHEMIN_ATTENDUS)) {
      const entete = JSON.stringify({ version: 1, description: "Valeurs attendues du mot prononcé des sous-titres d'Eliot (modele/sousTitres.ts) : le Rust de l'export (noyau/src/sous_titres.rs) doit retrouver les mêmes." }).slice(0, -1);
      writeFileSync(CHEMIN_ATTENDUS, `${entete},"cas":[\n${calcules.map((c) => JSON.stringify(c)).join(",\n")}\n]}\n`);
    }
    const attendus = JSON.parse(readFileSync(CHEMIN_ATTENDUS, "utf8")) as { cas: { temps: number[][]; actif: number }[] };
    expect(attendus.cas.length).toBe(calcules.length);
    calcules.forEach((c, i) => {
      expect(c.actif).toBe(attendus.cas[i].actif);
      expect(c.temps).toEqual(attendus.cas[i].temps);
    });
  });
});

describe("sous-titres : les mots de la page", () => {
  const analyses: Record<string, AnalyseParole> = {
    v10s: {
      version: 1,
      duree: 10_000,
      parole: [],
      transcription: {
        modele: "m",
        langue: "fr",
        mots: [
          { texte: "Bonjour", debut: 500, fin: 900, proba: 0.9 },
          { texte: "euh,", debut: 1200, fin: 1500, proba: 0.2 },
          { texte: "voici", debut: 3100, fin: 3500, proba: 0.9 },
          { texte: "la", debut: 5900, fin: 6050, proba: 0.9 },
          { texte: "suite.", debut: 6100, fin: 6600, proba: 0.9 },
        ],
      },
    },
    s4s: { version: 1, duree: 4000, parole: [], transcription: { modele: "m", langue: "fr", mots: [{ texte: "Coucou", debut: 100, fin: 600, proba: 0.9 }] } },
  };

  it("les sources : vidéos qu'on entend, sons au rôle voix", () => {
    const p = page([video("a", { temps: { debut: 0, fin: 3000 }, coupe: { debut: 0, fin: 3000 } }), video("b", { ressource: "muette", temps: { debut: 3000, fin: 13_000 } }), video("c", { piste: 1, volume: 0, temps: { debut: 0, fin: 10_000 } })], [son("v", { temps: { debut: 2000, fin: 6000 } }), son("m", { role: "musique", temps: { debut: 0, fin: 4000 } })]);
    expect(sourcesDeParole(p, ressources).map((s) => `${s.id}:${s.fenetre.debut}-${s.fenetre.fin}`)).toEqual(["a:0-3000", "v:0-4000"]);
  });

  it("deux morceaux d'une vidéo coupée, au temps de la page, sans l'hésitation", () => {
    // Morceaux gardés : 0-1000 puis 3000-7000 du fichier, bout à bout ; une voix à 2 000 ms.
    const p = page([video("a", { coupe: { debut: 0, fin: 1000 }, temps: { debut: 0, fin: 1000 } }), video("b", { coupe: { debut: 3000, fin: 7000 }, temps: { debut: 1000, fin: 5000 } })], [son("v", { temps: { debut: 6000, fin: 10_000 } })]);
    const mots = motsDeLaPage(sourcesDeParole(p, ressources), analyses);
    expect(mots.map((m) => `${m.texte}:${m.debut}-${m.fin}`)).toEqual(["Bonjour:500-900", "voici:1100-1500", "la:3900-4050", "suite.:4100-4600", "Coucou:6100-6600"]);
    expect(motsDeLaPage(sourcesDeParole(p, ressources), analyses, { hesitations: true })).toHaveLength(5);
    // Un mot à cheval sur une coupe reste s'il est surtout dedans, ramené à son bord.
    const q = page([video("a", { coupe: { debut: 0, fin: 800 }, temps: { debut: 0, fin: 800 } })]);
    expect(motsDeLaPage(sourcesDeParole(q, ressources), analyses).map((m) => `${m.texte}:${m.debut}-${m.fin}`)).toEqual(["Bonjour:500-800"]);
  });

  it("l'écrit d'un mot", () => {
    expect(["tous.", "aujourd'hui,", "vrai ?", "Quoi?!", "…", "50%", "-"].map((m) => nettoyerMot(m, true))).toEqual(["tous", "aujourd'hui", "vrai ?", "Quoi?!", "", "50%", ""]);
    expect(nettoyerMot("tous.", false)).toBe("tous.");
  });
});

describe("sous-titres : les groupes", () => {
  const phrase = [mot("Aujourd'hui", 0, 400), mot("je", 400, 500), mot("vais", 500, 650), mot("vous", 650, 800), mot("montrer", 800, 1100), mot("comment.", 1100, 1500), mot("D'abord,", 2500, 3000), mot("on", 3100, 3200), mot("fait", 3200, 3400), mot("chauffer", 3400, 3800), mot("l'eau", 3800, 4200)];
  const textes = (g: MotPlace[][]) => g.map((x) => x.map((m) => m.texte).join(" "));

  it("des groupes de tailles voisines, coupés aux phrases et aux virgules", () => {
    // Six mots par quatre : 3 et 3 ; une virgule après un seul mot ne coupe pas.
    expect(textes(grouperMots(phrase, { maxMots: 4, maxLettres: 40 }))).toEqual(["Aujourd'hui je vais", "vous montrer comment.", "D'abord, on fait", "chauffer l'eau"]);
    expect(textes(grouperMots(phrase, { maxMots: 3, maxLettres: 20 }))).toEqual(["Aujourd'hui je", "vais vous", "montrer comment.", "D'abord, on fait", "chauffer l'eau"]);
    expect(textes(grouperMots([mot("Bon", 0, 200), mot("alors,", 200, 500), mot("on", 500, 600), mot("y", 600, 700), mot("va", 700, 900)], { maxMots: 9, maxLettres: 42 }))).toEqual(["Bon alors,", "on y va"]);
    expect(grouperMots(phrase, { maxMots: 1, maxLettres: 20 })).toHaveLength(11);
    // Une longue pause, une autre voix : nouveau groupe.
    expect(textes(grouperMots([mot("un", 0, 200), mot("deux", 1000, 1200), mot("trois", 1250, 1400, "autre")], { maxMots: 5, maxLettres: 40 }))).toEqual(["un", "deux", "trois"]);
  });

  it("chaque groupe reste jusqu'au suivant s'il est proche, 0,3 s sinon", () => {
    const g = grouperMots(phrase, { maxMots: 4, maxLettres: 40 });
    expect(tempsDesGroupes(g)).toEqual([
      { debut: 0, fin: 650 },
      { debut: 650, fin: 1800 },
      { debut: 2500, fin: 3400 },
      { debut: 3400, fin: 4500 },
    ]);
    expect(tempsDesGroupes(g, 4300).at(-1)).toEqual({ debut: 3400, fin: 4300 });
  });
});

describe("sous-titres : les textes de la frise", () => {
  const modele = {
    texte: texte("modele", { x: 86, y: 1220, largeur: 908, hauteur: 80, sousTitre: { mots: [], style: "surligne", actif: { couleur: "#ffd60a", echelle: 1.12 } } }),
    maxMots: 3,
    maxLettres: 22,
    sansPoints: true,
  };
  const mots = [mot("Bonjour", 500, 900), mot("à", 900, 1000), mot("tous.", 1000, 1400), mot("Voici", 3000, 3300), mot("la", 3300, 3400), mot("suite.", 3400, 3900)];
  // Une ligne : 80 px ; au-delà de 16 lettres, deux lignes.
  const mesurer = (el: ElementTexte) => (el.texte.length > 16 ? 160 : 80);

  it("un texte par groupe, au même milieu que le modèle, avec le temps de ses mots", () => {
    const st = creerSousTitres(mots, modele, mesurer, nouvelId, 10_000);
    expect(st.map((e) => e.texte)).toEqual(["Bonjour à tous", "Voici la suite"]);
    expect(st.map((e) => e.temps)).toEqual([
      { debut: 500, fin: 1700 },
      { debut: 3000, fin: 4200 },
    ]);
    expect(st[0].sousTitre).toEqual({ mots: [{ debut: 0, fin: 400 }, { debut: 400, fin: 500 }, { debut: 500, fin: 900 }], style: "surligne", actif: { couleur: "#ffd60a", echelle: 1.12 }, source: "v10s" });
    expect(st.every((e) => e.y + e.hauteur / 2 === 1260 && e.id !== "modele")).toBe(true);
    // Le modèle tiré d'un sous-titre posé garde son aspect et le groupement de son style.
    expect(modeleDuSousTitre(st[0])).toMatchObject({ maxMots: 3, maxLettres: 22, sansPoints: true });
  });

  it("posés sur une piste au-dessus de tout, refaits à la même place, retirés", () => {
    const fond = video("v", { temps: { debut: 0, fin: 10_000 } });
    const titre = texte("titre", { piste: 1, temps: { debut: 0, fin: 3000 } });
    const st = creerSousTitres(mots, modele, mesurer, nouvelId, 10_000);
    let p = poserSousTitres(page([fond, titre]), st, null, durees);
    expect(p.elements.filter((e) => e.type === "texte" && e.sousTitre).map((e) => e.piste)).toEqual([2, 2]);
    // Refaits pour cette source : les anciens partent, les neufs prennent leur piste.
    const encore = creerSousTitres(mots.slice(0, 3), modele, mesurer, nouvelId, 10_000);
    p = poserSousTitres(p, encore, new Set(["v10s"]), durees);
    expect(p.elements.filter(estSousTitre).map((e) => `${e.texte}:${e.piste}`)).toEqual(["Bonjour à tous:2"]);
    // Une autre source n'est pas touchée.
    expect(poserSousTitres(p, [], new Set(["autre"]), durees).elements).toHaveLength(3);
    expect(retirerSousTitres(p, durees).elements.map((e) => e.id)).toEqual(["v", "titre"]);
  });

  it("taille, position et couleur pour tous", () => {
    const st = creerSousTitres(mots, modele, mesurer, nouvelId, 10_000);
    const p = page([video("v", { temps: { debut: 0, fin: 10_000 } }), ...st]);
    const m = ajusterSousTitres(p, { largeur: 1080, hauteur: 1920 }, { taillePolice: 60, centre: 0.5, couleurActif: "#ff0000" }, (el) => el.taillePolice * 2);
    expect(Object.keys(m)).toEqual(st.map((e) => e.id));
    expect(m[st[0].id]).toEqual({ taillePolice: 60, hauteur: 120, y: 900, sousTitre: { ...st[0].sousTitre, actif: { couleur: "#ff0000", echelle: 1.12 } } });
    expect(centreParDefaut({ largeur: 1080, hauteur: 1920 })).toBe(0.66);
    expect(centreParDefaut({ largeur: 1920, hauteur: 1080 })).toBe(0.8);
  });
});
