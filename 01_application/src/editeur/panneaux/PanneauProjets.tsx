// L'onglet Projets du rail (BRIEF § 6, comme celui de Canva ; vérification de l'étape 7) : tes
// autres designs, à chercher par leur nom. Un clic en ouvre le détail : l'ouvrir, reprendre
// ses pages dans celui-ci (mises à l'échelle comme Redimensionner), ou ses photos, ses vidéos,
// ses modèles 3D et ses sons. Une copie entre dans ce design ; l'autre n'est jamais modifié.

import { ArrowLeft, Box, Film, FolderOpen, Music, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Miniature, quand } from "../../accueil/Accueil";
import { useEditeur } from "../../etat/editeur";
import { ouvrirDesign, reprendrePages, reprendreRessources } from "../../etat/projets";
import { creerDepuisRessource } from "../../modele/fabriques";
import { correspond } from "../../modele/reprendre";
import type { DocumentEliot, InfoProjet, RefProjet, Ressource } from "../../modele/types";
import { listerProjets, ouvrirProjet, ressourcesDuDesign, urlRessource } from "../../pont/tauri";
import { dureeLisible } from "../videos";

const refDe = (info: InfoProjet): RefProjet => ({ rayon: "designs", id: info.id });

/** Une photo, une vidéo ou un modèle 3D d'un autre design : sa miniature, rangée chez lui. */
function CarteReprise({ source, ressource, poser }: { source: RefProjet; ressource: Ressource; poser: () => void }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let actif = true;
    if (!ressource.modele3d || ressource.modele3d.miniature)
      void urlRessource(source, ressource.id, "miniature").then(
        (u) => actif && setUrl(u),
        () => undefined,
      );
    return () => {
      actif = false;
    };
  }, [source.rayon, source.id, ressource.id, ressource.modele3d]);
  const genre = ressource.modele3d ? "modèle 3D" : ressource.video ? "vidéo" : "photo";
  return (
    <button
      data-ressource-reprise={ressource.id}
      title={`${ressource.nom} (${genre})${ressource.credit ? `, de ${ressource.credit.auteur} sur ${ressource.credit.source}` : ""} : clique pour la poser ici`}
      onClick={poser}
      className="relative overflow-hidden rounded-lg border border-neutral-200 bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px] hover:border-accent-500"
    >
      {url ? (
        <img src={url} alt={ressource.nom} className="h-24 w-full object-contain" draggable={false} />
      ) : (
        <span className="flex h-24 items-center justify-center text-neutral-400">{ressource.modele3d ? <Box size={24} /> : null}</span>
      )}
      {(ressource.video || ressource.modele3d) && (
        <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums">
          {ressource.video ? (
            <>
              <Film size={11} /> {dureeLisible(ressource.video.duree)}
            </>
          ) : (
            <>
              <Box size={11} /> 3D
            </>
          )}
        </span>
      )}
    </button>
  );
}

/** Le détail d'un design : l'ouvrir, reprendre ses pages, ses images et ses sons. */
function Detail({ info, retour }: { info: InfoProjet; retour: () => void }) {
  const source = useMemo(() => refDe(info), [info]);
  const format = useEditeur((s) => s.document.format);
  const ouvert = useEditeur((s) => s.projet?.rayon === "designs" && s.projet.id === info.id);
  const notifier = useEditeur((s) => s.notifier);
  const [document, setDocument] = useState<DocumentEliot | null>(null);
  const [ressources, setRessources] = useState<Ressource[]>([]);
  const [occupe, setOccupe] = useState(false);
  useEffect(() => {
    let actif = true;
    void Promise.all([ouvrirProjet(source), ressourcesDuDesign(source)]).then(
      ([o, r]) => {
        if (!actif) return;
        setDocument(o.document);
        setRessources(r);
      },
      (e) => notifier(`Design illisible : ${String(e instanceof Error ? e.message : e)}`, { erreur: true }),
    );
    return () => {
      actif = false;
    };
  }, [source, notifier]);
  const visuels = ressources.filter((r) => !r.son && !r.environnement3d);
  const sons = ressources.filter((r) => r.son);
  const autreFormat = document && (document.format.largeur !== format.largeur || document.format.hauteur !== format.hauteur);

  const avec = async (faire: () => Promise<void>) => {
    setOccupe(true);
    try {
      await faire();
    } catch (e) {
      notifier(`Rien n'a été repris : ${String(e instanceof Error ? e.message : e)}`, { erreur: true });
    } finally {
      setOccupe(false);
    }
  };
  const pages = (numeros: number[]) =>
    avec(async () => {
      if (!document) return;
      const posees = await reprendrePages(source, document, numeros);
      if (posees.length) notifier(posees.length > 1 ? `${posees.length} pages de « ${info.nom} » ajoutées après la page affichée` : `Page de « ${info.nom} » ajoutée après la page affichée`);
    });
  const poser = (r: Ressource) =>
    avec(async () => {
      const [copie] = await reprendreRessources(source, [r.id]);
      if (!copie) return;
      const etat = useEditeur.getState();
      if (copie.son) {
        if (!etat.ajouterSon(copie)) notifier(`${copie.nom} est rangé dans ce design (onglet Audio)`);
      } else etat.ajouterElements([creerDepuisRessource(etat.document.format, copie)]);
    });

  return (
    <div data-detail-design={info.id}>
      <button onClick={retour} className="mb-3 flex items-center gap-1.5 text-xs font-medium text-accent-700 hover:underline">
        <ArrowLeft size={14} /> Tous les designs
      </button>
      <Miniature refProjet={source} info={info} />
      <p className="mt-2 truncate text-sm font-semibold text-neutral-800" title={info.nom}>
        {info.nom}
      </p>
      <p className="mb-3 text-xs text-neutral-500 tabular-nums">
        {info.largeur} × {info.hauteur} · {info.pages > 1 ? `${info.pages} pages` : "1 page"} · {quand(info.modifie)}
      </p>
      {ouvert ? (
        <p className="rounded-lg bg-neutral-100 p-3 text-xs text-neutral-600">C'est le design ouvert. Pour copier une de ses pages, « Dupliquer la page » dans la barre du bas.</p>
      ) : (
        <>
          <button data-ouvrir-design disabled={occupe} onClick={() => void ouvrirDesign(source)} className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100 disabled:opacity-60">
            <FolderOpen size={16} /> Ouvrir ce design
          </button>
          {!document ? (
            <p className="text-xs text-neutral-500">Lecture du design…</p>
          ) : (
            <>
              <p className="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Ses pages</p>
              <p className="mb-2 text-xs text-neutral-500">
                Un numéro ajoute la page après celle affichée, avec ses photos et ses sons.
                {autreFormat ? ` Elle passe de ${document.format.largeur} × ${document.format.hauteur} à ${format.largeur} × ${format.hauteur}, mise à l'échelle comme Redimensionner.` : ""}
              </p>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {document.pages.map((p, i) => (
                  <button key={p.id} data-page-reprise={i + 1} disabled={occupe} onClick={() => void pages([i + 1])} title={`Ajouter la page ${i + 1}${p.duree !== undefined ? " (page vidéo)" : ""}`} className="h-8 min-w-8 rounded-md border border-neutral-300 px-2 text-sm text-neutral-800 tabular-nums hover:border-accent-500 hover:bg-accent-50 disabled:opacity-60">
                    {i + 1}
                  </button>
                ))}
                {document.pages.length > 1 && (
                  <button data-toutes-pages disabled={occupe} onClick={() => void pages(document.pages.map((_, i) => i + 1))} className="h-8 rounded-md bg-accent-600 px-3 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-60">
                    Toutes
                  </button>
                )}
              </div>
              {visuels.length > 0 && (
                <>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Ses photos, vidéos et modèles 3D</p>
                  <p className="mb-2 text-xs text-neutral-500">Clique pour poser ici : une copie entre dans ce design, avec son crédit.</p>
                  <div className="mb-4 grid grid-cols-2 gap-2">
                    {visuels.map((r) => (
                      <CarteReprise key={r.id} source={source} ressource={r} poser={() => void poser(r)} />
                    ))}
                  </div>
                </>
              )}
              {sons.length > 0 && (
                <>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Ses sons</p>
                  <div className="mb-4 flex flex-col gap-1">
                    {sons.map((r) => (
                      <button key={r.id} data-son-repris={r.id} disabled={occupe} onClick={() => void poser(r)} title="Poser sur la frise de la page affichée (elle devient une page vidéo)" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-neutral-800 hover:bg-neutral-100 disabled:opacity-60">
                        <Music size={14} className="shrink-0 text-neutral-500" />
                        <span className="min-w-0 flex-1 truncate">{r.nom}</span>
                        <span className="text-xs text-neutral-500 tabular-nums">{dureeLisible(r.son!.duree)}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {visuels.length === 0 && sons.length === 0 && <p className="text-xs text-neutral-500">Ni photo, ni vidéo, ni modèle 3D, ni son dans ce design.</p>}
            </>
          )}
        </>
      )}
    </div>
  );
}

export function PanneauProjets() {
  const projet = useEditeur((s) => s.projet);
  const [designs, setDesigns] = useState<InfoProjet[] | null>(null);
  const [requete, setRequete] = useState("");
  const [choisi, setChoisi] = useState<InfoProjet | null>(null);
  useEffect(() => {
    let actif = true;
    void listerProjets("designs").then(
      (l) => actif && setDesigns(l),
      () => actif && setDesigns([]),
    );
    return () => {
      actif = false;
    };
    // Un autre design ouvert depuis ce panneau : la liste se relit (dates, design ouvert).
  }, [projet?.id]);
  useEffect(() => setChoisi(null), [projet?.id]);
  if (choisi) return <Detail info={choisi} retour={() => setChoisi(null)} />;
  const trouves = (designs ?? []).filter((d) => correspond(d.nom, requete));
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-neutral-800">Projets</p>
      <div className="relative mb-3">
        <Search size={16} className="absolute top-2.5 left-2.5 text-neutral-400" />
        <input data-recherche-designs value={requete} onChange={(e) => setRequete(e.target.value)} placeholder="Chercher un design par son nom" className="h-9 w-full rounded-lg border border-neutral-300 pr-8 pl-8 text-sm outline-none focus:border-accent-500" />
        {requete && (
          <button onClick={() => setRequete("")} title="Effacer" className="absolute top-2 right-2 text-neutral-400 hover:text-neutral-700">
            <X size={16} />
          </button>
        )}
      </div>
      {designs === null ? (
        <p className="text-xs text-neutral-500">Lecture des designs…</p>
      ) : designs.length === 0 ? (
        <p className="text-xs text-neutral-500">Aucun design enregistré pour l'instant.</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-neutral-500">{requete ? (trouves.length ? `${trouves.length} sur ${designs.length}` : `Aucun design ne s'appelle « ${requete} »`) : "Clique un design pour reprendre ses pages, ses photos ou ses sons dans celui-ci, ou pour l'ouvrir."}</p>
          <div className="grid grid-cols-2 gap-2">
            {trouves.map((d) => {
              const ouvert = projet?.rayon === "designs" && projet.id === d.id;
              return (
                <button key={d.id} data-design={d.id} data-design-ouvert={ouvert || undefined} onClick={() => setChoisi(d)} title={d.nom} className="rounded-lg border border-neutral-200 p-1.5 text-left hover:border-accent-500">
                  <Miniature refProjet={refDe(d)} info={d} />
                  <span className="mt-1 block truncate text-xs font-medium text-neutral-800">{d.nom}</span>
                  <span className="block text-[11px] text-neutral-500">{ouvert ? "ouvert" : quand(d.modifie)}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
