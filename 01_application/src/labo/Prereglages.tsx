// Les préréglages du labo (étape 5, lot 3) : une vingtaine fournis, rangés par catégorie, et
// ceux qu'Alexandre enregistre (« Les miens »). Chaque vignette montre la photo avec le
// préréglage ; la survoler le montre sur la page sans changer le document ; un clic l'applique.
// Juste après, un curseur règle son intensité, tant que le style n'a pas été retouché. Un
// préréglage garde l'exposition, la netteté et la réduction du bruit de la photo.

import { Check, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cleReglages, type ReglagesPhoto } from "../modele/labo";
import { appliquerPrereglage, CATEGORIE_MIENS, CATEGORIES_FOURNIES, gardes, memeStyle, PREREGLAGES_FOURNIS, style, type Prereglage } from "../modele/prereglages";
import type { ElementImage, ElementVideo } from "../modele/types";
import { useEditeur } from "../etat/editeur";
import { chargerPrereglages, enregistrerPrereglage, supprimerPrereglage, usePrereglages } from "./prereglages";
import { finGeste, useLabo, vignettesRetouchees } from "./retouche";

/** La catégorie ouverte reste d'une photo à l'autre. */
let categorieRetenue = CATEGORIES_FOURNIES[0];

export function Prereglages({ el, source, modifier }: { el: ElementImage | ElementVideo; source: HTMLImageElement | null; modifier: (r: ReglagesPhoto | undefined, etiquette: string) => void }) {
  const miens = usePrereglages((s) => s.miens);
  const erreur = usePrereglages((s) => s.erreur);
  const applique = useLabo((s) => (s.applique?.photo === el.id ? s.applique : null));
  const [categorie, setCategorie] = useState(categorieRetenue);
  const [vignettes, setVignettes] = useState<Map<string, string>>(new Map());
  const [nom, setNom] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  useEffect(() => void chargerPrereglages(), []);

  const categories = miens.length ? [...CATEGORIES_FOURNIES, CATEGORIE_MIENS] : CATEGORIES_FOURNIES;
  const ouverte = categories.includes(categorie) ? categorie : CATEGORIES_FOURNIES[0];
  const tous = useMemo(() => [...PREREGLAGES_FOURNIS, ...miens], [miens]);
  const liste = tous.filter((p) => p.categorie === ouverte);
  const prereglageApplique = applique ? tous.find((p) => p.id === applique.prereglage) : undefined;
  // L'intensité se règle tant que le style de la photo est celui que le préréglage a donné.
  const intensiteReglable = !!applique && !!prereglageApplique && memeStyle(el.reglages, appliquerPrereglage(el.reglages, prereglageApplique, applique.intensite));

  // Les vignettes : la photo avec chaque préréglage de la catégorie, et ce qu'elle garde.
  const cleGardes = cleReglages(gardes(el.reglages));
  const cleListe = liste.map((p) => `${p.id}:${cleReglages(p.reglages)}`).join("|");
  useEffect(() => {
    if (!source) return;
    let fini = false;
    let minuteur: ReturnType<typeof setTimeout>;
    const essayer = () => {
      if (fini) return;
      const v = vignettesRetouchees(
        source,
        liste.map((p) => ({ cle: p.id, reglages: appliquerPrereglage(el.reglages, p) })),
      );
      // Un curseur tiré ou un préréglage survolé : la toile du moteur est prise, on réessaie.
      if (v) setVignettes(v);
      else minuteur = setTimeout(essayer, 300);
    };
    minuteur = setTimeout(essayer, 60);
    return () => {
      fini = true;
      clearTimeout(minuteur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, cleGardes, cleListe]);

  const choisirCategorie = (c: string) => {
    categorieRetenue = c;
    setCategorie(c);
    setASupprimer(null);
  };

  const appliquer = (p: Prereglage) => {
    useLabo.setState({ essai: null, applique: { photo: el.id, prereglage: p.id, intensite: 100 } });
    modifier(appliquerPrereglage(el.reglages, p, 100), `prereglage-${p.id}`);
  };

  const enregistrer = async () => {
    if (!nom?.trim()) return;
    try {
      const p = await enregistrerPrereglage(nom, el.reglages);
      setNom(null);
      choisirCategorie(CATEGORIE_MIENS);
      useLabo.setState({ applique: { photo: el.id, prereglage: p.id, intensite: 100 } });
      useEditeur.getState().notifier(`Préréglage enregistré : ${p.nom}.`);
    } catch (e) {
      useEditeur.getState().notifier(`Préréglage non enregistré : ${String(e instanceof Error ? e.message : e)}`, { erreur: true });
    }
  };

  const remplace = nom !== null && miens.some((p) => p.nom.toLowerCase() === nom.trim().toLowerCase());
  const aUnStyle = !!style(el.reglages);

  return (
    <div data-prereglages>
      <div className="mb-2 flex flex-wrap gap-1">
        {categories.map((c) => (
          <button
            key={c}
            data-categorie={c}
            aria-pressed={c === ouverte}
            onClick={() => choisirCategorie(c)}
            className={`rounded-full px-2 py-0.5 text-xs ${c === ouverte ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5" onPointerLeave={() => useLabo.getState().essai && useLabo.setState({ essai: null })}>
        {liste.map((p) => {
          const actif = applique?.prereglage === p.id ? intensiteReglable : memeStyle(el.reglages, appliquerPrereglage(el.reglages, p));
          const mien = p.categorie === CATEGORIE_MIENS;
          return (
            <div key={p.id} className="group relative">
              <button
                data-prereglage={p.id}
                aria-pressed={actif}
                title={p.nom}
                onPointerEnter={() => useLabo.setState({ essai: { id: el.id, reglages: appliquerPrereglage(el.reglages, p) } })}
                onClick={() => appliquer(p)}
                className={`block w-full overflow-hidden rounded-md text-left ${actif ? "ring-2 ring-accent-600 ring-offset-1" : "hover:ring-1 hover:ring-neutral-300"}`}
              >
                <span className="block aspect-[4/3] w-full bg-neutral-200 bg-cover bg-center" style={vignettes.get(p.id) ? { backgroundImage: `url(${vignettes.get(p.id)})` } : undefined} />
                <span className="block truncate px-0.5 py-0.5 text-[11px] leading-tight text-neutral-700">{p.nom}</span>
              </button>
              {mien &&
                (aSupprimer === p.id ? (
                  <button
                    data-confirmer-suppression={p.id}
                    onClick={() => {
                      setASupprimer(null);
                      void supprimerPrereglage(p.id).catch((e) => useEditeur.getState().notifier(`Préréglage non supprimé : ${String(e)}`, { erreur: true }));
                    }}
                    className="absolute inset-x-0 top-0 rounded-t-md bg-red-600 py-0.5 text-[11px] font-medium text-white"
                  >
                    Supprimer ?
                  </button>
                ) : (
                  <button
                    data-supprimer-prereglage={p.id}
                    title="Supprimer ce préréglage"
                    onClick={() => setASupprimer(p.id)}
                    className="absolute top-0.5 right-0.5 hidden rounded bg-white/90 p-0.5 text-neutral-600 shadow group-hover:block hover:text-red-600"
                  >
                    <Trash2 size={12} />
                  </button>
                ))}
            </div>
          );
        })}
      </div>
      {intensiteReglable && prereglageApplique && (
        <div className="mt-2.5" data-intensite>
          <div className="mb-0.5 flex justify-between text-xs">
            <span className="text-neutral-700">Intensité : {prereglageApplique.nom}</span>
            <span className="tabular-nums text-neutral-500">{applique!.intensite} %</span>
          </div>
          <input
            type="range"
            aria-label="Intensité du préréglage"
            min={0}
            max={100}
            step={1}
            value={applique!.intensite}
            onPointerDown={() => useLabo.setState({ geste: true })}
            onPointerUp={finGeste}
            onPointerCancel={finGeste}
            onKeyDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const v = Number(e.target.value);
              useLabo.setState({ applique: { photo: el.id, prereglage: prereglageApplique.id, intensite: v } });
              modifier(appliquerPrereglage(el.reglages, prereglageApplique, v), "intensite");
            }}
            className="w-full accent-accent-600"
          />
        </div>
      )}
      {nom === null ? (
        <button
          data-enregistrer-prereglage
          disabled={!aUnStyle}
          onClick={() => setNom("")}
          title={aUnStyle ? "Garder ce style pour d'autres photos" : "Retouche d'abord la photo"}
          className="mt-2 flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-accent-700 hover:bg-accent-50 disabled:text-neutral-400 disabled:hover:bg-transparent"
        >
          <Plus size={14} /> Enregistrer comme préréglage
        </button>
      ) : (
        <div className="mt-2 flex items-center gap-1">
          <input
            autoFocus
            aria-label="Nom du préréglage"
            placeholder="Nom du préréglage"
            maxLength={60}
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") void enregistrer();
              if (e.key === "Escape") setNom(null);
            }}
            className="min-w-0 flex-1 rounded-md border border-neutral-300 px-2 py-1 text-xs focus:border-accent-500 focus:outline-none"
          />
          <button onClick={() => void enregistrer()} disabled={!nom.trim()} title={remplace ? "Remplacer le préréglage du même nom" : "Enregistrer"} className="flex items-center gap-0.5 rounded-md bg-accent-600 px-2 py-1 text-xs text-white disabled:opacity-40">
            <Check size={13} /> {remplace ? "Remplacer" : "OK"}
          </button>
          <button onClick={() => setNom(null)} title="Annuler" className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100">
            <X size={14} />
          </button>
        </div>
      )}
      <p className="mt-1 text-[11px] text-neutral-400">Un préréglage garde l'exposition, la netteté et la réduction du bruit de la photo.</p>
      {erreur && <p className="mt-1 text-[11px] text-red-600">{erreur}</p>}
    </div>
  );
}
