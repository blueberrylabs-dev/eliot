// Les réglages d'un personnage dans la barre du haut : ses couleurs, une par partie (Open
// Peeps) ou une par couleur du dessin (Humaaans), le retourner, et pour un personnage composé,
// le composeur : posture, puis une pièce par emplacement, avec des vignettes.

import { Dices, FlipHorizontal2, RotateCcw, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { dessinPersonnage, useCataloguePersonnages, useUrlPersonnage } from "../bibliotheque/personnages";
import { useEditeur } from "../etat/editeur";
import { couleursDuDessin, piecesAuHasard, piecesValides, posture as trouverPosture, type CollectionPersonnages, type CouleurModifiable } from "../modele/personnages";
import type { ElementPersonnage } from "../modele/types";
import { Bulle } from "./Bulle";
import { Bouton, separateur } from "./ElementsBarre";
import { SelecteurCouleur } from "./SelecteurCouleur";

/** Les emplacements qui forment la tête : leurs vignettes ne montrent que la tête. */
const TETE = ["tete", "visage", "barbe", "accessoire"];

function useCouleursPersonnage(el: ElementPersonnage, collection: CollectionPersonnages | undefined): CouleurModifiable[] {
  const [liste, setListe] = useState<CouleurModifiable[]>([]);
  const cle = `${el.collection}/${el.dessin ?? ""}/${el.posture ?? ""}/${JSON.stringify(el.pieces ?? {})}`;
  useEffect(() => {
    let actif = true;
    // Les couleurs d'origine : celles du dessin sans les changements.
    void dessinPersonnage({ ...el, couleurs: undefined }).then((d) => actif && d && setListe(couleursDuDessin(d.corps, collection?.composition.couleurs ?? [], 8)));
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, collection]);
  return liste;
}

function VignettePiece({ el, pieces, posture, emplacements, titre, choisie, surClic }: { el: ElementPersonnage; pieces: Record<string, string>; posture: string; emplacements?: string[]; titre: string; choisie: boolean; surClic: () => void }) {
  const url = useUrlPersonnage({ collection: el.collection, posture, pieces, couleurs: el.couleurs }, 96, emplacements);
  return (
    <button
      title={titre}
      data-piece={titre}
      onClick={surClic}
      className={`flex h-[72px] items-center justify-center rounded-md border p-1 ${choisie ? "border-accent-600 bg-accent-50 ring-2 ring-accent-200" : "border-neutral-200 hover:border-accent-400"}`}
    >
      {url ? <img src={url} alt="" draggable={false} className="max-h-full max-w-full" /> : <span className="h-10 w-8 rounded bg-neutral-100" />}
    </button>
  );
}

function Composeur({ el, collection }: { el: ElementPersonnage; collection: CollectionPersonnages }) {
  const c = collection.composition;
  const actuel = piecesValides(c, el.posture, el.pieces);
  const p = trouverPosture(c, actuel.posture);
  const emplacementsPosture = c.emplacements.filter((e) => p.emplacements.some((x) => x.id === e.id));
  const [onglet, setOnglet] = useState(emplacementsPosture[0]?.id ?? "tete");
  const place = p.emplacements.find((x) => x.id === onglet) ?? p.emplacements[0];
  const modifier = (m: Partial<ElementPersonnage>) => useEditeur.getState().modifierElements({ [el.id]: m });
  // Vignettes : la tête seule pour ce qui est sur la tête (Open Peeps) ; sinon tout le personnage.
  const vignette = collection.id === "open-peeps" && TETE.includes(place.id) ? TETE : place.id === "tete" ? ["tete"] : undefined;
  const options = c.groupes[place.groupe] ?? [];

  return (
    <div>
      <div className="mb-2 flex gap-1 rounded-lg bg-neutral-100 p-0.5">
        {c.postures.map((x) => (
          <button
            key={x.id}
            data-posture={x.id}
            onClick={() => x.id !== actuel.posture && modifier({ posture: x.id, pieces: actuel.pieces })}
            className={`flex-1 rounded-md py-1 text-xs font-medium ${x.id === actuel.posture ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"}`}
          >
            {x.libelle}
          </button>
        ))}
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {emplacementsPosture.map((e) => (
          <button
            key={e.id}
            data-emplacement={e.id}
            onClick={() => setOnglet(e.id)}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${e.id === place.id ? "border-accent-600 bg-accent-50 font-medium text-accent-800" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
          >
            {e.libelle}
          </button>
        ))}
      </div>
      <div className="grid max-h-[46vh] grid-cols-4 gap-1.5 overflow-y-auto pr-1 defilement-fin">
        {place.facultatif && (
          <button
            title="Aucune"
            data-piece="Aucune"
            onClick={() => modifier({ pieces: { ...actuel.pieces, [place.id]: "" } })}
            className={`flex h-[72px] items-center justify-center rounded-md border text-xs text-neutral-500 ${!actuel.pieces[place.id] ? "border-accent-600 bg-accent-50 ring-2 ring-accent-200" : "border-neutral-200 hover:border-accent-400"}`}
          >
            Aucune
          </button>
        )}
        {options.map((o) => (
          <VignettePiece
            key={o.id}
            el={el}
            posture={actuel.posture}
            pieces={{ ...actuel.pieces, [place.id]: o.id }}
            emplacements={vignette}
            titre={o.libelle}
            choisie={actuel.pieces[place.id] === o.id}
            surClic={() => modifier({ pieces: { ...actuel.pieces, [place.id]: o.id } })}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <button
          onClick={() => {
            const r = piecesAuHasard(c, actuel.posture);
            modifier({ posture: r.posture, pieces: r.pieces });
          }}
          className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <Dices size={14} /> Au hasard
        </button>
        <span className="text-[10px] text-neutral-400">
          {collection.libelle}, licence CC0
        </span>
      </div>
    </div>
  );
}

export function ReglagesPersonnage({ el }: { el: ElementPersonnage }) {
  const catalogue = useCataloguePersonnages();
  const collection = catalogue?.collections.find((c) => c.id === el.collection);
  const couleurs = useCouleursPersonnage(el, collection);
  const etat = useEditeur.getState();
  const changerCouleur = (cle: string, couleur: string) => etat.modifierElements({ [el.id]: { couleurs: { ...el.couleurs, [cle]: couleur } } }, `couleur-personnage:${el.id}:${cle}`);

  return (
    <>
      {collection && !el.dessin && (
        <>
          <Bulle titre="Composer le personnage : posture, tenue, coiffure, visage" largeur={380} bouton={<><UserRound size={16} /><span className="text-sm">Personnage</span></>}>
            <Composeur el={el} collection={collection} />
          </Bulle>
          {separateur}
        </>
      )}
      {couleurs.length > 0 && couleurs[0].cle.startsWith("#") && <span className="text-sm text-neutral-600">Couleurs</span>}
      {couleurs.map((c, i) => (
        <span key={c.cle} data-couleur={c.cle} className="flex shrink-0 items-center">
          {!c.cle.startsWith("#") && <span className="ml-1 text-[11px] text-neutral-500">{c.libelle}</span>}
          {c.cle.startsWith("#") && i > 0 && !couleurs[i - 1].cle.startsWith("#") && <span className="ml-1 text-[11px] text-neutral-500">Autres</span>}
          <SelecteurCouleur titre={c.cle.startsWith("#") ? `Couleur ${c.origine} du dessin` : `Couleur : ${c.libelle.toLowerCase()}`} valeur={el.couleurs?.[c.cle] ?? c.origine.toLowerCase()} surChoix={(v) => typeof v === "string" && changerCouleur(c.cle, v)} />
        </span>
      ))}
      {el.couleurs && Object.keys(el.couleurs).length > 0 && (
        <Bouton titre="Couleurs d'origine" surClic={() => etat.modifierElements({ [el.id]: { couleurs: undefined } })}>
          <RotateCcw size={15} />
        </Bouton>
      )}
      {separateur}
      <Bouton titre="Retourner horizontalement" surClic={() => etat.modifierElements({ [el.id]: { retourneH: !el.retourneH } })}>
        <FlipHorizontal2 size={16} />
      </Bouton>
      {collection && el.dessin && <span className="ml-1 text-xs whitespace-nowrap text-neutral-400">{collection.libelle}, licence CC0</span>}
    </>
  );
}
