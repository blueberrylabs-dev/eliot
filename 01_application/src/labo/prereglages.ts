// Les préréglages d'Alexandre (étape 5, lot 3), rangés hors des designs (le noyau les lit et les
// écrit dans `~/Documents/Eliot/Préréglages/`). Lus une fois, gardés ici ; chaque changement
// réécrit la liste entière.

import { create } from "zustand";
import { normaliserReglages, type ReglagesPhoto } from "../modele/labo";
import { CATEGORIE_MIENS, PREREGLAGES_FOURNIS, style, type Prereglage } from "../modele/prereglages";
import { enregistrerPrereglages, lirePrereglages } from "../pont/tauri";

interface EtatPrereglages {
  miens: Prereglage[];
  charges: boolean;
  erreur: string | null;
}

export const usePrereglages = create<EtatPrereglages>(() => ({ miens: [], charges: false, erreur: null }));

let chargement: Promise<void> | null = null;

/** Lit les préréglages d'Alexandre (une seule fois). */
export function chargerPrereglages(): Promise<void> {
  chargement ??= lirePrereglages().then(
    (v) => {
      const liste = (v as { prereglages?: unknown[] } | null)?.prereglages ?? [];
      const miens = liste
        .filter((p): p is { id: string; nom: string; reglages: ReglagesPhoto } => !!p && typeof p === "object" && typeof (p as Prereglage).id === "string" && typeof (p as Prereglage).nom === "string")
        .map((p) => ({ id: p.id, nom: p.nom, categorie: CATEGORIE_MIENS, reglages: normaliserReglages(p.reglages) ?? {} }));
      usePrereglages.setState({ miens, charges: true, erreur: null });
    },
    (e) => {
      usePrereglages.setState({ charges: true, erreur: `préréglages illisibles : ${String(e)}` });
    },
  );
  return chargement;
}

/** Tous les préréglages : ceux d'Eliot, puis ceux d'Alexandre. */
export function tousLesPrereglages(): Prereglage[] {
  return [...PREREGLAGES_FOURNIS, ...usePrereglages.getState().miens];
}

async function ecrire(miens: Prereglage[]): Promise<void> {
  await enregistrerPrereglages({ version: 1, prereglages: miens.map(({ id, nom, reglages }) => ({ id, nom, reglages })) });
  usePrereglages.setState({ miens, erreur: null });
}

function nouvelId(): string {
  return `moi-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Enregistre le style d'une retouche (sans l'exposition, la netteté, le flou ni la réduction du bruit)
 * sous `nom` ; un préréglage d'Alexandre du même nom est remplacé. Renvoie le préréglage.
 */
export async function enregistrerPrereglage(nom: string, reglages: ReglagesPhoto | undefined): Promise<Prereglage> {
  await chargerPrereglages();
  const propre = nom.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!propre) throw new Error("un nom est attendu");
  const r = style(reglages);
  if (!r) throw new Error("rien à enregistrer : la retouche n'a pas de style (seulement l'exposition, la netteté, le flou ou le bruit, ou rien)");
  const { miens } = usePrereglages.getState();
  const meme = miens.find((p) => p.nom.toLowerCase() === propre.toLowerCase());
  const p: Prereglage = { id: meme?.id ?? nouvelId(), nom: propre, categorie: CATEGORIE_MIENS, reglages: r };
  await ecrire(meme ? miens.map((x) => (x.id === meme.id ? p : x)) : [...miens, p]);
  return p;
}

export async function supprimerPrereglage(id: string): Promise<void> {
  await chargerPrereglages();
  await ecrire(usePrereglages.getState().miens.filter((p) => p.id !== id));
}
