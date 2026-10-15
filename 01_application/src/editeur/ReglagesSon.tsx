// Réglages des sons choisis dans la frise (étape 4, lot 5), dans la barre de contexte : rôle
// (musique, voix, bruitage), volume, fondus, baisse sous la voix, jusqu'au bout de la page,
// répétition, et le crédit d'un son venu de Freesound.

import { CopyPlus, Pause, Play, Repeat, Trash2, Volume2, VolumeX } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { pageCourante, useEditeur } from "../etat/editeur";
import { useTemps } from "../etat/temps";
import { boucle, FONDU_FIN_MUSIQUE, ROLES_SON, SOUS_LA_VOIX } from "../modele/son";
import type { ClipAudio, RoleSon } from "../modele/types";
import { ouvrirLien } from "../pont/tauri";
import { Bulle } from "./Bulle";
import { Bouton, Curseur, separateur } from "./ElementsBarre";
import { IconeRole, nomSon } from "./frise/ClipSon";
import { dureeLisible } from "./videos";

const secondes = (ms: number) => Math.round(ms / 100) / 10;

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
