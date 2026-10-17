// Les banques 3D (étape 6, lot 3) : Kenney (paquets rangés à la main, lus par `npm run
// bibliotheque`), Poly Haven (modèles et environnements HDRI) et Sketchfab (par le Rust, qui seul
// connaît la clé). Ici : l'onglet ouvert, les mots français traduits pour des banques qui
// cherchent en anglais, et ce que l'onglet 3D et le pont IA font d'un résultat (le télécharger,
// le ranger dans le design avec son crédit, le poser ou en éclairer les objets choisis).

import { create } from "zustand";
import { elementsCourants, useEditeur } from "../etat/editeur";
import { creerObjet3d } from "../modele/fabriques";
import type { Credit, ElementObjet3d, Ressource } from "../modele/types";
import { importerEnvironnementPolyHaven, importerModeleAvecCredit, importerModelePolyHaven, importerSketchfab } from "../pont/tauri";
import { useSuiviImport } from "../editeur/SuiviImport";
import { poserLumiere } from "./orbite";

export type SourceModeles = "kenney" | "polyhaven" | "sketchfab" | "mixamo";
export type OngletBanques = "modeles" | "environnements";

interface EtatBanques {
  onglet: OngletBanques;
  source: SourceModeles;
  /** Augmente à chaque demande d'ouvrir l'onglet 3D du rail (depuis la section Lumière). */
  demande: number;
}

export const useBanques = create<EtatBanques>(() => ({ onglet: "modeles", source: "kenney", demande: 0 }));

/** Ouvre l'onglet 3D du rail sur ses modèles ou ses environnements. */
export function ouvrirBanques(onglet: OngletBanques): void {
  useBanques.setState((s) => ({ onglet, demande: s.demande + 1 }));
}

// ----------------------------------------------------------------------------------------
// Chercher en français dans des banques qui parlent anglais
// ----------------------------------------------------------------------------------------

/** Les mots les plus courants d'une publicité de produit, en anglais. */
const LEXIQUE: Record<string, string> = {
  bouteille: "bottle",
  flacon: "bottle",
  pot: "jar",
  bocal: "jar",
  boite: "box",
  carton: "box",
  caisse: "crate",
  tonneau: "barrel",
  sac: "bag",
  chaussure: "shoe",
  basket: "sneaker",
  montre: "watch",
  lunettes: "glasses",
  chaise: "chair",
  fauteuil: "armchair",
  canape: "sofa",
  table: "table",
  bureau: "desk",
  lampe: "lamp",
  etagere: "shelf",
  lit: "bed",
  plante: "plant",
  fleur: "flower",
  arbre: "tree",
  pierre: "rock",
  rocher: "rock",
  bois: "wood",
  metal: "metal",
  verre: "glass",
  tasse: "mug",
  mug: "mug",
  assiette: "plate",
  bol: "bowl",
  cafe: "coffee",
  the: "tea",
  pomme: "apple",
  fruit: "fruit",
  legume: "vegetable",
  pain: "bread",
  gateau: "cake",
  telephone: "phone",
  ordinateur: "computer",
  ecran: "screen",
  appareil: "camera",
  casque: "headphones",
  voiture: "car",
  velo: "bicycle",
  livre: "book",
  jouet: "toy",
  personnage: "character",
  robot: "robot",
  animal: "animal",
  chien: "dog",
  chat: "cat",
  oiseau: "bird",
  maison: "house",
  ville: "city",
  rue: "street",
  ciel: "sky",
  nuit: "night",
  plage: "beach",
  foret: "forest",
  montagne: "mountain",
  neige: "snow",
  interieur: "indoor",
  exterieur: "outdoor",
  piece: "room",
  cuisine: "kitchen",
  salon: "living room",
  coucher: "sunset",
  lever: "sunrise",
  soleil: "sun",
  nuage: "cloud",
  nuageux: "cloudy",
  usine: "industrial",
  parfum: "perfume",
  cosmetique: "cosmetic",
  creme: "cream",
  savon: "soap",
  fromage: "cheese",
  banane: "banana",
  citron: "lemon",
  fraise: "strawberry",
  cerise: "cherry",
  poire: "pear",
  ananas: "pineapple",
  avocat: "avocado",
  pasteque: "watermelon",
  carotte: "carrot",
  tomate: "tomato",
  champignon: "mushroom",
  oeuf: "egg",
  poisson: "fish",
  viande: "meat",
  frites: "fries",
  biscuit: "cookie",
  chocolat: "chocolate",
  bonbon: "candy",
  boisson: "drink",
  vin: "wine",
  biere: "beer",
  jus: "juice",
  lait: "milk",
};

const simple = (t: string) => t.toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[̀-ͯ]/g, "");

/** La requête avec ses mots français connus remplacés par leur équivalent anglais (les autres
 *  restent tels quels) : « flacon de parfum » devient « bottle de perfume », puis les petits mots
 *  partent. */
export function traduireRequete(requete: string): string {
  const mots = simple(requete)
    .split(/[\s,;]+/)
    .filter((m) => m.length > 1 && !["de", "du", "des", "la", "le", "les", "un", "une", "et", "en", "au", "aux", "pour"].includes(m));
  return mots.map((m) => LEXIQUE[m] ?? LEXIQUE[m.replace(/s$/, "")] ?? m).join(" ");
}

/** Le nom français des catégories de Poly Haven qu'on montre. */
export const CATEGORIES_FR: Record<string, string> = {
  props: "Accessoires",
  furniture: "Mobilier",
  seating: "Sièges",
  table: "Tables",
  decorative: "Décoration",
  containers: "Contenants",
  industrial: "Industriel",
  tools: "Outils",
  nature: "Nature",
  plants: "Plantes",
  rocks: "Rochers",
  food: "Nourriture",
  electronics: "Électronique",
  lighting: "Luminaires",
  appliances: "Électroménager",
  dishes: "Vaisselle",
  office: "Bureau",
  vases: "Vases",
  buildings: "Bâtiments",
  trees: "Arbres",
  flowers: "Fleurs",
  shelves: "Étagères",
  "wall decoration": "Décoration murale",
  rigged: "Articulés",
  outdoor: "Extérieur",
  indoor: "Intérieur",
  studio: "Studio",
  skies: "Ciels",
  "pure skies": "Ciels seuls",
  urban: "Ville",
  night: "Nuit",
  "sunrise-sunset": "Aube et couchant",
  midday: "Midi",
  overcast: "Couvert",
  clear: "Dégagé",
  "natural light": "Lumière naturelle",
  "artificial light": "Lumière artificielle",
  "low contrast": "Doux",
  "high contrast": "Contrasté",
};

// ----------------------------------------------------------------------------------------
// Kenney : le catalogue fabriqué par `npm run bibliotheque`
// ----------------------------------------------------------------------------------------

export interface PaquetKenney {
  id: string;
  nom: string;
  licence: string;
  lien: string;
  modeles: { id: string; nom: string; apercu: boolean }[];
}

const BASE_KENNEY = "/bibliotheque/kenney";
let catalogue: Promise<PaquetKenney[]> | null = null;

/** Les paquets de Kenney rangés sur le poste (vide si aucun). */
export function catalogueKenney(): Promise<PaquetKenney[]> {
  if (!catalogue) {
    catalogue = fetch(`${BASE_KENNEY}/catalogue.json`)
      .then((r) => (r.ok ? r.json() : { paquets: [] }))
      .then((c: { paquets?: PaquetKenney[] }) => c.paquets ?? [])
      .catch(() => []);
  }
  return catalogue;
}

export const apercuKenney = (paquet: string, modele: string) => `${BASE_KENNEY}/${encodeURIComponent(paquet)}/${encodeURIComponent(modele)}.png`;

// ----------------------------------------------------------------------------------------
// Ranger dans le design, poser, éclairer
// ----------------------------------------------------------------------------------------

/** Télécharge (ou lit) un modèle d'une banque et le range dans le design ouvert, avec son
 *  crédit ; la bande d'avancement le montre. */
export async function ranger(source: Exclude<SourceModeles, "mixamo">, id: string, paquet?: string): Promise<Ressource> {
  const projet = useEditeur.getState().projet;
  if (!projet) throw new Error("aucun design ouvert");
  const suivi = useSuiviImport.getState();
  try {
    let ressource: Ressource;
    if (source === "kenney") {
      const p = (await catalogueKenney()).find((x) => x.id === paquet);
      const m = p?.modeles.find((x) => x.id === id);
      if (!p || !m) throw new Error(`modèle de Kenney inconnu : ${paquet ?? "?"}/${id}`);
      suivi.montrer("Modèle de Kenney", 0.3);
      const reponse = await fetch(`${BASE_KENNEY}/${encodeURIComponent(p.id)}/${encodeURIComponent(m.id)}.glb`);
      if (!reponse.ok) throw new Error("fichier introuvable : relancer npm run bibliotheque");
      const credit: Credit = { source: "Kenney", auteur: "Kenney", lien: p.lien, licence: p.licence, titre: `${m.nom} (${p.nom})` };
      ressource = await importerModeleAvecCredit(projet, await reponse.arrayBuffer(), `${m.nom}.glb`, credit);
    } else if (source === "polyhaven") {
      ressource = await importerModelePolyHaven(projet, id, (part) => suivi.montrer(part < 0.75 ? "Téléchargement depuis Poly Haven" : "Préparation du modèle", part));
    } else {
      ressource = await importerSketchfab(projet, id, (part) => suivi.montrer(part < 0.75 ? "Téléchargement depuis Sketchfab" : "Préparation du modèle", part));
    }
    if (useEditeur.getState().projet !== projet) throw new Error("le design a changé pendant le téléchargement");
    useEditeur.getState().ajouterRessources([ressource]);
    return ressource;
  } finally {
    suivi.finir();
  }
}

/** Range un modèle d'une banque et le pose au centre de la page ; l'objet posé. */
export async function poserModele(source: Exclude<SourceModeles, "mixamo">, id: string, paquet?: string): Promise<ElementObjet3d> {
  const r = await ranger(source, id, paquet);
  const etat = useEditeur.getState();
  const el = creerObjet3d(etat.document.format, r);
  etat.ajouterElements([el]);
  return (elementsCourants(useEditeur.getState()).find((e) => e.id === el.id) as ElementObjet3d | undefined) ?? el;
}

/** Les environnements de Poly Haven déjà rangés dans ce design, par leur identifiant. */
function environnementDejaLa(id: string): Ressource | undefined {
  const lien = `https://polyhaven.com/a/${id}`;
  return Object.values(useEditeur.getState().ressources).find((r) => r.environnement3d && r.credit?.source === "Poly Haven" && r.credit.lien === lien);
}

/** Range un environnement de Poly Haven dans le design (une seule fois). */
export async function rangerEnvironnement(id: string): Promise<Ressource> {
  const deja = environnementDejaLa(id);
  if (deja) return deja;
  const projet = useEditeur.getState().projet;
  if (!projet) throw new Error("aucun design ouvert");
  const suivi = useSuiviImport.getState();
  try {
    const r = await importerEnvironnementPolyHaven(projet, id, (part) => suivi.montrer(part < 0.85 ? "Téléchargement depuis Poly Haven" : "Préparation de l'environnement", part));
    if (useEditeur.getState().projet !== projet) throw new Error("le design a changé pendant le téléchargement");
    useEditeur.getState().ajouterRessources([r]);
    return r;
  } finally {
    suivi.finir();
  }
}

/** Les objets 3D choisis (ou celui dont le panneau 3D est ouvert). */
export function objets3dChoisis(): ElementObjet3d[] {
  const s = useEditeur.getState();
  return elementsCourants(s).filter((e): e is ElementObjet3d => e.type === "objet3d" && s.selection.includes(e.id) && !e.verrouille);
}

/** Éclaire des objets 3D par un environnement (fourni, ou une ressource du design) ; le nombre
 *  d'objets éclairés. */
export function eclairer(environnement: string, objets: ElementObjet3d[] = objets3dChoisis()): number {
  for (const o of objets) poserLumiere(o.id, (l) => ({ ...l, environnement: { ...l.environnement, id: environnement } }), `environnement-3d:${o.id}`);
  return objets.length;
}
