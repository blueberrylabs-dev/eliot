// Raccourcis clavier, inactifs quand on tape dans un champ. Copier, couper et coller passent
// par les événements du presse-papiers (Editeur.tsx) : ces touches sont laissées au système.

import { useEffect } from "react";
import { elementsSelectionnes, pageCourante, useEditeur } from "../etat/editeur";
import { useTemps } from "../etat/temps";
import { scene } from "./scene";
import { collerReglages, copierReglages, useLabo } from "../labo/retouche";
import { finirRecadrage, glisserImage, photoOuClip, useRecadrage } from "../labo/recadrage";

const PAS_ZOOM = 1.25;

function dansUnChamp(cible: EventTarget | null): boolean {
  if (!(cible instanceof HTMLElement)) return false;
  return cible.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(cible.tagName);
}

export function useRaccourcis(): void {
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (dansUnChamp(e.target)) return;
      const etat = useEditeur.getState();
      if (etat.enEdition || etat.apercu) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const touche = e.key.toLowerCase();
      const pages = etat.document.pages;
      const rang = pages.findIndex((p) => p.id === etat.pageActive);
      const zoom = etat.zoom ?? scene.echelle;
      const page = pageCourante(etat);
      const pageVideo = page.duree !== undefined;
      let traite = true;

      // En recadrant (étape 5, lot 5) : Entrée finit, Échap revient au cadre d'avant, les flèches
      // font glisser la photo sous le cadre ; Suppr ne supprime rien.
      const rogne = useRecadrage.getState().id;
      if (rogne && !ctrl && !e.altKey) {
        const el = photoOuClip(rogne);
        if (e.key === "Enter") finirRecadrage();
        else if (e.key === "Escape") finirRecadrage(true);
        else if (e.key === "Delete" || e.key === "Backspace") traite = true;
        else if (e.key.startsWith("Arrow") && el) {
          const pas = e.shiftKey ? 10 : 1;
          glisserImage(el, e.key === "ArrowLeft" ? -pas : e.key === "ArrowRight" ? pas : 0, e.key === "ArrowUp" ? -pas : e.key === "ArrowDown" ? pas : 0, `rogner-fleches:${rogne}`);
        } else traite = false;
        if (traite) {
          e.preventDefault();
          return;
        }
        traite = true;
      }

      if (ctrl && e.shiftKey && !e.altKey && touche === "c") traite = copierReglages();
      else if (ctrl && e.shiftKey && !e.altKey && touche === "v" && useLabo.getState().copie) collerReglages();
      else if (ctrl && e.altKey && touche === "c") etat.copierStyle();
      else if (ctrl && e.altKey && touche === "v") {
        const [cible] = elementsSelectionnes(etat);
        if (cible) etat.appliquerStyle(cible.id);
      } else if (ctrl && touche === "z" && !e.shiftKey) etat.annuler();
      else if (ctrl && ((touche === "z" && e.shiftKey) || touche === "y")) etat.retablir();
      else if (ctrl && touche === "d") etat.dupliquerSelection();
      else if (ctrl && touche === "b" && pageVideo) etat.scinderALaTete();
      else if (pageVideo && etat.selection.length === 0 && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        // Sans sélection, les flèches font avancer la tête d'une image (Maj : d'une seconde).
        const pas = (e.shiftKey ? 1000 : 1000 / 30) * (e.key === "ArrowLeft" ? -1 : 1);
        const temps = useTemps.getState();
        temps.pause();
        temps.allerA(Math.min(Math.max(0, (page.duree ?? 1) - 1), temps.tete + pas));
      } else if (pageVideo && (e.key === "Home" || e.key === "End")) {
        useTemps.getState().pause();
        useTemps.getState().allerA(e.key === "Home" ? 0 : Math.max(0, (page.duree ?? 1) - 1));
      }
      else if (ctrl && touche === "a") etat.toutSelectionner();
      else if (ctrl && touche === "g" && e.shiftKey) etat.degrouperSelection();
      else if (ctrl && touche === "g") etat.grouperSelection();
      else if (ctrl && (touche === "0" || e.code === "Digit0" || e.code === "Numpad0")) etat.definirZoom(null);
      else if (ctrl && (touche === "+" || touche === "=" || e.code === "NumpadAdd")) etat.definirZoom(zoom * PAS_ZOOM);
      else if (ctrl && (touche === "-" || e.code === "NumpadSubtract")) etat.definirZoom(zoom / PAS_ZOOM);
      else if (ctrl && e.key === "ArrowUp") etat.deplacerDansPile(e.shiftKey ? "premier" : "avant");
      else if (ctrl && e.key === "ArrowDown") etat.deplacerDansPile(e.shiftKey ? "dernier" : "arriere");
      else if (ctrl && e.key === "Enter") etat.ajouterPage();
      else if (e.key === "PageDown" && rang < pages.length - 1) etat.allerALaPage(pages[rang + 1].id);
      else if (e.key === "PageUp" && rang > 0) etat.allerALaPage(pages[rang - 1].id);
      else if (e.key === "F11") etat.basculerApercu(true);
      else if (e.key === "Delete" || e.key === "Backspace") etat.supprimerSelection();
      else if (e.key === "Escape") {
        if (etat.dessin) etat.definirDessin(null);
        else if (etat.styleCopie) etat.oublierStyle();
        else if (etat.enAjustement) etat.terminerAjustement();
        else if (etat.vueGrille) etat.basculerVueGrille();
        else etat.deselectionner();
      } else if (e.key === "Enter" && etat.selection.length === 1) etat.commencerEdition(etat.selection[0]);
      else if (e.key.startsWith("Arrow") && etat.selection.length > 0) {
        const pas = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -pas : e.key === "ArrowRight" ? pas : 0;
        const dy = e.key === "ArrowUp" ? -pas : e.key === "ArrowDown" ? pas : 0;
        etat.deplacerSelection(dx, dy);
      } else traite = false;

      if (traite) e.preventDefault();
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, []);
}
