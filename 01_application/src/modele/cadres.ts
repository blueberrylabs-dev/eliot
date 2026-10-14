// Géométrie des cadres photo, des grilles et des maquettes d'appareils (étape 3). Fonctions
// pures, testées (`cadres.test.ts`) ; le dessin Konva est dans `editeur/RenduElement.tsx`.

import { recoitPhoto, type Appareil, type ElementAPhoto, type ElementPage, type FormeCadre, type Recadrage } from "./types";

/** Ce dont un tracé a besoin : le contexte du canvas, ou celui de Konva. */
export interface Traceur {
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(a: number, b: number, c: number, d: number, e: number, f: number): void;
  arc(x: number, y: number, r: number, debut: number, fin: number, sens?: boolean): void;
  ellipse(x: number, y: number, rx: number, ry: number, rotation: number, debut: number, fin: number): void;
  closePath(): void;
}

/** Rectangle aux coins arrondis, tracé dans le chemin courant. */
export function tracerRectangleArrondi(c: Traceur, x: number, y: number, l: number, h: number, r: number): void {
  const rayon = Math.max(0, Math.min(r, l / 2, h / 2));
  c.moveTo(x + rayon, y);
  c.lineTo(x + l - rayon, y);
  c.arc(x + l - rayon, y + rayon, rayon, -Math.PI / 2, 0);
  c.lineTo(x + l, y + h - rayon);
  c.arc(x + l - rayon, y + h - rayon, rayon, 0, Math.PI / 2);
  c.lineTo(x + rayon, y + h);
  c.arc(x + rayon, y + h - rayon, rayon, Math.PI / 2, Math.PI);
  c.lineTo(x, y + rayon);
  c.arc(x + rayon, y + rayon, rayon, Math.PI, (3 * Math.PI) / 2);
  c.closePath();
}

function tracerPolygone(c: Traceur, points: number[]): void {
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath();
}

/** Le contour d'un cadre, dans sa boîte [0, l] x [0, h]. */
export function tracerCadre(c: Traceur, forme: FormeCadre, l: number, h: number): void {
  c.beginPath();
  switch (forme) {
    case "rectangle":
      tracerRectangleArrondi(c, 0, 0, l, h, 0);
      break;
    case "arrondi":
      tracerRectangleArrondi(c, 0, 0, l, h, Math.min(l, h) * 0.12);
      break;
    case "cercle":
      c.ellipse(l / 2, h / 2, l / 2, h / 2, 0, 0, Math.PI * 2);
      c.closePath();
      break;
    case "arche": {
      // Une fenêtre en plein cintre : demi-ellipse en haut, côtés droits.
      const r = l / 2;
      const haut = Math.min(r, h / 2);
      c.moveTo(0, h);
      c.lineTo(0, haut);
      c.ellipse(r, haut, r, haut, 0, Math.PI, 2 * Math.PI);
      c.lineTo(l, h);
      c.closePath();
      break;
    }
    case "etoile": {
      const points: number[] = [];
      for (let i = 0; i < 10; i++) {
        const rayon = i % 2 === 0 ? 0.5 : 0.25;
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        points.push((0.5 + rayon * Math.cos(angle)) * l, (0.5 + rayon * Math.sin(angle)) * h);
      }
      tracerPolygone(c, points);
      break;
    }
    case "hexagone": {
      const points: number[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 3;
        points.push((0.5 + 0.5 * Math.cos(angle)) * l, (0.5 + 0.5 * Math.sin(angle)) * h);
      }
      tracerPolygone(c, points);
      break;
    }
    case "coeur":
      c.moveTo(l / 2, h * 0.3);
      c.bezierCurveTo(l * 0.5, h * 0.05, l * 0.02, h * 0.02, l * 0.02, h * 0.34);
      c.bezierCurveTo(l * 0.02, h * 0.6, l * 0.32, h * 0.78, l / 2, h * 0.98);
      c.bezierCurveTo(l * 0.68, h * 0.78, l * 0.98, h * 0.6, l * 0.98, h * 0.34);
      c.bezierCurveTo(l * 0.98, h * 0.02, l * 0.5, h * 0.05, l / 2, h * 0.3);
      c.closePath();
      break;
    case "goutte":
      // Une forme organique, douce, comme une tache de peinture.
      c.moveTo(l * 0.52, 0);
      c.bezierCurveTo(l * 0.82, 0, l, h * 0.18, l, h * 0.46);
      c.bezierCurveTo(l, h * 0.78, l * 0.78, h, l * 0.48, h);
      c.bezierCurveTo(l * 0.18, h, 0, h * 0.8, 0, h * 0.52);
      c.bezierCurveTo(0, h * 0.2, l * 0.22, 0, l * 0.52, 0);
      c.closePath();
      break;
  }
}

export const RECADRAGE_PAR_DEFAUT: Recadrage = { zoom: 1, x: 0.5, y: 0.5 };

/** Où poser une photo de `il` × `ih` pour qu'elle couvre une zone de `l` × `h`. */
export function placerPhoto(il: number, ih: number, l: number, h: number, r: Recadrage = RECADRAGE_PAR_DEFAUT) {
  const echelle = Math.max(l / il, h / ih) * Math.max(1, r.zoom);
  const largeur = il * echelle;
  const hauteur = ih * echelle;
  const borne = (v: number) => Math.max(0, Math.min(1, v));
  // « + 0 » : jamais de zéro négatif dans le document.
  return { x: (l - largeur) * borne(r.x) + 0, y: (h - hauteur) * borne(r.y) + 0, largeur, hauteur };
}

/** Déplace le cadrage de `dx`, `dy` pixels de la page (glisser la photo dans son cadre). */
export function deplacerRecadrage(il: number, ih: number, l: number, h: number, r: Recadrage, dx: number, dy: number): Recadrage {
  const p = placerPhoto(il, ih, l, h, r);
  const debordX = p.largeur - l;
  const debordY = p.hauteur - h;
  const borne = (v: number) => Math.max(0, Math.min(1, v));
  return { zoom: r.zoom, x: debordX > 0.5 ? borne(r.x - dx / debordX) : 0.5, y: debordY > 0.5 ? borne(r.y - dy / debordY) : 0.5 };
}

// ---- Grilles photo ----

export interface Disposition {
  id: string;
  libelle: string;
  /** Les cases, en fractions de la page : [x, y, largeur, hauteur]. */
  cases: [number, number, number, number][];
}

export const DISPOSITIONS: Disposition[] = [
  { id: "deux-colonnes", libelle: "Deux colonnes", cases: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] },
  { id: "deux-lignes", libelle: "Deux lignes", cases: [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]] },
  { id: "trois-colonnes", libelle: "Trois colonnes", cases: [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]] },
  { id: "trois-lignes", libelle: "Trois lignes", cases: [[0, 0, 1, 1 / 3], [0, 1 / 3, 1, 1 / 3], [0, 2 / 3, 1, 1 / 3]] },
  { id: "une-et-deux", libelle: "Une grande, deux petites", cases: [[0, 0, 0.6, 1], [0.6, 0, 0.4, 0.5], [0.6, 0.5, 0.4, 0.5]] },
  { id: "deux-et-une", libelle: "Deux en haut, une en bas", cases: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 1, 0.5]] },
  { id: "quatre", libelle: "Quatre", cases: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
  { id: "une-et-trois", libelle: "Une grande, trois petites", cases: [[0, 0, 1, 0.62], [0, 0.62, 1 / 3, 0.38], [1 / 3, 0.62, 1 / 3, 0.38], [2 / 3, 0.62, 1 / 3, 0.38]] },
  {
    id: "neuf",
    libelle: "Neuf",
    cases: [0, 1, 2].flatMap((l) => [0, 1, 2].map((c) => [c / 3, l / 3, 1 / 3, 1 / 3] as [number, number, number, number])),
  },
];

/** Les cases d'une grille posée dans une zone, avec un écart entre elles (en pixels). */
export function casesDeGrille(d: Disposition, zone: { x: number; y: number; largeur: number; hauteur: number }, ecart: number) {
  return d.cases.map(([cx, cy, cl, ch]) => {
    // L'écart se partage : rien au bord de la zone, un écart entier entre deux cases.
    const gauche = cx > 0.001 ? ecart / 2 : 0;
    const droite = cx + cl < 0.999 ? ecart / 2 : 0;
    const haut = cy > 0.001 ? ecart / 2 : 0;
    const bas = cy + ch < 0.999 ? ecart / 2 : 0;
    // On arrondit les bords, pas les tailles : deux cases voisines gardent un écart exact et
    // la dernière tombe pile sur le bord de la page.
    const x0 = Math.round(zone.x + cx * zone.largeur + gauche);
    const x1 = Math.round(zone.x + (cx + cl) * zone.largeur - droite);
    const y0 = Math.round(zone.y + cy * zone.hauteur + haut);
    const y1 = Math.round(zone.y + (cy + ch) * zone.hauteur - bas);
    return { x: x0, y: y0, largeur: x1 - x0, hauteur: y1 - y0 };
  });
}

// ---- Maquettes d'appareils ----

export interface GeometrieAppareil {
  libelle: string;
  /** Largeur sur hauteur de la boîte entière. */
  proportion: number;
  /** L'écran, en fractions de la boîte, et le rayon de ses coins en fraction de la largeur. */
  ecran: { x: number; y: number; largeur: number; hauteur: number; rayon: number };
}

export const APPAREILS: Record<Appareil, GeometrieAppareil> = {
  telephone: { libelle: "Téléphone", proportion: 0.49, ecran: { x: 0.04, y: 0.019, largeur: 0.92, hauteur: 0.962, rayon: 0.12 } },
  tablette: { libelle: "Tablette", proportion: 0.75, ecran: { x: 0.05, y: 0.0375, largeur: 0.9, hauteur: 0.925, rayon: 0.02 } },
  ordinateur: { libelle: "Ordinateur", proportion: 1.6, ecran: { x: 0.105, y: 0.04, largeur: 0.79, hauteur: 0.78, rayon: 0.004 } },
  montre: { libelle: "Montre", proportion: 0.86, ecran: { x: 0.075, y: 0.075, largeur: 0.77, hauteur: 0.85, rayon: 0.2 } },
};

/** L'écran d'un appareil dans une boîte de `l` × `h`, en pixels. */
export function ecranAppareil(appareil: Appareil, l: number, h: number) {
  const e = APPAREILS[appareil].ecran;
  return { x: e.x * l, y: e.y * h, largeur: e.largeur * l, hauteur: e.hauteur * h, rayon: e.rayon * l };
}

export const COULEURS_APPAREIL: { couleur: string; nom: string }[] = [
  { couleur: "#1c1c1e", nom: "Noir" },
  { couleur: "#f2f2f4", nom: "Blanc" },
  { couleur: "#c9c9ce", nom: "Argent" },
  { couleur: "#e3cba8", nom: "Or" },
  { couleur: "#3b4a6b", nom: "Bleu nuit" },
  { couleur: "#f3c4cf", nom: "Rose" },
];

/** Le cadre ou la maquette le plus haut sous un point de la page (rotation comprise), pour y
 *  déposer une photo. */
export function elementAPhotoSous(elements: ElementPage[], point: { x: number; y: number }): ElementAPhoto | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const e = elements[i];
    if (!recoitPhoto(e) || !e.visible || e.verrouille) continue;
    // Le point dans le repère de l'élément (sa rotation se fait autour du coin haut gauche).
    const a = (-e.rotation * Math.PI) / 180;
    const dx = point.x - e.x;
    const dy = point.y - e.y;
    const lx = dx * Math.cos(a) - dy * Math.sin(a);
    const ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (lx >= 0 && ly >= 0 && lx <= e.largeur && ly <= e.hauteur) return e;
  }
  return null;
}

/** Le tracé d'un cadre en chemin SVG (`d`), pour les aperçus des panneaux. */
export function cheminSvg(forme: FormeCadre, l: number, h: number): string {
  const morceaux: string[] = [];
  let courant: [number, number] | null = null;
  const n = (v: number) => Math.round(v * 100) / 100;
  const versPoint = (x: number, y: number) => {
    morceaux.push(courant ? `L${n(x)} ${n(y)}` : `M${n(x)} ${n(y)}`);
    courant = [x, y];
  };
  const arcElliptique = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number) => {
    versPoint(cx + rx * Math.cos(a0), cy + ry * Math.sin(a0));
    // Par tranches d'un quart de tour au plus : un arc SVG ne sait pas faire un cercle entier.
    const pas = Math.ceil(Math.abs(a1 - a0) / (Math.PI / 2));
    for (let i = 1; i <= pas; i++) {
      const a = a0 + ((a1 - a0) * i) / pas;
      const x = cx + rx * Math.cos(a);
      const y = cy + ry * Math.sin(a);
      morceaux.push(`A${n(rx)} ${n(ry)} 0 0 1 ${n(x)} ${n(y)}`);
      courant = [x, y];
    }
  };
  const traceur: Traceur = {
    beginPath: () => {
      courant = null;
    },
    moveTo: (x, y) => {
      morceaux.push(`M${n(x)} ${n(y)}`);
      courant = [x, y];
    },
    lineTo: (x, y) => versPoint(x, y),
    bezierCurveTo: (a, b, c, d, e, f) => {
      morceaux.push(`C${n(a)} ${n(b)} ${n(c)} ${n(d)} ${n(e)} ${n(f)}`);
      courant = [e, f];
    },
    arc: (x, y, r, debut, fin) => arcElliptique(x, y, r, r, debut, fin),
    ellipse: (x, y, rx, ry, _rotation, debut, fin) => arcElliptique(x, y, rx, ry, debut, fin),
    closePath: () => {
      morceaux.push("Z");
      courant = null;
    },
  };
  tracerCadre(traceur, forme, l, h);
  return morceaux.join(" ");
}
