// L'onglet Audio (étape 4, lots 5 et 6) : importer un son du poste, sa voix au micro ou en
// synthèse, les sons du design, la recherche Freesound, les jingles de la marque et la liste des
// crédits à coller dans la description d'une vidéo. Un clic pose le son à la tête de lecture, sur la piste audio qui convient ; un
// glisser le pose où l'on veut dans la frise. La page devient une vidéo au besoin.

import { Check, ClipboardCopy, Music, Pause, Play } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { pageCourante, useEditeur } from "../../etat/editeur";
import { useMarque } from "../../etat/marque";
import { importerSonsDuPoste } from "../../etat/sons";
import { ROLES_JINGLE } from "../../modele/marque";
import { creditsDesSons } from "../../modele/son";
import type { Ressource } from "../../modele/types";
import { ouvrirLien, urlCopie } from "../../pont/tauri";
import { useEcoute } from "../ecoute";
import { IconeRole, nomSon } from "../frise/ClipSon";
import { glisserSon } from "../glisserSon";
import { dureeLisible } from "../videos";
import { LigneJingle } from "./PanneauMarque";
import { SectionFreesound } from "./SectionFreesound";
import { SectionVoix } from "./SectionVoix";

/** Une prise ou une voix de synthèse se pose comme une voix ; un son de 20 secondes et plus
 *  comme une musique, un plus court comme un bruitage. */
const roleParDefaut = (r: Ressource) => (r.son?.origine ? "voix" : (r.son?.duree ?? 0) >= 20_000 ? "musique" : "bruitage");

const nombre = (v: number) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(0);

function LigneSon({ ressource }: { ressource: Ressource }) {
  const projet = useEditeur((s) => s.projet);
  const ecoute = useEcoute((s) => s.enCours === `design-${ressource.id}`);
  const son = ressource.son!;
  const credit = ressource.credit;
  return (
    <div
      data-son-design={ressource.id}
      onPointerDown={(e) => glisserSon(e, async () => ressource)}
      title={`${ressource.nom}${credit ? `, par ${credit.auteur} sur ${credit.source}${credit.licence ? ` (${credit.licence})` : ""}` : ""}. Clique pour poser à la tête de lecture, ou glisse dans la frise.`}
      className="mb-1.5 flex cursor-grab items-center gap-1.5 rounded-lg border border-neutral-200 px-2 py-1.5 hover:border-accent-500 hover:bg-accent-50"
    >
      <button
        data-garder-clic
        title={ecoute ? "Arrêter" : "Écouter"}
        onClick={() => projet && useEcoute.getState().basculer(`design-${ressource.id}`, () => urlCopie(projet, ressource))}
        className="shrink-0 rounded-full p-1 text-accent-700 hover:bg-white"
      >
        {ecoute ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <span className="text-neutral-500">
        <IconeRole role={roleParDefaut(ressource)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-neutral-800">{nomSon(ressource)}</span>
        {(credit || son.lufs !== undefined) && (
          <span className="block truncate text-[11px] text-neutral-500">
            {credit ? `${credit.auteur}, ${credit.source}` : ""}
            {credit && son.lufs !== undefined ? " · " : ""}
            {son.lufs !== undefined ? `${nombre(son.lufs)} LUFS` : ""}
          </span>
        )}
      </span>
      <span className="shrink-0 text-[11px] text-neutral-500 tabular-nums">{dureeLisible(son.duree)}</span>
    </div>
  );
}

/** Les crédits des sons de la page, à coller dans la description de la vidéo. */
function Credits() {
  const lignes = useEditeur(useShallow((s) => creditsDesSons(pageCourante(s), s.ressources)));
  const [copie, setCopie] = useState(false);
  if (lignes.length === 0) return null;
  const texte = ["Sons :", ...lignes].join("\n");
  return (
    <div data-credits-sons className="mt-5">
      <p className="mb-2 text-sm font-semibold text-neutral-800">Crédits des sons</p>
      <p className="mb-2 text-[11px] text-neutral-500">À coller dans la description de la vidéo : la licence CC BY demande de citer l'auteur et la licence.</p>
      <pre className="mb-2 max-h-40 overflow-auto rounded-md bg-neutral-50 p-2 text-[11px] whitespace-pre-wrap text-neutral-700">{texte}</pre>
      <button
        onClick={() =>
          void navigator.clipboard?.writeText(texte).then(() => {
            setCopie(true);
            setTimeout(() => setCopie(false), 1500);
          })
        }
        className="flex items-center gap-1.5 text-xs font-medium text-accent-700 hover:underline"
      >
        {copie ? <Check size={14} /> : <ClipboardCopy size={14} />} {copie ? "Copié" : "Copier les crédits"}
      </button>
    </div>
  );
}

export function PanneauAudio() {
  const ressources = useEditeur((s) => s.ressources);
  const ordre = useEditeur((s) => s.ordreRessources);
  const jingles = useMarque((s) => s.kit.jingles);
  const [occupe, setOccupe] = useState(false);
  const sons = ordre.map((id) => ressources[id]).filter((r): r is Ressource => !!r?.son);
  const avecJingle = ROLES_JINGLE.some((j) => jingles[j.id]);

  const importer = async () => {
    setOccupe(true);
    try {
      const importes = await importerSonsDuPoste();
      // Un seul son importé : il va directement dans la frise.
      if (importes?.length === 1) useEditeur.getState().ajouterSon(importes[0]);
    } catch (e) {
      useEditeur.getState().notifier(`Import impossible : ${String(e)}`, { erreur: true });
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-neutral-800">Audio</p>
      <button
        disabled={occupe}
        onClick={() => void importer()}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-600 py-2.5 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-60"
      >
        <Music size={18} /> {occupe ? "Import en cours" : "Importer un son"}
      </button>

      <SectionVoix />

      {sons.length > 0 && (
        <div className="mt-4 mb-4">
          <p className="mb-2 text-sm font-semibold text-neutral-800">Sons du design</p>
          {sons.map((r) => (
            <LigneSon key={r.id} ressource={r} />
          ))}
        </div>
      )}

      <p className="mb-2 text-sm font-semibold text-neutral-800">Freesound</p>
      <SectionFreesound />

      <p className="mt-5 mb-2 text-sm font-semibold text-neutral-800">Jingles de la marque</p>
      {avecJingle ? ROLES_JINGLE.map((j) => <LigneJingle key={j.id} role={j.id} gerer={false} />) : <p className="text-xs text-neutral-500">Range un jingle d'ouverture et un de fin dans l'onglet Marque : ils se posent ensuite d'un clic au début ou à la fin de tes vidéos.</p>}

      <Credits />

      <p className="mt-5 mb-1 text-sm font-semibold text-neutral-800">Autres musiques libres</p>
      <p className="text-[11px] text-neutral-500">
        <button onClick={() => void ouvrirLien("https://pixabay.com/music/")} className="text-accent-700 hover:underline">
          Pixabay Musique
        </button>
        ,{" "}
        <button onClick={() => void ouvrirLien("https://www.youtube.com/audiolibrary")} className="text-accent-700 hover:underline">
          YouTube Audio Library
        </button>{" "}
        et{" "}
        <button onClick={() => void ouvrirLien("https://freemusicarchive.org/")} className="text-accent-700 hover:underline">
          Free Music Archive
        </button>{" "}
        n'ont pas d'accès pour Eliot : télécharge sur leur site, puis « Importer un son ». Vérifie la licence de chaque titre : ceux de YouTube Audio Library sont pour la plupart réservés à YouTube, ceux de Free Music Archive ont chacun la leur.
      </p>
    </div>
  );
}
