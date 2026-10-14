// Les petites pièces communes aux barres de réglages : bouton, curseur, séparateur.

import type { ReactNode } from "react";

export const bouton = "flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md px-1.5 whitespace-nowrap text-neutral-700 hover:bg-neutral-100";
export const actif = "bg-accent-100 text-accent-700 hover:bg-accent-100";
export const separateur = <span className="mx-1.5 h-6 w-px bg-neutral-200" />;

export function Bouton({ titre, surClic, enfoncé, inactif, children }: { titre: string; surClic: () => void; enfoncé?: boolean; inactif?: boolean; children: ReactNode }) {
  return (
    <button title={titre} onClick={surClic} disabled={inactif} className={`${bouton} ${enfoncé ? actif : ""} disabled:cursor-not-allowed disabled:opacity-35`}>
      {children}
    </button>
  );
}

export function Curseur({ libelle, valeur, min, max, pas = 1, unite = "", surChange }: { libelle: string; valeur: number; min: number; max: number; pas?: number; unite?: string; surChange: (v: number) => void }) {
  return (
    <label className="mb-2 block text-xs text-neutral-600">
      <span className="mb-1 flex justify-between">
        {libelle}
        <span className="tabular-nums">
          {Number.isInteger(pas) ? Math.round(valeur) : valeur.toFixed(2)}
          {unite}
        </span>
      </span>
      <input type="range" min={min} max={max} step={pas} value={valeur} onChange={(e) => surChange(Number(e.target.value))} className="w-full accent-accent-600" />
    </label>
  );
}

