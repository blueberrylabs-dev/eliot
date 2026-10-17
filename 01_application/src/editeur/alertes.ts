// Les alertes de lisibilité (étape 7, lot 3), calculées au repos : pour chaque texte de la page
// affichée, sa taille vue (sur un téléphone tenu droit, ou imprimée) et son contraste contre ce
// qui est derrière lui, mesuré sur deux petits rendus hors écran de sa zone : la page jusqu'à
// lui (son surlignage compris), et ses lettres seules, tous montés d'un coup. Un texte qui n'a
// pas changé, ni rien sous lui, garde sa mesure (cache). Les alertes vont au store des aides ; le pont les demande
// à jour (`alertesAJour`).

import { pageCourante, useEditeur } from "../etat/editeur";
import { useAides } from "../etat/aides";
import { useTemps } from "../etat/temps";
import { visibleA } from "../modele/frise";
import { boiteEnglobante } from "../modele/geometrie";
import { alerteContraste, alerteTaille, hexEnRgb, lecturePage, mesurerContraste, seuilContraste, type Alerte, type MesureContraste, type Rgb } from "../modele/lisibilite";
import type { ElementPage, ElementTexte, Format, PageEliot } from "../modele/types";
import { rendreZones, type DemandeZone } from "../export/rendu";
import { surGeste } from "./scene";

/** Le délai de repos après un changement, avant de mesurer. */
const REPOS_MS = 900;
/** Les lettres se rendent à environ 24 px de haut : assez pour lire leurs jambages. */
const HAUTEUR_LETTRE = 24;
const COTE_MAX = 1600;
const CACHE_MAX = 400;

const cache = new Map<string, MesureContraste | null>();

/** L'instant où mesurer un texte d'une page vidéo : la tête de lecture s'il s'y voit, sinon le
 *  milieu de son temps. */
function instantDe(page: PageEliot, el: ElementPage, tete: number): number | undefined {
  if (page.duree === undefined || !el.temps) return undefined;
  return visibleA(el, tete) ? tete : Math.round((el.temps.debut + el.temps.fin) / 2);
}

/** Ce qu'il faut rendre pour mesurer un texte : sa zone, à quelle finesse, la page derrière lui
 *  (jusqu'à lui, son surlignage compris) et ses lettres seules. `null` : hors de la page. */
function preparer(page: PageEliot, format: Format, rang: number, instant: number | undefined): { derriere: DemandeZone; lettres: DemandeZone; rayon: number; contour: Rgb | null } | null {
  const el = page.elements[rang] as ElementTexte;
  const fs = Math.max(1, el.taillePolice);
  const marge = fs * 0.2;
  const b = boiteEnglobante(el);
  const x0 = Math.max(0, Math.floor(b.x - marge));
  const y0 = Math.max(0, Math.floor(b.y - marge));
  const x1 = Math.min(format.largeur, Math.ceil(b.x + b.largeur + marge));
  const y1 = Math.min(format.hauteur, Math.ceil(b.y + b.hauteur + marge));
  if (x1 - x0 < 1 || y1 - y0 < 1) return null;
  const zone = { x: x0, y: y0, largeur: x1 - x0, hauteur: y1 - y0 };
  const ratio = Math.min(1, Math.max(0.02, HAUTEUR_LETTRE / fs), COTE_MAX / zone.largeur, COTE_MAX / zone.hauteur);
  // Le texte sans ses effets, sans mouvement, sans opacité : ses lettres seules.
  const nu: ElementTexte = { ...el, ombre: undefined, contour: undefined, surlignage: undefined, opacite: 1, visible: true, cles: undefined, animations: undefined };
  // Ce qui est derrière : la page jusqu'au texte, et son surlignage (sans les lettres).
  const surligne: ElementTexte | null = el.surlignage ? { ...nu, couleur: "rgba(0,0,0,0)", surlignage: el.surlignage } : null;
  return {
    derriere: { page: { ...page, elements: [...page.elements.slice(0, rang), ...(surligne ? [surligne] : [])] }, zone, pixelRatio: ratio, instant },
    lettres: { page: { ...page, elements: [nu] }, zone, pixelRatio: ratio, instant, transparent: true },
    rayon: Math.max(1, Math.round(fs * ratio * 0.12)),
    contour: el.contour && el.contour.epaisseur >= Math.max(1, fs * 0.03) ? hexEnRgb(el.contour.couleur) : null,
  };
}

/** Les alertes d'une page : taille et contraste de chacun de ses textes visibles. Les textes à
 *  mesurer (ceux que le cache ne connaît pas) se rendent tous d'un coup. */
export async function calculerAlertes(page: PageEliot, format: Format, tete: number): Promise<Alerte[]> {
  const lecture = lecturePage(format);
  const textes = page.elements.map((el, rang) => ({ el, rang })).filter((x): x is { el: ElementTexte; rang: number } => x.el.type === "texte" && x.el.visible && !!x.el.texte.trim());
  const cles = textes.map(({ el, rang }) => {
    const instant = instantDe(page, el, tete);
    return { instant, cle: JSON.stringify([format, page.fond, page.duree !== undefined ? instant : null, page.elements.slice(0, rang + 1)]) };
  });
  // Les mesures qui manquent.
  const aFaire = textes.map((t, i) => ({ ...t, ...cles[i] })).filter((t) => !cache.has(t.cle));
  const preps = aFaire.map((t) => ({ t, p: preparer(page, format, t.rang, t.instant) }));
  const demandes = preps.flatMap(({ p }) => (p ? [p.derriere, p.lettres] : []));
  const pixels = await rendreZones(format, page, demandes, { sansEffets: true });
  let k = 0;
  for (const { t, p } of preps) {
    let resultat: MesureContraste | null = null;
    if (p) {
      const [fond, texte] = [pixels[k], pixels[k + 1]];
      k += 2;
      if (fond.width === texte.width && fond.height === texte.height) resultat = mesurerContraste(fond.data, texte.data, fond.width, fond.height, { rayon: p.rayon, opacite: t.el.opacite, contour: p.contour });
    }
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(t.cle, resultat);
  }
  const alertes: Alerte[] = [];
  textes.forEach(({ el }, i) => {
    const taille = alerteTaille(el.id, el.taillePolice, lecture);
    if (taille) alertes.push(taille);
    const mesure = cache.get(cles[i].cle);
    const contraste = mesure && alerteContraste(el.id, mesure, seuilContraste(el.taillePolice, el.gras, lecture));
    if (contraste) alertes.push(contraste);
  });
  return alertes;
}

let enCours: Promise<Alerte[]> | null = null;

/** Mesure la page affichée et publie ses alertes. Si elle change pendant la mesure, mesure de
 *  nouveau. */
async function mesurerPageAffichee(): Promise<Alerte[]> {
  const aides = useAides.getState();
  for (let essai = 0; essai < 3; essai++) {
    const etat = useEditeur.getState();
    if (!etat.projet || etat.vue !== "editeur") {
      aides.publierAlertes([], null);
      return [];
    }
    const page = pageCourante(etat);
    const format = etat.document.format;
    const tete = useTemps.getState().tete;
    aides.definirCalcul(true);
    try {
      const liste = await calculerAlertes(page, format, tete);
      if (pageCourante(useEditeur.getState()) === page && useEditeur.getState().document.format === format) {
        aides.publierAlertes(liste, page.id);
        return liste;
      }
    } finally {
      aides.definirCalcul(false);
    }
  }
  return useAides.getState().liste;
}

/** Les alertes de la page affichée, à jour (le pont les lit dans `etat`). */
export async function alertesAJour(): Promise<Alerte[]> {
  while (enCours) await enCours.catch(() => undefined);
  enCours = mesurerPageAffichee();
  try {
    return await enCours;
  } finally {
    enCours = null;
  }
}

/** Surveille le document : au repos, après un changement de la page affichée, ses alertes se
 *  recalculent. Pas pendant la lecture ni pendant un geste. Renvoie de quoi arrêter. */
export function surveillerAlertes(): () => void {
  let minuterie: ReturnType<typeof setTimeout> | null = null;
  let geste = false;
  const planifier = () => {
    if (minuterie) clearTimeout(minuterie);
    minuterie = setTimeout(() => {
      minuterie = null;
      if (geste || useTemps.getState().joue) return planifier();
      void alertesAJour().catch(() => undefined);
    }, REPOS_MS);
  };
  let pagePrecedente: PageEliot | null = null;
  let formatPrecedent: Format | null = null;
  const finEditeur = useEditeur.subscribe((s) => {
    if (s.vue !== "editeur") return;
    const page = pageCourante(s);
    if (page === pagePrecedente && s.document.format === formatPrecedent) return;
    pagePrecedente = page;
    formatPrecedent = s.document.format;
    planifier();
  });
  // Sur une page vidéo, la mesure suit la tête de lecture quand elle s'arrête.
  let tetePrecedente = useTemps.getState().tete;
  const finTemps = useTemps.subscribe((t) => {
    if (t.joue || t.tete === tetePrecedente) return;
    tetePrecedente = t.tete;
    if (pageCourante(useEditeur.getState()).duree !== undefined) planifier();
  });
  const finGeste = surGeste((actif) => {
    geste = actif;
  });
  planifier();
  return () => {
    if (minuterie) clearTimeout(minuterie);
    finEditeur();
    finTemps();
    finGeste();
  };
}
