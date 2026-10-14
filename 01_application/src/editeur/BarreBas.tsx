// La barre du bas, comme dans Canva : bande des pages (vignettes, ajouter, réordonner), zoom,
// vue en grille, plein écran.

import { Copy, Grid2x2, Maximize, Plus, Rows3, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditeur } from "../etat/editeur";
import { glisserPourReordonner } from "./reordonner";
import { Vignette } from "./Vignette";

const LARGEUR_VIGNETTE = 96;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;

/** Le curseur du zoom suit une échelle logarithmique : 10 %, 100 % et 400 % tombent à des
 *  écarts réguliers. */
const versCurseur = (z: number) => (Math.log(z / ZOOM_MIN) / Math.log(ZOOM_MAX / ZOOM_MIN)) * 100;
const depuisCurseur = (v: number) => ZOOM_MIN * Math.pow(ZOOM_MAX / ZOOM_MIN, v / 100);

function BandePages() {
  const pages = useEditeur(useShallow((s) => s.document.pages));
  const format = useEditeur((s) => s.document.format);
  const active = useEditeur((s) => s.pageActive);
  const etat = useEditeur.getState();
  const cases = useRef<(HTMLDivElement | null)[]>([]);
  const [cible, setCible] = useState<number | null>(null);
  const hauteur = Math.round((LARGEUR_VIGNETTE * format.hauteur) / format.largeur);
  const largeur = hauteur > 64 ? Math.round((64 * format.largeur) / format.hauteur) : LARGEUR_VIGNETTE;

  return (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-t border-neutral-200 bg-white px-3 py-2 defilement-fin" data-bande-pages>
      {pages.map((p, rang) => (
        <div
          key={p.id}
          ref={(n) => {
            cases.current[rang] = n;
          }}
          className="group relative shrink-0"
          onPointerDown={(e) =>
            glisserPourReordonner(e, () => cases.current.slice(0, pages.length).map((c) => c!.getBoundingClientRect()), {
              surCible: setCible,
              surLacher: (r) => etat.deplacerPage(p.id, r),
              surClic: () => etat.allerALaPage(p.id),
            })
          }
          title={`Page ${rang + 1}`}
        >
          {cible === rang && <span className="absolute top-0 -left-1.5 h-full w-0.5 rounded bg-accent-600" />}
          <div className={`cursor-pointer overflow-hidden rounded-md border-2 ${p.id === active ? "border-accent-600" : "border-neutral-200 hover:border-neutral-400"}`}>
            <Vignette page={p} format={format} largeur={largeur} />
          </div>
          <span className="absolute bottom-0.5 left-1 rounded bg-white/85 px-1 text-[10px] font-medium text-neutral-700">{rang + 1}</span>
          <div className="absolute top-0.5 right-0.5 hidden gap-0.5 group-hover:flex">
            <button
              title="Dupliquer la page"
              className="rounded bg-white/90 p-0.5 text-neutral-700 shadow hover:bg-white"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                etat.allerALaPage(p.id);
                etat.dupliquerPageActive();
              }}
            >
              <Copy size={12} />
            </button>
            {pages.length > 1 && (
              <button
                title="Supprimer la page"
                className="rounded bg-white/90 p-0.5 text-neutral-700 shadow hover:bg-white"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => etat.supprimerPage(p.id)}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
      ))}
      <button
        title="Ajouter une page"
        onClick={() => etat.ajouterPage()}
        className="flex shrink-0 items-center justify-center rounded-md border-2 border-dashed border-neutral-300 text-neutral-500 hover:border-accent-500 hover:text-accent-600"
        style={{ width: largeur, height: Math.round((largeur * format.hauteur) / format.largeur) }}
      >
        <Plus size={20} />
      </button>
    </div>
  );
}

export function BarreBas() {
  const zoom = useEditeur((s) => s.zoom);
  const nombrePages = useEditeur((s) => s.document.pages.length);
  const rang = useEditeur((s) => s.document.pages.findIndex((p) => p.id === s.pageActive));
  const vueGrille = useEditeur((s) => s.vueGrille);
  const etat = useEditeur.getState();
  const [bande, setBande] = useState(true);
  const zoomAjuste = useEditeur((s) => s.zoomAjuste);
  const zoomAffiche = zoom ?? zoomAjuste;
  const bouton = (actif = false) => `flex h-8 items-center gap-1.5 rounded-md px-2 text-sm ${actif ? "bg-accent-50 text-accent-700" : "text-neutral-700 hover:bg-neutral-100"}`;

  return (
    <div className="shrink-0">
      {bande && !vueGrille && <BandePages />}
      <div className="flex h-10 items-center gap-1 border-t border-neutral-200 bg-white px-3">
        <button className={bouton(bande)} onClick={() => setBande(!bande)} title="Afficher ou masquer la bande des pages">
          <Rows3 size={16} /> Pages
        </button>
        <span className="ml-1 text-sm text-neutral-500 tabular-nums">
          {rang + 1} / {nombrePages}
        </span>
        <span className="flex-1" />
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={versCurseur(zoomAffiche)}
          onChange={(e) => etat.definirZoom(depuisCurseur(Number(e.target.value)))}
          className="w-40 accent-accent-600"
          title="Zoom (Ctrl + molette)"
        />
        <button className={`${bouton(zoom === null)} w-16 justify-center tabular-nums`} title="Ajuster à l'écran (Ctrl+0)" onClick={() => etat.definirZoom(null)}>
          {Math.round(zoomAffiche * 100)} %
        </button>
        <span className="mx-1 h-5 w-px bg-neutral-200" />
        <button className={bouton(vueGrille)} title="Vue en grille des pages" onClick={() => etat.basculerVueGrille()}>
          <Grid2x2 size={16} />
        </button>
        <button className={bouton()} title="Aperçu en plein écran (F11 ou Échap pour sortir)" onClick={() => etat.basculerApercu(true)}>
          <Maximize size={16} />
        </button>
      </div>
    </div>
  );
}
