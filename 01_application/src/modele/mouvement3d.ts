// Le mouvement d'un objet 3D sur une page vidéo (étape 6, lot 4), en calculs purs (sans
// three.js), pour la fenêtre, le pont et les essais :
// - le plateau tournant, qui fait tourner l'objet à vitesse régulière depuis le début du clip ;
// - la caméra des images clés (voir `cameraDesCles` dans `animation.ts`) ;
// - l'animation du modèle (celle d'un personnage de Mixamo, par exemple), sa vitesse, sa boucle.
// La caméra montrée à un instant est celle des images clés (ou de l'objet), le plateau ajouté à
// son azimut. Les gestes et les réglages changent la caméra de base, jamais le plateau.

import { cameraDesCles } from "./animation";
import { angleNormalise } from "./objet3d";
import type { AnimationModele3d, Camera3d, CleAnimation, ElementObjet3d, Plateau3d } from "./types";

/** Un tour en 8 s, vers la droite. */
export const PLATEAU_PAR_DEFAUT: Plateau3d = { tour: 8000, sens: "droite" };
/** Un tour en 2 s au plus vite, en 2 min au plus lent. */
export const TOUR_MIN = 2000;
export const TOUR_MAX = 120_000;
/** La vitesse d'une animation du modèle : d'un quart à quatre fois celle du fichier. */
export const VITESSE_MIN = 0.25;
export const VITESSE_MAX = 4;
/** L'instant de départ d'une animation : dix minutes au plus. */
const DEBUT_MAX = 600_000;

const borner = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const nombre = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** Un plateau dans les règles, ou `undefined` (pas de plateau). */
export function normaliserPlateau(p: unknown): Plateau3d | undefined {
  if (!p || typeof p !== "object") return undefined;
  const v = p as Record<string, unknown>;
  return { tour: Math.round(borner(nombre(v.tour, PLATEAU_PAR_DEFAUT.tour), TOUR_MIN, TOUR_MAX)), sens: v.sens === "gauche" ? "gauche" : "droite" };
}

/** Une animation du modèle dans les règles, ou `undefined` (aucune, ou sans nom). */
export function normaliserAnimationModele(a: unknown): AnimationModele3d | undefined {
  if (!a || typeof a !== "object") return undefined;
  const v = a as Record<string, unknown>;
  if (typeof v.nom !== "string" || !v.nom) return undefined;
  return {
    nom: v.nom,
    vitesse: Math.round(borner(nombre(v.vitesse, 1), VITESSE_MIN, VITESSE_MAX) * 100) / 100,
    boucle: v.boucle !== false,
    debut: Math.round(borner(nombre(v.debut, 0), 0, DEBUT_MAX)),
  };
}

/** Le temps du clip compté pour le mouvement : pas avant son début. */
const dansLeClip = (tr: number) => Math.max(0, tr);

/** Les degrés dont le plateau a tourné l'objet `tr` ms après le début de son clip (en plus de
 *  l'azimut) ; 0 sans plateau ou hors d'une page vidéo. Vers la droite, l'azimut diminue, comme
 *  sous la souris. */
export function anglePlateau(el: ElementObjet3d, tr: number): number {
  const t = dansLeClip(tr);
  if (!el.plateau || !el.temps || t === 0) return 0;
  const sens = el.plateau.sens === "gauche" ? 1 : -1;
  return (sens * 360 * t) / Math.max(1, el.plateau.tour);
}

/** La caméra de base de l'objet à `tr` ms du début de son clip : celle de ses images clés de
 *  caméra (page vidéo), sinon la sienne. C'est elle que les gestes et les réglages changent. */
export function cameraDeBase(el: ElementObjet3d, tr: number): Camera3d {
  return (el.temps ? cameraDesCles(el, dansLeClip(tr)) : undefined) ?? el.camera;
}

/** La caméra montrée à `tr` ms du début du clip : la caméra de base, le plateau ajouté. */
export function cameraA(el: ElementObjet3d, tr: number, base: Camera3d = cameraDeBase(el, tr)): Camera3d {
  const angle = anglePlateau(el, tr);
  return angle ? { ...base, azimut: base.azimut + angle } : base;
}

/** L'instant de l'animation du modèle (ms, avant la boucle) à `tr` ms du début du clip ; sur
 *  une image fixe, son instant de départ. */
export function instantAnimation(el: ElementObjet3d, tr: number): number {
  const a = el.animationModele;
  if (!a) return 0;
  return a.debut + (el.temps ? dansLeClip(tr) * a.vitesse : 0);
}

/** L'instant d'une animation de `duree` secondes à montrer, en secondes : en boucle, ramené
 *  dans la durée ; sinon arrêté à la dernière image. */
export function secondesAnimation(instantMs: number, duree: number, boucle: boolean): number {
  const t = instantMs / 1000;
  if (!(duree > 0)) return 0;
  if (boucle) return ((t % duree) + duree) % duree;
  return borner(t, 0, duree);
}

/** L'objet bouge-t-il avec le temps de la page (plateau, caméra des images clés, animation du
 *  modèle) ? */
export function aDuMouvement(el: ElementObjet3d): boolean {
  return !!el.temps && (!!el.plateau || !!el.animationModele || !!el.cles?.some((c) => c.camera));
}

/**
 * Le clip commence `delta` ms plus tard dans son mouvement (son début rogné, ou sa seconde
 * moitié après une coupe ; ses clés, elles, sont décalées à part) : le plateau et l'animation
 * repartent de là où ils en étaient, sans saut. Renvoie ce qui change.
 */
export function avancerMouvement(el: ElementObjet3d, delta: number): Partial<ElementObjet3d> {
  const sortie: Partial<ElementObjet3d> = {};
  const angle = el.plateau ? ((el.plateau.sens === "gauche" ? 1 : -1) * 360 * delta) / Math.max(1, el.plateau.tour) : 0;
  if (angle) {
    const tourner = (c: Camera3d): Camera3d => ({ ...c, azimut: Math.round(angleNormalise(c.azimut + angle) * 100) / 100 });
    sortie.camera = tourner(el.camera);
    if (el.cles?.some((c) => c.camera)) sortie.cles = el.cles.map((c) => (c.camera ? { ...c, camera: tourner(c.camera) } : c));
  }
  if (el.animationModele && delta) sortie.animationModele = { ...el.animationModele, debut: Math.max(0, Math.round(el.animationModele.debut + delta * el.animationModele.vitesse)) };
  return sortie;
}

/** Les clés sans leur caméra (celles qui ne gardaient qu'elle partent) ; `undefined` s'il n'en
 *  reste aucune. */
export function clesSansCamera(cles: CleAnimation[] | undefined): CleAnimation[] | undefined {
  const reste = (cles ?? []).flatMap((c) => {
    const { camera: _c, ...sans } = c;
    return Object.keys(sans).some((k) => k !== "t" && k !== "courbe") ? [sans] : [];
  });
  return reste.length ? reste : undefined;
}

/** La courbe commune des clés (« douce » par défaut), ou `null` si elles en mélangent deux. */
export function courbeDesCles(cles: CleAnimation[] | undefined): "douce" | "lineaire" | null {
  const courbes = new Set((cles ?? []).map((c) => c.courbe ?? "douce"));
  return courbes.size === 1 ? [...courbes][0] : courbes.size === 0 ? "douce" : null;
}

/** Les clés, toutes avec la courbe voulue (« douce », celle par défaut, n'est pas écrite). */
export function clesAvecCourbe(cles: CleAnimation[] | undefined, courbe: "douce" | "lineaire"): CleAnimation[] | undefined {
  return cles?.map((c) => {
    const { courbe: _c, ...sans } = c;
    return courbe === "lineaire" ? { ...sans, courbe } : sans;
  });
}

/** Une caméra posée à `t` ms du début du clip (une image clé de caméra). */
export interface CleCamera {
  t: number;
  camera: Camera3d;
  courbe?: "douce" | "lineaire";
}

/** Range des caméras dans les clés : celle d'une clé au même instant (à 40 ms près) prend la
 *  caméra (et la courbe, si elle est donnée), sinon une clé neuve n'a que la caméra. Triées. */
export function clesAvecCameras(cles: CleAnimation[] | undefined, cameras: CleCamera[], tolerance = 40): CleAnimation[] | undefined {
  const sortie = (cles ?? []).map((c) => ({ ...c }));
  for (const k of cameras) {
    const proche = sortie.reduce<CleAnimation | undefined>((m, c) => (Math.abs(c.t - k.t) <= tolerance && (!m || Math.abs(c.t - k.t) < Math.abs(m.t - k.t)) ? c : m), undefined);
    if (proche) {
      proche.camera = k.camera;
      if (k.courbe) proche.courbe = k.courbe;
    } else sortie.push({ t: Math.round(k.t), camera: k.camera, ...(k.courbe ? { courbe: k.courbe } : {}) });
  }
  sortie.sort((a, b) => a.t - b.t);
  return sortie.length ? sortie : undefined;
}

/** Les caméras des clés, telles quelles (pour les garder quand les autres clés changent). */
export const camerasDesCles = (cles: CleAnimation[] | undefined): CleCamera[] => (cles ?? []).flatMap((c) => (c.camera ? [{ t: c.t, camera: c.camera }] : []));

/** L'objet tel qu'il se montre à l'instant `t` de la page (le début de son clip par défaut),
 *  sans mouvement : sa vue de l'instant (images clés et plateau compris) et l'instant de son
 *  animation. C'est le calque d'un export en image ; un film le rendra image par image. */
export function objetFige(el: ElementObjet3d, t = el.temps?.debut ?? 0): ElementObjet3d {
  const tr = el.temps ? t - el.temps.debut : 0;
  const { plateau: _p, ...sans } = el;
  const animation = el.animationModele ? { animationModele: { ...el.animationModele, debut: Math.round(instantAnimation(el, tr)) } } : {};
  return { ...sans, camera: cameraA(el, tr), ...animation };
}
