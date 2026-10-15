// La mini-barre flottante au-dessus de la sélection : dupliquer, verrouiller, supprimer, et
// le menu « plus ». Elle s'efface pendant un geste, pendant la lecture d'une page vidéo, et
// quand rien de la sélection ne se voit à la tête de lecture.

import { Copy, Group, Lock, LockOpen, MoreHorizontal, Trash2, Ungroup } from "lucide-react";
import { useEffect, useState } from "react";
import { elementsCourants, useEditeur } from "../etat/editeur";
import { noeudElement, surGeste } from "./scene";
import { useTemps } from "../etat/temps";
import { visibleA } from "../modele/frise";

interface Proprietes {
  taille: { l: number; h: number };
  ouvrirMenu: (x: number, y: number) => void;
}

export function MiniBarre({ taille, ouvrirMenu }: Proprietes) {
  const selection = useEditeur((s) => s.selection);
  const documentCourant = useEditeur(elementsCourants);
  const enEdition = useEditeur((s) => s.enEdition);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [enGeste, setEnGeste] = useState(false);
  const joue = useTemps((s) => s.joue);
  const visible = useTemps((t) => documentCourant.some((e) => selection.includes(e.id) && visibleA(e, t.tete)));

  useEffect(() => surGeste(setEnGeste), []);

  useEffect(() => {
    // On attend que Konva ait dessiné la nouvelle position des objets.
    const image = requestAnimationFrame(() => {
      const boites = selection.map((id) => noeudElement(id)?.getClientRect()).filter((b) => !!b);
      if (boites.length === 0) return setPosition(null);
      const gauche = Math.min(...boites.map((b) => b.x));
      const droite = Math.max(...boites.map((b) => b.x + b.width));
      const haut = Math.min(...boites.map((b) => b.y));
      const bas = Math.max(...boites.map((b) => b.y + b.height));
      const x = Math.min(Math.max((gauche + droite) / 2, 90), taille.l - 90);
      const y = haut - 56 > 8 ? haut - 56 : Math.min(bas + 48, taille.h - 48);
      setPosition({ x, y });
    });
    return () => cancelAnimationFrame(image);
  }, [selection, documentCourant, taille, visible]);

  if (!position || enGeste || enEdition || selection.length === 0 || joue || !visible) return null;
  const etat = useEditeur.getState();
  const choisis = elementsCourants(etat).filter((e) => selection.includes(e.id));
  const verrouille = choisis.some((e) => e.verrouille);
  const groupes = new Set(choisis.map((e) => e.groupe ?? e.id));
  const groupe = choisis.length > 1 && groupes.size === 1 && !!choisis[0].groupe;
  const bouton = "flex h-8 w-8 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100";

  return (
    <div
      className="absolute z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-1 shadow-md"
      style={{ left: position.x, top: position.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {choisis.length > 1 && (
        <button className={bouton} title={groupe ? "Dégrouper (Ctrl+Maj+G)" : "Grouper (Ctrl+G)"} onClick={() => (groupe ? etat.degrouperSelection() : etat.grouperSelection())}>
          {groupe ? <Ungroup size={16} /> : <Group size={16} />}
        </button>
      )}
      <button className={bouton} title="Dupliquer (Ctrl+D)" onClick={() => etat.dupliquerSelection()}>
        <Copy size={16} />
      </button>
      <button className={bouton} title={verrouille ? "Déverrouiller" : "Verrouiller"} onClick={() => etat.basculerVerrou()}>
        {verrouille ? <LockOpen size={16} /> : <Lock size={16} />}
      </button>
      <button className={bouton} title="Supprimer (Suppr)" onClick={() => etat.supprimerSelection()}>
        <Trash2 size={16} />
      </button>
      <button
        className={bouton}
        title="Plus d'options"
        onClick={(e) => {
          const r = (e.currentTarget.closest(".relative") as HTMLElement).getBoundingClientRect();
          const b = e.currentTarget.getBoundingClientRect();
          ouvrirMenu(b.left - r.left, b.bottom - r.top + 4);
        }}
      >
        <MoreHorizontal size={16} />
      </button>
    </div>
  );
}
