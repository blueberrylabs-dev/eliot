// L'accueil, comme celui de Canva : créer un design en choisissant son format, retrouver ses
// designs récents et ses modèles maison.

import { Copy, FileArchive, FolderInput, FolderOpen, LayoutTemplate, MoreHorizontal, Pencil, Plus, Search, Settings, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useEditeur } from "../etat/editeur";
import { copierDepuisAccueil, exporterDesign, importerDesign, nouveauDesign, ouvrirDesign, renommerDepuisAccueil, supprimerDesign, utiliserModele } from "../etat/projets";
import { nouveauDesignDepuisModele } from "../etat/modeles";
import { VignetteModele } from "../editeur/VignetteModele";
import { MODELES_DEPART } from "../modeles/depart";
import { FORMATS_PAGE, type Format, type InfoProjet, type RefProjet } from "../modele/types";
import { afficherDansDossier, dansTauri, dossierDesigns, listerProjets, urlMiniatureProjet } from "../pont/tauri";

function quand(ms: number): string {
  const ecart = Date.now() - ms;
  const minutes = Math.round(ecart / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  return new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/** Dessin d'un format à l'échelle, pour les cartes « Créer un design ». */
function Silhouette({ format }: { format: Format }) {
  const echelle = 44 / Math.max(format.largeur, format.hauteur);
  return <span className="block rounded-sm border-2 border-accent-500 bg-accent-50" style={{ width: Math.max(10, format.largeur * echelle), height: Math.max(10, format.hauteur * echelle) }} />;
}

function Miniature({ refProjet, info }: { refProjet: RefProjet; info: InfoProjet }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let actif = true;
    let cree: string | null = null;
    if (info.miniature)
      void urlMiniatureProjet(refProjet).then((u) => {
        if (!actif) {
          if (u?.startsWith("blob:")) URL.revokeObjectURL(u);
          return;
        }
        cree = u;
        setUrl(u);
      });
    return () => {
      actif = false;
      if (cree?.startsWith("blob:")) URL.revokeObjectURL(cree);
    };
  }, [refProjet.rayon, refProjet.id, info.modifie, info.miniature]);
  return (
    <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-plan">
      {url ? (
        <img src={url} alt="" className="max-h-full max-w-full object-contain shadow-sm" draggable={false} />
      ) : (
        <span className="block bg-white shadow-sm" style={{ width: info.largeur >= info.hauteur ? "70%" : `${(70 * info.largeur) / info.hauteur}%`, aspectRatio: `${info.largeur} / ${info.hauteur}` }} />
      )}
    </div>
  );
}

function MenuCarte({ actions, fermer }: { actions: { icone: ReactNode; libelle: string; surClic: () => void; danger?: boolean }[]; fermer: () => void }) {
  const boite = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dehors = (e: MouseEvent) => !boite.current?.contains(e.target as Node) && fermer();
    window.addEventListener("mousedown", dehors);
    return () => window.removeEventListener("mousedown", dehors);
  }, [fermer]);
  return (
    <div ref={boite} className="absolute top-9 right-2 z-20 w-56 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg" onClick={(e) => e.stopPropagation()}>
      {actions.map((a) => (
        <button
          key={a.libelle}
          onClick={() => {
            fermer();
            a.surClic();
          }}
          className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-neutral-100 ${a.danger ? "text-red-700" : "text-neutral-800"}`}
        >
          <span className={a.danger ? "text-red-600" : "text-neutral-500"}>{a.icone}</span>
          {a.libelle}
        </button>
      ))}
    </div>
  );
}

function CarteDesign({ info, rayon, rafraichir }: { info: InfoProjet; rayon: RefProjet["rayon"]; rafraichir: () => void }) {
  const refProjet = { rayon, id: info.id };
  const [menu, setMenu] = useState(false);
  const [edition, setEdition] = useState(false);
  const [nom, setNom] = useState(info.nom);
  const modele = rayon === "modeles";

  const ouvrir = () => (modele ? void utiliserModele(refProjet, info.nom) : void ouvrirDesign(refProjet));
  const renommer = async () => {
    setEdition(false);
    if (nom.trim() && nom.trim() !== info.nom && (await renommerDepuisAccueil(refProjet, nom))) rafraichir();
    else setNom(info.nom);
  };
  const actions = [
    ...(modele ? [{ icone: <Pencil size={15} />, libelle: "Modifier le modèle", surClic: () => void ouvrirDesign(refProjet) }] : []),
    { icone: <Pencil size={15} />, libelle: "Renommer", surClic: () => setEdition(true) },
    { icone: <Copy size={15} />, libelle: "Faire une copie", surClic: () => void copierDepuisAccueil(refProjet, info.nom).then(rafraichir) },
    ...(dansTauri ? [{ icone: <FileArchive size={15} />, libelle: "Exporter (.eliot)", surClic: () => void exporterDesign(refProjet, info.nom) }] : []),
    { icone: <Trash2 size={15} />, libelle: "Mettre à la corbeille", danger: true, surClic: () => void supprimerDesign(refProjet, info.nom).then((ok) => ok && rafraichir()) },
  ];

  return (
    <div className="group relative rounded-xl p-2 hover:bg-white" data-design={info.id}>
      <button className="block w-full text-left" onClick={ouvrir} title={modele ? "Créer un design à partir de ce modèle" : "Ouvrir"}>
        <Miniature refProjet={refProjet} info={info} />
      </button>
      <div className="mt-2 flex items-start gap-1 px-0.5">
        <div className="min-w-0 flex-1">
          {edition ? (
            <input
              autoFocus
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              onBlur={() => void renommer()}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setNom(info.nom);
                  setEdition(false);
                }
              }}
              className="w-full rounded border border-accent-500 px-1 text-sm"
            />
          ) : (
            <p className="truncate text-sm font-medium text-neutral-800" title={info.nom} onDoubleClick={() => setEdition(true)}>
              {info.nom}
            </p>
          )}
          <p className="text-xs text-neutral-500">
            {info.largeur} × {info.hauteur}
            {info.pages > 1 ? ` · ${info.pages} pages` : ""} · {quand(info.modifie)}
          </p>
        </div>
        <button className="rounded-md p-1 text-neutral-500 opacity-0 group-hover:opacity-100 hover:bg-neutral-100" title="Plus d'actions" onClick={() => setMenu(!menu)}>
          <MoreHorizontal size={16} />
        </button>
      </div>
      {menu && <MenuCarte actions={actions} fermer={() => setMenu(false)} />}
    </div>
  );
}

function FormatLibre() {
  const [l, setL] = useState("1080");
  const [h, setH] = useState("1080");
  const valide = Number(l) >= 16 && Number(h) >= 16 && Number(l) <= 20000 && Number(h) <= 20000;
  return (
    <div className="flex w-56 shrink-0 flex-col justify-between rounded-xl border border-dashed border-neutral-300 bg-white p-3">
      <p className="text-sm font-medium text-neutral-800">Taille personnalisée</p>
      <div className="flex items-center gap-1.5">
        <input value={l} onChange={(e) => setL(e.target.value)} className="h-8 w-16 rounded-md border border-neutral-300 px-2 text-sm" title="Largeur en pixels" />
        <span className="text-neutral-400">×</span>
        <input value={h} onChange={(e) => setH(e.target.value)} className="h-8 w-16 rounded-md border border-neutral-300 px-2 text-sm" title="Hauteur en pixels" />
        <span className="text-xs text-neutral-500">px</span>
      </div>
      <button
        disabled={!valide}
        onClick={() => void nouveauDesign({ largeur: Math.round(Number(l)), hauteur: Math.round(Number(h)) })}
        className="rounded-md bg-accent-600 py-1.5 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50"
      >
        Créer
      </button>
    </div>
  );
}

/** Partir d'un modèle de départ d'Eliot : un design neuf, au format du modèle. */
function ModelesDeDepart({ recherche }: { recherche: string }) {
  const [format, setFormat] = useState<string>("tous");
  const [occupe, setOccupe] = useState<string | null>(null);
  const r = recherche.trim().toLocaleLowerCase("fr");
  const liste = MODELES_DEPART.filter((m) => (format === "tous" || m.format === format) && (!r || `${m.nom} ${m.mots}`.toLocaleLowerCase("fr").includes(r)));
  const formats = FORMATS_PAGE.filter((f) => MODELES_DEPART.some((m) => m.format === f.id));
  const puce = (actif: boolean) => `rounded-full px-3 py-1 text-xs ${actif ? "bg-accent-600 text-white" : "bg-white text-neutral-700 border border-neutral-200 hover:border-accent-500"}`;
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-neutral-900">
        <LayoutTemplate size={18} className="text-accent-600" /> Partir d'un modèle
      </h2>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button className={puce(format === "tous")} onClick={() => setFormat("tous")}>
          Tous
        </button>
        {formats.map((f) => (
          <button key={f.id} className={puce(format === f.id)} onClick={() => setFormat(f.id)}>
            {f.libelle}
          </button>
        ))}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 defilement-fin">
        {liste.map((m) => (
          <div key={m.id} className="w-36 shrink-0">
            <VignetteModele
              modele={m}
              occupe={occupe === m.id}
              surClic={() => {
                setOccupe(m.id);
                void nouveauDesignDepuisModele(m).finally(() => setOccupe(null));
              }}
            />
          </div>
        ))}
        {liste.length === 0 && <p className="text-sm text-neutral-500">Aucun modèle ne correspond.</p>}
      </div>
    </section>
  );
}

export function Accueil() {
  const [designs, setDesigns] = useState<InfoProjet[] | null>(null);
  const [modeles, setModeles] = useState<InfoProjet[]>([]);
  const [recherche, setRecherche] = useState("");
  const projetOuvert = useEditeur((s) => s.projet);

  const rafraichir = useCallback(() => {
    void listerProjets("designs").then(setDesigns);
    void listerProjets("modeles").then(setModeles);
  }, []);
  useEffect(rafraichir, [rafraichir]);

  const filtre = (liste: InfoProjet[]) => {
    const r = recherche.trim().toLocaleLowerCase("fr");
    return r ? liste.filter((d) => d.nom.toLocaleLowerCase("fr").includes(r)) : liste;
  };
  const titre = "mb-3 text-base font-semibold text-neutral-900";

  return (
    <div className="flex h-full flex-col bg-accueil">
      <header className="flex h-14 shrink-0 items-center gap-3 bg-gradient-to-r from-accent-700 to-accent-500 px-5 text-white">
        <svg width="30" height="30" viewBox="0 0 1024 1024" aria-hidden>
          <rect x="40" y="40" width="944" height="944" rx="230" fill="#ffffff" fillOpacity="0.18" />
          <rect x="300" y="270" width="100" height="484" rx="36" fill="#fff" />
          <rect x="300" y="270" width="424" height="100" rx="36" fill="#fff" />
          <rect x="300" y="462" width="340" height="100" rx="36" fill="#fff" />
          <rect x="300" y="654" width="424" height="100" rx="36" fill="#fff" />
          <circle cx="740" cy="500" r="50" fill="#ff7a59" />
        </svg>
        <span className="text-lg font-semibold tracking-tight">Eliot</span>
        <div className="ml-6 flex h-9 w-96 items-center gap-2 rounded-lg bg-white/15 px-3">
          <Search size={16} className="text-white/80" />
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Chercher un design" className="flex-1 bg-transparent text-sm text-white placeholder-white/70 outline-none" />
        </div>
        <span className="flex-1" />
        {projetOuvert && (
          <button onClick={() => void ouvrirDesign(projetOuvert)} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm hover:bg-white/25">
            Revenir au design ouvert
          </button>
        )}
        {dansTauri && (
          <>
            <button onClick={() => void importerDesign()} className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-1.5 text-sm hover:bg-white/25">
              <FolderInput size={16} /> Ouvrir un fichier .eliot
            </button>
            <button onClick={() => void dossierDesigns().then((d) => afficherDansDossier(d))} className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-1.5 text-sm hover:bg-white/25" title="Ouvrir le dossier des designs">
              <FolderOpen size={16} />
            </button>
          </>
        )}
        <button onClick={() => useEditeur.setState({ reglagesOuverts: true })} className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-1.5 text-sm hover:bg-white/25" title="Réglages et pont IA">
          <Settings size={16} />
        </button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-8 py-6 defilement-fin">
        <section className="mb-8">
          <h2 className={titre}>Créer un design</h2>
          <div className="flex flex-wrap gap-3">
            {FORMATS_PAGE.map((f) => (
              <button
                key={f.id}
                onClick={() => void nouveauDesign({ largeur: f.largeur, hauteur: f.hauteur })}
                className="flex w-44 shrink-0 flex-col items-start gap-2 rounded-xl border border-neutral-200 bg-white p-3 text-left hover:border-accent-500 hover:shadow-md"
                data-format={f.id}
              >
                <span className="flex h-12 w-full items-center justify-center">
                  <Silhouette format={f} />
                </span>
                <span className="text-sm font-medium text-neutral-800">{f.libelle}</span>
                <span className="text-[11px] leading-tight text-neutral-500">
                  {f.usage}
                  <br />
                  {f.largeur} × {f.hauteur} px
                </span>
              </button>
            ))}
            <FormatLibre />
          </div>
        </section>

        <ModelesDeDepart recherche={recherche} />

        {modeles.length > 0 && (
          <section className="mb-8">
            <h2 className={`${titre} flex items-center gap-2`}>
              <LayoutTemplate size={18} className="text-accent-600" /> Mes modèles
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
              {filtre(modeles).map((m) => (
                <CarteDesign key={m.id} info={m} rayon="modeles" rafraichir={rafraichir} />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className={titre}>Mes designs</h2>
          {designs === null ? (
            <p className="text-sm text-neutral-500">Chargement…</p>
          ) : designs.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-neutral-300 bg-white p-6">
              <p className="text-sm text-neutral-700">Aucun design pour l'instant. Choisis un format ci-dessus pour commencer.</p>
              <button onClick={() => void nouveauDesign({ largeur: 1080, hauteur: 1080 })} className="flex items-center gap-2 rounded-lg bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700">
                <Plus size={16} /> Nouveau design carré
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
              {filtre(designs).map((d) => (
                <CarteDesign key={d.id} info={d} rayon="designs" rafraichir={rafraichir} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
