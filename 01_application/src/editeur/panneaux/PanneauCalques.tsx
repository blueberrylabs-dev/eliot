import { Eye, EyeOff, Film, Image as IconeImage, Lock, LockOpen, Shapes, Type } from "lucide-react";
import { elementsCourants, useEditeur } from "../../etat/editeur";
import { nomElement } from "../../modele/fabriques";

export function PanneauCalques() {
  const elements = useEditeur(elementsCourants);
  const selection = useEditeur((s) => s.selection);
  const etat = useEditeur.getState();
  // Du dessus vers le dessous, comme on les voit.
  const liste = [...elements].reverse();
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-neutral-800">Calques</p>
      <p className="mb-3 text-xs text-neutral-500">Le haut de la liste est au premier plan. Ctrl+↑ et Ctrl+↓ font monter ou descendre la sélection.</p>
      {liste.length === 0 && <p className="text-xs text-neutral-500">La page est vide.</p>}
      <div className="flex flex-col gap-1">
        {liste.map((el) => {
          const choisi = selection.includes(el.id);
          return (
            <div
              key={el.id}
              onClick={(e) => (e.shiftKey ? etat.basculerDansSelection(el.id) : etat.selectionnerSeul(el.id))}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${choisi ? "border-accent-500 bg-accent-50" : "border-transparent hover:bg-neutral-100"} ${el.visible ? "" : "opacity-50"}`}
            >
              <span className="text-neutral-500">{el.type === "texte" ? <Type size={15} /> : el.type === "image" ? <IconeImage size={15} /> : el.type === "video" ? <Film size={15} /> : <Shapes size={15} />}</span>
              <span className="flex-1 truncate text-neutral-800">{nomElement(el)}</span>
              {el.groupe && <span className="rounded bg-neutral-100 px-1 text-[10px] text-neutral-500" title="Fait partie d'un groupe">groupe</span>}
              <button
                title={el.visible ? "Masquer" : "Afficher"}
                className="rounded p-1 text-neutral-500 hover:bg-neutral-200"
                onClick={(e) => {
                  e.stopPropagation();
                  etat.basculerVisibilite(el.id);
                }}
              >
                {el.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button
                title={el.verrouille ? "Déverrouiller" : "Verrouiller"}
                className="rounded p-1 text-neutral-500 hover:bg-neutral-200"
                onClick={(e) => {
                  e.stopPropagation();
                  etat.modifierElements({ [el.id]: { verrouille: !el.verrouille } });
                }}
              >
                {el.verrouille ? <Lock size={14} /> : <LockOpen size={14} />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
