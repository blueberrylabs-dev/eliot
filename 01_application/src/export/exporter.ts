// Export d'images et de documents. Dans l'application (étape 5, lot 1) : la fenêtre décrit chaque
// page en calques (`calques.ts`, comme pour le film) et le noyau la rend lui-même depuis les
// originaux des photos et les fichiers de police : PNG, JPEG, WebP, PDF vectoriel, SVG
// (`noyau/src/rendu_page.rs`). Hors de l'application (`npm run dev` dans un navigateur) : la
// page est rendue par Konva à sa taille native, quel que soit le zoom (règle 7), et téléchargée,
// en PNG ou en JPEG seulement. Les objets 3D (étape 6) sont rendus par la fenêtre à la finesse de
// l'export (`finesseExport`) ; le noyau pose leur image avec le reste.

import { pageCourante, useEditeur } from "../etat/editeur";
import { useTemps } from "../etat/temps";
import { FORMATS_PAGE, type Format, type PageEliot } from "../modele/types";
import { dansTauri, ecrireExport, exporterDocument, type FormatExport } from "../pont/tauri";
import { avecFinesse } from "../trois/moteur";
import { decrirePage, type PoliceCalques } from "./calques";
import { rendrePage } from "./rendu";

export interface OptionsExport {
  format: FormatExport;
  /** PNG, JPEG, WebP : multiplie la définition (une page de 1080 px donne 2160 px à 2 ; une
   *  affiche A4 fait 300 dpi à 1, 150 dpi à 0,5). Sans effet sur le PDF et le SVG. */
  echelle: number;
  /** PNG et WebP : le fond de la page n'est pas dessiné. */
  transparent: boolean;
  /** JPEG et WebP : la qualité, de 1 à 100 (sans elle, `QUALITE_PAR_DEFAUT`). Plus basse, le
   *  fichier est plus léger. */
  qualite?: number;
  /** La page affichée, ou toutes les pages (une image par page, numérotées ; un seul PDF). Le
   *  SVG : la page affichée seulement. */
  pages: "courante" | "toutes";
  /** Chemin choisi dans « Enregistrer sous » (un seul fichier). */
  chemin?: string;
}

/** Où en est l'export : `description` (la fenêtre décrit les pages), `rendu` (le noyau). */
export type Progression = (fait: number, total: number, etape: "description" | "rendu") => void;

/** Les formats que seule l'application sait faire (le noyau). */
export const FORMATS_DU_NOYAU: FormatExport[] = ["webp", "pdf", "svg"];

export const LIBELLES_EXPORT: Record<FormatExport, string> = { png: "PNG", jpeg: "JPEG", webp: "WebP", pdf: "PDF", svg: "SVG" };

/** La qualité d'un JPEG et d'un WebP quand rien n'est demandé (celle du noyau). */
export const QUALITE_PAR_DEFAUT = { jpeg: 92, webp: 90 } as const;

/** Une qualité demandée, ramenée à un entier de 1 à 100 (comme le noyau). */
export const bornerQualite = (q: number): number => Math.min(100, Math.max(1, Math.round(Number.isFinite(q) ? q : 100)));

/** Le plus grand côté et le nombre de pixels d'une image exportée (comme le noyau). */
export const COTE_MAX = 12_000;
export const PIXELS_MAX = 100_000_000;

/** Une page au format A4 ou A5 (300 dpi), dans un sens ou dans l'autre : ses tailles se disent
 *  en dpi. */
export function formatPapier(format: Format): boolean {
  return FORMATS_PAGE.some((f) => (f.id === "a4" || f.id === "a5") && ((f.largeur === format.largeur && f.hauteur === format.hauteur) || (f.largeur === format.hauteur && f.hauteur === format.largeur)));
}

/** Les tailles proposées : 150 et 300 dpi pour l'A4 et l'A5, sinon ×1 à ×4 ; celles qui
 *  dépassent la taille permise sont retirées (×1 reste toujours). */
export function echellesPossibles(format: Format): number[] {
  const toutes = formatPapier(format) ? [0.5, 1] : [1, 2, 3, 4];
  return toutes.filter((e) => e === 1 || (Math.round(format.largeur * e) <= COTE_MAX && Math.round(format.hauteur * e) <= COTE_MAX && Math.round(format.largeur * e) * Math.round(format.hauteur * e) <= PIXELS_MAX));
}

const deux = (n: number) => String(n).padStart(2, "0");

/** `AAAA-MM-JJ_HHMMSS_eliot` (BRIEF § 6, export de bout en bout). */
export function nomDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}_${deux(d.getHours())}${deux(d.getMinutes())}${deux(d.getSeconds())}_eliot`;
}

/** Les pages demandées : une page vidéo sort à l'instant de la tête de lecture (la page
 *  affichée), sinon au début ; une page fixe, telle quelle. */
function pagesDemandees(options: OptionsExport): { page: PageEliot; instant: number }[] {
  const etat = useEditeur.getState();
  const pages = options.format === "svg" || options.pages === "courante" ? [pageCourante(etat)] : etat.document.pages;
  return pages.map((page) => ({ page, instant: page.duree !== undefined && page.id === etat.pageActive ? useTemps.getState().tete : 0 }));
}

/** La finesse du rendu des objets 3D pour un export : l'échelle d'une image ; pour un PDF ou un
 *  SVG, deux pixels par pixel de la page (un pixel d'un format papier, déjà à 300 dpi). */
export function finesseExport(options: Pick<OptionsExport, "format" | "echelle">, format: Format): number {
  if (options.format === "pdf" || options.format === "svg") return formatPapier(format) ? 1 : 2;
  return options.echelle;
}

/** Exporte et renvoie les chemins écrits (un par page, ou le PDF). */
export async function exporter(options: OptionsExport, progression?: Progression): Promise<string[]> {
  // Un texte en cours de saisie est validé avant le rendu.
  if (document.activeElement instanceof HTMLTextAreaElement) document.activeElement.blur();
  const etat = useEditeur.getState();
  const { document: doc } = etat;
  const demandees = pagesDemandees(options);
  const base = nomDate();
  if (dansTauri) {
    if (!etat.projet) throw new Error("aucun design ouvert");
    const projet = etat.projet;
    const pages: { description: Awaited<ReturnType<typeof decrirePage>>; instant: number }[] = [];
    for (const [rang, d] of demandees.entries()) {
      progression?.(rang, demandees.length, "description");
      pages.push({ description: await avecFinesse(finesseExport(options, doc.format), () => decrirePage(d.page, doc.format)), instant: d.instant });
    }
    // Les polices une fois pour toutes les pages ; les sons ne servent qu'au film.
    const polices: PoliceCalques[] = [];
    const vues = new Set<string>();
    for (const p of pages) {
      for (const f of p.description.polices) {
        const cle = `${f.famille.toLowerCase()}|${f.style}|${f.poidsMin}|${f.poidsMax}`;
        if (!vues.has(cle)) {
          vues.add(cle);
          polices.push(f);
        }
      }
      p.description = { ...p.description, polices: [], sons: [] };
    }
    progression?.(0, demandees.length, "rendu");
    const qualite = options.qualite !== undefined && (options.format === "jpeg" || options.format === "webp") ? bornerQualite(options.qualite) : undefined;
    return exporterDocument(projet, { format: options.format, pages, polices, echelle: options.echelle, transparent: options.transparent, qualite }, base, options.chemin, (fait, total) => progression?.(fait, total, "rendu"));
  }
  if (options.format !== "png" && options.format !== "jpeg") throw new Error(`le ${LIBELLES_EXPORT[options.format]} se fait dans l'application Eliot`);
  const ecrits: string[] = [];
  for (const [rang, { page, instant }] of demandees.entries()) {
    progression?.(rang, demandees.length, "rendu");
    const blob = await avecFinesse(options.echelle, () => rendrePage(page, doc.format, {
      pixelRatio: options.echelle,
      type: options.format === "png" ? "image/png" : "image/jpeg",
      transparent: options.transparent,
      qualite: options.qualite !== undefined ? bornerQualite(options.qualite) / 100 : undefined,
      instant,
    }));
    const octets = new Uint8Array(await blob.arrayBuffer());
    const nom = demandees.length > 1 ? `${base}_page-${deux(rang + 1)}` : base;
    ecrits.push(await ecrireExport(octets, options.format, nom, demandees.length === 1 ? options.chemin : undefined));
  }
  progression?.(demandees.length, demandees.length, "rendu");
  return ecrits;
}
