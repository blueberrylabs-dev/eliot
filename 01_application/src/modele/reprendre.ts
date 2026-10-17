// Reprendre dans le design ouvert les pages ou les images d'un autre design : l'onglet Projets
// (vérification de l'étape 7, BRIEF § 6, le rail) et le collage d'un design à l'autre.
// Fonctions pures, testées (`reprendre.test.ts`).

import { dupliquerPage, nouvelId } from "./fabriques";
import { redimensionnerElements } from "./geometrie";
import type { ElementPage, Format, PageEliot } from "./types";

const ENVIRONNEMENT_IMPORTE = /^[0-9a-f]{64}$/;

/** Les ressources dont des éléments ont besoin : photos, vidéos, photos des cadres et des
 *  maquettes (la photo du fond comprise), modèles 3D et leurs environnements HDRI importés. */
export function ressourcesDesElements(elements: readonly ElementPage[]): string[] {
  const ids = elements.flatMap((e) => {
    if (e.type === "image" || e.type === "video") return [e.ressource];
    if ((e.type === "cadre" || e.type === "maquette") && e.ressource) return [e.ressource];
    if (e.type === "objet3d") return [e.ressource, ...(e.lumiere && ENVIRONNEMENT_IMPORTE.test(e.lumiere.environnement.id) ? [e.lumiere.environnement.id] : [])];
    return [];
  });
  return [...new Set(ids)];
}

/** Celles de pages entières : leurs éléments et leurs sons. */
export function ressourcesDesPages(pages: readonly PageEliot[]): string[] {
  return [...new Set(pages.flatMap((p) => [...ressourcesDesElements(p.elements), ...(p.audio ?? []).map((c) => c.ressource)]))];
}

/** Des pages d'un autre design, prêtes à entrer dans celui-ci : nouveaux identifiants (pages,
 *  éléments, groupes, sons), éléments mis à l'échelle du nouveau format comme le fait
 *  Redimensionner (le plus grand facteur qui tient, centré). La photo du fond se range
 *  ensuite d'elle-même sur toute la page (`rangerFond`, au passage dans le store). */
export function pagesReprises(pages: readonly PageEliot[], de: Format, vers: Format): PageEliot[] {
  const memeFormat = de.largeur === vers.largeur && de.hauteur === vers.hauteur;
  return pages.map((p) => {
    const copie = dupliquerPage(p);
    return {
      ...copie,
      elements: memeFormat ? copie.elements : redimensionnerElements(copie.elements, de, vers),
      ...(p.audio ? { audio: p.audio.map((c) => ({ ...c, id: nouvelId("s") })) } : {}),
    };
  });
}

/** Minuscules sans accents, pour chercher un design par son nom. */
export const pourChercher = (texte: string) =>
  texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae");

/** Les noms qui contiennent chaque mot de la requête, dans n'importe quel ordre. */
export function correspond(nom: string, requete: string): boolean {
  const mots = pourChercher(requete).split(/\s+/).filter(Boolean);
  const cible = pourChercher(nom);
  return mots.every((m) => cible.includes(m));
}
