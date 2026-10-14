// Les formes, lignes et flèches du panneau Éléments : leurs modèles et leur grille.

import type { ReactNode } from "react";
import { creerForme, pointsEtoile, pointsPolygone } from "../../modele/fabriques";
import type { ElementForme, GenreForme } from "../../modele/types";
import { glisserDepuisPanneau } from "../glisser";

export interface ModeleForme {
  libelle: string;
  mots: string;
  forme: GenreForme;
  options?: Partial<ElementForme>;
  dessin: ReactNode;
}

export const FORMES: ModeleForme[] = [
  { libelle: "Carré", mots: "carre rectangle", forme: "rectangle", dessin: <rect x="8" y="8" width="48" height="48" /> },
  { libelle: "Arrondi", mots: "rectangle arrondi bouton", forme: "rectangle", options: { arrondi: 40 }, dessin: <rect x="6" y="14" width="52" height="36" rx="12" /> },
  { libelle: "Cercle", mots: "cercle rond ellipse", forme: "ellipse", dessin: <circle cx="32" cy="32" r="25" /> },
  { libelle: "Triangle", mots: "triangle", forme: "triangle", dessin: <polygon points="32,7 58,56 6,56" /> },
  { libelle: "Étoile", mots: "etoile", forme: "etoile", dessin: <polygon points={pointsEtoile(52, 52).map((v) => v + 6).join(",")} /> },
  { libelle: "Badge", mots: "badge etoile sceau promo", forme: "etoile", options: { cotes: 12 }, dessin: <polygon points={pointsEtoile(54, 54, 12, 0.8).map((v) => v + 5).join(",")} /> },
  { libelle: "Hexagone", mots: "hexagone polygone", forme: "polygone", options: { cotes: 6 }, dessin: <polygon points={pointsPolygone(52, 52, 6).map((v) => v + 6).join(",")} /> },
  { libelle: "Pentagone", mots: "pentagone polygone", forme: "polygone", options: { cotes: 5 }, dessin: <polygon points={pointsPolygone(52, 52, 5).map((v) => v + 6).join(",")} /> },
  { libelle: "Cœur", mots: "coeur amour", forme: "coeur", dessin: <path d="M32 19 C32 8 6 6 6 23 C6 37 22 47 32 58 C42 47 58 37 58 23 C58 6 32 8 32 19 Z" /> },
];

export const TRAITS: ModeleForme[] = [
  { libelle: "Ligne", mots: "ligne trait", forme: "ligne", dessin: <line x1="6" y1="32" x2="58" y2="32" strokeWidth="5" strokeLinecap="round" /> },
  { libelle: "Tirets", mots: "ligne tirets pointilles", forme: "ligne", options: { tirets: true }, dessin: <line x1="6" y1="32" x2="58" y2="32" strokeWidth="5" strokeDasharray="9 7" strokeLinecap="round" /> },
  { libelle: "Flèche", mots: "fleche", forme: "fleche", dessin: <><line x1="6" y1="32" x2="50" y2="32" strokeWidth="5" strokeLinecap="round" /><polygon points="58,32 44,24 44,40" /></> },
  { libelle: "Double flèche", mots: "fleche double", forme: "fleche", options: { pointes: { debut: true, fin: true } }, dessin: <><line x1="14" y1="32" x2="50" y2="32" strokeWidth="5" strokeLinecap="round" /><polygon points="58,32 44,24 44,40" /><polygon points="6,32 20,24 20,40" /></> },
];

export function GrilleFormes({ liste }: { liste: ModeleForme[] }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {liste.map((f) => (
        <button
          key={f.libelle}
          title={f.libelle}
          onPointerDown={(e) => glisserDepuisPanneau(e, (format) => [creerForme(format, f.forme, f.options)])}
          className="flex aspect-square cursor-grab items-center justify-center rounded-lg border border-neutral-200 hover:border-accent-500 hover:bg-accent-50"
        >
          <svg viewBox="0 0 64 64" className="h-9 w-9 fill-accent-600 stroke-accent-600">
            {f.dessin}
          </svg>
        </button>
      ))}
    </div>
  );
}

