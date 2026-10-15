// L'export d'une page vidéo en MP4 ou en GIF (étape 4, lot 4) : la page est décrite en calques
// (`calques.ts`), le noyau fait le film avec les réglages de la plateforme choisie
// (`plateformes.ts`).

import { create } from "zustand";
import { pageCourante, useEditeur } from "../etat/editeur";
import { annulerFilm, exporterFilm, type AvancementFilm, type ResultatFilm } from "../pont/tauri";
import { decrirePage } from "./calques";
import { nomDate } from "./exporter";
import { reglagesFilm, type OptionsFilm } from "./plateformes";

export * from "./plateformes";

// ---- Suivi ----

interface EtatExportVideo {
  /** `null` : rien en cours. */
  enCours: { format: "mp4" | "gif"; avancement: AvancementFilm | null; annulation: boolean } | null;
}

export const useExportVideo = create<EtatExportVideo>(() => ({ enCours: null }));

export function annulerExportVideo(): void {
  const e = useExportVideo.getState().enCours;
  if (!e) return;
  useExportVideo.setState({ enCours: { ...e, annulation: true } });
  void annulerFilm();
}

/** Exporte la page affichée (page vidéo) et renvoie ce qui a été écrit (le film, la version
 *  sans musique, le niveau final du son). */
export async function exporterVideo(o: OptionsFilm): Promise<ResultatFilm> {
  if (document.activeElement instanceof HTMLTextAreaElement) document.activeElement.blur();
  if (useExportVideo.getState().enCours) throw new Error("un export vidéo est déjà en cours");
  const etat = useEditeur.getState();
  const page = pageCourante(etat);
  if (page.duree === undefined) throw new Error("cette page n'est pas une vidéo : passe-la en Vidéo (barre du haut) pour l'exporter en film");
  if (!etat.projet) throw new Error("aucun design ouvert");
  useExportVideo.setState({ enCours: { format: o.format, avancement: null, annulation: false } });
  try {
    const description = await decrirePage(page, etat.document.format);
    // Annulé pendant la préparation : le noyau n'a encore rien commencé.
    if (useExportVideo.getState().enCours?.annulation) throw new Error("export annulé");
    const reglages = reglagesFilm(o, etat.document.format);
    return await exporterFilm(etat.projet, description, reglages, nomDate(), o.chemin, (a) => {
      const e = useExportVideo.getState().enCours;
      if (e) useExportVideo.setState({ enCours: { ...e, avancement: a } });
    });
  } finally {
    useExportVideo.setState({ enCours: null });
  }
}
