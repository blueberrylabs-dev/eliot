// Le thème de l'interface (étape 7, lot 4) : clair, sombre, ou comme le système. Seule
// l'interface change : la page, ses couleurs, les vignettes et les exports sont dessinés par
// Konva et par le noyau, jamais avec ces couleurs. Un choix de la vue, gardé par le navigateur
// comme les aides ; clair par défaut, comme Eliot l'a toujours été.

import { create } from "zustand";
import { dansTauri } from "../pont/tauri";

export type Theme = "clair" | "sombre" | "systeme";
export type Effectif = "clair" | "sombre";
export const THEMES: Theme[] = ["clair", "sombre", "systeme"];
const CLE = "eliot-theme";

const requete = (): MediaQueryList | null => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null);

/** Ce que dit le système : la fenêtre de Tauri (le thème de GTK), sinon le navigateur. */
let systeme: Effectif = requete()?.matches ? "sombre" : "clair";

export const themeEffectif = (t: Theme): Effectif => (t === "systeme" ? systeme : t);

function lire(): Theme {
  try {
    const v = localStorage.getItem(CLE);
    return THEMES.includes(v as Theme) ? (v as Theme) : "clair";
  } catch {
    return "clair";
  }
}

interface EtatTheme {
  theme: Theme;
  /** Le thème montré : celui du système quand on le suit. */
  effectif: Effectif;
  choisir: (theme: Theme) => void;
}

export const useTheme = create<EtatTheme>((set) => ({
  theme: lire(),
  effectif: themeEffectif(lire()),
  choisir: (theme) => {
    try {
      localStorage.setItem(CLE, theme);
    } catch {
      // Sans stockage, le choix vaut jusqu'à la fermeture.
    }
    set({ theme, effectif: themeEffectif(theme) });
  },
}));

function suivreSysteme(valeur: Effectif): void {
  if (valeur === systeme) return;
  systeme = valeur;
  if (useTheme.getState().theme === "systeme") useTheme.setState({ effectif: valeur });
}

/** Pose le thème sur la racine du document (`data-theme`), avant le premier affichage, puis
 *  le suit : un autre choix, ou le système qui change pendant qu'on le suit. Dans Tauri, la
 *  barre de titre de la fenêtre prend le même thème. */
export function appliquerTheme(): void {
  const poser = () => {
    document.documentElement.dataset.theme = useTheme.getState().effectif;
  };
  poser();
  let avant = useTheme.getState().theme;
  useTheme.subscribe((s) => {
    poser();
    if (s.theme !== avant) {
      avant = s.theme;
      void fenetre(s.theme);
    }
  });
  requete()?.addEventListener("change", (e) => !dansTauri && suivreSysteme(e.matches ? "sombre" : "clair"));
  if (dansTauri) void fenetre(useTheme.getState().theme, true);
}

/** Le thème de la fenêtre de Tauri : imposé (clair ou sombre), ou laissé au système, dont on
 *  lit alors la valeur et ses changements. */
async function fenetre(theme: Theme, ecouter = false): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const f = getCurrentWindow();
    await f.setTheme(theme === "systeme" ? null : theme === "sombre" ? "dark" : "light").catch(() => undefined);
    if (theme === "systeme") {
      const lu = await f.theme();
      if (lu) suivreSysteme(lu === "dark" ? "sombre" : "clair");
    }
    if (ecouter) {
      await f.onThemeChanged(({ payload }) => {
        if (useTheme.getState().theme === "systeme") suivreSysteme(payload === "dark" ? "sombre" : "clair");
      });
    }
  } catch {
    // Hors de Tauri, ou une fenêtre qui ne dit pas son thème : le navigateur suffit.
  }
}
