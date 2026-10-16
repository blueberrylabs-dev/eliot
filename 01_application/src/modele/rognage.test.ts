import { describe, expect, it } from "vitest";
import {
  boiteApresRognage,
  boiteMemeCentre,
  coinsDansOriginal,
  dansImage,
  deplacer,
  matriceRognage,
  normaliserRognage,
  proportionner,
  proportionsDe,
  rapportDe,
  rectangleRedresse,
  redresser,
  tirer,
  type BoiteElement,
  type MatriceRognage,
  type Rognage,
} from "./rognage";

const W = 3000;
const H = 2000;
const appliquer = (m: MatriceRognage, x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

describe("recadrage et redressement (étape 5, lot 5)", () => {
  it("le document ne garde qu'un recadrage qui tient dans l'image", () => {
    expect(normaliserRognage(undefined, W, H)).toBeUndefined();
    expect(normaliserRognage({ x: 0, y: 0, largeur: 1, hauteur: 1, angle: 0 }, W, H)).toBeUndefined();
    expect(normaliserRognage({ x: "a" }, W, H)).toBeUndefined();
    const r = normaliserRognage({ x: 0.1, y: 0.2, largeur: 0.5, hauteur: 0.4, angle: 0 }, W, H)!;
    expect(r).toEqual({ x: 0.1, y: 0.2, largeur: 0.5, hauteur: 0.4, angle: 0 });
    // Trop grand pour l'image tournée : il se resserre autour de son centre, sans coin vide.
    const t = normaliserRognage({ x: 0, y: 0, largeur: 1, hauteur: 1, angle: 60 }, W, H)!;
    expect(t.angle).toBe(45);
    expect(dansImage(t, W, H, 0.05)).toBe(true);
    expect(t.largeur).toBeLessThan(1);
    expect(t.largeur * W / (t.hauteur * H)).toBeCloseTo(1.5, 3);
  });

  it("la matrice pose le rectangle gardé sur la boîte, redressé ou non", () => {
    const m0 = matriceRognage(undefined, W, H, 300, 200);
    expect(appliquer(m0, 0, 0)).toEqual([0, 0]);
    expect(appliquer(m0, W, H).map((v) => Math.round(v * 1e6) / 1e6)).toEqual([300, 200]);
    for (const angle of [0, 7.5, -30]) {
      const r = redresser({ x: 0.2, y: 0.1, largeur: 0.5, hauteur: 0.6, angle: 0 }, angle, W, H);
      const coins = coinsDansOriginal(r, W, H);
      const m = matriceRognage(r, W, H, 500, 400);
      const attendus = [
        [0, 0],
        [500, 0],
        [500, 400],
        [0, 400],
      ];
      coins.forEach((c, i) => {
        const [x, y] = appliquer(m, c.x, c.y);
        expect(x).toBeCloseTo(attendus[i][0], 6);
        expect(y).toBeCloseTo(attendus[i][1], 6);
      });
    }
  });

  it("redresser : l'image tourne autour du cadre, qui se resserre juste ce qu'il faut", () => {
    const r = redresser(undefined, 10, W, H);
    expect(r.angle).toBe(10);
    expect(dansImage(r, W, H)).toBe(true);
    expect(proportionsDe(r, W, H)).toBeCloseTo(1.5, 6);
    // Le plus grand : un peu plus grand déborderait.
    const c = { x: r.x + r.largeur / 2, y: r.y + r.hauteur / 2 };
    const plus = { ...r, x: c.x - (r.largeur * 1.002) / 2, y: c.y - (r.hauteur * 1.002) / 2, largeur: r.largeur * 1.002, hauteur: r.hauteur * 1.002 };
    expect(dansImage(plus, W, H)).toBe(false);
    // Revenir à 0 depuis le même départ rend toute l'image.
    expect(normaliserRognage(redresser(undefined, 0, W, H), W, H)).toBeUndefined();
    // Le centre du cadre reste sur le même point de la photo.
    const petit: Rognage = { x: 0.6, y: 0.5, largeur: 0.2, hauteur: 0.2, angle: 0 };
    const tourne = redresser(petit, -12, W, H);
    const avant = coinsDansOriginal(petit, W, H);
    const apres = coinsDansOriginal(tourne, W, H);
    const milieu = (p: { x: number; y: number }[]) => [(p[0].x + p[2].x) / 2, (p[0].y + p[2].y) / 2];
    expect(milieu(apres)[0]).toBeCloseTo(milieu(avant)[0], 6);
    expect(milieu(apres)[1]).toBeCloseTo(milieu(avant)[1], 6);
    expect(tourne.largeur).toBeCloseTo(0.2, 9);
  });

  it("des proportions prêtes : le plus grand rectangle, au plus près du cadre actuel", () => {
    const carre = proportionner(undefined, 1, W, H);
    expect(carre.hauteur).toBeCloseTo(1, 6);
    expect(carre.largeur * W).toBeCloseTo(H, 3);
    expect(carre.x).toBeCloseTo((1 - H / W) / 2, 6);
    // Depuis un petit cadre à droite : le carré va aussi loin à droite qu'il le peut.
    const droite = proportionner({ x: 0.8, y: 0.4, largeur: 0.1, hauteur: 0.1, angle: 0 }, 1, W, H);
    expect(droite.x + droite.largeur).toBeCloseTo(1, 6);
    // En hauteur (4:5) sur une photo en largeur.
    const portrait = proportionner(undefined, 4 / 5, W, H);
    expect(proportionsDe(portrait, W, H)).toBeCloseTo(0.8, 6);
    expect(dansImage(portrait, W, H)).toBe(true);
    expect(rapportDe("4:5", W, H, { largeur: 1080, hauteur: 1920 })).toBeCloseTo(0.8, 9);
    expect(rapportDe("4:5", W, H, { largeur: 1080, hauteur: 1920 }, true)).toBeCloseTo(1.25, 9);
    expect(rapportDe("original", W, H, { largeur: 1080, hauteur: 1920 })).toBeCloseTo(1.5, 9);
    expect(rapportDe("page", W, H, { largeur: 1080, hauteur: 1920 })).toBeCloseTo(0.5625, 9);
    expect(rapportDe("9:16", W, H, { largeur: 1, hauteur: 1 })).toBeCloseTo(0.5625, 9);
    expect(rapportDe("libre", W, H, { largeur: 1, hauteur: 1 })).toBeNull();
  });

  it("déplacer et tirer s'arrêtent au bord de l'image", () => {
    const r: Rognage = { x: 0.2, y: 0.2, largeur: 0.5, hauteur: 0.5, angle: 0 };
    const loin = deplacer(r, 10_000, -10_000, W, H);
    expect(loin.x + loin.largeur).toBeCloseTo(1, 4);
    expect(loin.y).toBeCloseTo(0, 4);
    const e = tirer(r, "e", 10_000, 0, null, W, H);
    expect(e.x).toBe(0.2);
    expect(e.x + e.largeur).toBeCloseTo(1, 4);
    expect(e.hauteur).toBe(0.5);
    // Un coin, proportions gardées (1:1 en pixels) : le coin opposé ne bouge pas.
    const carre = tirer({ x: 0.2, y: 0.2, largeur: 0.2, hauteur: 0.3, angle: 0 }, "se", 300, 100, 1, W, H);
    expect(carre.x).toBeCloseTo(0.2, 9);
    expect(carre.y).toBeCloseTo(0.2, 9);
    expect(carre.largeur * W).toBeCloseTo(carre.hauteur * H, 6);
    // Pas sous 2 % de l'original.
    const mince = tirer(r, "o", 5000, 0, null, W, H);
    expect(mince.largeur).toBeCloseTo(0.02, 6);
    // Redressée : la poignée s'arrête là où un coin toucherait le bord.
    const penche = redresser({ x: 0.3, y: 0.3, largeur: 0.3, hauteur: 0.3, angle: 0 }, 20, W, H);
    expect(dansImage(tirer(penche, "ne", 4000, -4000, null, W, H), W, H)).toBe(true);
  });

  it("la photo reste à sa place sur la page quand la boîte suit le cadre", () => {
    const avant: Rognage = { x: 0.1, y: 0.1, largeur: 0.6, hauteur: 0.5, angle: 0 };
    const apres = tirer(avant, "no", -150, 200, null, W, H);
    for (const retourne of [
      [false, false],
      [true, false],
      [false, true],
      [true, true],
    ]) {
      const el: BoiteElement = { x: 100, y: 80, largeur: 600, hauteur: 333.3333333, rotation: 30, retourneH: retourne[0], retourneV: retourne[1] };
      const b = boiteApresRognage(el, avant, apres, W, H);
      // Un point de la photo (dans les deux cadres) : sa place sur la page avant et après.
      const point = { x: 0.5 * W, y: 0.45 * H };
      const surPage = (e: BoiteElement, r: Rognage) => {
        const m = matriceRognage(r, W, H, e.largeur, e.hauteur);
        const [u, v] = appliquer(m, point.x, point.y);
        const lx = e.retourneH ? e.largeur - u : u;
        const ly = e.retourneV ? e.hauteur - v : v;
        const t = (e.rotation * Math.PI) / 180;
        return [e.x + lx * Math.cos(t) - ly * Math.sin(t), e.y + lx * Math.sin(t) + ly * Math.cos(t)];
      };
      const p0 = surPage(el, avant);
      const p1 = surPage({ ...el, ...b }, apres);
      expect(p1[0]).toBeCloseTo(p0[0], 6);
      expect(p1[1]).toBeCloseTo(p0[1], 6);
      // L'échelle ne change pas.
      expect(b.largeur / rectangleRedresse(apres, W, H).largeur).toBeCloseTo(el.largeur / rectangleRedresse(avant, W, H).largeur, 9);
    }
    // Redresser garde la boîte : même centre, mêmes côtés.
    const el: BoiteElement = { x: 50, y: 60, largeur: 300, hauteur: 200, rotation: 15, retourneH: false, retourneV: false };
    const tourne = redresser(undefined, 8, W, H);
    expect(boiteMemeCentre(el, undefined, tourne, W, H)).toEqual({ x: 50, y: 60, largeur: 300, hauteur: 200 });
  });
});
