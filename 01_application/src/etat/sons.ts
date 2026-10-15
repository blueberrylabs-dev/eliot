// Les sons qui arrivent dans le design ouvert (étape 4, lot 5) : importés du poste ou
// téléchargés de Freesound. Le Rust les range et les prépare (copie d'écoute, forme d'onde,
// niveau), l'interface les ajoute aux ressources du design et les pose dans la frise.

import { useSuiviImport } from "../editeur/SuiviImport";
import type { Ressource } from "../modele/types";
import { choisirEtImporterSons, importerFreesound } from "../pont/tauri";
import { useEditeur } from "./editeur";

/** Ouvre le sélecteur de fichiers et importe les sons choisis dans le design ouvert. `null` si
 *  on annule. */
export async function importerSonsDuPoste(): Promise<Ressource[] | null> {
  const projet = useEditeur.getState().projet;
  if (!projet) throw new Error("aucun design ouvert");
  const suivi = useSuiviImport.getState();
  try {
    const bilan = await choisirEtImporterSons(projet, (fichier, part, total) => suivi.montrer(total > 1 ? `Préparation du son ${fichier + 1} sur ${total}` : "Préparation du son", part));
    if (!bilan) return null;
    if (useEditeur.getState().projet !== projet) throw new Error("le design a changé pendant l'import");
    if (bilan.erreurs.length) useEditeur.getState().notifier(`Non importé : ${bilan.erreurs.join(" ; ")}`, { erreur: true });
    useEditeur.getState().ajouterRessources(bilan.ressources);
    return bilan.ressources;
  } finally {
    suivi.finir();
  }
}

/** Le son de Freesound choisi : téléchargé (l'extrait de bonne qualité), puis préparé comme un
 *  son du poste, avec son crédit et sa licence. */
export async function telechargerSonFreesound(id: number): Promise<Ressource> {
  const projet = useEditeur.getState().projet;
  if (!projet) throw new Error("aucun design ouvert");
  const suivi = useSuiviImport.getState();
  try {
    const ressource = await importerFreesound(projet, id, (part) => suivi.montrer(part < 0.25 ? "Téléchargement du son" : "Préparation du son", part));
    if (useEditeur.getState().projet !== projet) throw new Error("le design a changé pendant le téléchargement");
    useEditeur.getState().ajouterRessources([ressource]);
    return ressource;
  } finally {
    suivi.finir();
  }
}
