// Une photo ou une vidéo de Pixabay ou de Pexels (étape 7, lot 5) choisie arrive dans le design
// ouvert : le Rust la télécharge, la range avec son crédit, et l'interface l'ajoute aux images du
// design (panneau Importer).

import { useSuiviImport } from "../editeur/SuiviImport";
import type { Ressource } from "../modele/types";
import { importerPexels, importerPixabay, importerVideoPexels, importerVideoPixabay } from "../pont/tauri";
import { useEditeur } from "./editeur";

/** La banque d'une photo ou d'une vidéo libre. */
export type SourcePhotos = "pixabay" | "pexels";

export const NOMS_SOURCES: Record<SourcePhotos, string> = { pixabay: "Pixabay", pexels: "Pexels" };

export const telechargerPhotoPixabay = (id: number) => telechargerPhoto("pixabay", id);
export const telechargerVideoPixabay = (id: number) => telechargerVideo("pixabay", id);

export async function telechargerPhoto(source: SourcePhotos, id: number): Promise<Ressource> {
  const projet = useEditeur.getState().projet;
  if (!projet) throw new Error("aucun design ouvert");
  const ressource = await (source === "pexels" ? importerPexels : importerPixabay)(projet, id);
  // Le design a pu changer pendant le téléchargement : la photo reste rangée dans le premier.
  if (useEditeur.getState().projet !== projet) throw new Error("le design a changé pendant le téléchargement");
  useEditeur.getState().ajouterRessources([ressource]);
  return ressource;
}

/** La vidéo choisie : téléchargée en 1080p puis préparée comme une vidéo du poste (copie
 *  d'aperçu, vignettes, forme d'onde). La bande d'import montre l'avancement. */
export async function telechargerVideo(source: SourcePhotos, id: number): Promise<Ressource> {
  const projet = useEditeur.getState().projet;
  if (!projet) throw new Error("aucun design ouvert");
  const suivi = useSuiviImport.getState();
  try {
    const ressource = await (source === "pexels" ? importerVideoPexels : importerVideoPixabay)(projet, id, (part) => suivi.montrer(part < 0.3 ? "Téléchargement de la vidéo" : "Préparation de la vidéo", part));
    if (useEditeur.getState().projet !== projet) throw new Error("le design a changé pendant le téléchargement");
    useEditeur.getState().ajouterRessources([ressource]);
    return ressource;
  } finally {
    suivi.finir();
  }
}
