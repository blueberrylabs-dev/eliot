// Le mode « Tourner » d'un objet 3D sur la page (étape 6, lot 1) : la boîte de l'objet attrape
// la souris. Glisser tourne l'objet, Maj et glisser le décale, la molette le rapproche. Calque de
// l'interface, au-dessus de la page, jamais dans l'export.

import type Konva from "konva";
import { useEffect, useRef } from "react";
import { Group, Rect } from "react-konva";
import { elementsCourants, useEditeur } from "../etat/editeur";
import type { Camera3d, ElementObjet3d } from "../modele/types";
import { glisserOrbite, lacherOrbite, useOrbite } from "./orbite";

const ACCENT = "#4f46e5";

export function CadreOrbite({ echelle }: { echelle: number }) {
  const id = useOrbite((s) => s.id);
  const el = useEditeur((s) => (id ? (elementsCourants(s).find((e) => e.id === id && e.type === "objet3d") as ElementObjet3d | undefined) : undefined));
  const geste = useRef<{ x: number; y: number; depart: Camera3d; maj: boolean } | null>(null);
  const zone = useRef<Konva.Rect>(null);

  useEffect(() => {
    const bouger = (e: MouseEvent) => {
      const g = geste.current;
      const o = useOrbite.getState().id;
      const el = o ? (elementsCourants(useEditeur.getState()).find((x) => x.id === o) as ElementObjet3d | undefined) : undefined;
      if (!g || !el) return;
      glisserOrbite(g.depart, e.clientX - g.x, e.clientY - g.y, g.maj, el.hauteur * echelle, el.largeur / el.hauteur);
    };
    const lacher = () => {
      if (!geste.current) return;
      geste.current = null;
      const o = useOrbite.getState().id;
      if (o) lacherOrbite(o);
      const s = zone.current?.getStage()?.container();
      if (s) s.style.cursor = "grab";
    };
    window.addEventListener("mousemove", bouger);
    window.addEventListener("mouseup", lacher);
    return () => {
      window.removeEventListener("mousemove", bouger);
      window.removeEventListener("mouseup", lacher);
    };
  }, [echelle]);

  if (!el) return null;
  const k = 1 / echelle;
  return (
    <Group x={el.x} y={el.y} rotation={el.rotation}>
      <Rect
        ref={zone}
        name="orbite-zone"
        width={el.largeur}
        height={el.hauteur}
        fill="rgba(0,0,0,0.001)"
        stroke={ACCENT}
        strokeWidth={1.5 * k}
        dash={[6 * k, 4 * k]}
        onMouseEnter={(e) => {
          const s = e.target.getStage()?.container();
          if (s) s.style.cursor = "grab";
        }}
        onMouseLeave={(e) => {
          const s = e.target.getStage()?.container();
          if (s && !geste.current) s.style.cursor = "";
        }}
        onMouseDown={(e) => {
          if (e.evt.button !== 0) return;
          e.cancelBubble = true;
          e.evt.preventDefault();
          geste.current = { x: e.evt.clientX, y: e.evt.clientY, depart: el.camera, maj: e.evt.shiftKey };
          const s = e.target.getStage()?.container();
          if (s) s.style.cursor = "grabbing";
        }}
        onDblClick={(e) => {
          e.cancelBubble = true;
        }}
      />
    </Group>
  );
}
