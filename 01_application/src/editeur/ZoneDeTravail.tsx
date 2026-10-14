// La zone de travail : la page à l'échelle, la sélection, les poignées, les gestes.
//
// Quatre calques Konva (BRIEF § 6) : fond (ombre de la page), page (les éléments), geste
// (vide au repos ; pendant un geste, il reçoit ce qui bouge : règle 11) et interface
// (poignées, rectangle de sélection, contour de survol).
// Pendant un geste, rien ne passe par React ni par le store (règle 3) : Konva déplace les
// nœuds, le store reçoit le résultat à la fin, en une seule étape d'historique.

import Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";
import { Group, Layer, Rect, Stage, Transformer } from "react-konva";
import { useEditeur } from "../etat/editeur";
import type { ElementPage } from "../modele/types";
import { EditeurTexte } from "./EditeurTexte";
import { MenuContextuel } from "./MenuContextuel";
import { MiniBarre } from "./MiniBarre";
import { RenduElement } from "./RenduElement";
import { aimanter, cibles, type Cibles } from "./reperes";
import { scene, signalerGeste } from "./scene";

const MARGE = 56;
const ACCENT = "#4f46e5";
const ROSE_REPERE = "#ff3d8b";
const SEUIL_AIMANT_ECRAN = 6;
const COINS = ["top-left", "top-right", "bottom-left", "bottom-right"];
const COTES_LATERAUX = ["middle-left", "middle-right"];
const TOUS = [...COINS, ...COTES_LATERAUX, "top-center", "bottom-center"];
const PAS_ROTATION = [0, 45, 90, 135, 180, 225, 270, 315];

const arrondir = (v: number) => Math.round(v * 100) / 100;

/** Le groupe « élément » qui contient une forme cliquée, s'il y en a un. */
function groupeElement(noeud: Konva.Node | null): Konva.Group | null {
  let courant: Konva.Node | null = noeud;
  while (courant) {
    if (courant.hasName("element")) return courant as Konva.Group;
    courant = courant.getParent();
  }
  return null;
}

/** Styles des poignées : rondes aux coins, en pilule sur les côtés (comme Canva). */
function stylerPoignee(poignee: Konva.Rect) {
  const nom = poignee.name();
  if (nom.includes("middle-left") || nom.includes("middle-right")) {
    poignee.setAttrs({ width: 7, height: 18, offsetX: 3.5, offsetY: 9, cornerRadius: 4 });
  } else if (nom.includes("top-center") || nom.includes("bottom-center")) {
    poignee.setAttrs({ width: 18, height: 7, offsetX: 9, offsetY: 3.5, cornerRadius: 4 });
  } else if (nom.includes("rotater")) {
    poignee.setAttrs({ width: 18, height: 18, offsetX: 9, offsetY: 9, cornerRadius: 9, fill: "#ffffff" });
  } else {
    poignee.setAttrs({ cornerRadius: 6 });
  }
}

interface EtatGeste {
  noeuds: { n: Konva.Group; rang: number }[];
  cibles: Cibles;
}

export function ZoneDeTravail() {
  const conteneur = useRef<HTMLDivElement>(null);
  const [taille, setTaille] = useState({ l: 900, h: 600 });
  const page = useEditeur((s) => s.document.page);
  const elements = useEditeur((s) => s.document.elements);
  const selection = useEditeur((s) => s.selection);
  const enEdition = useEditeur((s) => s.enEdition);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const stageRef = useRef<Konva.Stage>(null);
  const calquePageRef = useRef<Konva.Layer>(null);
  const groupePageRef = useRef<Konva.Group>(null);
  const calqueGesteRef = useRef<Konva.Layer>(null);
  const groupeGesteRef = useRef<Konva.Group>(null);
  const reperesRef = useRef<Konva.Group>(null);
  const calqueInterfaceRef = useRef<Konva.Layer>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const rectangleRef = useRef<Konva.Rect>(null);
  const survolRef = useRef<Konva.Rect>(null);
  const etiquetteRef = useRef<HTMLDivElement>(null);
  const geste = useRef<EtatGeste | null>(null);
  const rectangleSelection = useRef<{ x0: number; y0: number; ajout: boolean } | null>(null);

  // Taille de la zone : la page se recale à chaque redimensionnement de la fenêtre.
  useEffect(() => {
    const div = conteneur.current;
    if (!div) return;
    const observer = new ResizeObserver(() => setTaille({ l: div.clientWidth, h: div.clientHeight }));
    observer.observe(div);
    setTaille({ l: div.clientWidth, h: div.clientHeight });
    return () => observer.disconnect();
  }, []);

  const echelle = Math.max(0.02, Math.min((taille.l - 2 * MARGE) / page.largeur, (taille.h - 2 * MARGE) / page.hauteur));
  const ox = Math.round((taille.l - page.largeur * echelle) / 2);
  const oy = Math.round((taille.h - page.hauteur * echelle) / 2);
  const transformationPage = { x: ox, y: oy, scaleX: echelle, scaleY: echelle };

  useEffect(() => {
    scene.stage = stageRef.current;
    scene.groupePage = groupePageRef.current;
    scene.echelle = echelle;
  });

  // Les poignées suivent la sélection.
  const selectionnes = elements.filter((e) => selection.includes(e.id));
  const seul: ElementPage | null = selectionnes.length === 1 ? selectionnes[0] : null;
  const verrou = selectionnes.some((e) => e.verrouille);
  const poignees = verrou ? [] : seul?.type === "texte" ? [...COINS, ...COTES_LATERAUX] : seul?.type === "forme" ? TOUS : COINS;

  useEffect(() => {
    const tr = transformerRef.current;
    const gp = groupePageRef.current;
    if (!tr || !gp || geste.current) return;
    const noeuds = selection
      .filter((id) => id !== enEdition)
      .map((id) => gp.findOne((n: Konva.Node) => n.id() === id && n.hasName("element")))
      .filter((n): n is Konva.Group => !!n && n.isVisible());
    tr.nodes(noeuds);
    tr.getLayer()?.batchDraw();
  }, [selection, elements, enEdition]);

  // ---- Gestes : glisser et transformer ----

  const demarrerGeste = useCallback(
    (cible?: Konva.Node) => {
      if (geste.current) return;
      const tr = transformerRef.current!;
      const gp = groupePageRef.current!;
      const gg = groupeGesteRef.current!;
      const noeuds = new Set(tr.nodes() as Konva.Group[]);
      const groupeCible = cible ? groupeElement(cible) : null;
      if (groupeCible) noeuds.add(groupeCible);
      if (noeuds.size === 0) return;

      // Cibles des repères : les autres objets visibles, avant de déplacer quoi que ce soit.
      const autres = gp
        .getChildren((n) => n.hasName("element") && !noeuds.has(n as Konva.Group) && n.isVisible())
        .map((n) => n.getClientRect({ relativeTo: gp, skipShadow: true }))
        .map((r) => ({ x: r.x, y: r.y, largeur: r.width, hauteur: r.height }));
      const pageCourante = useEditeur.getState().document.page;

      const liste = [...noeuds].map((n) => ({ n, rang: n.zIndex() })).sort((a, b) => a.rang - b.rang);
      liste.forEach(({ n }) => n.moveTo(gg));
      tr.moveTo(calqueGesteRef.current!);
      geste.current = { noeuds: liste, cibles: cibles(pageCourante, autres) };

      survolRef.current?.visible(false);
      calquePageRef.current?.batchDraw();
      calqueInterfaceRef.current?.batchDraw();
      calqueGesteRef.current?.batchDraw();
      setMenu(null);
      signalerGeste(true);
    },
    [],
  );

  const terminerGeste = useCallback((nature: "deplacer" | "transformer") => {
    const g = geste.current;
    if (!g) return;
    geste.current = null;
    const tr = transformerRef.current!;
    const gp = groupePageRef.current!;

    // Retour sur la page, chacun à son rang d'origine.
    g.noeuds.forEach(({ n }) => n.moveTo(gp));
    g.noeuds.forEach(({ n, rang }) => n.zIndex(rang));
    tr.moveTo(calqueInterfaceRef.current!);
    reperesRef.current?.destroyChildren();
    if (etiquetteRef.current) etiquetteRef.current.style.display = "none";

    const etat = useEditeur.getState();
    const parId = new Map(etat.document.elements.map((e) => [e.id, e]));
    const modifs: Record<string, Partial<ElementPage>> = {};
    for (const { n } of g.noeuds) {
      const el = parId.get(n.id());
      if (!el) continue;
      if (nature === "deplacer") {
        modifs[el.id] = { x: arrondir(n.x()), y: arrondir(n.y()) };
        continue;
      }
      const sx = Math.abs(n.scaleX());
      const sy = Math.abs(n.scaleY());
      if (el.type === "texte") {
        const t = n.findOne("Text") as Konva.Text;
        modifs[el.id] = {
          x: arrondir(n.x()),
          y: arrondir(n.y()),
          rotation: arrondir(n.rotation()),
          largeur: arrondir(t.width() * sx),
          taillePolice: arrondir(t.fontSize() * sy),
          hauteur: arrondir(t.height() * sy),
        };
      } else {
        modifs[el.id] = {
          x: arrondir(n.x()),
          y: arrondir(n.y()),
          rotation: arrondir(n.rotation()),
          largeur: Math.max(1, arrondir(el.largeur * sx)),
          hauteur: Math.max(1, arrondir(el.hauteur * sy)),
        };
      }
      n.scale({ x: 1, y: 1 });
    }
    etat.modifierElements(modifs);
    signalerGeste(false);
    calquePageRef.current?.batchDraw();
    calqueGesteRef.current?.batchDraw();
    calqueInterfaceRef.current?.batchDraw();
  }, []);

  /** Étiquette « largeur × hauteur » ou « angle », près du pointeur, pendant un geste. */
  const montrerEtiquette = useCallback((texte: string) => {
    const div = etiquetteRef.current;
    const pointeur = stageRef.current?.getPointerPosition();
    if (!div || !pointeur) return;
    div.textContent = texte;
    div.style.display = "block";
    div.style.left = `${pointeur.x + 18}px`;
    div.style.top = `${pointeur.y + 18}px`;
  }, []);

  const dessinerReperes = useCallback((verticales: number[], horizontales: number[]) => {
    const groupe = reperesRef.current;
    if (!groupe) return;
    groupe.destroyChildren();
    const { largeur, hauteur } = useEditeur.getState().document.page;
    const epaisseur = 1 / scene.echelle;
    for (const v of verticales) groupe.add(new Konva.Line({ points: [v, 0, v, hauteur], stroke: ROSE_REPERE, strokeWidth: epaisseur, listening: false }));
    for (const h of horizontales) groupe.add(new Konva.Line({ points: [0, h, largeur, h], stroke: ROSE_REPERE, strokeWidth: epaisseur, listening: false }));
  }, []);

  useEffect(() => {
    const stage = stageRef.current!;
    const tr = transformerRef.current!;

    stage.on("dragstart.eliot", (e) => {
      const n = e.target as unknown as Konva.Node;
      if (groupeElement(n) === n) demarrerGeste(n);
    });
    stage.on("dragmove.eliot", (e) => {
      const n = e.target as unknown as Konva.Group;
      if (groupeElement(n) !== n || !geste.current || geste.current.noeuds.length !== 1) return;
      const r = n.getClientRect({ relativeTo: groupeGesteRef.current!, skipShadow: true });
      const a = aimanter({ x: r.x, y: r.y, largeur: r.width, hauteur: r.height }, geste.current.cibles, SEUIL_AIMANT_ECRAN / scene.echelle);
      if (a.dx || a.dy) n.position({ x: n.x() + a.dx, y: n.y() + a.dy });
      dessinerReperes(a.verticales, a.horizontales);
    });
    stage.on("dragend.eliot", (e) => {
      const n = e.target as unknown as Konva.Node;
      if (groupeElement(n) === n) terminerGeste("deplacer");
    });

    tr.on("transformstart.eliot", () => demarrerGeste());
    tr.on("transform.eliot", () => {
      const ancre = tr.getActiveAnchor();
      const parId = new Map(useEditeur.getState().document.elements.map((el) => [el.id, el]));
      for (const n of tr.nodes() as Konva.Group[]) {
        const el = parId.get(n.id());
        if (el?.type !== "texte" || ancre === "rotater") continue;
        // Un texte ne se déforme pas : les côtés changent sa largeur (il se réenroule), les
        // coins changent sa taille de police.
        const t = n.findOne("Text") as Konva.Text;
        const sx = n.scaleX();
        const sy = n.scaleY();
        if (ancre === "middle-left" || ancre === "middle-right") {
          t.width(Math.max(20, t.width() * sx));
        } else {
          t.fontSize(Math.max(4, t.fontSize() * sy));
          t.width(Math.max(20, t.width() * sx));
        }
        n.scale({ x: 1, y: 1 });
      }
      const noeuds = tr.nodes();
      if (ancre === "rotater") {
        const angle = ((Math.round(noeuds[0]?.rotation() ?? 0) % 360) + 360) % 360;
        montrerEtiquette(`${angle}°`);
      } else {
        const boite = tr.getClientRect();
        const premier = noeuds[0];
        if (noeuds.length === 1 && premier) {
          const r = premier.getClientRect({ skipTransform: true, skipShadow: true, skipStroke: true });
          montrerEtiquette(`${Math.round(r.width * Math.abs(premier.scaleX()))} × ${Math.round(r.height * Math.abs(premier.scaleY()))}`);
        } else {
          montrerEtiquette(`${Math.round(boite.width / scene.echelle)} × ${Math.round(boite.height / scene.echelle)}`);
        }
      }
    });
    tr.on("transformend.eliot", () => terminerGeste("transformer"));

    // Contour de survol et curseur.
    stage.on("mouseover.eliot", (e) => {
      const g = groupeElement(e.target);
      const survol = survolRef.current;
      const etat = useEditeur.getState();
      stage.container().style.cursor = g && g.draggable() ? "move" : "default";
      if (!survol || !g || geste.current || etat.selection.includes(g.id())) return;
      const r = g.getClientRect({ skipTransform: true, skipShadow: true });
      const abs = g.getAbsoluteTransform().point({ x: r.x, y: r.y });
      survol.setAttrs({ visible: true, x: abs.x, y: abs.y, width: r.width * scene.echelle, height: r.height * scene.echelle, rotation: g.getAbsoluteRotation() });
      survol.getLayer()?.batchDraw();
    });
    stage.on("mouseout.eliot", () => {
      survolRef.current?.visible(false);
      survolRef.current?.getLayer()?.batchDraw();
      stage.container().style.cursor = "default";
    });

    return () => {
      stage.off(".eliot");
      tr.off(".eliot");
    };
  }, [demarrerGeste, terminerGeste, montrerEtiquette, dessinerReperes]);

  // ---- Souris : sélection, rectangle de sélection, double-clic, clic droit ----

  const finirRectangle = useCallback(() => {
    const debut = rectangleSelection.current;
    const rect = rectangleRef.current;
    rectangleSelection.current = null;
    if (!debut || !rect) return;
    const boite = { x: rect.x(), y: rect.y(), width: rect.width(), height: rect.height() };
    rect.visible(false);
    rect.getLayer()?.batchDraw();
    if (boite.width < 3 && boite.height < 3) return;
    const gp = groupePageRef.current!;
    const ids = gp
      .getChildren((n) => n.hasName("element") && n.isVisible())
      .filter((n) => Konva.Util.haveIntersection(boite, n.getClientRect()))
      .map((n) => n.id());
    useEditeur.getState().selectionner(ids, debut.ajout);
  }, []);

  useEffect(() => {
    window.addEventListener("mouseup", finirRectangle);
    return () => window.removeEventListener("mouseup", finirRectangle);
  }, [finirRectangle]);

  const surPointeurBas = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 2) return;
    setMenu(null);
    const cible = e.target;
    if (cible.getParent() instanceof Konva.Transformer) return;
    const etat = useEditeur.getState();
    if (etat.enEdition && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const g = groupeElement(cible);
    if (!g) {
      if (!e.evt.shiftKey) etat.deselectionner();
      const p = stageRef.current!.getPointerPosition()!;
      rectangleSelection.current = { x0: p.x, y0: p.y, ajout: e.evt.shiftKey };
      rectangleRef.current?.setAttrs({ x: p.x, y: p.y, width: 0, height: 0, visible: true });
      return;
    }
    survolRef.current?.visible(false);
    if (e.evt.shiftKey) etat.basculerDansSelection(g.id());
    else if (!etat.selection.includes(g.id())) etat.selectionner([g.id()]);
  };

  const surPointeurDeplace = () => {
    const debut = rectangleSelection.current;
    const rect = rectangleRef.current;
    if (!debut || !rect) return;
    const p = stageRef.current!.getPointerPosition()!;
    rect.setAttrs({ x: Math.min(debut.x0, p.x), y: Math.min(debut.y0, p.y), width: Math.abs(p.x - debut.x0), height: Math.abs(p.y - debut.y0) });
    rect.getLayer()?.batchDraw();
  };

  const surDoubleClic = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const g = groupeElement(e.target);
    if (g) useEditeur.getState().commencerEdition(g.id());
  };

  const surClicDroit = (e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    const g = groupeElement(e.target);
    const etat = useEditeur.getState();
    if (g && !etat.selection.includes(g.id())) etat.selectionner([g.id()]);
    if (!g) etat.deselectionner();
    const p = stageRef.current!.getPointerPosition();
    if (p) setMenu({ x: p.x, y: p.y });
  };

  return (
    <div ref={conteneur} className="relative min-w-0 flex-1 overflow-hidden bg-[#e9e7e2]" onContextMenu={(e) => e.preventDefault()}>
      <Stage
        ref={stageRef}
        width={taille.l}
        height={taille.h}
        onMouseDown={surPointeurBas}
        onMouseMove={surPointeurDeplace}
        onDblClick={surDoubleClic}
        onContextMenu={surClicDroit}
      >
        <Layer listening={false}>
          <Rect x={ox} y={oy} width={page.largeur * echelle} height={page.hauteur * echelle} fill="#ffffff" shadowColor="#000000" shadowBlur={18} shadowOpacity={0.14} shadowOffsetY={4} />
        </Layer>
        <Layer ref={calquePageRef}>
          <Group ref={groupePageRef} {...transformationPage} clipX={0} clipY={0} clipWidth={page.largeur} clipHeight={page.hauteur}>
            <Rect name="fond-page" width={page.largeur} height={page.hauteur} fill={page.fond} />
            {elements.map((el) => (
              <RenduElement key={el.id} el={el} enEdition={el.id === enEdition} />
            ))}
          </Group>
        </Layer>
        <Layer ref={calqueGesteRef}>
          <Group ref={groupeGesteRef} {...transformationPage} clipX={0} clipY={0} clipWidth={page.largeur} clipHeight={page.hauteur} />
          <Group ref={reperesRef} {...transformationPage} listening={false} />
        </Layer>
        <Layer ref={calqueInterfaceRef}>
          <Rect ref={survolRef} visible={false} stroke={ACCENT} strokeWidth={1.5} listening={false} />
          <Transformer
            ref={transformerRef}
            enabledAnchors={poignees}
            rotateEnabled={!verrou}
            keepRatio={seul?.type !== "forme"}
            rotationSnaps={PAS_ROTATION}
            rotationSnapTolerance={4}
            rotateAnchorAngle={180}
            rotateAnchorOffset={28}
            rotateLineVisible={false}
            anchorSize={12}
            anchorStroke={ACCENT}
            anchorStrokeWidth={1.5}
            anchorFill="#ffffff"
            borderStroke={ACCENT}
            borderStrokeWidth={1.5}
            flipEnabled={false}
            ignoreStroke
            anchorStyleFunc={stylerPoignee}
            boundBoxFunc={(ancienne, nouvelle) => (Math.abs(nouvelle.width) < 8 || Math.abs(nouvelle.height) < 8 ? ancienne : nouvelle)}
          />
          <Rect ref={rectangleRef} visible={false} fill="rgba(79,70,229,0.08)" stroke={ACCENT} strokeWidth={1} listening={false} />
        </Layer>
      </Stage>
      <EditeurTexte />
      <MiniBarre taille={taille} ouvrirMenu={(x, y) => setMenu({ x, y })} />
      {menu && <MenuContextuel x={menu.x} y={menu.y} fermer={() => setMenu(null)} />}
      <div ref={etiquetteRef} className="pointer-events-none absolute hidden rounded-md bg-neutral-900/90 px-2 py-0.5 text-xs font-medium text-white tabular-nums" />
    </div>
  );
}
