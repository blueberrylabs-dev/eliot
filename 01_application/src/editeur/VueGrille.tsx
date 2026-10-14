// Toutes les pages d'un coup d'œil, pour les réordonner (un carrousel, une story en
// plusieurs écrans). Un clic ouvre la page.

import { Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditeur } from "../etat/editeur";
import { glisserPourReordonner } from "./reordonner";
import { Vignette } from "./Vignette";

export function VueGrille() {
  const pages = useEditeur(useShallow((s) => s.document.pages));
  const format = useEditeur((s) => s.document.format);
  const active = useEditeur((s) => s.pageActive);
  const etat = useEditeur.getState();
  const cases = useRef<(HTMLDivElement | null)[]>([]);
  const [cible, setCible] = useState<number | null>(null);
  const largeur = format.largeur >= format.hauteur ? 240 : Math.round((240 * format.largeur) / format.hauteur);

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto bg-[#e9e7e2] p-6 defilement-fin">
      <div className="mb-4 flex items-center">
        <p className="text-sm font-semibold text-neutral-800">Toutes les pages</p>
        <p className="ml-3 text-xs text-neutral-500">Glisse une page pour changer son ordre ; clique pour l'ouvrir.</p>
        <span className="flex-1" />
        <button className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-neutral-700 hover:bg-white" onClick={() => etat.basculerVueGrille()}>
          <X size={16} /> Fermer
        </button>
      </div>
      <div className="flex flex-wrap gap-6">
        {pages.map((p, rang) => (
          <div
            key={p.id}
            ref={(n) => {
              cases.current[rang] = n;
            }}
            className="relative"
            onPointerDown={(e) =>
              glisserPourReordonner(e, () => cases.current.slice(0, pages.length).map((c) => c!.getBoundingClientRect()), {
                surCible: setCible,
                surLacher: (r) => etat.deplacerPage(p.id, r),
                surClic: () => {
                  etat.allerALaPage(p.id);
                  etat.basculerVueGrille();
                },
              })
            }
          >
            {cible === rang && <span className="absolute top-0 -left-3.5 h-full w-1 rounded bg-accent-600" />}
            <div className={`cursor-pointer overflow-hidden rounded-lg border-2 bg-white shadow-sm ${p.id === active ? "border-accent-600" : "border-transparent hover:border-neutral-400"}`}>
              <Vignette page={p} format={format} largeur={largeur} />
            </div>
            <p className="mt-1.5 text-center text-xs text-neutral-600">Page {rang + 1}</p>
          </div>
        ))}
        <button
          onClick={() => etat.ajouterPage()}
          className="flex items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 text-neutral-500 hover:border-accent-500 hover:text-accent-600"
          style={{ width: largeur, height: Math.round((largeur * format.hauteur) / format.largeur) }}
          title="Ajouter une page"
        >
          <Plus size={28} />
        </button>
      </div>
    </div>
  );
}
