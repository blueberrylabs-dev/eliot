// Les sous-titres automatiques, dans l'onglet Texte (étape 4, lot 7) : Whisper écoute les voix
// de la page (les vidéos qu'on entend, les sons au rôle Voix), puis les mots deviennent des
// sous-titres courts, posés sur une piste au-dessus de tout. Le mot prononcé est mis en valeur
// à la lecture et à l'export. Ensuite, des réglages pour tous les sous-titres à la fois ; un
// sous-titre se corrige comme un texte (double-clic).

import { Captions } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { dureesDe, pageCourante, useEditeur } from "../../etat/editeur";
import { creerLesSousTitres, useParole, whisperPret } from "../../etat/parole";
import { mesurerHauteurTexte } from "../../modele/fabriques";
import type { LangueParole } from "../../modele/parole";
import { ajusterSousTitres, centreParDefaut, estSousTitre, retirerSousTitres, sourcesDeParole, STYLES_SOUS_TITRES, type StyleSousTitres } from "../../modele/sousTitres";
import type { ElementTexte } from "../../modele/types";
import { assurerPolice, pilePolice } from "../../polices";
import { AvancementParole } from "../BulleBlancs";
import { Curseur } from "../ElementsBarre";

const CLE_STYLE = "eliot-sous-titres-style";

function lireStyle(): string {
  try {
    const v = localStorage.getItem(CLE_STYLE);
    return STYLES_SOUS_TITRES.some((s) => s.id === v) ? v! : STYLES_SOUS_TITRES[0].id;
  } catch {
    return STYLES_SOUS_TITRES[0].id;
  }
}

/** Un style de sous-titres, montré sur fond sombre, le mot prononcé mis en valeur. */
function CarteSousTitres({ style: s, choisi, surChoix }: { style: StyleSousTitres; choisi: boolean; surChoix: () => void }) {
  const effets = s.effets(20);
  const mots = s.maxMots === 1 ? ["Bonjour"] : ["Bonjour", "à", "tous"];
  return (
    <button
      data-style-sous-titres={s.id}
      onClick={surChoix}
      onPointerEnter={() => void assurerPolice(s.police, s.gras, false)}
      title={s.description}
      className={`flex h-16 flex-col items-center justify-center rounded-lg bg-neutral-800 px-1 ${choisi ? "ring-2 ring-accent-500" : "hover:ring-2 hover:ring-accent-300"}`}
    >
      <span
        className="max-w-full truncate px-1 text-[15px] leading-tight"
        style={{
          fontFamily: pilePolice(s.police),
          fontWeight: s.gras ? 700 : 400,
          color: s.couleur,
          textTransform: s.majuscules ? "uppercase" : undefined,
          background: effets.surlignage?.couleur,
          padding: effets.surlignage ? "0 4px" : undefined,
          borderRadius: effets.surlignage ? 3 : undefined,
          WebkitTextStroke: effets.contour ? `1px ${effets.contour.couleur}` : undefined,
        }}
      >
        {mots.map((m, i) => (
          <span key={i} style={i === 1 && s.actif ? { color: s.actif.couleur } : i === 2 && s.progressif ? { opacity: 0.25 } : undefined}>
            {i > 0 ? " " : ""}
            {m}
          </span>
        ))}
      </span>
      <span className="mt-0.5 text-[10px] text-neutral-300">{s.libelle}</span>
    </button>
  );
}

/** Les réglages communs à tous les sous-titres de la page. */
function ReglagesCommuns({ sousTitres }: { sousTitres: ElementTexte[] }) {
  const format = useEditeur((s) => s.document.format);
  const premier = sousTitres[0];
  const modifier = (changement: Parameters<typeof ajusterSousTitres>[2], etiquette: string) => {
    const etat = useEditeur.getState();
    etat.modifierElements(ajusterSousTitres(pageCourante(etat), etat.document.format, changement, mesurerHauteurTexte), etiquette);
  };
  const centre = (premier.y + premier.hauteur / 2) / format.hauteur;
  const actif = premier.sousTitre?.actif;
  return (
    <div data-reglages-sous-titres className="mb-3 rounded-lg border border-neutral-200 p-2.5">
      <p className="mb-2 text-xs text-neutral-600">
        {sousTitres.length} sous-titres sur la page. Pour corriger un mot : double-clic sur le sous-titre.
      </p>
      <div data-taille-sous-titres>
        <Curseur libelle="Taille" valeur={premier.taillePolice} min={16} max={Math.round(format.largeur / 5)} unite=" px" surChange={(x) => modifier({ taillePolice: Math.round(x) }, "sous-titres-taille")} />
      </div>
      <div data-hauteur-sous-titres>
        <Curseur libelle="Hauteur dans la page" valeur={Math.round(centre * 100)} min={8} max={92} unite=" %" surChange={(x) => modifier({ centre: x / 100 }, "sous-titres-hauteur")} />
      </div>
      <div className="mb-2 flex items-center gap-3">
        {actif && (
          <label className="flex items-center gap-1.5 text-xs text-neutral-700" title="La couleur du mot prononcé">
            <input data-couleur-mot type="color" value={actif.couleur} onChange={(e) => modifier({ couleurActif: e.target.value }, "sous-titres-couleur")} className="h-6 w-8 cursor-pointer rounded border border-neutral-300" />
            Mot prononcé
          </label>
        )}
        <label className="flex items-center gap-1.5 text-xs text-neutral-700">
          <input data-majuscules-sous-titres type="checkbox" checked={!!premier.majuscules} onChange={(e) => modifier({ majuscules: e.target.checked }, "sous-titres-capitales")} className="accent-accent-600" />
          En capitales
        </label>
      </div>
      <button
        data-retirer-sous-titres
        className="text-xs text-accent-700 hover:underline"
        onClick={() => {
          const etat = useEditeur.getState();
          etat.appliquerPage((p) => retirerSousTitres(p, dureesDe(etat.ressources)), "sous-titres-retirer");
        }}
      >
        Retirer les sous-titres
      </button>
    </div>
  );
}

export function SectionSousTitres() {
  const [style, setStyle] = useState(lireStyle);
  const [hesitations, setHesitations] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const whisper = useParole((s) => s.whisper);
  const langue = useParole((s) => s.langue);
  const travail = useParole((s) => s.travail);
  const sousTitres = useEditeur(useShallow((s) => pageCourante(s).elements.filter(estSousTitre)));
  const page = useEditeur((s) => pageCourante(s));
  const ressources = useEditeur((s) => s.ressources);
  const sources = useMemo(() => sourcesDeParole(page, ressources), [page, ressources]);
  const manque = whisperPret(whisper);

  useEffect(() => {
    if (!whisper) void useParole.getState().verifierWhisper();
  }, [whisper]);

  const creer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      const n = await creerLesSousTitres({ style, centre: sousTitres.length ? (sousTitres[0].y + sousTitres[0].hauteur / 2) / useEditeur.getState().document.format.hauteur : centreParDefaut(useEditeur.getState().document.format), hesitations });
      useEditeur.getState().notifier(`${n} sous-titres posés. Ctrl+Z pour revenir.`);
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div data-section-sous-titres className="mb-5">
      <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-neutral-800">
        <Captions size={16} /> Sous-titres automatiques
      </p>
      <p className="mb-2 text-xs text-neutral-500">Whisper écoute les voix de la page (vidéos qu'on entend, sons au rôle Voix), sur le processeur, et les écrit mot par mot.</p>
      {manque ? (
        <p data-whisper-manque className="mb-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
          {manque.charAt(0).toUpperCase() + manque.slice(1)}.{whisper?.dossier && !whisper.modele ? ` Dossier du modèle : ${whisper.dossier}` : ""}
        </p>
      ) : (
        <p className="mb-2 text-[11px] text-neutral-500">Modèle : {whisper?.modele}</p>
      )}
      <div className="mb-2 grid grid-cols-2 gap-1.5">
        {STYLES_SOUS_TITRES.map((s) => (
          <CarteSousTitres
            key={s.id}
            style={s}
            choisi={s.id === style}
            surChoix={() => {
              setStyle(s.id);
              try {
                localStorage.setItem(CLE_STYLE, s.id);
              } catch {
                // Le choix vaut le temps de la session.
              }
            }}
          />
        ))}
      </div>
      <div className="mb-2 flex items-center gap-2">
        <select data-langue-parole value={langue} onChange={(e) => useParole.getState().definirLangue(e.target.value as LangueParole)} title="La langue de la voix" className="h-8 rounded-md border border-neutral-300 bg-white px-1.5 text-xs">
          <option value="fr">Français</option>
          <option value="en">Anglais</option>
          <option value="auto">Reconnue par Whisper</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-neutral-700" title={"Écrire aussi les «\u00a0euh\u00a0» et les «\u00a0hum\u00a0»"}>
          <input data-garder-hesitations type="checkbox" checked={hesitations} onChange={(e) => setHesitations(e.target.checked)} className="accent-accent-600" />
          {"Garder les «\u00a0euh\u00a0»"}
        </label>
      </div>
      <AvancementParole />
      {erreur && <p className="mb-2 text-xs text-red-600">{erreur}</p>}
      <button
        data-creer-sous-titres
        disabled={enCours || !!travail || !!manque || sources.length === 0}
        onClick={() => void creer()}
        className="mb-2 h-9 w-full rounded-lg bg-accent-600 text-sm font-medium text-white hover:bg-accent-700 disabled:bg-neutral-300"
      >
        {enCours ? "Sous-titres en cours" : sousTitres.length ? "Refaire les sous-titres" : "Créer les sous-titres"}
      </button>
      {sources.length === 0 && <p className="mb-2 text-[11px] text-neutral-500">Aucune voix sur cette page : ajoute une vidéo qu'on entend, enregistre ta voix, ou mets un son au rôle Voix.</p>}
      {sousTitres.length > 0 && <ReglagesCommuns sousTitres={sousTitres} />}
    </div>
  );
}
