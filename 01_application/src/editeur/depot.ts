// Ce qui arrive de l'extérieur : fichiers déposés sur la fenêtre, image collée depuis le
// presse-papiers. Les images, les vidéos, les sons et les modèles 3D passent par le noyau
// (règle 4) ; les images, les vidéos et les modèles se posent sur la page, les sons dans la
// frise, à la tête de lecture.

import { elementsCourants, useEditeur } from "../etat/editeur";
import { elementAPhotoSous } from "../modele/cadres";
import { ouvrirDesign } from "../etat/projets";
import { creerDepuisRessource } from "../modele/fabriques";
import type { Ressource } from "../modele/types";
import { estCheminModele, estFichierSon, importerArchiveChemin, importerChemins, importerFichiers, type BilanImport } from "../pont/tauri";
import { centrerSur } from "./glisser";
import { avecSuivi, suiviFichiers, suiviSons } from "./SuiviImport";
import { pointDansLaPage } from "./scene";

const DECALAGE_PX = 40;

/** Pose les images importées : la première sous le point visé (ou au centre), les suivantes
 *  en escalier. */
function poser(bilan: BilanImport, point: { x: number; y: number } | null) {
  const etat = useEditeur.getState();
  if (bilan.erreurs.length) etat.notifier(`Non importé : ${bilan.erreurs.join(" ; ")}`, { erreur: true });
  if (bilan.ressources.length === 0) return;
  etat.ajouterRessources(bilan.ressources);
  // Les sons vont dans la frise, à la tête de lecture.
  for (const r of bilan.ressources.filter((x) => x.son)) etat.ajouterSon(r);
  let ressources = bilan.ressources.filter((x) => !x.son);
  if (ressources.length === 0) return;
  // La première photo lâchée sur un cadre ou une maquette va dedans (pas une vidéo, pas un
  // modèle 3D).
  const cible = point && !ressources[0].video && !ressources[0].modele3d ? elementAPhotoSous(elementsCourants(etat), point) : null;
  if (cible) {
    etat.remplirPhoto(cible.id, ressources[0].id);
    ressources = ressources.slice(1);
    if (ressources.length === 0) return;
  }
  const format = etat.document.format;
  const elements = ressources.map((r: Ressource, i) => {
    const el = creerDepuisRessource(format, r);
    if (!point) return { ...el, x: el.x + i * DECALAGE_PX, y: el.y + i * DECALAGE_PX };
    return centrerSur([el], { x: point.x + i * DECALAGE_PX, y: point.y + i * DECALAGE_PX })[0];
  });
  etat.ajouterElements(elements);
}

/** Dépôt de chemins (Tauri). Un fichier `.eliot` devient un design ; les images, les vidéos
 *  et les modèles 3D vont sur la page, sous le pointeur. */
export async function deposerChemins(chemins: string[], clientX: number, clientY: number): Promise<void> {
  const etat = useEditeur.getState();
  const archives = chemins.filter((c) => c.toLowerCase().endsWith(".eliot"));
  const images = chemins.filter((c) => !c.toLowerCase().endsWith(".eliot"));
  try {
    for (const archive of archives) {
      const info = await importerArchiveChemin(archive);
      etat.notifier(`Design ajouté : ${info.nom}`);
      if (archives.length === 1 && images.length === 0) await ouvrirDesign({ rayon: "designs", id: info.id });
    }
    if (images.length === 0 || !etat.projet || etat.vue !== "editeur") return;
    const point = pointDansLaPage(clientX, clientY);
    const projet = etat.projet;
    poser(await avecSuivi(() => importerChemins(projet, images, suiviFichiers, suiviSons)), point);
  } catch (e) {
    etat.notifier(`Dépôt impossible : ${String(e)}`, { erreur: true });
  }
}

/** Dépôt ou collage de fichiers reçus en octets (navigateur, presse-papiers). */
export async function deposerFichiers(fichiers: File[], clientX?: number, clientY?: number): Promise<void> {
  const etat = useEditeur.getState();
  const images = fichiers.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/") || estFichierSon(f) || estCheminModele(f.name));
  if (!etat.projet || images.length === 0) return;
  try {
    const point = clientX === undefined || clientY === undefined ? null : pointDansLaPage(clientX, clientY);
    poser(await importerFichiers(etat.projet, images), point);
  } catch (e) {
    etat.notifier(`Import impossible : ${String(e)}`, { erreur: true });
  }
}

