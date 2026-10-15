// La voix dans l'onglet Audio (étape 4, lot 6) : enregistrer au micro, prise par prise, et la
// voix de synthèse de Piper. Le micro s'ouvre à la demande et se ferme quand on quitte
// l'onglet ; le noyau l'écoute, la fenêtre n'y touche jamais.

import { Circle, Mic, MicOff, Pause, Play, Plus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useEditeur } from "../../etat/editeur";
import { COMPTE_A_REBOURS, usePrise } from "../../etat/prise";
import { useTemps } from "../../etat/temps";
import { ajouterVoixDite, etatPiper, urlVoixDite, voixDisponible, type EtatPiper } from "../../pont/tauri";
import { useEcoute } from "../ecoute";
import { useSuiviImport } from "../SuiviImport";
import { dureeLisible } from "../videos";

/** Le niveau du micro : la crête (barre claire) et la moyenne (barre pleine), de −60 à 0 dBFS. */
export function NiveauMicro() {
  const niveau = usePrise((s) => s.niveau);
  const creteMax = usePrise((s) => s.creteMax);
  const phase = usePrise((s) => s.phase);
  const part = (db: number) => `${Math.max(0, Math.min(100, ((db + 60) / 60) * 100))}%`;
  const crete = niveau?.crete ?? -90;
  const couleur = crete >= -3 ? "bg-red-500" : crete >= -12 ? "bg-amber-400" : "bg-emerald-500";
  const conseil =
    !niveau || crete < -45 ? "Parle : la barre doit monter." : niveau.ecretage || crete >= -1 ? "Trop fort : éloigne-toi un peu du micro." : crete < -24 ? "Un peu faible : rapproche-toi du micro." : "Bon niveau.";
  return (
    <div className="mb-2">
      <div data-niveau-micro={Math.round(crete)} className="relative h-3 overflow-hidden rounded-full bg-neutral-200" title={`Crête ${crete.toFixed(0)} dBFS`}>
        <div className={`absolute inset-y-0 left-0 opacity-40 ${couleur}`} style={{ width: part(crete) }} />
        <div className={`absolute inset-y-0 left-0 ${couleur}`} style={{ width: part(niveau?.rms ?? -90) }} />
        {/* Les repères : −12 dB (fin du vert) et −3 dB (début du rouge). */}
        <div className="absolute inset-y-0 w-px bg-white/80" style={{ left: part(-12) }} />
        <div className="absolute inset-y-0 w-px bg-white/80" style={{ left: part(-3) }} />
      </div>
      <p className="mt-1 text-[11px] text-neutral-500">
        {conseil}
        {phase === "enregistre" && creteMax >= -1 ? " La prise a saturé par moments." : ""}
      </p>
    </div>
  );
}

function PriseMicro() {
  const phase = usePrise((s) => s.phase);
  const micros = usePrise((s) => s.micros);
  const source = usePrise((s) => s.source);
  const erreur = usePrise((s) => s.erreur);
  const compte = usePrise((s) => s.compte);
  const muet = usePrise((s) => s.muet);
  const voixNette = usePrise((s) => s.voixNette);
  const depuis = usePrise((s) => s.niveau?.prise ?? 0);
  const tete = useTemps((s) => Math.round(s.tete / 100) * 100);
  const prise = usePrise.getState();

  // Le micro se ferme quand on quitte l'onglet Audio ou le design.
  useEffect(() => () => usePrise.getState().fermer(), []);

  if (phase === "ferme" || phase === "ouverture") {
    return (
      <div className="mb-4">
        <button
          data-ouvrir-micro
          disabled={phase === "ouverture"}
          onClick={() => void prise.ouvrir()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 py-2 text-sm font-medium text-neutral-800 hover:border-accent-500 hover:bg-accent-50 disabled:opacity-60"
        >
          <Mic size={16} /> {phase === "ouverture" ? "Ouverture du micro" : "Enregistrer au micro"}
        </button>
        {erreur && <p className="mt-1 text-[11px] text-red-600">{erreur}</p>}
      </div>
    );
  }

  const enCours = phase === "compte" || phase === "enregistre";
  return (
    <div data-prise={phase} className="mb-4 rounded-lg border border-neutral-200 p-2.5">
      <div className="mb-2 flex items-center gap-1.5">
        <Mic size={14} className="shrink-0 text-neutral-500" />
        <select
          data-choix-micro
          title="Le micro"
          disabled={enCours || phase === "rangement"}
          value={source}
          onChange={(e) => void prise.choisirMicro(e.target.value)}
          className="h-7 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-1 text-xs"
        >
          {micros.map((m) => (
            <option key={m.nom} value={m.nom}>
              {m.description}
            </option>
          ))}
        </select>
        <button title="Fermer le micro" disabled={enCours} onClick={() => prise.fermer()} className="shrink-0 rounded p-1 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40">
          <MicOff size={14} />
        </button>
      </div>
      <NiveauMicro />
      <label className="mb-1 flex items-start gap-1.5 text-xs text-neutral-700">
        <input data-option-muet type="checkbox" checked={muet} disabled={enCours} onChange={(e) => prise.definirMuet(e.target.checked)} className="mt-0.5 accent-accent-600" />
        <span>Couper le son du montage pendant la prise (sans casque, le micro l'entendrait)</span>
      </label>
      <label className="mb-2 flex items-start gap-1.5 text-xs text-neutral-700">
        <input data-option-voix-nette type="checkbox" checked={voixNette} disabled={enCours} onChange={(e) => prise.definirVoixNette(e.target.checked)} className="mt-0.5 accent-accent-600" />
        <span>Voix nette sur chaque prise (bruit réduit, niveau calé ; l'original est gardé)</span>
      </label>
      {phase === "pret" && (
        <button data-enregistrer onClick={() => void prise.enregistrer()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700">
          <Circle size={14} fill="currentColor" /> Enregistrer
        </button>
      )}
      {phase === "compte" && (
        <button data-annuler-prise onClick={() => prise.abandonner()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-800 py-2.5 text-sm font-medium text-white">
          <span data-compte className="text-lg font-bold tabular-nums">
            {compte}
          </span>
          Annuler (Échap)
        </button>
      )}
      {phase === "enregistre" && (
        <button data-arreter-prise onClick={() => void prise.arreter()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700">
          <Square size={14} fill="currentColor" /> Arrêter (Espace) <span className="tabular-nums">{dureeLisible(depuis)}</span>
        </button>
      )}
      {phase === "rangement" && <p className="py-2.5 text-center text-sm text-neutral-600">Rangement de la prise</p>}
      <p className="mt-1.5 text-[11px] text-neutral-500">
        {phase === "pret"
          ? `La prise commence à la tête de lecture (${dureeLisible(tete)}) après un compte à rebours de ${COMPTE_A_REBOURS} secondes, et se pose au rôle Voix : la musique baisse dessous.`
          : phase === "compte"
            ? "Prépare-toi : la tête de lecture partira à zéro."
            : phase === "enregistre"
              ? "Parle en suivant la vidéo. Échap abandonne la prise."
              : ""}
      </p>
      {erreur && <p className="mt-1 text-[11px] text-red-600">{erreur}</p>}
    </div>
  );
}

const CLE_SYNTHESE = "eliot-synthese";

function VoixDeSynthese() {
  const projet = useEditeur((s) => s.projet);
  const [etat, setEtat] = useState<EtatPiper | null | undefined>(undefined);
  const garde = (() => {
    try {
      return JSON.parse(localStorage.getItem(CLE_SYNTHESE) ?? "{}") as { voix?: string; vitesse?: number };
    } catch {
      return {};
    }
  })();
  const [texte, setTexte] = useState("");
  const [voix, setVoix] = useState<string>(garde.voix ?? "");
  const [vitesse, setVitesse] = useState<number>(garde.vitesse ?? 1);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const cleEcoute = `piper-${voix}-${vitesse}-${texte}`;
  const ecoute = useEcoute((s) => s.enCours === cleEcoute);

  useEffect(() => {
    let actif = true;
    etatPiper().then(
      (e) => actif && setEtat(e),
      (e: unknown) => {
        if (!actif) return;
        setEtat(null);
        setErreur(String(e));
      },
    );
    return () => {
      actif = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CLE_SYNTHESE, JSON.stringify({ voix, vitesse }));
    } catch {
      // Stockage indisponible : le choix vaut le temps de la session.
    }
  }, [voix, vitesse]);

  if (etat === undefined) return <p className="text-xs text-neutral-500">Recherche de Piper</p>;
  if (etat === null) return <p className="text-xs text-neutral-500">La voix de synthèse ne s'ouvre que dans la fenêtre Eliot.</p>;
  if (!etat.installe) return <p data-piper-absent className="text-xs text-neutral-500">Piper n'est pas installé sur ce poste : une commande à taper une fois (la 16 du CLAUDE.md), puis relancer Eliot.</p>;
  if (etat.voix.length === 0)
    return (
      <p data-piper-sans-voix className="text-xs break-words text-neutral-500">
        Aucune voix trouvée : télécharge-en une (commande 17 du CLAUDE.md) dans {etat.dossier}, puis rouvre l'onglet.
      </p>
    );

  const choisie = etat.voix.find((v) => v.id === voix) ?? etat.voix[0];
  const propre = texte.trim();
  const ajouter = async () => {
    if (!projet || !propre) return;
    setOccupe(true);
    setErreur(null);
    const suivi = useSuiviImport.getState();
    try {
      suivi.montrer("Préparation de la voix", 0.3);
      const r = await ajouterVoixDite(projet, choisie.id, propre, vitesse);
      if (useEditeur.getState().projet !== projet) return;
      useEditeur.getState().ajouterRessources([r]);
      useEditeur.getState().ajouterSon(r, { role: "voix" });
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    } finally {
      suivi.finir();
      setOccupe(false);
    }
  };

  return (
    <div data-synthese>
      <textarea
        data-texte-voix
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        placeholder="Le texte à dire"
        rows={3}
        maxLength={3000}
        className="mb-2 w-full resize-y rounded-md border border-neutral-300 p-2 text-sm"
      />
      <div className="mb-2 flex items-center gap-1.5">
        <select data-voix-piper title="La voix" value={choisie.id} onChange={(e) => setVoix(e.target.value)} className="h-8 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-1 text-xs">
          {etat.voix.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nom} ({v.langue.replace("_", "-")}
              {v.licence ? `, ${v.licence}` : ""})
            </option>
          ))}
        </select>
      </div>
      <label className="mb-2 block text-xs text-neutral-600">
        <span className="mb-1 flex justify-between">
          Vitesse
          <span className="tabular-nums">× {vitesse.toFixed(2).replace(".", ",")}</span>
        </span>
        <input data-vitesse-voix type="range" min={0.7} max={1.5} step={0.05} value={vitesse} onChange={(e) => setVitesse(Number(e.target.value))} className="w-full accent-accent-600" />
      </label>
      <div className="flex gap-1.5">
        <button
          data-ecouter-voix
          disabled={!propre}
          onClick={() => useEcoute.getState().basculer(cleEcoute, () => urlVoixDite(choisie.id, propre, vitesse))}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-300 py-2 text-sm text-neutral-800 hover:border-accent-500 hover:bg-accent-50 disabled:opacity-50"
        >
          {ecoute ? <Pause size={14} /> : <Play size={14} />} {ecoute ? "Arrêter" : "Écouter"}
        </button>
        <button data-ajouter-voix disabled={!propre || occupe} onClick={() => void ajouter()} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent-600 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50">
          <Plus size={14} /> {occupe ? "Préparation" : "Ajouter"}
        </button>
      </div>
      {erreur && (
        <p className="mt-1 flex items-start gap-1 text-[11px] text-red-600">
          <X size={12} className="mt-0.5 shrink-0" /> {erreur}
        </p>
      )}
      <p className="mt-2 text-[11px] text-neutral-500">
        Voix de Piper, sur le processeur. Ses auteurs la destinent à un usage personnel ; la licence de la voix choisie part dans les crédits des sons.
        {choisie.licence?.includes("SA") ? " Cette voix est sous licence « partage à l'identique »." : ""}
      </p>
    </div>
  );
}

export function SectionVoix() {
  if (!voixDisponible()) {
    return <p className="mb-4 text-xs text-neutral-500">La voix (micro et synthèse) ne s'ouvre que dans la fenêtre Eliot.</p>;
  }
  return (
    <div data-section-voix>
      <p className="mb-2 text-sm font-semibold text-neutral-800">Ta voix</p>
      <PriseMicro />
      <p className="mb-2 text-sm font-semibold text-neutral-800">Voix de synthèse</p>
      <VoixDeSynthese />
    </div>
  );
}
