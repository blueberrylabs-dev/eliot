// La bibliothèque embarquée (étape 3) : collections d'icônes et d'emojis, index de recherche,
// fabriqués sur le poste par `npm run bibliotheque` dans `public/bibliotheque/`. Tout se charge
// à la demande et reste en mémoire : une collection n'est lue qu'une fois.
//
// Une icône ou un emoji reste vectoriel dans le document (collection et nom). Pour l'écran et
// l'export, on fabrique un SVG complet, puis une image à la taille voulue (`imageVecteur`).

import { useEffect, useState } from "react";
import { chercher, type EntreeIndex } from "./recherche";
import motsFr from "./mots_fr.json";

export interface Collection {
  id: string;
  libelle: string;
  genre: "icone" | "emoji";
  viewBox: string;
  attributs: Record<string, string>;
  /** Une seule couleur, choisie par l'utilisateur (icônes) ; sinon couleurs d'origine. */
  couleur: boolean;
  licence: string;
  source: string;
  credit?: string;
  nombre: number;
}

const BASE = "/bibliotheque";

const memoire = new Map<string, Promise<unknown>>();
function charger<T>(chemin: string): Promise<T> {
  let p = memoire.get(chemin) as Promise<T> | undefined;
  if (!p) {
    p = fetch(`${BASE}/${chemin}`).then((r) => {
      if (!r.ok) throw new Error(`bibliothèque absente (${chemin}) : lancer npm run bibliotheque`);
      return r.json() as Promise<T>;
    });
    p.catch(() => memoire.delete(chemin));
    memoire.set(chemin, p);
  }
  return p;
}

export const collections = () => charger<Collection[]>("collections.json");
export const index = () => charger<EntreeIndex[]>("index.json");
export const nomsEmojis = () => charger<Record<string, string>>("noms-emojis.json");

/** Les tracés d'une collection, par nom. Gardés aussi en clair pour un accès synchrone. */
const tracesConnus = new Map<string, Record<string, string>>();
export async function traces(collection: string): Promise<Record<string, string>> {
  const t = await charger<Record<string, string>>(`vecteurs/${collection}.json`);
  tracesConnus.set(collection, t);
  return t;
}

const collectionsConnues = new Map<string, Collection>();
export async function collection(id: string): Promise<Collection | undefined> {
  if (!collectionsConnues.size) for (const c of await collections()) collectionsConnues.set(c.id, c);
  return collectionsConnues.get(id);
}

/** La bibliothèque est-elle fabriquée ? (sinon, le panneau dit comment la fabriquer) */
export async function bibliothequePresente(): Promise<boolean> {
  try {
    await collections();
    return true;
  } catch {
    return false;
  }
}

/** Mots de recherche : index chargé une fois, dictionnaire français intégré. */
export async function rechercher(requete: string, genre?: "icone" | "emoji"): Promise<EntreeIndex[]> {
  const [toutes, liste] = await Promise.all([collections(), index()]);
  const genres = new Map(toutes.map((c) => [c.id, c.genre]));
  // Phosphor est indexé une fois, sous « phosphor » ; ses six épaisseurs sont des icônes.
  const genreDe = (c: string) => (c === "phosphor" ? "icone" : genres.get(c));
  return chercher(liste, requete, motsFr as Record<string, string[]>, genre ? (c) => genreDe(c) === genre : undefined);
}

const echapper = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export interface DemandeVecteur {
  collection: string;
  nom: string;
  couleur?: string;
  trait?: number;
}

/** Le SVG complet d'une icône ou d'un emoji, à la taille donnée en pixels (sinon 100 %). */
export function svgVecteur(c: Collection, corps: string, d: DemandeVecteur, taille?: number): string {
  const attributs: Record<string, string> = { ...c.attributs };
  if (d.trait !== undefined && "stroke-width" in attributs) attributs["stroke-width"] = String(d.trait);
  if (c.couleur) attributs.color = d.couleur ?? "#1f1f1d";
  const dimensions = taille ? ` width="${taille}" height="${taille}"` : "";
  const liste = Object.entries(attributs)
    .map(([k, v]) => ` ${k}="${echapper(v)}"`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${c.viewBox}"${dimensions}${liste}>${corps}</svg>`;
}

export const urlSvg = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** L'adresse d'un aperçu (balise `<img>`), une fois la collection chargée. */
export async function urlVecteur(d: DemandeVecteur, taille = 96): Promise<string | undefined> {
  const [c, t] = await Promise.all([collection(d.collection), traces(d.collection)]);
  const corps = t[d.nom];
  if (!c || corps === undefined) return undefined;
  return urlSvg(svgVecteur(c, corps, d, taille));
}

// ---- Images pour Konva (écran et export) ----

/** Taille de rendu : la puissance de deux au-dessus de deux fois la taille affichée, pour que
 *  l'image reste nette au zoom et dans un export double, sans refaire l'image à chaque geste. */
export function tailleDeRendu(cote: number): number {
  const voulu = Math.max(128, Math.min(4096, cote * 2));
  return 2 ** Math.ceil(Math.log2(voulu));
}

const images = new Map<string, HTMLImageElement>();
const enCours = new Map<string, Promise<HTMLImageElement | undefined>>();

/**
 * Une image faite d'un SVG, gardée en mémoire sous `cle` et sa taille. `fabriquer` donne le
 * SVG complet à cette taille (icône, emoji, personnage) ; `undefined` s'il est introuvable.
 */
export function imageDeSvg(cle: string, taille: number, fabriquer: (taille: number) => Promise<string | undefined>): Promise<HTMLImageElement | undefined> {
  const complete = `${cle}/${taille}`;
  const deja = images.get(complete);
  if (deja) return Promise.resolve(deja);
  let p = enCours.get(complete);
  if (!p) {
    p = fabriquer(taille).then(
      (svg) =>
        svg
          ? new Promise<HTMLImageElement | undefined>((ok) => {
              const image = new Image();
              image.onload = () => {
                images.set(complete, image);
                ok(image);
              };
              image.onerror = () => ok(undefined);
              image.src = urlSvg(svg);
            })
          : undefined,
      () => undefined,
    );
    void p.finally(() => enCours.delete(complete));
    enCours.set(complete, p);
  }
  return p;
}

/** L'image prête à la bonne taille, sinon une plus grande, sinon la plus grande des plus
 *  petites : pendant qu'une version plus nette se prépare, l'ancienne reste affichée. */
function imageConnue(cle: string, taille: number): HTMLImageElement | undefined {
  for (let t = taille; t <= 4096; t *= 2) {
    const i = images.get(`${cle}/${t}`);
    if (i) return i;
  }
  for (let t = taille / 2; t >= 128; t /= 2) {
    const i = images.get(`${cle}/${t}`);
    if (i) return i;
  }
  return undefined;
}

/** L'image d'un SVG pour un objet affiché à `cote` pixels ; `cle` dit quand elle change. */
export function useImageDeSvg(cle: string, cote: number, fabriquer: (taille: number) => Promise<string | undefined>): HTMLImageElement | undefined {
  const taille = tailleDeRendu(cote);
  const [image, setImage] = useState(() => imageConnue(cle, taille));
  useEffect(() => {
    let actif = true;
    const connue = imageConnue(cle, taille);
    if (connue) setImage(connue);
    void imageDeSvg(cle, taille, fabriquer).then((i) => actif && i && setImage(i));
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, taille]);
  return image;
}

const cleVecteur = (d: DemandeVecteur) => `${d.collection}/${d.nom}/${d.couleur ?? ""}/${d.trait ?? ""}`;

async function svgDemande(d: DemandeVecteur, taille: number): Promise<string | undefined> {
  const [c, t] = await Promise.all([collection(d.collection), traces(d.collection)]);
  const corps = t[d.nom];
  return c && corps !== undefined ? svgVecteur(c, corps, d, taille) : undefined;
}

export const imageVecteur = (d: DemandeVecteur, taille: number) => imageDeSvg(cleVecteur(d), taille, (t) => svgDemande(d, t));

export const useImageVecteur = (d: DemandeVecteur, cote: number) => useImageDeSvg(cleVecteur(d), cote, (t) => svgDemande(d, t));

/** Hook pour les aperçus des panneaux. */
export function useUrlVecteur(d: DemandeVecteur, taille = 96): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let actif = true;
    void urlVecteur(d, taille).then((u) => actif && setUrl(u), () => undefined);
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.collection, d.nom, d.couleur, d.trait, taille]);
  return url;
}

/** Prépare toutes les icônes et emojis d'une liste d'éléments, avant un rendu hors écran (la
 *  taille de rendu double déjà la taille affichée : assez pour un export double). */
export async function prechargerVecteurs(elements: { type: string; largeur: number; hauteur: number; collection?: string; nom?: string; couleur?: unknown; trait?: number }[]): Promise<void> {
  await Promise.all(
    elements
      .filter((e) => e.type === "icone" || e.type === "emoji")
      .map((e) =>
        imageVecteur(
          { collection: e.collection!, nom: e.nom!, couleur: e.type === "icone" && typeof e.couleur === "string" ? e.couleur : undefined, trait: e.trait },
          tailleDeRendu(Math.max(e.largeur, e.hauteur)),
        ),
      ),
  );
}
