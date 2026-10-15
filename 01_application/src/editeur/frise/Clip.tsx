// Un clip de la frise : un rectangle de la longueur de son temps, à la couleur de son genre.
// Une vidéo montre sa bande de vignettes et sa forme d'onde, à l'endroit de sa coupe.

import { Film, Image as IconeImage, Shapes, Type } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { useEditeur } from "../../etat/editeur";
import { nomElement } from "../../modele/fabriques";
import type { ElementPage, ElementVideo, Ressource } from "../../modele/types";
import { ondeVideo, type Onde } from "../../pont/tauri";
import { useUrlRessource } from "../images";

/** Au plus autant de vignettes par clip : au-delà, la frise est trop zoomée pour les voir. */
const VIGNETTES_MAX = 160;

function BandeVignettes({ el, ressource, largeur, hauteur }: { el: ElementVideo; ressource: Ressource; largeur: number; hauteur: number }) {
  const url = useUrlRessource(el.ressource, "vignettes");
  const couverture = useUrlRessource(el.ressource, "miniature");
  const v = ressource.video!.vignettes;
  const duree = ressource.video!.duree;
  if (!url || v.nombre === 0) {
    return couverture ? <div className="absolute inset-0 opacity-80" style={{ backgroundImage: `url(${couverture})`, backgroundSize: "auto 100%", backgroundRepeat: "repeat-x" }} /> : null;
  }
  const largeurTuile = (hauteur * v.largeur) / v.hauteur;
  const nombre = Math.min(VIGNETTES_MAX, Math.ceil(largeur / largeurTuile));
  const debut = el.coupe?.debut ?? 0;
  const fin = Math.min(el.coupe?.fin ?? duree, duree);
  return (
    <div className="absolute inset-0 overflow-hidden">
      {Array.from({ length: nombre }, (_, i) => {
        const x = i * largeurTuile;
        const instant = debut + ((x + largeurTuile / 2) / Math.max(1, largeur)) * (fin - debut);
        const rang = Math.max(0, Math.min(v.nombre - 1, Math.floor(instant / v.intervalle)));
        return (
          <div
            key={i}
            className="absolute top-0"
            style={{ left: x, width: largeurTuile, height: hauteur, backgroundImage: `url(${url})`, backgroundSize: `${v.nombre * largeurTuile}px ${hauteur}px`, backgroundPosition: `${-rang * largeurTuile}px 0` }}
          />
        );
      })}
    </div>
  );
}

function FormeOnde({ el, ressource, largeur }: { el: ElementVideo; ressource: Ressource; largeur: number }) {
  const projet = useEditeur((s) => s.projet);
  const [onde, setOnde] = useState<Onde | null>(null);
  const toile = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!projet || !ressource.video?.son) return;
    let actif = true;
    void ondeVideo(projet, el.ressource).then((o) => actif && setOnde(o));
    return () => {
      actif = false;
    };
  }, [projet, el.ressource, ressource.video?.son]);
  const l = Math.max(1, Math.min(8000, Math.round(largeur)));
  useEffect(() => {
    const c = toile.current?.getContext("2d");
    if (!c || !onde) return;
    const h = 14;
    c.clearRect(0, 0, l, h);
    c.fillStyle = "rgba(255,255,255,0.75)";
    const duree = ressource.video!.duree;
    const debut = el.coupe?.debut ?? 0;
    const fin = Math.min(el.coupe?.fin ?? duree, duree);
    // Le son le plus fort du fichier prend toute la hauteur ; un fichier presque muet reste
    // plat (plancher à 10 sur 100).
    const plusFort = Math.max(10, ...onde.pics);
    for (let x = 0; x < l; x += 2) {
      const instant = debut + (x / l) * (fin - debut);
      const pic = onde.pics[Math.min(onde.pics.length - 1, Math.floor((instant / 1000) * onde.par_seconde))] ?? 0;
      const haut = Math.max(1, (pic / plusFort) * h);
      c.fillRect(x, h - haut, 1.5, haut);
    }
  }, [onde, l, el.coupe?.debut, el.coupe?.fin, ressource]);
  if (!onde) return null;
  return <canvas ref={toile} width={l} height={14} className="absolute bottom-0 left-0" style={{ width: largeur, height: 14 }} />;
}

const COULEURS: Record<string, string> = {
  video: "bg-teal-800",
  image: "bg-sky-700",
  texte: "bg-violet-600",
};

function Icone({ el }: { el: ElementPage }) {
  if (el.type === "video") return <Film size={12} />;
  if (el.type === "image") return <IconeImage size={12} />;
  if (el.type === "texte") return <Type size={12} />;
  return <Shapes size={12} />;
}

interface ProprietesClip {
  el: ElementPage;
  /** Pixels par milliseconde. */
  echelle: number;
  hauteur: number;
  choisi: boolean;
  ressource?: Ressource;
  surCorps: (e: React.PointerEvent<HTMLDivElement>, el: ElementPage) => void;
  surBord: (e: React.PointerEvent<HTMLDivElement>, el: ElementPage, cote: "debut" | "fin") => void;
}

export const Clip = memo(function Clip({ el, echelle, hauteur, choisi, ressource, surCorps, surBord }: ProprietesClip) {
  if (!el.temps) return null;
  const gauche = el.temps.debut * echelle;
  const largeur = Math.max(2, (el.temps.fin - el.temps.debut) * echelle);
  const secondes = ((el.temps.fin - el.temps.debut) / 1000).toFixed(1).replace(".", ",");
  return (
    <div
      data-clip={el.id}
      title={`${nomElement(el)} (${secondes} s)`}
      onPointerDown={(e) => surCorps(e, el)}
      className={`absolute top-1 cursor-grab overflow-hidden rounded-md text-[11px] text-white select-none ${COULEURS[el.type] ?? "bg-amber-600"} ${choisi ? "ring-2 ring-white" : "ring-1 ring-black/40"} ${el.verrouille ? "opacity-60" : ""}`}
      style={{ left: gauche, width: largeur, height: hauteur - 8 }}
    >
      {el.type === "video" && ressource?.video && <BandeVignettes el={el} ressource={ressource} largeur={largeur} hauteur={hauteur - 8} />}
      {el.type === "video" && ressource?.video && <FormeOnde el={el} ressource={ressource} largeur={largeur} />}
      <span className="relative flex items-center gap-1 truncate px-1.5 pt-0.5 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
        <Icone el={el} />
        <span className="truncate">{nomElement(el)}</span>
        {largeur > 90 && <span className="ml-auto shrink-0 text-white/75 tabular-nums">{secondes} s</span>}
      </span>
      {!el.verrouille && (
        <>
          <div data-bord="debut" onPointerDown={(e) => surBord(e, el, "debut")} className="absolute top-0 left-0 h-full w-2 cursor-ew-resize bg-white/0 hover:bg-white/40" />
          <div data-bord="fin" onPointerDown={(e) => surBord(e, el, "fin")} className="absolute top-0 right-0 h-full w-2 cursor-ew-resize bg-white/0 hover:bg-white/40" />
        </>
      )}
    </div>
  );
});
