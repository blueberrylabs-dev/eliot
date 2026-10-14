// Savoir si un élément de la page est apparu à l'écran (une seule fois) : une police ou une
// vignette ne se charge que lorsqu'on la voit.

import { useEffect, useRef, useState } from "react";

export function useApparu<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [apparu, setApparu] = useState(false);
  useEffect(() => {
    const noeud = ref.current;
    if (!noeud || apparu) return;
    const observateur = new IntersectionObserver((entrees) => {
      if (entrees.some((e) => e.isIntersecting)) {
        setApparu(true);
        observateur.disconnect();
      }
    });
    observateur.observe(noeud);
    return () => observateur.disconnect();
  }, [apparu]);
  return [ref, apparu];
}
