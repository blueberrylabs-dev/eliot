// La tête de lecture d'une page vidéo (étape 4, lot 2) : où l'on est dans le temps, si ça
// joue, et comment la frise est montrée. C'est un état de la vue, pas du document : il
// n'entre ni dans l'historique ni dans le fichier. Un store à part, parce qu'il change
// soixante fois par seconde pendant la lecture et que le reste de l'interface n'a pas à le
// suivre. L'horloge qui le fait avancer est dans `editeur/frise/horloge.ts`.

import { create } from "zustand";

export const PX_PAR_SECONDE_MIN = 8;
export const PX_PAR_SECONDE_MAX = 600;
export const HAUTEUR_FRISE_MIN = 150;
export const HAUTEUR_FRISE_DEFAUT = 260;

const CLE_HAUTEUR = "eliot-hauteur-frise";
function hauteurGardee(): number {
  try {
    const n = Number(localStorage.getItem(CLE_HAUTEUR));
    return Number.isFinite(n) && n >= HAUTEUR_FRISE_MIN ? n : HAUTEUR_FRISE_DEFAUT;
  } catch {
    return HAUTEUR_FRISE_DEFAUT;
  }
}

interface EtatTemps {
  /** Millisecondes depuis le début de la page. */
  tete: number;
  joue: boolean;
  /** Zoom de la frise ; `null` : toute la page tient dans la largeur. */
  pxParSeconde: number | null;
  hauteurFrise: number;
  /** Frise repliée : seule sa barre reste. */
  repliee: boolean;
  /** La lecture s'arrête d'elle-même à cet instant (aperçu d'une transition). */
  arret: number | null;
  allerA: (t: number) => void;
  /** Lit de `debut` à `fin`, puis s'arrête. */
  lireJusqua: (debut: number, fin: number) => void;
  lire: () => void;
  pause: () => void;
  basculerLecture: () => void;
  definirZoom: (pxParSeconde: number | null) => void;
  definirHauteur: (hauteur: number) => void;
  basculerRepli: () => void;
  /** Retour au début, à l'arrêt (nouveau design, autre page). */
  remettre: () => void;
}

export const useTemps = create<EtatTemps>((set, get) => ({
  tete: 0,
  joue: false,
  pxParSeconde: null,
  hauteurFrise: hauteurGardee(),
  repliee: false,
  arret: null,
  allerA(t) {
    const tete = Math.max(0, Math.round(t));
    if (tete !== get().tete) set({ tete });
  },
  lireJusqua(debut, fin) {
    set({ joue: false, arret: null });
    set({ tete: Math.max(0, Math.round(debut)) });
    set({ joue: true, arret: Math.round(fin) });
  },
  lire() {
    if (!get().joue) set({ joue: true, arret: null });
  },
  pause() {
    if (get().joue) set({ joue: false, arret: null });
  },
  basculerLecture() {
    set({ joue: !get().joue, arret: null });
  },
  definirZoom(pxParSeconde) {
    set({ pxParSeconde: pxParSeconde === null ? null : Math.max(PX_PAR_SECONDE_MIN, Math.min(PX_PAR_SECONDE_MAX, pxParSeconde)) });
  },
  definirHauteur(hauteur) {
    const h = Math.round(Math.max(HAUTEUR_FRISE_MIN, hauteur));
    set({ hauteurFrise: h });
    try {
      localStorage.setItem(CLE_HAUTEUR, String(h));
    } catch {
      // Stockage indisponible : la hauteur vaut le temps de la session.
    }
  },
  basculerRepli() {
    set({ repliee: !get().repliee });
  },
  remettre() {
    set({ tete: 0, joue: false, pxParSeconde: null, arret: null });
  },
}));
