// La prise de voix au micro (étape 4, lot 6), prise par prise. Le noyau écoute le micro et
// écrit la prise ; la fenêtre montre le niveau, compte « 3, 2, 1 », fait avancer la tête de
// lecture pendant qu'on parle, puis pose la prise dans la frise, au rôle voix, là où la tête
// était au top.
//
// Déroulé : « fermé » → ouvrir() → « prêt » (le niveau s'affiche) → enregistrer() →
// « compte » (3 s, déjà enregistrées : rien ne se perd si l'on parle trop tôt) → top : la tête
// part, « enregistre » → arreter() (bouton, Espace, ou la lecture qui s'arrête) → la prise est
// rangée et posée → « prêt » pour la suivante. Échap abandonne la prise en cours.

import { create } from "zustand";
import { estPageVideo } from "../modele/frise";
import { VOIX_NETTE } from "../modele/voix";
import { abandonnerPrise, arreterPrise, commencerPrise, fermerMicro, listerMicros, marquerPrise, ouvrirMicro, type Micro, type NiveauMicro } from "../pont/tauri";
import { pageCourante, useEditeur } from "./editeur";
import { useTemps } from "./temps";

export type PhasePrise = "ferme" | "ouverture" | "pret" | "compte" | "enregistre" | "rangement";

/** Le compte à rebours, en secondes. */
export const COMPTE_A_REBOURS = 3;
/** Une prise plus courte (après le top) n'est pas gardée : un clic par mégarde. */
export const PRISE_MIN = 300;

const CLE_MICRO = "eliot-micro";
const CLE_OPTIONS = "eliot-prise-options";

function lire<T>(cle: string, defaut: T): T {
  try {
    const v = localStorage.getItem(cle);
    return v === null ? defaut : (JSON.parse(v) as T);
  } catch {
    return defaut;
  }
}
function garder(cle: string, valeur: unknown) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    // Stockage indisponible : le choix vaut le temps de la session.
  }
}

interface EtatPrise {
  phase: PhasePrise;
  micros: Micro[];
  /** Le micro choisi (nom PulseAudio). */
  source: string;
  niveau: NiveauMicro | null;
  /** La crête la plus haute de la prise en cours (dBFS), pour dire « trop fort ». */
  creteMax: number;
  erreur: string | null;
  /** Le chiffre affiché pendant le compte à rebours. */
  compte: number;
  /** Le son du montage se tait pendant la prise (sans casque, le micro l'entendrait). */
  muet: boolean;
  /** La prise se pose avec « Voix nette ». */
  voixNette: boolean;
  /** L'instant de la page où la prise commence (la tête au top). */
  debut: number;
  ouvrir: () => Promise<void>;
  fermer: () => void;
  choisirMicro: (nom: string) => Promise<void>;
  definirMuet: (muet: boolean) => void;
  definirVoixNette: (voixNette: boolean) => void;
  enregistrer: () => Promise<void>;
  arreter: () => Promise<void>;
  abandonner: () => void;
}

let minuteur: ReturnType<typeof setTimeout> | null = null;
/** Chaque ouverture du micro a son numéro : un niveau arrivé d'un micro déjà fermé est ignoré. */
let ouverture = 0;
const options = lire(CLE_OPTIONS, { muet: true, voixNette: true });

export const usePrise = create<EtatPrise>((set, get) => {
  const surNiveau = (n: NiveauMicro) => {
    if (n.erreur) {
      // Le micro s'est arrêté (débranché, refusé) : la prise en cours est perdue.
      const enCours = ["compte", "enregistre"].includes(get().phase);
      if (minuteur) clearTimeout(minuteur);
      set({ phase: "ferme", niveau: null, erreur: `Le micro s'est arrêté : ${n.erreur}` });
      if (enCours) {
        useTemps.getState().definirPrise(null);
        useTemps.getState().pause();
      }
      return;
    }
    set((s) => ({ niveau: n, creteMax: s.phase === "enregistre" ? Math.max(s.creteMax, n.crete) : s.creteMax }));
  };

  const fin = () => {
    if (minuteur) clearTimeout(minuteur);
    minuteur = null;
    useTemps.getState().definirPrise(null);
  };

  return {
    phase: "ferme",
    micros: [],
    source: lire(CLE_MICRO, ""),
    niveau: null,
    creteMax: -90,
    erreur: null,
    compte: COMPTE_A_REBOURS,
    muet: options.muet,
    voixNette: options.voixNette,
    debut: 0,

    async ouvrir() {
      if (get().phase !== "ferme") return;
      set({ phase: "ouverture", erreur: null, niveau: null });
      try {
        const micros = await listerMicros();
        if (micros.length === 0) throw new Error("aucun micro trouvé");
        const voulu = get().source;
        const source = micros.some((m) => m.nom === voulu) ? voulu : (micros.find((m) => m.defaut) ?? micros[0]).nom;
        const n = ++ouverture;
        await ouvrirMicro(source, (x) => n === ouverture && surNiveau(x));
        if (get().phase !== "ouverture") {
          // Fermé entre-temps.
          fermerMicro();
          return;
        }
        set({ phase: "pret", micros, source });
      } catch (e) {
        set({ phase: "ferme", erreur: String(e instanceof Error ? e.message : e) });
      }
    },

    fermer() {
      if (get().phase === "ferme") return;
      if (["compte", "enregistre"].includes(get().phase)) get().abandonner();
      fin();
      ouverture++;
      fermerMicro();
      set({ phase: "ferme", niveau: null });
    },

    async choisirMicro(nom) {
      if (get().phase !== "pret" || nom === get().source) return;
      garder(CLE_MICRO, nom);
      set({ source: nom, phase: "ouverture", niveau: null });
      try {
        const n = ++ouverture;
        await ouvrirMicro(nom, (x) => n === ouverture && surNiveau(x));
        set({ phase: "pret" });
      } catch (e) {
        set({ phase: "ferme", erreur: String(e instanceof Error ? e.message : e) });
      }
    },

    definirMuet(muet) {
      set({ muet });
      garder(CLE_OPTIONS, { muet, voixNette: get().voixNette });
    },

    definirVoixNette(voixNette) {
      set({ voixNette });
      garder(CLE_OPTIONS, { muet: get().muet, voixNette });
    },

    async enregistrer() {
      if (get().phase !== "pret") return;
      const editeur = useEditeur.getState();
      if (!editeur.projet) return;
      // La prise se cale sur la frise : une page fixe devient une vidéo.
      if (!estPageVideo(pageCourante(editeur))) editeur.basculerPageVideo(true);
      useTemps.getState().pause();
      set({ phase: "compte", compte: COMPTE_A_REBOURS, erreur: null, creteMax: -90 });
      try {
        await commencerPrise();
      } catch (e) {
        set({ phase: "pret", erreur: String(e instanceof Error ? e.message : e) });
        return;
      }
      const tic = (reste: number) => {
        if (get().phase !== "compte") return;
        if (reste > 0) {
          set({ compte: reste });
          minuteur = setTimeout(() => tic(reste - 1), 1000);
          return;
        }
        // Top : le clip commencera ici ; la tête part au même instant.
        minuteur = null;
        const temps = useTemps.getState();
        set({ phase: "enregistre", debut: temps.tete });
        void marquerPrise().catch(() => undefined);
        temps.definirPrise({ muet: get().muet });
        temps.lire();
      };
      tic(COMPTE_A_REBOURS);
    },

    async arreter() {
      const phase = get().phase;
      if (phase === "compte") {
        get().abandonner();
        return;
      }
      if (phase !== "enregistre") return;
      set({ phase: "rangement" });
      fin();
      useTemps.getState().pause();
      const editeur = useEditeur.getState();
      const projet = editeur.projet;
      if (!projet) return;
      const numero = 1 + Object.values(editeur.ressources).filter((r) => r.son?.origine === "micro").length;
      try {
        const prise = await arreterPrise(projet, `Prise ${numero}`);
        if (useEditeur.getState().projet !== projet) throw new Error("le design a changé pendant la prise");
        if (prise.duree - prise.marque < PRISE_MIN) {
          useEditeur.getState().notifier("Prise trop courte : elle n'est pas gardée.");
        } else {
          useEditeur.getState().ajouterRessources([prise.ressource]);
          useEditeur.getState().ajouterSon(prise.ressource, { role: "voix", debut: get().debut, coupe: { debut: prise.marque }, ...(get().voixNette ? { nettoyage: VOIX_NETTE } : {}) });
        }
        // La tête revient dans la page si elle l'avait dépassée (une prise jetée).
        const duree = pageCourante(useEditeur.getState()).duree ?? 0;
        if (useTemps.getState().tete > duree - 1) useTemps.getState().allerA(Math.max(0, duree - 1));
        set({ phase: get().phase === "rangement" ? "pret" : get().phase });
      } catch (e) {
        set({ phase: get().phase === "rangement" ? "pret" : get().phase, erreur: `Prise perdue : ${String(e instanceof Error ? e.message : e)}` });
      }
    },

    abandonner() {
      const phase = get().phase;
      if (phase !== "compte" && phase !== "enregistre") return;
      // La phase change d'abord : la pause qui suit ne doit pas ranger la prise abandonnée.
      set({ phase: "pret" });
      fin();
      abandonnerPrise();
      if (phase === "enregistre") useTemps.getState().pause();
    },
  };
});

// La lecture qui s'arrête (Espace, bouton Pause) arrête la prise ; pendant le compte à rebours,
// la lecture attend le top.
useTemps.subscribe((s, avant) => {
  const phase = usePrise.getState().phase;
  if (avant.joue && !s.joue && phase === "enregistre") void usePrise.getState().arreter();
  else if (!avant.joue && s.joue && phase === "compte") useTemps.getState().pause();
});

// Une autre page ou un autre design : la prise en cours est abandonnée.
useEditeur.subscribe((s, avant) => {
  if ((s.pageActive !== avant.pageActive || s.projet !== avant.projet) && ["compte", "enregistre"].includes(usePrise.getState().phase)) usePrise.getState().abandonner();
});

// Échap abandonne la prise en cours, avant tout autre raccourci.
if (typeof window !== "undefined") {
  window.addEventListener(
    "keydown",
    (e) => {
      const p = usePrise.getState();
      if (e.key !== "Escape" || (p.phase !== "compte" && p.phase !== "enregistre")) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      p.abandonner();
    },
    { capture: true },
  );
}
