import { Box, Film, ImagePlus } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditeur } from "../../etat/editeur";
import { creerDepuisRessource } from "../../modele/fabriques";
import type { Ressource } from "../../modele/types";
import { choisirEtImporterImages, dansTauri } from "../../pont/tauri";
import { glisserDepuisPanneau } from "../glisser";
import { useUrlRessource } from "../images";
import { avecSuivi, suiviFichiers } from "../SuiviImport";
import { dureeLisible } from "../videos";

/** Une image, une vidéo ou un modèle 3D du design : sa miniature (la couverture d'une vidéo,
 *  avec sa durée ; le rendu d'un modèle, rangé dès qu'il est dessiné). */
function CarteImage({ ressource }: { ressource: Ressource }) {
  const url = useUrlRessource(ressource.id, "miniature");
  const video = ressource.video;
  const modele = ressource.modele3d;
  const genre = video ? "vidéo" : "photo";
  const titre = modele
    ? `${ressource.nom} (modèle 3D${modele.triangles ? `, ${modele.triangles.toLocaleString("fr-FR")} triangles` : ""})${ressource.credit ? `, de ${ressource.credit.auteur} sur ${ressource.credit.source}` : ""}`
    : `${ressource.nom} (${ressource.largeur} × ${ressource.hauteur}${video ? `, ${dureeLisible(video.duree)}` : ""})${ressource.credit ? `, ${genre} de ${ressource.credit.auteur} sur ${ressource.credit.source}` : ""}`;
  return (
    <button
      title={titre}
      data-ressource-3d={modele ? ressource.id : undefined}
      onPointerDown={(e) => glisserDepuisPanneau(e, (format) => [creerDepuisRessource(format, ressource)], video || modele ? undefined : { photo: ressource.id })}
      className="relative cursor-grab overflow-hidden rounded-lg border border-neutral-200 bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px] hover:border-accent-500"
    >
      {url && (!modele || modele.miniature) ? (
        <img src={url} alt={ressource.nom} className="h-28 w-full object-contain" draggable={false} />
      ) : modele ? (
        <span className="flex h-28 items-center justify-center text-neutral-400">
          <Box size={28} />
        </span>
      ) : (
        <span className="block h-28" />
      )}
      {modele && (
        <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
          <Box size={11} /> 3D
        </span>
      )}
      {video && (
        <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums">
          <Film size={11} /> {dureeLisible(video.duree)}
        </span>
      )}
    </button>
  );
}

export function PanneauImages() {
  const ressources = useEditeur((s) => s.ressources);
  // Les sons ont leur onglet (Audio).
  const ordre = useEditeur(useShallow((s) => s.ordreRessources.filter((id) => !s.ressources[id]?.son)));
  const [occupe, setOccupe] = useState(false);

  const importer = async () => {
    const etat = useEditeur.getState();
    if (!etat.projet) return;
    setOccupe(true);
    try {
      const projet = etat.projet;
      const bilan = await avecSuivi(() => choisirEtImporterImages(projet, suiviFichiers));
      if (!bilan) return;
      etat.ajouterRessources(bilan.ressources);
      // Une seule image ou vidéo importée : elle va directement sur la page, comme dans Canva.
      if (bilan.ressources.length === 1) {
        const r = bilan.ressources[0];
        if (r.son) etat.ajouterSon(r);
        else etat.ajouterElements([creerDepuisRessource(etat.document.format, r)]);
      }
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
        <ImagePlus size={18} /> {occupe ? "Import en cours" : "Importer des images, des vidéos, de la 3D"}
      </button>
      {ordre.length === 0 ? (
        <p className="text-xs text-neutral-500">
          Les images, les vidéos et les modèles 3D (GLB, glTF, FBX, OBJ) de ce design apparaissent ici. Tu peux aussi déposer des fichiers sur la page, ou coller une capture d'écran (Ctrl+V).{" "}
          {dansTauri ? "Eliot en garde une copie dans le dossier du design ; tes fichiers d'origine ne sont jamais modifiés. Une vidéo demande quelques secondes de préparation." : ""}
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs text-neutral-500">Clique pour poser au centre, ou glisse sur la page. Lâchée sur un cadre ou un écran de maquette, une photo va dedans.</p>
          <div className="grid grid-cols-2 gap-2">
            {ordre.map((id) => ressources[id] && <CarteImage key={`${id}-${ressources[id].modele3d?.miniature ? 1 : 0}`} ressource={ressources[id]} />)}
          </div>
        </>
      )}
    </div>
  );
}
