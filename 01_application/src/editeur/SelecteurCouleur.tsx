// Choix d'une couleur : couleurs du document, palette de départ, et le sélecteur du système.

import { useEditeur } from "../etat/editeur";
import { Bulle } from "./Bulle";

const PALETTE = [
  "#000000", "#545454", "#a6a6a6", "#ffffff",
  "#ff3131", "#ff7a59", "#ffbd59", "#ffde59",
  "#7ed957", "#1d9e75", "#5ce1e6", "#38b6ff",
  "#4f46e5", "#8c52ff", "#cb6ce6", "#ff66c4",
];

function couleursDuDocument(): string[] {
  const { document } = useEditeur.getState();
  const vues = new Set<string>([document.page.fond.toLowerCase()]);
  for (const e of document.elements) {
    if (e.type === "texte") vues.add(e.couleur.toLowerCase());
    if (e.type === "forme") {
      vues.add(e.remplissage.toLowerCase());
      if (e.epaisseurContour > 0) vues.add(e.contour.toLowerCase());
    }
  }
  return [...vues].slice(0, 12);
}

interface Proprietes {
  valeur: string;
  surChoix: (couleur: string) => void;
  titre: string;
  /** Petit libellé au-dessus de la pastille (« A » pour un texte). */
  lettre?: string;
}

export function SelecteurCouleur({ valeur, surChoix, titre, lettre }: Proprietes) {
  const pastille = (c: string) => (
    <button
      key={c}
      title={c}
      onClick={() => surChoix(c)}
      className={`h-7 w-7 rounded-md border ${c.toLowerCase() === valeur.toLowerCase() ? "border-accent-600 ring-2 ring-accent-200" : "border-neutral-300"}`}
      style={{ background: c }}
    />
  );

  return (
    <Bulle
      titre={titre}
      largeur={232}
      bouton={
        <span className="flex flex-col items-center">
          {lettre && <span className="text-sm leading-none font-bold text-neutral-800">{lettre}</span>}
          <span className={`rounded-sm border border-neutral-300 ${lettre ? "mt-0.5 h-1.5 w-5" : "h-5 w-5"}`} style={{ background: valeur }} />
        </span>
      }
    >
      <p className="mb-1.5 text-xs font-medium text-neutral-500">Couleurs du document</p>
      <div className="mb-3 grid grid-cols-6 gap-1.5">{couleursDuDocument().map(pastille)}</div>
      <p className="mb-1.5 text-xs font-medium text-neutral-500">Palette</p>
      <div className="mb-3 grid grid-cols-6 gap-1.5">{PALETTE.map(pastille)}</div>
      <label className="flex items-center gap-2 text-xs text-neutral-600">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(valeur) ? valeur : "#000000"} onChange={(e) => surChoix(e.target.value)} className="h-7 w-10 cursor-pointer rounded border border-neutral-300" />
        Autre couleur
      </label>
    </Bulle>
  );
}
