// Les réglages du labo photo (étape 5, lots 2 et 3), tels que le document les garde : seulement
// ceux qui ne sont pas à zéro (BRIEF, modèle de document ; règle 13, l'original n'est jamais
// touché). Le noyau les calcule (`noyau/src/labo.rs`), la fenêtre en refait une partie dans un
// shader pour l'aperçu en direct (`labo/shader.ts`).

export const COULEURS_MELANGEUR = ["rouge", "orange", "jaune", "vert", "cyan", "bleu", "violet", "magenta"] as const;
export type CouleurMelangeur = (typeof COULEURS_MELANGEUR)[number];

/** Teinte, saturation et luminance d'une couleur du mélangeur, de -100 à +100. */
export interface RetoucheCouleur {
  teinte?: number;
  saturation?: number;
  luminance?: number;
}

/** Les courbes des tonalités : celle de l'image entière, puis une par canal. */
export const CANAUX_COURBE = ["rgb", "rouge", "vert", "bleu"] as const;
export type CanalCourbe = (typeof CANAUX_COURBE)[number];
/** Un point de la courbe : entrée et sortie, de 0 à 255 (l'image telle qu'elle s'affiche). */
export type PointCourbe = [number, number];
/** Une liste absente ou vide : la diagonale, rien ne change. */
export type CourbeTonalites = Partial<Record<CanalCourbe, PointCourbe[]>>;

/** Les trois zones de l'étalonnage. */
export const ZONES_ETALONNAGE = ["ombres", "tonsMoyens", "hautesLumieres"] as const;
export type ZoneEtalonnage = (typeof ZONES_ETALONNAGE)[number];
/** La teinte d'une zone (de 0 à 360°) et sa force (de 0 à 100). */
export interface TeinteZone {
  teinte?: number;
  saturation?: number;
}
/** L'étalonnage, comme celui de Lightroom ; `equilibre` (de -100 à +100) déplace la frontière
 *  entre ombres et hautes lumières (positif : plus de hautes lumières). */
export interface Etalonnage {
  ombres?: TeinteZone;
  tonsMoyens?: TeinteZone;
  hautesLumieres?: TeinteZone;
  equilibre?: number;
}

export interface ReglagesPhoto {
  temperature?: number;
  teinte?: number;
  /** En IL, de -5 à +5. */
  exposition?: number;
  contraste?: number;
  hautesLumieres?: number;
  ombres?: number;
  blancs?: number;
  noirs?: number;
  vibrance?: number;
  saturation?: number;
  melangeur?: Partial<Record<CouleurMelangeur, RetoucheCouleur>>;
  etalonnage?: Etalonnage;
  courbe?: CourbeTonalites;
  texture?: number;
  clarte?: number;
  voile?: number;
  vignetage?: number;
  /** De 0 à 100. */
  grain?: number;
  nettete?: number;
  /** Réduction du bruit, de 0 à 100. */
  bruit?: number;
}

export type CurseurLabo = Exclude<keyof ReglagesPhoto, "melangeur" | "courbe" | "etalonnage">;

/** Un curseur du panneau : sa plage, son pas, son libellé. */
export interface DefinitionCurseur {
  cle: CurseurLabo;
  libelle: string;
  min: number;
  max: number;
  pas: number;
}

const c = (cle: CurseurLabo, libelle: string, min = -100, max = 100, pas = 1): DefinitionCurseur => ({ cle, libelle, min, max, pas });

/** Les sections du panneau, dans l'ordre du BRIEF. */
export const SECTIONS_LABO: { titre: string; curseurs: DefinitionCurseur[] }[] = [
  {
    titre: "Lumière",
    curseurs: [c("exposition", "Exposition", -5, 5, 0.05), c("contraste", "Contraste"), c("hautesLumieres", "Hautes lumières"), c("ombres", "Ombres"), c("blancs", "Blancs"), c("noirs", "Noirs")],
  },
  { titre: "Couleur", curseurs: [c("temperature", "Température"), c("teinte", "Teinte"), c("vibrance", "Vibrance"), c("saturation", "Saturation")] },
  { titre: "Effets", curseurs: [c("texture", "Texture"), c("clarte", "Clarté"), c("voile", "Correction du voile"), c("vignetage", "Vignetage"), c("grain", "Grain", 0, 100)] },
  { titre: "Détail", curseurs: [c("nettete", "Netteté"), c("bruit", "Réduction du bruit", 0, 100)] },
];

export const CURSEURS_LABO: DefinitionCurseur[] = SECTIONS_LABO.flatMap((s) => s.curseurs);
const PAR_CLE = new Map(CURSEURS_LABO.map((d) => [d.cle, d]));

/** Les réglages qui regardent les pixels voisins : le noyau les calcule (au relâchement du
 *  curseur pour l'aperçu, à l'export depuis l'original). */
export const CURSEURS_VOISINS: CurseurLabo[] = ["bruit", "nettete", "texture", "clarte", "voile"];

export function definitionCurseur(cle: CurseurLabo): DefinitionCurseur {
  return PAR_CLE.get(cle)!;
}

function borner(v: unknown, min: number, max: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return Math.min(max, Math.max(min, n));
}

export const POINTS_COURBE_MAX = 16;
/** Les pas de la table d'une courbe (la même dans le noyau et dans le shader). */
export const PAS_COURBE = 1024;

/**
 * Les points d'une courbe tels que le document les garde : entiers de 0 à 255, rangés, une
 * seule sortie par entrée (la dernière donnée), les deux bouts présents (s'ils manquent, (0, 0)
 * et (255, 255) sont ajoutés), seize au plus ; une diagonale devient une liste vide. Les mêmes
 * règles que `normaliser_points` du noyau.
 */
export function normaliserPoints(points: unknown): PointCourbe[] {
  if (!Array.isArray(points)) return [];
  const p: PointCourbe[] = [];
  for (const q of points) {
    if (!Array.isArray(q) || q.length < 2) continue;
    const [x, y] = q as unknown[];
    if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    p.push([Math.round(Math.min(255, Math.max(0, x))), Math.round(Math.min(255, Math.max(0, y)))]);
  }
  // Tri stable : à entrée égale, l'ordre donné reste, et la dernière sortie l'emporte.
  p.sort((a, b) => a[0] - b[0]);
  const sortie: PointCourbe[] = [];
  for (const q of p) {
    if (sortie.length && sortie[sortie.length - 1][0] === q[0]) sortie[sortie.length - 1] = q;
    else sortie.push(q);
  }
  if (!sortie.length) return sortie;
  if (sortie[0][0] > 0) sortie.unshift([0, 0]);
  if (sortie[sortie.length - 1][0] < 255) sortie.push([255, 255]);
  if (sortie.length > POINTS_COURBE_MAX) {
    const dernier = sortie[sortie.length - 1];
    sortie.length = POINTS_COURBE_MAX - 1;
    sortie.push(dernier);
  }
  return sortie.every(([x, y]) => x === y) ? [] : sortie;
}

/** La courbe normalisée ; `undefined` si toutes ses listes sont des diagonales. */
export function normaliserCourbe(c: unknown): CourbeTonalites | undefined {
  if (!c || typeof c !== "object") return undefined;
  const sortie: CourbeTonalites = {};
  for (const canal of CANAUX_COURBE) {
    const p = normaliserPoints((c as Record<string, unknown>)[canal]);
    if (p.length) sortie[canal] = p;
  }
  return Object.keys(sortie).length ? sortie : undefined;
}

/**
 * Une courbe monotone par morceaux (Fritsch et Carlson, 1980), la même que celle du noyau :
 * elle passe par chaque point sans repartir en arrière ni dépasser ses voisins. Lit une valeur
 * de 0 à 1 et rend une valeur de 0 à 1.
 */
export function spline(points: PointCourbe[] | undefined): (v: number) => number {
  const xs = points && points.length >= 2 ? points.map((q) => q[0] / 255) : [0, 1];
  const ys = points && points.length >= 2 ? points.map((q) => q[1] / 255) : [0, 1];
  const n = xs.length;
  const d: number[] = [];
  for (let k = 0; k < n - 1; k++) d.push((ys[k + 1] - ys[k]) / (xs[k + 1] - xs[k]));
  const m = new Array<number>(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let k = 1; k < n - 1; k++) m[k] = d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2;
  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) {
      m[k] = 0;
      m[k + 1] = 0;
    } else {
      const a = m[k] / d[k];
      const b = m[k + 1] / d[k];
      const s = a * a + b * b;
      if (s > 9) {
        const t = 3 / Math.sqrt(s);
        m[k] = t * a * d[k];
        m[k + 1] = t * b * d[k];
      }
    }
  }
  return (v: number) => {
    if (v <= xs[0]) return ys[0];
    if (v >= xs[n - 1]) return ys[n - 1];
    let k = 0;
    while (k < n - 2 && v >= xs[k + 1]) k++;
    const h = xs[k + 1] - xs[k];
    const t = (v - xs[k]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const y = (2 * t3 - 3 * t2 + 1) * ys[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * ys[k + 1] + (t3 - t2) * h * m[k + 1];
    return Math.min(1, Math.max(0, y));
  };
}

/**
 * La table d'une courbe pour le shader : pour 1024 valeurs de 0 à 1 (en sRGB), la sortie du
 * rouge, du vert et du bleu (la courbe de l'image entière d'abord, puis celle du canal), en
 * RGBA ; `null` s'il n'y a rien à faire.
 */
export function tableCourbe(c: CourbeTonalites | undefined): Float32Array | null {
  const n = normaliserCourbe(c);
  if (!n) return null;
  const [maitre, r, v, b] = CANAUX_COURBE.map((canal) => spline(n[canal]));
  const table = new Float32Array(PAS_COURBE * 4);
  for (let i = 0; i < PAS_COURBE; i++) {
    const x = maitre(i / (PAS_COURBE - 1));
    table.set([r(x), v(x), b(x), 1], i * 4);
  }
  return table;
}

/** L'étalonnage normalisé : une zone sans force sort (sa teinte ne compte pas), la teinte de 0
 *  à 359°, l'équilibre seulement s'il y a une zone ; `undefined` s'il ne reste rien. Les mêmes
 *  règles que `Etalonnage::bornes` du noyau, en entiers. */
export function normaliserEtalonnage(e: unknown): Etalonnage | undefined {
  if (!e || typeof e !== "object") return undefined;
  const brut = e as Record<string, unknown>;
  const sortie: Etalonnage = {};
  for (const z of ZONES_ETALONNAGE) {
    const zone = brut[z] as TeinteZone | undefined;
    if (!zone || typeof zone !== "object") continue;
    const saturation = Math.round(borner(zone.saturation, 0, 100));
    if (saturation <= 0) continue;
    const t = typeof zone.teinte === "number" && Number.isFinite(zone.teinte) ? Math.round(((zone.teinte % 360) + 360) % 360) % 360 : 0;
    sortie[z] = t ? { teinte: t, saturation } : { saturation };
  }
  if (!Object.keys(sortie).length) return undefined;
  const equilibre = Math.round(borner(brut.equilibre, -100, 100));
  if (equilibre) sortie.equilibre = equilibre;
  return sortie;
}

/** La force de l'étalonnage à 100 (la même dans le noyau). */
export const FORCE_ETALONNAGE = 1;

/** L'écart de couleur d'une zone : la couleur pleine de la teinte, moins sa luminance, à la
 *  force voulue (le même calcul que `vecteur_etalonnage` du noyau). */
export function vecteurEtalonnage(teinte: number, saturation: number): [number, number, number] {
  const f = (n: number) => {
    const k = (((n + teinte / 60) % 6) + 6) % 6;
    return 1 - Math.min(1, Math.max(0, Math.min(k, 4 - k)));
  };
  const c = [f(5), f(3), f(1)];
  const y = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  const force = (saturation / 100) * FORCE_ETALONNAGE;
  return [(c[0] - y) * force, (c[1] - y) * force, (c[2] - y) * force];
}

/** La couleur d'une teinte à l'écran (pastilles et pistes du panneau). */
export function couleurDeTeinte(teinte: number, saturation = 100): string {
  return `hsl(${Math.round(teinte)}, ${Math.round(saturation)}%, 50%)`;
}

/** Chaque valeur dans sa plage, les zéros retirés ; `undefined` s'il ne reste rien. */
export function normaliserReglages(r: ReglagesPhoto | undefined | null): ReglagesPhoto | undefined {
  if (!r || typeof r !== "object") return undefined;
  const sortie: ReglagesPhoto = {};
  for (const d of CURSEURS_LABO) {
    const v = borner(r[d.cle], d.min, d.max);
    // Arrondi au pas du curseur (à un centième près pour l'exposition).
    const arrondi = d.pas < 1 ? Math.round(v * 100) / 100 : Math.round(v);
    if (arrondi !== 0) sortie[d.cle] = arrondi;
  }
  const melangeur: NonNullable<ReglagesPhoto["melangeur"]> = {};
  for (const couleur of COULEURS_MELANGEUR) {
    const m = r.melangeur?.[couleur];
    if (!m) continue;
    const t: RetoucheCouleur = {};
    for (const k of ["teinte", "saturation", "luminance"] as const) {
      const v = Math.round(borner(m[k], -100, 100));
      if (v !== 0) t[k] = v;
    }
    if (Object.keys(t).length) melangeur[couleur] = t;
  }
  if (Object.keys(melangeur).length) sortie.melangeur = melangeur;
  const etalonnage = normaliserEtalonnage(r.etalonnage);
  if (etalonnage) sortie.etalonnage = etalonnage;
  const courbe = normaliserCourbe(r.courbe);
  if (courbe) sortie.courbe = courbe;
  return Object.keys(sortie).length ? sortie : undefined;
}

export function valeurReglage(r: ReglagesPhoto | undefined, cle: CurseurLabo): number {
  return r?.[cle] ?? 0;
}

/** Des réglages qui regardent les pixels voisins (calculés par le noyau). */
export function aDesVoisins(r: ReglagesPhoto | undefined): boolean {
  return !!r && CURSEURS_VOISINS.some((k) => (r[k] ?? 0) !== 0);
}

/** Une clé stable pour comparer deux jeux de réglages. */
export function cleReglages(r: ReglagesPhoto | undefined): string {
  const n = normaliserReglages(r);
  if (!n) return "";
  const trie = (o: unknown): unknown =>
    Array.isArray(o)
      ? o.map(trie)
      : o && typeof o === "object"
        ? Object.fromEntries(
            Object.entries(o)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([k, v]) => [k, trie(v)]),
          )
        : o;
  return JSON.stringify(trie(n));
}

/** La valeur affichée d'un curseur : « +0,40 IL », « −25 ». */
export function texteValeur(cle: CurseurLabo, v: number): string {
  const d = definitionCurseur(cle);
  const signe = v > 0 && d.min < 0 ? "+" : v < 0 ? "−" : "";
  const absolu = Math.abs(v);
  const texte = d.pas < 1 ? absolu.toFixed(2).replace(".", ",") : String(Math.round(absolu));
  return `${signe}${texte}${cle === "exposition" ? " IL" : ""}`;
}

/** Une valeur tapée au clavier (« 0,4 », « -25 », « +1.5 IL »), dans la plage du curseur. */
export function lireValeur(cle: CurseurLabo, texte: string): number | undefined {
  const propre = texte.replace(/\s|IL/gi, "").replace(",", ".").replace("−", "-");
  if (!/^[+-]?\d*\.?\d+$/.test(propre)) return undefined;
  const d = definitionCurseur(cle);
  return borner(Number(propre), d.min, d.max);
}
