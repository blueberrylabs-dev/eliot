// La parole des voix du design (étape 4, lot 7) : l'analyse du noyau (où l'on parle) et la
// transcription de Whisper (ce qui est dit), gardées par ressource le temps du design ; puis les
// deux gestes qui s'en servent : couper les blancs d'un clip, et faire les sous-titres de la
// page. Chaque geste est une seule modification du document (un seul Ctrl+Z).

import { create } from "zustand";
import { creerTexte, mesurerHauteurTexte, nouvelId } from "../modele/fabriques";
import { estPageVideo } from "../modele/frise";
import { clipsACouper, couperEnMorceaux, fenetreACouper, partiesAGarder, tempsRetire, type AnalyseParole, type LangueParole, type OptionsBlancs } from "../modele/parole";
import {
  creerSousTitres,
  estSousTitre,
  finSansSousTitres,
  modeleDuSousTitre,
  modeleDuStyle,
  motsDeLaPage,
  poserSousTitres,
  sourcesDeParole,
  styleSousTitres,
  type ModeleSousTitres,
  type ReglagesSousTitres,
} from "../modele/sousTitres";
import type { ElementTexte, PageEliot, Temps } from "../modele/types";
import { analyserParole, annulerTranscription, etatWhisper, transcrireParole, type EtatWhisper } from "../pont/tauri";
import { assurerPolice } from "../polices";
import { dureesDe, pageCourante, useEditeur } from "./editeur";
import { useMarque } from "./marque";
import { kitVide } from "../modele/marque";

const CLE_LANGUE = "eliot-langue-parole";

function lireLangue(): LangueParole {
  try {
    const v = localStorage.getItem(CLE_LANGUE);
    return v === "en" || v === "auto" ? v : "fr";
  } catch {
    return "fr";
  }
}

/** Ce qui tourne en ce moment : l'analyse ou la transcription de la ressource `rang` sur
 *  `total`, et sa part faite (0 à 1). */
export interface TravailParole {
  etape: "analyse" | "transcription";
  ressource: string;
  nom: string;
  rang: number;
  total: number;
  avancement: number;
}

interface EtatParole {
  /** Whisper sur ce poste ; `null` tant qu'on ne l'a pas demandé (ou hors de la fenêtre). */
  whisper: EtatWhisper | null;
  /** L'analyse de chaque ressource du design, quand elle est connue. */
  analyses: Record<string, AnalyseParole>;
  travail: TravailParole | null;
  langue: LangueParole;
  verifierWhisper: () => Promise<EtatWhisper | null>;
  definirLangue: (langue: LangueParole) => void;
  /** Où l'on parle (rapide, gardé). */
  analyser: (ressource: string) => Promise<AnalyseParole>;
  /** Ce qui est dit, ressource après ressource ; `forcer` refait les transcriptions. */
  transcrire: (ressources: string[], forcer?: boolean) => Promise<Record<string, AnalyseParole>>;
  annuler: () => void;
}

let annule = false;
const analysesEnCours = new Map<string, Promise<AnalyseParole>>();

/** Les noms propres que Whisper doit bien écrire : le nom du kit de marque, s'il a été donné. */
async function nomsAEcrire(): Promise<string[]> {
  const marque = useMarque.getState();
  if (!marque.charge) await marque.charger().catch(() => undefined);
  const nom = useMarque.getState().kit.nom.trim();
  return nom && nom !== kitVide().nom ? [nom] : [];
}

export const useParole = create<EtatParole>((set, get) => ({
  whisper: null,
  analyses: {},
  travail: null,
  langue: lireLangue(),

  async verifierWhisper() {
    try {
      const w = await etatWhisper();
      set({ whisper: w });
      return w;
    } catch {
      set({ whisper: null });
      return null;
    }
  },

  definirLangue(langue) {
    set({ langue });
    try {
      localStorage.setItem(CLE_LANGUE, langue);
    } catch {
      // Le choix vaut le temps de la session.
    }
  },

  async analyser(ressource) {
    const connue = get().analyses[ressource];
    if (connue) return connue;
    const projet = useEditeur.getState().projet;
    if (!projet) throw new Error("aucun design ouvert");
    // Deux demandes à la fois (l'aperçu qui se refait) ne font qu'une analyse.
    const cle = `${projet.rayon}/${projet.id}/${ressource}`;
    let promesse = analysesEnCours.get(cle);
    if (!promesse) {
      promesse = analyserParole(projet, ressource).finally(() => analysesEnCours.delete(cle));
      analysesEnCours.set(cle, promesse);
    }
    const a = await promesse;
    if (useEditeur.getState().projet === projet && !get().analyses[ressource]) set((s) => ({ analyses: { ...s.analyses, [ressource]: a } }));
    return get().analyses[ressource] ?? a;
  },

  async transcrire(ressources, forcer = false) {
    const projet = useEditeur.getState().projet;
    if (!projet) throw new Error("aucun design ouvert");
    if (get().travail) throw new Error("une transcription est déjà en cours");
    annule = false;
    const resultats: Record<string, AnalyseParole> = {};
    const langue = get().langue;
    const total = ressources.length;
    const noms = await nomsAEcrire();
    try {
      for (const [rang, ressource] of ressources.entries()) {
        if (annule) throw new Error("transcription annulée");
        const connue = get().analyses[ressource];
        if (!forcer && connue?.transcription && (langue === "auto" || connue.transcription.langue === langue)) {
          resultats[ressource] = connue;
          continue;
        }
        const nom = useEditeur.getState().ressources[ressource]?.nom ?? "son";
        set({ travail: { etape: "transcription", ressource, nom, rang, total, avancement: 0 } });
        const a = await transcrireParole(projet, ressource, langue, noms, forcer, (p) => set((s) => (s.travail?.ressource === ressource ? { travail: { ...s.travail, avancement: p } } : {})));
        if (useEditeur.getState().projet !== projet) throw new Error("le design a changé pendant la transcription");
        resultats[ressource] = a;
        set((s) => ({ analyses: { ...s.analyses, [ressource]: a } }));
      }
      return resultats;
    } finally {
      set({ travail: null });
    }
  },

  annuler() {
    annule = true;
    annulerTranscription();
  },
}));

// Un autre design : rien de l'ancien ne sert plus.
useEditeur.subscribe((s, avant) => {
  if (s.projet !== avant.projet) {
    if (useParole.getState().travail) useParole.getState().annuler();
    useParole.setState({ analyses: {} });
  }
});

/** Whisper est-il prêt (programme et modèle) ? Sinon, la phrase à montrer. */
export function whisperPret(w: EtatWhisper | null): string | null {
  if (!w) return "la transcription ne se fait que dans la fenêtre Eliot";
  if (!w.installe) return "Whisper n'est pas installé (commande 18 du CLAUDE.md)";
  if (!w.modele) return "le modèle de Whisper manque (commande 19 du CLAUDE.md)";
  return null;
}

// ---- Les sous-titres ----

/** Les ressources des sous-titres posés sur la page. */
const sourcesDesSousTitres = (p: PageEliot): Set<string> => new Set(p.elements.filter(estSousTitre).map((e) => e.sousTitre.source ?? ""));

/**
 * Refait, dans `page`, les sous-titres des ressources `touchees` d'après les clips tels qu'ils
 * sont maintenant (après une coupe), avec l'aspect des anciens. Rien si la page n'en a pas, ou si
 * une transcription manque.
 */
function refaireSousTitres(page: PageEliot, touchees: ReadonlySet<string>): { page: PageEliot; refaits: boolean } {
  const anciens = page.elements.filter((e): e is ElementTexte & { sousTitre: NonNullable<ElementTexte["sousTitre"]> } => estSousTitre(e) && touchees.has(e.sousTitre.source ?? ""));
  if (anciens.length === 0) return { page, refaits: false };
  const editeur = useEditeur.getState();
  const analyses = useParole.getState().analyses;
  const sources = sourcesDeParole(page, editeur.ressources).filter((s) => touchees.has(s.ressource));
  if (sources.some((s) => !analyses[s.ressource]?.transcription)) return { page, refaits: false };
  const modele = modeleDuSousTitre(anciens[0]);
  const mots = motsDeLaPage(sources, analyses);
  const nouveaux = creerSousTitres(mots, modele, mesurerHauteurTexte, () => nouvelId(), finSansSousTitres(page));
  return { page: poserSousTitres(page, nouveaux, touchees, dureesDe(editeur.ressources)), refaits: true };
}

/** Le modèle d'un style de sous-titres pour la page (police chargée d'abord). */
async function modelePour(reglages: ReglagesSousTitres): Promise<ModeleSousTitres> {
  const style = styleSousTitres(reglages.style);
  await assurerPolice(style.police, style.gras, false);
  const format = useEditeur.getState().document.format;
  const taille = Math.round((style.taille * format.largeur) / 1080);
  const base = creerTexte(format, { texte: "Sous-titre", taillePolice: taille, gras: style.gras, police: style.police, alignement: "center", couleur: style.couleur, majuscules: style.majuscules, ...style.effets(taille) });
  return modeleDuStyle(format, style, base, reglages.centre);
}

/**
 * Les sous-titres de la page : la voix de chaque clip qu'on entend est transcrite (une fois),
 * puis les mots sont groupés et posés sur une piste au-dessus de tout, à la place des anciens
 * sous-titres. Renvoie le nombre de sous-titres posés.
 */
export async function creerLesSousTitres(reglages: ReglagesSousTitres): Promise<number> {
  const editeur = useEditeur.getState();
  const page = pageCourante(editeur);
  if (!estPageVideo(page)) throw new Error("les sous-titres se font sur une page vidéo");
  const sources = sourcesDeParole(page, editeur.ressources);
  if (sources.length === 0) throw new Error("aucune voix sur cette page : une vidéo qu'on entend, ou un son au rôle Voix");
  const parole = useParole.getState();
  const w = parole.whisper ?? (await parole.verifierWhisper());
  const manque = whisperPret(w);
  if (manque) throw new Error(manque);
  const pageId = editeur.pageActive;
  const analyses = { ...useParole.getState().analyses, ...(await parole.transcrire([...new Set(sources.map((s) => s.ressource))])) };
  const modele = await modelePour(reglages);
  const apres = useEditeur.getState();
  if (apres.pageActive !== pageId) throw new Error("la page a changé pendant la transcription");
  const actuelle = pageCourante(apres);
  const mots = motsDeLaPage(sourcesDeParole(actuelle, apres.ressources), analyses, { hesitations: reglages.hesitations });
  if (mots.length === 0) throw new Error("aucun mot reconnu dans la voix de cette page");
  const nouveaux = creerSousTitres(mots, modele, mesurerHauteurTexte, () => nouvelId(), finSansSousTitres(actuelle));
  apres.appliquerPage((p) => poserSousTitres(p, nouveaux, null, dureesDe(useEditeur.getState().ressources)), "sous-titres");
  return nouveaux.length;
}

// ---- Couper les blancs ----

export interface BilanCoupe {
  morceaux: number;
  /** Le temps retiré, en ms du fichier. */
  retire: number;
  sousTitres: boolean;
}

/** Ce que la coupe ferait d'un clip, sans rien toucher (l'aperçu de la bulle) : les hésitations
 *  ne comptent que si la voix est déjà transcrite (`transcrit`). */
export async function apercuCoupe(id: string, options: OptionsBlancs): Promise<{ garder: Temps[]; retire: number; fenetre: Temps; transcrit: boolean } | null> {
  const editeur = useEditeur.getState();
  const cible = clipsACouper(pageCourante(editeur), id);
  if (!cible) return null;
  const parole = useParole.getState();
  const analyse = await parole.analyser(cible.ressource);
  const avecMots = useParole.getState().analyses[cible.ressource] ?? analyse;
  const fenetre = fenetreACouper(cible, dureesDe(editeur.ressources));
  const transcrit = !!avecMots.transcription;
  const garder = partiesAGarder(fenetre, avecMots, { ...options, hesitations: options.hesitations && transcrit });
  return { garder, retire: tempsRetire(fenetre, garder), fenetre, transcrit };
}

/**
 * Coupe les blancs (et, si demandé, les hésitations) du clip `id` : une vidéo, un son, ou le son
 * détaché d'une vidéo (les deux sont coupés ensemble). Les sous-titres de cette voix sont refaits
 * pareils. Renvoie le bilan, ou `null` s'il n'y avait rien à couper.
 */
export async function couperLesBlancs(id: string, options: OptionsBlancs): Promise<BilanCoupe | null> {
  const editeur = useEditeur.getState();
  const page = pageCourante(editeur);
  const cible = clipsACouper(page, id);
  if (!cible) throw new Error("seuls une vidéo ou un son (pas une musique qui boucle) se coupent");
  const parole = useParole.getState();
  let analyse = await parole.analyser(cible.ressource);
  if (options.hesitations) {
    const w = parole.whisper ?? (await parole.verifierWhisper());
    const manque = whisperPret(w);
    if (manque) throw new Error(`les hésitations demandent la transcription : ${manque}`);
    analyse = (await parole.transcrire([cible.ressource]))[cible.ressource] ?? analyse;
  }
  const apres = useEditeur.getState();
  const actuelle = pageCourante(apres);
  const encore = clipsACouper(actuelle, id);
  if (!encore || apres.pageActive !== editeur.pageActive) throw new Error("le clip a changé pendant l'analyse");
  const durees = dureesDe(apres.ressources);
  const fenetre = fenetreACouper(encore, durees);
  const garder = partiesAGarder(fenetre, analyse, options);
  if (garder.length === 0) throw new Error("ce clip n'est que du silence : rien ne resterait");
  const retire = tempsRetire(fenetre, garder);
  if (garder.length === 1 && retire < 1) return null;
  let morceaux: string[] = [];
  let sousTitres = false;
  apres.appliquerPage((p) => {
    const r = couperEnMorceaux(p, id, garder, durees, (prefixe) => nouvelId(prefixe));
    morceaux = r.morceaux;
    if (!sourcesDesSousTitres(r.page).has(encore.ressource)) return r.page;
    const refaits = refaireSousTitres(r.page, new Set([encore.ressource]));
    sousTitres = refaits.refaits;
    return refaits.page;
  }, `blancs:${id}`);
  if (encore.video) useEditeur.getState().selectionnerSeul(morceaux[0]);
  else useEditeur.getState().selectionnerSons(morceaux.slice(0, 1));
  return { morceaux: morceaux.length, retire, sousTitres };
}
