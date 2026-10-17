import { describe, expect, it } from "vitest";
import { angleDeVue, angleNormalise, CAMERA_PAR_DEFAUT, decaler, normaliserCamera, placerCamera, tailleDeRendu, tourner, vuePrete, zoomer } from "./objet3d";

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
