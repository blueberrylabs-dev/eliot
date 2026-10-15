// Les vidéos libres de Pixabay, dans le panneau Photos (étape 4). Comme pour les photos, tout
// passe par le Rust, qui seul connaît la clé. Un clic télécharge la vidéo (1080p), la prépare
// et la pose au centre ; un glisser la pose sous le pointeur.

import { Film, Loader2, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as PointeurReact } from "react";
import { useEditeur } from "../../etat/editeur";
import { telechargerVideoPixabay } from "../../etat/photos";
import { creerVideo } from "../../modele/fabriques";
import type { Ressource } from "../../modele/types";
import { chercherVideosPixabay, ouvrirLien, urlApercuVideoPixabay, type VideoPixabay } from "../../pont/tauri";
import { glisserDepuisPanneau } from "../glisser";
import { dureeLisible } from "../videos";

const SUGGESTIONS = ["mer", "ville la nuit", "nature", "café", "bureau", "sport", "nuages", "fumée", "particules", "fond abstrait", "cuisine", "voyage"];
const PAR_PAGE = 40;
const PAGES_MAX = 12;

type Orientation = "toutes" | "paysage" | "portrait";

interface Recherche {
  requete: string;
  videos: VideoPixabay[];
  total: number;
  page: number;
}

// La dernière recherche reste là quand on change d'onglet.
let memoire: Recherche | null = null;
let orientationMemoire: Orientation = "toutes";

function CarteVideo({ video }: { video: VideoPixabay }) {
  const [url, setUrl] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const carte = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const noeud = carte.current;
    if (!noeud) return;
    let actif = true;
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (!entrees.some((e) => e.isIntersecting)) return;
        observateur.disconnect();
        urlApercuVideoPixabay(video.id).then(
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
  }, [video.id]);

  const debut = (e: PointeurReact<HTMLButtonElement>) => {
    if (occupe) return;
    let promesse: Promise<Ressource> | null = null;
    const telecharger = () => {
      if (!promesse) {
        setOccupe(true);
        promesse = telechargerVideoPixabay(video.id).finally(() => setOccupe(false));
        promesse.catch((erreur) => useEditeur.getState().notifier(`Vidéo non téléchargée : ${String(erreur)}`, { erreur: true }));
      }
      return promesse;
    };
    glisserDepuisPanneau(e, async (format) => {
      try {
        return [creerVideo(format, await telecharger())];
      } catch {
        return [];
      }
    });
  };

  return (
    <button
      ref={carte}
      data-video={video.id}
      title={`${video.mots} (vidéo de ${video.auteur}, ${dureeLisible(video.duree * 1000)})`}
      onPointerDown={debut}
      className="group relative mb-2 block w-full cursor-grab overflow-hidden rounded-lg bg-neutral-800 hover:ring-2 hover:ring-accent-500"
      style={{ aspectRatio: `${video.largeur} / ${video.hauteur}` }}
    >
      {url && <img src={url} alt={video.mots} draggable={false} className="h-full w-full object-cover" />}
      <span className="pointer-events-none absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums">
        <Film size={11} /> {dureeLisible(video.duree * 1000)}
      </span>
      {occupe && (
        <span className="absolute inset-0 flex items-center justify-center bg-white/60">
          <Loader2 size={22} className="animate-spin text-accent-700" />
        </span>
      )}
    </button>
  );
}

export function SectionVideosPixabay() {
  const [saisie, setSaisie] = useState(memoire?.requete ?? "");
  const [recherche, setRecherche] = useState<Recherche | null>(memoire);
  const [orientation, setOrientation] = useState<Orientation>(orientationMemoire);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const lancer = async (requete: string, page = 1) => {
    if (!requete.trim()) return;
    setOccupe(true);
    setErreur(null);
    try {
      const resultat = await chercherVideosPixabay(requete.trim(), page);
      const suite: Recherche =
        page === 1 || !recherche
          ? { requete: requete.trim(), videos: resultat.videos, total: resultat.total, page }
          : { ...recherche, videos: [...recherche.videos, ...resultat.videos.filter((v) => !recherche.videos.some((w) => w.id === v.id))], page };
      memoire = suite;
      setRecherche(suite);
    } catch (e) {
      setErreur(String(e));
    } finally {
      setOccupe(false);
    }
  };

  // Pixabay ne filtre pas les vidéos par orientation : le tri se fait ici, sur les résultats.
  const visibles = (recherche?.videos ?? []).filter((v) => orientation === "toutes" || (orientation === "portrait" ? v.hauteur > v.largeur : v.largeur >= v.hauteur));
  const plus = recherche && recherche.videos.length < recherche.total && recherche.page < PAGES_MAX && recherche.videos.length >= recherche.page * PAR_PAGE;

  return (
    <div>
      <form
        className="relative mb-2"
        onSubmit={(e) => {
          e.preventDefault();
          void lancer(saisie);
        }}
      >
        <Search size={16} className="absolute top-2.5 left-2.5 text-neutral-400" />
        <input value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder="Chercher des vidéos : mer, ville…" className="h-9 w-full rounded-lg border border-neutral-300 pr-8 pl-8 text-sm outline-none focus:border-accent-500" />
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

      <div className="mb-2">
        <select
          title="Orientation"
          value={orientation}
          onChange={(e) => {
            orientationMemoire = e.target.value as Orientation;
            setOrientation(orientationMemoire);
          }}
          className="h-7 rounded-md border border-neutral-300 bg-white px-1 text-xs"
        >
          <option value="toutes">Toutes</option>
          <option value="paysage">Paysage</option>
          <option value="portrait">Portrait (story)</option>
        </select>
      </div>

      <p className="mb-3 text-[11px] text-neutral-500">
        Vidéos libres de{" "}
        <button onClick={() => void ouvrirLien("https://pixabay.com/videos/")} className="font-medium text-accent-700 hover:underline">
          Pixabay
        </button>
        {" : gratuites, sans obligation de citer l'auteur (Eliot garde son nom avec la vidéo). Interdit : les revendre telles quelles. Une vidéo se télécharge en 1080p, puis Eliot la prépare : compte quelques secondes."}
      </p>

      {!recherche && !occupe && (
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setSaisie(s);
                void lancer(s);
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
            {recherche.total === 0 ? `Aucune vidéo pour « ${recherche.requete} ».` : `${recherche.total.toLocaleString("fr-FR")} vidéos pour « ${recherche.requete} ». Clique pour poser, ou glisse sur la page.`}
          </p>
          {orientation !== "toutes" && visibles.length === 0 && recherche.videos.length > 0 && <p className="mb-2 text-xs text-neutral-500">Aucune vidéo dans ce sens parmi celles chargées.</p>}
          <div className="columns-2 gap-2">
            {visibles.map((v) => (
              <CarteVideo key={v.id} video={v} />
            ))}
          </div>
          {plus && (
            <button disabled={occupe} onClick={() => void lancer(recherche.requete, recherche.page + 1)} className="mt-2 w-full rounded-lg border border-neutral-300 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60">
              {occupe ? "Recherche…" : "Plus de vidéos"}
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
