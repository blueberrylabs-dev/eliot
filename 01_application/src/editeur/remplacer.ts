// Remplacer une photo en gardant sa place (vérification de l'étape 5, catalogue du BRIEF,
// « Image ») : une photo posée sur la page, un cadre ou un écran de maquette reçoit une autre
// image, choisie dans les fichiers du poste. Une photo garde sa boîte, sa retouche, sa
// perspective et son style (`remplacerPhoto` de l'éditeur) ; un cadre et une maquette, leur
// forme (le cadrage revient au centre, comme quand on y dépose une photo).

import { elementsCourants, useEditeur } from "../etat/editeur";
import { finirPinceau, useDetourage } from "../labo/detourage";
import { finirPerspective, usePerspective } from "../labo/miseEnPerspective";
import { finirRecadrage, useRecadrage } from "../labo/recadrage";
import { recoitPhoto } from "../modele/types";
import { choisirEtImporterImages } from "../pont/tauri";
import { avecSuivi, suiviFichiers } from "./SuiviImport";

/** Met l'image `ressource` (déjà dans le design) à la place de celle de l'élément `id`. Les modes
 *  ouverts sur cet élément (recadrage, coins, pinceau) se ferment d'abord. Vrai si c'est fait. */
export function remplacerPar(id: string, ressource: string): boolean {
  const etat = useEditeur.getState();
  const el = elementsCourants(etat).find((e) => e.id === id);
  if (!el) return false;
  if (useDetourage.getState().pinceau === id) finirPinceau();
  if (useRecadrage.getState().id === id) finirRecadrage();
  if (usePerspective.getState().id === id) finirPerspective();
  if (recoitPhoto(el)) {
    if (el.verrouille || el.ressource === ressource) return false;
    etat.remplirPhoto(id, ressource);
    return true;
  }
  if (el.type !== "image") return false;
  const detouree = !!el.detourage;
  const fait = etat.remplacerPhoto(id, ressource);
  if (fait && detouree) etat.notifier("Photo remplacée. Le détourage de l'ancienne est retiré : Détourer pour retirer le fond de la nouvelle.");
  return fait;
}

/** Le bouton « Remplacer » : une image choisie dans les fichiers du poste, importée dans le
 *  design, puis mise à la place. */
export async function remplacerDepuisFichier(id: string): Promise<void> {
  const etat = useEditeur.getState();
  const projet = etat.projet;
  if (!projet) return;
  try {
    const bilan = await avecSuivi(() => choisirEtImporterImages(projet, suiviFichiers, false, false));
    if (!bilan) return;
    if (bilan.erreurs.length) etat.notifier(`Non importé : ${bilan.erreurs.join(" ; ")}`, { erreur: true });
    const image = bilan.ressources.find((r) => !r.video && !r.son);
    if (!image) return;
    etat.ajouterRessources([image]);
    if (useEditeur.getState().projet !== projet) return;
    remplacerPar(id, image.id);
  } catch (erreur) {
    etat.notifier(`Remplacement impossible : ${String(erreur)}`, { erreur: true });
  }
}
