// Le composant principal de l'éditeur : il assemble la barre du haut, le rail et son
// panneau, la barre contextuelle, la zone de travail (ou la vue en grille) et la barre du bas.

import { useEffect } from "react";
import { elementsSelectionnes, pageCourante, useEditeur } from "../etat/editeur";
import { collerAvecImages } from "../etat/projets";
import { Apercu } from "./Apercu";
import { BarreBas } from "./BarreBas";
import { BarreContexte } from "./BarreContexte";
import { BarreHaut } from "./BarreHaut";
import { BarreLaterale } from "./BarreLaterale";
import { deposerFichiers } from "./depot";
import { Frise } from "./frise/Frise";
import { useRaccourcis } from "./raccourcis";
import { VueGrille } from "./VueGrille";
import { ZoneDeTravail } from "./ZoneDeTravail";

const MARQUE_PRESSE_PAPIERS = "application/x-eliot";

function dansUnChamp(cible: EventTarget | null): boolean {
  return cible instanceof HTMLElement && (cible.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(cible.tagName));
}

/**
 * Copier, couper, coller passent par les événements du presse-papiers : coller une capture
 * d'écran l'importe ; copier des objets d'Eliot laisse une marque dans le presse-papiers du
 * système, pour que le coller suivant reprenne bien ces objets et pas une image copiée avant.
 */
function usePressePapiers() {
  useEffect(() => {
    const copier = (e: ClipboardEvent, couper: boolean) => {
      if (dansUnChamp(e.target) || useEditeur.getState().enEdition) return;
      const etat = useEditeur.getState();
      if (elementsSelectionnes(etat).length === 0) return;
      etat.copierSelection();
      e.clipboardData?.setData(MARQUE_PRESSE_PAPIERS, "1");
      e.clipboardData?.setData("text/plain", "Objets Eliot");
      e.preventDefault();
      if (couper) etat.supprimerSelection();
    };
    const surCopie = (e: ClipboardEvent) => copier(e, false);
    const surCoupe = (e: ClipboardEvent) => copier(e, true);
    const surCollage = (e: ClipboardEvent) => {
      // Déjà pris en main ailleurs (données d'un graphique collées depuis un tableur).
      if (e.defaultPrevented || dansUnChamp(e.target) || useEditeur.getState().enEdition) return;
      const donnees = e.clipboardData;
      const images = Array.from(donnees?.files ?? []).filter((f) => f.type.startsWith("image/"));
      e.preventDefault();
      if (images.length && !donnees?.types.includes(MARQUE_PRESSE_PAPIERS)) void deposerFichiers(images);
      else void collerAvecImages();
    };
    window.addEventListener("copy", surCopie);
    window.addEventListener("cut", surCoupe);
    window.addEventListener("paste", surCollage);
    return () => {
      window.removeEventListener("copy", surCopie);
      window.removeEventListener("cut", surCoupe);
      window.removeEventListener("paste", surCollage);
    };
  }, []);
}

export function Editeur() {
  useRaccourcis();
  usePressePapiers();
  const vueGrille = useEditeur((s) => s.vueGrille);
  const apercu = useEditeur((s) => s.apercu);
  const pageVideo = useEditeur((s) => pageCourante(s).duree !== undefined);
  return (
    <div className="relative flex h-full flex-col">
      <BarreHaut />
      <div className="flex min-h-0 flex-1">
        <BarreLaterale />
        <main className="flex min-w-0 flex-1 flex-col">
          <BarreContexte />
          {vueGrille ? <VueGrille /> : <ZoneDeTravail />}
          {pageVideo && !vueGrille && <Frise />}
          <BarreBas />
        </main>
      </div>
      {apercu && <Apercu />}
    </div>
  );
}
