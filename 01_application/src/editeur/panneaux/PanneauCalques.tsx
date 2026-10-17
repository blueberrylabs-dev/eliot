// Le panneau des calques (étape 7, lot 1) : tous les éléments de la page, du premier plan vers
// le fond, avec leur icône ou leur miniature et leur nom. On glisse une ligne pour changer
// l'ordre (sur une page vidéo, la piste), on renomme d'un double-clic, on masque, verrouille,
// duplique ou supprime depuis la ligne ; un groupe dont les membres se suivent a sa ligne, qui se
// replie. Survoler une ligne entoure ses éléments sur la page.

import {
  Box,
  ChartColumn,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Film,
  Frame,
  Group as IconeGroupe,
  Image as IconeImage,
  Lock,
  LockOpen,
  PenLine,
  QrCode,
  Shapes,
  Smartphone,
  Smile,
  Sticker,
  Table,
  Trash2,
  Type,
  User,
} from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as PointeurReact, type ReactNode } from "react";
import { elementsCourants, pageCourante, useEditeur } from "../../etat/editeur";
import { elementsDeLigne, lignesCalques, type LigneCalque } from "../../modele/calques";
import { nomElement } from "../../modele/fabriques";
import { estPageVideo, PISTE_PRINCIPALE } from "../../modele/frise";
import type { ElementPage } from "../../modele/types";
import { useUrlRessource } from "../images";
import { survolerCalques } from "../scene";

const SEUIL_PX = 5;

const ICONES: Record<ElementPage["type"], ReactNode> = {
  texte: <Type size={15} />,
  image: <IconeImage size={15} />,
  video: <Film size={15} />,
  forme: <Shapes size={15} />,
  icone: <Sticker size={15} />,
  emoji: <Smile size={15} />,
  personnage: <User size={15} />,
  qr: <QrCode size={15} />,
  cadre: <Frame size={15} />,
  maquette: <Smartphone size={15} />,
  dessin: <PenLine size={15} />,
  graphique: <ChartColumn size={15} />,
  tableau: <Table size={15} />,
  objet3d: <Box size={15} />,
};

/** La ressource dont la miniature représente l'élément (une photo, une vidéo, un objet 3D). */
function ressourceDe(el: ElementPage): string | undefined {
  const r = (el as { ressource?: unknown }).ressource;
  return typeof r === "string" && r ? r : undefined;
}

function Vignette({ el }: { el: ElementPage }) {
  const ressource = ressourceDe(el);
  const url = useUrlRessource(ressource ?? "", "miniature");
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded bg-neutral-100 text-neutral-500" data-icone-calque={el.type}>
      {ressource && url ? <img src={url} alt="" draggable={false} className="h-full w-full object-cover" /> : ICONES[el.type]}
    </span>
  );
}

/** Le nom d'un élément, qu'un double-clic rend modifiable (Entrée garde, Échap revient). */
function Nom({ el }: { el: ElementPage }) {
  const [edition, setEdition] = useState(false);
  const [valeur, setValeur] = useState("");
  const fini = useRef(false);
  const valider = () => {
    if (fini.current) return;
    fini.current = true;
    setEdition(false);
    useEditeur.getState().renommerElement(el.id, valeur);
  };
  if (edition) {
    return (
      <input
        autoFocus
        data-renommer-calque
        aria-label="Nom du calque"
        value={valeur}
        placeholder={nomElement({ ...el, libelle: undefined })}
        onChange={(e) => setValeur(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={valider}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") valider();
          if (e.key === "Escape") {
            fini.current = true;
            setEdition(false);
          }
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="min-w-0 flex-1 rounded border border-accent-400 bg-white px-1 py-0.5 text-sm text-neutral-800 outline-none"
      />
    );
  }
  return (
    <span
      className="min-w-0 flex-1 truncate text-neutral-800"
      title="Double-clic pour renommer"
      data-nom-calque
      onDoubleClick={(e) => {
        e.stopPropagation();
        fini.current = false;
        setValeur(el.libelle ?? "");
        setEdition(true);
      }}
    >
      {nomElement(el)}
    </span>
  );
}

function BoutonLigne({ titre, surClic, children, data }: { titre: string; surClic: () => void; children: ReactNode; data?: string }) {
  return (
    <button
      title={titre}
      aria-label={titre}
      {...(data ? { [data]: "" } : {})}
      className="rounded p-1 text-neutral-500 hover:bg-neutral-200"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        surClic();
      }}
    >
      {children}
    </button>
  );
}

/** Où la ligne glissée tomberait : sur quelle ligne, au-dessus ou au-dessous. */
interface Depot {
  cle: string;
  position: "dessus" | "dessous";
}

const cleDe = (l: LigneCalque) => (l.genre === "groupe" ? `g:${l.groupe}` : `e:${l.el.id}`);

export function PanneauCalques() {
  const elements = useEditeur(elementsCourants);
  const selection = useEditeur((s) => s.selection);
  const video = useEditeur((s) => estPageVideo(pageCourante(s)));
  const [replies, setReplies] = useState<Set<string>>(new Set());
  const [glisse, setGlisse] = useState<string | null>(null);
  const [depot, setDepot] = useState<Depot | null>(null);
  const lignes = lignesCalques(elements, replies);
  const parCle = new Map(lignes.map((l) => [cleDe(l), l]));
  useEffect(() => () => survolerCalques(null), []);

  const etat = () => useEditeur.getState();
  const surPrincipale = (el: ElementPage) => video && (el.piste ?? PISTE_PRINCIPALE) === PISTE_PRINCIPALE;

  /** Glisser une ligne : au pointeur, pour ne pas dépendre du glisser-déposer HTML que
   *  l'enveloppe peut intercepter (comme les panneaux, `glisser.ts`). */
  const commencer = (e: PointeurReact<HTMLElement>, ligne: LigneCalque) => {
    if (e.button !== 0) return;
    const depart = { x: e.clientX, y: e.clientY };
    const cle = cleDe(ligne);
    let actif = false;
    let vise: Depot | null = null;
    const bouger = (ev: PointerEvent) => {
      if (!actif && Math.hypot(ev.clientX - depart.x, ev.clientY - depart.y) < SEUIL_PX) return;
      if (!actif) {
        actif = true;
        setGlisse(cle);
        survolerCalques(null);
      }
      const sous = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>("[data-ligne-calque]");
      const c = sous?.dataset.ligneCalque;
      if (!sous || !c || c === cle) {
        vise = null;
      } else {
        const r = sous.getBoundingClientRect();
        vise = { cle: c, position: ev.clientY < r.top + r.height / 2 ? "dessus" : "dessous" };
      }
      setDepot(vise);
    };
    const finir = () => {
      window.removeEventListener("pointermove", bouger);
      window.removeEventListener("pointerup", finir);
      window.removeEventListener("pointercancel", finir);
      setGlisse(null);
      setDepot(null);
      if (!actif || !vise) return;
      const cible = parCle.get(vise.cle);
      if (!cible) return;
      const ids = elementsDeLigne(ligne).map((x) => x.id);
      // Un groupe visé, ou un membre d'un autre groupe : le bloc entier sert de repère.
      const groupeCible = cible.genre === "groupe" ? cible.groupe : cible.groupe && ligne.genre === "element" && ligne.el.groupe === cible.groupe ? null : cible.groupe ?? null;
      const bloc = groupeCible ? elements.filter((x) => x.groupe === groupeCible) : elementsDeLigne(cible);
      const repere = vise.position === "dessus" ? bloc[bloc.length - 1] : bloc[0];
      if (!repere || ids.includes(repere.id)) return;
      // Un membre posé hors de son groupe le quitte.
      const sortir = ligne.genre === "element" && !!ligne.el.groupe && repere.groupe !== ligne.el.groupe;
      etat().placerCalques(ids, repere.id, vise.position, sortir);
    };
    window.addEventListener("pointermove", bouger);
    window.addEventListener("pointerup", finir);
    window.addEventListener("pointercancel", finir);
  };

  const indicateur = (cle: string, position: "dessus" | "dessous") =>
    depot?.cle === cle && depot.position === position ? <span className={`pointer-events-none absolute right-0 left-0 h-0.5 rounded bg-accent-600 ${position === "dessus" ? "-top-0.5" : "-bottom-0.5"}`} data-indicateur-calque={position} /> : null;

  return (
    <div data-panneau-calques>
      <p className="mb-1 text-sm font-semibold text-neutral-800">Calques</p>
      <p className="mb-3 text-xs text-neutral-500">
        Le haut de la liste est au premier plan. Glisse une ligne pour changer l'ordre{video ? " (sur une page vidéo, elle change de piste)" : ""} ; double-clic sur un nom pour le changer.
      </p>
      {lignes.length === 0 && <p className="text-xs text-neutral-500">La page est vide.</p>}
      <div className="flex flex-col gap-0.5">
        {lignes.map((l) => {
          const cle = cleDe(l);
          if (l.genre === "groupe") {
            const ids = l.membres.map((m) => m.id);
            const choisi = ids.every((id) => selection.includes(id));
            const visibles = l.membres.some((m) => m.visible);
            const verrou = l.membres.every((m) => m.verrouille);
            return (
              <div
                key={cle}
                data-ligne-calque={cle}
                data-groupe-calque={l.groupe}
                onPointerDown={(e) => commencer(e, l)}
                onPointerEnter={() => glisse || survolerCalques(ids)}
                onPointerLeave={() => survolerCalques(null)}
                onClick={(e) => etat().selectionner(ids, e.shiftKey)}
                className={`relative flex cursor-pointer items-center gap-2 rounded-md border px-1.5 py-1 text-sm select-none ${choisi ? "border-accent-500 bg-accent-50" : "border-transparent hover:bg-neutral-100"} ${glisse === cle ? "opacity-40" : ""}`}
              >
                {indicateur(cle, "dessus")}
                <BoutonLigne titre={l.replie ? "Déplier le groupe" : "Replier le groupe"} data="data-replier-groupe" surClic={() => setReplies((r) => (r.has(l.groupe) ? new Set([...r].filter((g) => g !== l.groupe)) : new Set([...r, l.groupe])))}>
                  {l.replie ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </BoutonLigne>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-neutral-100 text-neutral-500">
                  <IconeGroupe size={15} />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-neutral-800">
                  Groupe {l.numero} <span className="font-normal text-neutral-500">({l.membres.length})</span>
                </span>
                <BoutonLigne titre={visibles ? "Masquer le groupe" : "Afficher le groupe"} surClic={() => etat().modifierElements(Object.fromEntries(ids.map((id) => [id, { visible: !visibles }])))}>
                  {visibles ? <Eye size={14} /> : <EyeOff size={14} />}
                </BoutonLigne>
                <BoutonLigne titre={verrou ? "Déverrouiller le groupe" : "Verrouiller le groupe"} surClic={() => etat().modifierElements(Object.fromEntries(ids.map((id) => [id, { verrouille: !verrou }])))}>
                  {verrou ? <Lock size={14} /> : <LockOpen size={14} />}
                </BoutonLigne>
                {indicateur(cle, "dessous")}
              </div>
            );
          }
          const el = l.el;
          const choisi = selection.includes(el.id);
          const fixe = surPrincipale(el);
          return (
            <div
              key={cle}
              data-ligne-calque={cle}
              data-calque={el.id}
              onPointerDown={(e) => (fixe ? undefined : commencer(e, l))}
              onPointerEnter={() => glisse || survolerCalques([el.id])}
              onPointerLeave={() => survolerCalques(null)}
              onClick={(e) => (e.shiftKey ? etat().basculerDansSelection(el.id) : etat().selectionnerSeul(el.id))}
              title={fixe ? "Piste principale : son ordre se règle sur la frise" : undefined}
              className={`group/ligne relative flex cursor-pointer items-center gap-2 rounded-md border py-1 pr-1 text-sm select-none ${l.retrait ? "ml-5 pl-1" : "pl-1.5"} ${choisi ? "border-accent-500 bg-accent-50" : "border-transparent hover:bg-neutral-100"} ${el.visible ? "" : "opacity-50"} ${glisse === cle ? "opacity-40" : ""}`}
            >
              {indicateur(cle, "dessus")}
              <Vignette el={el} />
              <Nom el={el} />
              {l.groupe && !l.retrait && (
                <span className="rounded bg-neutral-100 px-1 text-[10px] text-neutral-500" title="Fait partie d'un groupe dont les membres ne se suivent pas dans la pile">
                  groupe
                </span>
              )}
              <span className="hidden items-center group-hover/ligne:flex">
                <BoutonLigne
                  titre="Dupliquer"
                  data="data-dupliquer-calque"
                  surClic={() => {
                    etat().selectionnerSeul(el.id);
                    etat().dupliquerSelection();
                  }}
                >
                  <Copy size={14} />
                </BoutonLigne>
                <BoutonLigne
                  titre={el.verrouille ? "Verrouillé : déverrouiller pour supprimer" : "Supprimer"}
                  data="data-supprimer-calque"
                  surClic={() => {
                    if (el.verrouille) return;
                    etat().selectionnerSeul(el.id);
                    etat().supprimerSelection();
                    survolerCalques(null);
                  }}
                >
                  <Trash2 size={14} />
                </BoutonLigne>
              </span>
              <BoutonLigne titre={el.visible ? "Masquer" : "Afficher"} data="data-visibilite-calque" surClic={() => etat().basculerVisibilite(el.id)}>
                {el.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </BoutonLigne>
              <BoutonLigne titre={el.verrouille ? "Déverrouiller" : "Verrouiller"} data="data-verrou-calque" surClic={() => etat().modifierElements({ [el.id]: { verrouille: !el.verrouille } })}>
                {el.verrouille ? <Lock size={14} /> : <LockOpen size={14} />}
              </BoutonLigne>
              {indicateur(cle, "dessous")}
            </div>
          );
        })}
      </div>
    </div>
  );
}
