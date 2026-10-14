// Les polices d'Eliot (étape 3) : une centaine de familles libres, en TTF, fabriquées sur le
// poste avec la bibliothèque (`npm run bibliotheque`). Le même texte se compose de la même
// façon sur toutes les machines, et l'export aussi.
//
// Le catalogue se charge au démarrage ; les fichiers d'une police ne se lisent que lorsqu'elle
// sert (texte de la page, aperçu dans la liste). Konva mesure le texte avec la police
// réellement chargée : on attend donc qu'elle le soit avant de poser ou de modifier un texte.

import { useSyncExternalStore } from "react";

export type GenrePolice = "sans" | "impact" | "empattement" | "manuscrite" | "chasse-fixe" | "poste";

export interface Police {
  famille: string;
  genre: GenrePolice;
  /** Pour apprendre : à quoi elle sert le mieux. */
  usage: string;
  gras: boolean;
  italique: boolean;
  licence?: string;
}

export const GENRES_POLICE: { id: GenrePolice; libelle: string }[] = [
  { id: "sans", libelle: "Sans empattement" },
  { id: "impact", libelle: "Impact et fantaisie" },
  { id: "empattement", libelle: "Avec empattement" },
  { id: "manuscrite", libelle: "Manuscrite" },
  { id: "chasse-fixe", libelle: "Chasse fixe" },
  { id: "poste", libelle: "Sur ce poste" },
];

export const POLICE_PAR_DEFAUT = "Inter";

/** Chaîne `font-family` utilisable par le navigateur et par Konva. */
export const pilePolice = (famille: string) => `"${famille}", Inter, sans-serif`;

// ---- Catalogue ----

let catalogue: Police[] = [];
let etatCatalogue: "absent" | "pret" = "absent";
const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach((f) => f());

/** Le compteur de polices chargées : un texte se redessine quand sa police arrive. */
let versionPolices = 0;

export function polices(): Police[] {
  return catalogue;
}

export function usePolices(): Police[] {
  return useSyncExternalStore(
    (f) => (abonnes.add(f), () => abonnes.delete(f)),
    () => catalogue,
  );
}

export function useVersionPolices(): number {
  return useSyncExternalStore(
    (f) => (abonnes.add(f), () => abonnes.delete(f)),
    () => versionPolices,
  );
}

export const catalogueCharge = () => etatCatalogue === "pret";

/** Ajoute des polices au catalogue (polices du poste, polices copiées dans un design). */
export function ajouterPolices(liste: Police[]): void {
  const connues = new Set(catalogue.map((p) => p.famille));
  const nouvelles = liste.filter((p) => !connues.has(p.famille));
  if (nouvelles.length === 0) return;
  catalogue = [...catalogue, ...nouvelles];
  prevenir();
}

/**
 * Lit le catalogue de la bibliothèque et déclare ses polices au moteur web. Sans bibliothèque
 * (pas encore fabriquée), Eliot reste utilisable avec la police de secours du système.
 */
export async function chargerCatalogue(): Promise<void> {
  if (etatCatalogue === "pret") return;
  try {
    const reponse = await fetch("/bibliotheque/polices.json");
    if (!reponse.ok) throw new Error("absente");
    const liste = (await reponse.json()) as Police[];
    await new Promise<void>((ok) => {
      const lien = document.createElement("link");
      lien.rel = "stylesheet";
      lien.href = "/bibliotheque/polices.css";
      lien.onload = () => ok();
      lien.onerror = () => ok();
      document.head.appendChild(lien);
    });
    catalogue = [...liste, ...catalogue.filter((p) => p.genre === "poste")];
    etatCatalogue = "pret";
    prevenir();
    await assurerPolice(POLICE_PAR_DEFAUT, true, true);
  } catch {
    console.warn("Bibliothèque des polices absente : lancer npm run bibliotheque");
  }
}

/** Ce qu'une police sait faire : sans gras dessiné, le moteur en fabriquerait un faux, épais
 *  et baveux ; on garde alors le texte en normal. */
export function variantesPossibles(famille: string, voulu: { gras?: boolean; italique?: boolean }): { gras: boolean; italique: boolean } {
  const p = catalogue.find((x) => x.famille === famille);
  return { gras: !!voulu.gras && (p ? p.gras : true), italique: !!voulu.italique && (p ? p.italique : true) };
}

// ---- Polices du poste et polices copiées dans un design ----

/** D'où viennent les octets d'une police qui n'est pas dans la bibliothèque. */
type SourcePolice = { lire: () => Promise<ArrayBuffer>; style: "normal" | "italic"; poids: number };
const sourcesExternes = new Map<string, SourcePolice[]>();
const cheminsPoste = new Map<string, string[]>();

/** Les fichiers d'une police du poste, à copier dans le design qui s'en sert. */
export const fichiersDuPoste = (famille: string): string[] => cheminsPoste.get(famille) ?? [];

/** Déclare au moteur web une police lue en octets (poste ou design). */
async function declarerPoliceExterne(famille: string): Promise<void> {
  const sources = sourcesExternes.get(famille);
  if (!sources) return;
  sourcesExternes.delete(famille);
  await Promise.all(
    sources.map(async (s) => {
      try {
        const face = new FontFace(famille, await s.lire(), { style: s.style, weight: String(s.poids) });
        await face.load();
        document.fonts.add(face);
      } catch (e) {
        console.warn(`police illisible : ${famille}`, e);
      }
    }),
  );
}

/** Ajoute au catalogue les polices installées sur le poste (genre « Sur ce poste »). */
export async function chargerPolicesPoste(lister: () => Promise<{ famille: string; fichiers: { chemin: string; style: "normal" | "italic"; poids: number }[] }[]>, lire: (chemin: string) => Promise<ArrayBuffer>): Promise<void> {
  const liste = await lister().catch(() => []);
  const connues = new Set(catalogue.map((p) => p.famille));
  const nouvelles: Police[] = [];
  for (const p of liste) {
    if (connues.has(p.famille)) continue;
    cheminsPoste.set(p.famille, p.fichiers.map((f) => f.chemin));
    sourcesExternes.set(p.famille, p.fichiers.map((f) => ({ lire: () => lire(f.chemin), style: f.style, poids: f.poids })));
    nouvelles.push({
      famille: p.famille,
      genre: "poste",
      usage: "installée sur ce poste, copiée dans le design qui s'en sert",
      gras: p.fichiers.some((f) => f.style === "normal" && f.poids >= 600),
      italique: p.fichiers.some((f) => f.style === "italic"),
    });
  }
  ajouterPolices(nouvelles);
}

/** Déclare les polices copiées dans un design, avant de l'afficher. */
export async function chargerPolicesDesign(liste: { famille: string; fichiers: { chemin: string; style: "normal" | "italic"; poids: number }[] }[], lire: (fichier: string) => Promise<ArrayBuffer>): Promise<void> {
  const nouvelles: Police[] = [];
  for (const p of liste) {
    if (catalogue.some((x) => x.famille === p.famille && x.genre !== "poste")) continue;
    sourcesExternes.set(p.famille, p.fichiers.map((f) => ({ lire: () => lire(f.chemin), style: f.style, poids: f.poids })));
    if (!catalogue.some((x) => x.famille === p.famille)) {
      nouvelles.push({ famille: p.famille, genre: "poste", usage: "copiée dans ce design", gras: p.fichiers.some((f) => f.poids >= 600), italique: p.fichiers.some((f) => f.style === "italic") });
    }
  }
  ajouterPolices(nouvelles);
}

export const estPoliceDuPoste = (famille: string) => catalogue.some((p) => p.famille === famille && p.genre === "poste");

// ---- Chargement des fichiers ----

const chargees = new Set<string>();

/** Charge les variantes d'une police avant de mesurer ou de dessiner un texte. */
export async function assurerPolice(famille: string, gras = false, italique = false): Promise<void> {
  const variantes = ["normal 400", ...(gras ? ["normal 700"] : []), ...(italique ? ["italic 400"] : []), ...(gras && italique ? ["italic 700"] : [])];
  const manquantes = variantes.filter((v) => !chargees.has(`${famille}|${v}`));
  if (manquantes.length === 0) return;
  await declarerPoliceExterne(famille);
  await Promise.allSettled(manquantes.map((v) => document.fonts.load(`${v} 32px "${famille}"`)));
  manquantes.forEach((v) => chargees.add(`${famille}|${v}`));
  versionPolices += 1;
  prevenir();
}

/** Toutes les polices d'une liste d'éléments, dans les variantes qu'ils emploient. */
export async function assurerPolicesElements(elements: readonly { type: string; police?: string; gras?: boolean; italique?: boolean }[]): Promise<void> {
  const demandes = new Map<string, { gras: boolean; italique: boolean }>();
  for (const e of elements) {
    if (e.type !== "texte" || !e.police) continue;
    const d = demandes.get(e.police) ?? { gras: false, italique: false };
    demandes.set(e.police, { gras: d.gras || !!e.gras, italique: d.italique || !!e.italique });
  }
  await Promise.all([...demandes].map(([f, d]) => assurerPolice(f, d.gras, d.italique)));
}

export async function assurerPolicesDocument(document: { pages: { elements: readonly { type: string }[] }[] }): Promise<void> {
  await assurerPolicesElements(document.pages.flatMap((p) => p.elements));
}
