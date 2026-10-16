// Le pinceau du détourage sur la page (étape 5, lot 7) : un cercle de la taille du pinceau suit
// la souris ; un glisser « efface » ce qui reste du fond ou « garde » ce que le modèle a retiré,
// un coup par geste. Calque de l'interface, au-dessus de la page, jamais dans l'export.

import type Konva from "konva";
import { useEffect, useRef } from "react";
import { Circle, Group, Shape } from "react-konva";
import { elementsCourants, useEditeur } from "../etat/editeur";
import type { ElementImage } from "../modele/types";
import { commencerCoup, finirCoup, pageVersImage, pixelsImageParPixelPage, prolongerCoup, useDetourage } from "./detourage";
import { dimensionsOriginal } from "./recadrage";

export function CadrePinceau({ echelle }: { echelle: number }) {
  const id = useDetourage((s) => s.pinceau);
  const reglage = useDetourage((s) => s.reglage);
  const el = useEditeur((s) => (id ? (elementsCourants(s).find((e) => e.id === id && e.type === "image") as ElementImage | undefined) : undefined));
  const racine = useRef<Konva.Group>(null);
  const curseur = useRef<Konva.Circle>(null);
  const enCours = useRef(false);

  useEffect(() => {
    const pointPage = (e: MouseEvent) => {
      const stage = racine.current?.getStage();
      if (!stage) return null;
      stage.setPointersPositions(e);
      const p = stage.getPointerPosition();
      return p ? racine.current!.getAbsoluteTransform().copy().invert().point(p) : null;
    };
    const bouger = (e: MouseEvent) => {
      const p = pointPage(e);
      const c = curseur.current;
      if (!p || !c) return;
      c.position(p);
      c.visible(true);
      c.getLayer()?.batchDraw();
      if (!enCours.current) return;
      const id = useDetourage.getState().pinceau;
      const el = id ? (elementsCourants(useEditeur.getState()).find((x) => x.id === id) as ElementImage | undefined) : undefined;
      const d = el && dimensionsOriginal(el);
      const q = el && d && pageVersImage(el, d[0], d[1], p.x, p.y);
      if (q) prolongerCoup(q);
    };
    const lacher = () => {
      if (!enCours.current) return;
      enCours.current = false;
      finirCoup();
    };
    window.addEventListener("mousemove", bouger);
    window.addEventListener("mouseup", lacher);
    return () => {
      window.removeEventListener("mousemove", bouger);
      window.removeEventListener("mouseup", lacher);
    };
  }, []);

  if (!el) return null;
  const k = 1 / echelle;
  const commencer = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return;
    e.cancelBubble = true;
    e.evt.preventDefault();
    const s = e.target.getStage()?.getPointerPosition();
    const d = dimensionsOriginal(el);
    if (!s || !racine.current || !d) return;
    const p = racine.current.getAbsoluteTransform().copy().invert().point(s);
    const q = pageVersImage(el, d[0], d[1], p.x, p.y);
    if (!q) return;
    // Le rayon : la moitié du diamètre à l'écran, en pixels de l'image sous le pinceau, puis en
    // fraction de son grand côté.
    const rayon = ((reglage.taille / 2) * k * pixelsImageParPixelPage(el, d[0], d[1], p.x, p.y)) / Math.max(d[0], d[1]);
    enCours.current = commencerCoup(el.id, q, rayon);
  };
  const r = (reglage.taille / 2) * k;

  return (
    <Group ref={racine}>
      {/* Toute la vue : un coup peut commencer au bord, ou hors de la photo. */}
      <Shape
        name="pinceau-zone"
        sceneFunc={() => {}}
        hitFunc={(ctx, forme) => {
          ctx.beginPath();
          ctx.rect(-1e5, -1e5, 2e5, 2e5);
          ctx.fillStrokeShape(forme);
        }}
        onMouseDown={commencer}
        onMouseEnter={() => {
          const s = racine.current?.getStage();
          if (s) s.container().style.cursor = "none";
        }}
        onMouseLeave={() => {
          const s = racine.current?.getStage();
          if (s) s.container().style.cursor = "";
          curseur.current?.visible(false);
          curseur.current?.getLayer()?.batchDraw();
        }}
      />
      <Circle ref={curseur} name="pinceau-curseur" visible={false} radius={r} stroke="#ffffff" strokeWidth={1.5 * k} shadowColor="#000000" shadowBlur={2 * k} shadowOpacity={0.8} listening={false} dash={reglage.mode === "garder" ? undefined : [4 * k, 3 * k]} />
    </Group>
  );
}
