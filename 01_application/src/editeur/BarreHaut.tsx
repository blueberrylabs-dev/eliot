// La barre du haut : accueil, menu Fichier, Redimensionner, annuler et rétablir, nom du
// design et état de l'enregistrement, export.

import { AlertTriangle, Bot, Check, ChevronDown, Clapperboard, Cloud, Copy, Download, FileArchive, FolderInput, FolderOpen, House, Image as IconeImage, LayoutTemplate, Loader2, Maximize2, Redo2, Settings, Trash2, Undo2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { pageCourante, useEditeur } from "../etat/editeur";
import { enregistrerCommeModele, exporterDesign, faireUneCopie, importerDesign, renommerDesign, retourAccueil, supprimerDesign } from "../etat/projets";
import { echellesPossibles, exporter, FORMATS_DU_NOYAU, formatPapier, nomDate } from "../export/exporter";
import { exporterVideo, messageFilm, OPTIONS_FILM_DEFAUT, type OptionsFilm } from "../export/video";
import { afficherDansDossier, choisirEmplacement, choisirEmplacementFilm, dansTauri, dossierDesigns, dossierExport, dossierExportVideo, type FormatExport } from "../pont/tauri";
import { ReglagesDuFilm } from "./ExportVideo";
import { Redimensionner } from "./Redimensionner";

function useFermerDehors(fermer: () => void) {
  const boite = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dehors = (e: MouseEvent) => !boite.current?.contains(e.target as Node) && fermer();
    const echap = (e: KeyboardEvent) => e.key === "Escape" && fermer();
    window.addEventListener("mousedown", dehors);
    window.addEventListener("keydown", echap);
    return () => {
      window.removeEventListener("mousedown", dehors);
      window.removeEventListener("keydown", echap);
    };
  }, [fermer]);
  return boite;
}

/** Les derniers réglages de film choisis, gardés le temps de la session. */
let optionsFilmRetenues: OptionsFilm = OPTIONS_FILM_DEFAUT;

/** Ce que dit chaque format, sous son nom. */
const FORMATS_IMAGE: { id: FormatExport | "mp4" | "gif"; libelle: string; detail: string }[] = [
  { id: "png", libelle: "PNG", detail: "net, transparence" },
  { id: "jpeg", libelle: "JPEG", detail: "léger, photos" },
  { id: "webp", libelle: "WebP", detail: "léger, pour le web" },
  { id: "pdf", libelle: "PDF", detail: "vectoriel, à imprimer" },
  { id: "svg", libelle: "SVG", detail: "vectoriel, une page" },
  { id: "mp4", libelle: "MP4", detail: "vidéo avec le son" },
  { id: "gif", libelle: "GIF", detail: "image animée, sans son" },
];

function PanneauExport({ fermer }: { fermer: () => void }) {
  const format = useEditeur((s) => s.document.format);
  const nombrePages = useEditeur((s) => s.document.pages.length);
  const avecVideo = useEditeur((s) => s.document.pages.some((p) => p.elements.some((e) => e.type === "video")));
  const dureePage = useEditeur((s) => pageCourante(s).duree);
  const avecMusique = useEditeur((s) => !!pageCourante(s).audio?.some((c) => c.role === "musique"));
  const pageVideo = dureePage !== undefined;
  const notifier = useEditeur((s) => s.notifier);
  const [type, setType] = useState<FormatExport | "mp4" | "gif">(pageVideo && dansTauri ? optionsFilmRetenues.format : "png");
  const echelles = echellesPossibles(format);
  const papier = formatPapier(format);
  const [echelle, setEchelle] = useState(1);
  const [transparent, setTransparent] = useState(false);
  const [pages, setPages] = useState<"courante" | "toutes">("courante");
  // Un PDF réunit d'ordinaire toutes les pages : son propre choix, toutes par défaut.
  const [pagesPdf, setPagesPdf] = useState<"courante" | "toutes">("toutes");
  const [occupe, setOccupe] = useState<string | null>(null);
  const [dossier, setDossier] = useState("");
  const [dossierVideo, setDossierVideo] = useState("");
  const [film, setFilm] = useState<OptionsFilm>(optionsFilmRetenues);
  const boite = useFermerDehors(fermer);
  const estFilm = type === "mp4" || type === "gif";
  const vectoriel = type === "pdf" || type === "svg";
  const transparencePossible = type === "png" || type === "webp";
  const pagesChoisies = type === "svg" ? "courante" : type === "pdf" ? pagesPdf : pages;

  useEffect(() => {
    void dossierExport().then(setDossier);
    void dossierExportVideo().then(setDossierVideo);
  }, []);

  const changerFilm = (o: Partial<OptionsFilm>) => {
    const suivant = { ...film, ...o };
    // Un GIF tourne bien à 15 images par seconde, un MP4 à 30.
    if (o.format === "gif" && film.format !== "gif") suivant.imagesParSeconde = 15;
    if (o.format === "mp4" && film.format !== "mp4") suivant.imagesParSeconde = 30;
    optionsFilmRetenues = suivant;
    setFilm(suivant);
  };

  const choisirType = (t: FormatExport | "mp4" | "gif") => {
    setType(t);
    if (t === "mp4" || t === "gif") changerFilm({ format: t });
  };

  const lancerFilm = async (avecEmplacement: boolean) => {
    let chemin: string | undefined;
    if (avecEmplacement) {
      const choisi = await choisirEmplacementFilm(nomDate(), film.format);
      if (!choisi) return;
      chemin = choisi;
    }
    fermer();
    try {
      const ecrit = await exporterVideo({ ...film, chemin });
      notifier(messageFilm(ecrit), { chemin: ecrit.chemin });
    } catch (erreur) {
      const texte = String(erreur);
      notifier(/annulé/.test(texte) ? "Export annulé : rien n'a été écrit." : `Export impossible : ${texte}`, { erreur: !/annulé/.test(texte) });
    }
  };

  const lancer = async (avecEmplacement: boolean) => {
    if (type === "mp4" || type === "gif") return lancerFilm(avecEmplacement);
    setOccupe("Export en cours…");
    try {
      let chemin: string | undefined;
      if (avecEmplacement) {
        const choisi = await choisirEmplacement(nomDate(), type);
        if (!choisi) return;
        chemin = choisi;
      }
      const ecrits = await exporter({ format: type, echelle: vectoriel ? 1 : echelle, transparent: transparent && transparencePossible, pages: pagesChoisies, chemin }, (fait, total, etape) => {
        if (total > 1) setOccupe(`${etape === "description" ? "Préparation de la page" : type === "pdf" ? "PDF, page" : "Page"} ${Math.min(fait + 1, total)} sur ${total}…`);
      });
      const dernier = ecrits[ecrits.length - 1];
      const texte = ecrits.length > 1 ? `${ecrits.length} pages exportées dans ${dossier}` : `Exporté : ${dernier}`;
      notifier(dansTauri ? texte : `Téléchargé : ${dernier}`, { chemin: dansTauri ? dernier : undefined });
      fermer();
    } catch (erreur) {
      notifier(`Export impossible : ${String(erreur)}`, { erreur: true });
    } finally {
      setOccupe(null);
    }
  };

  const option = (choisi: boolean) => `rounded-md border px-2 py-1.5 text-sm ${choisi ? "border-accent-600 bg-accent-50 text-accent-700" : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"}`;
  const filmPossible = pageVideo && dansTauri;
  const possible = (id: FormatExport | "mp4" | "gif") => (id === "mp4" || id === "gif" ? filmPossible : dansTauri || !FORMATS_DU_NOYAU.includes(id));
  const taille = (e: number) => `${Math.round(format.largeur * e)} × ${Math.round(format.hauteur * e)}`;
  const choixPages = (valeur: "courante" | "toutes", changer: (v: "courante" | "toutes") => void, detail: string) => (
    <>
      <p className="mb-1 text-xs font-medium text-neutral-500">Pages</p>
      <div className="mb-3 flex gap-2">
        <button className={`flex-1 ${option(valeur === "courante")}`} onClick={() => changer("courante")}>
          Cette page
        </button>
        <button className={`flex-1 ${option(valeur === "toutes")}`} onClick={() => changer("toutes")}>
          Toutes ({nombrePages})<span className="block text-[11px] text-neutral-500">{detail}</span>
        </button>
      </div>
    </>
  );

  return (
    <div ref={boite} className="absolute top-12 right-3 z-30 w-96 rounded-xl border border-neutral-200 bg-white p-4 text-neutral-900 shadow-xl">
      <p className="mb-3 text-sm font-semibold text-neutral-800">Exporter</p>
      <p className="mb-1 text-xs font-medium text-neutral-500">Format</p>
      <div className="mb-3 grid grid-cols-6 gap-2">
        {FORMATS_IMAGE.map((f, i) => (
          <button key={f.id} data-format={f.id} className={`${i < 3 ? "col-span-2" : "col-span-3"} ${option(type === f.id)} disabled:opacity-50`} disabled={!possible(f.id)} onClick={() => choisirType(f.id)}>
            {f.libelle} <span className="block text-[11px] text-neutral-500">{f.detail}</span>
          </button>
        ))}
      </div>
      {!dansTauri && <p className="mb-3 text-[11px] text-neutral-500">WebP, PDF, SVG, MP4 et GIF se font dans l'application Eliot.</p>}
      {dansTauri && !filmPossible && <p className="mb-3 text-[11px] text-neutral-500">MP4 et GIF : passe la page en Vidéo (bouton Vidéo, en haut) pour en faire un film.</p>}
      {estFilm && dureePage !== undefined ? (
        <ReglagesDuFilm options={film} changer={changerFilm} format={format} duree={dureePage} musique={avecMusique} />
      ) : (
        <>
          {!vectoriel && (
            <>
              <p className="mb-1 text-xs font-medium text-neutral-500">Taille</p>
              <div className="mb-3 flex gap-2">
                {echelles.map((e) => (
                  <button key={e} data-echelle={e} className={`flex-1 ${option(echelle === e)}`} onClick={() => setEchelle(e)}>
                    {papier ? `${Math.round(300 * e)} dpi` : `×${e}`} <span className="block text-[11px] text-neutral-500">{taille(e)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {type === "pdf" && (
            <p className="mb-3 rounded-md bg-neutral-50 px-2.5 py-2 text-[11px] text-neutral-600">
              Formes et textes restent vectoriels, nets à toutes les tailles ; les textes se sélectionnent. {papier ? "La page garde la taille de son papier." : "La page compte 96 pixels par pouce."}
            </p>
          )}
          {type === "svg" && (
            <p className="mb-3 rounded-md bg-neutral-50 px-2.5 py-2 text-[11px] text-neutral-600">
              La page affichée. Les textes deviennent des tracés et les photos sont dedans : le fichier s'ouvre partout tel quel.
            </p>
          )}
          {nombrePages > 1 && type !== "svg" && (type === "pdf" ? choixPages(pagesPdf, setPagesPdf, "un seul fichier") : choixPages(pages, setPages, "une image par page"))}
          {(avecVideo || pageVideo) && (
            <p className="mb-3 rounded-md bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
              {pageVideo
                ? "Page vidéo : l'image exportée est celle de la tête de lecture (les autres pages : leur début). Pour le film entier, choisis MP4 ou GIF."
                : "Les vidéos d'une page fixe sortent ici en image fixe : leur couverture."}
            </p>
          )}
          {!vectoriel && (
            <label className={`mb-4 flex items-center gap-2 text-sm ${transparencePossible ? "text-neutral-700" : "text-neutral-400"}`}>
              <input type="checkbox" disabled={!transparencePossible} checked={transparent && transparencePossible} onChange={(e) => setTransparent(e.target.checked)} className="accent-accent-600" />
              Fond transparent{type === "jpeg" && <span className="text-[11px] text-neutral-400"> (PNG et WebP)</span>}
            </label>
          )}
        </>
      )}
      <button disabled={!!occupe} onClick={() => void lancer(false)} className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-600 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-60">
        <Download size={16} /> {occupe ?? (estFilm ? "Exporter dans Vidéos/Eliot" : dansTauri ? "Exporter dans Images/Eliot" : "Télécharger")}
      </button>
      {dansTauri && (pagesChoisies === "courante" || estFilm || type === "pdf") && (
        <button disabled={!!occupe} onClick={() => void lancer(true)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-60">
          <FolderOpen size={16} /> Enregistrer sous…
        </button>
      )}
      {dansTauri && (estFilm ? dossierVideo : dossier) && (
        <p className="mt-2 truncate text-[11px] text-neutral-400" title={estFilm ? dossierVideo : dossier}>
          Dossier : {estFilm ? dossierVideo : dossier}
        </p>
      )}
    </div>
  );
}

function MenuFichier({ fermer, redimensionner }: { fermer: () => void; redimensionner: () => void }) {
  const boite = useFermerDehors(fermer);
  const projet = useEditeur((s) => s.projet);
  const nom = useEditeur((s) => s.document.nom);
  const action = (fn: () => unknown) => () => {
    fermer();
    void fn();
  };
  const Ligne = ({ icone, libelle, surClic, inactif }: { icone: ReactNode; libelle: string; surClic: () => void; inactif?: boolean }) => (
    <button disabled={inactif} onClick={surClic} className="flex w-full items-center gap-3 rounded-md px-2.5 py-1.5 text-left text-sm text-neutral-800 hover:bg-neutral-100 disabled:text-neutral-400 disabled:hover:bg-transparent">
      <span className="text-neutral-500">{icone}</span>
      {libelle}
    </button>
  );
  const Separateur = () => <div className="my-1 h-px bg-neutral-200" />;
  return (
    <div ref={boite} className="absolute top-12 left-24 z-30 w-72 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl">
      <Ligne icone={<House size={16} />} libelle="Accueil et nouveau design" surClic={action(retourAccueil)} />
      <Ligne icone={<Maximize2 size={16} />} libelle="Redimensionner…" surClic={action(redimensionner)} />
      <Separateur />
      <Ligne icone={<Copy size={16} />} libelle="Faire une copie" surClic={action(faireUneCopie)} inactif={!projet} />
      <Ligne icone={<LayoutTemplate size={16} />} libelle="Enregistrer comme modèle" surClic={action(enregistrerCommeModele)} inactif={!projet} />
      <Separateur />
      <Ligne icone={<FileArchive size={16} />} libelle="Exporter le design (.eliot)" surClic={action(() => exporterDesign())} inactif={!projet || !dansTauri} />
      <Ligne icone={<FolderInput size={16} />} libelle="Ouvrir un fichier .eliot" surClic={action(importerDesign)} inactif={!dansTauri} />
      <Ligne
        icone={<FolderOpen size={16} />}
        libelle="Afficher dans le dossier"
        inactif={!projet || !dansTauri}
        surClic={action(async () => projet && afficherDansDossier(`${await dossierDesigns()}/${projet.id}/document.json`))}
      />
      <Ligne icone={<Settings size={16} />} libelle="Réglages et pont IA…" surClic={action(() => useEditeur.setState({ reglagesOuverts: true }))} />
      <Separateur />
      <Ligne icone={<Trash2 size={16} />} libelle="Mettre à la corbeille" inactif={!projet} surClic={action(() => projet && supprimerDesign(projet, nom))} />
    </div>
  );
}

function EtatEnregistrement() {
  const etat = useEditeur((s) => s.enregistrement);
  const contenu = {
    enregistre: { icone: <Check size={14} />, texte: "Enregistré" },
    "en-attente": { icone: <Cloud size={14} />, texte: "Modifié" },
    "en-cours": { icone: <Loader2 size={14} className="animate-spin" />, texte: "Enregistrement…" },
    erreur: { icone: <AlertTriangle size={14} />, texte: "Non enregistré" },
  }[etat];
  return (
    <span className={`flex items-center gap-1 text-xs ${etat === "erreur" ? "font-medium text-amber-200" : "text-white/70"}`} title="Eliot enregistre tout seul, une seconde après chaque modification">
      {contenu.icone}
      {contenu.texte}
    </span>
  );
}

/** Signal discret quand une IA vient d'agir dans Eliot (pont MCP). */
function IndicateurIa() {
  const appel = useEditeur((s) => s.iaDernierAppel);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!appel) return;
    setVisible(true);
    const minuterie = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(minuterie);
  }, [appel]);
  if (!visible || !appel) return null;
  return (
    <span className="ml-3 flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-xs text-white" title="Une IA agit dans Eliot ; Ctrl+Z défait chacune de ses actions">
      <Bot size={14} className="animate-pulse" /> IA : {appel.outil.replace(/_/g, " ")}
    </span>
  );
}

function NomDesign() {
  const nom = useEditeur((s) => s.document.nom);
  const [valeur, setValeur] = useState(nom);
  useEffect(() => setValeur(nom), [nom]);
  const valider = () => {
    if (valeur.trim() && valeur.trim() !== nom) void renommerDesign(valeur);
    else setValeur(nom);
  };
  return (
    <input
      value={valeur}
      title="Nom du design : clique pour le changer"
      onChange={(e) => setValeur(e.target.value)}
      onBlur={valider}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setValeur(nom);
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
      }}
      className="w-64 truncate rounded-md border border-transparent bg-transparent px-2 py-1 text-center text-sm text-white placeholder-white/60 hover:border-white/30 focus:border-white/60 focus:bg-white/10 focus:outline-none"
    />
  );
}

/** La bascule Photo ou Vidéo de la page affichée : une page vidéo a sa frise en bas. */
function BasculeVideo() {
  const pageVideo = useEditeur((s) => pageCourante(s).duree !== undefined);
  const etat = useEditeur.getState();
  const option = (actif: boolean) => `flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm ${actif ? "bg-white text-accent-700 shadow-sm" : "text-white/90 hover:bg-white/15"}`;
  return (
    <span className="flex items-center gap-0.5 rounded-lg bg-black/15 p-0.5" role="group" aria-label="Nature de la page">
      <button
        className={option(!pageVideo)}
        aria-pressed={!pageVideo}
        title="Page fixe : une image (la frise disparaît ; Ctrl+Z pour revenir)"
        onClick={() => {
          if (!pageVideo) return;
          etat.basculerPageVideo(false);
          etat.notifier("La page est redevenue une image fixe. Ctrl+Z pour revenir à la vidéo.");
        }}
      >
        <IconeImage size={15} /> Photo
      </button>
      <button className={option(pageVideo)} aria-pressed={pageVideo} title="Page vidéo : la frise s'ouvre en bas, avec ses pistes" onClick={() => !pageVideo && etat.basculerPageVideo(true)}>
        <Clapperboard size={15} /> Vidéo
      </button>
    </span>
  );
}

export function BarreHaut() {
  const peutAnnuler = useEditeur((s) => s.passe.length > 0);
  const peutRetablir = useEditeur((s) => s.futur.length > 0);
  const format = useEditeur((s) => s.document.format);
  const etat = useEditeur.getState();
  const [ouvert, setOuvert] = useState<"export" | "fichier" | null>(null);
  const [redimension, setRedimension] = useState(false);
  const icone = "flex h-9 w-9 items-center justify-center rounded-md text-white/90 hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent";
  const texte = "flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm text-white/95 hover:bg-white/15";

  return (
    <header className="relative flex h-12 shrink-0 items-center gap-1 bg-gradient-to-r from-accent-700 to-accent-500 px-3 text-white">
      <button className={`${texte} mr-1`} title="Retour à l'accueil" onClick={() => void retourAccueil()}>
        <svg width="24" height="24" viewBox="0 0 1024 1024" aria-hidden>
          <rect x="40" y="40" width="944" height="944" rx="230" fill="#ffffff" fillOpacity="0.18" />
          <rect x="300" y="270" width="100" height="484" rx="36" fill="#fff" />
          <rect x="300" y="270" width="424" height="100" rx="36" fill="#fff" />
          <rect x="300" y="462" width="340" height="100" rx="36" fill="#fff" />
          <rect x="300" y="654" width="424" height="100" rx="36" fill="#fff" />
          <circle cx="740" cy="500" r="50" fill="#ff7a59" />
        </svg>
        <span className="font-semibold">Accueil</span>
      </button>
      <button className={texte} onMouseDown={(e) => e.stopPropagation()} onClick={() => setOuvert(ouvert === "fichier" ? null : "fichier")}>
        Fichier <ChevronDown size={14} />
      </button>
      <button className={texte} onClick={() => setRedimension(true)} title="Passer le design dans un autre format">
        <Maximize2 size={15} /> Redimensionner
      </button>
      <BasculeVideo />
      <span className="mx-1 h-6 w-px bg-white/25" />
      <button className={icone} title="Annuler (Ctrl+Z)" disabled={!peutAnnuler} onClick={() => etat.annuler()}>
        <Undo2 size={18} />
      </button>
      <button className={icone} title="Rétablir (Ctrl+Maj+Z)" disabled={!peutRetablir} onClick={() => etat.retablir()}>
        <Redo2 size={18} />
      </button>
      <span className="ml-2">
        <EtatEnregistrement />
      </span>
      <IndicateurIa />
      <span className="flex flex-1 justify-center">
        <NomDesign />
      </span>
      <span className="mr-3 text-sm text-white/80 tabular-nums">
        {format.largeur} × {format.hauteur} px
      </span>
      <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setOuvert(ouvert === "export" ? null : "export")} className="flex h-9 items-center gap-2 rounded-lg bg-white px-3.5 text-sm font-medium text-accent-700 hover:bg-accent-50">
        <Download size={16} /> Exporter
      </button>
      {ouvert === "export" && <PanneauExport fermer={() => setOuvert(null)} />}
      {ouvert === "fichier" && <MenuFichier fermer={() => setOuvert(null)} redimensionner={() => setRedimension(true)} />}
      {redimension && <Redimensionner fermer={() => setRedimension(false)} />}
    </header>
  );
}
