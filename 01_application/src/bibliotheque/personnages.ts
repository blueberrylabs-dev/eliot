// Les personnages de la bibliothèque (Open Peeps, Humaaans), fabriqués sur le poste par
// `npm run bibliotheque` dans `public/bibliotheque/personnages/`. Le catalogue se lit une
// fois ; chaque fichier de dessins (une catégorie, ou les pièces du composeur) à la demande.
// Le calcul (assemblage, couleurs) est dans `modele/personnages.ts`.

import { useEffect, useState } from "react";
import {
  appliquerCouleurs,
  corpsCompose,
  piecesValides,
  svgPersonnage,
  trouverDessin,
  vueComposee,
  type Boite,
  type CataloguePersonnages,
  type CollectionPersonnages,
  type SourcePersonnage,
} from "../modele/personnages";
import { imageDeSvg, tailleDeRendu, urlSvg, useImageDeSvg } from "./bibliotheque";

const BASE = "/bibliotheque/personnages";

const fichiers = new Map<string, Promise<unknown>>();
/** Les fichiers déjà lus, pour un accès immédiat (fabriquer un élément au clic). */
const connus = new Map<string, unknown>();

function charger<T>(fichier: string): Promise<T> {
  let p = fichiers.get(fichier) as Promise<T> | undefined;
  if (!p) {
    p = fetch(`${BASE}/${fichier}`).then((r) => {
      if (!r.ok) throw new Error(`personnages absents (${fichier}) : lancer npm run bibliotheque`);
      return r.json() as Promise<T>;
    });
    p.then(
      (v) => connus.set(fichier, v),
      () => fichiers.delete(fichier),
    );
    fichiers.set(fichier, p);
  }
  return p;
}

/** Le catalogue, ou `null` si les personnages ne sont pas fabriqués sur ce poste. */
export function cataloguePersonnages(): Promise<CataloguePersonnages | null> {
  return charger<CataloguePersonnages>("catalogue.json").then(
    (c) => (c.collections?.length ? c : null),
    () => null,
  );
}

/** Le catalogue s'il est déjà chargé. */
export const catalogueConnu = () => connus.get("catalogue.json") as CataloguePersonnages | undefined;

export async function collectionPersonnages(id: string): Promise<CollectionPersonnages | undefined> {
  return (await cataloguePersonnages())?.collections.find((c) => c.id === id);
}

export const contenus = (fichier: string) => charger<Record<string, string>>(fichier);
export const contenusPieces = (fichier: string) => charger<Record<string, Record<string, string>>>(fichier);

/** Le dessin d'un personnage (avant ses couleurs) et son cadrage. */
export async function dessinPersonnage(source: SourcePersonnage, emplacements?: string[]): Promise<{ vue: Boite; corps: string } | undefined> {
  const c = await collectionPersonnages(source.collection);
  if (!c) return undefined;
  if (source.dessin) {
    const trouve = trouverDessin(c, source.dessin);
    if (!trouve) return undefined;
    const corps = (await contenus(trouve.categorie.fichier))[source.dessin];
    return corps === undefined ? undefined : { vue: trouve.vue, corps };
  }
  const { posture, pieces } = piecesValides(c.composition, source.posture, source.pieces);
  const tout = await contenusPieces(c.composition.fichier);
  return { vue: vueComposee(c.composition, posture, pieces, emplacements), corps: corpsCompose(c.composition, posture, pieces, tout, emplacements) };
}

/** Le SVG complet d'un personnage, couleurs comprises, à la taille donnée. */
export async function svgDeSource(source: SourcePersonnage, taille?: number, emplacements?: string[]): Promise<string | undefined> {
  const d = await dessinPersonnage(source, emplacements);
  return d ? svgPersonnage(d.vue, appliquerCouleurs(d.corps, source.couleurs), taille) : undefined;
}

/** Ce qui change le dessin : la clé de son image en mémoire. */
export const clePersonnage = (s: SourcePersonnage, emplacements?: string[]) =>
  `personnage/${s.collection}/${s.dessin ?? ""}/${s.posture ?? ""}/${JSON.stringify(s.pieces ?? {})}/${JSON.stringify(s.couleurs ?? {})}/${emplacements?.join(",") ?? ""}`;

export const imagePersonnage = (s: SourcePersonnage, taille: number) => imageDeSvg(clePersonnage(s), taille, (t) => svgDeSource(s, t));

export const useImagePersonnage = (s: SourcePersonnage, cote: number) => useImageDeSvg(clePersonnage(s), cote, (t) => svgDeSource(s, t));

/** L'adresse d'une vignette (balise `<img>`) ; `emplacements` : seulement ces pièces. */
export function useUrlPersonnage(s: SourcePersonnage | undefined, taille = 160, emplacements?: string[]): string | undefined {
  const [url, setUrl] = useState<string>();
  const cle = s ? clePersonnage(s, emplacements) : "";
  useEffect(() => {
    if (!s) return;
    let actif = true;
    void svgDeSource(s, taille, emplacements).then(
      (svg) => actif && setUrl(svg ? urlSvg(svg) : undefined),
      () => undefined,
    );
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, taille]);
  return url;
}

/** Prépare les personnages d'une liste d'éléments avant un rendu hors écran (export). */
export async function prechargerPersonnages(elements: { type: string; largeur: number; hauteur: number }[]): Promise<void> {
  await Promise.all(
    elements
      .filter((e) => e.type === "personnage")
      .map((e) => imagePersonnage(e as unknown as SourcePersonnage, tailleDeRendu(Math.max(e.largeur, e.hauteur)))),
  );
}

/** Le catalogue pour un composant : `undefined` pendant le chargement, `null` s'il manque. */
export function useCataloguePersonnages(): CataloguePersonnages | null | undefined {
  const [catalogue, setCatalogue] = useState<CataloguePersonnages | null | undefined>(() => catalogueConnu());
  useEffect(() => {
    let actif = true;
    void cataloguePersonnages().then((c) => actif && setCatalogue(c));
    return () => {
      actif = false;
    };
  }, []);
  return catalogue;
}
