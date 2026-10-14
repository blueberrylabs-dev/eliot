// Le panneau Modèles : les modèles de départ d'Eliot, ceux du format du design en premier. Un
// clic pose le modèle sur la page, ou sur une nouvelle page si celle-ci est déjà remplie.

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { normaliser } from "../../bibliotheque/recherche";
import { useEditeur } from "../../etat/editeur";
import { appliquerModele, libelleFormat } from "../../etat/modeles";
import { FORMATS_PAGE } from "../../modele/types";
import { MODELES_DEPART, type ModeleDepart } from "../../modeles/depart";
import { VignetteModele } from "../VignetteModele";

export function PanneauModeles() {
  const format = useEditeur((s) => s.document.format);
  const [requete, setRequete] = useState("");
  const [tous, setTous] = useState(false);
  const [occupe, setOccupe] = useState<string | null>(null);

  const formatCourant = FORMATS_PAGE.find((f) => f.largeur === format.largeur && f.hauteur === format.hauteur)?.id;
  const trouves = useMemo(() => {
    const q = normaliser(requete);
    return MODELES_DEPART.filter((m) => !q || q.split(" ").every((mot) => normaliser(`${m.nom} ${m.mots}`).includes(mot)));
  }, [requete]);
  const duFormat = trouves.filter((m) => m.format === formatCourant);
  const autres = trouves.filter((m) => m.format !== formatCourant);
  const parFormat = FORMATS_PAGE.map((f) => ({ f, liste: autres.filter((m) => m.format === f.id) })).filter((x) => x.liste.length);

  const poser = async (m: ModeleDepart) => {
    setOccupe(m.id);
    try {
      const ou = await appliquerModele(m);
      if (ou === "nouvelle-page") useEditeur.getState().notifier(`« ${m.nom} » posé sur une nouvelle page.`);
    } catch (e) {
      useEditeur.getState().notifier(`Modèle non posé : ${String(e)}`, { erreur: true });
    } finally {
      setOccupe(null);
    }
  };

  const grille = (liste: ModeleDepart[]) => (
    <div className="grid grid-cols-2 gap-x-2 gap-y-3">
      {liste.map((m) => (
        <VignetteModele key={m.id} modele={m} occupe={occupe === m.id} surClic={() => void poser(m)} />
      ))}
    </div>
  );

  return (
    <div>
      <div className="relative mb-3">
        <Search size={16} className="absolute top-2.5 left-2.5 text-neutral-400" />
        <input value={requete} onChange={(e) => setRequete(e.target.value)} placeholder="Chercher : soldes, menu, story…" className="h-9 w-full rounded-lg border border-neutral-300 pr-8 pl-8 text-sm outline-none focus:border-accent-500" />
        {requete && (
          <button title="Effacer" onClick={() => setRequete("")} className="absolute top-2 right-2 text-neutral-400 hover:text-neutral-700">
            <X size={16} />
          </button>
        )}
      </div>

      {duFormat.length > 0 && (
        <>
          <p className="mb-2 text-sm font-semibold text-neutral-800">Pour ce format</p>
          {grille(duFormat)}
        </>
      )}
      {formatCourant && duFormat.length === 0 && !requete && <p className="mb-3 text-xs text-neutral-500">Pas encore de modèle à ce format.</p>}

      {parFormat.length > 0 && (
        <button onClick={() => setTous(!tous)} className="mt-4 mb-2 text-xs font-medium text-accent-700 hover:underline">
          {tous || !formatCourant ? "Masquer les autres formats" : `Autres formats (${autres.length}), adaptés à la page`}
        </button>
      )}
      {(tous || !formatCourant || duFormat.length === 0) &&
        parFormat.map(({ f, liste }) => (
          <div key={f.id} className="mb-4">
            <p className="mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">{libelleFormat(f.id)}</p>
            {grille(liste)}
          </div>
        ))}
      {trouves.length === 0 && <p className="mt-6 text-center text-xs text-neutral-500">Aucun modèle pour « {requete} ».</p>}

      <p className="mt-4 text-[11px] text-neutral-500">Un clic pose le modèle sur la page (ou sur une nouvelle page si elle est déjà remplie). Remplace les textes, glisse tes photos dans les cadres.</p>
    </div>
  );
}
