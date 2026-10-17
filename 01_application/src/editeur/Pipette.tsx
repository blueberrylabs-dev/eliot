// La pipette à l'écran (étape 7, lot 4) : par-dessus la zone de travail, un viseur et une loupe
// qui grossit les pixels sous le pointeur, avec leur couleur. Un clic sur la page prend la
// couleur que l'on y voit (photos, retouches et objets compris) ; un clic à côté de la page,
// un clic droit ou Échap renoncent. Les gestes de la page ne reçoivent rien pendant ce temps.

import type Konva from "konva";
import { useEffect, useRef, useState, type PointerEvent as EvenementPointeur, type RefObject } from "react";
import { pageCourante, useEditeur } from "../etat/editeur";
import { prendreCouleur, usePipette } from "../etat/pipette";
import { useTemps } from "../etat/temps";
import { rendreZones } from "../export/rendu";
import { rgbEnHex } from "../modele/lisibilite";
import type { Format } from "../modele/types";

/** Pixels de l'écran montrés dans la loupe, de côté (impair : un pixel au centre). */
const COTE = 11;
const GROS = 9;
const LOUPE = COTE * GROS;

/** La couleur du calque de la page en un point de la zone (pixels CSS) ; `null` si la toile ne
 *  se lit pas (une image d'une autre origine la rendrait illisible) ou n'a rien en ce point. */
export function lireCalque(calque: Konva.Layer, x: number, y: number): string | null {
  const toile = calque.getCanvas();
  const k = toile.getPixelRatio();
  try {
    const d = toile.getContext()._context.getImageData(Math.floor(x * k), Math.floor(y * k), 1, 1).data;
    return d[3] === 0 ? null : rgbEnHex([d[0], d[1], d[2]]);
  } catch {
    return null;
  }
}

/** Repli : la page rendue hors écran, un pixel (la page vidéo, à la tête de lecture). */
async function couleurRendue(x: number, y: number): Promise<string> {
  const s = useEditeur.getState();
  const page = pageCourante(s);
  const instant = page.duree !== undefined ? useTemps.getState().tete : undefined;
  const [img] = await rendreZones(s.document.format, page, [{ page, zone: { x: Math.floor(x), y: Math.floor(y), largeur: 1, hauteur: 1 }, pixelRatio: 1, instant }], { sansEffets: true });
  return rgbEnHex([img.data[0], img.data[1], img.data[2]]);
}

interface Proprietes {
  calque: RefObject<Konva.Layer | null>;
  ox: number;
  oy: number;
  echelle: number;
  format: Format;
}

export function CouchePipette({ calque, ox, oy, echelle, format }: Proprietes) {
  const couche = useRef<HTMLDivElement>(null);
  const loupe = useRef<HTMLCanvasElement>(null);
  const [vue, setVue] = useState<{ x: number; y: number; hex: string | null } | null>(null);

  // Échap renonce, avant les raccourcis (qui, eux, ôteraient la sélection) ; un clic ailleurs
  // dans la fenêtre aussi, sauf sur un bouton de pipette (il en recommence une).
  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      usePipette.getState().finir();
    };
    const ailleurs = (e: PointerEvent) => {
      const cible = e.target as Element | null;
      if (couche.current?.contains(cible) || cible?.closest?.("[data-pipette]")) return;
      usePipette.getState().finir();
    };
    window.addEventListener("keydown", echap, true);
    window.addEventListener("pointerdown", ailleurs, true);
    return () => {
      window.removeEventListener("keydown", echap, true);
      window.removeEventListener("pointerdown", ailleurs, true);
    };
  }, []);

  const dansLaPage = (x: number, y: number) => {
    const px = (x - ox) / echelle;
    const py = (y - oy) / echelle;
    return px >= 0 && py >= 0 && px < format.largeur && py < format.hauteur ? { px, py } : null;
  };

  const point = (e: EvenementPointeur) => {
    const r = couche.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const surDeplace = (e: EvenementPointeur) => {
    const { x, y } = point(e);
    const c = calque.current;
    if (!c || !dansLaPage(x, y)) {
      setVue(null);
      return;
    }
    setVue({ x, y, hex: lireCalque(c, x, y) });
    // La loupe : les pixels de l'écran autour du pointeur, sans lissage.
    const toile = loupe.current?.getContext("2d");
    if (!toile) return;
    const source = c.getCanvas();
    const k = source.getPixelRatio();
    toile.imageSmoothingEnabled = false;
    toile.fillStyle = getComputedStyle(couche.current!).getPropertyValue("--color-plan").trim() || "#e9e7e2";
    toile.fillRect(0, 0, LOUPE, LOUPE);
    toile.drawImage(source._canvas, Math.floor(x * k) - (COTE - 1) / 2, Math.floor(y * k) - (COTE - 1) / 2, COTE, COTE, 0, 0, LOUPE, LOUPE);
    const m = ((COTE - 1) / 2) * GROS;
    toile.strokeStyle = "#ffffff";
    toile.lineWidth = 3;
    toile.strokeRect(m - 0.5, m - 0.5, GROS + 1, GROS + 1);
    toile.strokeStyle = "#1f1f1d";
    toile.lineWidth = 1;
    toile.strokeRect(m - 0.5, m - 0.5, GROS + 1, GROS + 1);
  };

  const surBas = async (e: EvenementPointeur) => {
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = point(e);
    const dans = dansLaPage(x, y);
    if (e.button !== 0 || !dans) {
      usePipette.getState().finir();
      return;
    }
    const c = calque.current;
    const hex = (c && lireCalque(c, x, y)) ?? (await couleurRendue(dans.px, dans.py));
    prendreCouleur(hex);
  };

  // La loupe se pose en bas à droite du pointeur ; près d'un bord, de l'autre côté.
  const largeurZone = couche.current?.clientWidth ?? 0;
  const hauteurZone = couche.current?.clientHeight ?? 0;
  const lx = vue && vue.x + 20 + LOUPE > largeurZone ? vue.x - 20 - LOUPE : (vue?.x ?? 0) + 20;
  const ly = vue && vue.y + 20 + LOUPE + 26 > hauteurZone ? vue.y - 20 - LOUPE - 26 : (vue?.y ?? 0) + 20;

  return (
    <div
      ref={couche}
      data-pipette-active
      className="absolute inset-0 z-30 cursor-crosshair"
      onPointerMove={surDeplace}
      onPointerLeave={() => setVue(null)}
      onPointerDown={(e) => void surBas(e)}
      onContextMenu={(e) => e.preventDefault()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div data-loupe-pipette className={`pointer-events-none absolute flex flex-col items-center gap-1 ${vue ? "" : "hidden"}`} style={{ left: lx, top: ly }}>
        <canvas ref={loupe} width={LOUPE} height={LOUPE} className="rounded-full border-2 border-white shadow-lg" style={{ width: LOUPE, height: LOUPE }} />
        <span className="flex items-center gap-1.5 rounded-md bg-neutral-900/90 px-2 py-0.5 font-mono text-xs text-white">
          <span className="h-3 w-3 rounded-sm border border-white/60" style={{ background: vue?.hex ?? "transparent" }} />
          {vue?.hex ?? "?"}
        </span>
      </div>
      <div data-aide-pipette className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-neutral-900/90 px-3 py-1 text-xs text-white">
        Clique sur la page pour en prendre la couleur. Échap pour annuler.
      </div>
    </div>
  );
}
