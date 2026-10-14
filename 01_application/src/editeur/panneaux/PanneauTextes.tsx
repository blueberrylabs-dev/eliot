import { useEditeur } from "../../etat/editeur";
import { creerParagraphe, creerSousTitre, creerTitre } from "../../modele/fabriques";
import { POLICES, pilePolice } from "../../polices";

export function PanneauTextes() {
  const page = useEditeur((s) => s.document.page);
  const ajouter = useEditeur((s) => s.ajouterElements);
  const carte = "w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-left hover:border-accent-500 hover:bg-accent-50";
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-neutral-800">Textes</p>
      <div className="mb-5 flex flex-col gap-2">
        <button className={carte} onClick={() => ajouter([creerTitre(page)])}>
          <span className="text-2xl font-bold text-neutral-900">Ajouter un titre</span>
        </button>
        <button className={carte} onClick={() => ajouter([creerSousTitre(page)])}>
          <span className="text-lg font-semibold text-neutral-800">Ajouter un sous-titre</span>
        </button>
        <button className={carte} onClick={() => ajouter([creerParagraphe(page)])}>
          <span className="text-sm text-neutral-700">Ajouter un paragraphe de texte</span>
        </button>
      </div>
      <p className="mb-2 text-sm font-semibold text-neutral-800">Titres par police</p>
      <p className="mb-3 text-xs text-neutral-500">Chaque police a son caractère. Clique pour poser un titre dans cette police.</p>
      <div className="flex flex-col gap-1.5">
        {POLICES.map((p) => (
          <button key={p.famille} className={carte} onClick={() => ajouter([creerTitre(page, p.famille)])}>
            <span className="block text-xl text-neutral-900" style={{ fontFamily: pilePolice(p.famille), fontWeight: p.gras ? 700 : 400 }}>
              {p.famille}
            </span>
            <span className="text-xs text-neutral-500">{p.usage}</span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-neutral-500">Double-clic sur un texte de la page pour l'écrire. Échap ou un clic ailleurs pour valider.</p>
    </div>
  );
}
