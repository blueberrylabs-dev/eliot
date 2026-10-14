// Raccourcis clavier, inactifs quand on tape dans un champ.

import { useEffect } from "react";
import { useEditeur } from "../etat/editeur";

function dansUnChamp(cible: EventTarget | null): boolean {
  if (!(cible instanceof HTMLElement)) return false;
  return cible.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(cible.tagName);
}

export function useRaccourcis(): void {
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (dansUnChamp(e.target)) return;
      const etat = useEditeur.getState();
      if (etat.enEdition) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const touche = e.key.toLowerCase();
      let traite = true;

      if (ctrl && touche === "z" && !e.shiftKey) etat.annuler();
      else if (ctrl && ((touche === "z" && e.shiftKey) || touche === "y")) etat.retablir();
      else if (ctrl && touche === "d") etat.dupliquerSelection();
      else if (ctrl && touche === "c") etat.copierSelection();
      else if (ctrl && touche === "v") etat.coller();
      else if (ctrl && touche === "a") etat.toutSelectionner();
      else if (ctrl && e.key === "ArrowUp") etat.deplacerDansPile(e.shiftKey ? "premier" : "avant");
      else if (ctrl && e.key === "ArrowDown") etat.deplacerDansPile(e.shiftKey ? "dernier" : "arriere");
      else if (e.key === "Delete" || e.key === "Backspace") etat.supprimerSelection();
      else if (e.key === "Escape") etat.deselectionner();
      else if (e.key === "Enter" && etat.selection.length === 1) etat.commencerEdition(etat.selection[0]);
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
