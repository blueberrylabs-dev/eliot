// Enregistrement automatique : une seconde après la dernière modification, le document part
// au noyau, qui l'écrit d'un bloc (règle 8). La miniature de l'accueil suit, plus lentement.
// Rien ne s'écrit pendant un geste : le store ne change qu'à la fin (règle 3).

import { rendrePage } from "../export/rendu";
import type { DocumentEliot, RefProjet } from "../modele/types";
import { enregistrerMiniature, enregistrerProjet } from "../pont/tauri";
import { useEditeur } from "./editeur";

const DELAI_MS = 1000;
const DELAI_MINIATURE_MS = 4000;
const COTE_MINIATURE = 480;

let minuteur: ReturnType<typeof setTimeout> | undefined;
let minuteurMiniature: ReturnType<typeof setTimeout> | undefined;
let enCours: Promise<void> | null = null;
let dernierEcrit: DocumentEliot | null = null;

function planifier() {
  clearTimeout(minuteur);
  minuteur = setTimeout(() => void enregistrerMaintenant(), DELAI_MS);
}

/** Écrit tout de suite ce qui ne l'est pas encore. À appeler avant de quitter un design. */
export async function enregistrerMaintenant(): Promise<void> {
  clearTimeout(minuteur);
  while (enCours) await enCours;
  const { projet, document } = useEditeur.getState();
  if (!projet || document === dernierEcrit) return;
  useEditeur.getState().definirEnregistrement("en-cours");
  enCours = (async () => {
    try {
      await enregistrerProjet(projet, document);
      dernierEcrit = document;
      const etat = useEditeur.getState();
      etat.definirEnregistrement(etat.document === document ? "enregistre" : "en-attente");
      planifierMiniature();
    } catch (erreur) {
      const etat = useEditeur.getState();
      if (etat.enregistrement !== "erreur") etat.notifier(`Enregistrement impossible : ${String(erreur)}`, { erreur: true });
      etat.definirEnregistrement("erreur");
    } finally {
      enCours = null;
    }
  })();
  await enCours;
  const etat = useEditeur.getState();
  if (etat.projet && etat.document !== dernierEcrit && etat.enregistrement !== "erreur") planifier();
}

function planifierMiniature() {
  clearTimeout(minuteurMiniature);
  minuteurMiniature = setTimeout(() => void miniatureMaintenant(), DELAI_MINIATURE_MS);
}

/** L'image de l'accueil : la première page, 480 px sur le grand côté. */
export async function miniatureMaintenant(projet?: RefProjet, document?: DocumentEliot): Promise<void> {
  clearTimeout(minuteurMiniature);
  const etat = useEditeur.getState();
  const ref = projet ?? etat.projet;
  const doc = document ?? etat.document;
  if (!ref) return;
  try {
    const { largeur, hauteur } = doc.format;
    const blob = await rendrePage(doc.pages[0], doc.format, { pixelRatio: COTE_MINIATURE / Math.max(largeur, hauteur), type: "image/png" });
    await enregistrerMiniature(ref, new Uint8Array(await blob.arrayBuffer()));
  } catch {
    // Une miniature manquée n'empêche rien : l'accueil affiche une vignette neutre.
  }
}

/** Branché une fois au démarrage. */
export function demarrerEnregistrementAuto(): void {
  useEditeur.subscribe((etat, avant) => {
    if (etat.document === avant.document) return;
    if (etat.projet !== avant.projet) {
      // Un design qu'on vient d'ouvrir est déjà sur le disque.
      clearTimeout(minuteur);
      dernierEcrit = etat.document;
      return;
    }
    if (!etat.projet || etat.document === dernierEcrit) return;
    etat.definirEnregistrement("en-attente");
    planifier();
  });
}
