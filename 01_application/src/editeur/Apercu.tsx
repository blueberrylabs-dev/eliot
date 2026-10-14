// L'aperçu en plein écran : la page seule, sans l'interface, pour juger le résultat comme le
// verra le public. Flèches pour changer de page, Échap pour sortir.

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Group, Layer, Stage } from "react-konva";
import { pageCourante, useEditeur } from "../etat/editeur";
import { pleinEcran } from "../pont/tauri";
import { PageStatique } from "./RenduElement";

export function Apercu() {
  const page = useEditeur(pageCourante);
  const format = useEditeur((s) => s.document.format);
  const pages = useEditeur((s) => s.document.pages);
  const rang = pages.findIndex((p) => p.id === page.id);
  const [taille, setTaille] = useState({ l: window.innerWidth, h: window.innerHeight });
  const etat = useEditeur.getState();

  useEffect(() => {
    void pleinEcran(true);
    const surTaille = () => setTaille({ l: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", surTaille);
    return () => {
      window.removeEventListener("resize", surTaille);
      void pleinEcran(false);
    };
  }, []);

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      const { document: d, pageActive } = useEditeur.getState();
      const i = d.pages.findIndex((p) => p.id === pageActive);
      if (e.key === "Escape" || e.key === "F11") useEditeur.getState().basculerApercu(false);
      else if ((e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") && i < d.pages.length - 1) useEditeur.getState().allerALaPage(d.pages[i + 1].id);
      else if ((e.key === "ArrowLeft" || e.key === "PageUp") && i > 0) useEditeur.getState().allerALaPage(d.pages[i - 1].id);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", surTouche, true);
    return () => window.removeEventListener("keydown", surTouche, true);
  }, []);

  const echelle = Math.min(taille.l / format.largeur, taille.h / format.hauteur);
  const l = format.largeur * echelle;
  const h = format.hauteur * echelle;
  const fleche = "absolute top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/25 disabled:opacity-0";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div style={{ width: l, height: h }}>
        <Stage width={l} height={h} listening={false}>
          <Layer listening={false}>
            <Group scaleX={echelle} scaleY={echelle}>
              <PageStatique page={page} format={format} />
            </Group>
          </Layer>
        </Stage>
      </div>
      <button className={`${fleche} left-4`} disabled={rang <= 0} onClick={() => etat.allerALaPage(pages[rang - 1].id)} title="Page précédente">
        <ChevronLeft size={28} />
      </button>
      <button className={`${fleche} right-4`} disabled={rang >= pages.length - 1} onClick={() => etat.allerALaPage(pages[rang + 1].id)} title="Page suivante">
        <ChevronRight size={28} />
      </button>
      <div className="absolute top-4 right-4 flex items-center gap-3 text-sm text-white/70">
        {pages.length > 1 && (
          <span className="tabular-nums">
            {rang + 1} / {pages.length}
          </span>
        )}
        <button className="rounded-full bg-white/10 p-2 text-white hover:bg-white/25" onClick={() => etat.basculerApercu(false)} title="Quitter (Échap)">
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
