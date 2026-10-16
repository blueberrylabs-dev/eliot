// Les réglages du labo photo (étape 5, lot 2), tels que le document les garde : seulement ceux
// qui ne sont pas à zéro (BRIEF, modèle de document ; règle 13, l'original n'est jamais
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

export type CurseurLabo = Exclude<keyof ReglagesPhoto, "melangeur">;

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
  const trie = (o: object): unknown =>
    Object.fromEntries(
      Object.entries(o)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, v && typeof v === "object" ? trie(v) : v]),
    );
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
