// La description d'une page vidéo pour l'export par le noyau (étape 4, lot 4). Chaque élément
// est dessiné au repos par les mêmes composants qu'à l'écran, hors écran, dans un contexte qui
// écrit du SVG (`contexteSvg.ts`) : ses calques sont dans son propre repère, la boîte de
// l'élément allant de (0, 0) à (largeur, hauteur). Le noyau rend ces calques une fois, puis,
// image par image, les pose avec la pose et les effets du moment (mêmes formules qu'ici, voir
// `noyau/src/animation.rs`), avec les vidéos décodées depuis leurs originaux.

import Konva from "konva";
import { SceneCanvas } from "konva/lib/Canvas";
import { createElement, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Group, Layer, Rect, Stage } from "react-konva";
import { remplissageKonva } from "../editeur/couleurs";
import { prechargerPage, ressourceDeImage } from "../editeur/images";
import { compteurMorceaux, etenduesDesMots, RenduElement } from "../editeur/RenduElement";
import type { ClipAudio, ElementPage, Format, PageEliot, SousTitre } from "../modele/types";
import { fichiersDePolice } from "../polices";
import { ContexteSvg, DegradeSvg, type Calque } from "./contexteSvg";

export interface CalquesElement {
  /** L'élément tel qu'il est dans le document (le noyau en lit la boîte, le temps, la piste,
   *  les animations, les clés, la transition et le son). */
  element: ElementPage;
  calques: Calque[];
  /** Texte par morceaux : les totaux du texte tel qu'il est coupé en lignes. */
  totaux?: { lettres: number; mots: number; lignes: number };
}

export interface PoliceCalques {
  famille: string;
  style: "normal" | "italic";
  poidsMin: number;
  poidsMax: number;
  /** Le fichier, en base64. */
  donnees: string;
}

export interface DescriptionPage {
  largeur: number;
  hauteur: number;
  /** Durée de la page, en ms. */
  duree: number;
  fond: Calque[];
  elements: CalquesElement[];
  polices: PoliceCalques[];
  /** Les sons de la page (lot 5), tels que le document les garde : le noyau les mixe. */
  sons: ClipAudio[];
}

/** L'image d'une vidéo pendant l'enregistrement : un petit canevas vide (Konva peut le dessiner
 *  pour de vrai), que le noyau remplacera par l'original. */
const videosMarquees = new WeakMap<object, string>();
function marqueVideo(ressource: string): CanvasImageSource {
  const c = document.createElement("canvas");
  c.width = 2;
  c.height = 2;
  videosMarquees.set(c, ressource);
  return c;
}

const sources = {
  reconnaitre(source: unknown) {
    const video = typeof source === "object" && source ? videosMarquees.get(source) : undefined;
    if (video) return { video };
    const ressource = ressourceDeImage(source);
    if (ressource) return { ressource };
    if (source instanceof HTMLImageElement && /^data:image\/svg\+xml/.test(source.src)) return { href: source.src };
    return undefined;
  },
};

/** L'élément au repos, dans son propre repère : ni position, ni rotation, ni opacité, ni temps
 *  (ce que le noyau applique lui-même), mais ses animations (un texte par morceaux se dessine
 *  lettre par lettre). */
function auRepos(el: ElementPage): ElementPage {
  return { ...el, x: 0, y: 0, rotation: 0, opacite: 1, visible: true, temps: undefined, cles: undefined, transition: undefined } as ElementPage;
}

function Scene({ page, format, pret }: { page: PageEliot; format: Format; pret: (calque: Konva.Layer) => void }) {
  const calque = useRef<Konva.Layer>(null);
  useEffect(() => {
    if (calque.current) pret(calque.current);
  }, [pret]);
  return createElement(
    Stage,
    { width: 1, height: 1 },
    createElement(
      Layer,
      { ref: calque },
      createElement(Rect, { name: "fond-page", width: format.largeur, height: format.hauteur, ...remplissageKonva(page.fond, format.largeur, format.hauteur), listening: false }),
      ...page.elements.map((el) =>
        createElement(
          Group,
          { key: el.id, name: "porte-element" },
          createElement(RenduElement, { el: auRepos(el), statique: true, imageVideo: el.type === "video" ? marqueVideo(el.ressource) : undefined }),
        ),
      ),
    ),
  );
}

type FormeKonva = Konva.Shape & Record<string, (...a: unknown[]) => unknown>;

/** Pendant l'enregistrement, Konva dessine sans toile intermédiaire et donne ses dégradés en
 *  clair (il les fabrique sinon dans un canevas à part, illisibles). */
function patcherKonva(): () => void {
  const proto = Konva.Shape.prototype as unknown as Record<string, unknown>;
  const avant = { tampon: proto._useBufferCanvas, lineaire: proto._getLinearGradient, radial: proto._getRadialGradient };
  proto._useBufferCanvas = () => false;
  proto._getLinearGradient = function (this: FormeKonva) {
    const arrets = this.fillLinearGradientColorStops() as (number | string)[] | undefined;
    if (!arrets) return undefined;
    const a = this.fillLinearGradientStartPoint() as { x: number; y: number };
    const b = this.fillLinearGradientEndPoint() as { x: number; y: number };
    const d = new DegradeSvg("lineaire", [a.x, a.y, b.x, b.y]);
    for (let i = 0; i < arrets.length; i += 2) d.addColorStop(Number(arrets[i]), String(arrets[i + 1]));
    return d;
  };
  proto._getRadialGradient = function (this: FormeKonva) {
    const arrets = this.fillRadialGradientColorStops() as (number | string)[] | undefined;
    if (!arrets) return undefined;
    const a = this.fillRadialGradientStartPoint() as { x: number; y: number };
    const b = this.fillRadialGradientEndPoint() as { x: number; y: number };
    const d = new DegradeSvg("radial", [a.x, a.y, Number(this.fillRadialGradientStartRadius()), b.x, b.y, Number(this.fillRadialGradientEndRadius())]);
    for (let i = 0; i < arrets.length; i += 2) d.addColorStop(Number(arrets[i]), String(arrets[i + 1]));
    return d;
  };
  return () => {
    proto._useBufferCanvas = avant.tampon;
    proto._getLinearGradient = avant.lineaire;
    proto._getRadialGradient = avant.radial;
  };
}

/** Une toile Konva dont le contexte écrit du SVG. */
function toileSvg(contexte: ContexteSvg): SceneCanvas {
  const toile = new SceneCanvas({ width: 1, height: 1, pixelRatio: 1 });
  (toile.getContext() as unknown as { _context: unknown })._context = contexte;
  return toile;
}

type LettreKonva = { char: string; index: number; lineIndex: number; x: number; y: number; width: number; context: Konva.Context };

/**
 * Enregistre un nœud Konva (et ce qu'il contient) dans son propre repère. Un texte par morceaux :
 * chaque lettre devient un calque marqué de ses rangs. Un sous-titre dont le mot prononcé change
 * de couleur (`actif`) est enregistré deux fois : ses lettres ordinaires, puis leur variante du
 * mot prononcé ; le noyau dessine l'une ou l'autre selon l'instant.
 */
function enregistrer(noeud: Konva.Node, prefixe: string, actif?: SousTitre["actif"]): { calques: Calque[]; totaux?: CalquesElement["totaux"] } {
  const contexte = new ContexteSvg(sources, prefixe);
  let totaux: CalquesElement["totaux"];
  const textes = noeud instanceof Konva.Container ? (noeud.find("Text") as Konva.Text[]) : [];
  const remis: [Konva.Text, unknown][] = [];
  const parMorceaux: [Konva.Text, ReturnType<typeof compteurMorceaux>][] = [];
  for (const t of textes) {
    const avant = t.charRenderFunc();
    if (!avant) continue;
    const compter = compteurMorceaux(() => t.textArr);
    remis.push([t, avant]);
    parMorceaux.push([t, compter]);
    t.charRenderFunc((c: LettreKonva) => {
      const r = compter(c);
      totaux = r.totaux;
      contexte.debutMorceau(r, c.x + c.width / 2, c.y - t.fontSize() * 0.35, t.fontSize());
    });
  }
  try {
    const toile = toileSvg(contexte);
    if (noeud instanceof Konva.Container) noeud.drawScene(toile, noeud);
    else (noeud as Konva.Shape).drawScene(toile);
    if (actif) {
      for (const [t, compter] of parMorceaux) {
        t.charRenderFunc((c: LettreKonva) => {
          const r = compter(c);
          const m = etenduesDesMots(t)[r.mot];
          const my = c.y - t.fontSize() * 0.35;
          c.context.setAttr("fillStyle", actif.couleur);
          contexte.debutMorceau(r, c.x + c.width / 2, my, t.fontSize(), { mx: m ? (m.x0 + m.x1) / 2 : c.x + c.width / 2, my });
        });
        t.drawScene(toile, noeud as Konva.Container);
      }
    }
  } finally {
    for (const [t, f] of remis) t.charRenderFunc(f as never);
  }
  return { calques: contexte.calques(), totaux };
}

/** Les familles de police que les calques demandent (premières de chaque pile, et Inter, la
 *  police de secours de la pile). */
function famillesDemandees(calques: Calque[]): string[] {
  const familles = new Set<string>();
  for (const c of calques) {
    if (c.genre !== "svg") continue;
    for (const m of c.svg.matchAll(/font-family="([^"]*)"/g)) {
      for (const brut of m[1].replace(/&quot;/g, '"').split(",")) {
        const f = brut.trim().replace(/^["']|["']$/g, "");
        if (f && !/^(serif|sans-serif|monospace|cursive|fantasy|system-ui)$/.test(f)) familles.add(f);
      }
    }
  }
  return [...familles];
}

function enBase64(octets: ArrayBuffer): string {
  const t = new Uint8Array(octets);
  let s = "";
  for (let i = 0; i < t.length; i += 0x8000) s += String.fromCharCode(...t.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Décrit une page vidéo pour le noyau : fond, calques de chaque élément au repos, polices. */
export async function decrirePage(page: PageEliot, format: Format): Promise<DescriptionPage> {
  await prechargerPage(page);
  const support = document.createElement("div");
  const racine = createRoot(support);
  try {
    // Un rendu qui n'aboutit pas (dessin impossible) ne doit pas bloquer l'export : au bout de
    // vingt secondes, une erreur claire.
    const calque = await new Promise<Konva.Layer>((pret, echec) => {
      const minuteur = setTimeout(() => echec(new Error("la page n'a pas pu être dessinée pour l'export")), 20_000);
      racine.render(
        createElement(Scene, {
          page,
          format,
          pret: (c: Konva.Layer) => {
            clearTimeout(minuteur);
            pret(c);
          },
        }),
      );
    });
    // Une image laisse au moteur le temps de finir ses décodages en cours.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const fond = calque.findOne(".fond-page");
    const porteurs = calque.find(".porte-element");
    const elements: CalquesElement[] = [];
    let fondCalques: Calque[] = [];
    // Konva n'est modifié que le temps de l'enregistrement, d'un seul tenant : la fenêtre ne se
    // redessine pas entre-temps.
    const restaurer = patcherKonva();
    try {
      page.elements.forEach((el, i) => {
        if (!el.visible) return;
        const groupe = (porteurs[i] as Konva.Group | undefined)?.getChildren()[0];
        if (!groupe) return;
        const { calques, totaux } = enregistrer(groupe, `e${i}_`, el.type === "texte" && el.sousTitre?.actif && el.temps ? el.sousTitre.actif : undefined);
        elements.push({ element: el, calques, ...(totaux ? { totaux } : {}) });
      });
      if (fond) fondCalques = enregistrer(fond, "f_").calques;
    } finally {
      restaurer();
    }
    const familles = famillesDemandees([...fondCalques, ...elements.flatMap((e) => e.calques)]);
    const polices: PoliceCalques[] = [];
    for (const famille of familles) {
      for (const f of await fichiersDePolice(famille)) polices.push({ famille: f.famille, style: f.style, poidsMin: f.poidsMin, poidsMax: f.poidsMax, donnees: enBase64(f.octets) });
    }
    return { largeur: format.largeur, hauteur: format.hauteur, duree: page.duree ?? 0, fond: fondCalques, elements, polices, sons: page.audio ?? [] };
  } finally {
    racine.unmount();
  }
}
