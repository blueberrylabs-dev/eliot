// Le panneau Photos : photos et vidéos libres de Pixabay et de Pexels (étape 7, lot 5), une même
// recherche pour les deux, la banque choisie par deux boutons. La recherche, les aperçus et le
// téléchargement passent par le Rust, qui seul connaît les clés (BRIEF, règle 12). Rien ne part
// sur le réseau avant qu'Alexandre lance une recherche. Un clic pose la photo au centre de la
// page (ou dans le cadre choisi), un glisser la pose sous le pointeur ou dans le cadre lâché
// dessous. Les vidéos sont dans `SectionVideosPixabay.tsx`.

import { Loader2, RotateCw, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as PointeurReact, type ReactNode } from "react";
import { useEditeur } from "../../etat/editeur";
import { useMarque } from "../../etat/marque";
import { NOMS_SOURCES, telechargerPhoto, type SourcePhotos } from "../../etat/photos";
import { creerImage } from "../../modele/fabriques";
import type { Ressource } from "../../modele/types";
import { chercherPexels, chercherPixabay, etatPexels, etatPixabay, ouvrirLien, urlApercuPexels, urlApercuPixabay, type EtatPixabay, type OrientationPexels } from "../../pont/tauri";
import { glisserDepuisPanneau } from "../glisser";
import { SectionVideos } from "./SectionVideosPixabay";

const SUGGESTIONS = ["café", "bureau", "nature", "ville", "plage", "cuisine", "sport", "mode", "technologie", "fleurs", "texture", "fond flou"];

/** Les couleurs que les banques savent filtrer, avec leur nom français ; `pexels` : le nom que
 *  Pexels leur donne (absent : Pexels ne la filtre pas). */
const COULEURS: { id: string; nom: string; fond: string; pexels?: string }[] = [
  { id: "red", nom: "Rouge", fond: "#e53935", pexels: "red" },
  { id: "orange", nom: "Orange", fond: "#fb8c00", pexels: "orange" },
  { id: "yellow", nom: "Jaune", fond: "#fdd835", pexels: "yellow" },
  { id: "green", nom: "Vert", fond: "#43a047", pexels: "green" },
  { id: "turquoise", nom: "Turquoise", fond: "#26a69a", pexels: "turquoise" },
  { id: "blue", nom: "Bleu", fond: "#1e88e5", pexels: "blue" },
  { id: "lilac", nom: "Lilas", fond: "#b39ddb", pexels: "violet" },
  { id: "pink", nom: "Rose", fond: "#f48fb1", pexels: "pink" },
  { id: "white", nom: "Blanc", fond: "#ffffff", pexels: "white" },
  { id: "gray", nom: "Gris", fond: "#9e9e9e", pexels: "gray" },
  { id: "black", nom: "Noir", fond: "#212121", pexels: "black" },
  { id: "brown", nom: "Marron", fond: "#8d6e63", pexels: "brown" },
  { id: "grayscale", nom: "Noir et blanc", fond: "linear-gradient(135deg, #fff 0 50%, #222 50% 100%)" },
];

export type OrientationPhotos = "paysage" | "portrait" | "carre";

/** Les filtres du panneau, les mêmes pour les deux banques : chacune reçoit ce qu'elle sait
 *  filtrer. `couleur` : un nom de la liste, ou un code #rrggbb (une couleur de la marque, que
 *  seul Pexels sait chercher). */
export interface FiltresPhotos {
  orientation?: OrientationPhotos;
  couleur?: string;
}

/** Une photo trouvée, d'une banque ou de l'autre. */
export interface PhotoTrouvee {
  id: number;
  largeur: number;
  hauteur: number;
  auteur: string;
  lien: string;
  mots: string;
  lienAuteur?: string;
  couleur?: string;
}

const ORIENTATION_PEXELS: Record<OrientationPhotos, OrientationPexels> = { paysage: "landscape", portrait: "portrait", carre: "square" };

/** Ce qui change d'une banque à l'autre. */
interface Banque {
  etat: () => Promise<EtatPixabay | null>;
  chercher: (requete: string, page: number, f: FiltresPhotos) => Promise<{ total: number; photos: PhotoTrouvee[] }>;
  apercu: (id: number) => Promise<string>;
  cle: string;
  site: string;
  /** Les orientations qu'elle sait filtrer. */
  orientations: OrientationPhotos[];
  /** Elle sait chercher une couleur donnée en #rrggbb. */
  couleurLibre: boolean;
  couleurs: typeof COULEURS;
}

export const BANQUES: Record<SourcePhotos, Banque> = {
  pixabay: {
    etat: etatPixabay,
    chercher: (requete, page, f) =>
      chercherPixabay(requete, page, {
        orientation: f.orientation === "paysage" ? "horizontal" : f.orientation === "portrait" ? "vertical" : undefined,
        couleur: f.couleur && !f.couleur.startsWith("#") ? f.couleur : undefined,
      }),
    apercu: urlApercuPixabay,
    cle: "PIXABAY_API_KEY",
    site: "https://pixabay.com/",
    orientations: ["paysage", "portrait"],
    couleurLibre: false,
    couleurs: COULEURS,
  },
  pexels: {
    etat: etatPexels,
    chercher: (requete, page, f) =>
      chercherPexels(requete, page, {
        orientation: f.orientation ? ORIENTATION_PEXELS[f.orientation] : undefined,
        couleur: f.couleur?.startsWith("#") ? f.couleur : COULEURS.find((c) => c.id === f.couleur)?.pexels,
      }),
    apercu: urlApercuPexels,
    cle: "PEXELS_API_KEY",
    site: "https://www.pexels.com/",
    orientations: ["paysage", "portrait", "carre"],
    couleurLibre: true,
    couleurs: COULEURS.filter((c) => c.pexels),
  },
};

const PAR_PAGE = 40;
const PAGES_MAX = 12;

interface Recherche {
  requete: string;
  filtres: FiltresPhotos;
  photos: PhotoTrouvee[];
  total: number;
  page: number;
}

const CLE_SOURCE = "eliot-source-photos";

function lireSource(): SourcePhotos {
  try {
    return localStorage.getItem(CLE_SOURCE) === "pexels" ? "pexels" : "pixabay";
  } catch {
    return "pixabay";
  }
}

// La dernière recherche de chaque banque reste là quand on passe d'un onglet à l'autre.
const memoire: Record<SourcePhotos, Recherche | null> = { pixabay: null, pexels: null };
let genreMemoire: "photos" | "videos" = "photos";
let sourceMemoire: SourcePhotos | null = null;

/** Deux boutons côte à côte (Photos ou Vidéos ; Pixabay ou Pexels). */
function Bascule<T extends string>({ choix, valeur, choisir, donnee, petit = false }: { choix: { id: T; libelle: string; titre?: string }[]; valeur: T; choisir: (v: T) => void; donnee: string; petit?: boolean }) {
  return (
    <div className={`flex gap-1 rounded-lg bg-neutral-100 p-1 ${petit ? "mb-2" : "mb-2"}`}>
      {choix.map((c) => (
        <button
          key={c.id}
          {...{ [`data-${donnee}`]: c.id }}
          title={c.titre}
          onClick={() => choisir(c.id)}
          aria-pressed={valeur === c.id}
          className={`flex-1 rounded-md ${petit ? "py-1 text-[11px]" : "py-1.5 text-xs"} font-medium ${valeur === c.id ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"}`}
        >
          {c.libelle}
        </button>
      ))}
    </div>
  );
}

/** Ce qu'une banque permet et interdit, et le lien bien visible vers elle (Pexels le demande). */
export function MentionBanque({ source, genre }: { source: SourcePhotos; genre: "photos" | "videos" }) {
  const lien = (
    <button data-lien-banque={source} onClick={() => void ouvrirLien(source === "pexels" ? "https://www.pexels.com/" : genre === "videos" ? "https://pixabay.com/videos/" : "https://pixabay.com/")} className="font-medium text-accent-700 hover:underline">
      {NOMS_SOURCES[source]}
    </button>
  );
  const quoi = genre === "videos" ? "Vidéos" : "Photos";
  if (source === "pexels")
    return (
      <p className="mb-3 text-[11px] text-neutral-500">
        {quoi} fournies par {lien}
        {genre === "videos"
          ? " : gratuites, sans obligation de citer le vidéaste (Eliot garde son nom et sa page avec la vidéo, comme Pexels le demande). Les vidéos de Pexels n'ont pas de son. Interdit : les revendre telles quelles, s'en servir dans une marque, laisser croire que les personnes filmées approuvent ton produit."
          : " : gratuites, sans obligation de citer le photographe (Eliot garde son nom et sa page avec la photo, comme Pexels le demande). Interdit : les revendre telles quelles, s'en servir dans un logo ou une marque, laisser croire que les personnes montrées approuvent ton produit."}
      </p>
    );
  return (
    <p className="mb-3 text-[11px] text-neutral-500">
      {quoi} libres de {lien}
      {genre === "videos"
        ? " : gratuites, sans obligation de citer l'auteur (Eliot garde son nom avec la vidéo). Interdit : les revendre telles quelles. Une vidéo se télécharge en 1080p, puis Eliot la prépare : compte quelques secondes."
        : " : gratuites, sans obligation de citer l'auteur (Eliot garde quand même son nom avec la photo). Interdit : en faire un logo ou un nom de marque, les revendre telles quelles. Prudence avec les visages et les marques reconnaissables."}
    </p>
  );
}

/** La clé manque : où l'ajouter (un chemin et un nom, jamais une valeur). */
export function CleManquante({ source, etat, reessayer, autre }: { source: SourcePhotos; etat: EtatPixabay; reessayer: () => void; autre?: ReactNode }) {
  const banque = BANQUES[source];
  return (
    <div data-cle-manquante={source}>
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        <p className="mb-2 font-medium">Il manque la clé {NOMS_SOURCES[source]}.</p>
        <p className="mb-1">Ajoute cette ligne, avec ta clé, dans le fichier :</p>
        <p className="mb-1 font-mono break-all">{etat.fichier}</p>
        <p className="mb-2 rounded bg-white px-2 py-1 font-mono">{banque.cle}=ta_clé</p>
        {source === "pexels" && (
          <p className="mb-2">
            Une clé gratuite se demande sur{" "}
            <button onClick={() => void ouvrirLien("https://www.pexels.com/api/")} className="font-medium underline">
              pexels.com/api
            </button>
            , avec un compte Pexels. Pexels peut suspendre la délivrance des nouvelles clés un temps.
          </p>
        )}
        <p>La clé reste sur ton poste : Eliot la lit côté Rust et ne l'affiche jamais.</p>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <button data-reessayer-cle onClick={reessayer} className="flex items-center gap-1.5 text-xs font-medium text-accent-700 hover:underline">
          <RotateCw size={14} /> Réessayer
        </button>
        {autre}
      </div>
    </div>
  );
}

function CartePhoto({ photo, source }: { photo: PhotoTrouvee; source: SourcePhotos }) {
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
        BANQUES[source].apercu(photo.id).then(
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
  }, [photo.id, source]);

  const debut = (e: PointeurReact<HTMLButtonElement>) => {
    if (occupe) return;
    // Un seul téléchargement par geste, que la photo aille sur la page ou dans un cadre.
    let promesse: Promise<Ressource> | null = null;
    const telecharger = () => {
      if (!promesse) {
        setOccupe(true);
        promesse = telechargerPhoto(source, photo.id).finally(() => setOccupe(false));
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

  const credit = source === "pexels" ? `Photo de ${photo.auteur} sur Pexels` : photo.auteur;
  return (
    <button
      ref={carte}
      data-photo={photo.id}
      data-source={source}
      title={`${photo.mots} (${source === "pexels" ? credit.charAt(0).toLowerCase() + credit.slice(1) : `photo de ${photo.auteur}`})`}
      onPointerDown={debut}
      className="group relative mb-2 block w-full cursor-grab overflow-hidden rounded-lg bg-neutral-100 hover:ring-2 hover:ring-accent-500"
      style={{ aspectRatio: `${photo.largeur} / ${photo.hauteur}`, ...(photo.couleur ? { background: photo.couleur } : {}) }}
    >
      {url && <img src={url} alt={photo.mots} draggable={false} className="h-full w-full object-cover" />}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-2 pt-4 pb-1 text-left text-[11px] text-white opacity-0 group-hover:opacity-100">
        {credit}
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
  const [source, setSource] = useState<SourcePhotos>(() => (sourceMemoire ??= lireSource()));
  const [etats, setEtats] = useState<Partial<Record<SourcePhotos, EtatPixabay | null>>>({});
  const etat = etats[source];
  const [genre, setGenre] = useState(genreMemoire);
  const choisirGenre = (g: "photos" | "videos") => {
    genreMemoire = g;
    setGenre(g);
  };
  const [saisie, setSaisie] = useState(memoire[source]?.requete ?? "");
  const [filtres, setFiltres] = useState<FiltresPhotos>(memoire[source]?.filtres ?? {});
  const [recherche, setRecherche] = useState<Recherche | null>(memoire[source]);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const couleursMarque = useMarque((s) => s.kit.couleurs);

  const verifier = (s: SourcePhotos = source) => {
    setEtats((e) => ({ ...e, [s]: undefined }));
    BANQUES[s].etat().then(
      (r) => setEtats((e) => ({ ...e, [s]: r })),
      () => setEtats((e) => ({ ...e, [s]: null })),
    );
  };
  useEffect(() => verifier(source), [source]); // eslint-disable-line react-hooks/exhaustive-deps

  const lancer = async (requete: string, f: FiltresPhotos, page = 1, s: SourcePhotos = source) => {
    if (!requete.trim()) return;
    setOccupe(true);
    setErreur(null);
    try {
      const resultat = await BANQUES[s].chercher(requete.trim(), page, f);
      const avant = memoire[s];
      const suite: Recherche =
        page === 1 || !avant
          ? { requete: requete.trim(), filtres: f, photos: resultat.photos, total: resultat.total, page }
          : { ...avant, photos: [...avant.photos, ...resultat.photos.filter((p) => !avant.photos.some((q) => q.id === p.id))], page };
      memoire[s] = suite;
      if (s === sourceMemoire) setRecherche(suite);
    } catch (e) {
      if (s === sourceMemoire) setErreur(String(e));
    } finally {
      setOccupe(false);
    }
  };

  /** L'autre banque : sa dernière recherche, ou la même requête relancée chez elle. */
  const choisirSource = (s: SourcePhotos) => {
    if (s === source) return;
    sourceMemoire = s;
    try {
      localStorage.setItem(CLE_SOURCE, s);
    } catch {
      // Sans stockage, le choix vaut le temps de la session.
    }
    setSource(s);
    setErreur(null);
    // Un filtre que l'autre banque ne connaît pas est retiré.
    const f: FiltresPhotos = {
      orientation: filtres.orientation && BANQUES[s].orientations.includes(filtres.orientation) ? filtres.orientation : undefined,
      couleur: filtres.couleur && (filtres.couleur.startsWith("#") ? BANQUES[s].couleurLibre : BANQUES[s].couleurs.some((c) => c.id === filtres.couleur)) ? filtres.couleur : undefined,
    };
    setFiltres(f);
    const garde = memoire[s];
    if (garde && garde.requete === saisie.trim()) setRecherche(garde);
    else {
      setRecherche(null);
      memoire[s] = null;
      if (saisie.trim() && genre === "photos") {
        BANQUES[s].etat().then(
          (r) => r?.cle && void lancer(saisie, f, 1, s),
          () => undefined,
        );
      }
    }
  };

  const changerFiltres = (f: FiltresPhotos) => {
    setFiltres(f);
    if (recherche) void lancer(recherche.requete, f);
  };

  const bascules = (
    <>
      <Bascule
        donnee="genre-photos"
        valeur={genre}
        choisir={choisirGenre}
        choix={[
          { id: "photos", libelle: "Photos" },
          { id: "videos", libelle: "Vidéos" },
        ]}
      />
      <Bascule
        petit
        donnee="source-photos"
        valeur={source}
        choisir={choisirSource}
        choix={[
          { id: "pixabay", libelle: "Pixabay", titre: "Les photos et les vidéos libres de Pixabay" },
          { id: "pexels", libelle: "Pexels", titre: "Les photos et les vidéos libres de Pexels (avec la clé PEXELS_API_KEY)" },
        ]}
      />
    </>
  );

  if (etat === undefined)
    return (
      <div>
        {bascules}
        <p className="text-sm text-neutral-500">Photos…</p>
      </div>
    );

  if (etat === null) {
    return (
      <div>
        {bascules}
        <p className="text-xs text-neutral-600">Les photos et les vidéos de {NOMS_SOURCES[source]} ne s'ouvrent que dans la fenêtre Eliot : c'est le Rust qui garde la clé et va les chercher.</p>
      </div>
    );
  }

  if (!etat.cle) {
    const autre: SourcePhotos = source === "pexels" ? "pixabay" : "pexels";
    return (
      <div>
        {bascules}
        <CleManquante
          source={source}
          etat={etat}
          reessayer={() => verifier()}
          autre={
            <button onClick={() => choisirSource(autre)} className="text-xs text-neutral-600 hover:text-neutral-900 hover:underline">
              Voir celles de {NOMS_SOURCES[autre]}
            </button>
          }
        />
      </div>
    );
  }

  if (genre === "videos") {
    return (
      <div>
        {bascules}
        <SectionVideos key={source} source={source} />
      </div>
    );
  }

  const banque = BANQUES[source];
  const plus = recherche && recherche.photos.length < recherche.total && recherche.page < PAGES_MAX && recherche.photos.length >= recherche.page * PAR_PAGE;
  const pastille = (id: string, nom: string, fond: string) => (
    <button
      key={id}
      title={nom}
      data-couleur-photos={id}
      onClick={() => changerFiltres({ ...filtres, couleur: filtres.couleur === id ? undefined : id })}
      className={`h-4 w-4 rounded-full border ${filtres.couleur === id ? "border-accent-600 ring-2 ring-accent-300" : "border-neutral-300"}`}
      style={{ background: fond }}
    />
  );

  return (
    <div>
      {bascules}
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
              memoire[source] = null;
            }}
            className="absolute top-2 right-2 text-neutral-400 hover:text-neutral-700"
          >
            <X size={16} />
          </button>
        )}
      </form>

      <div className="mb-2 flex items-start gap-2">
        <select
          title="Orientation"
          data-orientation-photos
          value={filtres.orientation ?? ""}
          onChange={(e) => changerFiltres({ ...filtres, orientation: (e.target.value || undefined) as OrientationPhotos | undefined })}
          className="h-7 shrink-0 rounded-md border border-neutral-300 bg-white px-1 text-xs"
        >
          <option value="">Toutes</option>
          <option value="paysage">Paysage</option>
          <option value="portrait">Portrait</option>
          {banque.orientations.includes("carre") && <option value="carre">Carré</option>}
        </select>
        <div className="flex flex-wrap gap-1 pt-1.5">{banque.couleurs.map((c) => pastille(c.id, c.nom, c.fond))}</div>
      </div>
      {banque.couleurLibre && couleursMarque.length > 0 && (
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-[11px] text-neutral-500">Couleurs de la marque :</span>
          {couleursMarque.slice(0, 8).map((c) => pastille(c.valeur.toLowerCase(), `${c.nom || c.valeur} (couleur de la marque)`, c.valeur))}
        </div>
      )}

      <MentionBanque source={source} genre="photos" />

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
              <CartePhoto key={p.id} photo={p} source={source} />
            ))}
          </div>
          {plus && (
            <button disabled={occupe} onClick={() => void lancer(recherche.requete, recherche.filtres, recherche.page + 1)} className="mt-2 w-full rounded-lg border border-neutral-300 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60">
              {occupe ? "Recherche…" : "Plus de photos"}
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
