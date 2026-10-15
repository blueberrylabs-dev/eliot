// Les voix nettoyées du design ouvert (étape 4, lot 6) : le noyau fabrique une fois la version
// nettoyée d'un son pour des réglages donnés ; l'interface garde la promesse de chacune, sait
// lesquelles sont en préparation (pour le montrer) et lesquelles ont échoué.

import { create } from "zustand";
import { cleNettoyage, nettoyageActif, borneNettoyage } from "../modele/voix";
import type { NettoyageVoix, RefRessources } from "../modele/types";
import { nettoyerVoix, type Traitee } from "../pont/tauri";

interface EtatNettoyages {
  /** Les versions en préparation (clé `ressource|réglages`). */
  enCours: Record<string, true>;
  /** Les versions prêtes. */
  pretes: Record<string, Traitee>;
  /** Les échecs, avec leur message. */
  erreurs: Record<string, string>;
}

export const useNettoyages = create<EtatNettoyages>(() => ({ enCours: {}, pretes: {}, erreurs: {} }));

const promesses = new Map<string, Promise<Traitee>>();
let designCourant = "";

/** La clé d'une version : la ressource et ses réglages bornés. */
export const cleVersion = (ressource: string, n: NettoyageVoix | undefined) => `${ressource}|${cleNettoyage(n)}`;

/** La version nettoyée d'un son : demandée une fois au noyau, puis gardée. */
export function versionNettoyee(ref: RefRessources, ressource: string, n: NettoyageVoix): Promise<Traitee> {
  const design = `${ref.rayon}/${ref.id}`;
  if (design !== designCourant) {
    // Un autre design : ses versions ne servent plus ici.
    promesses.clear();
    designCourant = design;
    useNettoyages.setState({ enCours: {}, pretes: {}, erreurs: {} });
  }
  const cle = cleVersion(ressource, n);
  let p = promesses.get(cle);
  if (!p) {
    useNettoyages.setState((s) => ({ enCours: { ...s.enCours, [cle]: true } }));
    p = nettoyerVoix(ref, ressource, borneNettoyage(n));
    promesses.set(cle, p);
    p.then(
      (t) => {
        if (designCourant !== design) return;
        useNettoyages.setState((s) => {
          const { [cle]: _fini, ...enCours } = s.enCours;
          return { enCours, pretes: { ...s.pretes, [cle]: t } };
        });
      },
      (e: unknown) => {
        promesses.delete(cle);
        if (designCourant !== design) return;
        useNettoyages.setState((s) => {
          const { [cle]: _fini, ...enCours } = s.enCours;
          return { enCours, erreurs: { ...s.erreurs, [cle]: String(e) } };
        });
      },
    );
  }
  return p;
}

/** Les clips nettoyés d'un document : ce que le noyau doit garder en cache. */
export function voixUtilisees(pages: { audio?: { ressource: string; nettoyage?: NettoyageVoix }[] }[]): { ressource: string; nettoyage: NettoyageVoix }[] {
  const vues = new Map<string, { ressource: string; nettoyage: NettoyageVoix }>();
  for (const p of pages) for (const c of p.audio ?? []) if (nettoyageActif(c.nettoyage)) vues.set(cleVersion(c.ressource, c.nettoyage), { ressource: c.ressource, nettoyage: borneNettoyage(c.nettoyage) });
  return [...vues.values()];
}
