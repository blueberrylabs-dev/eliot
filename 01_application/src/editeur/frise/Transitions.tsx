// Le bouton entre deux clips de la piste principale (étape 4, lot 3), comme dans CapCut : il
// ajoute, change ou retire la transition, règle sa durée et la montre (la page joue le passage,
// puis s'arrête). Avec une transition, les deux clips se chevauchent : la page raccourcit.

import { Blend, Play, Plus } from "lucide-react";
import { useEditeur } from "../../etat/editeur";
import { useTemps } from "../../etat/temps";
import { DUREE_TRANSITION, TRANSITIONS } from "../../modele/animation";
import type { ElementPage } from "../../modele/types";
import { Bulle } from "../Bulle";
import { Curseur } from "../ElementsBarre";

const secondes = (ms: number) => Math.round(ms / 100) / 10;

export function BoutonTransition({ a, b, echelle }: { a: ElementPage; b: ElementPage; echelle: number }) {
  const t = b.transition;
  const etat = useEditeur.getState();
  // La moitié du plus court des deux clips, longueurs comptées sans le chevauchement.
  const longueurA = a.temps!.fin - a.temps!.debut;
  const longueurB = b.temps!.fin - b.temps!.debut;
  const max = Math.floor(Math.min(longueurA, longueurB) / 2);
  const x = (t ? (b.temps!.debut + a.temps!.fin) / 2 : b.temps!.debut) * echelle;
  const libelle = TRANSITIONS.find((d) => d.nom === t?.nom)?.libelle;

  /** Joue le passage d'un clip à l'autre, avec une demi-seconde de chaque côté. */
  const montrer = () => {
    const page = useEditeur.getState().document.pages.find((p) => p.elements.some((e) => e.id === b.id));
    const bb = page?.elements.find((e) => e.id === b.id);
    if (!bb?.temps) return;
    const fenetre = bb.transition ? Math.min(bb.transition.duree, max) : 0;
    useTemps.getState().lireJusqua(bb.temps.debut - 500, bb.temps.debut + fenetre + 500);
  };
  const choisir = (nom: string | null) => {
    etat.definirTransition(b.id, nom ? { nom, duree: Math.min(t?.duree ?? DUREE_TRANSITION, max) } : null);
    if (nom) montrer();
  };

  const vignette = (actif: boolean) =>
    `rounded-md border px-1.5 py-2 text-[11px] leading-tight ${actif ? "border-accent-500 bg-accent-50 font-medium text-accent-700" : "border-neutral-200 text-neutral-700 hover:border-accent-400 hover:bg-accent-50"}`;

  return (
    <Bulle
      titre={t ? `Transition : ${libelle ?? t.nom}` : "Ajouter une transition entre ces deux clips"}
      largeur={280}
      donneesBouton={{ "data-transition": b.id }}
      styleBouton={{ left: x }}
      classeBouton={`absolute top-1/2 z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border shadow ${t ? "border-white bg-accent-600 text-white" : "border-white/60 bg-zinc-900/80 text-white/80 hover:bg-zinc-700"}`}
      bouton={t ? <Blend size={13} /> : <Plus size={13} />}
    >
      <p className="mb-2 text-xs font-medium text-neutral-700">Transition</p>
      {max < 100 ? (
        <p className="text-xs text-neutral-500">Ces clips sont trop courts pour une transition (il faut 0,2 s chacun au moins).</p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-1">
            <button data-nom-transition="" className={vignette(!t)} onClick={() => choisir(null)}>
              Aucune
            </button>
            {TRANSITIONS.map((d) => (
              <button key={d.nom} data-nom-transition={d.nom} className={vignette(t?.nom === d.nom)} onClick={() => choisir(d.nom)}>
                {d.libelle}
              </button>
            ))}
          </div>
          {t && (
            <>
              <Curseur libelle="Durée" valeur={secondes(Math.min(t.duree, max))} min={0.1} max={Math.max(0.1, secondes(max))} pas={0.1} unite=" s" surChange={(v) => etat.definirTransition(b.id, { nom: t.nom, duree: Math.round(v * 1000) })} />
              <button onClick={montrer} className="mb-2 flex items-center gap-1 text-xs text-accent-700 hover:underline">
                <Play size={12} /> Voir le passage
              </button>
            </>
          )}
          <p className="text-xs text-neutral-500">Les deux clips se chevauchent pendant la transition : la vidéo raccourcit d'autant.</p>
        </>
      )}
    </Bulle>
  );
}
