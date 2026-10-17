// Les styles de texte enregistrés (étape 7, lot 2) : la police, la taille, la couleur et les
// effets d'un texte, gardés sous un nom dans le kit de marque et posés d'un clic sur un texte de
// n'importe quel design. Ni la place, ni le contenu, ni la courbe, ni la liste : seulement
// l'allure des lettres.

import type { Alignement, ArretDegrade, Couleur, ElementTexte, Ombre } from "./types";

export interface StyleTexte {
  id: string;
  nom: string;
  police: string;
  taillePolice: number;
  gras: boolean;
  italique: boolean;
  souligne: boolean;
  barre?: boolean;
  majuscules?: boolean;
  couleur: Couleur;
  interligne: number;
  espacement: number;
  alignement: Alignement;
  contour?: { couleur: string; epaisseur: number };
  surlignage?: { couleur: string; marge: number; arrondi: number };
  ombre?: Ombre;
}

export const STYLES_MAX = 24;

/** Ce qu'un style change sur un texte. Les effets absents du style sont retirés du texte. */
const CLES = ["police", "taillePolice", "gras", "italique", "souligne", "barre", "majuscules", "couleur", "interligne", "espacement", "alignement", "contour", "surlignage", "ombre"] as const;

/** Le style d'un texte, gardé sous `nom`. */
export function styleDepuisTexte(t: ElementTexte, nom: string, id: string): StyleTexte {
  const s: Record<string, unknown> = { id, nom: nom.replace(/\s+/g, " ").trim().slice(0, 40) || "Mon style" };
  for (const k of CLES) if (t[k] !== undefined) s[k] = structuredClone(t[k]);
  return s as unknown as StyleTexte;
}

/** Les modifications qui posent un style sur un texte (les effets absents du style s'en vont). */
export function modificationsDuStyle(s: StyleTexte): Partial<ElementTexte> {
  const m: Record<string, unknown> = {};
  for (const k of CLES) m[k] = s[k] === undefined ? undefined : structuredClone(s[k]);
  m.barre = !!s.barre;
  m.majuscules = !!s.majuscules;
  return m as Partial<ElementTexte>;
}

const HEX = /^#[0-9a-f]{6}$/i;
const nombre = (v: unknown, min: number, max: number): number | undefined => (typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : undefined);

function couleurValide(v: unknown): Couleur | undefined {
  if (typeof v === "string") return HEX.test(v) ? v.toLowerCase() : undefined;
  if (!v || typeof v !== "object") return undefined;
  const d = v as { type?: unknown; angle?: unknown; arrets?: unknown };
  if ((d.type !== "lineaire" && d.type !== "radial") || !Array.isArray(d.arrets)) return undefined;
  const arrets = (d.arrets as ArretDegrade[]).filter((a) => a && typeof a.couleur === "string" && HEX.test(a.couleur) && typeof a.position === "number").map((a) => ({ position: Math.max(0, Math.min(1, a.position)), couleur: a.couleur.toLowerCase() }));
  if (arrets.length < 2) return undefined;
  return { type: d.type, angle: nombre(d.angle, -360, 360) ?? 0, arrets };
}

/** Un style lu sur le disque, remis d'aplomb ; `null` s'il est inutilisable. */
export function styleValide(brut: unknown): StyleTexte | null {
  if (!brut || typeof brut !== "object") return null;
  const b = brut as Record<string, unknown>;
  const couleur = couleurValide(b.couleur);
  const taille = nombre(b.taillePolice, 4, 800);
  if (typeof b.id !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(b.id) || typeof b.police !== "string" || !b.police.trim() || !couleur || taille === undefined) return null;
  const alignement = b.alignement === "left" || b.alignement === "right" || b.alignement === "center" ? b.alignement : "center";
  const s: StyleTexte = {
    id: b.id,
    nom: typeof b.nom === "string" && b.nom.trim() ? b.nom.trim().slice(0, 40) : "Mon style",
    police: b.police.trim(),
    taillePolice: taille,
    gras: b.gras === true,
    italique: b.italique === true,
    souligne: b.souligne === true,
    ...(b.barre === true ? { barre: true } : {}),
    ...(b.majuscules === true ? { majuscules: true } : {}),
    couleur,
    interligne: nombre(b.interligne, 0.5, 4) ?? 1.2,
    espacement: nombre(b.espacement, -20, 200) ?? 0,
    alignement,
  };
  const c = b.contour as { couleur?: unknown; epaisseur?: unknown } | undefined;
  if (c && typeof c.couleur === "string" && HEX.test(c.couleur)) s.contour = { couleur: c.couleur.toLowerCase(), epaisseur: nombre(c.epaisseur, 0, 200) ?? 4 };
  const l = b.surlignage as { couleur?: unknown; marge?: unknown; arrondi?: unknown } | undefined;
  if (l && typeof l.couleur === "string" && HEX.test(l.couleur)) s.surlignage = { couleur: l.couleur.toLowerCase(), marge: nombre(l.marge, 0, 400) ?? 12, arrondi: nombre(l.arrondi, 0, 400) ?? 8 };
  const o = b.ombre as Partial<Ombre> | undefined;
  if (o && typeof o.couleur === "string" && HEX.test(o.couleur)) s.ombre = { couleur: o.couleur.toLowerCase(), flou: nombre(o.flou, 0, 400) ?? 10, x: nombre(o.x, -400, 400) ?? 0, y: nombre(o.y, -400, 400) ?? 0, opacite: nombre(o.opacite, 0, 1) ?? 0.5 };
  return s;
}

/** Les styles d'un kit lu sur le disque : valides, sans doublon d'identifiant, 24 au plus. */
export function stylesValides(brut: unknown): StyleTexte[] {
  if (!Array.isArray(brut)) return [];
  const vus = new Set<string>();
  const styles: StyleTexte[] = [];
  for (const b of brut) {
    const s = styleValide(b);
    if (!s || vus.has(s.id)) continue;
    vus.add(s.id);
    styles.push(s);
  }
  return styles.slice(0, STYLES_MAX);
}

/** Trouve un style par son identifiant ou par son nom (sans tenir compte des capitales). */
export function trouverStyle(styles: readonly StyleTexte[], cle: string): StyleTexte | undefined {
  const c = cle.trim().toLocaleLowerCase("fr");
  return styles.find((s) => s.id === cle) ?? styles.find((s) => s.nom.toLocaleLowerCase("fr") === c);
}
