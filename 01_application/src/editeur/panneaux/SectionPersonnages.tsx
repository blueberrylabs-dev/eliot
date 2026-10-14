// Les personnages du panneau Éléments : Open Peeps (dessin au trait) et Humaaans (aplats de
// couleur), tout faits ou à composer. Un clic pose le personnage au centre de la page, un
// glisser le pose sous le pointeur ; ses couleurs et ses pièces se changent ensuite dans la
// barre du haut.

import { ChevronLeft, Dices } from "lucide-react";
import { useMemo, useState } from "react";
import { useCataloguePersonnages, useUrlPersonnage } from "../../bibliotheque/personnages";
import { normaliser } from "../../bibliotheque/recherche";
import { creerPersonnage } from "../../modele/fabriques";
import { piecesAuHasard, piecesValides, vueComposee, type Boite, type CataloguePersonnages, type CategoriePersonnages, type CollectionPersonnages } from "../../modele/personnages";
import type { Format } from "../../modele/types";
import { glisserDepuisPanneau } from "../glisser";

const PAR_PAGE = 30;

/** Mots qui font apparaître le composeur dans une recherche. */
const MOTS_COMPOSEUR = "personnage personnages creer composer mascotte avatar bonhomme character";

function VignettePersonnage({ collection, nom, vue, titre }: { collection: string; nom: string; vue: Boite; titre: string }) {
  const url = useUrlPersonnage({ collection, dessin: nom }, 160);
  return (
    <button
      title={titre}
      data-personnage={`${collection}/${nom}`}
      onPointerDown={(e) => glisserDepuisPanneau(e, (format) => [creerPersonnage(format, { collection, dessin: nom }, vue)])}
      className="flex h-28 cursor-grab items-end justify-center rounded-lg p-1.5 hover:bg-neutral-100"
    >
      {url ? <img src={url} alt="" draggable={false} className="max-h-full max-w-full" /> : <span className="h-full w-full rounded bg-neutral-100" />}
    </button>
  );
}

function Grille({ collection, elements, categorie }: { collection: CollectionPersonnages; elements: CategoriePersonnages["elements"]; categorie: CategoriePersonnages }) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {elements.map((e) => (
        <VignettePersonnage key={e.nom} collection={collection.id} nom={e.nom} vue={e.vue} titre={`${categorie.libelle} (${collection.libelle})`} />
      ))}
    </div>
  );
}

/** Un nouveau personnage composé, tiré au hasard. */
const fabriquerCompose = (c: CollectionPersonnages) => (format: Format) => {
  const r = piecesAuHasard(c.composition);
  return [creerPersonnage(format, { collection: c.id, posture: r.posture, pieces: r.pieces }, vueComposee(c.composition, r.posture, r.pieces))];
};

function CarteComposeur({ collection }: { collection: CollectionPersonnages }) {
  const defaut = piecesValides(collection.composition, collection.composition.defaut.posture, collection.composition.defaut.pieces);
  const url = useUrlPersonnage({ collection: collection.id, ...defaut }, 120);
  return (
    <button
      title={`Créer un personnage ${collection.libelle}, tiré au hasard`}
      data-composer={collection.id}
      onPointerDown={(e) => glisserDepuisPanneau(e, fabriquerCompose(collection))}
      className="flex cursor-grab flex-col items-center gap-1 rounded-lg border border-neutral-200 p-2 hover:border-accent-500 hover:bg-accent-50"
    >
      <span className="flex h-20 items-end">{url ? <img src={url} alt="" draggable={false} className="max-h-full max-w-full" /> : <span className="h-16 w-12 rounded bg-neutral-100" />}</span>
      <span className="flex items-center gap-1 text-xs font-medium text-neutral-700">
        <Dices size={13} /> {collection.libelle}
      </span>
      <span className="text-[10px] text-neutral-500">{collection.style}</span>
    </button>
  );
}

export function Composeurs({ catalogue }: { catalogue: CataloguePersonnages }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-1.5">
        {catalogue.collections.map((c) => (
          <CarteComposeur key={c.id} collection={c} />
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-neutral-500">Un personnage au hasard ; change ensuite sa tenue, sa coiffure, son visage et ses couleurs dans la barre du haut.</p>
    </>
  );
}

function Absents() {
  return (
    <p className="text-[11px] text-neutral-500">
      Pas encore fabriqués sur ce poste : range les archives Open Peeps et Humaaans (.zip) dans le dossier telechargements d'Eliot, puis relance npm run bibliotheque.
    </p>
  );
}

/** L'aperçu du panneau : quelques personnages, et de quoi composer le sien. */
export function ApercuPersonnages() {
  const catalogue = useCataloguePersonnages();
  if (catalogue === undefined) return null;
  if (catalogue === null) return <Absents />;
  const choix = catalogue.collections.flatMap((c) => {
    const categorie = c.categories.find((k) => k.id === (c.id === "open-peeps" ? "buste" : "debout")) ?? c.categories[0];
    return categorie ? categorie.elements.slice(0, 3).map((e) => ({ c, categorie, e })) : [];
  });
  return (
    <>
      <div className="grid grid-cols-3 gap-1">
        {choix.map(({ c, categorie, e }) => (
          <VignettePersonnage key={`${c.id}/${e.nom}`} collection={c.id} nom={e.nom} vue={e.vue} titre={`${categorie.libelle} (${c.libelle})`} />
        ))}
      </div>
      <p className="mt-3 mb-1.5 text-xs font-medium text-neutral-600">Créer le tien</p>
      <Composeurs catalogue={catalogue} />
    </>
  );
}

/** « Tout voir » : une collection, catégorie par catégorie. */
export function VuePersonnages({ retour, collection: idDepart, categorie: categorieDepart }: { retour: () => void; collection?: string; categorie?: string }) {
  const catalogue = useCataloguePersonnages();
  const [idCollection, setIdCollection] = useState(idDepart);
  const [idCategorie, setIdCategorie] = useState(categorieDepart);
  const [nombre, setNombre] = useState(PAR_PAGE);
  if (!catalogue) return catalogue === null ? <Absents /> : null;
  const collection = catalogue.collections.find((c) => c.id === idCollection) ?? catalogue.collections[0];
  const categorie = collection.categories.find((k) => k.id === idCategorie) ?? collection.categories[0];
  const puce = (actif: boolean) => `rounded-full border px-2.5 py-1 text-xs ${actif ? "border-accent-600 bg-accent-50 font-medium text-accent-800" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`;
  return (
    <>
      <div className="mt-3 mb-2 flex items-center gap-2">
        <button title="Retour" onClick={retour} className="rounded-md p-1 hover:bg-neutral-100">
          <ChevronLeft size={18} />
        </button>
        <p className="flex-1 text-sm font-semibold text-neutral-800">Personnages</p>
      </div>
      <div className="mb-2 flex gap-1.5">
        {catalogue.collections.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setIdCollection(c.id);
              setIdCategorie(undefined);
              setNombre(PAR_PAGE);
            }}
            className={puce(c.id === collection.id)}
          >
            {c.libelle}
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {collection.categories.map((k) => (
          <button
            key={k.id}
            data-categorie={k.id}
            onClick={() => {
              setIdCategorie(k.id);
              setNombre(PAR_PAGE);
            }}
            className={puce(k.id === categorie.id)}
          >
            {k.libelle} <span className="text-neutral-400">{k.elements.length}</span>
          </button>
        ))}
      </div>
      <Grille collection={collection} categorie={categorie} elements={categorie.elements.slice(0, nombre)} />
      {nombre < categorie.elements.length && (
        <button onClick={() => setNombre(nombre + PAR_PAGE)} className="mt-3 w-full rounded-lg border border-neutral-200 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
          Afficher plus
        </button>
      )}
      <p className="mt-4 mb-1.5 text-xs font-medium text-neutral-600">Créer le tien</p>
      <Composeurs catalogue={catalogue} />
      <p className="mt-3 text-[11px] text-neutral-500">
        {collection.libelle}, de {collection.auteur} : {collection.style.toLowerCase()}, licence CC0 (domaine public).
      </p>
    </>
  );
}

/** Les personnages d'une recherche : les catégories dont les mots répondent. */
export function usePersonnagesTrouves(requete: string) {
  const catalogue = useCataloguePersonnages();
  return useMemo(() => {
    const mots = normaliser(requete).split(" ").filter(Boolean);
    if (!catalogue || !mots.length) return { catalogue, categories: [], composer: false };
    const categories = catalogue.collections.flatMap((c) =>
      c.categories.filter((k) => mots.every((m) => normaliser(`${k.mots} ${k.libelle} ${c.libelle}`).split(" ").some((x) => x.startsWith(m)))).map((k) => ({ c, k })),
    );
    const composer = mots.every((m) => MOTS_COMPOSEUR.split(" ").some((x) => x.startsWith(m)));
    return { catalogue, categories, composer };
  }, [catalogue, requete]);
}

export function PersonnagesTrouves({ trouves, voirTout }: { trouves: ReturnType<typeof usePersonnagesTrouves>; voirTout: (collection: string, categorie: string) => void }) {
  if (!trouves.catalogue) return null;
  return (
    <>
      {trouves.categories.map(({ c, k }) => (
        <div key={`${c.id}/${k.id}`} className="mb-2">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-medium text-neutral-600">
              {k.libelle}, {c.libelle}
            </p>
            <button onClick={() => voirTout(c.id, k.id)} className="text-xs font-medium text-accent-700 hover:underline">
              Tout voir ({k.elements.length})
            </button>
          </div>
          <Grille collection={c} categorie={k} elements={k.elements.slice(0, 6)} />
        </div>
      ))}
      {trouves.composer && <Composeurs catalogue={trouves.catalogue} />}
    </>
  );
}
