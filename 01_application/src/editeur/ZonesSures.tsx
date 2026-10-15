// Les zones sûres sur une page vidéo verticale (étape 4, lot 4) : un calque d'aide, jamais
// exporté, qui montre où TikTok, Reels ou Shorts posent leurs boutons et leurs légendes, et le
// bouton de la frise qui le choisit.

import { ShieldCheck } from "lucide-react";
import { Group, Rect, Text } from "react-konva";
import { useTemps } from "../etat/temps";
import { estVerticale916, rectangleSur, ZONES_SURES, type IdZones } from "../modele/zonesSures";
import type { Format } from "../modele/types";
import { pilePolice } from "../polices";

/** Le calque, dans le repère de la page (à poser dans un groupe qui a la transformation de la
 *  page). Rien sur une page qui n'est pas en 9:16. */
export function CalqueZonesSures({ format }: { format: Format }) {
  const id = useTemps((s) => s.zonesSures);
  if (!id || !estVerticale916(format)) return null;
  const { largeur: L, hauteur: H } = format;
  const sur = rectangleSur(id);
  const taille = Math.round(L * 0.026);
  return (
    <Group listening={false} name="zones-sures">
      {ZONES_SURES[id].zones.map((z, i) => (
        <Group key={i}>
          <Rect x={z.x * L} y={z.y * H} width={z.largeur * L} height={z.hauteur * H} fill="rgba(239,68,68,0.22)" />
          {z.libelle && z.largeur * L > taille * 3 && (
            <Text x={z.x * L + taille * 0.5} y={z.y * H + taille * 0.5} width={Math.max(0, z.largeur * L - taille)} text={z.libelle} fontSize={taille} fontFamily={pilePolice("Inter")} fontStyle="bold" fill="rgba(255,255,255,0.92)" shadowColor="#000000" shadowBlur={4} shadowOpacity={0.6} align={z.largeur > 0.5 ? "center" : "left"} />
          )}
        </Group>
      ))}
      <Rect x={sur.x * L} y={sur.y * H} width={sur.largeur * L} height={sur.hauteur * H} stroke="rgba(255,255,255,0.9)" strokeWidth={Math.max(2, L / 400)} dash={[L / 60, L / 90]} />
    </Group>
  );
}

const CHOIX: (IdZones | null)[] = [null, "tiktok", "reels", "shorts"];

/** Le choix des zones sûres, dans la barre de la frise. */
export function ChoixZonesSures({ format, bouton }: { format: Format; bouton: string }) {
  const id = useTemps((s) => s.zonesSures);
  const verticale = estVerticale916(format);
  return (
    <label className={`${bouton} ${id && verticale ? "bg-white/10" : ""}`} title={verticale ? "Zones sûres : où l'application pose ses boutons et sa légende (calque d'aide, jamais exporté)" : "Zones sûres : pour une page verticale en 9:16"}>
      <ShieldCheck size={16} />
      <select
        aria-label="Zones sûres"
        disabled={!verticale}
        value={id ?? ""}
        onChange={(e) => useTemps.getState().choisirZonesSures((e.target.value || null) as IdZones | null)}
        className="cursor-pointer bg-transparent text-sm text-zinc-200 outline-none disabled:cursor-default [&>option]:text-neutral-900"
      >
        {CHOIX.map((c) => (
          <option key={c ?? "aucune"} value={c ?? ""}>
            {c ? ZONES_SURES[c].nom : "Zones sûres"}
          </option>
        ))}
      </select>
    </label>
  );
}
