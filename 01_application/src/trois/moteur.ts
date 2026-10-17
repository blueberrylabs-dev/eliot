// Le moteur 3D de la fenêtre (étape 6) : three.js, en WebGL, une seule toile pour toute la page.
// Il charge les modèles (la copie préparée par le noyau : GLB, ou FBX et OBJ tels quels), les
// centre et les ramène à une sphère de rayon 1, puis dessine un objet quand sa caméra, sa taille
// ou son modèle changent ; chaque objet garde sa propre toile, que la page pose comme l'image
// d'une photo détourée (fond transparent). L'export lit cette toile, rendue à sa taille à lui.
//
// La lumière du lot 1 : un studio neutre (l'environnement « RoomEnvironment » de three.js, rien à
// télécharger) et une lumière principale venue du haut, à gauche. Le rendu passe par le ton
// « neutre » de Khronos, fait pour montrer des produits sans changer leurs couleurs.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { useEditeur } from "../etat/editeur";
import { CAMERA_PAR_DEFAUT, placerCamera } from "../modele/objet3d";
import type { Camera3d, ElementObjet3d, PageEliot, RefProjet, Ressource } from "../modele/types";
import { enregistrerMiniatureModele, lireModele } from "../pont/tauri";

/** Le plus grand côté d'un rendu (la fenêtre comme l'export). */
export const COTE_MAX_RENDU = 4096;

interface Moteur {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

let moteur: Moteur | null | undefined;

/** Le moteur, créé à la première demande ; `null` si le moteur web n'a pas WebGL 2. */
export function moteur3d(): Moteur | null {
  if (moteur !== undefined) return moteur;
  try {
    const toile = document.createElement("canvas");
    const gl = toile.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL 2 indisponible dans ce moteur web");
    const renderer = new THREE.WebGLRenderer({ canvas: toile, context: gl, alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environmentIntensity = 0.9;
    const principale = new THREE.DirectionalLight(0xffffff, 1.6);
    principale.position.set(-2.5, 4, 3);
    scene.add(principale);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 200);
    moteur = { renderer, scene, camera };
  } catch (e) {
    console.warn(`3D : ${e instanceof Error ? e.message : String(e)}`);
    moteur = null;
  }
  return moteur;
}

// ----------------------------------------------------------------------------------------
// Les modèles
// ----------------------------------------------------------------------------------------

export interface Modele {
  /** Le modèle centré, ramené à une sphère de rayon 1. */
  racine: THREE.Group;
  animations: THREE.AnimationClip[];
  matieres: string[];
  triangles: number;
}

type EtatModele = { etat: "chargement"; promesse: Promise<Modele> } | { etat: "pret"; modele: Modele } | { etat: "erreur"; erreur: string };

const modeles = new Map<string, EtatModele>();
const abonnes = new Map<string, Set<() => void>>();

function prevenir(cle: string): void {
  for (const f of abonnes.get(cle) ?? []) f();
}

/** Prévenu quand le modèle `ressource` est chargé (ou a échoué). */
export function abonnerModele(ressource: string, f: () => void): () => void {
  if (!abonnes.has(ressource)) abonnes.set(ressource, new Set());
  abonnes.get(ressource)!.add(f);
  return () => abonnes.get(ressource)?.delete(f);
}

// Un autre design : les modèles du précédent ne servent plus.
useEditeur.subscribe((s, avant) => {
  if (s.projet !== avant.projet) {
    for (const m of modeles.values()) if (m.etat === "pret") liberer(m.modele.racine);
    modeles.clear();
    rendus.clear();
    enDirect = null;
    dansLeMoteur = "";
  }
});

function liberer(objet: THREE.Object3D): void {
  objet.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
      mat.dispose();
    }
  });
}

/** Un FBX ou un OBJ arrive avec des matières qui ignorent l'éclairage de studio : elles
 *  deviennent des matières standard (couleur, texture et transparence gardées). */
function matieresStandard(racine: THREE.Object3D): void {
  racine.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const convertir = (mat: THREE.Material): THREE.Material => {
      if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) return mat;
      const ancienne = mat as THREE.MeshPhongMaterial;
      const neuve = new THREE.MeshStandardMaterial({
        name: ancienne.name,
        color: ancienne.color ?? new THREE.Color(0xbdbdbd),
        map: ancienne.map ?? null,
        normalMap: ancienne.normalMap ?? null,
        transparent: ancienne.transparent,
        opacity: ancienne.opacity,
        side: ancienne.side,
        roughness: 0.55,
        metalness: 0,
      });
      if (neuve.map) neuve.map.colorSpace = THREE.SRGBColorSpace;
      mat.dispose();
      return neuve;
    };
    m.material = Array.isArray(m.material) ? m.material.map(convertir) : convertir(m.material);
  });
}

/** Le modèle centré dans un groupe, ramené à une sphère de rayon 1. */
function normaliser(objet: THREE.Object3D): THREE.Group {
  objet.updateMatrixWorld(true);
  const boite = new THREE.Box3().setFromObject(objet);
  const pivot = new THREE.Group();
  if (boite.isEmpty()) {
    pivot.add(objet);
    return pivot;
  }
  const centre = boite.getCenter(new THREE.Vector3());
  const rayon = Math.max(1e-6, boite.getSize(new THREE.Vector3()).length() / 2);
  objet.position.sub(centre);
  pivot.add(objet);
  pivot.scale.setScalar(1 / rayon);
  pivot.updateMatrixWorld(true);
  return pivot;
}

async function analyser(ressource: Ressource, octets: ArrayBuffer): Promise<Modele> {
  const format = ressource.modele3d?.format ?? "glb";
  let objet: THREE.Object3D;
  let animations: THREE.AnimationClip[] = [];
  if (format === "fbx") {
    objet = new FBXLoader().parse(octets, "");
    animations = objet.animations ?? [];
    matieresStandard(objet);
  } else if (format === "obj") {
    objet = new OBJLoader().parse(new TextDecoder().decode(octets));
    matieresStandard(objet);
  } else {
    const gltf = await new GLTFLoader().parseAsync(octets, "");
    objet = gltf.scene;
    animations = gltf.animations;
  }
  const matieres: string[] = [];
  let triangles = 0;
  objet.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) if (mat.name && !matieres.includes(mat.name)) matieres.push(mat.name);
    const g = m.geometry;
    triangles += Math.floor((g.index ? g.index.count : (g.attributes.position?.count ?? 0)) / 3);
  });
  return { racine: normaliser(objet), animations, matieres, triangles };
}

/** Le modèle `ressource` s'il est déjà chargé. */
export function modeleCharge(ressource: string): Modele | undefined {
  const m = modeles.get(ressource);
  return m?.etat === "pret" ? m.modele : undefined;
}

/** Le modèle `ressource`, chargé une fois par design. */
export function chargerModele(ressource: Ressource, projet: RefProjet | null = useEditeur.getState().projet): Promise<Modele> {
  const deja = modeles.get(ressource.id);
  if (deja?.etat === "pret") return Promise.resolve(deja.modele);
  if (deja?.etat === "chargement") return deja.promesse;
  if (deja?.etat === "erreur") return Promise.reject(new Error(deja.erreur));
  const promesse = lireModele(projet ?? { rayon: "designs", id: "" }, ressource).then((octets) => analyser(ressource, octets));
  modeles.set(ressource.id, { etat: "chargement", promesse });
  promesse.then(
    (modele) => {
      if (modeles.get(ressource.id)?.etat !== "chargement") return;
      modeles.set(ressource.id, { etat: "pret", modele });
      prevenir(ressource.id);
    },
    (e) => {
      const erreur = e instanceof Error ? e.message : String(e);
      console.warn(`3D : « ${ressource.nom} » illisible : ${erreur}`);
      modeles.set(ressource.id, { etat: "erreur", erreur });
      prevenir(ressource.id);
    },
  );
  return promesse;
}

/** Charge les modèles d'une page avant un rendu hors écran (export, vignette). */
export async function prechargerModeles(page: PageEliot): Promise<void> {
  const { ressources } = useEditeur.getState();
  await Promise.all(page.elements.flatMap((e) => (e.type === "objet3d" && ressources[e.ressource] ? [chargerModele(ressources[e.ressource]).catch(() => undefined)] : [])));
}

// ----------------------------------------------------------------------------------------
// Le rendu
// ----------------------------------------------------------------------------------------

/** Dessine le modèle vu par `camera` dans la toile du moteur, à `largeur` × `hauteur` px. */
function dessiner(m: Moteur, modele: Modele, camera: Camera3d, largeur: number, hauteur: number): void {
  const { renderer, scene } = m;
  renderer.setSize(largeur, hauteur, false);
  const p = placerCamera(camera, largeur / hauteur);
  m.camera.fov = p.fov;
  m.camera.aspect = largeur / hauteur;
  m.camera.near = Math.max(0.005, p.distance - 4);
  m.camera.far = p.distance + 4;
  m.camera.position.set(...p.position);
  m.camera.up.set(0, 1, 0);
  m.camera.lookAt(...p.cible);
  m.camera.updateProjectionMatrix();
  scene.add(modele.racine);
  renderer.render(scene, m.camera);
  scene.remove(modele.racine);
}

interface Rendu {
  toile: HTMLCanvasElement;
  /** Ce que la toile montre (modèle, caméra, taille). */
  cle: string;
}

/** La toile de chaque objet, par élément (ou par clé de rendu hors écran). */
const rendus = new Map<string, Rendu>();

/** Ce que la toile du moteur montre : `clé du rendu|ce qui est dessiné`. */
let dansLeMoteur = "";
/** L'objet que l'on tourne : la page affiche directement la toile du moteur, sans la recopier à
 *  chaque image (règle 11, comme le labo) ; sa propre toile la reçoit quand le moteur sert à
 *  autre chose, ou à la fin du geste. */
let enDirect: string | null = null;

function recopier(r: Rendu, m: Moteur, voulu: string): void {
  const source = m.renderer.domElement;
  if (r.toile.width !== source.width || r.toile.height !== source.height) {
    r.toile.width = source.width;
    r.toile.height = source.height;
  }
  const ctx = r.toile.getContext("2d")!;
  ctx.clearRect(0, 0, r.toile.width, r.toile.height);
  ctx.drawImage(source, 0, 0);
  r.cle = voulu;
}

/** Le moteur va dessiner autre chose : l'objet affiché en direct reçoit d'abord sa toile, et sa
 *  page est prévenue (après coup : on est souvent dans le rendu d'un autre composant). */
function figerEnDirect(m: Moteur): void {
  if (!enDirect) return;
  const cle = enDirect;
  enDirect = null;
  const r = rendus.get(cle);
  if (r && dansLeMoteur.startsWith(`${cle}|`)) recopier(r, m, dansLeMoteur.slice(cle.length + 1));
  queueMicrotask(() => {
    for (const f of abonnesRendu.get(cle) ?? []) f();
  });
}

const abonnesRendu = new Map<string, Set<() => void>>();

/** Prévenu quand la toile du rendu `cle` doit être reprise (le moteur a servi à autre chose
 *  pendant qu'elle s'affichait en direct). */
export function abonnerRendu(cle: string, f: () => void): () => void {
  if (!abonnesRendu.has(cle)) abonnesRendu.set(cle, new Set());
  abonnesRendu.get(cle)!.add(f);
  return () => abonnesRendu.get(cle)?.delete(f);
}

export type EtatRendu = { etat: "chargement" } | { etat: "erreur"; erreur: string } | { etat: "pret"; toile: HTMLCanvasElement };

/**
 * La toile de l'objet `el` vu par `camera` (la sienne, ou celle d'un geste en cours), rendue à
 * `largeur` × `hauteur` px : refaite seulement quand quelque chose a changé. `cle` distingue
 * les rendus d'un même objet (la page, l'export, une vignette). `direct` (un geste en cours sur
 * cet objet) : la toile du moteur elle-même.
 */
export function rendreObjet(el: ElementObjet3d, ressource: Ressource, camera: Camera3d, largeur: number, hauteur: number, cle = el.id, direct = false): EtatRendu {
  const etat = modeles.get(ressource.id);
  if (!etat || etat.etat === "chargement") {
    if (!etat) void chargerModele(ressource).catch(() => undefined);
    return { etat: "chargement" };
  }
  if (etat.etat === "erreur") return etat;
  const m = moteur3d();
  if (!m) return { etat: "erreur", erreur: "WebGL 2 indisponible" };
  const l = Math.max(1, Math.min(COTE_MAX_RENDU, Math.round(largeur)));
  const h = Math.max(1, Math.min(COTE_MAX_RENDU, Math.round(hauteur)));
  const voulu = `${ressource.id}|${JSON.stringify(camera)}|${l}x${h}`;
  let r = rendus.get(cle);
  if (!r) {
    r = { toile: document.createElement("canvas"), cle: "" };
    rendus.set(cle, r);
  }
  if (direct) {
    if (dansLeMoteur !== `${cle}|${voulu}`) {
      if (enDirect !== cle) figerEnDirect(m);
      dessiner(m, etat.modele, camera, l, h);
      dansLeMoteur = `${cle}|${voulu}`;
    }
    enDirect = cle;
    return { etat: "pret", toile: m.renderer.domElement };
  }
  if (enDirect === cle) {
    // Fin du geste : la toile de l'objet reçoit le dernier rendu.
    enDirect = null;
    if (dansLeMoteur === `${cle}|${voulu}`) recopier(r, m, voulu);
  }
  if (r.cle !== voulu) {
    if (dansLeMoteur !== `${cle}|${voulu}`) {
      // Le moteur sert à autre chose : l'objet affiché en direct reçoit d'abord sa toile.
      figerEnDirect(m);
      dessiner(m, etat.modele, camera, l, h);
      dansLeMoteur = `${cle}|${voulu}`;
    }
    recopier(r, m, voulu);
  }
  return { etat: "pret", toile: r.toile };
}

/** Oublie la toile d'un rendu hors écran. */
export function oublierRendu(cle: string): void {
  rendus.delete(cle);
}

// ----------------------------------------------------------------------------------------
// Rendu hors écran : l'export, à sa finesse
// ----------------------------------------------------------------------------------------

let finesseStatique = 1;

/** La finesse des rendus hors écran (pixels de rendu par pixel de la page) : 1 pour une vignette,
 *  l'échelle de l'export pour une image, 2 pour un PDF ou un SVG. */
export function finesseHorsEcran(): number {
  return finesseStatique;
}

/** Fait `travail` avec une finesse donnée pour les rendus hors écran. */
export async function avecFinesse<T>(finesse: number, travail: () => Promise<T>): Promise<T> {
  const avant = finesseStatique;
  finesseStatique = Math.max(0.25, Math.min(8, finesse));
  try {
    return await travail();
  } finally {
    finesseStatique = avant;
  }
}

// ----------------------------------------------------------------------------------------
// Les miniatures des modèles importés
// ----------------------------------------------------------------------------------------

/** Rend la miniature d'un modèle : 512 px, vu de trois quarts, fond transparent, en PNG. */
export async function rendreMiniature(ressource: Ressource, projet?: RefProjet | null): Promise<Uint8Array> {
  const modele = await chargerModele(ressource, projet ?? useEditeur.getState().projet);
  const m = moteur3d();
  if (!m) throw new Error("WebGL 2 indisponible");
  figerEnDirect(m);
  dessiner(m, modele, CAMERA_PAR_DEFAUT, 512, 512);
  dansLeMoteur = `miniature|${ressource.id}`;
  const blob = await new Promise<Blob | null>((ok) => m.renderer.domElement.toBlob(ok, "image/png"));
  if (!blob) throw new Error("miniature impossible");
  return new Uint8Array(await blob.arrayBuffer());
}

const miniaturesEnCours = new Set<string>();

/** Les modèles du design qui n'ont pas encore de miniature en reçoivent une, rendue ici et
 *  rangée par le noyau. */
async function assurerMiniatures(): Promise<void> {
  const etat = useEditeur.getState();
  const projet = etat.projet;
  if (!projet) return;
  for (const r of Object.values(etat.ressources)) {
    if (!r.modele3d || r.modele3d.miniature || miniaturesEnCours.has(r.id)) continue;
    miniaturesEnCours.add(r.id);
    try {
      const png = await rendreMiniature(r, projet);
      if (useEditeur.getState().projet !== projet) return;
      const apres = await enregistrerMiniatureModele(projet, r, png);
      useEditeur.getState().ajouterRessources([apres]);
    } catch (e) {
      console.warn(`3D : miniature de « ${r.nom} » impossible : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      miniaturesEnCours.delete(r.id);
    }
  }
}

useEditeur.subscribe((s, avant) => {
  if (s.ressources !== avant.ressources && Object.values(s.ressources).some((r) => r.modele3d && !r.modele3d.miniature)) void assurerMiniatures();
});
