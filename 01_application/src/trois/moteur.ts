// Le moteur 3D de la fenêtre (étape 6) : three.js, en WebGL, une seule toile pour toute la page.
// Il charge les modèles (la copie préparée par le noyau : GLB, ou FBX et OBJ tels quels), les
// centre et les ramène à une sphère de rayon 1, puis dessine un objet quand sa caméra, sa taille
// ou son modèle changent ; chaque objet garde sa propre toile, que la page pose comme l'image
// d'une photo détourée (fond transparent). L'export lit cette toile, rendue à sa taille à lui.
//
// La lumière (lot 2) : un environnement qui éclaire et se reflète (quatre fournis, fabriqués ici,
// rien à télécharger), une lumière principale, l'exposition ; le tout tourne avec la vue autour
// de l'axe vertical, comme le studio d'un plateau tournant. L'ombre au sol est portée par la
// lumière principale sur un sol invisible. Les matières repeintes le sont le temps d'un rendu :
// un même modèle sert à plusieurs objets. Le rendu passe par le ton « neutre » de Khronos, fait
// pour montrer des produits sans changer leurs couleurs.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { useEditeur } from "../etat/editeur";
import { brillanceDeRugosite, CAMERA_PAR_DEFAUT, directionLumiere, ENVIRONNEMENTS, LUMIERE_PAR_DEFAUT, placerCamera, rotationEnvironnement, rugositeDeBrillance } from "../modele/objet3d";
import type { Camera3d, ElementObjet3d, Lumiere3d, Matiere3d, OmbreSol3d, PageEliot, RefProjet, Ressource } from "../modele/types";
import { enregistrerMiniatureModele, lireEnvironnement, lireModele } from "../pont/tauri";

/** Le plus grand côté d'un rendu (la fenêtre comme l'export). */
export const COTE_MAX_RENDU = 4096;

interface Moteur {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  principale: THREE.DirectionalLight;
  /** Le sol invisible qui reçoit l'ombre du modèle. */
  sol: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial>;
  pmrem: THREE.PMREMGenerator;
  environnements: Map<string, THREE.Texture>;
}

const RAD = Math.PI / 180;
/** La force de l'environnement et de la lumière principale quand leur réglage vaut 1. */
const FORCE_ENVIRONNEMENT = 0.9;
const FORCE_PRINCIPALE = 1.6;
/** L'ombre au sol s'efface entre ces deux distances du centre du modèle (rayon du modèle : 1). */
const FONDU_SOL = [0.9, 2.6];

/** Une sphère qui entoure la scène, teinte du zénith à l'horizon puis au sol (un ciel). */
function ciel(zenith: [number, number, number], horizon: [number, number, number], sol: [number, number, number]): THREE.Mesh {
  const g = new THREE.SphereGeometry(50, 64, 32);
  const couleurs: number[] = [];
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 50;
    const c = y >= 0 ? horizon.map((h, k) => h + (zenith[k] - h) * Math.pow(y, 0.6)) : horizon.map((h, k) => h + (sol[k] - h) * Math.min(1, -y * 6));
    couleurs.push(...c);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(couleurs, 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
}

/** Une source lumineuse de l'environnement : une surface de lumière `force` fois le blanc. */
function lumineux(geometrie: THREE.BufferGeometry, couleur: [number, number, number], force: number): THREE.Mesh {
  const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  m.color.setRGB(couleur[0] * force, couleur[1] * force, couleur[2] * force);
  return new THREE.Mesh(geometrie, m);
}

/** Un soleil : un disque lumineux dans la direction (azimut, élévation), en degrés. */
function soleil(azimut: number, elevation: number, couleur: [number, number, number], force: number, taille: number): THREE.Mesh {
  const s = lumineux(new THREE.SphereGeometry(taille, 16, 8), couleur, force);
  const a = azimut * RAD;
  const e = elevation * RAD;
  s.position.set(45 * Math.cos(e) * Math.sin(a), 45 * Math.sin(e), 45 * Math.cos(e) * Math.cos(a));
  return s;
}

/** La scène d'un environnement fourni, que le moteur réduit en éclairage (PMREM). +Z : du côté
 *  de la caméra, x positif : à droite de l'image. */
function sceneEnvironnement(id: string): THREE.Scene {
  if (id === "boites") {
    const s = new THREE.Scene();
    const piece = new THREE.Mesh(new THREE.BoxGeometry(24, 16, 24), new THREE.MeshBasicMaterial({ side: THREE.BackSide }));
    (piece.material as THREE.MeshBasicMaterial).color.setScalar(0.015);
    s.add(piece);
    const gauche = lumineux(new THREE.PlaneGeometry(5, 9), [1, 1, 1], 9);
    gauche.position.set(-7, 1.5, 2);
    gauche.lookAt(0, 0, 0);
    const droite = lumineux(new THREE.PlaneGeometry(4, 9), [1, 1, 1], 5);
    droite.position.set(7, 1.5, 1);
    droite.lookAt(0, 0, 0);
    const haut = lumineux(new THREE.PlaneGeometry(10, 2.5), [1, 1, 1], 3);
    haut.position.set(0, 7.5, -1);
    haut.lookAt(0, 0, 0);
    s.add(gauche, droite, haut);
    return s;
  }
  if (id === "plein-air") {
    const s = new THREE.Scene();
    s.add(ciel([0.12, 0.3, 0.85], [0.75, 0.85, 1.0], [0.28, 0.25, 0.2]), soleil(-35, 55, [1, 0.96, 0.9], 400, 1.6));
    return s;
  }
  if (id === "couchant") {
    const s = new THREE.Scene();
    s.add(ciel([0.12, 0.12, 0.32], [1.6, 0.62, 0.25], [0.12, 0.08, 0.06]), soleil(-55, 6, [1, 0.55, 0.22], 300, 2.2));
    return s;
  }
  return new RoomEnvironment();
}

// Les environnements HDRI du design (lot 3) : chargés à la première demande ; en attendant (ou
// s'ils manquent), le studio éclaire l'objet.
type EtatEnvironnement = { etat: "chargement"; promesse: Promise<void> } | { etat: "pret"; texture: THREE.Texture } | { etat: "erreur" };
const environnementsDuDesign = new Map<string, EtatEnvironnement>();
const abonnesEnvironnements = new Set<() => void>();

/** Prévenu quand un environnement du design est prêt (ou n'a pas pu l'être). */
export function abonnerEnvironnements(f: () => void): () => void {
  abonnesEnvironnements.add(f);
  return () => abonnesEnvironnements.delete(f);
}

const estFourni = (id: string) => ENVIRONNEMENTS.some((e) => e.id === id);

/** Charge un environnement HDRI du design (sa copie) et en fait un éclairage. */
function chargerEnvironnement(m: Moteur, id: string): Promise<void> {
  const deja = environnementsDuDesign.get(id);
  if (deja?.etat === "chargement") return deja.promesse;
  if (deja) return Promise.resolve();
  const etat = useEditeur.getState();
  const ressource = etat.ressources[id];
  const promesse = (async () => {
    try {
      if (!ressource?.environnement3d) throw new Error("environnement absent du design");
      const octets = await lireEnvironnement(etat.projet ?? { rayon: "designs", id: "" }, ressource);
      const url = URL.createObjectURL(new Blob([octets]));
      try {
        const texture = await new HDRLoader().loadAsync(url);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        const eclairage = m.pmrem.fromEquirectangular(texture).texture;
        texture.dispose();
        environnementsDuDesign.set(id, { etat: "pret", texture: eclairage });
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.warn(`3D : environnement « ${ressource?.nom ?? id} » illisible : ${e instanceof Error ? e.message : String(e)}`);
      environnementsDuDesign.set(id, { etat: "erreur" });
    }
    for (const f of abonnesEnvironnements) f();
  })();
  environnementsDuDesign.set(id, { etat: "chargement", promesse });
  return promesse;
}

/** Un environnement du design est-il prêt (pour la clé des rendus) ? */
function environnementPret(id: string): boolean {
  return estFourni(id) || environnementsDuDesign.get(id)?.etat !== "chargement";
}

/** L'éclairage d'un environnement : fourni (fabriqué à la première demande) ou du design
 *  (chargé à la première demande ; le studio en attendant). */
function environnement(m: Moteur, id: string): THREE.Texture {
  if (!estFourni(id)) {
    const e = environnementsDuDesign.get(id);
    if (e?.etat === "pret") return e.texture;
    if (!e) void chargerEnvironnement(m, id);
    return environnement(m, "studio");
  }
  let t = m.environnements.get(id);
  if (!t) {
    const scene = sceneEnvironnement(id);
    t = m.pmrem.fromScene(scene, id === "studio" ? 0.04 : 0.02).texture;
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      (mesh.material as THREE.Material | undefined)?.dispose?.();
    });
    m.environnements.set(id, t);
  }
  return t;
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
    // L'ombre au sol : une ombre douce (VSM), floutée selon la douceur demandée.
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const principale = new THREE.DirectionalLight(0xffffff, FORCE_PRINCIPALE);
    principale.shadow.mapSize.set(2048, 2048);
    const ombre = principale.shadow.camera;
    [ombre.left, ombre.right, ombre.top, ombre.bottom, ombre.near, ombre.far] = [-6, 6, 6, -6, 0.5, 30];
    principale.shadow.bias = -0.0005;
    scene.add(principale, principale.target);
    // Le sol s'efface en s'éloignant du modèle : l'ombre ne finit pas par une coupure nette.
    const matiereSol = new THREE.ShadowMaterial({ opacity: 0.45, transparent: true, depthWrite: false });
    matiereSol.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("void main() {", "varying vec3 vSolEliot;\nvoid main() {")
        .replace("#include <fog_vertex>", "#include <fog_vertex>\n\tvSolEliot = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", "varying vec3 vSolEliot;\nvoid main() {")
        .replace("#include <tonemapping_fragment>", `gl_FragColor.a *= 1.0 - smoothstep(${FONDU_SOL[0].toFixed(2)}, ${FONDU_SOL[1].toFixed(2)}, length(vSolEliot.xz));\n\t#include <tonemapping_fragment>`);
    };
    const sol = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), matiereSol);
    sol.rotation.x = -Math.PI / 2;
    sol.receiveShadow = true;
    sol.visible = false;
    scene.add(sol);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 200);
    moteur = { renderer, scene, camera, principale, sol, pmrem, environnements: new Map() };
  } catch (e) {
    console.warn(`3D : ${e instanceof Error ? e.message : String(e)}`);
    moteur = null;
  }
  return moteur;
}

// ----------------------------------------------------------------------------------------
// Les modèles
// ----------------------------------------------------------------------------------------

/** Ce que l'on montre d'une matière du modèle : sa couleur et sa brillance d'origine, si elle a
 *  une texture (que sa couleur teinte), si elle est métallique. */
export interface InfosMatiere {
  nom: string;
  couleur: string;
  brillance: number;
  texture: boolean;
  metal: boolean;
}

export interface Modele {
  /** Le modèle centré, ramené à une sphère de rayon 1. */
  racine: THREE.Group;
  animations: THREE.AnimationClip[];
  /** Les matières, par leur nom : celui du fichier, ou « Matière N » (N : son rang dans un
   *  glTF, comme le noyau, ou dans l'ordre où elles viennent). */
  matieres: string[];
  infosMatieres: InfosMatiere[];
  /** Les matières de three.js derrière chaque nom (une matière peut être copiée par le
   *  chargeur). */
  materiaux: Map<string, THREE.Material[]>;
  triangles: number;
  /** La hauteur du bas du modèle (le sol de l'ombre), dans le repère du modèle ramené. */
  bas: number;
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
    for (const e of environnementsDuDesign.values()) if (e.etat === "pret") e.texture.dispose();
    environnementsDuDesign.clear();
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
  let rangDansLeGltf: (mat: THREE.Material) => number | undefined = () => undefined;
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
    rangDansLeGltf = (mat) => gltf.parser.associations.get(mat)?.materials;
  }
  // Les noms des matières : une matière sans nom devient « Matière N ».
  const materiaux = new Map<string, THREE.Material[]>();
  const rangs = new Map<string, number>();
  let sansNom = 0;
  const nomDe = (mat: THREE.Material): string => {
    if (mat.name) return mat.name;
    const rang = rangDansLeGltf(mat);
    const nom = `Matière ${rang !== undefined ? rang + 1 : ++sansNom}`;
    mat.name = nom;
    return nom;
  };
  let triangles = 0;
  objet.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    // Le modèle porte l'ombre au sol ; lui-même n'en reçoit pas (pas de taches sur ses faces).
    m.castShadow = true;
    m.receiveShadow = false;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      const nom = nomDe(mat);
      if (!materiaux.has(nom)) {
        materiaux.set(nom, []);
        rangs.set(nom, rangDansLeGltf(mat) ?? 1e6 + rangs.size);
      }
      if (!materiaux.get(nom)!.includes(mat)) materiaux.get(nom)!.push(mat);
    }
    const g = m.geometry;
    triangles += Math.floor((g.index ? g.index.count : (g.attributes.position?.count ?? 0)) / 3);
  });
  const matieres = [...materiaux.keys()].sort((a, b) => rangs.get(a)! - rangs.get(b)!);
  const infosMatieres = matieres.map((nom): InfosMatiere => {
    const mat = materiaux.get(nom)![0] as THREE.MeshStandardMaterial;
    return {
      nom,
      couleur: mat.color ? `#${mat.color.getHexString(THREE.SRGBColorSpace)}` : "#ffffff",
      brillance: typeof mat.roughness === "number" ? brillanceDeRugosite(mat.roughness) : 0,
      texture: !!mat.map,
      metal: (mat.metalness ?? 0) > 0.5,
    };
  });
  const racine = normaliser(objet);
  const boite = new THREE.Box3().setFromObject(racine);
  return { racine, animations, matieres, infosMatieres, materiaux, triangles, bas: boite.isEmpty() ? -1 : boite.min.y };
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
  // Les environnements HDRI des objets de la page (lot 3).
  const m = moteur3d();
  if (!m) return;
  const ids = new Set(page.elements.flatMap((e) => (e.type === "objet3d" && e.lumiere && !estFourni(e.lumiere.environnement.id) ? [e.lumiere.environnement.id] : [])));
  await Promise.all([...ids].map((id) => chargerEnvironnement(m, id)));
}

// ----------------------------------------------------------------------------------------
// Le rendu
// ----------------------------------------------------------------------------------------

/** Ce qu'un rendu montre d'un objet : sa caméra (ou celle d'un geste), sa lumière, son ombre au
 *  sol, ses matières ; `surligne` : une matière désignée dans le panneau (survol). */
export interface Reglages3d {
  camera: Camera3d;
  lumiere: Lumiere3d;
  ombreSol?: OmbreSol3d;
  matieres?: Record<string, Matiere3d>;
  surligne?: string;
}

const ACCENT = new THREE.Color(0x4f46e5);

/** Repeint les matières le temps d'un rendu ; renvoie de quoi les remettre. */
function repeindre(modele: Modele, matieres: Record<string, Matiere3d> | undefined, surligne: string | undefined): () => void {
  const remises: (() => void)[] = [];
  const toucher = (nom: string, faire: (mat: THREE.MeshStandardMaterial) => void) => {
    for (const mat of (modele.materiaux.get(nom) ?? []) as THREE.MeshStandardMaterial[]) {
      const avant = { couleur: mat.color?.clone(), rugosite: mat.roughness, emissif: mat.emissive?.clone(), force: mat.emissiveIntensity };
      faire(mat);
      remises.push(() => {
        if (avant.couleur) mat.color.copy(avant.couleur);
        if (avant.rugosite !== undefined) mat.roughness = avant.rugosite;
        if (avant.emissif) mat.emissive.copy(avant.emissif);
        if (avant.force !== undefined) mat.emissiveIntensity = avant.force;
      });
    }
  };
  for (const [nom, r] of Object.entries(matieres ?? {})) {
    toucher(nom, (mat) => {
      if (r.couleur && mat.color) mat.color.set(r.couleur);
      if (r.brillance !== undefined && typeof mat.roughness === "number") mat.roughness = rugositeDeBrillance(r.brillance);
    });
  }
  if (surligne) {
    toucher(surligne, (mat) => {
      if (!mat.emissive) return;
      mat.emissive.copy(ACCENT);
      mat.emissiveIntensity = 0.85;
    });
  }
  return () => {
    for (const f of remises.reverse()) f();
  };
}

/** Dessine le modèle comme le disent `reglages` dans la toile du moteur, à `largeur` ×
 *  `hauteur` px. */
function dessiner(m: Moteur, modele: Modele, reglages: Reglages3d, largeur: number, hauteur: number): void {
  const { renderer, scene, principale, sol } = m;
  const { camera, lumiere } = reglages;
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
  // La lumière, tournée avec la vue.
  scene.environment = environnement(m, lumiere.environnement.id);
  scene.environmentIntensity = FORCE_ENVIRONNEMENT * lumiere.environnement.intensite;
  scene.environmentRotation.set(0, rotationEnvironnement(camera, lumiere) * RAD, 0);
  const d = directionLumiere(camera, lumiere);
  principale.position.set(d[0] * 12, d[1] * 12, d[2] * 12);
  principale.target.position.set(0, 0, 0);
  principale.intensity = FORCE_PRINCIPALE * lumiere.principale.intensite;
  principale.color.set(lumiere.principale.couleur);
  renderer.toneMappingExposure = Math.pow(2, lumiere.exposition);
  // L'ombre au sol : seulement d'une lumière qui vient d'en haut.
  const ombre = reglages.ombreSol && lumiere.principale.elevation > 2 && lumiere.principale.intensite > 0 ? reglages.ombreSol : undefined;
  principale.castShadow = !!ombre;
  sol.visible = !!ombre;
  if (ombre) {
    sol.position.y = modele.bas;
    sol.material.opacity = ombre.opacite;
    principale.shadow.radius = 1 + ombre.douceur * 32;
    principale.shadow.blurSamples = Math.round(8 + ombre.douceur * 16);
    principale.shadow.needsUpdate = true;
  }
  const remettre = repeindre(modele, reglages.matieres, reglages.surligne);
  scene.add(modele.racine);
  try {
    renderer.render(scene, m.camera);
  } finally {
    scene.remove(modele.racine);
    remettre();
  }
}

/** Les réglages de rendu d'un objet, sa caméra à part (celle d'un geste en cours). */
export function reglagesDe(el: ElementObjet3d, camera: Camera3d = el.camera, surligne?: string): Reglages3d {
  return { camera, lumiere: el.lumiere ?? LUMIERE_PAR_DEFAUT, ombreSol: el.ombreSol, matieres: el.matieres, surligne };
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
 * La toile d'un objet du modèle `ressource` rendu comme le disent `reglages` (sa caméra, ou
 * celle d'un geste en cours ; sa lumière, son ombre au sol, ses matières), à `largeur` ×
 * `hauteur` px : refaite seulement quand quelque chose a changé. `cle` distingue les rendus
 * (l'objet sur la page, hors écran pour l'export et les vignettes). `direct` (un geste en cours
 * sur cet objet) : la toile du moteur elle-même.
 */
export function rendreObjet(ressource: Ressource, reglages: Reglages3d, largeur: number, hauteur: number, cle: string, direct = false): EtatRendu {
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
  // Un environnement du design pas encore chargé : un rendu au studio, refait ensuite.
  const voulu = `${ressource.id}|${JSON.stringify(reglages)}|${l}x${h}|${environnementPret(reglages.lumiere.environnement.id) ? "" : "attente"}`;
  let r = rendus.get(cle);
  if (!r) {
    r = { toile: document.createElement("canvas"), cle: "" };
    rendus.set(cle, r);
  }
  if (direct) {
    if (dansLeMoteur !== `${cle}|${voulu}`) {
      if (enDirect !== cle) figerEnDirect(m);
      dessiner(m, etat.modele, reglages, l, h);
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
      dessiner(m, etat.modele, reglages, l, h);
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
  dessiner(m, modele, { camera: CAMERA_PAR_DEFAUT, lumiere: LUMIERE_PAR_DEFAUT }, 512, 512);
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
