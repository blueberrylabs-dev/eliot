// Réglages des sons choisis dans la frise (étape 4, lot 5), dans la barre de contexte : rôle
// (musique, voix, bruitage), volume, fondus, baisse sous la voix, jusqu'au bout de la page,
// répétition, le crédit d'un son venu de Freesound et, pour une voix (lot 6), son nettoyage.

import { CopyPlus, Pause, Play, Repeat, SlidersHorizontal, Sparkles, Trash2, Volume2, VolumeX } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { pageCourante, useEditeur } from "../etat/editeur";
import { useTemps } from "../etat/temps";
import { boucle, FONDU_FIN_MUSIQUE, ROLES_SON, SOUS_LA_VOIX } from "../modele/son";
import type { ClipAudio, NettoyageVoix, RoleSon } from "../modele/types";
import { borneNettoyage, estVoixNette, nettoyageActif, REGLAGES_NETTOYAGE, VOIX_NETTE } from "../modele/voix";
import { cleVersion, useNettoyages } from "../etat/nettoyage";
import { ouvrirLien } from "../pont/tauri";
import { Bulle } from "./Bulle";
import { Bouton, Curseur, separateur } from "./ElementsBarre";
import { IconeRole, nomSon } from "./frise/ClipSon";
import { dureeLisible } from "./videos";

const secondes = (ms: number) => Math.round(ms / 100) / 10;
const virgule = (v: number, chiffres = 1) => v.toFixed(chiffres).replace(".", ",").replace("-", "−");

/** Où en est la version nettoyée d'un clip : en préparation, prête (son niveau), ou en échec. */
function EtatNettoyage({ c }: { c: ClipAudio }) {
  const cle = cleVersion(c.ressource, c.nettoyage);
  const enCours = useNettoyages((s) => !!s.enCours[cle]);
  const prete = useNettoyages((s) => s.pretes[cle]);
  const erreur = useNettoyages((s) => s.erreurs[cle]);
  if (!nettoyageActif(c.nettoyage)) return <p className="mb-2 text-[11px] text-neutral-500">Aucun nettoyage : la voix telle qu'enregistrée.</p>;
  if (erreur) return <p className="mb-2 text-[11px] text-red-600">Nettoyage impossible : {erreur}</p>;
  if (enCours || !prete) return <p data-nettoyage-en-cours className="mb-2 text-[11px] text-neutral-500">Préparation de la voix nettoyée (l'originale joue en attendant)</p>;
  return (
    <p data-nettoyage-pret className="mb-2 text-[11px] text-neutral-500">
      Voix nettoyée prête{prete.lufs !== undefined ? ` : ${virgule(prete.lufs)} LUFS` : ""}. L'original reste intact.
    </p>
  );
}

/** Les réglages du nettoyage d'une voix, un par un. */
function ReglagesNettoyage({ c, modifier }: { c: ClipAudio; modifier: (n: NettoyageVoix | undefined, etiquette?: string) => void }) {
  const n = c.nettoyage ?? {};
  const changer = (m: Partial<NettoyageVoix>, etiquette: string) => {
    const suivant = borneNettoyage({ ...n, ...m });
    modifier(nettoyageActif(suivant) ? suivant : undefined, etiquette);
  };
  return (
    <>
      <EtatNettoyage c={c} />
      {REGLAGES_NETTOYAGE.map(({ cle, libelle, aide }) => {
        if (cle === "graves" || cle === "niveau") {
          return (
            <label key={cle} title={aide} className="mb-2 flex items-center gap-1.5 text-xs text-neutral-700">
              <input data-reglage-nettoyage={cle} type="checkbox" checked={!!n[cle]} onChange={(e) => changer({ [cle]: e.target.checked || undefined }, `nettoyage-${cle}`)} className="accent-accent-600" />
              {libelle}
            </label>
          );
        }
        const db = cle === "chaleur" || cle === "presence";
        const valeur = (n[cle] as number | undefined) ?? 0;
        return (
          <div key={cle} title={aide} data-reglage-nettoyage={cle}>
            <Curseur
              libelle={libelle}
              valeur={db ? valeur : Math.round(valeur * 100)}
              min={db ? -6 : 0}
              max={db ? 6 : 100}
              pas={db ? 0.5 : 1}
              unite={db ? " dB" : " %"}
              surChange={(x) => changer({ [cle]: db ? x : x / 100 }, `nettoyage-${cle}`)}
            />
          </div>
        );
      })}
      <div className="flex justify-between">
        <button className="text-xs text-accent-700 hover:underline" onClick={() => modifier({ ...VOIX_NETTE })}>
          Remettre Voix nette
        </button>
        <button className="text-xs text-accent-700 hover:underline" onClick={() => modifier(undefined)}>
          Aucun nettoyage
        </button>
      </div>
    </>
  );
}

export function ReglagesSon() {
  const sons = useEditeur(useShallow((s) => (pageCourante(s).audio ?? []).filter((c) => s.selectionAudio.includes(c.id))));
  const ressources = useEditeur((s) => s.ressources);
  const joue = useTemps((s) => s.joue);
  const etat = useEditeur.getState();
  if (sons.length === 0) return null;
  const c = sons[0];
  const seul = sons.length === 1;
  const r = ressources[c.ressource];
  const modifier = (m: Partial<ClipAudio>, etiquette?: string) => etat.modifierSons(Object.fromEntries(sons.map((x) => [x.id, m])), etiquette ? `${etiquette}:${sons.map((x) => x.id).join(",")}` : undefined);
  const volume = c.volume ?? 1;
  const longueur = c.temps.fin - c.temps.debut;
  const fonduMax = Math.max(0.1, Math.min(10, secondes(longueur / 2)));
  const changerRole = (role: RoleSon) => {
    // Une musique devenue voix ou bruitage ne va plus d'office jusqu'au bout.
    const m: Partial<ClipAudio> = { role };
    if (role !== "musique") m.sousLaVoix = undefined;
    modifier(m);
  };
  return (
    <>
      <Bouton titre={joue ? "Pause (Espace)" : "Lire la page (Espace)"} enfoncé={joue} surClic={() => useTemps.getState().basculerLecture()}>
        {joue ? <Pause size={16} /> : <Play size={16} />}
        <span className="ml-1 text-sm">{joue ? "Pause" : "Lire"}</span>
      </Bouton>
      {seul && (
        <span className="flex max-w-56 shrink-0 items-center gap-1 truncate px-1 text-xs text-neutral-600" title={r?.nom}>
          <IconeRole role={c.role} />
          <span className="truncate">{nomSon(r)}</span>
          <span className="text-neutral-400 tabular-nums">{dureeLisible(longueur)}</span>
        </span>
      )}
      {separateur}
      <select
        title="Rôle du son : la musique baisse toute seule quand une voix parle"
        value={sons.every((x) => x.role === c.role) ? c.role : ""}
        onChange={(e) => e.target.value && changerRole(e.target.value as RoleSon)}
        className="h-8 shrink-0 rounded-md border border-neutral-300 bg-white px-1.5 text-sm"
      >
        {!sons.every((x) => x.role === c.role) && <option value="">Rôles mêlés</option>}
        {ROLES_SON.map((x) => (
          <option key={x.id} value={x.id}>
            {x.libelle}
          </option>
        ))}
      </select>
      <Bulle titre="Volume et fondus" largeur={280} bouton={volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}>
        <Curseur libelle="Volume" valeur={Math.round(volume * 100)} min={0} max={100} unite=" %" surChange={(x) => modifier({ volume: x === 100 ? undefined : x / 100 }, "volume-son")} />
        <Curseur libelle="Fondu d'entrée" valeur={secondes(c.fonduEntree ?? 0)} min={0} max={fonduMax} pas={0.1} unite=" s" surChange={(x) => modifier({ fonduEntree: x > 0 ? Math.round(x * 1000) : undefined }, "fondu-entree-son")} />
        <Curseur libelle="Fondu de sortie" valeur={secondes(c.fonduSortie ?? 0)} min={0} max={fonduMax} pas={0.1} unite=" s" surChange={(x) => modifier({ fonduSortie: x > 0 ? Math.round(x * 1000) : undefined }, "fondu-sortie-son")} />
        {c.role === "musique" && (
          <>
            <Curseur
              libelle="Sous la voix, la musique garde"
              valeur={Math.round((c.sousLaVoix ?? SOUS_LA_VOIX) * 100)}
              min={0}
              max={100}
              unite=" %"
              surChange={(x) => modifier({ sousLaVoix: x === Math.round(SOUS_LA_VOIX * 100) ? undefined : x / 100 }, "sous-la-voix")}
            />
            <p className="mb-1 text-[11px] text-neutral-500">Quand un son au rôle Voix parle, la musique baisse un peu avant et remonte un peu après.</p>
          </>
        )}
        <button className="text-xs text-accent-700 hover:underline" onClick={() => modifier({ volume: volume === 0 ? undefined : 0 })}>
          {volume === 0 ? "Remettre le son" : "Couper le son"}
        </button>
      </Bulle>
      {c.role === "voix" && (
        <>
          <Bouton
            titre={estVoixNette(c.nettoyage) ? "Voix nette : clique pour revenir à la voix telle qu'enregistrée" : "Voix nette : bruit de fond réduit, graves coupés, voix plus claire et plus égale, niveau calé (l'original reste intact)"}
            enfoncé={estVoixNette(c.nettoyage)}
            surClic={() => modifier({ nettoyage: estVoixNette(c.nettoyage) ? undefined : { ...VOIX_NETTE } })}
          >
            <Sparkles size={16} />
            <span className="ml-1 text-sm">Voix nette</span>
          </Bouton>
          <Bulle titre="Nettoyage de la voix, réglage par réglage" largeur={300} bouton={<SlidersHorizontal size={16} />} donneesBouton={{ "data-bulle-nettoyage": "" }}>
            <ReglagesNettoyage c={c} modifier={(n, etiquette) => modifier({ nettoyage: n }, etiquette)} />
          </Bulle>
        </>
      )}
      {c.role === "musique" ? (
        <Bouton
          titre={c.jusquALaFin ? "La musique couvre la page jusqu'au bout, répétée au besoin : clique pour l'arrêter à sa longueur" : "Faire durer la musique jusqu'au bout de la page, répétée au besoin, avec un fondu de fin"}
          enfoncé={!!c.jusquALaFin}
          surClic={() => modifier(c.jusquALaFin ? { jusquALaFin: undefined } : { jusquALaFin: true, boucle: undefined, ...(c.fonduSortie ? {} : { fonduSortie: FONDU_FIN_MUSIQUE }) })}
        >
          <Repeat size={16} />
          <span className="ml-1 text-sm">Jusqu'à la fin</span>
        </Bouton>
      ) : (
        <Bouton titre={boucle(c) ? "Ne plus répéter le son" : "Répéter le son : tire ensuite le bord droit du son dans la frise pour la durée voulue"} enfoncé={boucle(c)} surClic={() => modifier(boucle(c) ? { boucle: undefined, jusquALaFin: undefined, phase: undefined } : { boucle: true })}>
          <Repeat size={16} />
          <span className="ml-1 text-sm">Répéter</span>
        </Bouton>
      )}
      {separateur}
      <Bouton titre="Dupliquer (Ctrl+D)" surClic={() => etat.dupliquerSelection()}>
        <CopyPlus size={16} />
      </Bouton>
      <Bouton titre="Supprimer (Suppr)" surClic={() => etat.supprimerSelection()}>
        <Trash2 size={16} />
      </Bouton>
      {seul && r?.credit && (
        <button
          title={`Ouvrir la page du son sur ${r.credit.source}`}
          onClick={() => void ouvrirLien(r.credit!.lien)}
          className="h-8 shrink-0 rounded-md px-2 text-xs whitespace-nowrap text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
        >
          Son : {r.credit.auteur}, {r.credit.source}
          {r.credit.licence ? `, ${r.credit.licence}` : ""}
        </button>
      )}
    </>
  );
}
