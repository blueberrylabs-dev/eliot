// Les aides pour apprendre (étape 7, lot 3) : ce que l'on montre par-dessus la page (règles,
// grille, grille des tiers, marges de sécurité ; les zones sûres restent dans `etat/temps`) et
// les alertes de lisibilité des textes de la page affichée. Un état de la vue : ni dans le
// document, ni dans l'historique, ni dans un export. Les choix d'affichage sont gardés par le
// navigateur, comme la hauteur de la frise.

import { create } from "zustand";
import type { Alerte } from "../modele/lisibilite";

export type CleAide = "regles" | "grille" | "tiers" | "marges" | "alertes";

interface Choix {
  regles: boolean;
  grille: boolean;
  /** Pas de la grille en pixels de la page ; `null` : celui du format (60 px, ou 10 mm). */
  pasGrille: number | null;
  tiers: boolean;
  marges: boolean;
  /** Les alertes de lisibilité montrées sur la page (elles se calculent quand même pour le
   *  pont). */
  alertes: boolean;
}

interface EtatAides extends Choix {
  /** Les alertes de la page affichée, à jour au dernier calcul. */
  liste: Alerte[];
  /** La page qu'elles décrivent. */
  mesuree: string | null;
  calcul: boolean;
  basculer: (cle: CleAide, valeur?: boolean) => void;
  definirPas: (pas: number | null) => void;
  publierAlertes: (liste: Alerte[], mesuree: string | null) => void;
  definirCalcul: (calcul: boolean) => void;
}

const CLE = "eliot-aides";
const DEFAUT: Choix = { regles: false, grille: false, pasGrille: null, tiers: false, marges: false, alertes: true };

function choixGardes(): Choix {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? "{}") as Partial<Record<keyof Choix, unknown>>;
    const oui = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
    const pas = typeof brut.pasGrille === "number" && Number.isFinite(brut.pasGrille) && brut.pasGrille >= 1 ? brut.pasGrille : null;
    return { regles: oui(brut.regles, DEFAUT.regles), grille: oui(brut.grille, DEFAUT.grille), pasGrille: pas, tiers: oui(brut.tiers, DEFAUT.tiers), marges: oui(brut.marges, DEFAUT.marges), alertes: oui(brut.alertes, DEFAUT.alertes) };
  } catch {
    return { ...DEFAUT };
  }
}

function garder(c: Choix) {
  try {
    localStorage.setItem(CLE, JSON.stringify(c));
  } catch {
    // Stockage indisponible : les choix valent le temps de la session.
  }
}

const choixDe = (s: Choix): Choix => ({ regles: s.regles, grille: s.grille, pasGrille: s.pasGrille, tiers: s.tiers, marges: s.marges, alertes: s.alertes });

export const useAides = create<EtatAides>((set, get) => ({
  ...choixGardes(),
  liste: [],
  mesuree: null,
  calcul: false,
  basculer(cle, valeur) {
    set({ [cle]: valeur ?? !get()[cle] } as Partial<Choix>);
    garder(choixDe(get()));
  },
  definirPas(pas) {
    set({ pasGrille: pas === null ? null : Math.max(1, Math.round(pas * 100) / 100) });
    garder(choixDe(get()));
  },
  publierAlertes(liste, mesuree) {
    set({ liste, mesuree });
  },
  definirCalcul(calcul) {
    if (calcul !== get().calcul) set({ calcul });
  },
}));
