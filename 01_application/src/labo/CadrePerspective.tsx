// Le mode « coins » de la perspective sur la page (étape 5, lot 6) : quatre poignées rondes aux
// coins du visuel, que l'on pose sur les coins d'un écran, d'une boîte ou d'une affiche ; le
// contour et la grille des tiers du visuel suivent la perspective ; un glisser dans le visuel le
// déplace. Calque de l'interface, au-dessus de la page, jamais dans l'export.

import type Konva from "konva";
import { useEffect, useRef } from "react";
import { Group, Shape } from "react-konva";
import { elementsCourants, etiquetteDeGeste, useEditeur } from "../etat/editeur";
import { homographie, projeter, type Point } from "../modele/perspective";
import type { ElementPage } from "../modele/types";
import { coinsDe, tirerCoin, usePerspective } from "./miseEnPerspective";
import type { PhotoOuClip } from "./recadrage";

type Contexte2D = CanvasRenderingContext2D;
const natif = (ctx: Konva.Context): Contexte2D => (ctx as unknown as { _context: Contexte2D })._context;

export function CadrePerspective({ echelle }: { echelle: number }) {
  const id = usePerspective((s) => s.id);
  const coinChoisi = usePerspective((s) => s.coin);
  const el = useEditeur((s) => (id ? (elementsCourants(s).find((e) => e.id === id && (e.type === "image" || e.type === "video")) as PhotoOuClip | undefined) : undefined));
  const racine = useRef<Konva.Group>(null);
  const geste = useRef<{ depart: PhotoOuClip; x: number; y: number; coin: number | null; etiquette: string } | null>(null);

  useEffect(() => {
    const pointPage = (e: MouseEvent) => {
      const stage = racine.current?.getStage();
      if (!stage) return null;
      stage.setPointersPositions(e);
      const p = stage.getPointerPosition();
      return p ? racine.current!.getAbsoluteTransform().copy().invert().point(p) : null;
    };
    const bouger = (e: MouseEvent) => {
      const g = geste.current;
      const p = g && pointPage(e);
      if (!g || !p) return;
      if (g.coin === null) {
        // Le visuel entier glisse.
        useEditeur.getState().modifierElements({ [g.depart.id]: { x: g.depart.x + p.x - g.x, y: g.depart.y + p.y - g.y } as Partial<ElementPage> }, g.etiquette);
      } else tirerCoin(g.depart, g.coin, p.x - g.x, p.y - g.y, g.etiquette);
    };
    const lacher = () => {
      if (!geste.current) return;
      geste.current = null;
      document.body.style.cursor = "";
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
  const coins = coinsDe(el);
  const plan = homographie(coins);
  const commencer = (e: Konva.KonvaEventObject<MouseEvent>, coin: number | null) => {
    if (e.evt.button !== 0) return;
    e.cancelBubble = true;
    e.evt.preventDefault();
    const p = e.target.getStage()?.getPointerPosition();
    if (!p || !racine.current) return;
    const q = racine.current.getAbsoluteTransform().copy().invert().point(p);
    geste.current = { depart: el, x: q.x, y: q.y, coin, etiquette: etiquetteDeGeste(`perspective:${el.id}:${coin ?? "tout"}`) };
    if (coin !== null) usePerspective.setState({ coin });
    document.body.style.cursor = coin === null ? "move" : "crosshair";
  };
  const montrer = (c: string) => () => {
    const s = racine.current?.getStage();
    if (s && !geste.current) s.container().style.cursor = c;
  };
  const trace = (ctx: Contexte2D, points: Point[]) => {
    ctx.moveTo(points[0][0], points[0][1]);
    for (const q of points.slice(1)) ctx.lineTo(q[0], q[1]);
  };

  return (
    <Group ref={racine}>
      <Group x={el.x} y={el.y} rotation={el.rotation}>
        <Group x={el.retourneH ? el.largeur : 0} y={el.retourneV ? el.hauteur : 0} scaleX={el.retourneH ? -1 : 1} scaleY={el.retourneV ? -1 : 1}>
          {/* Le visuel : on l'attrape pour le déplacer. */}
          <Shape
            name="perspective-visuel"
            sceneFunc={(ctx) => {
              const c = natif(ctx);
              c.save();
              // Le contour, puis la grille des tiers du visuel, projetés.
              c.beginPath();
              trace(c, coins);
              c.closePath();
              if (plan) {
                for (const t of [1 / 3, 2 / 3]) {
                  const a = projeter(plan, t, 0);
                  const b = projeter(plan, t, 1);
                  c.moveTo(a[0], a[1]);
                  c.lineTo(b[0], b[1]);
                  const d = projeter(plan, 0, t);
                  const f = projeter(plan, 1, t);
                  c.moveTo(d[0], d[1]);
                  c.lineTo(f[0], f[1]);
                }
              }
              c.lineWidth = 2.5 * k;
              c.strokeStyle = "rgba(0, 0, 0, 0.35)";
              c.stroke();
              c.lineWidth = 1.2 * k;
              c.strokeStyle = "rgba(255, 255, 255, 0.9)";
              c.stroke();
              c.restore();
            }}
            hitFunc={(ctx, forme) => {
              ctx.beginPath();
              ctx.moveTo(coins[0][0], coins[0][1]);
              for (const q of coins.slice(1)) ctx.lineTo(q[0], q[1]);
              ctx.closePath();
              ctx.fillStrokeShape(forme);
            }}
            onMouseDown={(e) => commencer(e, null)}
            onMouseEnter={montrer("move")}
            onMouseLeave={montrer("")}
          />
          {coins.map((q, i) => (
            <Shape
              key={i}
              name={`perspective-coin-${i}`}
              sceneFunc={(ctx) => {
                const c = natif(ctx);
                c.save();
                c.beginPath();
                c.arc(q[0], q[1], 7 * k, 0, Math.PI * 2);
                c.fillStyle = i === coinChoisi ? "#4f46e5" : "#ffffff";
                c.fill();
                c.lineWidth = 2 * k;
                c.strokeStyle = i === coinChoisi ? "#ffffff" : "#4f46e5";
                c.stroke();
                // Une croix fine au centre : là où le coin se pose.
                c.beginPath();
                c.moveTo(q[0] - 3 * k, q[1]);
                c.lineTo(q[0] + 3 * k, q[1]);
                c.moveTo(q[0], q[1] - 3 * k);
                c.lineTo(q[0], q[1] + 3 * k);
                c.lineWidth = 1 * k;
                c.strokeStyle = i === coinChoisi ? "#ffffff" : "#4f46e5";
                c.stroke();
                c.restore();
              }}
              hitFunc={(ctx, forme) => {
                ctx.beginPath();
                ctx.arc(q[0], q[1], 12 * k, 0, Math.PI * 2);
                ctx.fillStrokeShape(forme);
              }}
              onMouseDown={(e) => commencer(e, i)}
              onMouseEnter={montrer("crosshair")}
              onMouseLeave={montrer("")}
            />
          ))}
        </Group>
      </Group>
    </Group>
  );
}
