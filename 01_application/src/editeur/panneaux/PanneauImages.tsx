import { ImagePlus } from "lucide-react";
import { useState } from "react";
import { useEditeur } from "../../etat/editeur";
import { creerImage } from "../../modele/fabriques";
import { choisirEtImporterImages, dansTauri } from "../../pont/tauri";

export function PanneauImages() {
  const page = useEditeur((s) => s.document.page);
  const ressources = useEditeur((s) => s.ressources);
  const ordre = useEditeur((s) => s.ordreRessources);
  const ajouterRessources = useEditeur((s) => s.ajouterRessources);
  const ajouter = useEditeur((s) => s.ajouterElements);
  const notifier = useEditeur((s) => s.notifier);
  const [occupe, setOccupe] = useState(false);

  const importer = async () => {
    setOccupe(true);
    try {
      const bilan = await choisirEtImporterImages();
      if (!bilan) return;
      ajouterRessources(bilan.ressources);
      // Une seule image importée : elle va directement sur la page, comme dans Canva.
      if (bilan.ressources.length === 1) ajouter([creerImage(page, bilan.ressources[0])]);
      if (bilan.erreurs.length) notifier(`Non importé : ${bilan.erreurs.join(" ; ")}`, { erreur: true });
    } catch (erreur) {
      notifier(`Import impossible : ${String(erreur)}`, { erreur: true });
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-neutral-800">Images</p>
      <button
        disabled={occupe}
        onClick={() => void importer()}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-600 py-2.5 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-60"
      >
        <ImagePlus size={18} /> {occupe ? "Import en cours…" : "Importer des images"}
      </button>
      {ordre.length === 0 ? (
        <p className="text-xs text-neutral-500">
          Les images importées apparaissent ici. {dansTauri ? "Eliot en garde une copie dans son dossier de données ; tes fichiers d'origine ne sont jamais modifiés." : ""}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {ordre.map((id) => {
            const r = ressources[id];
            return (
              <button
                key={id}
                title={`${r.nom} (${r.largeur} × ${r.hauteur})`}
                onClick={() => ajouter([creerImage(page, r)])}
                className="overflow-hidden rounded-lg border border-neutral-200 bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px] hover:border-accent-500"
              >
                <img src={r.urlMiniature} alt={r.nom} className="h-28 w-full object-contain" draggable={false} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
