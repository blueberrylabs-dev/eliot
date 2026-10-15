// Les sons libres de Freesound, dans l'onglet Audio (étape 4, lot 5). Tout passe par le Rust,
// qui seul connaît la clé ; seuls les sons CC0 et CC BY arrivent jusqu'ici. Écouter joue
// l'extrait léger ; un clic sur le son le télécharge, le prépare et le pose à la tête de
// lecture ; un glisser le pose dans la frise.

import { Loader2, Pause, Play, RotateCw, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { telechargerSonFreesound } from "../../etat/sons";
import type { Ressource } from "../../modele/types";
import { chercherFreesound, etatFreesound, ouvrirLien, urlExtraitFreesound, type EtatPixabay, type GenreFreesound, type SonFreesound } from "../../pont/tauri";
import { useEcoute } from "../ecoute";
import { glisserSon } from "../glisserSon";
import { dureeLisible } from "../videos";

const PAR_PAGE = 30;
const PAGES_MAX = 20;

/** Freesound se cherche surtout en anglais : chaque suggestion dit en français ce qu'elle
 *  cherche en anglais. */
const SUGGESTIONS: Record<GenreFreesound, { libelle: string; requete: string }[]> = {
  bruitages: [
    { libelle: "whoosh", requete: "whoosh" },
    { libelle: "clic", requete: "click" },
    { libelle: "pop", requete: "pop" },
    { libelle: "notification", requete: "notification" },
    { libelle: "applaudissements", requete: "applause" },
    { libelle: "caisse", requete: "cash register" },
    { libelle: "pluie", requete: "rain" },
    { libelle: "vent", requete: "wind" },
    { libelle: "foule", requete: "crowd" },
    { libelle: "porte", requete: "door" },
    { libelle: "rire", requete: "laugh" },
    { libelle: "machine à écrire", requete: "typewriter" },
  ],
  musiques: [
    { libelle: "lo-fi", requete: "lofi" },
    { libelle: "piano", requete: "piano" },
    { libelle: "ambiance", requete: "ambient" },
    { libelle: "électro", requete: "electronic" },
    { libelle: "guitare", requete: "guitar" },
    { libelle: "joyeux", requete: "happy" },
    { libelle: "cinématique", requete: "cinematic" },
    { libelle: "boucle de batterie", requete: "drum loop" },
  ],
  tout: [
    { libelle: "nature", requete: "nature" },
    { libelle: "ville", requete: "city" },
    { libelle: "café", requete: "cafe" },
    { libelle: "mer", requete: "sea" },
    { libelle: "oiseaux", requete: "birds" },
  ],
};

const GENRES: { id: GenreFreesound; libelle: string; titre: string }[] = [
  { id: "bruitages", libelle: "Bruitages", titre: "30 secondes au plus" },
  { id: "musiques", libelle: "Musiques", titre: "20 secondes et plus" },
  { id: "tout", libelle: "Tout", titre: "Toutes les durées" },
];

interface Recherche {
  requete: string;
  genre: GenreFreesound;
  sons: SonFreesound[];
  total: number;
  page: number;
}

// La dernière recherche reste là quand on change d'onglet.
let memoire: Recherche | null = null;
let genreMemoire: GenreFreesound = "bruitages";

function LigneFreesound({ son, genre }: { son: SonFreesound; genre: GenreFreesound }) {
  const ecoute = useEcoute((s) => s.enCours === `freesound-${son.id}`);
  const [occupe, setOccupe] = useState(false);
  const libre = son.licence.startsWith("CC0");
  const obtenir = async (): Promise<Ressource | null> => {
    setOccupe(true);
    try {
      return await telechargerSonFreesound(son.id);
    } finally {
      setOccupe(false);
    }
  };
  // Les musiques posées d'ici vont jusqu'au bout de la page ; un bruitage reste un bruitage.
  const role = genre === "musiques" ? "musique" : genre === "bruitages" ? "bruitage" : undefined;
  return (
    <div
      data-freesound={son.id}
      onPointerDown={(e) => !occupe && glisserSon(e, obtenir, role ? { role } : {})}
      title={`${son.nom}, par ${son.auteur} (${son.licence}). Clique pour poser à la tête de lecture, ou glisse dans la frise.`}
      className="mb-1.5 flex cursor-grab items-center gap-1.5 rounded-lg border border-neutral-200 px-2 py-1.5 hover:border-accent-500 hover:bg-accent-50"
    >
      <button
        data-garder-clic
        title={ecoute ? "Arrêter" : "Écouter l'extrait"}
        onClick={() => useEcoute.getState().basculer(`freesound-${son.id}`, () => urlExtraitFreesound(son.id))}
        className="shrink-0 rounded-full p-1 text-accent-700 hover:bg-white"
      >
        {ecoute ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-neutral-800">{son.nom}</span>
        <span className="block truncate text-[11px] text-neutral-500">
          {son.auteur} · <span className={libre ? "text-emerald-700" : "text-amber-700"}>{son.licence}</span>
        </span>
      </span>
      <span className="shrink-0 text-[11px] text-neutral-500 tabular-nums">{dureeLisible(son.duree * 1000)}</span>
      {occupe && <Loader2 size={14} className="shrink-0 animate-spin text-accent-700" />}
    </div>
  );
}

export function SectionFreesound() {
  const [etat, setEtat] = useState<EtatPixabay | null | undefined>(undefined);
  const [genre, setGenre] = useState<GenreFreesound>(memoire?.genre ?? genreMemoire);
  const [saisie, setSaisie] = useState(memoire?.requete ?? "");
  const [recherche, setRecherche] = useState<Recherche | null>(memoire);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const verifier = () => {
    setEtat(undefined);
    etatFreesound().then(setEtat, () => setEtat(null));
  };
  useEffect(verifier, []);

  const lancer = async (requete: string, g: GenreFreesound, page = 1) => {
    if (!requete.trim()) return;
    setOccupe(true);
    setErreur(null);
    try {
      const resultat = await chercherFreesound(requete.trim(), page, g);
      const suite: Recherche =
        page === 1 || !recherche || recherche.genre !== g
          ? { requete: requete.trim(), genre: g, sons: resultat.sons, total: resultat.total, page }
          : { ...recherche, sons: [...recherche.sons, ...resultat.sons.filter((s) => !recherche.sons.some((x) => x.id === s.id))], page };
      memoire = suite;
      setRecherche(suite);
    } catch (e) {
      setErreur(String(e));
    } finally {
      setOccupe(false);
    }
  };

  const choisirGenre = (g: GenreFreesound) => {
    genreMemoire = g;
    setGenre(g);
    if (recherche) void lancer(recherche.requete, g);
  };

  if (etat === undefined) return <p className="text-xs text-neutral-500">Freesound…</p>;
  if (etat === null) return <p className="text-xs text-neutral-600">Les sons de Freesound ne s'ouvrent que dans la fenêtre Eliot : c'est le Rust qui garde la clé et va les chercher.</p>;
  if (!etat.cle) {
    return (
      <div>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="mb-2 font-medium">Il manque la clé Freesound.</p>
          <p className="mb-1">Ajoute cette ligne, avec ta clé, dans le fichier :</p>
          <p className="mb-1 font-mono break-all">{etat.fichier}</p>
          <p className="mb-2 rounded bg-white px-2 py-1 font-mono">FREESOUND_API_KEY=ta_clé</p>
          <p>La clé reste sur ton poste : Eliot la lit côté Rust et ne l'affiche jamais.</p>
        </div>
        <button onClick={verifier} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-accent-700 hover:underline">
          <RotateCw size={14} /> Réessayer
        </button>
      </div>
    );
  }

  // Le total de Freesound compte déjà seulement les sons CC0 et CC BY.
  const plus = recherche && recherche.total > recherche.page * PAR_PAGE && recherche.page < PAGES_MAX;

  return (
    <div data-section-freesound>
      <div className="mb-2 flex gap-1">
        {GENRES.map((g) => (
          <button key={g.id} title={g.titre} onClick={() => choisirGenre(g.id)} className={`flex-1 rounded-md border px-1 py-1 text-xs ${genre === g.id ? "border-accent-600 bg-accent-50 text-accent-700" : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"}`}>
            {g.libelle}
          </button>
        ))}
      </div>
      <form
        className="relative mb-2"
        onSubmit={(e) => {
          e.preventDefault();
          void lancer(saisie, genre);
        }}
      >
        <Search size={16} className="absolute top-2.5 left-2.5 text-neutral-400" />
        <input value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder="Chercher en anglais : rain, whoosh…" className="h-9 w-full rounded-lg border border-neutral-300 pr-8 pl-8 text-sm outline-none focus:border-accent-500" />
        {saisie && (
          <button
            type="button"
            title="Effacer"
            onClick={() => {
              setSaisie("");
              setRecherche(null);
              memoire = null;
            }}
            className="absolute top-2 right-2 text-neutral-400 hover:text-neutral-700"
          >
            <X size={16} />
          </button>
        )}
      </form>
      <p className="mb-3 text-[11px] text-neutral-500">
        Sons libres de{" "}
        <button onClick={() => void ouvrirLien("https://freesound.org/")} className="font-medium text-accent-700 hover:underline">
          Freesound
        </button>
        {" : seulement CC0 (libres) et CC BY (citer l'auteur ; Eliot garde le crédit avec le son et prépare la liste à coller, plus bas). Ceux qui interdisent l'usage commercial sont écartés."}
      </p>

      {!recherche && !occupe && (
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS[genre].map((s) => (
            <button
              key={s.requete}
              title={`Cherche « ${s.requete} »`}
              onClick={() => {
                setSaisie(s.requete);
                void lancer(s.requete, genre);
              }}
              className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-neutral-700 hover:border-accent-500 hover:bg-accent-50"
            >
              {s.libelle}
            </button>
          ))}
        </div>
      )}

      {erreur && <p className="mb-2 rounded-md bg-red-50 p-2 text-xs text-red-800">{erreur}</p>}

      {recherche && (
        <>
          <p className="mb-2 text-xs text-neutral-500">
            {recherche.total === 0 ? `Aucun son pour « ${recherche.requete} ».` : `${recherche.total.toLocaleString("fr-FR")} sons pour « ${recherche.requete} ». Clique pour poser, ou glisse dans la frise.`}
          </p>
          {recherche.sons.map((s) => (
            <LigneFreesound key={s.id} son={s} genre={recherche.genre} />
          ))}
          {plus && (
            <button disabled={occupe} onClick={() => void lancer(recherche.requete, recherche.genre, recherche.page + 1)} className="mt-1 w-full rounded-lg border border-neutral-300 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60">
              {occupe ? "Recherche…" : "Plus de sons"}
            </button>
          )}
        </>
      )}
      {occupe && !recherche && (
        <p className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
          <Loader2 size={14} className="animate-spin" /> Recherche…
        </p>
      )}
    </div>
  );
}
