// Une photo ou une vidéo de Pixabay choisie arrive dans le design ouvert : le Rust la
// télécharge, la range avec son crédit, et l'interface l'ajoute aux images du design
// (panneau Importer).

import { useSuiviImport } from "../editeur/SuiviImport";
import type { Ressource } from "../modele/types";
import { importerPixabay, importerVideoPixabay } from "../pont/tauri";
import { useEditeur } from "./editeur";

export async function telechargerPhotoPixabay(id: number): Promise<Ressource> {
  const projet = useEditeur.getState().projet;
  if (!projet) throw new Error("aucun design ouvert");
  const ressource = await importerPixabay(projet, id);
  // Le design a pu changer pendant le téléchargement : la photo reste rangée dans le premier.
  if (useEditeur.getState().projet !== projet) throw new Error("le design a changé pendant le téléchargement");
  useEditeur.getState().ajouterRessources([ressource]);
  return ressource;
}

/** La vidéo choisie : téléchargée en 1080p puis préparée comme une vidéo du poste (copie
 *  d'aperçu, vignettes, forme d'onde). La bande d'import montre l'avancement. */
export async function telechargerVideoPixabay(id: number): Promise<Ressource> {
  const projet = useEditeur.getState().projet;
  if (!projet) throw new Error("aucun design ouvert");
  const suivi = useSuiviImport.getState();
  try {
    const ressource = await importerVideoPixabay(projet, id, (part) => suivi.montrer(part < 0.3 ? "Téléchargement de la vidéo" : "Préparation de la vidéo", part));
    if (useEditeur.getState().projet !== projet) throw new Error("le design a changé pendant le téléchargement");
    useEditeur.getState().ajouterRessources([ressource]);
    return ressource;
  } finally {
    suivi.finir();
  }
}
