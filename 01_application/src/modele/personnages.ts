// Les personnages (Open Peeps, Humaaans) : le catalogue fabriqué par `npm run bibliotheque`
// (`outils/personnages.mjs`), et tout ce qui se calcule sans écran : assembler les pièces d'un
// personnage composé, changer ses couleurs, recaler sa boîte quand une pièce change, tirer un
// personnage au hasard. Fonctions pures, testées (`personnages.test.ts`).

import type { ElementPersonnage, Format } from "./types";

/** [x, y, largeur, hauteur], dans le repère du dessin. */
export type Boite = [number, number, number, number];

export interface PlacePiece {
  /** L'emplacement (`tete`, `corps`…). */
  id: string;
  /** Le groupe de pièces où choisir (`corps-buste`, `tete`…). */
  groupe: string;
  x: number;
  y: number;
  /** L'emplacement peut rester vide (barbe, lunettes, siège). */
  facultatif?: boolean;
}

export interface Posture {
  id: string;
  libelle: string;
  /** Dans l'ordre du dessin : la première pièce est dessous. */
  emplacements: PlacePiece[];
  /** Les pièces par défaut propres à cette posture (la tenue d'un personnage assis…). */
  defaut?: Record<string, string>;
}

export interface PieceCatalogue {
  id: string;
  libelle: string;
  boite: Boite;
}

export interface CouleurPartie {
  id: string;
  libelle: string;
  defaut: string;
}

export interface Composition {
  /** Le fichier des pièces, dans `bibliotheque/personnages/`. */
  fichier: string;
  postures: Posture[];
  emplacements: { id: string; libelle: string }[];
  /** Les parties coloriables une à une (Open Peeps) ; vide : couleur par couleur. */
  couleurs: CouleurPartie[];
  defaut: { posture: string; pieces: Record<string, string> };
  groupes: Record<string, PieceCatalogue[]>;
}

export interface CategoriePersonnages {
  id: string;
  libelle: string;
  mots: string;
  fichier: string;
  elements: { nom: string; vue: Boite }[];
}

export interface CollectionPersonnages {
  id: string;
  libelle: string;
  style: string;
  auteur: string;
  licence: string;
  lien: string;
  categories: CategoriePersonnages[];
  composition: Composition;
}

export interface CataloguePersonnages {
  version: number;
  collections: CollectionPersonnages[];
}

/** Ce qui suffit pour décrire un personnage, sans sa place sur la page. */
export type SourcePersonnage = Pick<ElementPersonnage, "collection" | "dessin" | "posture" | "pieces" | "couleurs">;

// ---- Personnages tout faits ----

/** La catégorie et le cadrage d'un personnage tout fait. */
export function trouverDessin(c: CollectionPersonnages, nom: string): { categorie: CategoriePersonnages; vue: Boite } | undefined {
  for (const categorie of c.categories) {
    const e = categorie.elements.find((x) => x.nom === nom);
    if (e) return { categorie, vue: e.vue };
  }
  return undefined;
}

// ---- Personnages composés ----

export function posture(c: Composition, id: string | undefined): Posture {
  return c.postures.find((p) => p.id === id) ?? c.postures.find((p) => p.id === c.defaut.posture) ?? c.postures[0];
}

const piece = (c: Composition, groupe: string, id: string | undefined) => (id ? c.groupes[groupe]?.find((p) => p.id === id) : undefined);

/**
 * Les pièces d'un personnage, remises d'aplomb pour sa posture : une pièce inconnue ou d'un
 * autre groupe est remplacée par celle du défaut (sinon la première, sauf pour un emplacement
 * facultatif, qui reste vide). `""` : pièce retirée exprès (pas de barbe, pas de siège). Les
 * emplacements absents de la posture sont gardés tels quels : passer de « assis » à
 * « debout » puis revenir retrouve le même siège.
 */
export function piecesValides(c: Composition, idPosture: string | undefined, pieces: Record<string, string> = {}): { posture: string; pieces: Record<string, string> } {
  const p = posture(c, idPosture);
  const sortie: Record<string, string> = { ...pieces };
  for (const place of p.emplacements) {
    const choisie = pieces[place.id];
    if (place.facultatif && choisie === "") continue;
    if (piece(c, place.groupe, choisie)) continue;
    const remplacante = piece(c, place.groupe, p.defaut?.[place.id]) ?? piece(c, place.groupe, c.defaut.pieces[place.id]) ?? (place.facultatif ? undefined : c.groupes[place.groupe]?.[0]);
    if (remplacante) sortie[place.id] = remplacante.id;
    else delete sortie[place.id];
  }
  return { posture: p.id, pieces: sortie };
}

/** Les pièces posées, dans l'ordre du dessin : `emplacements` limite à certaines (vignettes). */
export function piecesPosees(c: Composition, idPosture: string | undefined, pieces: Record<string, string>, emplacements?: string[]) {
  return posture(c, idPosture)
    .emplacements.filter((place) => !emplacements || emplacements.includes(place.id))
    .flatMap((place) => {
      const p = piece(c, place.groupe, pieces[place.id]);
      return p ? [{ place, piece: p }] : [];
    });
}

export function unionBoites(boites: Boite[]): Boite | undefined {
  if (!boites.length) return undefined;
  const x1 = Math.min(...boites.map((b) => b[0]));
  const y1 = Math.min(...boites.map((b) => b[1]));
  const x2 = Math.max(...boites.map((b) => b[0] + b[2]));
  const y2 = Math.max(...boites.map((b) => b[1] + b[3]));
  return [x1, y1, x2 - x1, y2 - y1];
}

const arrondi2 = (v: number) => Math.round(v * 100) / 100;

/** Le cadrage d'un personnage composé : toutes ses pièces, avec une petite marge. */
export function vueComposee(c: Composition, idPosture: string | undefined, pieces: Record<string, string>, emplacements?: string[]): Boite {
  const u = unionBoites(piecesPosees(c, idPosture, pieces, emplacements).map(({ place, piece: p }) => [p.boite[0] + place.x, p.boite[1] + place.y, p.boite[2], p.boite[3]] as Boite));
  if (!u) return [0, 0, 1, 1];
  const marge = Math.max(u[2], u[3]) * 0.006;
  return [arrondi2(u[0] - marge), arrondi2(u[1] - marge), arrondi2(u[2] + 2 * marge), arrondi2(u[3] + 2 * marge)];
}

/** Le dessin d'un personnage composé : chaque pièce à sa place. `contenus` : groupe → pièce →
 *  contenu SVG (le fichier des pièces de la collection). */
export function corpsCompose(c: Composition, idPosture: string | undefined, pieces: Record<string, string>, contenus: Record<string, Record<string, string>>, emplacements?: string[]): string {
  return piecesPosees(c, idPosture, pieces, emplacements)
    .map(({ place, piece: p }) => {
      const contenu = contenus[place.groupe]?.[p.id];
      return contenu ? `<g transform="translate(${place.x} ${place.y})">${contenu}</g>` : "";
    })
    .join("");
}

// ---- Couleurs ----

/** Fonds et encre marqués par la fabrique (Open Peeps) : `fill="#…" data-c="f-tete"` ou `"i"`. */
const MARQUES = /fill="(#[0-9A-Fa-f]{6})" data-c="(f-[a-z]+|i)"/g;
/** Les autres couleurs : celles qui ne portent pas de marque. */
const LIBRES = /(fill|stroke)="(#[0-9A-Fa-f]{6})"(?! data-c)/g;

const partie = (marque: string) => (marque === "i" ? "trait" : marque.slice(2));

/** Le dessin avec ses nouvelles couleurs : par partie marquée, puis couleur par couleur. */
export function appliquerCouleurs(corps: string, couleurs: Record<string, string> | undefined): string {
  if (!couleurs || !Object.keys(couleurs).length) return corps;
  const parHex = new Map(Object.entries(couleurs).filter(([k]) => k.startsWith("#")).map(([k, v]) => [k.toUpperCase(), v]));
  return corps
    .replace(MARQUES, (tout, _hex: string, marque: string) => {
      const nouvelle = couleurs[partie(marque)];
      return nouvelle ? `fill="${nouvelle}" data-c="${marque}"` : tout;
    })
    .replace(LIBRES, (tout, attribut: string, hex: string) => {
      const nouvelle = parHex.get(hex.toUpperCase());
      return nouvelle ? `${attribut}="${nouvelle}"` : tout;
    });
}

export interface CouleurModifiable {
  /** Clé dans `couleurs` : une partie (`tete`) ou la couleur d'origine (`#B28B67`). */
  cle: string;
  libelle: string;
  /** La couleur d'origine. */
  origine: string;
}

/** Les couleurs qu'on peut changer dans un dessin : les parties marquées d'abord (dans l'ordre
 *  de `parties`), puis les autres couleurs, des plus présentes aux plus rares. */
export function couleursDuDessin(corps: string, parties: CouleurPartie[], maximum = 10): CouleurModifiable[] {
  const marquees = new Map<string, string>();
  for (const m of corps.matchAll(MARQUES)) if (!marquees.has(partie(m[2]))) marquees.set(partie(m[2]), m[1].toUpperCase());
  const sortie: CouleurModifiable[] = [];
  for (const p of parties) {
    const origine = marquees.get(p.id);
    if (origine) sortie.push({ cle: p.id, libelle: p.libelle, origine });
  }
  const comptes = new Map<string, number>();
  for (const m of corps.matchAll(LIBRES)) {
    const hex = m[2].toUpperCase();
    comptes.set(hex, (comptes.get(hex) ?? 0) + 1);
  }
  for (const [hex] of [...comptes].sort((a, b) => b[1] - a[1])) sortie.push({ cle: hex, libelle: hex, origine: hex });
  return sortie.slice(0, maximum);
}

// ---- SVG complet ----

/** Le SVG d'un personnage, à `taille` pixels pour son plus grand côté (sinon 100 %). */
export function svgPersonnage(vue: Boite, corps: string, taille?: number): string {
  const [x, y, l, h] = vue;
  const dimensions = taille ? (l >= h ? ` width="${taille}" height="${Math.max(1, Math.round((taille * h) / l))}"` : ` width="${Math.max(1, Math.round((taille * l) / h))}" height="${taille}"`) : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${x} ${y} ${l} ${h}"${dimensions}>${corps}</svg>`;
}

// ---- Place sur la page ----

type Place = Pick<ElementPersonnage, "x" | "y" | "largeur" | "hauteur" | "rotation" | "retourneH">;

const tourner = (dx: number, dy: number, degres: number) => {
  const a = (degres * Math.PI) / 180;
  return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
};

/**
 * La nouvelle boîte d'un personnage dont une pièce change : même échelle, et ce qui ne change
 * pas reste exactement à sa place sur la page (une barbe ajoutée ne déplace pas la tête).
 */
export function boiteApresPiece(el: Place, avant: Boite, apres: Boite): Pick<Place, "x" | "y" | "largeur" | "hauteur"> {
  const sx = el.largeur / avant[2];
  const sy = el.hauteur / avant[3];
  const dx = el.retourneH ? (avant[0] + avant[2] - (apres[0] + apres[2])) * sx : (apres[0] - avant[0]) * sx;
  const dy = (apres[1] - avant[1]) * sy;
  const [rx, ry] = tourner(dx, dy, el.rotation);
  return { x: el.x + rx, y: el.y + ry, largeur: apres[2] * sx, hauteur: apres[3] * sy };
}

/** La nouvelle boîte quand la posture change : même hauteur, centré sur le même bas. */
export function boiteApresPosture(el: Place, apres: Boite): Pick<Place, "x" | "y" | "largeur" | "hauteur"> {
  const hauteur = el.hauteur;
  const largeur = (hauteur * apres[2]) / apres[3];
  const [rx, ry] = tourner((el.largeur - largeur) / 2, 0, el.rotation);
  return { x: el.x + rx, y: el.y + ry, largeur, hauteur };
}

/**
 * Un personnage composé après le changement de ses pièces ou de sa posture : pièces remises
 * d'aplomb, boîte recalée (`boiteApresPiece`, ou `boiteApresPosture` si la posture change).
 * Un personnage tout fait, ou une collection inconnue, reste tel quel.
 */
export function recalerPersonnage(avant: ElementPersonnage, apres: ElementPersonnage, c: CollectionPersonnages | undefined): ElementPersonnage {
  if (!c || apres.dessin || avant.dessin) return apres;
  const v = piecesValides(c.composition, apres.posture, apres.pieces);
  const ancienne = piecesValides(c.composition, avant.posture, avant.pieces);
  const vueApres = vueComposee(c.composition, v.posture, v.pieces);
  const boite = ancienne.posture !== v.posture ? boiteApresPosture(avant, vueApres) : boiteApresPiece(avant, vueComposee(c.composition, ancienne.posture, ancienne.pieces), vueApres);
  return { ...apres, posture: v.posture, pieces: v.pieces, ...boite };
}

/** La taille d'un nouveau personnage : dans 45 % de la largeur et 70 % de la hauteur de la
 *  page, proportions gardées, au centre. */
export function boiteDeDepart(page: Format, vue: Boite): Pick<Place, "x" | "y" | "largeur" | "hauteur"> {
  const s = Math.min((page.largeur * 0.45) / vue[2], (page.hauteur * 0.7) / vue[3]);
  const largeur = Math.round(vue[2] * s);
  const hauteur = Math.round(vue[3] * s);
  return { x: Math.round((page.largeur - largeur) / 2), y: Math.round((page.hauteur - hauteur) / 2), largeur, hauteur };
}

// ---- Au hasard ----

/** Des pièces tirées au hasard pour une posture (au hasard aussi si elle n'est pas donnée).
 *  Barbe et lunettes ne viennent qu'une fois sur trois ; un personnage assis a toujours un
 *  siège, sauf dans un fauteuil roulant. */
export function piecesAuHasard(c: Composition, idPosture?: string, hasard: () => number = Math.random): { posture: string; pieces: Record<string, string> } {
  const p = idPosture ? posture(c, idPosture) : c.postures[Math.floor(hasard() * c.postures.length)];
  const pieces: Record<string, string> = {};
  for (const place of p.emplacements) {
    const liste = c.groupes[place.groupe] ?? [];
    if (!liste.length) continue;
    if (place.facultatif && place.id !== "siege" && hasard() > 1 / 3) {
      pieces[place.id] = "";
      continue;
    }
    pieces[place.id] = liste[Math.floor(hasard() * liste.length)].id;
  }
  if (pieces.bas === "wheelchair" && "siege" in pieces) pieces.siege = "";
  return piecesValides(c, p.id, pieces);
}
