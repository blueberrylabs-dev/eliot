// Le mode recadrage sur la page (étape 5, lot 5), comme celui de Lightroom et de Canva : le reste
// de la photo se devine, assombri, autour du cadre gardé ; huit poignées tirent ses bords et ses
// coins (la photo ne bouge pas) ; un glisser dans le cadre fait glisser la photo dessous ; la
// molette la rapproche ou l'éloigne ; la grille des tiers aide à placer le sujet, une grille
// fine à redresser. « Tracer l'horizon » : un glisser trace la ligne à remettre droite. Le tout
// vit dans le calque de l'interface, au-dessus de la page, et ne passe jamais dans l'export.

import type Konva from "konva";
import { useEffect, useRef } from "react";
import { Group, Line, Rect, Shape } from "react-konva";
import { elementsCourants, useEditeur } from "../etat/editeur";
import { matriceRognage, type Poignee } from "../modele/rognage";
import { useImageRessource } from "../editeur/images";
import { glisserImage, imagesAffichees, redresserSelonLigne, tirerPoignee, useRecadrage, type PhotoOuClip } from "./recadrage";
import { toileRetouchee } from "./retouche";

const POIGNEES: { id: Poignee; x: number; y: number }[] = [
  { id: "no", x: 0, y: 0 },
  { id: "n", x: 0.5, y: 0 },
  { id: "ne", x: 1, y: 0 },
  { id: "e", x: 1, y: 0.5 },
  { id: "se", x: 1, y: 1 },
  { id: "s", x: 0.5, y: 1 },
  { id: "so", x: 0, y: 1 },
  { id: "o", x: 0, y: 0.5 },
];

/** Le curseur d'une poignée (un retournement inverse les diagonales). */
function curseur(p: Poignee, el: PhotoOuClip): string {
  if (p === "n" || p === "s") return "ns-resize";
  if (p === "e" || p === "o") return "ew-resize";
  const diagonale = p === "no" || p === "se";
  return diagonale !== (el.retourneH !== el.retourneV) ? "nwse-resize" : "nesw-resize";
}

type Contexte2D = CanvasRenderingContext2D;
const natif = (ctx: Konva.Context): Contexte2D => (ctx as unknown as { _context: Contexte2D })._context;

export function CadreRognage({ echelle }: { echelle: number }) {
  const id = useRecadrage((s) => s.id);
  const niveau = useRecadrage((s) => s.niveau);
  const fine = useRecadrage((s) => s.redressement || s.niveau);
  const el = useEditeur((s) => (id ? (elementsCourants(s).find((e) => e.id === id && (e.type === "image" || e.type === "video")) as PhotoOuClip | undefined) : undefined));
  const original = useEditeur((s) => (el ? s.ressources[el.ressource] : undefined));
  const apercu = useImageRessource(el?.ressource);
  const racine = useRef<Konva.Group>(null);
  const ligne = useRef<Konva.Line>(null);
  const geste = useRef<{ depart: PhotoOuClip; x: number; y: number; quoi: Poignee | "image" | "niveau"; etiquette: string } | null>(null);

  // Le geste continue hors du cadre, jusqu'au relâchement.
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
      if (g.quoi === "niveau") {
        ligne.current?.points([g.x, g.y, p.x, p.y]);
        ligne.current?.getLayer()?.batchDraw();
      } else if (g.quoi === "image") glisserImage(g.depart, p.x - g.x, p.y - g.y, g.etiquette);
      else tirerPoignee(g.depart, g.quoi, p.x - g.x, p.y - g.y, e.shiftKey, g.etiquette);
    };
    const lacher = (e: MouseEvent) => {
      const g = geste.current;
      if (!g) return;
      geste.current = null;
      document.body.style.cursor = "";
      if (g.quoi === "niveau") {
        const p = pointPage(e);
        ligne.current?.points([]);
        ligne.current?.getLayer()?.batchDraw();
        useRecadrage.setState({ niveau: false });
        if (p && Math.hypot(p.x - g.x, p.y - g.y) * echelle > 8) {
          const angle = redresserSelonLigne(g.depart.id, p.x - g.x, p.y - g.y);
          if (angle === null) useEditeur.getState().notifier("Cette ligne demanderait plus de 45° : trace-la le long de l'horizon ou d'une verticale.");
        }
      }
    };
    window.addEventListener("mousemove", bouger);
    window.addEventListener("mouseup", lacher);
    return () => {
      window.removeEventListener("mousemove", bouger);
      window.removeEventListener("mouseup", lacher);
    };
  }, [echelle]);

  if (!el || !original) return null;
  const W = original.largeur;
  const H = original.hauteur;
  const w = el.largeur;
  const h = el.hauteur;
  const k = 1 / echelle;
  const m = matriceRognage(el.rognage, W, H, w, h);
  // Les coins de l'image entière, redressée, dans la boîte.
  const coins = [
    [0, 0],
    [W, 0],
    [W, H],
    [0, H],
  ].map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);

  const commencer = (e: Konva.KonvaEventObject<MouseEvent>, quoi: Poignee | "image" | "niveau") => {
    if (e.evt.button !== 0) return;
    e.cancelBubble = true;
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const p = stage?.getPointerPosition();
    if (!p || !racine.current) return;
    const q = racine.current.getAbsoluteTransform().copy().invert().point(p);
    geste.current = { depart: el, x: q.x, y: q.y, quoi, etiquette: `rogner:${el.id}:${quoi}:${Date.now()}` };
    if (quoi === "niveau") ligne.current?.points([q.x, q.y, q.x, q.y]);
    else document.body.style.cursor = quoi === "image" ? "grabbing" : curseur(quoi, el);
  };
  const montrer = (c: string) => () => {
    const s = racine.current?.getStage();
    if (s && !geste.current) s.container().style.cursor = c;
  };

  return (
    <Group ref={racine}>
      <Group x={el.x} y={el.y} rotation={el.rotation}>
        <Group x={el.retourneH ? w : 0} y={el.retourneV ? h : 0} scaleX={el.retourneH ? -1 : 1} scaleY={el.retourneV ? -1 : 1}>
          {/* Le reste de la photo, assombri, autour du cadre. */}
          <Shape
            name="rognage-reste"
            sceneFunc={(ctx) => {
              const c = natif(ctx);
              const image = imagesAffichees.get(el.id) ?? toileRetouchee(el.id) ?? apercu;
              c.save();
              c.beginPath();
              c.moveTo(coins[0][0], coins[0][1]);
              for (const q of coins.slice(1)) c.lineTo(q[0], q[1]);
              c.closePath();
              c.rect(0, 0, w, h);
              c.clip("evenodd");
              if (image) {
                c.save();
                c.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
                c.globalAlpha = 0.55;
                c.drawImage(image, 0, 0, W, H);
                c.restore();
              }
              c.fillStyle = "rgba(24, 24, 27, 0.45)";
              c.fillRect(Math.min(...coins.map((q) => q[0])) - 1, Math.min(...coins.map((q) => q[1])) - 1, Math.max(...coins.map((q) => q[0])) - Math.min(...coins.map((q) => q[0])) + 2, Math.max(...coins.map((q) => q[1])) - Math.min(...coins.map((q) => q[1])) + 2);
              c.restore();
            }}
            hitFunc={(ctx, forme) => {
              ctx.beginPath();
              ctx.moveTo(coins[0][0], coins[0][1]);
              for (const q of coins.slice(1)) ctx.lineTo(q[0], q[1]);
              ctx.closePath();
              ctx.fillStrokeShape(forme);
            }}
            onMouseDown={(e) => commencer(e, "image")}
            onMouseEnter={montrer("grab")}
            onMouseLeave={montrer("")}
          />
          {/* Dans le cadre : glisser la photo dessous. */}
          <Rect name="rognage-cadre" width={w} height={h} fill="rgba(0,0,0,0.001)" onMouseDown={(e) => commencer(e, "image")} onMouseEnter={montrer("grab")} onMouseLeave={montrer("")} />
          {/* La grille des tiers, ou une grille fine pour redresser. */}
          <Shape
            listening={false}
            sceneFunc={(ctx) => {
              const c = natif(ctx);
              // Les tiers ; pour redresser, des carreaux d'un sixième du petit côté.
              const pasX = fine ? Math.min(w, h) / 6 : w / 3;
              const pasY = fine ? Math.min(w, h) / 6 : h / 3;
              c.save();
              c.beginPath();
              for (let x = pasX; x < w - pasX * 0.01; x += pasX) {
                c.moveTo(x, 0);
                c.lineTo(x, h);
              }
              for (let y = pasY; y < h - pasY * 0.01; y += pasY) {
                c.moveTo(0, y);
                c.lineTo(w, y);
              }
              c.lineWidth = k;
              c.strokeStyle = "rgba(0, 0, 0, 0.35)";
              c.stroke();
              c.translate(-0.5 * k, -0.5 * k);
              c.strokeStyle = fine ? "rgba(255, 255, 255, 0.55)" : "rgba(255, 255, 255, 0.8)";
              c.stroke();
              c.restore();
            }}
          />
          <Rect width={w} height={h} stroke="#ffffff" strokeWidth={1.5 * k} shadowColor="#000000" shadowBlur={3 * k} shadowOpacity={0.5} listening={false} />
          {/* Les poignées : des équerres aux coins, des barres au milieu des côtés. */}
          {POIGNEES.map((p) => {
            const px = p.x * w;
            const py = p.y * h;
            const coin = p.id.length === 2;
            const long = Math.min(18 * k, w / 3, h / 3);
            return (
              <Shape
                key={p.id}
                name={`rognage-poignee-${p.id}`}
                sceneFunc={(ctx) => {
                  const c = natif(ctx);
                  c.save();
                  c.beginPath();
                  if (coin) {
                    const sx = p.x === 0 ? 1 : -1;
                    const sy = p.y === 0 ? 1 : -1;
                    c.moveTo(px + sx * long, py);
                    c.lineTo(px, py);
                    c.lineTo(px, py + sy * long);
                  } else if (p.y === 0.5) {
                    c.moveTo(px, py - long / 2);
                    c.lineTo(px, py + long / 2);
                  } else {
                    c.moveTo(px - long / 2, py);
                    c.lineTo(px + long / 2, py);
                  }
                  c.lineCap = "square";
                  c.lineWidth = 4 * k;
                  c.strokeStyle = "rgba(0, 0, 0, 0.35)";
                  c.stroke();
                  c.lineWidth = 3 * k;
                  c.strokeStyle = "#ffffff";
                  c.stroke();
                  c.restore();
                }}
                hitFunc={(ctx, forme) => {
                  ctx.beginPath();
                  ctx.rect(px - 11 * k, py - 11 * k, 22 * k, 22 * k);
                  ctx.fillStrokeShape(forme);
                }}
                onMouseDown={(e) => commencer(e, p.id)}
                onMouseEnter={montrer(curseur(p.id, el))}
                onMouseLeave={montrer("")}
              />
            );
          })}
        </Group>
      </Group>
      {/* « Tracer l'horizon » : toute la zone écoute, la ligne se trace par-dessus. */}
      {niveau && <Rect name="rognage-niveau" x={-1e5} y={-1e5} width={2e5} height={2e5} fill="rgba(0,0,0,0.001)" onMouseDown={(e) => commencer(e, "niveau")} onMouseEnter={montrer("crosshair")} onMouseLeave={montrer("")} />}
      <Line ref={ligne} points={[]} stroke="#facc15" strokeWidth={2 * k} dash={[8 * k, 5 * k]} listening={false} />
    </Group>
  );
}
