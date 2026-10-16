// La courbe des tonalités du labo (étape 5, lot 3), comme la courbe de points de Lightroom :
// une courbe pour l'image entière (RVB), une par canal. Un clic sur la courbe y pose un point,
// qu'on glisse ; un double-clic l'enlève (un bout revient à sa place). Au clavier : les flèches
// déplacent le point choisi (Maj : de 10), Suppr l'enlève. L'histogramme de la photo est dessiné
// derrière. Un geste fait une seule étape d'annulation.

import { RotateCcw } from "lucide-react";
import { useMemo, useRef, useState, type PointerEvent as EvenementPointeur } from "react";
import { CANAUX_COURBE, normaliserPoints, POINTS_COURBE_MAX, spline, type CanalCourbe, type CourbeTonalites, type PointCourbe } from "../modele/labo";
import { commencerGeste, finGeste, histogramme } from "./retouche";

const DIAGONALE: PointCourbe[] = [
  [0, 0],
  [255, 255],
];

const NOMS: Record<CanalCourbe, string> = { rgb: "RVB", rouge: "Rouge", vert: "Vert", bleu: "Bleu" };
const TEINTES: Record<CanalCourbe, string> = { rgb: "#262626", rouge: "#e5484d", vert: "#30a46c", bleu: "#3e63dd" };
/** La marge autour du carré, pour que les points des bords restent attrapables. */
const MARGE = 5;
const COTE = 255 + 2 * MARGE;
/** La distance, en unités de la courbe, à laquelle un clic attrape un point. */
const PRISE = 10;

function chemin(points: PointCourbe[]): string {
  const f = spline(points);
  const morceaux: string[] = [];
  for (let i = 0; i <= 128; i++) {
    const x = (i / 128) * 255;
    morceaux.push(`${i ? "L" : "M"}${x.toFixed(2)},${(255 - f(x / 255) * 255).toFixed(2)}`);
  }
  return morceaux.join(" ");
}

export function EditeurCourbe({ courbe, changer, source }: { courbe: CourbeTonalites | undefined; changer: (canal: CanalCourbe, points: PointCourbe[]) => void; source: CanvasImageSource | null }) {
  const [canal, setCanal] = useState<CanalCourbe>("rgb");
  const [choisi, setChoisi] = useState<number | null>(null);
  // Les points du geste en cours : la courbe du document peut redevenir une diagonale (liste
  // vide) au milieu du geste, le point tiré doit rester le même.
  const [travail, setTravail] = useState<PointCourbe[] | null>(null);
  const tire = useRef<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const points = travail ?? (courbe?.[canal]?.length ? courbe[canal]! : DIAGONALE);

  const fondHisto = useMemo(() => {
    if (!source) return "";
    try {
      const h = histogramme(source as CanvasImageSource & { width: number; height: number }).l;
      let max = 1;
      for (let i = 2; i < 254; i++) max = Math.max(max, h[i]);
      const morceaux = ["M0,255"];
      for (let i = 0; i < 256; i++) morceaux.push(`L${i},${(255 - Math.min(1, Math.sqrt(h[i] / max)) * 200).toFixed(1)}`);
      morceaux.push("L255,255 Z");
      return morceaux.join(" ");
    } catch {
      return "";
    }
  }, [source]);

  const lire = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = svg.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * COTE - MARGE;
    const y = 255 - (((e.clientY - r.top) / r.height) * COTE - MARGE);
    return [x, y];
  };

  const proche = (pts: PointCourbe[], x: number, y: number): number | null => {
    let meilleur: number | null = null;
    let d = PRISE;
    pts.forEach(([px, py], i) => {
      const e = Math.hypot(px - x, py - y);
      if (e <= d) {
        d = e;
        meilleur = i;
      }
    });
    return meilleur;
  };

  const envoyer = (pts: PointCourbe[]) => changer(canal, pts);

  /** Le point `i` amené en (x, y), entre ses voisins ; les bouts restent à l'entrée 0 et 255. */
  const deplacer = (pts: PointCourbe[], i: number, x: number, y: number): PointCourbe[] => {
    const suivant = pts.map((p) => [...p] as PointCourbe);
    const bx = i === 0 ? 0 : i === pts.length - 1 ? 255 : Math.min(pts[i + 1][0] - 1, Math.max(pts[i - 1][0] + 1, Math.round(x)));
    suivant[i] = [bx, Math.min(255, Math.max(0, Math.round(y)))];
    return suivant;
  };

  const enlever = (pts: PointCourbe[], i: number): PointCourbe[] => {
    if (i === 0) return [[0, 0], ...pts.slice(1)];
    if (i === pts.length - 1) return [...pts.slice(0, -1), [255, 255]];
    return pts.filter((_, j) => j !== i);
  };

  const appuyer = (e: EvenementPointeur<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const [x, y] = lire(e);
    let pts = points.map((p) => [...p] as PointCourbe);
    let i = proche(pts, x, y);
    const nouveau = i === null;
    if (i === null) {
      // Un nouveau point, posé sur la courbe à cette entrée.
      const bx = Math.round(Math.min(254, Math.max(1, x)));
      if (pts.length >= POINTS_COURBE_MAX || pts.some((p) => p[0] === bx)) return;
      const by = Math.round(spline(pts)(bx / 255) * 255);
      pts = [...pts, [bx, by] as PointCourbe].sort((a, b) => a[0] - b[0]);
      i = pts.findIndex((p) => p[0] === bx);
    }
    commencerGeste();
    svg.current?.setPointerCapture(e.pointerId);
    tire.current = i;
    setChoisi(i);
    setTravail(pts);
    if (nouveau) envoyer(pts);
  };

  const bouger = (e: EvenementPointeur<SVGSVGElement>) => {
    if (tire.current === null || !travail) return;
    const [x, y] = lire(e);
    const pts = deplacer(travail, tire.current, x, y);
    setTravail(pts);
    envoyer(pts);
  };

  const relacher = () => {
    if (tire.current === null) return;
    tire.current = null;
    setTravail(null);
    finGeste();
  };

  const doubleClic = (e: React.MouseEvent<SVGSVGElement>) => {
    const [x, y] = lire(e);
    const i = proche(points, x, y);
    if (i === null) return;
    setChoisi(null);
    envoyer(enlever(points, i));
  };

  const clavier = (e: React.KeyboardEvent<SVGSVGElement>) => {
    const fleches: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    // Ces touches restent à la courbe : ailleurs, elles déplaceraient ou supprimeraient la photo.
    if (!(e.key in fleches) && e.key !== "Delete" && e.key !== "Backspace") return;
    e.preventDefault();
    e.stopPropagation();
    if (choisi === null || choisi >= points.length) return;
    if (fleches[e.key]) {
      const pas = e.shiftKey ? 10 : 1;
      const [dx, dy] = fleches[e.key];
      envoyer(deplacer(points, choisi, points[choisi][0] + dx * pas, points[choisi][1] + dy * pas));
    } else {
      envoyer(enlever(points, choisi));
      setChoisi(null);
    }
  };

  const actif = (c: CanalCourbe) => (courbe?.[c]?.length ?? 0) > 0;
  const lu = choisi !== null && choisi < points.length ? points[choisi] : null;

  return (
    <div className="mt-1" data-editeur-courbe>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-medium text-neutral-600">Courbe des tonalités</p>
        <button
          title={`Remettre la courbe ${canal === "rgb" ? "RVB" : `du ${NOMS[canal].toLowerCase()}`} à zéro`}
          disabled={!actif(canal)}
          onClick={() => {
            setChoisi(null);
            envoyer([]);
          }}
          className="rounded p-1 text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
        >
          <RotateCcw size={13} />
        </button>
      </div>
      <div className="mb-1.5 flex gap-1">
        {CANAUX_COURBE.map((c) => (
          <button
            key={c}
            data-canal={c}
            aria-pressed={canal === c}
            onClick={() => {
              setCanal(c);
              setChoisi(null);
            }}
            className={`relative flex-1 rounded-md py-0.5 text-xs ${canal === c ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
          >
            {NOMS[c]}
            {actif(c) && <span className="absolute top-0.5 right-1 h-1.5 w-1.5 rounded-full" style={{ background: c === "rgb" ? (canal === c ? "#fff" : "#262626") : TEINTES[c] }} />}
          </button>
        ))}
      </div>
      <svg
        ref={svg}
        data-courbe={canal}
        role="img"
        aria-label={`Courbe ${NOMS[canal]}`}
        tabIndex={0}
        viewBox={`${-MARGE} ${-MARGE} ${COTE} ${COTE}`}
        className="aspect-square w-full cursor-crosshair touch-none rounded-md bg-neutral-50 outline-none select-none focus-visible:ring-2 focus-visible:ring-accent-500"
        onPointerDown={appuyer}
        onPointerMove={bouger}
        onPointerUp={relacher}
        onPointerCancel={relacher}
        onDoubleClick={doubleClic}
        onKeyDown={clavier}
      >
        <rect x={0} y={0} width={255} height={255} fill="#fafafa" stroke="#e5e5e5" />
        {fondHisto && <path d={fondHisto} fill="rgba(0,0,0,0.07)" />}
        {[64, 128, 192].map((v) => (
          <g key={v} stroke="#e5e5e5" strokeWidth={0.8}>
            <line x1={v} y1={0} x2={v} y2={255} />
            <line x1={0} y1={v} x2={255} y2={v} />
          </g>
        ))}
        <line x1={0} y1={255} x2={255} y2={0} stroke="#d4d4d4" strokeWidth={0.8} strokeDasharray="3 3" />
        {CANAUX_COURBE.filter((c) => c !== canal && actif(c)).map((c) => (
          <path key={c} d={chemin(normaliserPoints(courbe![c]))} fill="none" stroke={TEINTES[c]} strokeOpacity={0.35} strokeWidth={1.2} />
        ))}
        <path d={chemin(points)} fill="none" stroke={TEINTES[canal]} strokeWidth={1.8} />
        {points.map(([x, y], i) => (
          <circle key={i} data-point={i} cx={x} cy={255 - y} r={4.2} fill={i === choisi ? TEINTES[canal] : "#fff"} stroke={TEINTES[canal]} strokeWidth={1.5} />
        ))}
      </svg>
      <p className="mt-1 h-4 text-[11px] text-neutral-500 tabular-nums" data-lecture-courbe>
        {lu ? `Entrée ${lu[0]}, sortie ${lu[1]}` : "Clic : un point à glisser. Double-clic : l'enlever."}
      </p>
    </div>
  );
}
