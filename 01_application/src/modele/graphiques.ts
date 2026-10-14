// Graphiques : les données vivent dans le document, le dessin se recalcule à chaque rendu.
// `disposerGraphique` ne dessine rien : il rend une liste de formes simples (rectangles,
// lignes, arcs, textes) que la zone de travail et l'export traduisent en Konva. Tout se teste
// sans écran.

import type { ElementGraphique, GenreGraphique, SerieGraphique } from "./types";

/** Couleurs proposées dans l'ordre aux séries et aux parts. */
export const PALETTE_GRAPHIQUE = ["#4f46e5", "#f59e0b", "#10b981", "#ef4444", "#06b6d4", "#8b5cf6", "#ec4899", "#84cc16", "#64748b", "#0ea5e9"];

export const GENRES_GRAPHIQUE: { id: GenreGraphique; libelle: string; mots: string }[] = [
  { id: "colonnes", libelle: "Colonnes", mots: "graphique colonnes barres verticales histogramme comparer" },
  { id: "barres", libelle: "Barres", mots: "graphique barres horizontales classement" },
  { id: "lignes", libelle: "Courbe", mots: "graphique courbe lignes evolution tendance" },
  { id: "aires", libelle: "Aires", mots: "graphique aires surface evolution" },
  { id: "secteurs", libelle: "Camembert", mots: "graphique camembert secteurs parts repartition" },
  { id: "anneau", libelle: "Anneau", mots: "graphique anneau donut parts repartition" },
  { id: "progression", libelle: "Progression", mots: "graphique progression pourcentage jauge objectif" },
];

/** Les graphiques à axes (catégories en abscisse ou en ordonnée). */
export const aAxes = (genre: GenreGraphique) => genre === "colonnes" || genre === "barres" || genre === "lignes" || genre === "aires";

export type Primitive =
  | { k: "rect"; x: number; y: number; l: number; h: number; couleur: string; arrondi?: [number, number, number, number]; ombre?: boolean }
  | { k: "ligne"; points: number[]; couleur: string; epaisseur: number; opacite?: number }
  | { k: "aire"; points: number[]; couleur: string; opacite: number }
  | { k: "point"; x: number; y: number; r: number; couleur: string }
  | { k: "arc"; cx: number; cy: number; interieur: number; exterieur: number; debut: number; angle: number; couleur: string; ombre?: boolean; arrondi?: boolean }
  | { k: "texte"; x: number; y: number; texte: string; taille: number; couleur: string; aligner: "left" | "center" | "right"; base: "top" | "middle" | "bottom"; gras?: boolean };

/** Largeur d'un texte à une taille donnée (fournie par l'appelant : canevas, ou estimation). */
export type Mesure = (texte: string, taille: number, gras?: boolean) => number;

/** Estimation sans canevas, pour les tests et les calculs sans écran. */
export const mesureEstimee: Mesure = (texte, taille, gras) => texte.length * taille * (gras ? 0.6 : 0.55);

/** Graduations « rondes » qui couvrent [min, max] : 0, 25, 50, 75, 100… */
export function graduations(min: number, max: number, voulues = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) max = min === 0 ? 1 : min > 0 ? min * 1.2 : 0;
  const brut = (max - min) / Math.max(1, voulues - 1);
  const puissance = Math.pow(10, Math.floor(Math.log10(brut)));
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * puissance).find((p) => p >= brut) ?? 10 * puissance;
  const debut = Math.floor(min / pas) * pas;
  const fin = Math.ceil(max / pas) * pas;
  const sortie: number[] = [];
  for (let v = debut; v <= fin + pas / 1e6; v += pas) sortie.push(Math.round(v * 1e6) / 1e6);
  return sortie;
}

/** Une valeur écrite à la française : espace des milliers, virgule décimale, unité. */
export function ecrireValeur(v: number, unite = ""): string {
  const arrondie = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  const texte = arrondie.toLocaleString("fr-FR", { maximumFractionDigits: 1 }).replace(/ /g, " ");
  if (!unite) return texte;
  return unite === "%" || unite === "€" ? `${texte} ${unite}` : `${texte}${unite.startsWith(" ") ? unite : ` ${unite}`}`;
}

const couleurPart = (el: ElementGraphique, i: number) => el.couleursParts?.[i] ?? PALETTE_GRAPHIQUE[i % PALETTE_GRAPHIQUE.length];

/** Les éléments de la légende : séries, ou parts pour un camembert et un anneau. */
function entreesLegende(el: ElementGraphique): { nom: string; couleur: string }[] {
  if (el.genre === "secteurs" || el.genre === "anneau") return el.etiquettes.map((nom, i) => ({ nom, couleur: couleurPart(el, i) }));
  if (el.genre === "progression") return [];
  return el.series.map((s) => ({ nom: s.nom, couleur: s.couleur }));
}

/** La légende, en lignes centrées sous le titre, et la hauteur qu'elle prend. */
function legende(el: ElementGraphique, mesurer: Mesure, l: number): { formes: Primitive[]; hauteur: number } {
  const entrees = entreesLegende(el);
  if (!el.legende || entrees.length === 0 || (entrees.length === 1 && aAxes(el.genre))) return { formes: [], hauteur: 0 };
  const t = el.taillePolice;
  const carre = t * 0.8;
  const ecart = t * 1.1;
  const largeurs = entrees.map((e) => carre + t * 0.4 + mesurer(e.nom, t));
  // Répartition en lignes qui tiennent dans la largeur.
  const lignes: number[][] = [[]];
  let courante = 0;
  largeurs.forEach((w, i) => {
    if (lignes[lignes.length - 1].length && courante + ecart + w > l) {
      lignes.push([]);
      courante = 0;
    }
    courante += (lignes[lignes.length - 1].length ? ecart : 0) + w;
    lignes[lignes.length - 1].push(i);
  });
  const hLigne = t * 1.5;
  const formes: Primitive[] = [];
  lignes.forEach((indices, rang) => {
    const total = indices.reduce((s, i, n) => s + largeurs[i] + (n ? ecart : 0), 0);
    let x = (l - total) / 2;
    const y = rang * hLigne + hLigne / 2;
    for (const i of indices) {
      formes.push({ k: "rect", x, y: y - carre / 2, l: carre, h: carre, couleur: entrees[i].couleur, arrondi: [carre / 4, carre / 4, carre / 4, carre / 4] });
      formes.push({ k: "texte", x: x + carre + t * 0.4, y, texte: entrees[i].nom, taille: t, couleur: el.couleurTexte, aligner: "left", base: "middle" });
      x += largeurs[i] + ecart;
    }
  });
  return { formes, hauteur: lignes.length * hLigne + t * 0.6 };
}

function axes(el: ElementGraphique, mesurer: Mesure, zone: { x: number; y: number; l: number; h: number }): Primitive[] {
  const formes: Primitive[] = [];
  const t = el.taillePolice;
  const series = el.series;
  const n = el.etiquettes.length;
  const toutes = series.flatMap((s) => s.valeurs.slice(0, n).filter((v): v is number => typeof v === "number" && Number.isFinite(v)));
  const grad = graduations(Math.min(0, ...toutes), Math.max(0, ...toutes));
  const vmin = grad[0];
  const vmax = grad[grad.length - 1];
  const horizontal = el.genre === "barres";
  const grille = el.couleurTexte;
  const textesGrad = grad.map((g) => ecrireValeur(g, el.unite));

  if (!horizontal) {
    // Axe des valeurs à gauche, catégories en bas.
    const largeurGrad = Math.max(...textesGrad.map((g) => mesurer(g, t * 0.85))) + t * 0.6;
    const bas = zone.y + zone.h - t * 1.6;
    const haut = zone.y + (el.valeurs ? t * 1.3 : t * 0.5);
    const gauche = zone.x + largeurGrad;
    const droite = zone.x + zone.l;
    const yDe = (v: number) => bas - ((v - vmin) / (vmax - vmin)) * (bas - haut);
    grad.forEach((g, i) => {
      const y = yDe(g);
      if (el.grille || g === 0) formes.push({ k: "ligne", points: [gauche, y, droite, y], couleur: grille, epaisseur: g === 0 ? 1.5 : 1, opacite: g === 0 ? 0.45 : 0.15 });
      formes.push({ k: "texte", x: gauche - t * 0.5, y, texte: textesGrad[i], taille: t * 0.85, couleur: el.couleurTexte, aligner: "right", base: "middle" });
    });
    const pas = (droite - gauche) / Math.max(1, n);
    el.etiquettes.forEach((e, i) => formes.push({ k: "texte", x: gauche + pas * (i + 0.5), y: bas + t * 0.5, texte: e, taille: t * 0.9, couleur: el.couleurTexte, aligner: "center", base: "top" }));
    const zero = yDe(Math.max(vmin, Math.min(0, vmax)));

    if (el.genre === "colonnes") {
      const groupe = pas * 0.72;
      const l = groupe / Math.max(1, series.length);
      series.forEach((s, si) => {
        for (let i = 0; i < n; i++) {
          const v = s.valeurs[i];
          if (typeof v !== "number" || !Number.isFinite(v)) continue;
          const x = gauche + pas * i + (pas - groupe) / 2 + l * si + l * 0.06;
          const y = yDe(v);
          const r = Math.min(l * 0.18, 10);
          formes.push({ k: "rect", x, y: Math.min(y, zero), l: l * 0.88, h: Math.max(0.5, Math.abs(zero - y)), couleur: s.couleur, arrondi: v >= 0 ? [r, r, 0, 0] : [0, 0, r, r], ombre: true });
          if (el.valeurs) formes.push({ k: "texte", x: x + l * 0.44, y: v >= 0 ? y - t * 0.3 : y + t * 0.3, texte: ecrireValeur(v, el.unite), taille: t * 0.85, couleur: el.couleurTexte, aligner: "center", base: v >= 0 ? "bottom" : "top", gras: true });
        }
      });
    } else {
      // Courbe ou aires : un point par catégorie, au milieu de sa case.
      series.forEach((s) => {
        const pts: number[] = [];
        for (let i = 0; i < n; i++) {
          const v = s.valeurs[i];
          if (typeof v === "number" && Number.isFinite(v)) pts.push(gauche + pas * (i + 0.5), yDe(v));
        }
        if (pts.length === 0) return;
        if (el.genre === "aires" && pts.length >= 4) formes.push({ k: "aire", points: [pts[0], zero, ...pts, pts[pts.length - 2], zero], couleur: s.couleur, opacite: series.length > 1 ? 0.35 : 0.5 });
        formes.push({ k: "ligne", points: pts, couleur: s.couleur, epaisseur: Math.max(2, t * 0.22) });
        for (let i = 0; i < pts.length; i += 2) {
          formes.push({ k: "point", x: pts[i], y: pts[i + 1], r: Math.max(3, t * 0.28), couleur: s.couleur });
        }
      });
      if (el.valeurs) {
        series.forEach((s) =>
          s.valeurs.slice(0, n).forEach((v, i) => {
            if (typeof v === "number" && Number.isFinite(v)) formes.push({ k: "texte", x: gauche + pas * (i + 0.5), y: yDe(v) - t * 0.55, texte: ecrireValeur(v, el.unite), taille: t * 0.8, couleur: el.couleurTexte, aligner: "center", base: "bottom", gras: true });
          }),
        );
      }
    }
    return formes;
  }

  // Barres horizontales : catégories à gauche, valeurs en bas.
  const largeurEtiquettes = Math.min(zone.l * 0.4, Math.max(0, ...el.etiquettes.map((e) => mesurer(e, t * 0.9))) + t * 0.6);
  const gauche = zone.x + largeurEtiquettes;
  const droite = zone.x + zone.l - (el.valeurs ? Math.max(...textesGrad.map((g) => mesurer(g, t * 0.85))) * 0.6 + t : t * 0.8);
  const haut = zone.y;
  const bas = zone.y + zone.h - t * 1.5;
  const xDe = (v: number) => gauche + ((v - vmin) / (vmax - vmin)) * (droite - gauche);
  grad.forEach((g, i) => {
    const x = xDe(g);
    if (el.grille || g === 0) formes.push({ k: "ligne", points: [x, haut, x, bas], couleur: grille, epaisseur: g === 0 ? 1.5 : 1, opacite: g === 0 ? 0.45 : 0.15 });
    formes.push({ k: "texte", x, y: bas + t * 0.45, texte: textesGrad[i], taille: t * 0.85, couleur: el.couleurTexte, aligner: "center", base: "top" });
  });
  const pas = (bas - haut) / Math.max(1, n);
  el.etiquettes.forEach((e, i) => formes.push({ k: "texte", x: gauche - t * 0.5, y: haut + pas * (i + 0.5), texte: e, taille: t * 0.9, couleur: el.couleurTexte, aligner: "right", base: "middle" }));
  const zero = xDe(Math.max(vmin, Math.min(0, vmax)));
  const groupe = pas * 0.72;
  const h = groupe / Math.max(1, series.length);
  series.forEach((s, si) => {
    for (let i = 0; i < n; i++) {
      const v = s.valeurs[i];
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      const y = haut + pas * i + (pas - groupe) / 2 + h * si + h * 0.06;
      const x = xDe(v);
      const r = Math.min(h * 0.18, 10);
      formes.push({ k: "rect", x: Math.min(x, zero), y, l: Math.max(0.5, Math.abs(x - zero)), h: h * 0.88, couleur: s.couleur, arrondi: v >= 0 ? [0, r, r, 0] : [r, 0, 0, r], ombre: true });
      if (el.valeurs) formes.push({ k: "texte", x: v >= 0 ? x + t * 0.35 : x - t * 0.35, y: y + h * 0.44, texte: ecrireValeur(v, el.unite), taille: t * 0.85, couleur: el.couleurTexte, aligner: v >= 0 ? "left" : "right", base: "middle", gras: true });
    }
  });
  return formes;
}

function parts(el: ElementGraphique, zone: { x: number; y: number; l: number; h: number }): Primitive[] {
  const formes: Primitive[] = [];
  const t = el.taillePolice;
  const valeurs = el.etiquettes.map((_, i) => Math.max(0, Number(el.series[0]?.valeurs[i]) || 0));
  const total = valeurs.reduce((a, b) => a + b, 0);
  const rayon = Math.max(1, Math.min(zone.l, zone.h) / 2);
  const cx = zone.x + zone.l / 2;
  const cy = zone.y + zone.h / 2;
  const interieur = el.genre === "anneau" ? rayon * 0.58 : 0;
  if (total <= 0) {
    formes.push({ k: "arc", cx, cy, interieur, exterieur: rayon, debut: -90, angle: 360, couleur: "#e5e7eb" });
    return formes;
  }
  let debut = -90;
  valeurs.forEach((v, i) => {
    if (v <= 0) return;
    const angle = (v / total) * 360;
    formes.push({ k: "arc", cx, cy, interieur, exterieur: rayon, debut, angle, couleur: couleurPart(el, i), ombre: true });
    if (el.valeurs && angle >= 14) {
      const milieu = ((debut + angle / 2) * Math.PI) / 180;
      const r = el.genre === "anneau" ? (interieur + rayon) / 2 : rayon * 0.62;
      const pourcent = el.unite ? ecrireValeur(v, el.unite) : `${Math.round((v / total) * 100)} %`;
      formes.push({ k: "texte", x: cx + Math.cos(milieu) * r, y: cy + Math.sin(milieu) * r, texte: pourcent, taille: t * 0.9, couleur: "#ffffff", aligner: "center", base: "middle", gras: true });
    }
    debut += angle;
  });
  return formes;
}

function progression(el: ElementGraphique, mesurer: Mesure, zone: { x: number; y: number; l: number; h: number }): Primitive[] {
  const maximum = el.maximum && el.maximum > 0 ? el.maximum : 100;
  const v = Number(el.series[0]?.valeurs[0]) || 0;
  const part = Math.max(0, Math.min(1, v / maximum));
  const rayon = Math.max(1, Math.min(zone.l, zone.h) / 2);
  const cx = zone.x + zone.l / 2;
  const cy = zone.y + zone.h / 2;
  const epaisseur = rayon * 0.2;
  const couleur = el.series[0]?.couleur ?? PALETTE_GRAPHIQUE[0];
  const formes: Primitive[] = [
    { k: "arc", cx, cy, interieur: rayon - epaisseur, exterieur: rayon, debut: -90, angle: 360, couleur: el.couleursParts?.[0] ?? "#e5e7eb" },
  ];
  if (part > 0) formes.push({ k: "arc", cx, cy, interieur: rayon - epaisseur, exterieur: rayon, debut: -90, angle: part * 360, couleur, arrondi: part < 1 });
  // Le chiffre au centre, aussi grand que l'anneau le permet.
  const texte = el.unite === undefined || el.unite === "%" ? `${Math.round(part * 100)} %` : ecrireValeur(v, el.unite);
  const place = (rayon - epaisseur) * 1.5;
  const taille = Math.max(8, Math.min(rayon * 0.5, (place / Math.max(1, mesurer(texte, 100, true))) * 100));
  formes.push({ k: "texte", x: cx, y: cy - (el.etiquettes[0] ? taille * 0.15 : 0), texte, taille, couleur: el.couleurTexte, aligner: "center", base: "middle", gras: true });
  if (el.etiquettes[0]) formes.push({ k: "texte", x: cx, y: cy + taille * 0.55, texte: el.etiquettes[0], taille: Math.min(el.taillePolice, taille * 0.38), couleur: el.couleurTexte, aligner: "center", base: "top" });
  return formes;
}

/** Tout ce qu'il faut dessiner, dans la boîte [0, largeur] x [0, hauteur] de l'élément. */
export function disposerGraphique(el: ElementGraphique, mesurer: Mesure = mesureEstimee): Primitive[] {
  const marge = el.taillePolice * 0.4;
  const l = el.largeur - 2 * marge;
  const leg = el.genre === "progression" ? { formes: [], hauteur: 0 } : legende(el, mesurer, l);
  const zone = { x: marge, y: marge + leg.hauteur, l, h: el.hauteur - 2 * marge - leg.hauteur };
  const decaler = leg.formes.map((f) => ("x" in f && "y" in f ? { ...f, x: f.x + marge, y: f.y + marge } : f)) as Primitive[];
  if (zone.h <= 4 || zone.l <= 4) return decaler;
  if (aAxes(el.genre)) return [...decaler, ...axes(el, mesurer, zone)];
  if (el.genre === "progression") return progression(el, mesurer, zone);
  return [...decaler, ...parts(el, zone)];
}

/** Des données de départ parlantes pour chaque genre. */
export function donneesDeDepart(genre: GenreGraphique, couleurs: string[] = PALETTE_GRAPHIQUE): Pick<ElementGraphique, "etiquettes" | "series" | "unite" | "maximum" | "couleursParts" | "legende" | "valeurs"> {
  const c = (i: number) => couleurs[i % couleurs.length];
  switch (genre) {
    case "colonnes":
    case "barres":
      return { etiquettes: ["Janv.", "Févr.", "Mars", "Avril"], series: [{ nom: "2025", couleur: c(0), valeurs: [42, 55, 61, 78] }, { nom: "2026", couleur: c(1), valeurs: [48, 63, 72, 95] }], legende: true, valeurs: false };
    case "lignes":
    case "aires":
      return { etiquettes: ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."], series: [{ nom: "Visites", couleur: c(0), valeurs: [120, 180, 150, 220, 260, 340, 300] }], legende: false, valeurs: false };
    case "secteurs":
    case "anneau":
      return { etiquettes: ["Instagram", "TikTok", "YouTube", "Autres"], series: [{ nom: "Part", couleur: c(0), valeurs: [42, 31, 18, 9] }], couleursParts: [c(0), c(1), c(2), c(3)], legende: true, valeurs: true, unite: undefined };
    case "progression":
      return { etiquettes: ["clients satisfaits"], series: [{ nom: "Valeur", couleur: c(0), valeurs: [93] }], maximum: 100, unite: "%", legende: false, valeurs: true };
  }
}

/** Remet d'aplomb des données reçues de l'extérieur (une IA, un collage) : chaque série a une
 *  valeur par étiquette, les nombres sont des nombres. */
export function seriesValides(etiquettes: string[], series: unknown, couleurs: string[] = PALETTE_GRAPHIQUE): SerieGraphique[] {
  const liste = Array.isArray(series) ? series : [];
  return liste.slice(0, 12).map((brut, i) => {
    const s = (brut ?? {}) as Partial<SerieGraphique>;
    const valeurs = etiquettes.map((_, j) => {
      const v: unknown = Array.isArray(s.valeurs) ? s.valeurs[j] : null;
      const n = typeof v === "string" ? Number(v.replace(",", ".").replace(/\s/g, "")) : v;
      return typeof n === "number" && Number.isFinite(n) ? n : null;
    });
    return { nom: typeof s.nom === "string" && s.nom.trim() ? s.nom.trim().slice(0, 60) : `Série ${i + 1}`, couleur: typeof s.couleur === "string" && /^#[0-9a-f]{6}$/i.test(s.couleur) ? s.couleur.toLowerCase() : couleurs[i % couleurs.length], valeurs };
  });
}

/** Un tableau collé depuis un tableur (colonnes séparées par des tabulations) : première ligne
 *  = noms des séries, première colonne = étiquettes. */
export function donneesDepuisCollage(texte: string): { etiquettes: string[]; series: { nom: string; valeurs: (number | null)[] }[] } | null {
  const lignes = texte.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "").map((l) => l.split("\t"));
  if (lignes.length < 2 || lignes[0].length < 2) return null;
  const noms = lignes[0].slice(1);
  const etiquettes = lignes.slice(1).map((l) => l[0].trim());
  const lire = (v: string | undefined) => {
    const n = Number((v ?? "").replace(/[\s %€]/g, "").replace(",", "."));
    return v !== undefined && v.trim() !== "" && Number.isFinite(n) ? n : null;
  };
  return { etiquettes, series: noms.map((nom, j) => ({ nom: nom.trim() || `Série ${j + 1}`, valeurs: lignes.slice(1).map((l) => lire(l[j + 1])) })) };
}
