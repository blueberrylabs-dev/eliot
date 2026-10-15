// Où en est l'import des vidéos : la copie d'aperçu prend de quelques secondes à quelques
// minutes selon la longueur. Une bande en bas de la fenêtre le montre, au-dessus des
// notifications.

import { Film } from "lucide-react";
import { create } from "zustand";
import type { SuiviImport } from "../pont/tauri";

interface EtatSuivi {
  /** `null` : rien en cours. */
  enCours: { texte: string; part: number } | null;
  montrer: (texte: string, part: number) => void;
  finir: () => void;
}

export const useSuiviImport = create<EtatSuivi>((set) => ({
  enCours: null,
  montrer: (texte, part) => set({ enCours: { texte, part } }),
  finir: () => set({ enCours: null }),
}));

/** Un suivi à donner au pont pour un import de fichiers du disque. */
export const suiviFichiers: SuiviImport = (fichier, part, total) =>
  useSuiviImport.getState().montrer(total > 1 ? `Préparation de la vidéo ${fichier + 1} sur ${total}` : "Préparation de la vidéo", part);

/** Lance `travail` en montrant son avancement, et range la bande à la fin, même en cas d'échec. */
export async function avecSuivi<T>(travail: () => Promise<T>): Promise<T> {
  try {
    return await travail();
  } finally {
    useSuiviImport.getState().finir();
  }
}

export function BandeImport() {
  const enCours = useSuiviImport((s) => s.enCours);
  if (!enCours) return null;
  const pourcent = Math.round(enCours.part * 100);
  return (
    <div className="absolute bottom-20 left-1/2 z-40 w-80 -translate-x-1/2 rounded-xl bg-neutral-900 px-4 py-3 text-sm text-white shadow-xl" role="status" aria-label={enCours.texte}>
      <div className="mb-2 flex items-center gap-2">
        <Film size={16} className="shrink-0" />
        <span className="flex-1 truncate">{enCours.texte}</span>
        <span className="tabular-nums text-white/70">{pourcent} %</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-accent-500 transition-[width] duration-200" style={{ width: `${pourcent}%` }} />
      </div>
    </div>
  );
}
