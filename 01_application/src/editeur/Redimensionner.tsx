// « Redimensionner » : passer le design dans un autre format (un post carré décliné en story,
// par exemple). Le contenu suit, mis à l'échelle et centré ; on peut garder l'original.

import { X } from "lucide-react";
import { useState } from "react";
import { useEditeur } from "../etat/editeur";
import { enregistrerMaintenant } from "../etat/enregistrement";
import { faireUneCopie } from "../etat/projets";
import { FORMATS_PAGE, type Format } from "../modele/types";

export function Redimensionner({ fermer }: { fermer: () => void }) {
  const actuel = useEditeur((s) => s.document.format);
  const [choix, setChoix] = useState<Format>(actuel);
  const [libre, setLibre] = useState({ largeur: String(actuel.largeur), hauteur: String(actuel.hauteur) });
  const [occupe, setOccupe] = useState(false);

  const formatLibre = (): Format | null => {
    const l = Math.round(Number(libre.largeur));
    const h = Math.round(Number(libre.hauteur));
    return l >= 16 && h >= 16 && l <= 20000 && h <= 20000 ? { largeur: l, hauteur: h } : null;
  };
  const estLibre = !FORMATS_PAGE.some((f) => f.largeur === choix.largeur && f.hauteur === choix.hauteur);
  const identique = choix.largeur === actuel.largeur && choix.hauteur === actuel.hauteur;

  const appliquer = async (copie: boolean) => {
    setOccupe(true);
    try {
      if (copie) {
        await enregistrerMaintenant();
        await faireUneCopie();
      }
      useEditeur.getState().modifierFormat(choix, true);
      useEditeur.getState().definirZoom(null);
      fermer();
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onMouseDown={fermer}>
      <div className="w-[520px] rounded-2xl bg-white p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center">
          <p className="text-base font-semibold text-neutral-900">Redimensionner</p>
          <span className="flex-1" />
          <button onClick={fermer} className="rounded p-1 text-neutral-500 hover:bg-neutral-100" title="Fermer">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-xs text-neutral-500">
          Format actuel : {actuel.largeur} × {actuel.hauteur} px. Le contenu est mis à l'échelle et centré ; ajuste ensuite la mise en page.
        </p>
        <div className="mb-3 grid max-h-72 grid-cols-2 gap-2 overflow-y-auto defilement-fin">
          {FORMATS_PAGE.map((f) => {
            const choisi = f.largeur === choix.largeur && f.hauteur === choix.hauteur;
            return (
              <button
                key={f.id}
                onClick={() => setChoix({ largeur: f.largeur, hauteur: f.hauteur })}
                className={`rounded-lg border px-3 py-2 text-left ${choisi ? "border-accent-600 bg-accent-50" : "border-neutral-200 hover:bg-neutral-50"}`}
              >
                <span className="block text-sm font-medium text-neutral-800">{f.libelle}</span>
                <span className="block text-[11px] text-neutral-500">
                  {f.usage} · {f.largeur} × {f.hauteur}
                </span>
              </button>
            );
          })}
        </div>
        <div className={`mb-5 flex items-center gap-2 rounded-lg border px-3 py-2 ${estLibre ? "border-accent-600 bg-accent-50" : "border-neutral-200"}`}>
          <span className="text-sm text-neutral-700">Taille libre</span>
          <input
            className="h-8 w-20 rounded-md border border-neutral-300 px-2 text-sm"
            value={libre.largeur}
            onChange={(e) => setLibre({ ...libre, largeur: e.target.value })}
            onBlur={() => formatLibre() && setChoix(formatLibre()!)}
            title="Largeur en pixels"
          />
          <span className="text-neutral-400">×</span>
          <input
            className="h-8 w-20 rounded-md border border-neutral-300 px-2 text-sm"
            value={libre.hauteur}
            onChange={(e) => setLibre({ ...libre, hauteur: e.target.value })}
            onBlur={() => formatLibre() && setChoix(formatLibre()!)}
            title="Hauteur en pixels"
          />
          <span className="text-xs text-neutral-500">px</span>
        </div>
        <div className="flex gap-2">
          <button
            disabled={occupe || identique}
            onClick={() => void appliquer(true)}
            className="flex-1 rounded-lg bg-accent-600 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50"
          >
            Copier et redimensionner
          </button>
          <button
            disabled={occupe || identique}
            onClick={() => void appliquer(false)}
            className="flex-1 rounded-lg border border-neutral-300 py-2 text-sm text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
          >
            Redimensionner ce design
          </button>
        </div>
      </div>
    </div>
  );
}
