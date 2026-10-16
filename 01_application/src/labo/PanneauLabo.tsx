// Le panneau du labo photo (étape 5, lots 2 et 3), à la place du panneau de gauche, comme
// « Modifier l'image » chez Canva : histogramme, avant et après, copier et coller les réglages,
// puis Préréglages, Lumière (avec la courbe des tonalités), Couleur (avec le mélangeur de huit
// couleurs), Effets et Détail. Chaque curseur va de −100 à +100 autour de zéro (sauf
// l'exposition, en IL) ; un double-clic le remet à zéro ; sa valeur se tape au clavier. Un geste
// sur un curseur ou sur la courbe fait une seule étape d'annulation.

import { ChevronDown, ChevronRight, ClipboardCopy, ClipboardPaste, Eye, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { elementsCourants, useEditeur } from "../etat/editeur";
import { useImageRessource } from "../editeur/images";
import {
  aDesVoisins,
  cleReglages,
  COULEURS_MELANGEUR,
  lireValeur,
  normaliserReglages,
  SECTIONS_LABO,
  texteValeur,
  valeurReglage,
  type CanalCourbe,
  type CouleurMelangeur,
  type CurseurLabo,
  type DefinitionCurseur,
  type PointCourbe,
  type ReglagesPhoto,
} from "../modele/labo";
import type { ElementImage } from "../modele/types";
import { EditeurCourbe } from "./EditeurCourbe";
import { Prereglages } from "./Prereglages";
import { abonnerRetouche, collerReglages, copierReglages, finGeste, histogramme, toileRetouchee, useLabo } from "./retouche";

/** La teinte de chaque couleur du mélangeur, pour sa pastille. */
const TEINTES: Record<CouleurMelangeur, string> = {
  rouge: "#e5484d",
  orange: "#f76b15",
  jaune: "#f5d90a",
  vert: "#30a46c",
  cyan: "#05a2c2",
  bleu: "#3e63dd",
  violet: "#8e4ec6",
  magenta: "#d6409f",
};

const NOMS_COULEURS: Record<CouleurMelangeur, string> = {
  rouge: "Rouge",
  orange: "Orange",
  jaune: "Jaune",
  vert: "Vert",
  cyan: "Cyan",
  bleu: "Bleu",
  violet: "Violet",
  magenta: "Magenta",
};

/** Le fond de quelques curseurs, comme dans Lightroom : on voit où l'on va. */
const FONDS: Partial<Record<CurseurLabo, string>> = {
  temperature: "linear-gradient(90deg, #3b82f6, #e5e7eb 50%, #facc15)",
  teinte: "linear-gradient(90deg, #22c55e, #e5e7eb 50%, #d946ef)",
  saturation: "linear-gradient(90deg, #9ca3af, #e5e7eb 50%, #ef4444)",
  vibrance: "linear-gradient(90deg, #9ca3af, #e5e7eb 50%, #f97316)",
  exposition: "linear-gradient(90deg, #111827, #e5e7eb 50%, #ffffff)",
};

/** La piste des autres curseurs : grise, avec un repère au zéro quand il est au milieu. */
const PISTE_CENTREE = "linear-gradient(90deg, transparent calc(50% - 1px), #9ca3af calc(50% - 1px), #9ca3af calc(50% + 1px), transparent calc(50% + 1px)), #e5e7eb";
const PISTE = "#e5e7eb";
const CURSEUR =
  "w-full cursor-pointer appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-neutral-400 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-neutral-400 [&::-moz-range-thumb]:bg-white";

function debutGeste() {
  useLabo.setState({ geste: true });
}

/** Un curseur du labo : libellé, valeur modifiable au clavier, double-clic qui remet à zéro. */
function CurseurReglage({ def, valeur, changer, libelle, nom, fond }: { def: DefinitionCurseur; valeur: number; changer: (v: number) => void; libelle?: string; nom?: string; fond?: string }) {
  const [saisie, setSaisie] = useState<string | null>(null);
  const valider = () => {
    if (saisie !== null) {
      const v = lireValeur(def.cle, saisie);
      if (v !== undefined) changer(v);
    }
    setSaisie(null);
  };
  const style: CSSProperties = { background: fond ?? (def.min < 0 ? PISTE_CENTREE : PISTE), borderRadius: 999, height: 6 };
  return (
    <div className="mb-2.5" data-curseur={nom ?? def.cle}>
      <div className="mb-0.5 flex items-center justify-between text-xs">
        <span className="cursor-default text-neutral-700 select-none" onDoubleClick={() => changer(0)} title="Double-clic : remettre à zéro">
          {libelle ?? def.libelle}
        </span>
        <input
          aria-label={`${nom ?? libelle ?? def.libelle}, valeur`}
          value={saisie ?? texteValeur(def.cle, valeur)}
          onFocus={(e) => {
            setSaisie(def.pas < 1 ? String(valeur).replace(".", ",") : String(valeur));
            requestAnimationFrame(() => e.target.select());
          }}
          onChange={(e) => setSaisie(e.target.value)}
          onBlur={valider}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setSaisie(null);
              (e.target as HTMLInputElement).blur();
            }
            e.stopPropagation();
          }}
          className={`w-[4.5rem] rounded border border-transparent px-1 text-right tabular-nums hover:border-neutral-300 focus:border-accent-500 focus:outline-none ${valeur !== 0 ? "font-medium text-accent-700" : "text-neutral-500"}`}
        />
      </div>
      <input
        type="range"
        aria-label={nom ?? libelle ?? def.libelle}
        min={def.min}
        max={def.max}
        step={def.pas}
        value={valeur}
        onPointerDown={debutGeste}
        onPointerUp={finGeste}
        onPointerCancel={finGeste}
        onChange={(e) => changer(Number(e.target.value))}
        onDoubleClick={() => changer(0)}
        onKeyDown={(e) => e.stopPropagation()}
        style={style}
        className={CURSEUR}
      />
    </div>
  );
}

/** L'histogramme de la photo telle qu'elle s'affiche (rouge, vert, bleu superposés). */
function Histogramme({ el }: { el: ElementImage }) {
  const toile = useRef<HTMLCanvasElement>(null);
  const source = useImageRessource(el.ressource);
  const [version, setVersion] = useState(0);
  useEffect(() => abonnerRetouche(el.id, () => setVersion((v) => v + 1)), [el.id]);
  useEffect(() => {
    let image = 0;
    image = requestAnimationFrame(() => {
      const c = toile.current;
      const lue = toileRetouchee(el.id) ?? source;
      if (!c || !lue) return;
      const h = histogramme(lue);
      const ctx = c.getContext("2d")!;
      const { width: l, height: ht } = c;
      ctx.clearRect(0, 0, l, ht);
      // Échelle : les cases les plus hautes, sans les deux bouts (souvent saturés), en racine.
      let max = 1;
      for (const canal of [h.r, h.v, h.b]) for (let i = 2; i < 254; i++) max = Math.max(max, canal[i]);
      const hauteur = (n: number) => Math.min(1, Math.sqrt(n / max)) * (ht - 2);
      ctx.globalCompositeOperation = "lighter";
      for (const [canal, couleur] of [
        [h.r, "rgba(229, 72, 77, 0.75)"],
        [h.v, "rgba(48, 164, 108, 0.75)"],
        [h.b, "rgba(62, 99, 221, 0.75)"],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(0, ht);
        for (let i = 0; i < 256; i++) ctx.lineTo((i / 255) * l, ht - hauteur(canal[i]));
        ctx.lineTo(l, ht);
        ctx.closePath();
        ctx.fillStyle = couleur;
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    });
    return () => cancelAnimationFrame(image);
  }, [el.id, el.reglages, source, version]);
  return <canvas ref={toile} data-histogramme width={576} height={150} className="h-[75px] w-full rounded-md bg-neutral-900" />;
}

function Section({ titre, ouverte, basculer, children }: { titre: string; ouverte: boolean; basculer: () => void; children: React.ReactNode }) {
  return (
    <section className="border-t border-neutral-200 py-2" data-section={titre}>
      <button onClick={basculer} className="flex w-full items-center gap-1 py-1 text-left text-sm font-semibold text-neutral-800">
        {ouverte ? <ChevronDown size={16} /> : <ChevronRight size={16} />} {titre}
      </button>
      {ouverte && <div className="pt-1">{children}</div>}
    </section>
  );
}

const PLAGE_MELANGEUR: Record<"teinte" | "saturation" | "luminance", DefinitionCurseur> = {
  teinte: { cle: "teinte", libelle: "Teinte", min: -100, max: 100, pas: 1 },
  saturation: { cle: "saturation", libelle: "Saturation", min: -100, max: 100, pas: 1 },
  luminance: { cle: "contraste", libelle: "Luminance", min: -100, max: 100, pas: 1 },
};

/** Le fond d'un curseur du mélangeur : vers les teintes voisines, du gris à la couleur, du
 *  sombre au clair. */
function fondMelangeur(couleur: CouleurMelangeur, k: "teinte" | "saturation" | "luminance"): string {
  const i = COULEURS_MELANGEUR.indexOf(couleur);
  const t = TEINTES[couleur];
  if (k === "teinte") return `linear-gradient(90deg, ${TEINTES[COULEURS_MELANGEUR[(i + 7) % 8]]}, ${t}, ${TEINTES[COULEURS_MELANGEUR[(i + 1) % 8]]})`;
  if (k === "saturation") return `linear-gradient(90deg, #9ca3af, ${t})`;
  return `linear-gradient(90deg, #1f2937, ${t}, #f9fafb)`;
}

function Melangeur({ reglages, changer }: { reglages: ReglagesPhoto | undefined; changer: (couleur: CouleurMelangeur, k: "teinte" | "saturation" | "luminance", v: number) => void }) {
  const [couleur, setCouleur] = useState<CouleurMelangeur>("orange");
  const m = reglages?.melangeur?.[couleur];
  return (
    <div className="mt-1 rounded-lg bg-neutral-50 p-2.5" data-melangeur>
      <p className="mb-2 text-xs font-medium text-neutral-600">
        Mélangeur de couleurs : <span className="text-neutral-900">{NOMS_COULEURS[couleur]}</span>
      </p>
      <div className="mb-2.5 flex justify-between">
        {COULEURS_MELANGEUR.map((c) => {
          const touchee = !!reglages?.melangeur?.[c];
          return (
            <button
              key={c}
              data-couleur={c}
              title={NOMS_COULEURS[c]}
              onClick={() => setCouleur(c)}
              className={`relative h-6 w-6 rounded-full ${couleur === c ? "ring-2 ring-accent-600 ring-offset-2" : ""}`}
              style={{ background: TEINTES[c] }}
            >
              {touchee && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-white bg-neutral-800" />}
            </button>
          );
        })}
      </div>
      {(["teinte", "saturation", "luminance"] as const).map((k) => (
        <CurseurReglage key={`${couleur}-${k}`} def={PLAGE_MELANGEUR[k]} nom={`${couleur}-${k}`} fond={fondMelangeur(couleur, k)} valeur={m?.[k] ?? 0} changer={(v) => changer(couleur, k, v)} />
      ))}
    </div>
  );
}

export function PanneauLabo({ el }: { el: ElementImage }) {
  const [fermees, setFermees] = useState<Set<string>>(new Set());
  const voisins = aDesVoisins(el.reglages);
  const source = useImageRessource(el.ressource) ?? null;
  const copie = useLabo((s) => s.copie);
  const modifier = (reglages: ReglagesPhoto | undefined, etiquette: string) => {
    useEditeur.getState().modifierElements({ [el.id]: { reglages: normaliserReglages(reglages) } }, `labo:${el.id}:${etiquette}`);
  };
  const changer = (cle: CurseurLabo, v: number) => {
    // Le dernier état du document : plusieurs changements peuvent arriver dans la même image.
    const actuel = elementsCourants(useEditeur.getState()).find((e) => e.id === el.id) as ElementImage | undefined;
    modifier({ ...actuel?.reglages, [cle]: v }, cle);
  };
  const changerCouleur = (couleur: CouleurMelangeur, k: "teinte" | "saturation" | "luminance", v: number) => {
    const actuel = (elementsCourants(useEditeur.getState()).find((e) => e.id === el.id) as ElementImage | undefined)?.reglages;
    modifier({ ...actuel, melangeur: { ...actuel?.melangeur, [couleur]: { ...actuel?.melangeur?.[couleur], [k]: v } } }, `${couleur}-${k}`);
  };
  const changerCourbe = (canal: CanalCourbe, points: PointCourbe[]) => {
    const actuel = (elementsCourants(useEditeur.getState()).find((e) => e.id === el.id) as ElementImage | undefined)?.reglages;
    const suivant = { ...actuel, courbe: { ...actuel?.courbe, [canal]: points } };
    // Un point posé sur la diagonale ne change rien : pas d'étape d'annulation pour si peu.
    if (cleReglages(suivant) === cleReglages(actuel)) return;
    modifier(suivant, `courbe-${canal}`);
  };
  const basculer = (titre: string) =>
    setFermees((f) => {
      const n = new Set(f);
      if (n.has(titre)) n.delete(titre);
      else n.add(titre);
      return n;
    });
  // Un survol de préréglage qui finit hors du panneau ne laisse pas la photo en essai.
  useEffect(() => () => useLabo.setState({ essai: null }), [el.id]);
  // Un curseur relâché hors de sa piste finit quand même le geste.
  useEffect(() => {
    const relache = () => useLabo.getState().geste && finGeste();
    window.addEventListener("pointerup", relache);
    return () => window.removeEventListener("pointerup", relache);
  }, []);
  return (
    <div data-panneau-labo>
      <div className="mb-3 flex items-center gap-2">
        <button title="Fermer le labo" onClick={() => useLabo.setState({ ouvert: null })} className="rounded-md p-1 text-neutral-600 hover:bg-neutral-100">
          <X size={18} />
        </button>
        <h2 className="flex-1 text-sm font-semibold text-neutral-900">Retoucher</h2>
        <button data-copier-reglages title="Copier les réglages (Ctrl+Maj+C)" onClick={() => copierReglages(el.id)} className="rounded-md p-1 text-neutral-600 hover:bg-neutral-100">
          <ClipboardCopy size={15} />
        </button>
        <button data-coller-reglages title="Coller les réglages copiés sur cette photo (Ctrl+Maj+V)" disabled={!copie} onClick={() => collerReglages([el.id])} className="rounded-md p-1 text-neutral-600 hover:bg-neutral-100 disabled:opacity-40">
          <ClipboardPaste size={15} />
        </button>
        <button
          title="Tout remettre à zéro"
          disabled={!el.reglages}
          onClick={() => modifier(undefined, "tout")}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
        >
          <RotateCcw size={14} /> Tout
        </button>
      </div>
      <Histogramme el={el} />
      <button
        data-avant
        disabled={!el.reglages}
        onPointerDown={() => useLabo.setState({ avant: true })}
        onPointerUp={() => useLabo.setState({ avant: false })}
        onPointerLeave={() => useLabo.setState({ avant: false })}
        className="mt-2 mb-1 flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 py-1.5 text-sm text-neutral-700 select-none hover:bg-neutral-50 active:bg-neutral-100 disabled:opacity-40"
        title="Maintenir pour voir la photo sans retouche"
      >
        <Eye size={15} /> Avant (maintenir)
      </button>
      {voisins && <p className="mb-1 text-[11px] text-neutral-500">Texture, clarté, voile, netteté et bruit se calculent quand on relâche le curseur.</p>}
      <Section titre="Préréglages" ouverte={!fermees.has("Préréglages")} basculer={() => basculer("Préréglages")}>
        <Prereglages el={el} source={source} modifier={modifier} />
      </Section>
      {SECTIONS_LABO.map((s) => (
        <Section key={s.titre} titre={s.titre} ouverte={!fermees.has(s.titre)} basculer={() => basculer(s.titre)}>
          {s.curseurs.map((d) => (
            <CurseurReglage key={d.cle} def={d} fond={FONDS[d.cle]} valeur={valeurReglage(el.reglages, d.cle)} changer={(v) => changer(d.cle, v)} />
          ))}
          {s.titre === "Lumière" && <EditeurCourbe courbe={el.reglages?.courbe} changer={changerCourbe} source={source} />}
          {s.titre === "Couleur" && <Melangeur reglages={el.reglages} changer={changerCouleur} />}
        </Section>
      ))}
      <p className="mt-2 text-[11px] text-neutral-400">L'original n'est jamais modifié : la retouche est gardée dans le design et refaite à l'export, depuis l'original.</p>
    </div>
  );
}
