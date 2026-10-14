import { FolderOpen, X } from "lucide-react";
import { useEffect } from "react";
import { useEditeur } from "../etat/editeur";
import { afficherDansDossier } from "../pont/tauri";

export function Notification() {
  const notification = useEditeur((s) => s.notification);
  const fermer = useEditeur((s) => s.fermerNotification);

  useEffect(() => {
    if (!notification) return;
    const minuterie = setTimeout(fermer, notification.erreur ? 12000 : 7000);
    return () => clearTimeout(minuterie);
  }, [notification, fermer]);

  if (!notification) return null;
  return (
    <div
      key={notification.numero}
      className={`absolute bottom-5 left-1/2 z-40 flex max-w-[70%] -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-white shadow-xl ${notification.erreur ? "bg-red-700" : "bg-neutral-900"}`}
    >
      <span className="truncate" title={notification.texte}>
        {notification.texte}
      </span>
      {notification.chemin && (
        <button onClick={() => void afficherDansDossier(notification.chemin!)} className="flex shrink-0 items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-1 hover:bg-white/25">
          <FolderOpen size={15} /> Afficher dans le dossier
        </button>
      )}
      <button onClick={fermer} title="Fermer" className="shrink-0 rounded p-0.5 hover:bg-white/15">
        <X size={15} />
      </button>
    </div>
  );
}
