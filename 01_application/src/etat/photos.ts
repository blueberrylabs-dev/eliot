// Une photo de Pixabay choisie arrive dans le design ouvert : le Rust la télécharge, la range
// avec son crédit, et l'interface l'ajoute aux images du design (panneau Importer).

import type { Ressource } from "../modele/types";
import { importerPixabay } from "../pont/tauri";
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
