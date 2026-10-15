// La bulle « Blancs » d'une vidéo ou d'une voix (étape 4, lot 7) : couper les silences trop
// longs et, avec Whisper, les hésitations (« euh », « hum »). Avant de couper, elle dit ce que la
// coupe retirerait ; le clip devient des morceaux qui se suivent, qu'on peut rallonger un à un
// pour rendre ce qui a été coupé, et Ctrl+Z revient en arrière d'un coup.

import { AudioLines, X } from "lucide-react";
import { useEffect, useState } from "react";
import { couperLesBlancs, apercuCoupe, useParole, whisperPret } from "../etat/parole";
import { useEditeur } from "../etat/editeur";
import { OPTIONS_BLANCS, SILENCE_MIN, type OptionsBlancs } from "../modele/parole";
import { Bulle } from "./Bulle";
import { Curseur } from "./ElementsBarre";

const CLE_OPTIONS = "eliot-blancs";
const virgule = (v: number) => v.toFixed(1).replace(".", ",");

function lireOptions(): { silence: number; hesitations: boolean } {
  try {
    const v = JSON.parse(localStorage.getItem(CLE_OPTIONS) ?? "null") as { silence?: number; hesitations?: boolean } | null;
    return { silence: Math.min(SILENCE_MIN.max, Math.max(SILENCE_MIN.min, v?.silence ?? OPTIONS_BLANCS.silenceMin)), hesitations: v?.hesitations ?? true };
  } catch {
    return { silence: OPTIONS_BLANCS.silenceMin, hesitations: true };
  }
}

/** L'avancement d'une transcription, avec de quoi l'arrêter. */
export function AvancementParole() {
  const travail = useParole((s) => s.travail);
  if (!travail) return null;
  return (
    <div data-transcription-en-cours className="mb-2">
      <div className="mb-1 flex items-center justify-between text-[11px] text-neutral-600">
        <span className="truncate">
          Transcription{travail.total > 1 ? ` ${travail.rang + 1} sur ${travail.total}` : ""} : {travail.nom}
        </span>
        <button title="Arrêter la transcription" className="rounded p-0.5 text-neutral-500 hover:bg-neutral-100" onClick={() => useParole.getState().annuler()}>
          <X size={13} />
        </button>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-neutral-200">
        <div className="h-full bg-accent-500 transition-[width]" style={{ width: `${Math.round(travail.avancement * 100)}%` }} />
      </div>
    </div>
  );
}

function ContenuBlancs({ id }: { id: string }) {
  const [options, setOptions] = useState(lireOptions);
  const whisper = useParole((s) => s.whisper);
  const analyses = useParole((s) => s.analyses);
  const travail = useParole((s) => s.travail);
  const [apercu, setApercu] = useState<{ blancs: number; retire: number; transcrit: boolean } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const manque = whisperPret(whisper);
  const hesitations = options.hesitations && !manque;
  const reglages: OptionsBlancs = { ...OPTIONS_BLANCS, silenceMin: options.silence, hesitations };

  useEffect(() => {
    if (!whisper) void useParole.getState().verifierWhisper();
  }, [whisper]);

  useEffect(() => {
    let actif = true;
    setErreur(null);
    apercuCoupe(id, reglages).then(
      (r) => {
        if (!actif || !r) return;
        const { garder, retire, fenetre, transcrit } = r;
        const bords = (garder.length && garder[0].debut > fenetre.debut ? 1 : 0) + (garder.length && garder[garder.length - 1].fin < fenetre.fin ? 1 : 0);
        setApercu({ blancs: Math.max(0, garder.length - 1) + bords, retire, transcrit });
      },
      (e: unknown) => actif && setErreur(String(e instanceof Error ? e.message : e)),
    );
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, options.silence, hesitations, analyses]);

  const changer = (o: Partial<typeof options>) => {
    const suivant = { ...options, ...o };
    setOptions(suivant);
    try {
      localStorage.setItem(CLE_OPTIONS, JSON.stringify(suivant));
    } catch {
      // Le choix vaut le temps de la session.
    }
  };

  const couper = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      const bilan = await couperLesBlancs(id, reglages);
      const notifier = useEditeur.getState().notifier;
      if (!bilan) notifier("Aucun blanc à couper dans ce clip.");
      else notifier(`Blancs coupés : ${bilan.morceaux} morceaux, ${virgule(bilan.retire / 1000)} s de moins.${bilan.sousTitres ? " Les sous-titres suivent." : ""} Ctrl+Z pour revenir.`);
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <>
      <div data-reglage-silence>
        <Curseur libelle="Couper les blancs de plus de" valeur={options.silence / 1000} min={SILENCE_MIN.min / 1000} max={SILENCE_MIN.max / 1000} pas={0.1} unite=" s" surChange={(x) => changer({ silence: Math.round(x * 1000) })} />
      </div>
      <label className="mb-1 flex items-center gap-1.5 text-xs text-neutral-700" title={manque ?? "Whisper écoute la voix et repère les «\u00a0euh\u00a0» et les «\u00a0hum\u00a0»"}>
        <input data-option-hesitations type="checkbox" checked={hesitations} disabled={!!manque} onChange={(e) => changer({ hesitations: e.target.checked })} className="accent-accent-600" />
        {"Et les hésitations («\u00a0euh\u00a0», «\u00a0hum\u00a0»)"}
      </label>
      {manque ? (
        <p className="mb-2 text-[11px] text-neutral-500">Les hésitations demandent Whisper : {manque}.</p>
      ) : hesitations && apercu && !apercu.transcrit ? (
        <p className="mb-2 text-[11px] text-neutral-500">La voix sera d'abord transcrite par Whisper, sur le processeur.</p>
      ) : null}
      <p data-apercu-blancs className="mb-2 text-xs text-neutral-600">
        {erreur ? "" : !apercu ? "Mesure des blancs en cours." : apercu.retire < 100 ? "Aucun blanc assez long ici." : `${apercu.blancs} ${apercu.blancs > 1 ? "blancs" : "blanc"}${hesitations && apercu.transcrit ? " et hésitations" : ""} : ${virgule(apercu.retire / 1000)} s de moins.`}
      </p>
      <AvancementParole />
      {erreur && <p className="mb-2 text-xs text-red-600">{erreur}</p>}
      <button
        data-couper-blancs
        disabled={enCours || !!travail || !apercu || (apercu.retire < 100 && !(hesitations && !apercu.transcrit))}
        onClick={() => void couper()}
        className="h-8 w-full rounded-md bg-accent-600 text-sm font-medium text-white hover:bg-accent-700 disabled:bg-neutral-300"
      >
        {enCours ? "Coupe en cours" : "Couper"}
      </button>
      <p className="mt-2 text-[11px] text-neutral-500">Le clip devient des morceaux qui se suivent ; tire le bord d'un morceau pour rendre ce qui a été coupé. L'original n'est jamais touché.</p>
    </>
  );
}

export function BulleBlancs({ id }: { id: string }) {
  return (
    <Bulle titre="Couper les blancs et les hésitations" largeur={300} donneesBouton={{ "data-bulle-blancs": "" }} bouton={<><AudioLines size={16} /><span className="ml-1 text-sm">Blancs</span></>}>
      <ContenuBlancs id={id} />
    </Bulle>
  );
}
