// Saisie du texte en place : au double-clic, une zone de saisie se pose exactement sur le
// texte (même police, même taille à l'échelle, même rotation). Échap, Ctrl+Entrée ou un clic
// ailleurs valident.

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { elementsCourants, useEditeur } from "../etat/editeur";
import { couleurPrincipale, type ElementTexte } from "../modele/types";
import { pilePolice } from "../polices";
import { noeudElement, scene } from "./scene";

export function EditeurTexte() {
  const enEdition = useEditeur((s) => s.enEdition);
  const terminerEdition = useEditeur((s) => s.terminerEdition);
  const zone = useRef<HTMLTextAreaElement>(null);
  const [valeur, setValeur] = useState("");
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!enEdition) {
      setStyle(null);
      return;
    }
    const el = elementsCourants(useEditeur.getState()).find((e) => e.id === enEdition) as ElementTexte | undefined;
    const groupe = noeudElement(enEdition);
    if (!el || !groupe) return;
    const position = groupe.getAbsolutePosition();
    // L'échelle à l'écran : celle de la page, et celle d'une image clé qui agrandit le texte.
    const s = Math.abs(groupe.getAbsoluteScale().x) || scene.echelle;
    setValeur(el.texte);
    setStyle({
      left: position.x,
      top: position.y,
      width: el.largeur * s,
      fontFamily: pilePolice(el.police),
      fontSize: el.taillePolice * s,
      fontWeight: el.gras ? 700 : 400,
      fontStyle: el.italique ? "italic" : "normal",
      textDecoration: [el.souligne ? "underline" : "", el.barre ? "line-through" : ""].filter(Boolean).join(" ") || "none",
      textTransform: el.majuscules ? "uppercase" : "none",
      lineHeight: el.interligne,
      letterSpacing: el.espacement * s,
      color: couleurPrincipale(el.couleur),
      textAlign: el.alignement,
      opacity: el.opacite,
      transform: `rotate(${groupe.getAbsoluteRotation()}deg)`,
      transformOrigin: "top left",
    });
    requestAnimationFrame(() => {
      zone.current?.focus();
      zone.current?.select();
    });
  }, [enEdition]);

  // La zone grandit avec le texte.
  useLayoutEffect(() => {
    const z = zone.current;
    if (!z) return;
    z.style.height = "auto";
    z.style.height = `${z.scrollHeight}px`;
  }, [valeur, style]);

  if (!style) return null;
  return (
    <textarea
      ref={zone}
      value={valeur}
      spellCheck={false}
      onChange={(e) => setValeur(e.target.value)}
      onBlur={() => terminerEdition(valeur)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
          e.preventDefault();
          zone.current?.blur();
        }
      }}
      className="absolute m-0 resize-none overflow-hidden border-0 bg-transparent p-0 whitespace-pre-wrap outline-2 outline-accent-500/70 outline-dashed"
      style={style}
    />
  );
}
