// Le panneau Texte : titres prêts, associations de polices (un titre et un texte qui vont
// ensemble), et toutes les polices, rangées par genre, avec une recherche.

import { Search } from "lucide-react";
import { useMemo, useState, type PointerEvent } from "react";
import associations from "../../bibliotheque/associations.json";
import { normaliser } from "../../bibliotheque/recherche";
import { creerParagraphe, creerSousTitre, creerTexte, creerTitre, nouvelId } from "../../modele/fabriques";
import type { ElementTexte, Format } from "../../modele/types";
import { assurerPolice, GENRES_POLICE, pilePolice, usePolices, type Police } from "../../polices";
import { useApparu } from "../apparu";
import { glisserDepuisPanneau } from "../glisser";

interface Association {
  titre: string;
  texte: string;
  ambiance: string;
}

/** Un titre et un texte groupés, l'un sous l'autre, au centre de la page. */
function creerAssociation(format: Format, a: Association): ElementTexte[] {
  const echelle = Math.max(format.largeur, format.hauteur) / 1080;
  const titre = creerTexte(format, { texte: "Ton titre ici", taillePolice: Math.round(88 * echelle), gras: true, police: a.titre });
  const texte = creerTexte(format, { texte: "Une phrase qui donne envie d'en savoir plus.", taillePolice: Math.round(34 * echelle), gras: false, police: a.texte });
  const ecart = Math.round(24 * echelle);
  const total = titre.hauteur + ecart + texte.hauteur;
  const haut = Math.round((format.hauteur - total) / 2);
  const groupe = nouvelId("g");
  return [
    { ...titre, y: haut, groupe },
    { ...texte, y: haut + titre.hauteur + ecart, groupe },
  ];
}

const carte = "w-full cursor-grab rounded-lg border border-neutral-200 px-3 py-2.5 text-left hover:border-accent-500 hover:bg-accent-50";

interface ProprietesCarte {
  surSurvol: () => void;
  surPointeur: (e: PointerEvent<HTMLButtonElement>) => void;
}

/** Une police, écrite avec elle-même dès qu'elle apparaît à l'écran. */
function CartePolice({ police, surSurvol, surPointeur }: ProprietesCarte & { police: Police }) {
  const [ref, apparu] = useApparu<HTMLButtonElement>();
  return (
    <button ref={ref} className={carte} onPointerEnter={surSurvol} onPointerDown={surPointeur}>
      <span className="block text-xl text-neutral-900" style={apparu ? { fontFamily: pilePolice(police.famille), fontWeight: police.gras ? 700 : 400 } : undefined}>
        {police.famille}
      </span>
      <span className="text-xs text-neutral-500">{police.usage}</span>
    </button>
  );
}

function CarteAssociation({ association: a, surSurvol, surPointeur }: ProprietesCarte & { association: Association }) {
  const [ref, apparu] = useApparu<HTMLButtonElement>();
  return (
    <button ref={ref} className={carte} onPointerEnter={surSurvol} onPointerDown={surPointeur}>
      <span className="block text-xl leading-tight font-bold text-neutral-900" style={apparu ? { fontFamily: pilePolice(a.titre) } : undefined}>
        {a.titre}
      </span>
      <span className="block text-xs text-neutral-600" style={apparu ? { fontFamily: pilePolice(a.texte) } : undefined}>
        avec {a.texte} : {a.ambiance}
      </span>
    </button>
  );
}

export function PanneauTextes() {
  const polices = usePolices();
  const [requete, setRequete] = useState("");
  const filtrees = useMemo(() => {
    const q = normaliser(requete);
    return q ? polices.filter((p) => normaliser(`${p.famille} ${p.usage}`).includes(q)) : polices;
  }, [polices, requete]);

  /** Charge les polices avant de poser le texte : il se mesure avec elles. */
  const poser = (familles: string[], fabriquer: (f: Format) => ElementTexte[]) => async (f: Format) => {
    await Promise.all(familles.map((x) => assurerPolice(x, true, false)));
    return fabriquer(f);
  };
  const prechauffer = (familles: string[]) => familles.forEach((f) => void assurerPolice(f, true, false));

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-neutral-800">Texte</p>
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

      {polices.length > 0 && (
        <>
          <p className="mb-1 text-sm font-semibold text-neutral-800">Associations de polices</p>
          <p className="mb-2 text-xs text-neutral-500">Un titre et un texte qui vont bien ensemble, posés groupés.</p>
          <div className="mb-5 flex flex-col gap-1.5">
            {(associations as Association[]).map((a) => (
              <CarteAssociation key={`${a.titre}+${a.texte}`} association={a} surSurvol={() => prechauffer([a.titre, a.texte])} surPointeur={(e) => glisserDepuisPanneau(e, poser([a.titre, a.texte], (f) => creerAssociation(f, a)))} />
            ))}
          </div>

          <p className="mb-2 text-sm font-semibold text-neutral-800">Toutes les polices</p>
          <div className="relative mb-2">
            <Search size={15} className="absolute top-2.5 left-2.5 text-neutral-400" />
            <input value={requete} onChange={(e) => setRequete(e.target.value)} placeholder="Nom ou usage : luxe, sport…" className="h-9 w-full rounded-lg border border-neutral-300 pr-2 pl-8 text-sm outline-none focus:border-accent-500" />
          </div>
          {GENRES_POLICE.map((g) => {
            const duGenre = filtrees.filter((p) => p.genre === g.id);
            if (duGenre.length === 0) return null;
            return (
              <div key={g.id} className="mb-3">
                <p className="mb-1.5 text-xs font-medium tracking-wide text-neutral-500 uppercase">{g.libelle}</p>
                <div className="flex flex-col gap-1.5">
                  {duGenre.map((p) => (
                    <CartePolice key={p.famille} police={p} surSurvol={() => prechauffer([p.famille])} surPointeur={(e) => glisserDepuisPanneau(e, poser([p.famille], (f) => [creerTitre(f, p.famille)]))} />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
      <p className="mt-4 text-xs text-neutral-500">Clique pour poser au centre, ou glisse sur la page. Double-clic sur un texte de la page pour l'écrire ; Échap ou un clic ailleurs pour valider.</p>
    </div>
  );
}
