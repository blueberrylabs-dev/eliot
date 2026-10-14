// La vignette d'un modèle de départ : dessinée quand elle apparaît à l'écran, gardée ensuite.

import { useEffect, useState } from "react";
import { vignetteModele } from "../etat/modeles";
import type { ModeleDepart } from "../modeles/depart";
import { formatDuModele } from "../modeles/instancier";
import { useApparu } from "./apparu";

export function VignetteModele({ modele, surClic, occupe = false }: { modele: ModeleDepart; surClic: () => void; occupe?: boolean }) {
  const [ref, apparu] = useApparu<HTMLButtonElement>();
  const [url, setUrl] = useState<string | null>(null);
  const f = formatDuModele(modele);
  useEffect(() => {
    if (!apparu) return;
    let actif = true;
    vignetteModele(modele).then((u) => actif && setUrl(u), () => undefined);
    return () => {
      actif = false;
    };
  }, [apparu, modele]);
  return (
    <button ref={ref} data-modele={modele.id} title={modele.nom} onClick={surClic} disabled={occupe} className="group block w-full text-left disabled:opacity-60">
      <span className="flex items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-[#e9e7e2] group-hover:border-accent-500 group-hover:ring-2 group-hover:ring-accent-200" style={{ aspectRatio: `${f.largeur} / ${f.hauteur}` }}>
        {url ? <img src={url} alt={modele.nom} draggable={false} className="h-full w-full object-cover" /> : <span className="text-[10px] text-neutral-400">…</span>}
      </span>
      <span className="mt-1 block truncate text-[11px] text-neutral-600">{modele.nom}</span>
    </button>
  );
}
