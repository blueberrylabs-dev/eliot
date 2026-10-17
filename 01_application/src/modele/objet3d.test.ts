import { describe, expect, it } from "vitest";
import {
  angleDeVue,
  angleNormalise,
  brillanceDeRugosite,
  CAMERA_PAR_DEFAUT,
  decaler,
  directionLumiere,
  LUMIERE_PAR_DEFAUT,
  lumiereDe,
  lumierePrete,
  normaliserCamera,
  normaliserLumiere,
  normaliserMatieres,
  normaliserOmbreSol,
  placerCamera,
  rotationEnvironnement,
  rugositeDeBrillance,
  tailleDeRendu,
  tourner,
  vuePrete,
  zoomer,
} from "./objet3d";

const longueur = (v: number[]) => Math.hypot(...v);

describe("caméra d'un objet 3D", () => {
  it("ramène les angles et borne le reste", () => {
    expect(angleNormalise(190)).toBe(-170);
    expect(angleNormalise(-180)).toBe(180);
    expect(angleNormalise(540)).toBe(180);
    const c = normaliserCamera({ azimut: 370, elevation: 120, zoom: 50, focale: 5, decalage: [0, 0, 0] });
    expect(c).toEqual({ azimut: 10, elevation: 89, zoom: 8, focale: 18 });
    // Un document abîmé retrouve la caméra de départ.
    expect(normaliserCamera(null)).toEqual(CAMERA_PAR_DEFAUT);
    expect(normaliserCamera({ azimut: "a", decalage: [0.5, 9, Number.NaN] })).toEqual({ ...CAMERA_PAR_DEFAUT, decalage: [0.5, 3, 0] });
  });

  it("convertit la focale en angle de vue (plein format)", () => {
    expect(angleDeVue(50)).toBeCloseTo(26.99, 1);
    expect(angleDeVue(24)).toBeCloseTo(53.13, 1);
    expect(angleDeVue(200)).toBeLessThan(angleDeVue(50));
  });

  it("cadre toute la sphère du modèle à zoom 1, dans le plus étroit des angles", () => {
    for (const aspect of [1, 16 / 9, 9 / 16]) {
      const p = placerCamera(CAMERA_PAR_DEFAUT, aspect);
      const demiV = (p.fov * Math.PI) / 360;
      const demiH = Math.atan(Math.tan(demiV) * aspect);
      // La sphère de rayon 1 touche presque le bord le plus proche (marge de 4 %).
      expect(Math.sin(Math.min(demiV, demiH)) * p.distance).toBeCloseTo(1.04, 6);
      expect(longueur(p.position)).toBeCloseTo(p.distance, 6);
    }
    // Rapprocher divise la distance.
    expect(placerCamera({ ...CAMERA_PAR_DEFAUT, zoom: 2 }, 1).distance).toBeCloseTo(placerCamera(CAMERA_PAR_DEFAUT, 1).distance / 2, 6);
  });

  it("place la caméra de face, de profil et de dessus", () => {
    const face = placerCamera({ azimut: 0, elevation: 0, zoom: 1, focale: 50 }, 1);
    expect(face.position[0]).toBeCloseTo(0, 6);
    expect(face.position[1]).toBeCloseTo(0, 6);
    expect(face.position[2]).toBeGreaterThan(0);
    const profil = placerCamera({ azimut: 90, elevation: 0, zoom: 1, focale: 50 }, 1);
    expect(profil.position[0]).toBeGreaterThan(0);
    expect(profil.position[2]).toBeCloseTo(0, 6);
    const dessus = placerCamera({ azimut: 0, elevation: 89, zoom: 1, focale: 50 }, 1);
    expect(dessus.position[1]).toBeGreaterThan(0.99 * dessus.distance);
  });

  it("tourne, rapproche et décale à la souris", () => {
    const c = tourner(CAMERA_PAR_DEFAUT, 100, -50);
    expect(c.azimut).toBeCloseTo(35 - 40, 6);
    expect(c.elevation).toBeCloseTo(18 - 20, 6);
    expect(tourner({ ...CAMERA_PAR_DEFAUT, elevation: 80 }, 0, 100).elevation).toBe(89);
    expect(zoomer(CAMERA_PAR_DEFAUT, 1.1).zoom).toBeCloseTo(1.1, 3);
    expect(zoomer(CAMERA_PAR_DEFAUT, 100).zoom).toBe(8);
    // De face, glisser vers la droite fait aller l'objet à droite : le point visé part à gauche.
    const d = decaler({ azimut: 0, elevation: 0, zoom: 1, focale: 50 }, 100, 0, 500, 1);
    expect(d.decalage![0]).toBeLessThan(0);
    expect(d.decalage![1]).toBeCloseTo(0, 6);
    // Glisser vers le bas fait descendre l'objet : le point visé monte.
    expect(decaler({ azimut: 0, elevation: 0, zoom: 1, focale: 50 }, 0, 100, 500, 1).decalage![1]).toBeGreaterThan(0);
    // Le décalage suit la souris au pixel : la moitié de la hauteur de l'image, c'est la moitié
    // de la hauteur vue au point visé.
    const p = placerCamera({ azimut: 0, elevation: 0, zoom: 1, focale: 50 }, 1);
    const demiHauteurVue = p.distance * Math.tan((p.fov * Math.PI) / 360);
    expect(decaler({ azimut: 0, elevation: 0, zoom: 1, focale: 50 }, 0, 250, 500, 1).decalage![1]).toBeCloseTo(Math.min(3, demiHauteurVue), 3);
  });

  it("donne les vues prêtes en gardant le zoom et la focale", () => {
    const c = vuePrete({ azimut: 12, elevation: 5, zoom: 1.5, focale: 85 }, "profil");
    expect(c).toEqual({ azimut: 90, elevation: 0, zoom: 1.5, focale: 85 });
    expect(vuePrete(CAMERA_PAR_DEFAUT, "inconnue")).toBeNull();
  });

  it("rend par paliers, au plus 2048 px", () => {
    expect(tailleDeRendu(500, 500, 1)).toEqual([512, 512]);
    expect(tailleDeRendu(500, 500, 1.02)).toEqual([512, 512]);
    expect(tailleDeRendu(1000, 500, 2)).toEqual([2048, 1024]);
    expect(tailleDeRendu(4000, 4000, 2)).toEqual([2048, 2048]);
    expect(tailleDeRendu(10, 10, 1)).toEqual([64, 64]);
  });
});

describe("lumière, ombre au sol, matières d'un objet 3D", () => {
  it("garde le document court : la lumière de départ n'y est pas écrite", () => {
    expect(normaliserLumiere(undefined)).toBeUndefined();
    expect(normaliserLumiere(LUMIERE_PAR_DEFAUT)).toBeUndefined();
    expect(lumiereDe(undefined)).toEqual(LUMIERE_PAR_DEFAUT);
  });

  it("borne et complète une lumière", () => {
    const l = normaliserLumiere({ environnement: { id: "inconnu", intensite: 9 }, principale: { azimut: 200, couleur: "#FFAA00" }, exposition: -7 })!;
    expect(l.environnement).toEqual({ id: "studio", intensite: 3, rotation: 0 });
    expect(l.principale).toEqual({ azimut: -160, elevation: 45, intensite: 1, couleur: "#ffaa00" });
    expect(l.exposition).toBe(-3);
    expect(normaliserLumiere({ environnement: { id: "couchant" } })!.environnement.id).toBe("couchant");
    expect(normaliserLumiere({ principale: { couleur: "rouge" } })).toBeUndefined();
  });

  it("donne les lumières prêtes, le reste gardé", () => {
    const l = lumierePrete({ ...LUMIERE_PAR_DEFAUT, exposition: 0.5 }, "contre-jour")!;
    expect(l.principale.azimut).toBe(160);
    expect(l.principale.elevation).toBe(30);
    expect(l.exposition).toBe(0.5);
    expect(lumierePrete(undefined, "trois-quarts")).toBeUndefined();
    expect(lumierePrete(undefined, "inconnue")).toBeNull();
  });

  it("fait tourner la lumière et l'environnement avec la vue", () => {
    const l = LUMIERE_PAR_DEFAUT;
    // De face, une lumière à -45° vient de la gauche de l'image (x négatif), d'en haut.
    const [x, y, z] = directionLumiere({ ...CAMERA_PAR_DEFAUT, azimut: 0 }, l);
    expect(x).toBeLessThan(0);
    expect(y).toBeCloseTo(Math.SQRT1_2, 6);
    expect(z).toBeGreaterThan(0);
    // La caméra fait un quart de tour : la lumière aussi.
    const [x2, , z2] = directionLumiere({ ...CAMERA_PAR_DEFAUT, azimut: 90 }, l);
    expect(x2).toBeCloseTo(z, 6);
    expect(z2).toBeCloseTo(-x, 6);
    expect(rotationEnvironnement({ ...CAMERA_PAR_DEFAUT, azimut: 170 }, { ...l, environnement: { ...l.environnement, rotation: 30 } })).toBe(-160);
  });

  it("borne l'ombre au sol et les matières", () => {
    expect(normaliserOmbreSol(null)).toBeUndefined();
    expect(normaliserOmbreSol({})).toEqual({ opacite: 0.45, douceur: 0.5 });
    expect(normaliserOmbreSol({ opacite: 3, douceur: -1 })).toEqual({ opacite: 1, douceur: 0 });
    // Sans traîne de virgule flottante : 0,35 reste 0,35.
    expect(JSON.stringify(normaliserOmbreSol({ opacite: 0.55, douceur: 0.35 }))).toBe('{"opacite":0.55,"douceur":0.35}');
    expect(JSON.stringify(normaliserCamera({ azimut: 0, elevation: 0, zoom: 1, focale: 50, decalage: [-0.2256, 0.1649, -0.0735] }).decalage)).toBe("[-0.2256,0.1649,-0.0735]");
    expect(normaliserMatieres({ Verre: { couleur: "#AABBCC", brillance: 140 }, Bouchon: { couleur: "or" }, "": { couleur: "#000000" } })).toEqual({ Verre: { couleur: "#aabbcc", brillance: 100 } });
    expect(normaliserMatieres({ Bouchon: {} })).toBeUndefined();
    expect(brillanceDeRugosite(0.3)).toBe(70);
    expect(rugositeDeBrillance(70)).toBeCloseTo(0.3, 6);
  });
});
