// Le panneau Photos : photos et vidéos libres de Pixabay. La recherche, les aperçus et le
// téléchargement passent par le Rust, qui seul connaît la clé (BRIEF, règle 12). Rien ne part
// sur le réseau avant qu'Alexandre lance une recherche. Un clic pose la photo au centre de la
// page (ou dans le cadre choisi), un glisser la pose sous le pointeur ou dans le cadre lâché
// dessous. Les vidéos sont dans `SectionVideosPixabay.tsx`.

import { Loader2, RotateCw, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as PointeurReact } from "react";
import { useEditeur } from "../../etat/editeur";
import { telechargerPhotoPixabay } from "../../etat/photos";
import { creerImage } from "../../modele/fabriques";
import type { Ressource } from "../../modele/types";
import { chercherPixabay, etatPixabay, ouvrirLien, urlApercuPixabay, type EtatPixabay, type FiltresPixabay, type PhotoPixabay } from "../../pont/tauri";
import { glisserDepuisPanneau } from "../glisser";
import { SectionVideosPixabay } from "./SectionVideosPixabay";

const SUGGESTIONS = ["café", "bureau", "nature", "ville", "plage", "cuisine", "sport", "mode", "technologie", "fleurs", "texture", "fond flou"];

/** Les couleurs que Pixabay sait filtrer, avec leur nom français. */
const COULEURS: { id: string; nom: string; fond: string }[] = [
  { id: "red", nom: "Rouge", fond: "#e53935" },
  { id: "orange", nom: "Orange", fond: "#fb8c00" },
  { id: "yellow", nom: "Jaune", fond: "#fdd835" },
  { id: "green", nom: "Vert", fond: "#43a047" },
  { id: "turquoise", nom: "Turquoise", fond: "#26a69a" },
  { id: "blue", nom: "Bleu", fond: "#1e88e5" },
  { id: "lilac", nom: "Lilas", fond: "#b39ddb" },
  { id: "pink", nom: "Rose", fond: "#f48fb1" },
  { id: "white", nom: "Blanc", fond: "#ffffff" },
  { id: "gray", nom: "Gris", fond: "#9e9e9e" },
  { id: "black", nom: "Noir", fond: "#212121" },
  { id: "brown", nom: "Marron", fond: "#8d6e63" },
  { id: "grayscale", nom: "Noir et blanc", fond: "linear-gradient(135deg, #fff 0 50%, #222 50% 100%)" },
];

const PAR_PAGE = 40;
const PAGES_MAX = 12;

interface Recherche {
  requete: string;
  filtres: FiltresPixabay;
  photos: PhotoPixabay[];
  total: number;
  page: number;
}

// La dernière recherche reste là quand on passe d'un onglet à l'autre.
let memoire: Recherche | null = null;
let genreMemoire: "photos" | "videos" = "photos";

/** Photos ou vidéos : deux boutons en haut du panneau. */
function Bascule({ genre, choisir }: { genre: "photos" | "videos"; choisir: (g: "photos" | "videos") => void }) {
  const bouton = (g: "photos" | "videos", libelle: string) => (
    <button
      onClick={() => choisir(g)}
      aria-pressed={genre === g}
      className={`flex-1 rounded-md py-1.5 text-xs font-medium ${genre === g ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"}`}
    >
      {libelle}
    </button>
  );
  return (
    <div className="mb-3 flex gap-1 rounded-lg bg-neutral-100 p-1">
      {bouton("photos", "Photos")}
      {bouton("videos", "Vidéos")}
    </div>
  );
}

function CartePhoto({ photo }: { photo: PhotoPixabay }) {
  const [url, setUrl] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const carte = useRef<HTMLButtonElement>(null);

  // L'aperçu n'est demandé que quand la carte approche de la zone visible.
  useEffect(() => {
    const noeud = carte.current;
    if (!noeud) return;
    let actif = true;
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (!entrees.some((e) => e.isIntersecting)) return;
        observateur.disconnect();
        urlApercuPixabay(photo.id).then(
          (u) => actif && setUrl(u),
          () => undefined,
        );
      },
      { rootMargin: "300px" },
    );
    observateur.observe(noeud);
    return () => {
      actif = false;
      observateur.disconnect();
    };
  }, [photo.id]);

  const debut = (e: PointeurReact<HTMLButtonElement>) => {
    if (occupe) return;
    // Un seul téléchargement par geste, que la photo aille sur la page ou dans un cadre.
    let promesse: Promise<Ressource> | null = null;
    const telecharger = () => {
      if (!promesse) {
        setOccupe(true);
        promesse = telechargerPhotoPixabay(photo.id).finally(() => setOccupe(false));
        promesse.catch((erreur) => useEditeur.getState().notifier(`Photo non téléchargée : ${String(erreur)}`, { erreur: true }));
      }
      return promesse;
    };
    glisserDepuisPanneau(
      e,
      async (format) => {
        try {
          return [creerImage(format, await telecharger())];
        } catch {
          return [];
        }
      },
      { photo: () => telecharger().then((r) => r.id, () => null) },
    );
  };

  return (
    <button
      ref={carte}
      data-photo={photo.id}
      title={`${photo.mots} (photo de ${photo.auteur})`}
      onPointerDown={debut}
      className="group relative mb-2 block w-full cursor-grab overflow-hidden rounded-lg bg-neutral-100 hover:ring-2 hover:ring-accent-500"
      style={{ aspectRatio: `${photo.largeur} / ${photo.hauteur}` }}
    >
      {url && <img src={url} alt={photo.mots} draggable={false} className="h-full w-full object-cover" />}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-2 pt-4 pb-1 text-left text-[11px] text-white opacity-0 group-hover:opacity-100">
        {photo.auteur}
      </span>
      {occupe && (
        <span className="absolute inset-0 flex items-center justify-center bg-white/60">
          <Loader2 size={22} className="animate-spin text-accent-700" />
        </span>
      )}
    </button>
  );
}

export function PanneauPhotos() {
  const [etat, setEtat] = useState<EtatPixabay | null | undefined>(undefined);
  const [genre, setGenre] = useState(genreMemoire);
  const choisirGenre = (g: "photos" | "videos") => {
    genreMemoire = g;
    setGenre(g);
  };
  const [saisie, setSaisie] = useState(memoire?.requete ?? "");
  const [filtres, setFiltres] = useState<FiltresPixabay>(memoire?.filtres ?? {});
  const [recherche, setRecherche] = useState<Recherche | null>(memoire);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const verifier = () => {
    setEtat(undefined);
    etatPixabay().then(setEtat, () => setEtat(null));
  };
  useEffect(verifier, []);

  const lancer = async (requete: string, f: FiltresPixabay, page = 1) => {
    if (!requete.trim()) return;
    setOccupe(true);
    setErreur(null);
    try {
      const resultat = await chercherPixabay(requete.trim(), page, f);
      const suite: Recherche =
        page === 1 || !recherche
          ? { requete: requete.trim(), filtres: f, photos: resultat.photos, total: resultat.total, page }
          : { ...recherche, photos: [...recherche.photos, ...resultat.photos.filter((p) => !recherche.photos.some((q) => q.id === p.id))], page };
      memoire = suite;
      setRecherche(suite);
    } catch (e) {
      setErreur(String(e));
    } finally {
      setOccupe(false);
    }
  };

  const changerFiltres = (f: FiltresPixabay) => {
    setFiltres(f);
    if (recherche) void lancer(recherche.requete, f);
  };

  if (etat === undefined) return <p className="text-sm text-neutral-500">Photos…</p>;

  if (etat === null) {
    return (
      <div>
        <p className="mb-2 text-sm font-semibold text-neutral-800">Photos</p>
        <p className="text-xs text-neutral-600">Les photos et les vidéos de Pixabay ne s'ouvrent que dans la fenêtre Eliot : c'est le Rust qui garde la clé et va les chercher.</p>
      </div>
    );
  }

  if (!etat.cle) {
    return (
      <div>
        <p className="mb-2 text-sm font-semibold text-neutral-800">Photos</p>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="mb-2 font-medium">Il manque la clé Pixabay.</p>
          <p className="mb-1">Ajoute cette ligne, avec ta clé, dans le fichier :</p>
          <p className="mb-1 font-mono break-all">{etat.fichier}</p>
          <p className="mb-2 rounded bg-white px-2 py-1 font-mono">PIXABAY_API_KEY=ta_clé</p>
          <p>La clé reste sur ton poste : Eliot la lit côté Rust et ne l'affiche jamais.</p>
        </div>
        <button onClick={verifier} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-accent-700 hover:underline">
          <RotateCw size={14} /> Réessayer
        </button>
      </div>
    );
  }

  const plus = recherche && recherche.photos.length < recherche.total && recherche.page < PAGES_MAX && recherche.photos.length >= recherche.page * PAR_PAGE;

  if (genre === "videos") {
    return (
      <div>
        <Bascule genre={genre} choisir={choisirGenre} />
        <SectionVideosPixabay />
      </div>
    );
  }

  return (
    <div>
      <Bascule genre={genre} choisir={choisirGenre} />
      <form
        className="relative mb-2"
        onSubmit={(e) => {
          e.preventDefault();
          void lancer(saisie, filtres);
        }}
      >
        <Search size={16} className="absolute top-2.5 left-2.5 text-neutral-400" />
        <input value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder="Chercher des photos : café, plage…" className="h-9 w-full rounded-lg border border-neutral-300 pr-8 pl-8 text-sm outline-none focus:border-accent-500" />
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

      <div className="mb-2 flex items-center gap-2">
        <select
          title="Orientation"
          value={filtres.orientation ?? ""}
          onChange={(e) => changerFiltres({ ...filtres, orientation: (e.target.value || undefined) as FiltresPixabay["orientation"] })}
          className="h-7 rounded-md border border-neutral-300 bg-white px-1 text-xs"
        >
          <option value="">Toutes</option>
          <option value="horizontal">Paysage</option>
          <option value="vertical">Portrait</option>
        </select>
        <div className="flex flex-wrap gap-1">
          {COULEURS.map((c) => (
            <button
              key={c.id}
              title={c.nom}
              onClick={() => changerFiltres({ ...filtres, couleur: filtres.couleur === c.id ? undefined : c.id })}
              className={`h-4 w-4 rounded-full border ${filtres.couleur === c.id ? "border-accent-600 ring-2 ring-accent-300" : "border-neutral-300"}`}
              style={{ background: c.fond }}
            />
          ))}
        </div>
      </div>

      <p className="mb-3 text-[11px] text-neutral-500">
        Photos libres de{" "}
        <button onClick={() => void ouvrirLien("https://pixabay.com/")} className="font-medium text-accent-700 hover:underline">
          Pixabay
        </button>
        {"\u00a0: gratuites, sans obligation de citer l'auteur (Eliot garde quand même son nom avec la photo). Interdit : en faire un logo ou un nom de marque, les revendre telles quelles. Prudence avec les visages et les marques reconnaissables."}
      </p>

      {!recherche && !occupe && (
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setSaisie(s);
                void lancer(s, filtres);
              }}
              className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-neutral-700 hover:border-accent-500 hover:bg-accent-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {erreur && <p className="mb-2 rounded-md bg-red-50 p-2 text-xs text-red-800">{erreur}</p>}

      {recherche && (
        <>
          <p className="mb-2 text-xs text-neutral-500">
            {recherche.total === 0 ? `Aucune photo pour « ${recherche.requete} ».` : `${recherche.total.toLocaleString("fr-FR")} photos pour « ${recherche.requete} ». Clique pour poser, ou glisse sur la page ou dans un cadre.`}
          </p>
          <div className="columns-2 gap-2">
            {recherche.photos.map((p) => (
              <CartePhoto key={p.id} photo={p} />
            ))}
          </div>
          {plus && (
            <button disabled={occupe} onClick={() => void lancer(recherche.requete, recherche.filtres, recherche.page + 1)} className="mt-2 w-full rounded-lg border border-neutral-300 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60">
              {occupe ? "Recherche…" : "Plus de photos"}
            </button>
          )}
        </>
      )}
      {occupe && !recherche && <p className="mt-3 flex items-center gap-2 text-xs text-neutral-500"><Loader2 size={14} className="animate-spin" /> Recherche…</p>}
    </div>
  );
}
