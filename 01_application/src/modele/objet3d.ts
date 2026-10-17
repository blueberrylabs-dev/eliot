// Les objets 3D (étape 6, lot 1) : la caméra et ses gestes, en calculs purs (sans three.js),
// pour la fenêtre, le pont et les essais. Le modèle est centré et ramené à une sphère de
// rayon 1 ; la caméra tourne autour du point visé (le centre, déplacé par le décalage), à une
// distance qui cadre toute la sphère quand le zoom vaut 1.

import type { Camera3d } from "./types";

export const CAMERA_PAR_DEFAUT: Camera3d = { azimut: 35, elevation: 18, zoom: 1, focale: 50 };

export const ELEVATION_MAX = 89;
export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 8;
/** La focale, en millimètres d'un appareil plein format : du grand angle au téléobjectif. */
export const FOCALE_MIN = 18;
export const FOCALE_MAX = 200;
/** La demi-hauteur du capteur plein format, en millimètres. */
const DEMI_CAPTEUR = 12;
/** Le décalage le plus grand, en rayons du modèle. */
export const DECALAGE_MAX = 3;
/** Degrés par pixel quand on tourne l'objet à la souris. */
export const DEGRES_PAR_PIXEL = 0.4;
/** Une marge autour du modèle cadré à zoom 1. */
const MARGE = 1.04;

/** Des vues toutes prêtes, à ajuster ensuite. */
export const VUES_PRETES: { id: string; nom: string; azimut: number; elevation: number }[] = [
  { id: "face", nom: "Face", azimut: 0, elevation: 0 },
  { id: "trois-quarts", nom: "Trois-quarts", azimut: 35, elevation: 18 },
  { id: "profil", nom: "Profil", azimut: 90, elevation: 0 },
  { id: "dos", nom: "Dos", azimut: 180, elevation: 0 },
  { id: "dessus", nom: "Dessus", azimut: 0, elevation: ELEVATION_MAX },
  { id: "contre-plongee", nom: "Contre-plongée", azimut: 25, elevation: -25 },
];

const borner = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const nombre = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const arrondir = (v: number, pas: number) => Math.round(v / pas) * pas || 0;

/** Un angle ramené dans ]-180, 180]. */
export function angleNormalise(a: number): number {
  const r = ((((a + 180) % 360) + 360) % 360) - 180;
  return r === -180 ? 180 : r;
}

/** Une caméra dans les règles : angles et zoom bornés, valeurs arrondies (le document reste
 *  lisible), décalage absent s'il est nul. */
export function normaliserCamera(c: unknown): Camera3d {
  const v = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
  const camera: Camera3d = {
    azimut: arrondir(angleNormalise(nombre(v.azimut, CAMERA_PAR_DEFAUT.azimut)), 0.01),
    elevation: arrondir(borner(nombre(v.elevation, CAMERA_PAR_DEFAUT.elevation), -ELEVATION_MAX, ELEVATION_MAX), 0.01),
    zoom: arrondir(borner(nombre(v.zoom, 1), ZOOM_MIN, ZOOM_MAX), 0.001),
    focale: arrondir(borner(nombre(v.focale, CAMERA_PAR_DEFAUT.focale), FOCALE_MIN, FOCALE_MAX), 1),
  };
  const d = Array.isArray(v.decalage) ? v.decalage : [];
  const decalage = [0, 1, 2].map((i) => arrondir(borner(nombre(d[i], 0), -DECALAGE_MAX, DECALAGE_MAX), 0.0001)) as [number, number, number];
  if (decalage.some((x) => x !== 0)) camera.decalage = decalage;
  return camera;
}

const RAD = Math.PI / 180;

/** L'angle de vue vertical d'une focale, en degrés (50 mm : 27°). */
export function angleDeVue(focale: number): number {
  return (2 * Math.atan(DEMI_CAPTEUR / focale)) / RAD;
}

/** Ce que three.js demande : la position de la caméra, le point visé, l'angle de vue vertical
 *  (degrés), pour une image de proportions `aspect` (largeur sur hauteur). La distance cadre la
 *  sphère de rayon 1 dans le plus étroit des deux angles de vue. */
export function placerCamera(c: Camera3d, aspect: number): { position: [number, number, number]; cible: [number, number, number]; fov: number; distance: number } {
  const fov = angleDeVue(c.focale);
  const demi = (fov * RAD) / 2;
  const demiH = Math.atan(Math.tan(demi) * Math.max(1e-3, aspect));
  const distance = (MARGE / Math.sin(Math.min(demi, demiH))) / c.zoom;
  const az = c.azimut * RAD;
  const el = c.elevation * RAD;
  const cible = c.decalage ?? [0, 0, 0];
  const dir = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
  return { position: [cible[0] + dir[0] * distance, cible[1] + dir[1] * distance, cible[2] + dir[2] * distance], cible: [...cible] as [number, number, number], fov, distance };
}

/** Tourner l'objet à la souris : glisser vers la droite le fait tourner vers la droite (la
 *  caméra part de l'autre côté), vers le bas le penche vers soi. */
export function tourner(c: Camera3d, dx: number, dy: number): Camera3d {
  return normaliserCamera({ ...c, azimut: c.azimut - dx * DEGRES_PAR_PIXEL, elevation: c.elevation + dy * DEGRES_PAR_PIXEL });
}

/** La molette : un cran rapproche de 10 % (facteur supérieur à 1), ou éloigne. */
export function zoomer(c: Camera3d, facteur: number): Camera3d {
  return normaliserCamera({ ...c, zoom: c.zoom * facteur });
}

/** Décaler (Maj et glisser) : l'objet suit la souris dans le plan de l'image. `dx`, `dy` en
 *  pixels d'une image de `hauteur` pixels et de proportions `aspect`. */
export function decaler(c: Camera3d, dx: number, dy: number, hauteur: number, aspect: number): Camera3d {
  const { distance } = placerCamera(c, aspect);
  const parPixel = (2 * distance * (DEMI_CAPTEUR / c.focale)) / Math.max(1, hauteur);
  const az = c.azimut * RAD;
  const el = c.elevation * RAD;
  // La droite et le haut de l'image, dans le repère du modèle.
  const droite = [Math.cos(az), 0, -Math.sin(az)];
  const haut = [-Math.sin(el) * Math.sin(az), Math.cos(el), -Math.sin(el) * Math.cos(az)];
  const d = c.decalage ?? [0, 0, 0];
  const nouveau = [0, 1, 2].map((i) => d[i] - droite[i] * dx * parPixel + haut[i] * dy * parPixel);
  return normaliserCamera({ ...c, decalage: nouveau });
}

/** Une vue prête : ses angles, le reste de la caméra gardé. */
export function vuePrete(c: Camera3d, id: string): Camera3d | null {
  const v = VUES_PRETES.find((x) => x.id === id);
  return v ? normaliserCamera({ ...c, azimut: v.azimut, elevation: v.elevation }) : null;
}

/** La taille du rendu d'un objet dans la fenêtre : sa boîte au zoom de la vue et à la densité
 *  de l'écran, par paliers (un petit changement de zoom ne refait pas le rendu), 2048 px au
 *  plus de grand côté. */
export function tailleDeRendu(largeur: number, hauteur: number, echelle: number, max = 2048): [number, number] {
  const voulu = Math.max(largeur, hauteur) * echelle;
  const palier = Math.min(max, Math.max(64, 64 * Math.ceil(voulu / 64)));
  const k = palier / Math.max(largeur, hauteur);
  return [Math.max(1, Math.round(largeur * k)), Math.max(1, Math.round(hauteur * k))];
}
