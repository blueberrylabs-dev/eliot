import { describe, expect, it } from "vitest";
import { cameraDesCles, couperCles, poseArrondie, poserCle } from "./animation";
import { rogner, scinder } from "./frise";
import { aDuMouvement, anglePlateau, avancerMouvement, cameraA, cameraDeBase, clesAvecCameras, clesAvecCourbe, clesSansCamera, courbeDesCles, instantAnimation, normaliserAnimationModele, normaliserPlateau, objetFige, secondesAnimation } from "./mouvement3d";
import type { Camera3d, ElementObjet3d, PageEliot } from "./types";

const camera = (azimut: number, extra: Partial<Camera3d> = {}): Camera3d => ({ azimut, elevation: 10, zoom: 1, focale: 50, ...extra });
const objet = (extra: Partial<ElementObjet3d> = {}): ElementObjet3d => ({
  id: "o",
  type: "objet3d",
  ressource: "m",
  x: 100,
  y: 100,
  largeur: 400,
  hauteur: 400,
  rotation: 0,
  opacite: 1,
  visible: true,
  verrouille: false,
  camera: camera(30),
  temps: { debut: 1000, fin: 9000 },
  piste: 1,
  ...extra,
});

describe("mouvement 3D : plateau tournant", () => {
  it("tourne d'un tour en `tour` ms, vers la droite l'azimut diminue", () => {
    const el = objet({ plateau: { tour: 8000, sens: "droite" } });
    expect(anglePlateau(el, 0)).toBeCloseTo(0);
    expect(anglePlateau(el, 2000)).toBeCloseTo(-90);
    expect(anglePlateau(el, 8000)).toBeCloseTo(-360);
    expect(anglePlateau({ ...el, plateau: { tour: 4000, sens: "gauche" } }, 1000)).toBeCloseTo(90);
    expect(cameraA(el, 2000).azimut).toBeCloseTo(-60);
    expect(cameraA(el, 2000).elevation).toBe(10);
  });

  it("rien avant le début du clip, ni sur une image fixe, ni sans plateau", () => {
    const el = objet({ plateau: { tour: 8000, sens: "droite" } });
    expect(anglePlateau(el, -500)).toBe(0);
    expect(anglePlateau({ ...el, temps: undefined }, 2000)).toBe(0);
    expect(anglePlateau(objet(), 2000)).toBe(0);
  });

  it("se normalise : bornes, sens par défaut, absent sans objet", () => {
    expect(normaliserPlateau({ tour: 500, sens: "x" })).toEqual({ tour: 2000, sens: "droite" });
    expect(normaliserPlateau({ tour: 1e9, sens: "gauche" })).toEqual({ tour: 120_000, sens: "gauche" });
    expect(normaliserPlateau({})).toEqual({ tour: 8000, sens: "droite" });
    expect(normaliserPlateau(null)).toBeUndefined();
  });
});

describe("mouvement 3D : caméra des images clés", () => {
  it("glisse d'une clé à l'autre, le zoom en proportion, le décalage en ligne droite", () => {
    const el = objet({ cles: [{ t: 0, camera: camera(0, { zoom: 1 }), courbe: "lineaire" }, { t: 2000, camera: camera(60, { zoom: 4, elevation: 30, decalage: [0, 1, 0] }) }] });
    const milieu = cameraDesCles(el, 1000)!;
    expect(milieu.azimut).toBeCloseTo(30);
    expect(milieu.elevation).toBeCloseTo(20);
    expect(milieu.zoom).toBeCloseTo(2);
    expect(milieu.decalage![1]).toBeCloseTo(0.5);
    expect(cameraDesCles(el, -100)!.azimut).toBe(0);
    expect(cameraDesCles(el, 5000)!.azimut).toBe(60);
    expect(cameraDesCles(objet(), 1000)).toBeUndefined();
  });

  it("prend le chemin le plus court : de 170° à -170°, vingt degrés seulement", () => {
    const el = objet({ cles: [{ t: 0, camera: camera(170), courbe: "lineaire" }, { t: 1000, camera: camera(-170) }] });
    expect(cameraDesCles(el, 500)!.azimut).toBeCloseTo(180);
    expect(cameraDesCles(el, 1000)!.azimut).toBeCloseTo(190);
  });

  it("la courbe douce part et arrive en douceur", () => {
    const el = objet({ cles: [{ t: 0, camera: camera(0) }, { t: 1000, camera: camera(100) }] });
    expect(cameraDesCles(el, 250)!.azimut).toBeCloseTo(15.625);
  });

  it("les clés sans caméra ne comptent pas pour elle ; la caméra de base vient des clés, puis le plateau s'y ajoute", () => {
    const el = objet({ plateau: { tour: 4000, sens: "droite" }, cles: [{ t: 0, x: 10, y: 10 }, { t: 1000, camera: camera(50) }] });
    expect(cameraDeBase(el, 0).azimut).toBe(50);
    expect(cameraA(el, 1000).azimut).toBeCloseTo(50 - 90);
    // Sur une image fixe, les clés ne servent pas.
    expect(cameraDeBase({ ...el, temps: undefined }, 0).azimut).toBe(30);
  });

  it("une image clé posée sur un objet 3D emporte sa caméra de l'instant", () => {
    const el = objet({ cles: [{ t: 0, camera: camera(0), courbe: "lineaire" }, { t: 2000, camera: camera(80) }] });
    expect(poseArrondie(el, 1000).camera?.azimut).toBe(40);
    const cles = poserCle(el, 1000, { x: 5, y: 6 });
    expect(cles.map((c) => c.t)).toEqual([0, 1000, 2000]);
    expect(cles[1].camera?.azimut).toBe(40);
    expect(poseArrondie(objet(), 0).camera).toEqual(camera(30));
  });

  it("couper le clip partage la caméra au bord", () => {
    const el = objet({ cles: [{ t: 0, camera: camera(0), courbe: "lineaire" }, { t: 2000, camera: camera(80) }] });
    const { avant, apres } = couperCles(el, 500);
    expect(avant!.at(-1)).toMatchObject({ t: 500, camera: { azimut: 20 } });
    expect(apres![0]).toMatchObject({ t: 0, camera: { azimut: 20 } });
    expect(apres![1]).toMatchObject({ t: 1500, camera: { azimut: 80 } });
  });
});

describe("mouvement 3D : animation du modèle", () => {
  it("avance à sa vitesse depuis son départ ; en boucle ou arrêtée sur sa dernière image", () => {
    const el = objet({ animationModele: { nom: "Marche", vitesse: 2, boucle: true, debut: 500 } });
    expect(instantAnimation(el, 1000)).toBe(2500);
    expect(instantAnimation({ ...el, temps: undefined }, 1000)).toBe(500);
    expect(secondesAnimation(2500, 1, true)).toBeCloseTo(0.5);
    expect(secondesAnimation(2500, 1, false)).toBe(1);
    expect(secondesAnimation(-250, 1, true)).toBeCloseTo(0.75);
    expect(secondesAnimation(400, 0, true)).toBe(0);
  });

  it("se normalise : nom obligatoire, vitesse bornée, boucle par défaut", () => {
    expect(normaliserAnimationModele({ nom: "Danse", vitesse: 9 })).toEqual({ nom: "Danse", vitesse: 4, boucle: true, debut: 0 });
    expect(normaliserAnimationModele({ nom: "Danse", vitesse: 0.333, boucle: false, debut: 1200.4 })).toEqual({ nom: "Danse", vitesse: 0.33, boucle: false, debut: 1200 });
    expect(normaliserAnimationModele({ vitesse: 1 })).toBeUndefined();
  });

  it("dit si l'objet bouge avec le temps", () => {
    expect(aDuMouvement(objet())).toBe(false);
    expect(aDuMouvement(objet({ plateau: { tour: 8000, sens: "droite" } }))).toBe(true);
    expect(aDuMouvement(objet({ cles: [{ t: 0, x: 1, y: 2 }] }))).toBe(false);
    expect(aDuMouvement(objet({ cles: [{ t: 0, camera: camera(0) }] }))).toBe(true);
    expect(aDuMouvement(objet({ temps: undefined, plateau: { tour: 8000, sens: "droite" } }))).toBe(false);
  });
});

describe("mouvement 3D : sans saut quand le clip est rogné ou coupé", () => {
  const page = (el: ElementObjet3d): PageEliot => ({ id: "p", fond: "#000000", duree: 10_000, elements: [el] });
  const durees = () => undefined;

  it("avancer le mouvement : le plateau et l'animation reprennent où ils en étaient", () => {
    const el = objet({ plateau: { tour: 8000, sens: "droite" }, animationModele: { nom: "M", vitesse: 2, boucle: true, debut: 100 }, cles: [{ t: 0, camera: camera(10) }] });
    const m = avancerMouvement(el, 2000);
    expect(m.camera?.azimut).toBe(-60);
    expect(m.cles?.[0].camera?.azimut).toBe(-80);
    expect(m.animationModele?.debut).toBe(4100);
    expect(avancerMouvement(objet(), 2000)).toEqual({});
  });

  it("couper en deux : la seconde moitié commence où la première finit", () => {
    const el = objet({ plateau: { tour: 8000, sens: "droite" }, animationModele: { nom: "M", vitesse: 1, boucle: true, debut: 0 } });
    const { page: p, nouveaux } = scinder(page(el), ["o"], 3000, durees, () => "o2");
    const [a, b] = p.elements as ElementObjet3d[];
    expect(nouveaux).toEqual(["o2"]);
    const finA = cameraA(a, a.temps!.fin - a.temps!.debut).azimut;
    const debutB = cameraA(b, 0).azimut;
    expect(((finA - debutB) % 360 + 360) % 360).toBeCloseTo(0);
    expect(instantAnimation(b, 0)).toBe(instantAnimation(a, 2000));
  });

  it("rogner le début : le contenu reste au même moment", () => {
    const el = objet({ plateau: { tour: 8000, sens: "gauche" } });
    const r = rogner(page(el), "o", "debut", 2000, durees).elements[0] as ElementObjet3d;
    expect(r.temps!.debut).toBe(2000);
    // À l'instant 4000 de la page, l'objet montre la même vue qu'avant.
    const avant = cameraA(el, 4000 - el.temps!.debut).azimut;
    const apres = cameraA(r, 4000 - r.temps!.debut).azimut;
    expect(((avant - apres) % 360 + 360) % 360).toBeCloseTo(0);
  });
});

describe("mouvement 3D : clés et calques d'export", () => {
  it("range des caméras dans les clés, les retire, change leur courbe", () => {
    const cles = clesAvecCameras([{ t: 0, x: 1, y: 2 }, { t: 1000, opacite: 0.5 }], [{ t: 20, camera: camera(5), courbe: "lineaire" }, { t: 3000, camera: camera(9) }])!;
    expect(cles.map((c) => [c.t, c.camera?.azimut ?? null, c.courbe ?? null])).toEqual([[0, 5, "lineaire"], [1000, null, null], [3000, 9, null]]);
    expect(clesSansCamera(cles)).toEqual([{ t: 0, x: 1, y: 2, courbe: "lineaire" }, { t: 1000, opacite: 0.5 }]);
    expect(clesSansCamera([{ t: 0, camera: camera(1) }])).toBeUndefined();
    expect(courbeDesCles(cles)).toBeNull();
    expect(courbeDesCles(clesAvecCourbe(cles, "lineaire"))).toBe("lineaire");
    expect(clesAvecCourbe(cles, "douce")!.some((c) => c.courbe)).toBe(false);
  });

  it("l'objet figé à un instant : sa vue et son animation de l'instant, sans plateau ni temps qui comptent", () => {
    const el = objet({ plateau: { tour: 8000, sens: "droite" }, animationModele: { nom: "M", vitesse: 1, boucle: true, debut: 0 } });
    const fige = objetFige(el, 3000);
    expect(fige.plateau).toBeUndefined();
    expect(fige.camera.azimut).toBeCloseTo(30 - 90);
    expect(fige.animationModele!.debut).toBe(2000);
    expect(objetFige(el).camera.azimut).toBe(30);
  });
});
