import { creerParagraphe, creerSousTitre, creerTitre } from "../../modele/fabriques";
import { POLICES, pilePolice } from "../../polices";
import { glisserDepuisPanneau } from "../glisser";

export function PanneauTextes() {
  const carte = "w-full cursor-grab rounded-lg border border-neutral-200 px-3 py-2.5 text-left hover:border-accent-500 hover:bg-accent-50";
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-neutral-800">Textes</p>
      <div className="mb-5 flex flex-col gap-2">
        <button className={carte} onPointerDown={(e) => glisserDepuisPanneau(e, (f) => [creerTitre(f)])}>
          <span className="text-2xl font-bold text-neutral-900">Ajouter un titre</span>
        </button>
        <button className={carte} onPointerDown={(e) => glisserDepuisPanneau(e, (f) => [creerSousTitre(f)])}>
          <span className="text-lg font-semibold text-neutral-800">Ajouter un sous-titre</span>
        </button>
        <button className={carte} onPointerDown={(e) => glisserDepuisPanneau(e, (f) => [creerParagraphe(f)])}>
          <span className="text-sm text-neutral-700">Ajouter un paragraphe de texte</span>
        </button>
      </div>
      <p className="mb-2 text-sm font-semibold text-neutral-800">Titres par police</p>
      <p className="mb-3 text-xs text-neutral-500">Chaque police a son caractère. Clique pour poser un titre dans cette police.</p>
      <div className="flex flex-col gap-1.5">
        {POLICES.map((p) => (
          <button key={p.famille} className={carte} onPointerDown={(e) => glisserDepuisPanneau(e, (f) => [creerTitre(f, p.famille)])}>
            <span className="block text-xl text-neutral-900" style={{ fontFamily: pilePolice(p.famille), fontWeight: p.gras ? 700 : 400 }}>
              {p.famille}
            </span>
            <span className="text-xs text-neutral-500">{p.usage}</span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-neutral-500">Clique pour poser au centre, ou glisse sur la page. Double-clic sur un texte de la page pour l'écrire ; Échap ou un clic ailleurs pour valider.</p>
    </div>
  );
}
