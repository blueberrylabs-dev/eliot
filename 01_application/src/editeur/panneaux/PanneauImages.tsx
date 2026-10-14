import { ImagePlus } from "lucide-react";
import { useState } from "react";
import { useEditeur } from "../../etat/editeur";
import { creerImage } from "../../modele/fabriques";
import type { Ressource } from "../../modele/types";
import { choisirEtImporterImages, dansTauri } from "../../pont/tauri";
import { glisserDepuisPanneau } from "../glisser";
import { useUrlRessource } from "../images";

function CarteImage({ ressource }: { ressource: Ressource }) {
  const url = useUrlRessource(ressource.id, "miniature");
  return (
    <button
      title={`${ressource.nom} (${ressource.largeur} × ${ressource.hauteur})`}
      onPointerDown={(e) => glisserDepuisPanneau(e, (format) => [creerImage(format, ressource)], { photo: ressource.id })}
      className="cursor-grab overflow-hidden rounded-lg border border-neutral-200 bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px] hover:border-accent-500"
    >
      {url ? <img src={url} alt={ressource.nom} className="h-28 w-full object-contain" draggable={false} /> : <span className="block h-28" />}
    </button>
  );
}

export function PanneauImages() {
  const ressources = useEditeur((s) => s.ressources);
  const ordre = useEditeur((s) => s.ordreRessources);
  const [occupe, setOccupe] = useState(false);

  const importer = async () => {
    const etat = useEditeur.getState();
    if (!etat.projet) return;
    setOccupe(true);
    try {
      const bilan = await choisirEtImporterImages(etat.projet);
      if (!bilan) return;
      etat.ajouterRessources(bilan.ressources);
      // Une seule image importée : elle va directement sur la page, comme dans Canva.
      if (bilan.ressources.length === 1) etat.ajouterElements([creerImage(etat.document.format, bilan.ressources[0])]);
      if (bilan.erreurs.length) etat.notifier(`Non importé : ${bilan.erreurs.join(" ; ")}`, { erreur: true });
    } catch (erreur) {
      etat.notifier(`Import impossible : ${String(erreur)}`, { erreur: true });
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-neutral-800">Importer</p>
      <button
        disabled={occupe}
        onClick={() => void importer()}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-600 py-2.5 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-60"
      >
        <ImagePlus size={18} /> {occupe ? "Import en cours…" : "Importer des images"}
      </button>
      {ordre.length === 0 ? (
        <p className="text-xs text-neutral-500">
          Les images de ce design apparaissent ici. Tu peux aussi déposer des fichiers sur la page, ou coller une capture d'écran (Ctrl+V).{" "}
          {dansTauri ? "Eliot en garde une copie dans le dossier du design ; tes fichiers d'origine ne sont jamais modifiés." : ""}
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs text-neutral-500">Clique pour poser au centre, ou glisse sur la page. Lâchée sur un cadre ou un écran de maquette, la photo va dedans.</p>
          <div className="grid grid-cols-2 gap-2">
            {ordre.map((id) => ressources[id] && <CarteImage key={id} ressource={ressources[id]} />)}
          </div>
        </>
      )}
    </div>
  );
}
