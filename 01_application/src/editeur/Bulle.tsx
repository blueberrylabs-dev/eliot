// Une bulle (petit panneau) ouverte par un bouton. Elle est posée par-dessus tout le reste
// (portail vers <body>), pour ne jamais être coupée par une barre qui défile.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Proprietes {
  titre: string;
  bouton: ReactNode;
  largeur?: number;
  children: ReactNode;
  classeBouton?: string;
}

export function Bulle({ titre, bouton, largeur = 240, children, classeBouton }: Proprietes) {
  const [ouverte, setOuverte] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const refBouton = useRef<HTMLButtonElement>(null);
  const refBulle = useRef<HTMLDivElement>(null);

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
      <button ref={refBouton} title={titre} onClick={basculer} className={classeBouton ?? "flex h-8 min-w-8 shrink-0 items-center justify-center gap-1 rounded-md px-1.5 whitespace-nowrap text-neutral-700 hover:bg-neutral-100"}>
        {bouton}
      </button>
      {ouverte &&
        createPortal(
          <div ref={refBulle} className="fixed z-50 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg" style={{ left: position.x, top: position.y, width: largeur }}>
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
