// La scène de test : une page 1080 x 1080 chargée comme un visuel publicitaire dense,
// montée exactement comme le prévoit le BRIEF (trois calques, page mise à l'échelle et découpée,
// un seul Transformer pour les poignées).

import Konva from "konva";

export const PAGE = 1080;
const MARGE = 48;

export interface Scene {
  stage: Konva.Stage;
  calqueFond: Konva.Layer;
  calquePage: Konva.Layer;
  calqueInterface: Konva.Layer;
  groupePage: Konva.Group;
  ombrePage: Konva.Rect;
  objets: Konva.Shape[];
  transformer: Konva.Transformer;
  echelle: () => number;
  redimensionner: () => void;
}

/** Générateur pseudo-aléatoire à graine fixe : la même page à chaque lancement. */
function generateur(graine: number): () => number {
  let etat = graine >>> 0;
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COULEURS = ["#534ab7", "#1d9e75", "#d85a30", "#d4537e", "#378add", "#ef9f27", "#26215c", "#97c459"];
const TEXTES = [
  "Nouveau",
  "Promo -20 %",
  "Commander",
  "Livraison offerte",
  "Jusqu'à dimanche",
  "Édition limitée",
  "Découvrez la gamme printemps",
  "Fabriqué en France",
];
export const POLICE = "Inter, Ubuntu, 'Noto Sans', system-ui, sans-serif";

export function creerScene(conteneur: HTMLDivElement): Scene {
  const stage = new Konva.Stage({
    container: conteneur,
    width: conteneur.clientWidth,
    height: conteneur.clientHeight,
  });

  const calqueFond = new Konva.Layer({ listening: false });
  const calquePage = new Konva.Layer();
  const calqueInterface = new Konva.Layer();
  stage.add(calqueFond, calquePage, calqueInterface);

  const ombrePage = new Konva.Rect({
    width: PAGE,
    height: PAGE,
    fill: "#ffffff",
    shadowColor: "#000000",
    shadowBlur: 24,
    shadowOpacity: 0.18,
    shadowOffsetY: 6,
  });
  calqueFond.add(ombrePage);

  const groupePage = new Konva.Group({ clipX: 0, clipY: 0, clipWidth: PAGE, clipHeight: PAGE });
  groupePage.add(new Konva.Rect({ width: PAGE, height: PAGE, fill: "#fff7ec", listening: false }));
  calquePage.add(groupePage);

  const hasard = generateur(20261014);
  const objets: Konva.Shape[] = [];
  for (let i = 0; i < 200; i++) {
    const couleur = COULEURS[Math.floor(hasard() * COULEURS.length)];
    const x = 40 + hasard() * (PAGE - 240);
    const y = 40 + hasard() * (PAGE - 160);
    const rotation = hasard() < 0.5 ? (hasard() - 0.5) * 60 : 0;
    const famille = i % 10;
    let forme: Konva.Shape;
    if (famille < 4) {
      forme = new Konva.Rect({
        x,
        y,
        rotation,
        width: 40 + hasard() * 180,
        height: 30 + hasard() * 140,
        cornerRadius: hasard() < 0.5 ? 16 : 0,
        fill: couleur,
      });
    } else if (famille < 7) {
      const rayonX = 20 + hasard() * 80;
      const rayonY = rayonX * (0.6 + hasard() * 0.8);
      // Ellipse posée dans sa boîte (origine en haut à gauche), comme le prévoit le modèle
      // de document.
      forme = new Konva.Ellipse({
        x,
        y,
        rotation,
        radiusX: rayonX,
        radiusY: rayonY,
        offsetX: -rayonX,
        offsetY: -rayonY,
        fill: couleur,
      });
    } else {
      forme = new Konva.Text({
        x,
        y,
        rotation,
        text: TEXTES[Math.floor(hasard() * TEXTES.length)],
        fontSize: 18 + Math.floor(hasard() * 54),
        fontFamily: POLICE,
        fontStyle: hasard() < 0.5 ? "bold" : "normal",
        width: hasard() < 0.4 ? 220 : undefined,
        fill: couleur,
      });
    }
    // Un objet sur dix porte une ombre portée, comme un produit posé sur une pub.
    if (i % 10 === 3) {
      forme.setAttrs({ shadowColor: "#000", shadowBlur: 14, shadowOpacity: 0.3, shadowOffsetX: 4, shadowOffsetY: 8 });
    }
    forme.setAttrs({ draggable: true, name: "objet", id: `objet-${i}` });
    forme.perfectDrawEnabled(false);
    forme.shadowForStrokeEnabled(false);
    groupePage.add(forme);
    objets.push(forme);
  }

  const transformer = new Konva.Transformer({
    rotateEnabled: true,
    rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
    anchorSize: 10,
    anchorCornerRadius: 5,
    anchorStroke: "#534ab7",
    borderStroke: "#534ab7",
    anchorFill: "#ffffff",
    rotateAnchorOffset: 30,
  });
  calqueInterface.add(transformer);

  let echelleCourante = 1;
  const redimensionner = () => {
    const largeur = conteneur.clientWidth;
    const hauteur = conteneur.clientHeight;
    stage.size({ width: largeur, height: hauteur });
    echelleCourante = Math.max(0.05, Math.min((largeur - 2 * MARGE) / PAGE, (hauteur - 2 * MARGE) / PAGE));
    const x = (largeur - PAGE * echelleCourante) / 2;
    const y = (hauteur - PAGE * echelleCourante) / 2;
    for (const noeud of [groupePage, ombrePage]) {
      noeud.position({ x, y });
      noeud.scale({ x: echelleCourante, y: echelleCourante });
    }
    stage.batchDraw();
  };
  redimensionner();
  new ResizeObserver(redimensionner).observe(conteneur);

  return {
    stage,
    calqueFond,
    calquePage,
    calqueInterface,
    groupePage,
    ombrePage,
    objets,
    transformer,
    echelle: () => echelleCourante,
    redimensionner,
  };
}

/** Mode libre : sélection au clic, Maj+clic pour ajouter, clic dans le vide pour tout lâcher. */
export function activerSelection(scene: Scene): void {
  scene.stage.on("mousedown.selection touchstart.selection", (evenement) => {
    const cible = evenement.target;
    if (cible === scene.stage || !cible.hasName("objet")) {
      if (!(evenement.target.getParent() instanceof Konva.Transformer)) {
        scene.transformer.nodes([]);
      }
      return;
    }
    const ajout = (evenement.evt as MouseEvent).shiftKey;
    const actuels = scene.transformer.nodes();
    if (ajout) {
      scene.transformer.nodes(
        actuels.includes(cible) ? actuels.filter((n) => n !== cible) : [...actuels, cible],
      );
    } else if (!actuels.includes(cible)) {
      scene.transformer.nodes([cible]);
    }
  });
}
