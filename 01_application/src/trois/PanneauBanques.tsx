// L'onglet 3D du rail (étape 6, lot 3) : les modèles des banques (Kenney sur le poste, Poly
// Haven, Sketchfab, et la marche à suivre pour Mixamo) et les environnements HDRI (Poly Haven,
// ou un fichier .hdr du poste). Un clic pose le modèle au centre, un glisser le pose sous le
// pointeur ; un environnement éclaire les objets 3D choisis. Le crédit de chaque modèle reste
// avec lui (panneau 3D, section Modèle).

import { Box, CloudDownload, ExternalLink, Loader2, Search, Sun, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as PointeurReact, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditeur } from "../etat/editeur";
import { glisserDepuisPanneau } from "../editeur/glisser";
import { useUrlRessource } from "../editeur/images";
import { avecSuivi, suiviFichiers } from "../editeur/SuiviImport";
import { creerObjet3d } from "../modele/fabriques";
import type { Ressource } from "../modele/types";
import {
  categoriesPolyHaven,
  chercherPolyHaven,
  chercherSketchfab,
  choisirEtImporterImages,
  dansTauri,
  etatSketchfab,
  ouvrirLien,
  urlApercuPolyHaven,
  urlApercuSketchfab,
  type CategoriePolyHaven,
  type ElementPolyHaven,
  type EtatPixabay,
  type GenrePolyHaven,
  type LicencesSketchfab,
  type ModeleSketchfab,
} from "../pont/tauri";
import { apercuKenney, catalogueKenney, CATEGORIES_FR, eclairer, objets3dChoisis, ranger, rangerEnvironnement, traduireRequete, useBanques, type PaquetKenney, type SourceModeles } from "./banques";

const notifier = (texte: string, erreur = false) => useEditeur.getState().notifier(texte, erreur ? { erreur: true } : undefined);
const puce = (actif: boolean) => `rounded-full border px-2.5 py-1 text-xs whitespace-nowrap ${actif ? "border-accent-500 bg-accent-50 font-medium text-accent-700" : "border-neutral-200 text-neutral-700 hover:border-neutral-400"}`;

/** Une image chargée quand sa carte approche de l'écran. */
function useApercuParesseux(charger: () => Promise<string>, cle: string) {
  const [url, setUrl] = useState<string | null>(null);
  const noeud = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const n = noeud.current;
    if (!n) return;
    let actif = true;
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (!entrees.some((e) => e.isIntersecting)) return;
        observateur.disconnect();
        charger().then(
          (u) => actif && setUrl(u),
          () => undefined,
        );
      },
      { rootMargin: "300px" },
    );
    observateur.observe(n);
    return () => {
      actif = false;
      observateur.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  return { url, noeud };
}

/** Une carte de modèle : clic pour poser au centre, glisser pour poser sous le pointeur ; le
 *  téléchargement n'a lieu qu'une fois. */
function CarteModele({ titre, sousTitre, badge, apercu, cle, ranger: rangerModele, petit, attribut }: { titre: string; sousTitre?: string; badge?: string; apercu: () => Promise<string>; cle: string; ranger: () => Promise<Ressource>; petit?: boolean; attribut: Record<string, string> }) {
  const { url, noeud } = useApercuParesseux(apercu, cle);
  const [occupe, setOccupe] = useState(false);
  const debut = (e: PointeurReact<HTMLButtonElement>) => {
    if (occupe) return;
    let promesse: Promise<Ressource> | null = null;
    const telecharger = () => {
      if (!promesse) {
        setOccupe(true);
        promesse = rangerModele().finally(() => setOccupe(false));
        promesse.catch((erreur) => notifier(`Modèle non importé : ${erreur instanceof Error ? erreur.message : String(erreur)}`, true));
      }
      return promesse;
    };
    glisserDepuisPanneau(e, async (format) => {
      try {
        return [creerObjet3d(format, await telecharger())];
      } catch {
        return [];
      }
    });
  };
  return (
    <button ref={noeud} {...attribut} title={[titre, sousTitre, badge].filter(Boolean).join(" · ")} onPointerDown={debut} className="group relative cursor-grab overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 text-left hover:border-accent-500">
      <span className={`flex items-center justify-center bg-[repeating-conic-gradient(#f3f3f3_0_25%,#fff_0_50%)] bg-[length:12px_12px] ${petit ? "h-16" : "h-24"}`}>
        {url ? <img src={url} alt="" className="h-full w-full object-contain" draggable={false} /> : <Box size={petit ? 18 : 24} className="text-neutral-300" />}
      </span>
      {!petit && (
        <span className="block px-1.5 py-1">
          <span className="block truncate text-[11px] font-medium text-neutral-800">{titre}</span>
          {sousTitre && <span className="block truncate text-[10px] text-neutral-500">{sousTitre}</span>}
        </span>
      )}
      {badge && <span className="absolute top-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-medium text-white">{badge}</span>}
      {occupe && (
        <span className="absolute inset-0 flex items-center justify-center bg-white/60">
          <Loader2 size={18} className="animate-spin text-accent-600" />
        </span>
      )}
    </button>
  );
}

function Recherche({ valeur, changer, lancer, indice }: { valeur: string; changer: (v: string) => void; lancer: () => void; indice: string }) {
  return (
    <form
      className="mb-2 flex items-center gap-1.5 rounded-lg border border-neutral-300 px-2 focus-within:border-accent-500"
      onSubmit={(e) => {
        e.preventDefault();
        lancer();
      }}
    >
      <Search size={15} className="text-neutral-400" />
      <input value={valeur} onChange={(e) => changer(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder={indice} className="h-8 flex-1 bg-transparent text-sm outline-none" data-recherche-3d />
    </form>
  );
}

// ----------------------------------------------------------------------------------------
// Kenney
// ----------------------------------------------------------------------------------------

function SectionKenney() {
  const [paquets, setPaquets] = useState<PaquetKenney[] | null>(null);
  const [paquet, setPaquet] = useState<string | null>(null);
  const [filtre, setFiltre] = useState("");
  useEffect(() => {
    void catalogueKenney().then((p) => {
      setPaquets(p);
      setPaquet((x) => x ?? p[0]?.id ?? null);
    });
  }, []);
  const courant = paquets?.find((p) => p.id === paquet);
  const modeles = useMemo(() => {
    const f = filtre.trim().toLowerCase();
    return (courant?.modeles ?? []).filter((m) => !f || m.nom.toLowerCase().includes(f) || traduireRequete(f).split(" ").some((t) => t && m.nom.toLowerCase().includes(t)));
  }, [courant, filtre]);
  if (paquets === null) return <p className="text-xs text-neutral-500">Lecture des paquets.</p>;
  if (paquets.length === 0)
    return (
      <div className="rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600" data-kenney-vide>
        <p className="mb-2 font-medium text-neutral-800">Aucun paquet de Kenney sur ce poste.</p>
        <p>
          Des centaines de modèles gratuits (licence CC0) : télécharger un paquet 3D sur kenney.nl (un fichier .zip), le ranger dans le dossier <code>telechargements/kenney/</code> d'Eliot, puis relancer <code>npm run bibliotheque</code>.
        </p>
        <button className="mt-2 flex items-center gap-1 text-accent-700 hover:underline" onClick={() => void ouvrirLien("https://kenney.nl/assets/category:3D")}>
          <ExternalLink size={12} /> kenney.nl, paquets 3D
        </button>
      </div>
    );
  return (
    <div data-kenney>
      <div className="mb-2 flex flex-wrap gap-1">
        {paquets.map((p) => (
          <button key={p.id} data-paquet-kenney={p.id} onClick={() => setPaquet(p.id)} className={puce(p.id === paquet)}>
            {p.nom} <span className="text-neutral-400">{p.modeles.length}</span>
          </button>
        ))}
      </div>
      <Recherche valeur={filtre} changer={setFiltre} lancer={() => undefined} indice="Filtrer : apple, chair…" />
      <div className="grid grid-cols-4 gap-1.5">
        {courant &&
          modeles.slice(0, 240).map((m) => (
            <CarteModele
              key={`${courant.id}/${m.id}`}
              cle={`${courant.id}/${m.id}`}
              attribut={{ "data-modele-kenney": m.id }}
              titre={m.nom}
              sousTitre={`Kenney, ${courant.nom}, CC0`}
              apercu={() => (m.apercu ? Promise.resolve(apercuKenney(courant.id, m.id)) : Promise.reject(new Error("sans aperçu")))}
              ranger={() => ranger("kenney", m.id, courant.id)}
              petit
            />
          ))}
      </div>
      <p className="mt-2 text-[11px] text-neutral-500">Modèles de Kenney (kenney.nl), licence CC0 : libres, le crédit est apprécié.</p>
    </div>
  );
}

// ----------------------------------------------------------------------------------------
// Poly Haven
// ----------------------------------------------------------------------------------------

function SectionPolyHaven({ genre }: { genre: GenrePolyHaven }) {
  const [saisie, setSaisie] = useState("");
  const [categorie, setCategorie] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoriePolyHaven[]>([]);
  const [resultats, setResultats] = useState<{ elements: ElementPolyHaven[]; total: number; page: number } | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const lancer = async (requete: string, cat: string | null, page = 1) => {
    setOccupe(true);
    setErreur(null);
    try {
      const r = await chercherPolyHaven(genre, traduireRequete(requete), cat, page);
      setResultats((avant) => (page === 1 || !avant ? { ...r, page } : { elements: [...avant.elements, ...r.elements], total: r.total, page }));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  };
  useEffect(() => {
    if (!dansTauri) return;
    categoriesPolyHaven(genre).then((c) => setCategories(c.filter((x) => CATEGORIES_FR[x.nom]).slice(0, 14)), () => undefined);
    void lancer("", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genre]);
  if (!dansTauri) return <p className="text-xs text-neutral-500">Poly Haven s'ouvre dans la fenêtre Eliot.</p>;
  const choisir = async (el: ElementPolyHaven) => {
    if (genre === "modeles") return;
    try {
      const r = await rangerEnvironnement(el.id);
      const n = eclairer(r.id);
      notifier(n ? `${el.nom} éclaire ${n > 1 ? `les ${n} objets 3D choisis` : "l'objet 3D choisi"}` : `${el.nom} est rangé dans le design : choisir un objet 3D, puis Vue 3D, Lumière`);
    } catch (e) {
      notifier(`Environnement non importé : ${e instanceof Error ? e.message : String(e)}`, true);
    }
  };
  return (
    <div data-polyhaven={genre}>
      <Recherche valeur={saisie} changer={setSaisie} lancer={() => void lancer(saisie, categorie)} indice={genre === "modeles" ? "Chercher : bouteille, chaise, plante…" : "Chercher : ciel, studio, ville, coucher de soleil…"} />
      {categories.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {categories.map((c) => (
            <button
              key={c.nom}
              data-categorie-3d={c.nom}
              onClick={() => {
                const suivante = categorie === c.nom ? null : c.nom;
                setCategorie(suivante);
                void lancer(saisie, suivante);
              }}
              className={puce(categorie === c.nom)}
            >
              {CATEGORIES_FR[c.nom] ?? c.nom}
            </button>
          ))}
        </div>
      )}
      {erreur && <p className="mb-2 text-xs text-red-600">{erreur}</p>}
      {resultats && resultats.total === 0 && <p className="text-xs text-neutral-500">Rien trouvé{saisie ? ` pour « ${saisie} »` : ""}.</p>}
      <div className={`grid gap-2 ${genre === "modeles" ? "grid-cols-2" : "grid-cols-2"}`}>
        {resultats?.elements.map((el) =>
          genre === "modeles" ? (
            <CarteModele
              key={el.id}
              cle={el.id}
              attribut={{ "data-modele-polyhaven": el.id }}
              titre={el.nom}
              sousTitre={el.auteur}
              apercu={() => urlApercuPolyHaven("modeles", el.id)}
              ranger={() => ranger("polyhaven", el.id)}
            />
          ) : (
            <CarteEnvironnement key={el.id} el={el} choisir={() => void choisir(el)} />
          ),
        )}
      </div>
      {resultats && resultats.elements.length < resultats.total && (
        <button disabled={occupe} onClick={() => void lancer(saisie, categorie, resultats.page + 1)} className="mt-2 w-full rounded-lg border border-neutral-300 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
          Plus ({resultats.total - resultats.elements.length})
        </button>
      )}
      {occupe && <Loader2 size={16} className="mx-auto mt-2 animate-spin text-accent-600" />}
      <p className="mt-2 text-[11px] text-neutral-500">{genre === "modeles" ? "Modèles" : "Environnements"} de Poly Haven (polyhaven.com), licence CC0 : libres, sans crédit obligatoire.</p>
    </div>
  );
}

function CarteEnvironnement({ el, choisir }: { el: ElementPolyHaven; choisir: () => void }) {
  const { url, noeud } = useApercuParesseux(() => urlApercuPolyHaven("environnements", el.id), el.id);
  const [occupe, setOccupe] = useState(false);
  return (
    <button
      ref={noeud}
      data-environnement-polyhaven={el.id}
      title={`${el.nom}, ${el.auteur} : un clic éclaire les objets 3D choisis`}
      onClick={async () => {
        setOccupe(true);
        try {
          await choisir();
        } finally {
          setOccupe(false);
        }
      }}
      className="relative overflow-hidden rounded-lg border border-neutral-200 text-left hover:border-accent-500"
    >
      <span className="block h-16 bg-neutral-100">{url && <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />}</span>
      <span className="block truncate px-1.5 py-1 text-[11px] font-medium text-neutral-800">{el.nom}</span>
      {occupe && (
        <span className="absolute inset-0 flex items-center justify-center bg-white/60">
          <Loader2 size={18} className="animate-spin text-accent-600" />
        </span>
      )}
    </button>
  );
}

// ----------------------------------------------------------------------------------------
// Sketchfab
// ----------------------------------------------------------------------------------------

const LICENCES: { id: LicencesSketchfab; nom: string }[] = [
  { id: "toutes", nom: "CC0 et CC BY" },
  { id: "cc0", nom: "CC0" },
  { id: "by", nom: "CC BY" },
];

function SectionSketchfab() {
  const [etat, setEtat] = useState<EtatPixabay | null | undefined>(undefined);
  const [saisie, setSaisie] = useState("");
  const [licences, setLicences] = useState<LicencesSketchfab>("toutes");
  const [animes, setAnimes] = useState(false);
  const [resultats, setResultats] = useState<{ modeles: ModeleSketchfab[]; suite: boolean; page: number; requete: string } | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    etatSketchfab().then(setEtat, () => setEtat(null));
  }, []);
  const lancer = async (requete: string, l: LicencesSketchfab, a: boolean, page = 1) => {
    if (!requete.trim()) return;
    setOccupe(true);
    setErreur(null);
    try {
      const r = await chercherSketchfab(traduireRequete(requete), l, a, page);
      setResultats((avant) => (page === 1 || !avant ? { ...r, page, requete } : { modeles: [...avant.modeles, ...r.modeles.filter((m) => !avant.modeles.some((x) => x.uid === m.uid))], suite: r.suite, page, requete }));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  };
  if (!dansTauri) return <p className="text-xs text-neutral-500">Sketchfab s'ouvre dans la fenêtre Eliot.</p>;
  const mo = (n: number) => (n ? `${Math.max(0.1, n / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo` : "");
  return (
    <div data-sketchfab>
      {etat && !etat.cle && (
        <p className="mb-2 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800" data-sketchfab-sans-cle>
          La recherche marche sans clé ; pour télécharger, ajouter la ligne <code>SKETCHFAB_API_KEY=…</code> (la clé d'API de ton compte Sketchfab) dans {etat.fichier}, puis relancer Eliot.
        </p>
      )}
      <Recherche valeur={saisie} changer={setSaisie} lancer={() => void lancer(saisie, licences, animes)} indice="Chercher : chaussure, parfum, robot…" />
      <div className="mb-2 flex flex-wrap items-center gap-1">
        {LICENCES.map((l) => (
          <button
            key={l.id}
            data-licence-sketchfab={l.id}
            onClick={() => {
              setLicences(l.id);
              if (resultats) void lancer(resultats.requete, l.id, animes);
            }}
            className={puce(licences === l.id)}
          >
            {l.nom}
          </button>
        ))}
        <label className="ml-1 flex items-center gap-1 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={animes}
            onChange={(e) => {
              setAnimes(e.target.checked);
              if (resultats) void lancer(resultats.requete, licences, e.target.checked);
            }}
            className="accent-accent-600"
          />
          Animés
        </label>
      </div>
      {erreur && <p className="mb-2 text-xs text-red-600">{erreur}</p>}
      {resultats && resultats.modeles.length === 0 && <p className="text-xs text-neutral-500">Rien trouvé pour « {resultats.requete} ».</p>}
      <div className="grid grid-cols-2 gap-2">
        {resultats?.modeles.map((m) => (
          <CarteModele
            key={m.uid}
            cle={m.uid}
            attribut={{ "data-modele-sketchfab": m.uid }}
            titre={m.nom}
            sousTitre={`${m.auteur}${m.taille ? `, ${mo(m.taille)}` : ""}`}
            badge={m.licence.replace(" 1.0", "").replace(" 4.0", "")}
            apercu={() => urlApercuSketchfab(m.uid)}
            ranger={() => ranger("sketchfab", m.uid)}
          />
        ))}
      </div>
      {resultats?.suite && (
        <button disabled={occupe} onClick={() => void lancer(resultats.requete, licences, animes, resultats.page + 1)} className="mt-2 w-full rounded-lg border border-neutral-300 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
          Plus de résultats
        </button>
      )}
      {occupe && <Loader2 size={16} className="mx-auto mt-2 animate-spin text-accent-600" />}
      <p className="mt-2 text-[11px] text-neutral-500">Modèles de Sketchfab sous licence CC0 ou CC BY. Un modèle CC BY demande de citer son auteur : le crédit est gardé avec lui (panneau 3D, section Modèle, « Copier le crédit »). Éviter dans une publicité les modèles qui reproduisent une marque ou un logo connus.</p>
    </div>
  );
}

// ----------------------------------------------------------------------------------------
// Mixamo : la marche à suivre
// ----------------------------------------------------------------------------------------

function SectionMixamo() {
  const importer = async () => {
    const etat = useEditeur.getState();
    if (!etat.projet) return;
    const projet = etat.projet;
    try {
      const bilan = await avecSuivi(() => choisirEtImporterImages(projet, suiviFichiers));
      if (!bilan) return;
      etat.ajouterRessources(bilan.ressources);
      const modeles = bilan.ressources.filter((r) => r.modele3d);
      if (modeles.length) etat.ajouterElements(modeles.map((r) => creerObjet3d(etat.document.format, r)));
      if (bilan.erreurs.length) notifier(`Non importé : ${bilan.erreurs.join(" ; ")}`, true);
    } catch (e) {
      notifier(`Import impossible : ${String(e)}`, true);
    }
  };
  return (
    <div className="text-xs text-neutral-700" data-mixamo>
      <p className="mb-2">Des personnages animés (qui marchent, dansent, saluent), gratuits pour un usage personnel ou commercial, avec un compte Adobe. Mixamo n'a pas d'accès direct : on télécharge le fichier, puis on l'importe.</p>
      <ol className="mb-3 list-decimal space-y-1 pl-4">
        <li>Ouvrir mixamo.com et se connecter avec son compte Adobe.</li>
        <li>Choisir un personnage (Characters), puis une animation (Animations). Pour une marche ou une course, cocher « In Place » : le personnage reste sur place au lieu de sortir du cadre.</li>
        <li>Download : format « FBX Binary (.fbx) », « With Skin », 30 images par seconde.</li>
        <li>Importer le fichier ici : le personnage se pose sur la page. Dans « Vue 3D », section Animation du modèle : choisir l'animation, sa vitesse, la boucle ; sur une page vidéo, elle joue avec la lecture.</li>
      </ol>
      <div className="flex gap-2">
        <button onClick={() => void ouvrirLien("https://www.mixamo.com")} className="flex items-center gap-1 rounded-lg border border-neutral-300 px-2.5 py-1.5 hover:bg-neutral-50">
          <ExternalLink size={13} /> mixamo.com
        </button>
        <button onClick={() => void importer()} className="flex items-center gap-1 rounded-lg bg-accent-600 px-2.5 py-1.5 font-medium text-white hover:bg-accent-700">
          <Upload size={13} /> Importer un FBX
        </button>
      </div>
      <p className="mt-2 text-[11px] text-neutral-500">Le fichier reste dans le dossier du design, jamais dans le dépôt du code.</p>
    </div>
  );
}

// ----------------------------------------------------------------------------------------
// Les environnements du design et l'import d'un .hdr
// ----------------------------------------------------------------------------------------

function MiniatureEnvironnement({ r }: { r: Ressource }) {
  const url = useUrlRessource(r.id, "miniature");
  return (
    <button
      data-environnement-design={r.id}
      title={`${r.nom}${r.credit ? `, ${r.credit.source}` : ""} : un clic éclaire les objets 3D choisis`}
      onClick={() => {
        const n = eclairer(r.id);
        if (!n) notifier("Choisir d'abord un objet 3D sur la page");
      }}
      className="overflow-hidden rounded-lg border border-neutral-200 text-left hover:border-accent-500"
    >
      <span className="block h-12 bg-neutral-100">{url && <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />}</span>
      <span className="block truncate px-1.5 py-1 text-[10px] text-neutral-700">{r.nom}</span>
    </button>
  );
}

function EnvironnementsDuDesign() {
  const envs = useEditeur(useShallow((s) => s.ordreRessources.map((id) => s.ressources[id]).filter((r): r is Ressource => !!r?.environnement3d)));
  const importer = async () => {
    const etat = useEditeur.getState();
    if (!etat.projet) return;
    const projet = etat.projet;
    try {
      const bilan = await choisirEtImporterImages(projet);
      if (!bilan) return;
      etat.ajouterRessources(bilan.ressources);
      const env = bilan.ressources.find((r) => r.environnement3d);
      if (env && eclairer(env.id) === 0) notifier(`${env.nom} est rangé dans le design`);
      if (bilan.erreurs.length) notifier(`Non importé : ${bilan.erreurs.join(" ; ")}`, true);
    } catch (e) {
      notifier(`Import impossible : ${String(e)}`, true);
    }
  };
  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-medium text-neutral-700">Dans ce design</p>
        <button data-importer-hdr onClick={() => void importer()} className="flex items-center gap-1 text-xs text-accent-700 hover:underline">
          <Upload size={12} /> Importer un .hdr
        </button>
      </div>
      {envs.length === 0 ? (
        <p className="text-[11px] text-neutral-500">Aucun environnement importé : en choisir un ci-dessous, ou importer un fichier HDRI (.hdr).</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {envs.map((r) => (
            <MiniatureEnvironnement key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------------------
// L'onglet
// ----------------------------------------------------------------------------------------

const SOURCES: { id: SourceModeles; nom: string }[] = [
  { id: "kenney", nom: "Kenney" },
  { id: "polyhaven", nom: "Poly Haven" },
  { id: "sketchfab", nom: "Sketchfab" },
  { id: "mixamo", nom: "Mixamo" },
];

function Onglet({ actif, choisir, icone, children, nom }: { actif: boolean; choisir: () => void; icone: ReactNode; children: ReactNode; nom: string }) {
  return (
    <button data-onglet-banques={nom} onClick={choisir} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium ${actif ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"}`}>
      {icone}
      {children}
    </button>
  );
}

export function PanneauBanques() {
  const onglet = useBanques((s) => s.onglet);
  const source = useBanques((s) => s.source);
  const choisis = useEditeur((s) => s.selection.length);
  return (
    <div data-panneau-banques>
      <p className="mb-3 text-sm font-semibold text-neutral-800">3D</p>
      <div className="mb-3 flex gap-1 rounded-lg bg-neutral-100 p-0.5">
        <Onglet nom="modeles" actif={onglet === "modeles"} choisir={() => useBanques.setState({ onglet: "modeles" })} icone={<Box size={14} />}>
          Modèles
        </Onglet>
        <Onglet nom="environnements" actif={onglet === "environnements"} choisir={() => useBanques.setState({ onglet: "environnements" })} icone={<Sun size={14} />}>
          Environnements
        </Onglet>
      </div>
      {onglet === "modeles" ? (
        <>
          <div className="mb-3 flex flex-wrap gap-1">
            {SOURCES.map((s) => (
              <button key={s.id} data-source-3d={s.id} onClick={() => useBanques.setState({ source: s.id })} className={puce(source === s.id)}>
                {s.nom}
              </button>
            ))}
          </div>
          {source === "kenney" && <SectionKenney />}
          {source === "polyhaven" && <SectionPolyHaven genre="modeles" />}
          {source === "sketchfab" && <SectionSketchfab />}
          {source === "mixamo" && <SectionMixamo />}
          {source !== "mixamo" && <p className="mt-3 flex items-center gap-1 text-[11px] text-neutral-500"><CloudDownload size={12} /> Clic : posé au centre. Glisser : posé sous le pointeur.</p>}
        </>
      ) : (
        <>
          <p className="mb-2 text-[11px] text-neutral-500">{choisis && objets3dChoisis().length ? "Un clic éclaire les objets 3D choisis." : "Choisir un objet 3D sur la page, puis un environnement : il l'éclaire et se reflète dans ses matières."}</p>
          <EnvironnementsDuDesign />
          <SectionPolyHaven genre="environnements" />
        </>
      )}
    </div>
  );
}
