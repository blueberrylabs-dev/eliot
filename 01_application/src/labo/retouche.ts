// Les photos retouchées par le labo (étape 5, lots 2 et 3), dans la fenêtre : une toile par élément,
// dessinée par le shader (`shader.ts`) à partir de l'aperçu de 2560 px et, quand il y a des
// réglages qui regardent les voisins, de la base que le noyau calcule. L'export reconnaît la
// toile (`marquerToile`) et pose l'original à sa place : le noyau refait la retouche.

import { create } from "zustand";
import { marquerToile } from "../editeur/images";
import { elementsCourants, elementsSelectionnes, useEditeur } from "../etat/editeur";
import { aDesVoisins, cleReglages, normaliserReglages, type ReglagesPhoto } from "../modele/labo";
import type { ElementImage, ElementPage, PageEliot } from "../modele/types";
import { baseLabo } from "../pont/tauri";
import { moteurLabo, type PixelsBruts } from "./shader";

interface EtatLabo {
  /** La photo dont le panneau du labo est ouvert. */
  ouvert: string | null;
  /** Un curseur est tiré : la base du noyau attendra qu'on le relâche. */
  geste: boolean;
  /** Le bouton « Avant » est maintenu : la photo s'affiche sans retouche. */
  avant: boolean;
  /** Un préréglage survolé : la photo le montre sans que le document change. */
  essai: { id: string; reglages: ReglagesPhoto | undefined } | null;
  /** Le dernier préréglage appliqué, pour régler son intensité tant que le style n'a pas
   *  bougé. */
  applique: { photo: string; prereglage: string; intensite: number } | null;
  /** Les réglages copiés (Ctrl+Maj+C), à coller sur d'autres photos (Ctrl+Maj+V). */
  copie: { reglages: ReglagesPhoto | undefined } | null;
}

export const useLabo = create<EtatLabo>(() => ({ ouvert: null, geste: false, avant: false, essai: null, applique: null, copie: null }));

interface Base {
  cle: string;
  image: PixelsBruts;
  reglages: ReglagesPhoto;
}

interface Retouche {
  toile: HTMLCanvasElement;
  ressource: string;
  /** Ce qui est dessiné : source, réglages, base. */
  dessine: string;
  version: number;
  base?: Base;
  /** La clé des réglages de la base en cours de calcul par le noyau, ou ratée. */
  enCours?: string;
  ratee?: string;
  minuteur?: ReturnType<typeof setTimeout>;
  attentes: { cle: string; fini: () => void }[];
}

const retouches = new Map<string, Retouche>();
const abonnes = new Map<string, Set<() => void>>();

function prevenir(id: string): void {
  for (const f of abonnes.get(id) ?? []) f();
}

/** Prévenu quand la toile d'une photo change (nouvelle base, nouveaux réglages dessinés). */
export function abonnerRetouche(id: string, f: () => void): () => void {
  if (!abonnes.has(id)) abonnes.set(id, new Set());
  abonnes.get(id)!.add(f);
  return () => abonnes.get(id)?.delete(f);
}

// Un autre design : les toiles du précédent ne servent plus.
useEditeur.subscribe((s, avant) => {
  if (s.projet !== avant.projet) {
    for (const r of retouches.values()) clearTimeout(r.minuteur);
    retouches.clear();
    enDirect = null;
    dansLeMoteur = "";
    moteurLabo()?.oublier();
  }
});

function retouche(id: string, ressource: string): Retouche {
  let r = retouches.get(id);
  if (!r) {
    r = { toile: document.createElement("canvas"), ressource, dessine: "", version: 0, attentes: [] };
    retouches.set(id, r);
  }
  if (r.ressource !== ressource) {
    r.ressource = ressource;
    r.base = undefined;
    r.enCours = undefined;
    r.ratee = undefined;
    r.dessine = "";
  }
  marquerToile(r.toile, ressource);
  return r;
}

function finirAttentes(r: Retouche): void {
  const restent: Retouche["attentes"] = [];
  for (const a of r.attentes) {
    if (r.base?.cle === a.cle || r.ratee === a.cle) a.fini();
    else restent.push(a);
  }
  r.attentes = restent;
}

/** Demande au noyau la base des réglages `reglages` (pas pendant qu'on tire un curseur). */
function planifierBase(id: string, r: Retouche, reglages: ReglagesPhoto, tout_de_suite = false): void {
  const cle = cleReglages(reglages);
  if (r.base?.cle === cle || r.enCours === cle || r.ratee === cle) return;
  clearTimeout(r.minuteur);
  if (useLabo.getState().geste && !tout_de_suite) return;
  const projet = useEditeur.getState().projet;
  if (!projet) return;
  r.minuteur = setTimeout(
    () => {
      r.enCours = cle;
      const ressource = r.ressource;
      baseLabo(projet, ressource, reglages).then(
        (image) => {
          if (r.enCours === cle) r.enCours = undefined;
          if (r.ressource !== ressource) return;
          if (image) r.base = { cle, image, reglages };
          else r.ratee = cle;
          r.dessine = "";
          finirAttentes(r);
          prevenir(id);
        },
        (e) => {
          console.warn(`retouche de la photo : ${String(e)}`);
          if (r.enCours === cle) r.enCours = undefined;
          r.ratee = cle;
          finirAttentes(r);
        },
      );
    },
    tout_de_suite ? 0 : 120,
  );
}

/** Ce que la toile du moteur montre : quelle photo, avec quoi. */
let dansLeMoteur = "";
/** La photo dont on tire un curseur : la page affiche directement la toile du moteur, sans la
 *  recopier à chaque image (règle 11) ; on la recopie dans sa toile au relâchement. */
let enDirect: string | null = null;

function recopier(r: Retouche, largeur: number, hauteur: number, dessine: string): void {
  const moteur = moteurLabo()!;
  if (r.toile.width !== largeur || r.toile.height !== hauteur) {
    r.toile.width = largeur;
    r.toile.height = hauteur;
  }
  const ctx = r.toile.getContext("2d")!;
  ctx.clearRect(0, 0, largeur, hauteur);
  ctx.drawImage(moteur.toile, 0, 0);
  r.dessine = dessine;
  r.version++;
}

/** La photo en direct rend la toile du moteur : sa propre toile reçoit ce qui y est dessiné. */
function figerEnDirect(): void {
  if (!enDirect) return;
  const id = enDirect;
  enDirect = null;
  const r = retouches.get(id);
  const moteur = moteurLabo();
  if (r && moteur && dansLeMoteur.startsWith(`${id}|`)) recopier(r, moteur.toile.width, moteur.toile.height, dansLeMoteur.slice(id.length + 1));
  prevenir(id);
}

/**
 * Ce que la page dessine pour une photo : la source telle quelle sans réglages, sinon sa toile
 * retouchée, mise à jour tout de suite par le shader. La base du noyau (réglages voisins) arrive
 * ensuite ; en attendant, la précédente sert, corrigée en direct de l'écart des réglages d'un
 * pixel.
 */
export function imageRetouchee(id: string, ressource: string, source: HTMLImageElement, reglages: ReglagesPhoto | undefined, essai = false): CanvasImageSource {
  const n = normaliserReglages(reglages);
  if (!n && !essai) return source;
  const moteur = moteurLabo();
  if (!moteur) return source;
  const r = retouche(id, ressource);
  // Un préréglage survolé ne demande pas de base au noyau : la base des réglages du document
  // sert de référence, le shader montre l'écart des réglages d'un pixel.
  const voisins = aDesVoisins(n);
  if (voisins && !essai) planifierBase(id, r, n!);
  const base = essai ? r.base : voisins ? r.base : undefined;
  const largeur = source.naturalWidth || source.width;
  const hauteur = source.naturalHeight || source.height;
  const dessine = `${source.src}|${cleReglages(n)}|${base?.cle ?? ""}`;
  const { geste, ouvert } = useLabo.getState();
  const direct = essai || (geste && ouvert === id);
  if (enDirect && enDirect !== id) figerEnDirect();
  if (direct) {
    if (dansLeMoteur !== `${id}|${dessine}`) {
      moteur.dessiner(source, largeur, hauteur, n ?? {}, base);
      dansLeMoteur = `${id}|${dessine}`;
    }
    enDirect = id;
    marquerToile(moteur.toile, ressource);
    return moteur.toile;
  }
  if (enDirect === id) enDirect = null;
  if (r.dessine !== dessine) {
    if (dansLeMoteur !== `${id}|${dessine}`) {
      moteur.dessiner(source, largeur, hauteur, n!, base);
      dansLeMoteur = `${id}|${dessine}`;
    }
    recopier(r, largeur, hauteur, dessine);
  }
  return r.toile;
}

/** La toile retouchée d'une photo telle qu'elle s'affiche (histogramme, essais). */
export function toileRetouchee(id: string): HTMLCanvasElement | undefined {
  if (enDirect === id) return moteurLabo()?.toile;
  const r = retouches.get(id);
  return r && r.version > 0 ? r.toile : undefined;
}

/** Un curseur est relâché : la base du noyau peut être demandée. */
export function finGeste(): void {
  useLabo.setState({ geste: false });
  const id = useLabo.getState().ouvert;
  if (id) prevenir(id);
}

/** Attend que les photos retouchées d'une page aient leur base (avant un rendu hors écran :
 *  capture, vignette, export par la fenêtre). */
export async function assurerRetouches(page: PageEliot): Promise<void> {
  const attentes: Promise<void>[] = [];
  for (const e of page.elements) {
    if (e.type !== "image") continue;
    const n = normaliserReglages(e.reglages);
    if (!n || !aDesVoisins(n)) continue;
    const r = retouche(e.id, e.ressource);
    const cle = cleReglages(n);
    if (r.base?.cle === cle || r.ratee === cle) continue;
    attentes.push(new Promise<void>((fini) => r.attentes.push({ cle, fini })));
    planifierBase(e.id, r, n, true);
  }
  // Pas plus de vingt secondes : une base qui n'arrive pas ne bloque pas la capture.
  await Promise.race([Promise.all(attentes), new Promise((ok) => setTimeout(ok, 20_000))]);
}

/** Copie les réglages d'une photo (`id`, ou la seule photo choisie). */
export function copierReglages(id?: string): boolean {
  const etat = useEditeur.getState();
  const photos = (id ? elementsCourants(etat).filter((e) => e.id === id) : elementsSelectionnes(etat)).filter((e): e is ElementImage => e.type === "image");
  if (photos.length !== 1) return false;
  const reglages = normaliserReglages(photos[0].reglages);
  useLabo.setState({ copie: { reglages } });
  etat.notifier(reglages ? "Réglages copiés : Ctrl+Maj+V les colle sur les photos choisies." : "Cette photo n'a pas de retouche : coller remettra à zéro les photos choisies.");
  return true;
}

/** Colle les réglages copiés sur les photos `ids` (ou les photos choisies), en une seule étape
 *  d'annulation. Renvoie le nombre de photos retouchées. */
export function collerReglages(ids?: string[]): number {
  const { copie } = useLabo.getState();
  if (!copie) return 0;
  const etat = useEditeur.getState();
  const cibles = (ids ? elementsCourants(etat).filter((e) => ids.includes(e.id)) : elementsSelectionnes(etat)).filter((e) => e.type === "image" && !e.verrouille);
  if (!cibles.length) return 0;
  etat.modifierElements(Object.fromEntries(cibles.map((e) => [e.id, { reglages: copie.reglages } as Partial<ElementPage>])));
  etat.notifier(cibles.length === 1 ? "Réglages collés. Ctrl+Z pour revenir." : `Réglages collés sur ${cibles.length} photos. Ctrl+Z pour revenir.`);
  return cibles.length;
}

/**
 * Les vignettes des préréglages sur une photo : la photo réduite à `largeur` px, retouchée par
 * le shader (les réglages d'un pixel seulement : texture, clarté, voile, netteté et bruit ne
 * se voient qu'une fois appliqués), en images JPEG prêtes à afficher. Rien pendant qu'on tire
 * un curseur ou qu'on survole un préréglage : la page affiche alors la toile du moteur.
 */
export function vignettesRetouchees(source: HTMLImageElement, liste: { cle: string; reglages: ReglagesPhoto | undefined }[], largeur = 160): Map<string, string> | null {
  const moteur = moteurLabo();
  const { geste, essai } = useLabo.getState();
  if (!moteur || geste || essai || enDirect) return null;
  const l = largeur;
  const h = Math.max(1, Math.round(((source.naturalHeight || source.height) / Math.max(1, source.naturalWidth || source.width)) * l));
  const petite = document.createElement("canvas");
  petite.width = l;
  petite.height = h;
  petite.getContext("2d")!.drawImage(source, 0, 0, l, h);
  const sortie = new Map<string, string>();
  for (const { cle, reglages } of liste) {
    moteur.dessiner(petite, l, h, normaliserReglages(reglages) ?? {});
    sortie.set(cle, moteur.toile.toDataURL("image/jpeg", 0.85));
  }
  // La toile du moteur ne montre plus aucune photo de la page.
  dansLeMoteur = "";
  return sortie;
}

/** L'histogramme d'une toile : 256 cases pour le rouge, le vert, le bleu et la luminance, lues
 *  sur une copie de 256 px de large. */
export function histogramme(source: CanvasImageSource & { width: number; height: number }): { r: Uint32Array; v: Uint32Array; b: Uint32Array; l: Uint32Array } {
  const l = 256;
  const largeurSource = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const hauteurSource = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const h = Math.max(1, Math.round((hauteurSource / Math.max(1, largeurSource)) * l));
  const toile = document.createElement("canvas");
  toile.width = l;
  toile.height = h;
  const ctx = toile.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, l, h);
  const d = ctx.getImageData(0, 0, l, h).data;
  const sortie = { r: new Uint32Array(256), v: new Uint32Array(256), b: new Uint32Array(256), l: new Uint32Array(256) };
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    sortie.r[d[i]]++;
    sortie.v[d[i + 1]]++;
    sortie.b[d[i + 2]]++;
    sortie.l[Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2])]++;
  }
  return sortie;
}
