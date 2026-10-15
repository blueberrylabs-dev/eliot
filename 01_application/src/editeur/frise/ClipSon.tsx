// Un son de la frise (étape 4, lot 5) : un rectangle de la longueur de son clip, à la couleur
// de son rôle (musique, voix, bruitage), avec sa forme d'onde. L'onde suit ce qui s'entend :
// la boucle, la coupe, le volume, les fondus et la musique qui baisse sous la voix.

import { AudioLines, Mic, Music, Repeat } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { useEditeur } from "../../etat/editeur";
import { boucle, gainClipSon, tempsMediaSon } from "../../modele/son";
import type { ClipAudio, Ressource, RoleSon } from "../../modele/types";
import { ondeRessource, type Onde } from "../../pont/tauri";

export const COULEURS_ROLE: Record<RoleSon, string> = {
  musique: "bg-emerald-700",
  voix: "bg-orange-600",
  bruitage: "bg-indigo-600",
};

export function IconeRole({ role, taille = 12 }: { role: RoleSon; taille?: number }) {
  if (role === "musique") return <Music size={taille} />;
  if (role === "voix") return <Mic size={taille} />;
  return <AudioLines size={taille} />;
}

/** Le nom d'un son pour la frise : le titre de son crédit, sinon son fichier sans extension. */
export const nomSon = (r: Ressource | undefined): string => r?.credit?.titre ?? r?.nom.replace(/\.[a-z0-9]{2,4}$/i, "") ?? "son";

function OndeSon({ clip, sons, ressource, largeur, hauteur }: { clip: ClipAudio; sons: readonly ClipAudio[]; ressource: Ressource; largeur: number; hauteur: number }) {
  const projet = useEditeur((s) => s.projet);
  const [onde, setOnde] = useState<Onde | null>(null);
  const toile = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!projet) return;
    let actif = true;
    void ondeRessource(projet, clip.ressource).then((o) => actif && setOnde(o));
    return () => {
      actif = false;
    };
  }, [projet, clip.ressource]);
  const l = Math.max(1, Math.min(8000, Math.round(largeur)));
  const h = Math.max(4, Math.round(hauteur));
  useEffect(() => {
    const c = toile.current?.getContext("2d");
    if (!c || !onde) return;
    c.clearRect(0, 0, l, h);
    c.fillStyle = "rgba(255,255,255,0.7)";
    const fichier = ressource.son?.duree ?? ressource.video?.duree;
    const longueur = clip.temps.fin - clip.temps.debut;
    const plusFort = Math.max(10, ...onde.pics);
    for (let x = 0; x < l; x += 2) {
      const t = clip.temps.debut + (x / l) * longueur;
      const instant = tempsMediaSon(clip, t, fichier);
      const pic = onde.pics[Math.min(onde.pics.length - 1, Math.floor((instant / 1000) * onde.par_seconde))] ?? 0;
      const haut = Math.max(1, (pic / plusFort) * h * gainClipSon(clip, t, sons));
      c.fillRect(x, (h - haut) / 2, 1.5, haut);
    }
  }, [onde, l, h, clip, sons, ressource]);
  if (!onde) return null;
  return <canvas ref={toile} width={l} height={h} className="pointer-events-none absolute bottom-1 left-0" style={{ width: largeur, height: h }} />;
}

interface ProprietesClipSon {
  clip: ClipAudio;
  sons: readonly ClipAudio[];
  ressource?: Ressource;
  echelle: number;
  hauteur: number;
  choisi: boolean;
  surCorps: (e: React.PointerEvent<HTMLDivElement>, c: ClipAudio) => void;
  surBord: (e: React.PointerEvent<HTMLDivElement>, c: ClipAudio, cote: "debut" | "fin") => void;
}

export const ClipSon = memo(function ClipSon({ clip, sons, ressource, echelle, hauteur, choisi, surCorps, surBord }: ProprietesClipSon) {
  const gauche = clip.temps.debut * echelle;
  const longueur = clip.temps.fin - clip.temps.debut;
  const largeur = Math.max(2, longueur * echelle);
  const secondes = (longueur / 1000).toFixed(1).replace(".", ",");
  const nom = nomSon(ressource);
  const h = hauteur - 8;
  return (
    <div
      data-son={clip.id}
      data-role={clip.role}
      title={`${nom} (${secondes} s${clip.jusquALaFin ? ", jusqu'à la fin" : boucle(clip) ? ", répété" : ""})`}
      onPointerDown={(e) => surCorps(e, clip)}
      className={`absolute top-1 cursor-grab overflow-hidden rounded-md text-[11px] text-white select-none ${COULEURS_ROLE[clip.role]} ${choisi ? "ring-2 ring-white" : "ring-1 ring-black/40"}`}
      style={{ left: gauche, width: largeur, height: h }}
    >
      {ressource && <OndeSon clip={clip} sons={sons} ressource={ressource} largeur={largeur} hauteur={h - 16} />}
      {/* Les fondus, en coins plus sombres. */}
      {!!clip.fonduEntree && <div className="pointer-events-none absolute top-0 left-0 h-full bg-gradient-to-r from-black/40 to-transparent" style={{ width: Math.min(largeur, clip.fonduEntree * echelle) }} />}
      {!!clip.fonduSortie && <div className="pointer-events-none absolute top-0 right-0 h-full bg-gradient-to-l from-black/40 to-transparent" style={{ width: Math.min(largeur, clip.fonduSortie * echelle) }} />}
      <span className="pointer-events-none relative flex items-center gap-1 truncate px-1.5 pt-0.5 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
        <IconeRole role={clip.role} />
        <span className="truncate">{nom}</span>
        {boucle(clip) && <Repeat size={11} className="shrink-0" aria-label="Répété" />}
        {largeur > 90 && <span className="ml-auto shrink-0 text-white/75 tabular-nums">{secondes} s</span>}
      </span>
      <div data-bord="debut" onPointerDown={(e) => surBord(e, clip, "debut")} className="absolute top-0 left-0 h-full w-2 cursor-ew-resize bg-white/0 hover:bg-white/40" />
      <div data-bord="fin" onPointerDown={(e) => surBord(e, clip, "fin")} className="absolute top-0 right-0 h-full w-2 cursor-ew-resize bg-white/0 hover:bg-white/40" />
    </div>
  );
});
