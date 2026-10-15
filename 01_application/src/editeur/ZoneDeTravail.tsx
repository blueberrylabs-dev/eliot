// La zone de travail : la page à l'échelle, la sélection, les poignées, les gestes.
//
// Quatre calques Konva (BRIEF § 6) : fond (ombre de la page), page (les éléments), geste
// (vide au repos ; pendant un geste, il reçoit ce qui bouge : règle 11) et interface
// (poignées, rectangle de sélection, contour de survol).
// Pendant un geste, rien ne passe par React ni par le store (règle 3) : Konva déplace les
// nœuds, le store reçoit le résultat à la fin, en une seule étape d'historique.
// Zoom : la page s'ajuste à la zone, ou suit le zoom choisi (barre du bas, Ctrl + molette) ;
// la molette fait défiler, la barre d'espace ou le bouton du milieu font glisser la vue.

import Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, Group, Layer, Rect, Stage, Transformer } from "react-konva";
import { clesActives, elementsCourants, pageCourante, useEditeur } from "../etat/editeur";
import { poserCle } from "../modele/animation";
import { estTrait, nouvelId } from "../modele/fabriques";
import { deplacerRecadrage, ecranAppareil } from "../modele/cadres";
import { creerTrait, distanceAuTrait, OUTILS_DESSIN } from "../modele/dessin";
import { mesurePolice } from "../modele/mesure";
import { celluleSous, disposerTableau } from "../modele/tableaux";
import { recoitPhoto, type ElementPage, type Format, type Recadrage } from "../modele/types";
import { remplissageKonva } from "./couleurs";
import { EditeurCellule } from "./EditeurCellule";
import { EditeurTexte } from "./EditeurTexte";
import { MenuContextuel } from "./MenuContextuel";
import { MiniBarre } from "./MiniBarre";
import { RenduElement, useTransitions } from "./RenduElement";
import { aimanter, cibles, type Cibles } from "./reperes";
import { deposerFichiers, deposerChemins } from "./depot";
import { scene, signalerGeste } from "./scene";
import { surDepotFichiers } from "../pont/tauri";
import { useTemps } from "../etat/temps";

/** Échelle et position de la page dans la zone. Une page plus petite que la zone reste
 *  centrée ; plus grande, elle suit la position voulue sans quitter la zone. */
function cadrer(taille: { l: number; h: number }, format: Format, zoom: number | null, voulue: { x: number; y: number } | null) {
  const ajuste = Math.max(0.02, Math.min((taille.l - 2 * MARGE) / format.largeur, (taille.h - 2 * MARGE) / format.hauteur));
  const echelle = zoom ?? ajuste;
  const pl = format.largeur * echelle;
  const ph = format.hauteur * echelle;
  const borne = (v: number, taillePage: number, tailleZone: number) =>
    taillePage + 2 * MARGE <= tailleZone || v === undefined ? Math.round((tailleZone - taillePage) / 2) : Math.round(Math.min(MARGE, Math.max(tailleZone - taillePage - MARGE, v)));
  return {
    ajuste,
    echelle,
    ox: voulue ? borne(voulue.x, pl, taille.l) : Math.round((taille.l - pl) / 2),
    oy: voulue ? borne(voulue.y, ph, taille.h) : Math.round((taille.h - ph) / 2),
  };
}

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
  const format = useEditeur((s) => s.document.format);
  const fond = useEditeur((s) => pageCourante(s).fond);
  const idPage = useEditeur((s) => s.pageActive);
  const elements = useEditeur(elementsCourants);
  const selection = useEditeur((s) => s.selection);
  const enEdition = useEditeur((s) => s.enEdition);
  const enAjustement = useEditeur((s) => s.enAjustement);
  const zoom = useEditeur((s) => s.zoom);
  const styleCopie = useEditeur((s) => s.styleCopie);
  const dessin = useEditeur((s) => s.dessin);
  const celluleEnEdition = useEditeur((s) => s.celluleEnEdition);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [voulue, setVoulue] = useState<{ x: number; y: number } | null>(null);
  const [depotFichiers, setDepotFichiers] = useState(false);
  const espace = useRef(false);
  const espaceAGlisse = useRef(false);
  const vue = useRef<{ x0: number; y0: number; ox: number; oy: number } | null>(null);

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
  /** Photo glissée dans son cadre (mode ajustement) : point de départ et cadrage de départ. */
  const panoramique = useRef<{ id: string; x0: number; y0: number; recadrage: Recadrage } | null>(null);
  const rectangleSelection = useRef<{ x0: number; y0: number; ajout: boolean } | null>(null);
  /** Trait en cours (mode dessin) : ses points en pixels de la page et sa ligne provisoire. */
  const trait = useRef<{ points: number[]; ligne: Konva.Line } | null>(null);
  /** Gomme en cours : une seule étape d'annulation pour tout le geste. */
  const gomme = useRef<string | null>(null);
  const curseurGommeRef = useRef<Konva.Circle>(null);

  // Taille de la zone : la page se recale à chaque redimensionnement de la fenêtre.
  useEffect(() => {
    const div = conteneur.current;
    if (!div) return;
    const observer = new ResizeObserver(() => setTaille({ l: div.clientWidth, h: div.clientHeight }));
    observer.observe(div);
    setTaille({ l: div.clientWidth, h: div.clientHeight });
    return () => observer.disconnect();
  }, []);

  const transitions = useTransitions(elements);
  const { echelle, ox, oy, ajuste } = cadrer(taille, format, zoom, voulue);
  const transformationPage = { x: ox, y: oy, scaleX: echelle, scaleY: echelle };
  const cadrage = useRef({ echelle, ox, oy, ajuste });
  cadrage.current = { echelle, ox, oy, ajuste };

  useEffect(() => {
    scene.stage = stageRef.current;
    scene.groupePage = groupePageRef.current;
    scene.echelle = echelle;
  });

  useEffect(() => useEditeur.getState().definirZoomAjuste(ajuste), [ajuste]);

  // Revenir à « ajuster » recentre la page ; changer de page aussi.
  useEffect(() => {
    if (zoom === null) setVoulue(null);
  }, [zoom]);
  useEffect(() => setVoulue(null), [idPage]);

  /** Zoom autour d'un point de la zone : ce point reste sous le pointeur. */
  const zoomerAutour = useCallback((nouveau: number, px: number, py: number) => {
    const { echelle: e, ox: x, oy: y } = cadrage.current;
    const borne = Math.max(0.05, Math.min(8, nouveau));
    voulueParPointeur.current = true;
    setVoulue({ x: px - ((px - x) * borne) / e, y: py - ((py - y) * borne) / e });
    useEditeur.getState().definirZoom(borne);
  }, []);

  // Molette : défiler, ou zoomer avec Ctrl.
  useEffect(() => {
    const div = conteneur.current;
    if (!div) return;
    const surMolette = (e: WheelEvent) => {
      e.preventDefault();
      // En ajustant une photo dans son cadre, la molette l'agrandit ou la réduit.
      const etat = useEditeur.getState();
      const ajuste = etat.enAjustement ? elementsCourants(etat).find((x) => x.id === etat.enAjustement) : undefined;
      if (ajuste && recoitPhoto(ajuste) && !e.ctrlKey) {
        const zoom = Math.max(1, Math.min(5, ajuste.recadrage.zoom * Math.exp(-e.deltaY * 0.0015)));
        etat.modifierElements({ [ajuste.id]: { recadrage: { ...ajuste.recadrage, zoom } } as Partial<ElementPage> }, `zoom-photo:${ajuste.id}`);
        return;
      }
      const { echelle: ech, ox: x, oy: y } = cadrage.current;
      if (e.ctrlKey || e.metaKey) {
        const r = div.getBoundingClientRect();
        zoomerAutour(ech * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
        return;
      }
      const dx = e.shiftKey ? e.deltaY : e.deltaX;
      const dy = e.shiftKey ? 0 : e.deltaY;
      setVoulue({ x: x - dx, y: y - dy });
    };
    div.addEventListener("wheel", surMolette, { passive: false });
    return () => div.removeEventListener("wheel", surMolette);
  }, [zoomerAutour]);

  // Fichiers déposés depuis le gestionnaire de fichiers (Tauri donne leurs chemins).
  useEffect(() => {
    let fin: (() => void) | undefined;
    let actif = true;
    void surDepotFichiers(
      (chemins, x, y) => void deposerChemins(chemins, x, y),
      (survol) => setDepotFichiers(survol),
    ).then((f) => {
      if (actif) fin = f;
      else f();
    });
    return () => {
      actif = false;
      fin?.();
    };
  }, []);

  // Barre d'espace maintenue : la vue se déplace à la souris, comme dans Canva. Sur une page
  // vidéo, un appui bref (sans déplacer la vue) lance ou arrête la lecture, comme dans CapCut.
  useEffect(() => {
    const bas = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const cible = e.target as HTMLElement;
      if (cible.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(cible.tagName)) return;
      if (useEditeur.getState().enEdition || useEditeur.getState().apercu) return;
      espace.current = true;
      espaceAGlisse.current = false;
      if (stageRef.current) stageRef.current.container().style.cursor = "grab";
      e.preventDefault();
    };
    const haut = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !espace.current) return;
      espace.current = false;
      if (stageRef.current) stageRef.current.container().style.cursor = "default";
      if (!espaceAGlisse.current && pageCourante(useEditeur.getState()).duree !== undefined) useTemps.getState().basculerLecture();
    };
    window.addEventListener("keydown", bas);
    window.addEventListener("keyup", haut);
    return () => {
      window.removeEventListener("keydown", bas);
      window.removeEventListener("keyup", haut);
    };
  }, []);

  // Le zoom choisi par la barre du bas garde le centre de la zone.
  const zoomPrecedent = useRef(zoom);
  useEffect(() => {
    const avant = zoomPrecedent.current;
    zoomPrecedent.current = zoom;
    if (zoom === null || avant === zoom || voulueParPointeur.current) {
      voulueParPointeur.current = false;
      return;
    }
    const { ajuste: aj, ox: x, oy: y } = cadrage.current;
    const e = avant ?? aj;
    const cx = taille.l / 2;
    const cy = taille.h / 2;
    setVoulue({ x: cx - ((cx - x) * zoom) / e, y: cy - ((cy - y) * zoom) / e });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);
  const voulueParPointeur = useRef(false);

  // Le curseur dit l'outil : une croix pour tracer, le rond de la gomme pour effacer.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.container().style.cursor = dessin ? (dessin.outil === "gomme" ? "none" : "crosshair") : "default";
    if (dessin?.outil !== "gomme" && curseurGommeRef.current?.visible()) {
      curseurGommeRef.current.visible(false);
      curseurGommeRef.current.getLayer()?.batchDraw();
    }
  }, [dessin]);

  // Les poignées suivent la sélection.
  const selectionnes = elements.filter((e) => selection.includes(e.id));
  const seul: ElementPage | null = selectionnes.length === 1 ? selectionnes[0] : null;
  const verrou = selectionnes.some((e) => e.verrouille);
  // Un texte change de largeur par ses côtés ; une ligne ou une flèche ne s'étire qu'en
  // longueur ; une forme s'étire dans tous les sens ; le reste garde ses proportions.
  // Un élément à images clés s'agrandit sans se déformer (son échelle va dans la clé).
  const enCles = useTemps((s) => !!seul && clesActives(seul, s.tete));
  const poignees = verrou
    ? []
    : enCles
      ? COINS
      : seul?.type === "texte"
      ? [...COINS, ...COTES_LATERAUX]
      : seul?.type === "forme"
        ? estTrait(seul.forme)
          ? COTES_LATERAUX
          : TOUS
        : seul?.type === "cadre" || seul?.type === "graphique" || seul?.type === "tableau"
          ? TOUS
          : COINS;

  useEffect(() => {
    const tr = transformerRef.current;
    const gp = groupePageRef.current;
    if (!tr || !gp || geste.current) return;
    const noeuds = selection
      .filter((id) => id !== enEdition && id !== enAjustement)
      .map((id) => gp.findOne((n: Konva.Node) => n.id() === id && n.hasName("element")))
      .filter((n): n is Konva.Group => !!n && n.isVisible());
    tr.nodes(noeuds);
    tr.getLayer()?.batchDraw();
  }, [selection, elements, enEdition, enAjustement]);

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
      const formatCourant = useEditeur.getState().document.format;

      const liste = [...noeuds].map((n) => ({ n, rang: n.zIndex() })).sort((a, b) => a.rang - b.rang);
      liste.forEach(({ n }) => n.moveTo(gg));
      tr.moveTo(calqueGesteRef.current!);
      geste.current = { noeuds: liste, cibles: cibles(formatCourant, autres) };

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
    const parId = new Map(elementsCourants(etat).map((e) => [e.id, e]));
    const modifs: Record<string, Partial<ElementPage>> = {};
    const tete = useTemps.getState().tete;
    for (const { n } of g.noeuds) {
      const el = parId.get(n.id());
      if (!el) continue;
      // Un élément à images clés : le geste pose (ou reprend) la clé de cet instant. Le groupe
      // garde son échelle, qui est celle de la clé.
      if (clesActives(el, tete)) {
        const pose = nature === "deplacer" ? { x: arrondir(n.x()), y: arrondir(n.y()) } : { x: arrondir(n.x()), y: arrondir(n.y()), rotation: arrondir(n.rotation()), echelle: Math.round(Math.abs(n.scaleX()) * 1000) / 1000 };
        modifs[el.id] = { cles: poserCle(el, tete - el.temps!.debut, pose) };
        continue;
      }
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
    const { largeur, hauteur } = useEditeur.getState().document.format;
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
      const parId = new Map(elementsCourants(useEditeur.getState()).map((el) => [el.id, el]));
      for (const n of tr.nodes() as Konva.Group[]) {
        const el = parId.get(n.id());
        // Un texte à images clés s'agrandit d'un bloc : son échelle va dans la clé.
        if (el?.type !== "texte" || ancre === "rotater" || clesActives(el)) continue;
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
      if (espace.current || etat.dessin) return;
      stage.container().style.cursor = etat.styleCopie ? "copy" : g && g.draggable() ? "move" : "default";
      if (!survol || !g || geste.current || etat.selection.includes(g.id())) return;
      const r = g.getClientRect({ skipTransform: true, skipShadow: true });
      const abs = g.getAbsoluteTransform().point({ x: r.x, y: r.y });
      survol.setAttrs({ visible: true, x: abs.x, y: abs.y, width: r.width * scene.echelle, height: r.height * scene.echelle, rotation: g.getAbsoluteRotation() });
      survol.getLayer()?.batchDraw();
    });
    stage.on("mouseout.eliot", () => {
      survolRef.current?.visible(false);
      survolRef.current?.getLayer()?.batchDraw();
      if (!espace.current && !useEditeur.getState().dessin) stage.container().style.cursor = useEditeur.getState().styleCopie ? "copy" : "default";
    });

    return () => {
      stage.off(".eliot");
      tr.off(".eliot");
    };
  }, [demarrerGeste, terminerGeste, montrerEtiquette, dessinerReperes]);

  // ---- Souris : sélection, rectangle de sélection, double-clic, clic droit ----

  const finirRectangle = useCallback(() => {
    if (trait.current) {
      const { points, ligne } = trait.current;
      trait.current = null;
      ligne.destroy();
      calqueGesteRef.current?.batchDraw();
      const etat = useEditeur.getState();
      const r = etat.dessin;
      if (r && r.outil !== "gomme" && points.length >= 2) {
        const el = creerTrait(points, r.outil, r.couleur, r.epaisseur, nouvelId());
        etat.appliquerPage((p) => ({ ...p, elements: [...p.elements, el] }));
      }
      return;
    }
    if (gomme.current) {
      gomme.current = null;
      return;
    }
    if (panoramique.current) {
      panoramique.current = null;
      if (stageRef.current) stageRef.current.container().style.cursor = "default";
      return;
    }
    if (vue.current) {
      vue.current = null;
      if (stageRef.current) stageRef.current.container().style.cursor = espace.current ? "grab" : "default";
      return;
    }
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

  /** Le pointeur en pixels de la page. */
  const pointPage = () => {
    const p = stageRef.current?.getPointerPosition();
    return p ? groupePageRef.current!.getAbsoluteTransform().copy().invert().point(p) : null;
  };

  /** La gomme retire les traits de dessin qu'elle touche. */
  const gommer = (x: number, y: number) => {
    const etat = useEditeur.getState();
    const rayon = (etat.dessin?.epaisseur ?? 20) / 2;
    const touches = new Set(elementsCourants(etat).filter((el) => el.type === "dessin" && !el.verrouille && el.visible && distanceAuTrait(el, x, y) <= rayon).map((el) => el.id));
    if (touches.size === 0) return;
    etat.appliquerPage((p) => ({ ...p, elements: p.elements.filter((el) => !touches.has(el.id)) }), gomme.current ?? undefined);
  };

  const surPointeurBas = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 2) return;
    setMenu(null);
    // Déplacer la vue : barre d'espace maintenue, ou bouton du milieu.
    if (espace.current || e.evt.button === 1) {
      e.evt.preventDefault();
      espaceAGlisse.current = true;
      const { ox: x, oy: y } = cadrage.current;
      vue.current = { x0: e.evt.clientX, y0: e.evt.clientY, ox: x, oy: y };
      stageRef.current!.container().style.cursor = "grabbing";
      stageRef.current?.stopDrag();
      return;
    }
    const cible = e.target;
    if (cible.getParent() instanceof Konva.Transformer) return;
    const etat = useEditeur.getState();
    // Mode dessin : la souris trace (ou gomme), elle ne sélectionne rien.
    if (etat.dessin) {
      const p = pointPage();
      if (!p) return;
      if (etat.dessin.outil === "gomme") {
        gomme.current = `gomme:${Date.now()}`;
        gommer(p.x, p.y);
        return;
      }
      const reglage = OUTILS_DESSIN[etat.dessin.outil];
      const ligne = new Konva.Line({
        points: [p.x, p.y, p.x + 0.01, p.y],
        stroke: etat.dessin.couleur,
        strokeWidth: etat.dessin.epaisseur,
        lineCap: reglage.bout,
        lineJoin: "round",
        tension: 0.45,
        opacity: reglage.opacite,
        listening: false,
      });
      groupeGesteRef.current?.add(ligne);
      calqueGesteRef.current?.batchDraw();
      trait.current = { points: [p.x, p.y], ligne };
      return;
    }
    if (etat.enEdition && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const g = groupeElement(cible);
    // Ajustement : un appui sur la photo commence à la faire glisser dans son cadre.
    if (g && etat.enAjustement === g.id()) {
      const el = elementsCourants(etat).find((x) => x.id === g.id());
      const p = stageRef.current!.getPointerPosition();
      if (el && recoitPhoto(el) && p) {
        const pp = groupePageRef.current!.getAbsoluteTransform().copy().invert().point(p);
        panoramique.current = { id: el.id, x0: pp.x, y0: pp.y, recadrage: el.recadrage };
        stageRef.current!.container().style.cursor = "grabbing";
      }
      return;
    }
    if (!g) {
      if (!e.evt.shiftKey) etat.deselectionner();
      const p = stageRef.current!.getPointerPosition()!;
      rectangleSelection.current = { x0: p.x, y0: p.y, ajout: e.evt.shiftKey };
      rectangleRef.current?.setAttrs({ x: p.x, y: p.y, width: 0, height: 0, visible: true });
      return;
    }
    survolRef.current?.visible(false);
    if (etat.styleCopie) {
      etat.appliquerStyle(g.id());
      return;
    }
    if (e.evt.shiftKey) etat.basculerDansSelection(g.id());
    else if (e.evt.altKey) etat.selectionnerSeul(g.id());
    else if (!etat.selection.includes(g.id())) etat.selectionner([g.id()]);
  };

  const surPointeurDeplace = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const etatDessin = useEditeur.getState().dessin;
    if (etatDessin?.outil === "gomme") {
      const p = pointPage();
      const curseur = curseurGommeRef.current;
      if (p && curseur) {
        const abs = groupePageRef.current!.getAbsoluteTransform().point(p);
        curseur.setAttrs({ visible: true, x: abs.x, y: abs.y, radius: (etatDessin.epaisseur / 2) * cadrage.current.echelle });
        curseur.getLayer()?.batchDraw();
      }
      if (p && gomme.current) gommer(p.x, p.y);
      return;
    }
    const t = trait.current;
    if (t) {
      const p = pointPage();
      if (!p) return;
      const n = t.points.length;
      // Un point de plus seulement si le pointeur a vraiment bougé (un demi-pixel d'écran).
      if (Math.hypot(p.x - t.points[n - 2], p.y - t.points[n - 1]) * cadrage.current.echelle < 0.5) return;
      t.points.push(p.x, p.y);
      t.ligne.points(t.points.length === 2 ? [...t.points, t.points[0] + 0.01, t.points[1]] : t.points);
      calqueGesteRef.current?.batchDraw();
      return;
    }
    const pano = panoramique.current;
    if (pano) {
      const etat = useEditeur.getState();
      const el = elementsCourants(etat).find((x) => x.id === pano.id);
      const p = stageRef.current!.getPointerPosition();
      const photo = el && recoitPhoto(el) && el.ressource ? etat.ressources[el.ressource] : undefined;
      if (!el || !recoitPhoto(el) || !p || !photo) return;
      const pp = groupePageRef.current!.getAbsoluteTransform().copy().invert().point(p);
      // Le déplacement dans le repère de l'élément, qui peut être tourné.
      const a = (-el.rotation * Math.PI) / 180;
      const dx = pp.x - pano.x0;
      const dy = pp.y - pano.y0;
      const lx = dx * Math.cos(a) - dy * Math.sin(a);
      const ly = dx * Math.sin(a) + dy * Math.cos(a);
      const zone = el.type === "maquette" ? ecranAppareil(el.appareil, el.largeur, el.hauteur) : { largeur: el.largeur, hauteur: el.hauteur };
      const recadrage = deplacerRecadrage(photo.largeur, photo.hauteur, zone.largeur, zone.hauteur, pano.recadrage, lx, ly);
      etat.modifierElements({ [el.id]: { recadrage } as Partial<ElementPage> }, `ajuster:${el.id}`);
      return;
    }
    const v = vue.current;
    if (v) {
      setVoulue({ x: v.ox + e.evt.clientX - v.x0, y: v.oy + e.evt.clientY - v.y0 });
      return;
    }
    const debut = rectangleSelection.current;
    const rect = rectangleRef.current;
    if (!debut || !rect) return;
    const p = stageRef.current!.getPointerPosition()!;
    rect.setAttrs({ x: Math.min(debut.x0, p.x), y: Math.min(debut.y0, p.y), width: Math.abs(p.x - debut.x0), height: Math.abs(p.y - debut.y0) });
    rect.getLayer()?.batchDraw();
  };

  const surDoubleClic = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const g = groupeElement(e.target);
    if (!g) return;
    const etat = useEditeur.getState();
    if (etat.dessin) return;
    const el = elementsCourants(etat).find((x) => x.id === g.id());
    // Double-clic sur un tableau : on écrit dans la cellule visée.
    if (el?.type === "tableau") {
      const p = stageRef.current!.getPointerPosition();
      if (!p) return;
      const local = g.getAbsoluteTransform().copy().invert().point(p);
      const c = celluleSous(disposerTableau(el, mesurePolice(el.police)), local.x, local.y);
      if (c) etat.commencerCellule(el.id, c.ligne, c.colonne);
      return;
    }
    // Double-clic sur un cadre rempli : on ajuste la photo ; sur un texte : on l'écrit.
    if (el && recoitPhoto(el) && el.ressource) etat.commencerAjustement(el.id);
    else etat.commencerEdition(g.id());
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
    <div
      ref={conteneur}
      data-zone-de-travail
      className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[#e9e7e2]"
      onContextMenu={(e) => e.preventDefault()}
      // Hors de Tauri (navigateur), le dépôt de fichiers passe par les événements HTML.
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDepotFichiers(true);
        }
      }}
      onDragLeave={() => setDepotFichiers(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setDepotFichiers(false);
        void deposerFichiers(Array.from(e.dataTransfer.files), e.clientX, e.clientY);
      }}
    >
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
          <Rect x={ox} y={oy} width={format.largeur * echelle} height={format.hauteur * echelle} fill="#ffffff" shadowColor="#000000" shadowBlur={18} shadowOpacity={0.14} shadowOffsetY={4} />
        </Layer>
        <Layer ref={calquePageRef}>
          <Group ref={groupePageRef} {...transformationPage} clipX={0} clipY={0} clipWidth={format.largeur} clipHeight={format.hauteur}>
            <Rect name="fond-page" width={format.largeur} height={format.hauteur} {...remplissageKonva(fond, format.largeur, format.hauteur)} />
            {elements.map((el) => (
              <RenduElement
                key={el.id}
                el={el}
                enEdition={el.id === enEdition}
                enAjustement={el.id === enAjustement}
                fige={!!dessin}
                celluleMasquee={celluleEnEdition?.id === el.id ? celluleEnEdition : null}
                transEntree={transitions.get(el.id)?.entree}
                transSortie={transitions.get(el.id)?.sortie}
              />
            ))}
          </Group>
        </Layer>
        <Layer ref={calqueGesteRef}>
          <Group ref={groupeGesteRef} {...transformationPage} clipX={0} clipY={0} clipWidth={format.largeur} clipHeight={format.hauteur} />
          <Group ref={reperesRef} {...transformationPage} listening={false} />
        </Layer>
        <Layer ref={calqueInterfaceRef}>
          <Rect ref={survolRef} visible={false} stroke={ACCENT} strokeWidth={1.5} listening={false} />
          <Transformer
            ref={transformerRef}
            enabledAnchors={poignees}
            rotateEnabled={!verrou}
            keepRatio={enCles || (seul?.type !== "forme" && seul?.type !== "cadre" && seul?.type !== "graphique" && seul?.type !== "tableau")}
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
          <Circle ref={curseurGommeRef} visible={false} stroke="#1f1f1d" strokeWidth={1} fill="rgba(255,255,255,0.35)" dash={[3, 3]} listening={false} />
        </Layer>
      </Stage>
      <EditeurTexte />
      <EditeurCellule />
      <MiniBarre taille={taille} ouvrirMenu={(x, y) => setMenu({ x, y })} />
      {menu && <MenuContextuel x={menu.x} y={menu.y} fermer={() => setMenu(null)} />}
      <div ref={etiquetteRef} className="pointer-events-none absolute hidden rounded-md bg-neutral-900/90 px-2 py-0.5 text-xs font-medium text-white tabular-nums" />
      {enAjustement && (
        <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-neutral-900/90 px-3 py-1 text-xs text-white">
          Glisse la photo dans son cadre, molette pour l'agrandir. Échap ou un clic ailleurs pour finir.
        </div>
      )}
      {dessin && (
        <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-neutral-900/90 px-3 py-1 text-xs text-white">
          {dessin.outil === "gomme" ? "Passe la gomme sur un trait pour l'effacer." : "Dessine à la souris ou au stylet."} Échap pour sélectionner.
        </div>
      )}
      {styleCopie && (
        <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-neutral-900/90 px-3 py-1 text-xs text-white">
          Clique sur un objet pour lui donner ce style. Échap pour annuler.
        </div>
      )}
      {depotFichiers && (
        <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent-500 bg-accent-50/60 text-sm font-medium text-accent-700">
          Lâche tes images ici
        </div>
      )}
    </div>
  );
}
