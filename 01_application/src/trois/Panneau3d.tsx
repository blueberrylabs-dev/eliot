// Le panneau « 3D » d'un objet (étape 6, lot 1), à la place du panneau de gauche comme le labo
// d'une photo : tourner l'objet sur la page, les vues prêtes, la caméra réglage par réglage
// (azimut, élévation, zoom, focale), recentrer, et ce que l'on sait du modèle. Un geste sur un
// curseur fait une seule étape d'annulation.

import { Box, Check, Move3d, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { etiquetteDeGeste, useEditeur } from "../etat/editeur";
import { useUrlRessource } from "../editeur/images";
import { CAMERA_PAR_DEFAUT, ELEVATION_MAX, FOCALE_MAX, FOCALE_MIN, normaliserCamera, VUES_PRETES, ZOOM_MAX, ZOOM_MIN } from "../modele/objet3d";
import type { Camera3d, ElementObjet3d, Ressource } from "../modele/types";
import { abonnerModele, modeleCharge } from "./moteur";
import { appliquerVue, commencerOrbite, finirOrbite, objet3d, poserCamera, useOrbite, usePanneau3d } from "./orbite";

const CURSEUR =
  "w-full cursor-pointer appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-neutral-400 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-neutral-400 [&::-moz-range-thumb]:bg-white";
const PISTE: CSSProperties = { background: "#e5e7eb", borderRadius: 999, height: 6 };

type CleCamera = "azimut" | "elevation" | "zoom" | "focale";

interface DefinitionReglage {
  cle: CleCamera;
  libelle: string;
  /** Les bornes et le pas de la piste (le zoom s'y lit en logarithme). */
  min: number;
  max: number;
  pas: number;
  versPiste: (v: number) => number;
  depuisPiste: (p: number) => number;
  texte: (v: number) => string;
  lire: (t: string) => number | undefined;
  /** La valeur d'un double-clic sur le libellé. */
  defaut: number;
}

const nombreLu = (t: string) => {
  const v = Number(t.replace(",", ".").replace(/[^\d.+-]/g, ""));
  return Number.isFinite(v) ? v : undefined;
};
const identite = (v: number) => v;

const REGLAGES: DefinitionReglage[] = [
  { cle: "azimut", libelle: "Rotation", min: -180, max: 180, pas: 1, versPiste: identite, depuisPiste: identite, texte: (v) => `${Math.round(v)}°`, lire: nombreLu, defaut: CAMERA_PAR_DEFAUT.azimut },
  { cle: "elevation", libelle: "Hauteur de vue", min: -ELEVATION_MAX, max: ELEVATION_MAX, pas: 1, versPiste: identite, depuisPiste: identite, texte: (v) => `${Math.round(v)}°`, lire: nombreLu, defaut: CAMERA_PAR_DEFAUT.elevation },
  {
    cle: "zoom",
    libelle: "Zoom",
    min: Math.log(ZOOM_MIN),
    max: Math.log(ZOOM_MAX),
    pas: 0.01,
    versPiste: Math.log,
    depuisPiste: Math.exp,
    texte: (v) => `${Math.round(v * 100)} %`,
    lire: (t) => {
      const v = nombreLu(t);
      return v === undefined ? undefined : v / 100;
    },
    defaut: 1,
  },
  { cle: "focale", libelle: "Focale", min: FOCALE_MIN, max: FOCALE_MAX, pas: 1, versPiste: identite, depuisPiste: identite, texte: (v) => `${Math.round(v)} mm`, lire: nombreLu, defaut: CAMERA_PAR_DEFAUT.focale },
];

function Reglage({ def, valeur, changer, debut, fin }: { def: DefinitionReglage; valeur: number; changer: (v: number) => void; debut: () => void; fin: () => void }) {
  const [saisie, setSaisie] = useState<string | null>(null);
  const valider = () => {
    if (saisie !== null) {
      const v = def.lire(saisie);
      if (v !== undefined) changer(v);
    }
    setSaisie(null);
  };
  return (
    <div className="mb-2.5" data-reglage-3d={def.cle}>
      <div className="mb-0.5 flex items-center justify-between text-xs">
        <span className="cursor-default text-neutral-700 select-none" onDoubleClick={() => changer(def.defaut)} title="Double-clic : valeur de départ">
          {def.libelle}
        </span>
        <input
          aria-label={`${def.libelle}, valeur`}
          value={saisie ?? def.texte(valeur)}
          onFocus={(e) => {
            setSaisie(String(def.cle === "zoom" ? Math.round(valeur * 100) : Math.round(valeur)));
            requestAnimationFrame(() => e.target.select());
          }}
          onChange={(e) => setSaisie(e.target.value)}
          onBlur={valider}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setSaisie(null);
              (e.target as HTMLInputElement).blur();
            }
            e.stopPropagation();
          }}
          className="w-[4.5rem] rounded border border-transparent px-1 text-right text-neutral-600 tabular-nums hover:border-neutral-300 focus:border-accent-500 focus:outline-none"
        />
      </div>
      <input
        type="range"
        aria-label={def.libelle}
        min={def.min}
        max={def.max}
        step={def.pas}
        value={def.versPiste(valeur)}
        onPointerDown={debut}
        onPointerUp={fin}
        onPointerCancel={fin}
        onChange={(e) => changer(def.depuisPiste(Number(e.target.value)))}
        onDoubleClick={() => changer(def.defaut)}
        onKeyDown={(e) => e.stopPropagation()}
        style={PISTE}
        className={CURSEUR}
      />
    </div>
  );
}

const FORMATS: Record<string, string> = { glb: "glTF (GLB)", fbx: "FBX", obj: "OBJ" };

function Modele({ ressource }: { ressource: Ressource }) {
  const infos = ressource.modele3d;
  const url = useUrlRessource(ressource.id, "miniature");
  const [, rafraichir] = useState(0);
  useEffect(() => abonnerModele(ressource.id, () => rafraichir((v) => v + 1)), [ressource.id]);
  if (!infos) return null;
  // Ce que le noyau a lu (un GLB), complété par le modèle chargé (un FBX, un OBJ).
  const charge = modeleCharge(ressource.id);
  const m = {
    format: infos.format,
    triangles: infos.triangles || charge?.triangles || 0,
    matieres: Math.max(infos.matieres.length, charge?.matieres.length ?? 0),
    animations: Math.max(infos.animations.length, charge?.animations.length ?? 0),
  };
  const nombre = (n: number) => n.toLocaleString("fr-FR");
  return (
    <section className="border-t border-neutral-200 py-2" data-modele-3d>
      <p className="py-1 text-sm font-semibold text-neutral-800">Modèle</p>
      <div className="flex gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-neutral-200 bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:12px_12px]">
          {url && infos.miniature ? <img src={url} alt="" className="h-full w-full object-contain" draggable={false} /> : <Box size={22} className="m-[19px] text-neutral-400" />}
        </div>
        <dl className="min-w-0 flex-1 text-xs text-neutral-600">
          <dt className="sr-only">Nom</dt>
          <dd className="truncate font-medium text-neutral-800" title={ressource.nom}>
            {ressource.nom}
          </dd>
          <dd data-format-3d={m.format}>{FORMATS[m.format] ?? m.format}</dd>
          {m.triangles > 0 && <dd data-triangles>{nombre(m.triangles)} triangles</dd>}
          {(m.matieres > 0 || m.animations > 0) && (
            <dd>
              {m.matieres > 0 ? `${nombre(m.matieres)} matière${m.matieres > 1 ? "s" : ""}` : ""}
              {m.matieres > 0 && m.animations > 0 ? ", " : ""}
              {m.animations > 0 ? `${nombre(m.animations)} animation${m.animations > 1 ? "s" : ""}` : ""}
            </dd>
          )}
        </dl>
      </div>
      {infos.texturesReduites > 0 && <p className="mt-2 text-[11px] text-neutral-500">Les textures de plus de 2048 px sont ramenées à 2048 px pour l'affichage ; l'original reste dans le dossier du design.</p>}
    </section>
  );
}

const egal = (a: number, b: number) => Math.abs(a - b) < 0.5;

export function Panneau3d({ el }: { el: ElementObjet3d }) {
  const ressource = useEditeur((s) => s.ressources[el.ressource]);
  const enOrbite = useOrbite((s) => s.id === el.id);
  const geste = useOrbite((s) => (s.id === el.id ? s.geste : null));
  const camera = geste ?? el.camera;
  const marque = useRef("");
  const debut = () => {
    marque.current = etiquetteDeGeste("");
  };
  const fin = () => {
    marque.current = "";
  };
  // Un curseur relâché hors de sa piste finit quand même le geste.
  useEffect(() => {
    window.addEventListener("pointerup", fin);
    return () => window.removeEventListener("pointerup", fin);
  }, []);
  const changer = (cle: CleCamera, v: number) => {
    // Le dernier état du document : plusieurs changements peuvent arriver dans la même image.
    const c: Camera3d = { ...(objet3d(el.id)?.camera ?? el.camera), [cle]: v };
    poserCamera(el.id, c, `camera-3d:${el.id}:${cle}${marque.current}`);
  };
  const recentree = !el.camera.decalage && el.camera.zoom === 1;
  return (
    <div data-panneau-3d>
      <div className="mb-3 flex items-center gap-2">
        <button title="Fermer le panneau 3D" onClick={() => usePanneau3d.setState({ ouvert: null })} className="rounded-md p-1 text-neutral-600 hover:bg-neutral-100">
          <X size={18} />
        </button>
        <h2 className="flex-1 text-sm font-semibold text-neutral-900">Objet 3D</h2>
        <button
          data-vue-depart-3d
          title="Revenir à la vue de départ"
          disabled={el.verrouille || JSON.stringify(normaliserCamera(CAMERA_PAR_DEFAUT)) === JSON.stringify(el.camera)}
          onClick={() => poserCamera(el.id, CAMERA_PAR_DEFAUT, `vue-depart-3d:${el.id}`)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
        >
          <RotateCcw size={14} /> Départ
        </button>
      </div>
      <button
        data-tourner-panneau
        disabled={el.verrouille}
        onClick={() => (enOrbite ? finirOrbite() : commencerOrbite(el.id))}
        className={`flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium disabled:opacity-40 ${enOrbite ? "bg-accent-600 text-white hover:bg-accent-700" : "border border-neutral-300 text-neutral-800 hover:bg-neutral-50"}`}
      >
        {enOrbite ? <Check size={16} /> : <Move3d size={16} />} {enOrbite ? "Terminer (Entrée)" : "Tourner sur la page"}
      </button>
      <p className="mt-1.5 mb-2 text-[11px] text-neutral-500">
        Sur la page, ou après un double-clic sur l'objet : glisser le tourne, Maj et glisser le décale, la molette le rapproche, les flèches le tournent pas à pas. Entrée finit, Échap revient à la vue d'avant.
      </p>
      <section className="border-t border-neutral-200 py-2" data-section="Vue">
        <p className="py-1 text-sm font-semibold text-neutral-800">Vue</p>
        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {VUES_PRETES.map((v) => {
            const active = egal(camera.azimut, v.azimut) && egal(camera.elevation, v.elevation);
            return (
              <button
                key={v.id}
                data-vue-3d={v.id}
                disabled={el.verrouille}
                onClick={() => appliquerVue(el.id, v.id)}
                className={`rounded-md border px-1 py-1.5 text-xs disabled:opacity-40 ${active ? "border-accent-500 bg-accent-50 font-medium text-accent-700" : "border-neutral-200 text-neutral-700 hover:border-neutral-400"}`}
              >
                {v.nom}
              </button>
            );
          })}
        </div>
        <fieldset disabled={el.verrouille} className="disabled:opacity-40">
          {REGLAGES.map((d) => (
            <Reglage key={d.cle} def={d} valeur={camera[d.cle]} changer={(v) => changer(d.cle, v)} debut={debut} fin={fin} />
          ))}
        </fieldset>
        <button
          data-recentrer-3d
          disabled={el.verrouille || recentree}
          onClick={() => {
            const c: Camera3d = { ...el.camera, zoom: 1 };
            delete c.decalage;
            poserCamera(el.id, c, `recentrer-3d:${el.id}`);
          }}
          className="text-xs text-accent-700 hover:underline disabled:text-neutral-400 disabled:no-underline"
        >
          Recentrer (zoom 100 %, sans décalage)
        </button>
      </section>
      {ressource && <Modele key={`${ressource.id}-${ressource.modele3d?.miniature ? 1 : 0}`} ressource={ressource} />}
    </div>
  );
}
