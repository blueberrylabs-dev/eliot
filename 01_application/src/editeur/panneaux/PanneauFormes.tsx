import { useEditeur } from "../../etat/editeur";
import { creerForme, pointsEtoile } from "../../modele/fabriques";
import type { GenreForme } from "../../modele/types";

const FORMES: { libelle: string; forme: GenreForme; arrondi?: number; dessin: React.ReactNode }[] = [
  { libelle: "Rectangle", forme: "rectangle", dessin: <rect x="6" y="12" width="52" height="40" /> },
  { libelle: "Rectangle arrondi", forme: "rectangle", arrondi: 40, dessin: <rect x="6" y="12" width="52" height="40" rx="10" /> },
  { libelle: "Cercle", forme: "ellipse", dessin: <circle cx="32" cy="32" r="24" /> },
  { libelle: "Triangle", forme: "triangle", dessin: <polygon points="32,8 58,56 6,56" /> },
  {
    libelle: "Étoile",
    forme: "etoile",
    dessin: <polygon points={pointsEtoile(52, 52).map((v) => v + 6).join(",")} />,
  },
];

export function PanneauFormes() {
  const page = useEditeur((s) => s.document.page);
  const ajouter = useEditeur((s) => s.ajouterElements);
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-neutral-800">Formes</p>
      <div className="grid grid-cols-3 gap-2">
        {FORMES.map((f) => (
          <button
            key={f.libelle}
            title={f.libelle}
            onClick={() => ajouter([creerForme(page, f.forme, f.arrondi)])}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-neutral-200 hover:border-accent-500 hover:bg-accent-50"
          >
            <svg viewBox="0 0 64 64" className="h-12 w-12 fill-accent-600">
              {f.dessin}
            </svg>
            <span className="text-[11px] text-neutral-600">{f.libelle}</span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-neutral-500">Les poignées des côtés étirent la forme, celles des coins aussi ; la poignée ronde du bas la fait tourner, par pas de 45° quand on s'en approche.</p>
    </div>
  );
}
