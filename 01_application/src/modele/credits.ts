// Les crédits à recopier sous une publication (vérification de l'étape 6) : les modèles et les
// environnements 3D venus d'une banque, et, pour un film, les sons. Une licence CC BY demande de
// citer l'auteur et la licence ; CC0 ne demande rien, mais le crédit reste proposé.

import { creditsDesSons } from "./son";
import type { Credit, PageEliot } from "./types";

type Ressources = Record<string, { nom: string; credit?: Credit } | undefined>;

/** Le crédit d'un modèle ou d'un environnement 3D, tel qu'on le recopie sous une publication. */
export function texteDuCredit(c: Credit, genre = "Modèle 3D"): string {
  const titre = c.titre ? `« ${c.titre} »` : genre;
  return `${titre}, par ${c.auteur}, sur ${c.source}${c.licence ? `, licence ${c.licence}` : ""} : ${c.lien}`;
}

/** Les crédits des objets 3D visibles des pages : leurs modèles, puis leurs environnements, chacun
 *  une fois. */
export function creditsDes3d(pages: readonly PageEliot[], ressources: Ressources): string[] {
  const modeles: string[] = [];
  const environnements: string[] = [];
  for (const p of pages) {
    for (const e of p.elements) {
      if (e.type !== "objet3d" || !e.visible) continue;
      const m = ressources[e.ressource]?.credit;
      if (m) modeles.push(texteDuCredit(m));
      const env = e.lumiere ? ressources[e.lumiere.environnement.id]?.credit : undefined;
      if (env) environnements.push(texteDuCredit(env, "Environnement 3D"));
    }
  }
  return [...new Set([...modeles, ...environnements])];
}

export interface CreditsAPublier {
  modeles3d: string[];
  sons: string[];
  /** Une des licences est une CC BY : le crédit doit accompagner la publication. */
  obligatoire: boolean;
}

/** Les crédits d'une publication : les objets 3D des pages exportées et, pour un film, les sons de
 *  sa page. */
export function creditsAPublier(pages: readonly PageEliot[], ressources: Ressources, film: boolean): CreditsAPublier {
  const modeles3d = creditsDes3d(pages, ressources);
  const sons = film ? [...new Set(pages.flatMap((p) => creditsDesSons(p, ressources as Parameters<typeof creditsDesSons>[1])))] : [];
  return { modeles3d, sons, obligatoire: [...modeles3d, ...sons].some((l) => /licence CC BY/.test(l)) };
}

/** Le texte à coller : les objets 3D, puis les sons, chacun sous son titre. Vide sans crédit. */
export function texteDesCredits(c: Pick<CreditsAPublier, "modeles3d" | "sons">): string {
  const parts: string[] = [];
  if (c.modeles3d.length) parts.push(["Objets 3D :", ...c.modeles3d].join("\n"));
  if (c.sons.length) parts.push(["Sons :", ...c.sons].join("\n"));
  return parts.join("\n\n");
}
