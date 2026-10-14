// Écriture dans une cellule de tableau : une zone de saisie posée exactement sur la cellule
// (même police, même taille, même rotation). Tab et Maj+Tab passent à la cellule voisine,
// Échap ou un clic ailleurs valident.

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { elementsCourants, useEditeur } from "../etat/editeur";
import { mesurePolice } from "../modele/mesure";
import { disposerTableau, INTERLIGNE_TABLEAU } from "../modele/tableaux";
import type { ElementTableau } from "../modele/types";
import { pilePolice } from "../polices";
import { noeudElement, scene } from "./scene";

export function EditeurCellule() {
  const cellule = useEditeur((s) => s.celluleEnEdition);
  const terminer = useEditeur((s) => s.terminerCellule);
  const zone = useRef<HTMLTextAreaElement>(null);
  const [valeur, setValeur] = useState("");
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!cellule) {
      setStyle(null);
      return;
    }
    const el = elementsCourants(useEditeur.getState()).find((e) => e.id === cellule.id) as ElementTableau | undefined;
    const groupe = noeudElement(cellule.id);
    if (!el || !groupe) return;
    const d = disposerTableau(el, mesurePolice(el.police));
    const c = d.cellules.find((x) => x.ligne === cellule.ligne && x.colonne === cellule.colonne);
    if (!c) return;
    const coin = groupe.getAbsoluteTransform().point({ x: c.x, y: c.y });
    const s = scene.echelle;
    const entete = el.entete && cellule.ligne === 0;
    const rayee = !entete && el.rayures && (cellule.ligne - (el.entete ? 1 : 0)) % 2 === 1;
    setValeur(el.cellules[cellule.ligne]?.[cellule.colonne] ?? "");
    setStyle({
      left: coin.x,
      top: coin.y,
      width: c.l * s,
      minHeight: c.h * s,
      padding: el.marge * s,
      fontFamily: pilePolice(el.police),
      fontSize: el.taillePolice * s,
      fontWeight: entete ? 700 : 400,
      lineHeight: INTERLIGNE_TABLEAU,
      color: entete ? el.texteEntete : el.couleurTexte,
      background: entete ? el.fondEntete : rayee ? el.rayures : el.fond,
      textAlign: el.alignement,
      transform: `rotate(${groupe.getAbsoluteRotation()}deg)`,
      transformOrigin: "top left",
    });
    requestAnimationFrame(() => {
      zone.current?.focus();
      zone.current?.select();
    });
  }, [cellule]);

  // La zone grandit avec le texte.
  useLayoutEffect(() => {
    const z = zone.current;
    if (!z) return;
    z.style.height = "auto";
    z.style.height = `${z.scrollHeight}px`;
  }, [valeur, style]);

  if (!style || !cellule) return null;
  return (
    <textarea
      ref={zone}
      data-cellule={`${cellule.ligne}-${cellule.colonne}`}
      value={valeur}
      spellCheck={false}
      onChange={(e) => setValeur(e.target.value)}
      onBlur={() => terminer(valeur)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Tab") {
          e.preventDefault();
          terminer(valeur, e.shiftKey ? "precedente" : "suivante");
        } else if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
          e.preventDefault();
          terminer(valeur);
        }
      }}
      className="absolute m-0 box-border resize-none overflow-hidden border-0 whitespace-pre-wrap outline-2 outline-accent-500 outline-solid"
      style={style}
    />
  );
}
