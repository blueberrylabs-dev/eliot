// Pendant une prise de voix (lot 6), par-dessus la zone de travail : le compte à rebours en
// grand, puis le témoin rouge de l'enregistrement. On regarde la vidéo en parlant, pas le
// panneau.

import { usePrise } from "../etat/prise";
import { dureeLisible } from "./videos";

export function IndicateurPrise() {
  const phase = usePrise((s) => s.phase);
  const compte = usePrise((s) => s.compte);
  const depuis = usePrise((s) => s.niveau?.prise ?? 0);
  if (phase === "compte") {
    return (
      <div data-compte-a-rebours={compte} className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
        <span className="flex h-32 w-32 items-center justify-center rounded-full bg-black/55 text-7xl font-bold text-white tabular-nums">{compte}</span>
      </div>
    );
  }
  if (phase === "enregistre") {
    return (
      <div data-temoin-prise className="pointer-events-none absolute top-14 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-sm font-medium text-white shadow">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" /> Enregistrement {dureeLisible(depuis)} · Espace pour arrêter
      </div>
    );
  }
  return null;
}
