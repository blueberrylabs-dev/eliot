// Réglages d'une vidéo dans la barre de contexte : lecture, son, vitesse, coupe. Sur une page
// vidéo, Lire lance toute la page (comme Espace) et la coupe se règle aussi à la souris, en
// tirant les bords du clip dans la frise ; ici, deux curseurs donnent la valeur exacte.

import { Pause, Play, Scissors, Volume2, VolumeX } from "lucide-react";
import { useEditeur } from "../etat/editeur";
import { dureeJouee } from "../modele/fabriques";
import type { ElementPage, ElementVideo } from "../modele/types";
import { Bulle } from "./Bulle";
import { BulleBlancs } from "./BulleBlancs";
import { Bouton, Curseur, separateur } from "./ElementsBarre";
import { dureeLisible, useLecture } from "./videos";
import { useTemps } from "../etat/temps";

export const VITESSES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

const secondes = (ms: number) => Math.round(ms / 100) / 10;

export function ReglagesVideo({ v }: { v: ElementVideo }) {
  const etat = useEditeur.getState();
  const ressource = useEditeur((s) => s.ressources[v.ressource]);
  const pageVideo = v.temps !== undefined;
  const joueSeule = useLecture((s) => !!s.enLecture[v.id]);
  const jouePage = useTemps((s) => s.joue);
  const joue = pageVideo ? jouePage : joueSeule;
  const duree = ressource?.video?.duree ?? 0;
  const modifier = (m: Partial<ElementVideo>, etiquette?: string) => etat.modifierElements({ [v.id]: m as Partial<ElementPage> }, etiquette ? `${etiquette}:${v.id}` : undefined);
  const volume = v.volume ?? 1;
  const debut = v.coupe?.debut ?? 0;
  const fin = Math.min(v.coupe?.fin ?? duree, duree);
  // Une coupe qui couvre tout le fichier disparaît du document.
  const couper = (d: number, f: number) => {
    const debutMs = Math.max(0, Math.min(Math.round(d), duree - 100));
    const finMs = Math.max(debutMs + 100, Math.min(Math.round(f), duree));
    const coupe = { debut: debutMs, ...(finMs < duree ? { fin: finMs } : {}) };
    modifier({ coupe: debutMs === 0 && finMs >= duree ? undefined : coupe }, "coupe");
  };

  return (
    <>
      <Bouton titre={joue ? "Pause (Espace)" : pageVideo ? "Lire la page (Espace)" : "Lire la vidéo"} enfoncé={joue} surClic={() => (pageVideo ? useTemps.getState().basculerLecture() : useLecture.getState().basculer(v.id))}>
        {joue ? <Pause size={16} /> : <Play size={16} />}
        <span className="ml-1 text-sm">{joue ? "Pause" : "Lire"}</span>
      </Bouton>
      {duree > 0 && <span className="shrink-0 px-1 text-xs text-neutral-500 tabular-nums">{dureeLisible(dureeJouee(v, duree))}</span>}
      {separateur}
      <Bulle titre="Son" largeur={260} bouton={volume === 0 || !ressource?.video?.son ? <VolumeX size={16} /> : <Volume2 size={16} />}>
        {ressource?.video?.son === false ? (
          <p className="text-xs text-neutral-500">Cette vidéo n'a pas de son.</p>
        ) : (
          <>
            <Curseur libelle="Volume" valeur={Math.round(volume * 100)} min={0} max={100} unite=" %" surChange={(x) => modifier({ volume: x / 100 }, "volume")} />
            {v.temps && (
              <>
                <Curseur libelle="Fondu d'entrée du son" valeur={secondes(v.fonduEntree ?? 0)} min={0} max={Math.max(0.1, Math.min(5, secondes((v.temps.fin - v.temps.debut) / 2)))} pas={0.1} unite=" s" surChange={(x) => modifier({ fonduEntree: x > 0 ? Math.round(x * 1000) : undefined }, "fondu-entree")} />
                <Curseur libelle="Fondu de sortie du son" valeur={secondes(v.fonduSortie ?? 0)} min={0} max={Math.max(0.1, Math.min(5, secondes((v.temps.fin - v.temps.debut) / 2)))} pas={0.1} unite=" s" surChange={(x) => modifier({ fonduSortie: x > 0 ? Math.round(x * 1000) : undefined }, "fondu-sortie")} />
              </>
            )}
            <button className="text-xs text-accent-700 hover:underline" onClick={() => modifier({ volume: volume === 0 ? 1 : 0 })}>
              {volume === 0 ? "Remettre le son" : "Couper le son"}
            </button>
            {v.temps && volume > 0 && (
              <div className="mt-2 border-t border-neutral-100 pt-2">
                <button
                  data-detacher-son
                  disabled={(v.vitesse ?? 1) !== 1}
                  className="text-xs text-accent-700 hover:underline disabled:text-neutral-400 disabled:no-underline"
                  onClick={() => etat.detacherSon(v.id)}
                >
                  Détacher le son
                </button>
                <p className="text-[11px] text-neutral-500">
                  {(v.vitesse ?? 1) !== 1 ? "Remets la vitesse à 1× pour détacher le son." : "Le son passe sur une piste audio, comme une voix : la musique baissera dessous. La vidéo devient muette."}
                </p>
              </div>
            )}
          </>
        )}
      </Bulle>
      <select
        title="Vitesse"
        value={v.vitesse ?? 1}
        onChange={(e) => modifier({ vitesse: Number(e.target.value) === 1 ? undefined : Number(e.target.value) })}
        className="h-8 shrink-0 rounded-md border border-neutral-300 bg-white px-1.5 text-sm tabular-nums"
      >
        {VITESSES.map((x) => (
          <option key={x} value={x}>
            {String(x).replace(".", ",")}×
          </option>
        ))}
      </select>
      {pageVideo && ressource?.video?.son && <BulleBlancs id={v.id} />}
      {duree > 0 && (
        <Bulle titre="Couper la vidéo" largeur={280} bouton={<><Scissors size={16} /><span className="ml-1 text-sm">Couper</span></>}>
          <Curseur libelle="Début" valeur={secondes(debut)} min={0} max={secondes(duree)} pas={0.1} unite=" s" surChange={(x) => couper(x * 1000, Math.max(fin, x * 1000 + 100))} />
          <Curseur libelle="Fin" valeur={secondes(fin)} min={0} max={secondes(duree)} pas={0.1} unite=" s" surChange={(x) => couper(Math.min(debut, x * 1000 - 100), x * 1000)} />
          <p className="mb-1 text-xs text-neutral-500">
            Joue {dureeLisible(dureeJouee(v, duree))} sur {dureeLisible(duree)}{pageVideo ? "." : ", en boucle sur une page fixe."}
          </p>
          {v.coupe && (
            <button className="text-xs text-accent-700 hover:underline" onClick={() => modifier({ coupe: undefined })}>
              Toute la vidéo
            </button>
          )}
        </Bulle>
      )}
    </>
  );
}
