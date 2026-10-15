import { describe, expect, it } from "vitest";
import { aimanter, deplacerClip, dupliquerDansLeTemps, estPageVideo, instantAffiche, normaliser, pistesDe, placer, rogner, scinder, tempsLisible, tempsMedia, versFixe, versVideo, visibleA } from "./frise";
import type { ElementForme, ElementImage, ElementPage, ElementTexte, ElementVideo, PageEliot } from "./types";

const base = { x: 0, y: 0, largeur: 100, hauteur: 100, rotation: 0, opacite: 1, visible: true, verrouille: false };
const video = (id: string, ressource = "v10s", extra: Partial<ElementVideo> = {}): ElementVideo => ({ ...base, id, type: "video", ressource, retourneH: false, retourneV: false, ...extra });
const photo = (id: string, extra: Partial<ElementImage> = {}): ElementImage => ({ ...base, id, type: "image", ressource: "p", retourneH: false, retourneV: false, ...extra });
const texte = (id: string, extra: Partial<ElementTexte> = {}): ElementTexte => ({
  ...base, id, type: "texte", texte: id, police: "Inter", taillePolice: 40, gras: false, italique: false, souligne: false, alignement: "left", couleur: "#000000", interligne: 1.2, espacement: 0, ...extra,
});
const forme = (id: string): ElementForme => ({ ...base, id, type: "forme", forme: "rectangle", remplissage: "#000000", contour: "#000000", epaisseurContour: 0, arrondi: 0 });
const durees = (r: string) => ({ v10s: 10_000, v4s: 4000 })[r as "v10s"];
const page = (elements: ElementPage[], duree?: number): PageEliot => ({ id: "p", fond: "#000000", elements, ...(duree !== undefined ? { duree } : {}) });
const resume = (p: PageEliot) => p.elements.map((e) => `${e.id}:${e.piste}:${e.temps?.debut}-${e.temps?.fin}`);
let compteur = 0;
const nouvelId = () => `n${++compteur}`;

describe("frise : conversion", () => {
  it("une page fixe devient vidéo en gardant l'empilement, et revient", () => {
    const fixe = page([forme("fond"), video("v"), texte("t")]);
    const v = versVideo(fixe, durees);
    expect(estPageVideo(v)).toBe(true);
    expect(v.duree).toBe(10_000);
    expect(resume(v)).toEqual(["fond:1:0-10000", "v:2:0-10000", "t:3:0-10000"]);
    const retour = versFixe(v);
    expect(retour.duree).toBeUndefined();
    expect(retour.elements.every((e) => e.temps === undefined && e.piste === undefined)).toBe(true);
    // Sans vidéo : un post animé de 5 s.
    expect(versVideo(page([texte("a")]), durees).duree).toBe(5000);
  });

  it("la normalisation ne change rien à une page déjà en ordre", () => {
    const v = versVideo(page([forme("f"), texte("t")]), durees);
    expect(normaliser(v, durees)).toBe(v);
    expect(normaliser(page([texte("x")]), durees).duree).toBeUndefined();
  });
});

describe("frise : piste principale", () => {
  it("les vidéos se posent bout à bout : au bout, ou après le clip sous la tête", () => {
    let p = page([], 5000);
    p = placer(p, [video("a")], 0, durees);
    p = placer(p, [video("b", "v4s")], 0, durees);
    expect(resume(p)).toEqual(["a:0:0-10000", "b:0:10000-14000"]);
    p = placer(p, [video("c", "v4s")], 99_000, durees);
    expect(resume(p)).toEqual(["a:0:0-10000", "b:0:10000-14000", "c:0:14000-18000"]);
    // Tête au milieu de « a » : la vidéo s'insère après « a ».
    p = placer(p, [video("d", "v4s")], 6000, durees);
    expect(resume(p)).toEqual(["a:0:0-10000", "d:0:10000-14000", "b:0:14000-18000", "c:0:18000-22000"]);
    expect(p.duree).toBe(22_000);
  });

  it("une photo se pose au-dessus (un logo ne couvre pas la page), et se range bout à bout si on l'y glisse", () => {
    let p = placer(page([], 5000), [video("a", "v4s")], 0, durees);
    p = placer(p, [photo("logo")], 1000, durees);
    expect(resume(p)).toEqual(["a:0:0-4000", "logo:1:1000-4000"]);
    p = deplacerClip(p, "logo", 99_000, 0, durees);
    expect(resume(p)).toEqual(["a:0:0-4000", "logo:0:4000-7000"]);
  });

  it("supprimer un clip resserre la suite", () => {
    let p = placer(page([], 5000), [video("a", "v4s"), video("b", "v4s"), video("c", "v4s")], 99_000, durees);
    p = normaliser({ ...p, elements: p.elements.filter((e) => e.id !== "b") }, durees);
    expect(resume(p)).toEqual(["a:0:0-4000", "c:0:4000-8000"]);
    expect(p.duree).toBe(8000);
  });

  it("un texte ne va jamais sur la piste principale", () => {
    const p = normaliser(page([{ ...texte("t"), piste: 0, temps: { debut: 0, fin: 1000 } }], 1000), durees);
    expect(resume(p)).toEqual(["t:1:0-1000"]);
  });

  it("déplacer un clip le fait changer de place dans la suite", () => {
    let p = placer(page([], 5000), [video("a", "v4s"), video("b", "v4s"), video("c", "v4s")], 99_000, durees);
    p = deplacerClip(p, "c", 500, 0, durees);
    expect(resume(p)).toEqual(["c:0:0-4000", "a:0:4000-8000", "b:0:8000-12000"]);
    p = deplacerClip(p, "c", 99_000, 0, durees);
    expect(resume(p)).toEqual(["a:0:0-4000", "b:0:4000-8000", "c:0:8000-12000"]);
  });
});

describe("frise : superpositions", () => {
  it("un texte se pose au-dessus de ce qui se voit, à la tête, pour 3 s", () => {
    let p = placer(page([], 5000), [video("a")], 0, durees);
    p = placer(p, [texte("t1")], 2000, durees);
    p = placer(p, [texte("t2")], 6000, durees);
    p = placer(p, [texte("t3")], 3000, durees);
    expect(resume(p)).toEqual(["a:0:0-10000", "t1:1:2000-5000", "t2:1:6000-9000", "t3:2:3000-6000"]);
  });

  it("un clip lâché sur une piste occupée monte sur une piste neuve juste au-dessus", () => {
    let p = placer(page([], 5000), [video("a")], 0, durees);
    p = placer(p, [texte("t1")], 0, durees);
    p = placer(p, [texte("t2")], 5000, durees);
    p = placer(p, [texte("t3")], 0, durees);
    expect(resume(p)).toEqual(["a:0:0-10000", "t1:1:0-3000", "t2:1:5000-8000", "t3:2:0-3000"]);
    p = deplacerClip(p, "t3", 6000, 1, durees);
    expect(resume(p)).toEqual(["a:0:0-10000", "t1:1:0-3000", "t2:1:5000-8000", "t3:2:6000-9000"]);
    // Trop long pour le trou de 3 s à 5 s : il reste au-dessus.
    p = deplacerClip(p, "t3", 3000, 1, durees);
    expect(resume(p)).toEqual(["a:0:0-10000", "t1:1:0-3000", "t2:1:5000-8000", "t3:2:3000-6000"]);
    // Après t2, la place est libre : il y descend, et la piste 2 vide disparaît.
    p = deplacerClip(p, "t3", 8000, 1, durees);
    expect(resume(p)).toEqual(["a:0:0-10000", "t1:1:0-3000", "t2:1:5000-8000", "t3:1:8000-11000"]);
    expect(p.duree).toBe(11_000);
  });

  it("une vidéo passe de la piste principale à une superposition (incrustation) et revient", () => {
    let p = placer(page([], 5000), [video("a", "v4s"), video("b", "v4s")], 99_000, durees);
    p = deplacerClip(p, "b", 1000, 1, durees);
    expect(resume(p)).toEqual(["a:0:0-4000", "b:1:1000-5000"]);
    p = deplacerClip(p, "b", 3000, 0, durees);
    expect(resume(p)).toEqual(["a:0:0-4000", "b:0:4000-8000"]);
  });

  it("un texte glissé sur la piste principale reste en superposition", () => {
    let p = placer(page([], 5000), [video("a")], 0, durees);
    p = placer(p, [texte("t")], 0, durees);
    p = deplacerClip(p, "t", 4000, 0, durees);
    expect(resume(p)).toEqual(["a:0:0-10000", "t:1:4000-7000"]);
  });
});

describe("frise : rogner, scinder, dupliquer", () => {
  it("rogner une vidéo change sa coupe, sans dépasser le fichier", () => {
    let p = placer(page([], 5000), [video("a"), video("b", "v4s")], 99_000, durees);
    p = rogner(p, "a", "debut", 2000, durees);
    let a = p.elements.find((e) => e.id === "a") as ElementVideo;
    expect(a.coupe).toEqual({ debut: 2000 });
    expect(resume(p)).toEqual(["a:0:0-8000", "b:0:8000-12000"]);
    p = rogner(p, "a", "fin", 5000, durees);
    a = p.elements.find((e) => e.id === "a") as ElementVideo;
    expect(a.coupe).toEqual({ debut: 2000, fin: 7000 });
    expect(resume(p)).toEqual(["a:0:0-5000", "b:0:5000-9000"]);
    // Tirer au-delà du fichier : la coupe s'arrête au bout, et disparaît si elle couvre tout.
    p = rogner(p, "a", "fin", 99_000, durees);
    p = rogner(p, "a", "debut", -5000, durees);
    a = p.elements.find((e) => e.id === "a") as ElementVideo;
    expect(a.coupe).toBeUndefined();
    expect(resume(p)).toEqual(["a:0:0-10000", "b:0:10000-14000"]);
  });

  it("rogner une vidéo ralentie tient compte de sa vitesse", () => {
    let p = placer(page([], 5000), [video("a", "v4s", { vitesse: 0.5 })], 0, durees);
    expect(resume(p)).toEqual(["a:0:0-8000"]);
    p = rogner(p, "a", "fin", 2000, durees);
    expect((p.elements[0] as ElementVideo).coupe).toEqual({ debut: 0, fin: 1000 });
  });

  it("un texte se rogne jusqu'à son voisin de piste, 100 ms au moins", () => {
    let p = placer(page([], 5000), [video("a")], 0, durees);
    p = placer(p, [texte("t1")], 0, durees);
    p = placer(p, [texte("t2")], 5000, durees);
    p = rogner(p, "t1", "fin", 7000, durees);
    expect(resume(p)).toContain("t1:1:0-5000");
    p = rogner(p, "t2", "debut", 9000, durees);
    expect(resume(p)).toContain("t2:1:7900-8000");
  });

  it("scinder coupe une vidéo en deux morceaux qui se suivent", () => {
    let p = placer(page([], 5000), [video("a"), video("b", "v4s")], 99_000, durees);
    const r = scinder(p, ["a"], 3000, durees, nouvelId);
    p = r.page;
    expect(r.nouveaux).toHaveLength(1);
    const [premier, second] = p.elements.filter((e) => e.type === "video" && e.ressource === "v10s") as ElementVideo[];
    expect(premier.coupe).toEqual({ debut: 0, fin: 3000 });
    expect(second.coupe).toEqual({ debut: 3000 });
    expect(resume(p)).toEqual(["a:0:0-3000", `${r.nouveaux[0]}:0:3000-10000`, "b:0:10000-14000"]);
    // Trop près d'un bord : rien.
    expect(scinder(p, ["a"], 2950, durees, nouvelId).nouveaux).toEqual([]);
  });

  it("dupliquer place la copie juste après l'original", () => {
    let p = placer(page([], 5000), [video("a", "v4s"), video("b", "v4s")], 99_000, durees);
    p = placer(p, [texte("t")], 0, durees);
    const originaux = p.elements.filter((e) => e.id === "a" || e.id === "t");
    const copies = originaux.map((e) => ({ ...e, id: `${e.id}2`, x: e.x + 24 }));
    p = dupliquerDansLeTemps(p, originaux, copies, durees);
    expect(resume(p)).toEqual(["a:0:0-4000", "a2:0:4000-8000", "b:0:8000-12000", "t:1:0-3000", "t2:1:3000-6000"]);
    expect(p.elements.find((e) => e.id === "t2")!.x).toBe(0);
  });
});

describe("frise : lecture", () => {
  it("visibilité, instant affiché, temps du fichier", () => {
    const v = { ...video("a", "v10s", { coupe: { debut: 2000, fin: 6000 }, vitesse: 2 }), temps: { debut: 1000, fin: 3000 } };
    expect(visibleA(v, 999)).toBe(false);
    expect(visibleA(v, 1000)).toBe(true);
    expect(visibleA(v, 3000)).toBe(false);
    expect(tempsMedia(v, 1000)).toBe(2000);
    expect(tempsMedia(v, 2000)).toBe(4000);
    expect(tempsMedia(v, 9000)).toBe(6000);
    expect(instantAffiche(page([], 5000), 5000)).toBe(4999);
    expect(aimanter(1040, [0, 1000, 3000], 50)).toBe(1000);
    expect(aimanter(1100, [0, 1000, 3000], 50)).toBe(1100);
    expect(tempsLisible(65_250)).toBe("1:05.3");
    expect(tempsLisible(3200)).toBe("0:03.2");
  });

  it("les pistes se listent de la plus haute à la principale", () => {
    let p = placer(page([], 5000), [video("a")], 0, durees);
    p = placer(p, [texte("t1"), texte("t2")], 0, durees);
    expect(pistesDe(p).map((x) => [x.piste, x.clips.map((c) => c.id)])).toEqual([[2, ["t2"]], [1, ["t1"]], [0, ["a"]]]);
  });
});
