// Une bulle (petit panneau) ouverte par un bouton. Elle est posée par-dessus tout le reste
// (portail vers <body>), pour ne jamais être coupée par une barre qui défile.

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePipette } from "../etat/pipette";

interface Proprietes {
  titre: string;
  bouton: ReactNode;
  largeur?: number;
  children: ReactNode;
  classeBouton?: string;
  styleBouton?: CSSProperties;
  /** Attributs `data-…` du bouton (repères pour les essais). */
  donneesBouton?: Record<string, string>;
}

export function Bulle({ titre, bouton, largeur = 240, children, classeBouton, styleBouton, donneesBouton }: Proprietes) {
  const [ouverte, setOuverte] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const refBouton = useRef<HTMLButtonElement>(null);
  const refBulle = useRef<HTMLDivElement>(null);

  // Trop près du bas de la fenêtre (la frise), la bulle s'ouvre au-dessus du bouton.
  useLayoutEffect(() => {
    const b = refBulle.current;
    const r = refBouton.current?.getBoundingClientRect();
    if (!ouverte || !b || !r) return;
    const h = b.getBoundingClientRect().height;
    if (r.bottom + 6 + h > window.innerHeight - 8 && r.top - 6 - h > 8) setPosition((p) => (p.y === r.top - 6 - h ? p : { ...p, y: r.top - 6 - h }));
  }, [ouverte, position]);

  // Une pipette qui commence ferme la bulle : la page se voit en entier.
  useEffect(() => usePipette.subscribe((s, avant) => s.attente && !avant.attente && setOuverte(false)), []);

  useEffect(() => {
    if (!ouverte) return;
    const dehors = (e: MouseEvent) => {
      const cible = e.target as Node;
      if (!refBulle.current?.contains(cible) && !refBouton.current?.contains(cible)) setOuverte(false);
    };
    const echap = (e: KeyboardEvent) => e.key === "Escape" && setOuverte(false);
    window.addEventListener("mousedown", dehors);
    window.addEventListener("keydown", echap);
    return () => {
      window.removeEventListener("mousedown", dehors);
      window.removeEventListener("keydown", echap);
    };
  }, [ouverte]);

  const basculer = () => {
    const r = refBouton.current?.getBoundingClientRect();
    if (r) setPosition({ x: Math.min(r.left, window.innerWidth - largeur - 8), y: r.bottom + 6 });
    setOuverte(!ouverte);
  };

  return (
    <>
      {/* Le pointeur pressé ici ne regarde pas plus loin (la frise, dessous, y déplacerait la
          tête de lecture) ; les événements d'un portail remontent quand même vers ses parents. */}
      <button ref={refBouton} title={titre} onClick={basculer} onPointerDown={(e) => e.stopPropagation()} style={styleBouton} {...donneesBouton} className={classeBouton ?? "flex h-8 min-w-8 shrink-0 items-center justify-center gap-1 rounded-md px-1.5 whitespace-nowrap text-neutral-700 hover:bg-neutral-100"}>
        {bouton}
      </button>
      {ouverte &&
        createPortal(
          <div ref={refBulle} onPointerDown={(e) => e.stopPropagation()} className="fixed z-50 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg" style={{ left: position.x, top: position.y, width: largeur }}>
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
