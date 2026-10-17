// Les aides pour apprendre (étape 7, lot 3), à l'écran seulement : la grille, la grille des
// tiers et les marges de sécurité par-dessus la page, les règles le long de la zone de travail,
// les marques des alertes de lisibilité, et le menu « Aides » de la barre du bas. Rien de tout
// cela n'entre dans le document ni dans un export.

import { Ruler, TriangleAlert } from "lucide-react";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Group, Rect, Shape } from "react-konva";
import { useShallow } from "zustand/react/shallow";
import { useAides, type CleAide } from "../etat/aides";
import { elementsCourants, pageCourante, useEditeur } from "../etat/editeur";
import { useTemps } from "../etat/temps";
import { ecrireValeur, estPapier, graduations, lignesGrille, lignesTiers, MM_PAR_PIXEL_PAPIER, pasGrilleParDefaut, rectangleMarges, unitePage, type Lignes } from "../modele/aides";
import { boiteDe } from "../modele/geometrie";
import type { Alerte } from "../modele/lisibilite";
import type { ElementPage, Format } from "../modele/types";
import { estVerticale916, ZONES_SURES, type IdZones } from "../modele/zonesSures";
import { Bulle } from "./Bulle";
import { CHOIX_ZONES } from "./ZonesSures";

const COULEUR_GRILLE = "rgba(79,70,229,0.30)";
const COULEUR_TIERS = "rgba(255,61,139,0.85)";
const COULEUR_MARGES = "rgba(6,182,212,0.95)";
/** Épaisseur des règles, en pixels de l'écran. */
export const EPAISSEUR_REGLE = 20;

/** Le pas de la grille en vigueur (pixels de la page). */
export const pasGrille = (format: Format) => useAides.getState().pasGrille ?? pasGrilleParDefaut(format);

/** Les lignes des aides montrées, auxquelles un objet glissé s'aimante : la grille, les tiers,
 *  les bords des marges de sécurité. */
export function lignesDesAides(format: Format): Lignes {
  const a = useAides.getState();
  const v: number[] = [];
  const h: number[] = [];
  if (a.grille) {
    const g = lignesGrille(format, pasGrille(format));
    v.push(...g.verticales);
    h.push(...g.horizontales);
  }
  if (a.tiers) {
    const t = lignesTiers(format);
    v.push(...t.verticales);
    h.push(...t.horizontales);
  }
  if (a.marges) {
    const m = rectangleMarges(format);
    v.push(m.x, m.x + m.largeur);
    h.push(m.y, m.y + m.hauteur);
  }
  return { verticales: v, horizontales: h };
}

/** Des lignes droites, tracées d'un seul chemin (une grille fine en compte des centaines). */
function Traits({ lignes, format, couleur, epaisseur, tirets }: { lignes: Lignes; format: Format; couleur: string; epaisseur: number; tirets?: number[] }) {
  return (
    <Shape
      listening={false}
      stroke={couleur}
      strokeWidth={epaisseur}
      dash={tirets}
      sceneFunc={(ctx, forme) => {
        ctx.beginPath();
        for (const x of lignes.verticales) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, format.hauteur);
        }
        for (const y of lignes.horizontales) {
          ctx.moveTo(0, y);
          ctx.lineTo(format.largeur, y);
        }
        ctx.strokeShape(forme);
      }}
    />
  );
}

/** La grille, les tiers et les marges, dans le repère de la page (à poser dans un groupe qui a
 *  la transformation de la page). Les traits gardent la même finesse à tous les zooms. */
export function CalqueAides({ format, echelle }: { format: Format; echelle: number }) {
  const a = useAides(useShallow((s) => ({ grille: s.grille, pas: s.pasGrille, tiers: s.tiers, marges: s.marges })));
  if (!a.grille && !a.tiers && !a.marges) return null;
  const e = 1 / echelle;
  const m = rectangleMarges(format);
  return (
    <Group listening={false} name="aides">
      {a.grille && <Traits lignes={lignesGrille(format, a.pas ?? pasGrilleParDefaut(format))} format={format} couleur={COULEUR_GRILLE} epaisseur={e} />}
      {a.tiers && <Traits lignes={lignesTiers(format)} format={format} couleur={COULEUR_TIERS} epaisseur={1.5 * e} tirets={[8 * e, 5 * e]} />}
      {a.marges && <Rect name="marges" x={m.x} y={m.y} width={m.largeur} height={m.hauteur} stroke={COULEUR_MARGES} strokeWidth={1.5 * e} dash={[6 * e, 4 * e]} listening={false} />}
    </Group>
  );
}

/** Dessine une règle sur sa toile : fond gris, la page en blanc, la sélection en couleur, les
 *  graduations chiffrées. */
function dessinerRegle(toile: HTMLCanvasElement, sens: "h" | "v", longueur: number, origine: number, echelle: number, format: Format, selection: [number, number] | null) {
  const dpr = window.devicePixelRatio || 1;
  const [l, h] = sens === "h" ? [longueur, EPAISSEUR_REGLE] : [EPAISSEUR_REGLE, longueur];
  toile.width = Math.max(1, Math.round(l * dpr));
  toile.height = Math.max(1, Math.round(h * dpr));
  toile.style.width = `${l}px`;
  toile.style.height = `${h}px`;
  const ctx = toile.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Une règle verticale se dessine comme une horizontale, tournée d'un quart de tour.
  if (sens === "v") ctx.transform(0, 1, 1, 0, 0, 0);
  const E = EPAISSEUR_REGLE;
  ctx.fillStyle = "#efeee9";
  ctx.fillRect(0, 0, longueur, E);
  const tailleCote = (sens === "h" ? format.largeur : format.hauteur) * echelle;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(origine, 0, tailleCote, E);
  if (selection) {
    ctx.fillStyle = "rgba(79,70,229,0.16)";
    ctx.fillRect(selection[0], 0, selection[1] - selection[0], E);
  }
  ctx.strokeStyle = "#8d8c86";
  ctx.fillStyle = "#5f5e59";
  ctx.lineWidth = 1;
  ctx.font = "9px Inter, sans-serif";
  ctx.textBaseline = "top";
  ctx.beginPath();
  for (const g of graduations(longueur, origine, echelle, unitePage(format))) {
    const x = Math.round(g.position) + 0.5;
    ctx.moveTo(x, E);
    ctx.lineTo(x, g.majeure ? 2 : E - 5);
    if (g.majeure && g.valeur !== undefined) {
      if (sens === "h") ctx.fillText(ecrireValeur(g.valeur), x + 3, 2);
      else {
        // Le chiffre se lit de bas en haut, comme sur les règles verticales de Canva.
        ctx.save();
        ctx.translate(x + 3, 2);
        ctx.transform(0, 1, 1, 0, 0, 0);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "right";
        ctx.fillText(ecrireValeur(g.valeur), 0, 0);
        ctx.restore();
      }
    }
  }
  ctx.stroke();
  ctx.fillStyle = "#c9c8c2";
  ctx.fillRect(0, E - 1, longueur, 1);
}

/** Les règles, le long du haut et de la gauche de la zone de travail. */
export function Regles({ taille, echelle, ox, oy, format }: { taille: { l: number; h: number }; echelle: number; ox: number; oy: number; format: Format }) {
  const montrees = useAides((s) => s.regles);
  const choisis = useEditeur(useShallow((s) => elementsCourants(s).filter((e) => s.selection.includes(e.id))));
  const haut = useRef<HTMLCanvasElement>(null);
  const gauche = useRef<HTMLCanvasElement>(null);
  const boite = choisis.length ? boiteDe(choisis as ElementPage[]) : null;
  const unite = unitePage(format).nom;
  useLayoutEffect(() => {
    if (!montrees) return;
    if (haut.current) dessinerRegle(haut.current, "h", taille.l, ox, echelle, format, boite ? [ox + boite.x * echelle, ox + (boite.x + boite.largeur) * echelle] : null);
    if (gauche.current) dessinerRegle(gauche.current, "v", taille.h, oy, echelle, format, boite ? [oy + boite.y * echelle, oy + (boite.y + boite.hauteur) * echelle] : null);
  });
  if (!montrees) return null;
  return (
    <>
      <canvas ref={haut} data-regle="haut" className="absolute top-0 left-0" title={`Règle en ${unite === "mm" ? "millimètres" : "pixels de la page"} (Maj+R pour la masquer)`} />
      <canvas ref={gauche} data-regle="gauche" className="absolute top-0 left-0" title={`Règle en ${unite === "mm" ? "millimètres" : "pixels de la page"} (Maj+R pour la masquer)`} />
      <div className="absolute top-0 left-0 flex items-center justify-center border-r border-b border-[#c9c8c2] bg-[#efeee9] text-[9px] font-medium text-neutral-500" style={{ width: EPAISSEUR_REGLE, height: EPAISSEUR_REGLE }} title={unite === "mm" ? "Millimètres (page A4 ou A5)" : "Pixels de la page"}>
        {unite}
      </div>
    </>
  );
}

/** Les alertes de la page affichée, rangées par texte (vides si on ne les montre pas). */
export function useAlertesMontrees(): Map<string, Alerte[]> {
  const { montrees, liste, mesuree } = useAides(useShallow((s) => ({ montrees: s.alertes, liste: s.liste, mesuree: s.mesuree })));
  const page = useEditeur((s) => s.pageActive);
  const parTexte = new Map<string, Alerte[]>();
  if (!montrees || mesuree !== page) return parTexte;
  for (const a of liste) parTexte.set(a.id, [...(parTexte.get(a.id) ?? []), a]);
  return parTexte;
}

/** Les marques des alertes, au coin haut droit de chaque texte concerné ; un clic le choisit. */
export function MarquesAlertes({ echelle, ox, oy }: { echelle: number; ox: number; oy: number }) {
  const alertes = useAlertesMontrees();
  const elements = useEditeur(elementsCourants);
  const enEdition = useEditeur((s) => s.enEdition);
  const joue = useTemps((s) => s.joue);
  if (joue || alertes.size === 0) return null;
  return (
    <>
      {elements.map((el) => {
        const a = alertes.get(el.id);
        if (!a || el.id === enEdition) return null;
        const r = (el.rotation * Math.PI) / 180;
        const x = ox + (el.x + el.largeur * Math.cos(r)) * echelle;
        const y = oy + (el.y + el.largeur * Math.sin(r)) * echelle;
        return (
          <button
            key={el.id}
            data-alerte-marque={el.id}
            className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-amber-500 text-white shadow ring-2 ring-white hover:bg-amber-600"
            style={{ left: x + 6, top: y - 6 }}
            title={`${a.map((x) => x.message).join("\n")}\nUn clic choisit le texte ; le bouton Lisibilité de sa barre propose une correction.`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => useEditeur.getState().selectionner([el.id])}
          >
            <TriangleAlert size={12} strokeWidth={2.5} />
          </button>
        );
      })}
    </>
  );
}

function Case({ cle, libelle, aide, children }: { cle: CleAide; libelle: string; aide: string; children?: ReactNode }) {
  const actif = useAides((s) => s[cle]);
  return (
    <div className="mb-2.5">
      <div className="flex items-center">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800" title={aide}>
          <input type="checkbox" data-aide={cle} checked={actif} onChange={() => useAides.getState().basculer(cle)} className="h-4 w-4 accent-accent-600" />
          {libelle}
        </label>
        {children}
      </div>
      <p className="mt-0.5 ml-6 text-[11px] leading-snug text-neutral-500">{aide}</p>
    </div>
  );
}

/** Le champ du pas de la grille, en pixels ou en millimètres. */
function PasGrille({ format }: { format: Format }) {
  const pas = useAides((s) => s.pasGrille) ?? pasGrilleParDefaut(format);
  const papier = estPapier(format);
  const valeur = papier ? Math.round(pas * MM_PAR_PIXEL_PAPIER * 10) / 10 : pas;
  return (
    <span className="ml-auto flex items-center gap-1 text-xs text-neutral-500">
      pas
      <input
        type="number"
        data-pas-grille
        min={papier ? 1 : 4}
        step={papier ? 1 : 4}
        value={valeur}
        title="Le pas de la grille : la distance entre deux lignes"
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v > 0) useAides.getState().definirPas(papier ? v / MM_PAR_PIXEL_PAPIER : Math.max(4, v));
        }}
        className="h-6 w-14 rounded border border-neutral-300 px-1 text-right text-xs text-neutral-800 tabular-nums"
      />
      {papier ? "mm" : "px"}
    </span>
  );
}

/** Le menu « Aides » de la barre du bas : ce qui se montre par-dessus la page, et les alertes. */
export function MenuAides({ classeBouton }: { classeBouton: string }) {
  const format = useEditeur((s) => s.document.format);
  const alertes = useAlertesMontrees();
  const elements = useEditeur(elementsCourants);
  const zones = useTemps((s) => s.zonesSures);
  const calcul = useAides((s) => s.calcul);
  const montrees = useAides((s) => s.alertes);
  const verticale = estVerticale916(format);
  const papier = estPapier(format);
  const nombre = [...alertes.values()].reduce((n, a) => n + a.length, 0);
  const nomTexte = (id: string) => {
    const el = elementsCourants(useEditeur.getState()).find((e) => e.id === id);
    const t = el?.type === "texte" ? el.texte.replace(/\s+/g, " ").trim() : "";
    return t.length > 28 ? `${t.slice(0, 27)}…` : t || "Texte";
  };
  return (
    <Bulle
      titre="Aides pour apprendre : règles, grilles, marges, zones sûres, alertes de lisibilité"
      largeur={320}
      classeBouton={classeBouton}
      donneesBouton={{ "data-aides": "" }}
      bouton={
        <>
          <Ruler size={16} /> Aides
          {nombre > 0 && (
            <span data-nombre-alertes className="rounded-full bg-amber-500 px-1.5 text-[11px] leading-4 font-semibold text-white tabular-nums">
              {nombre}
            </span>
          )}
        </>
      }
    >
      <p className="mb-3 text-xs text-neutral-500">À l'écran seulement : rien de tout cela ne s'exporte.</p>
      <Case cle="regles" libelle="Règles" aide={`Le long de la page, en ${papier ? "millimètres (page A4 ou A5)" : "pixels de la page"}. Maj+R les montre ou les masque.`} />
      <Case cle="grille" libelle="Grille" aide="Des cases régulières pour aligner et espacer ; un objet glissé s'aimante à ses lignes.">
        <PasGrille format={format} />
      </Case>
      <Case cle="tiers" libelle="Grille des tiers" aide="Pose les points forts (un visage, le produit, le titre) sur ces lignes ou leurs croisements : l'image respire mieux qu'au centre." />
      <Case
        cle="marges"
        libelle="Marges de sécurité"
        aide={papier ? "5 mm du bord : ce que l'imprimeur peut rogner. Garde les textes et les logos dedans." : "5 % du bord : les coins arrondis d'un téléphone, un recadrage. Garde les textes et les logos dedans."}
      />
      <div className="mb-2.5">
        <label className="flex items-center gap-2 text-sm text-neutral-800" title={verticale ? "Où l'application pose ses boutons et sa légende" : "Pour une page verticale en 9:16"}>
          <span className="w-6" />
          Zones sûres
          <select
            data-zones-aides
            disabled={!verticale}
            value={zones ?? ""}
            onChange={(e) => useTemps.getState().choisirZonesSures((e.target.value || null) as IdZones | null)}
            className="ml-auto h-7 rounded border border-neutral-300 bg-white px-1 text-sm disabled:opacity-50"
          >
            {CHOIX_ZONES.map((c) => (
              <option key={c ?? "aucune"} value={c ?? ""}>
                {c ? ZONES_SURES[c].nom : "Aucune"}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-0.5 ml-6 text-[11px] leading-snug text-neutral-500">
          {verticale ? "Là où TikTok, Reels, Shorts ou une story posent leurs boutons et leur légende : un texte posé là sera caché." : "Pour une page verticale en 9:16 (story, Reel, TikTok, Short)."}
        </p>
      </div>
      <Case cle="alertes" libelle="Alertes de lisibilité" aide="Un texte peu contrasté sur ce qui est derrière lui (rapport du WCAG), ou trop petit pour être lu là où la page sera vue (un téléphone, une affiche imprimée)." />
      <div data-liste-alertes className="mt-1 max-h-48 overflow-y-auto border-t border-neutral-200 pt-2">
        {calcul && nombre === 0 && <p className="text-xs text-neutral-400">Mesure en cours…</p>}
        {!calcul && nombre === 0 && <p className="text-xs text-neutral-500">{montrees ? "Aucune alerte sur cette page." : "Alertes masquées."}</p>}
        {elements
          .filter((e) => alertes.has(e.id))
          .flatMap((e) => alertes.get(e.id)!.map((a) => ({ e, a })))
          .map(({ e, a }) => (
            <button
              key={`${e.id}-${a.genre}`}
              data-alerte-ligne={e.id}
              data-genre-alerte={a.genre}
              onClick={() => useEditeur.getState().selectionner([e.id])}
              className="mb-1 flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left hover:bg-neutral-100"
              title="Choisir ce texte"
            >
              <TriangleAlert size={14} className="mt-0.5 shrink-0 text-amber-500" />
              <span className="text-xs text-neutral-700">
                <span className="font-medium text-neutral-900">« {nomTexte(e.id)} » </span>
                {a.message}
              </span>
            </button>
          ))}
      </div>
    </Bulle>
  );
}

/** La page affichée est-elle celle dont les alertes sont à jour ? (pour les essais). */
export const alertesDeLaPage = () => useAides.getState().mesuree === pageCourante(useEditeur.getState()).id;
