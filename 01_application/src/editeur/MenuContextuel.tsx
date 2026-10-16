// Le menu du clic droit (et du bouton « plus » de la mini-barre).

import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, ClipboardCopy, ClipboardPaste, Copy, CopyPlus, Eye, EyeOff, Group, Lock, LockOpen, Paintbrush, Trash2, Ungroup } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { elementsSelectionnes, useEditeur } from "../etat/editeur";
import { collerAvecImages } from "../etat/projets";
import { collerReglages, copierReglages, useLabo } from "../labo/retouche";

interface Proprietes {
  x: number;
  y: number;
  fermer: () => void;
}

export function MenuContextuel({ x, y, fermer }: Proprietes) {
  const boite = useRef<HTMLDivElement>(null);
  const selection = useEditeur((s) => s.selection);
  const choisis = useEditeur(useShallow(elementsSelectionnes));
  const pressePapiers = useEditeur((s) => s.pressePapiers);
  const copieReglages = useLabo((s) => !!s.copie);
  const etat = useEditeur.getState();

  useEffect(() => {
    const dehors = (e: MouseEvent) => {
      if (!boite.current?.contains(e.target as Node)) fermer();
    };
    const echap = (e: KeyboardEvent) => e.key === "Escape" && fermer();
    window.addEventListener("mousedown", dehors);
    window.addEventListener("keydown", echap);
    return () => {
      window.removeEventListener("mousedown", dehors);
      window.removeEventListener("keydown", echap);
    };
  }, [fermer]);

  const action = (fn: () => void) => () => {
    fn();
    fermer();
  };
  const aSelection = selection.length > 0;
  const verrouille = choisis.some((e) => e.verrouille);
  // Le labo photo : copier et coller les réglages d'une photo à l'autre.
  const photos = choisis.length > 0 && choisis.every((e) => e.type === "image");
  const masque = choisis.length === 1 && !choisis[0].visible;
  const groupes = new Set(choisis.map((e) => e.groupe ?? e.id));
  const groupe = choisis.length > 1 && groupes.size === 1 && !!choisis[0].groupe;

  const Ligne = ({ icone, libelle, raccourci, surClic, inactif }: { icone: ReactNode; libelle: string; raccourci?: string; surClic: () => void; inactif?: boolean }) => (
    <button
      className="flex w-full items-center gap-3 rounded-md px-2.5 py-1.5 text-left text-sm text-neutral-800 hover:bg-neutral-100 disabled:text-neutral-400 disabled:hover:bg-transparent"
      onClick={surClic}
      disabled={inactif}
    >
      <span className="text-neutral-500">{icone}</span>
      <span className="flex-1">{libelle}</span>
      {raccourci && <span className="text-xs text-neutral-400">{raccourci}</span>}
    </button>
  );
  const Separateur = () => <div className="my-1 h-px bg-neutral-200" />;

  return (
    <div ref={boite} className="absolute z-20 w-60 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg" style={{ left: x, top: y }}>
      <Ligne icone={<Copy size={15} />} libelle="Copier" raccourci="Ctrl+C" inactif={!aSelection} surClic={action(etat.copierSelection)} />
      <Ligne icone={<ClipboardPaste size={15} />} libelle="Coller" raccourci="Ctrl+V" inactif={pressePapiers.elements.length === 0} surClic={action(() => void collerAvecImages())} />
      <Ligne icone={<CopyPlus size={15} />} libelle="Dupliquer" raccourci="Ctrl+D" inactif={!aSelection} surClic={action(etat.dupliquerSelection)} />
      <Ligne icone={<Trash2 size={15} />} libelle="Supprimer" raccourci="Suppr" inactif={!aSelection || verrouille} surClic={action(etat.supprimerSelection)} />
      <Ligne icone={<Paintbrush size={15} />} libelle="Copier le style" raccourci="Ctrl+Alt+C" inactif={choisis.length !== 1} surClic={action(etat.copierStyle)} />
      {photos && (
        <>
          <Ligne icone={<ClipboardCopy size={15} />} libelle="Copier les réglages" raccourci="Ctrl+Maj+C" inactif={choisis.length !== 1} surClic={action(() => copierReglages())} />
          <Ligne icone={<ClipboardPaste size={15} />} libelle="Coller les réglages" raccourci="Ctrl+Maj+V" inactif={!copieReglages} surClic={action(() => collerReglages())} />
        </>
      )}
      {choisis.length > 1 && (
        <Ligne
          icone={groupe ? <Ungroup size={15} /> : <Group size={15} />}
          libelle={groupe ? "Dégrouper" : "Grouper"}
          raccourci={groupe ? "Ctrl+Maj+G" : "Ctrl+G"}
          surClic={action(() => (groupe ? etat.degrouperSelection() : etat.grouperSelection()))}
        />
      )}
      <Separateur />
      <Ligne icone={<ArrowUpToLine size={15} />} libelle="Premier plan" raccourci="Ctrl+Maj+↑" inactif={!aSelection} surClic={action(() => etat.deplacerDansPile("premier"))} />
      <Ligne icone={<ArrowUp size={15} />} libelle="Avancer" raccourci="Ctrl+↑" inactif={!aSelection} surClic={action(() => etat.deplacerDansPile("avant"))} />
      <Ligne icone={<ArrowDown size={15} />} libelle="Reculer" raccourci="Ctrl+↓" inactif={!aSelection} surClic={action(() => etat.deplacerDansPile("arriere"))} />
      <Ligne icone={<ArrowDownToLine size={15} />} libelle="Arrière-plan" raccourci="Ctrl+Maj+↓" inactif={!aSelection} surClic={action(() => etat.deplacerDansPile("dernier"))} />
      <Separateur />
      <Ligne icone={verrouille ? <LockOpen size={15} /> : <Lock size={15} />} libelle={verrouille ? "Déverrouiller" : "Verrouiller"} inactif={!aSelection} surClic={action(etat.basculerVerrou)} />
      <Ligne
        icone={masque ? <Eye size={15} /> : <EyeOff size={15} />}
        libelle={masque ? "Afficher" : "Masquer"}
        inactif={choisis.length !== 1}
        surClic={action(() => choisis[0] && etat.basculerVisibilite(choisis[0].id))}
      />
    </div>
  );
}
