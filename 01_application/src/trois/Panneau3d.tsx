// Le panneau « 3D » d'un objet (étape 6), à la place du panneau de gauche comme le labo d'une
// photo : tourner l'objet sur la page, les vues prêtes, la caméra réglage par réglage (lot 1) ;
// la lumière (environnement, lumière principale, exposition), l'ombre au sol et les matières
// repeintes (lot 2) ; ce que l'on sait du modèle. Un geste sur un curseur fait une seule étape
// d'annulation, et l'objet suit en direct (la toile du moteur, règle 11).

import { Box, Check, Move3d, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { etiquetteDeGeste, useEditeur } from "../etat/editeur";
import { useUrlRessource } from "../editeur/images";
import { SelecteurCouleur } from "../editeur/SelecteurCouleur";
import {
  CAMERA_PAR_DEFAUT,
  ELEVATION_MAX,
  ENVIRONNEMENTS,
  EXPOSITION_MAX,
  FOCALE_MAX,
  FOCALE_MIN,
  INTENSITE_MAX,
  LUMIERE_PAR_DEFAUT,
  LUMIERES_PRETES,
  lumiereDe,
  lumierePrete,
  normaliserCamera,
  OMBRE_SOL_PAR_DEFAUT,
  VUES_PRETES,
  ZOOM_MAX,
  ZOOM_MIN,
} from "../modele/objet3d";
import type { Camera3d, ElementObjet3d, Lumiere3d, Ressource } from "../modele/types";
import { abonnerModele, modeleCharge, type InfosMatiere } from "./moteur";
import { appliquerVue, commencerOrbite, finirOrbite, objet3d, poserCamera, poserLumiere, poserMatiere, poserOmbreSol, useOrbite, usePanneau3d } from "./orbite";

const CURSEUR =
  "w-full cursor-pointer appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-neutral-400 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-neutral-400 [&::-moz-range-thumb]:bg-white";
const PISTE: CSSProperties = { background: "#e5e7eb", borderRadius: 999, height: 6 };

/** Un curseur du panneau : sa piste (le zoom s'y lit en logarithme), sa valeur affichée et
 *  tapée au clavier, la valeur d'un double-clic. */
interface DefinitionReglage {
  nom: string;
  libelle: string;
  min: number;
  max: number;
  pas: number;
  versPiste?: (v: number) => number;
  depuisPiste?: (p: number) => number;
  texte: (v: number) => string;
  /** Le nombre tapé, vers la valeur. */
  lire?: (n: number) => number;
  /** La valeur, vers le nombre à taper. */
  saisie?: (v: number) => string;
  defaut: number;
}

const nombreLu = (t: string) => {
  const v = Number(t.replace(",", ".").replace(/[^\d.+-]/g, ""));
  return Number.isFinite(v) && t.trim() !== "" ? v : undefined;
};
const degres = (v: number) => `${Math.round(v)}°`;
const pourcents = (v: number) => `${Math.round(v * 100)} %`;
const enPourcents = { texte: pourcents, lire: (n: number) => n / 100, saisie: (v: number) => String(Math.round(v * 100)) };

const CAMERA: (DefinitionReglage & { cle: "azimut" | "elevation" | "zoom" | "focale" })[] = [
  { cle: "azimut", nom: "azimut", libelle: "Rotation", min: -180, max: 180, pas: 1, texte: degres, defaut: CAMERA_PAR_DEFAUT.azimut },
  { cle: "elevation", nom: "elevation", libelle: "Hauteur de vue", min: -ELEVATION_MAX, max: ELEVATION_MAX, pas: 1, texte: degres, defaut: CAMERA_PAR_DEFAUT.elevation },
  { cle: "zoom", nom: "zoom", libelle: "Zoom", min: Math.log(ZOOM_MIN), max: Math.log(ZOOM_MAX), pas: 0.01, versPiste: Math.log, depuisPiste: Math.exp, ...enPourcents, defaut: 1 },
  { cle: "focale", nom: "focale", libelle: "Focale", min: FOCALE_MIN, max: FOCALE_MAX, pas: 1, texte: (v) => `${Math.round(v)} mm`, defaut: CAMERA_PAR_DEFAUT.focale },
];

const D = LUMIERE_PAR_DEFAUT;
const LUMIERE = {
  intensiteEnvironnement: { nom: "env-intensite", libelle: "Force", min: 0, max: INTENSITE_MAX, pas: 0.01, ...enPourcents, defaut: D.environnement.intensite },
  rotationEnvironnement: { nom: "env-rotation", libelle: "Rotation", min: -180, max: 180, pas: 1, texte: degres, defaut: D.environnement.rotation },
  azimut: { nom: "lumiere-azimut", libelle: "Direction", min: -180, max: 180, pas: 1, texte: degres, defaut: D.principale.azimut },
  elevation: { nom: "lumiere-elevation", libelle: "Hauteur", min: -ELEVATION_MAX, max: ELEVATION_MAX, pas: 1, texte: degres, defaut: D.principale.elevation },
  intensite: { nom: "lumiere-intensite", libelle: "Force", min: 0, max: INTENSITE_MAX, pas: 0.01, ...enPourcents, defaut: D.principale.intensite },
  exposition: {
    nom: "exposition",
    libelle: "Exposition",
    min: -EXPOSITION_MAX,
    max: EXPOSITION_MAX,
    pas: 0.05,
    texte: (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2).replace(".", ",")} IL`,
    saisie: (v: number) => String(v).replace(".", ","),
    defaut: 0,
  },
} satisfies Record<string, DefinitionReglage>;

const OMBRE = {
  opacite: { nom: "ombre-opacite", libelle: "Opacité", min: 0, max: 1, pas: 0.01, ...enPourcents, defaut: OMBRE_SOL_PAR_DEFAUT.opacite },
  douceur: { nom: "ombre-douceur", libelle: "Douceur", min: 0, max: 1, pas: 0.01, ...enPourcents, defaut: OMBRE_SOL_PAR_DEFAUT.douceur },
} satisfies Record<string, DefinitionReglage>;

const BRILLANCE: Omit<DefinitionReglage, "defaut"> = { nom: "brillance", libelle: "Brillance", min: 0, max: 100, pas: 1, texte: (v) => `${Math.round(v)}` };

function Reglage({ def, valeur, changer, debut, fin }: { def: DefinitionReglage; valeur: number; changer: (v: number) => void; debut: () => void; fin: () => void }) {
  const [saisie, setSaisie] = useState<string | null>(null);
  const valider = () => {
    if (saisie !== null) {
      const n = nombreLu(saisie);
      if (n !== undefined) changer(def.lire ? def.lire(n) : n);
    }
    setSaisie(null);
  };
  return (
    <div className="mb-2.5" data-reglage-3d={def.nom}>
      <div className="mb-0.5 flex items-center justify-between text-xs">
        <span className="cursor-default text-neutral-700 select-none" onDoubleClick={() => changer(def.defaut)} title="Double-clic : valeur de départ">
          {def.libelle}
        </span>
        <input
          aria-label={`${def.libelle}, valeur`}
          value={saisie ?? def.texte(valeur)}
          onFocus={(e) => {
            setSaisie(def.saisie ? def.saisie(valeur) : String(Math.round(valeur)));
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
        value={def.versPiste ? def.versPiste(valeur) : valeur}
        onPointerDown={debut}
        onPointerUp={fin}
        onPointerCancel={fin}
        onChange={(e) => changer(def.depuisPiste ? def.depuisPiste(Number(e.target.value)) : Number(e.target.value))}
        onDoubleClick={() => changer(def.defaut)}
        onKeyDown={(e) => e.stopPropagation()}
        style={PISTE}
        className={CURSEUR}
      />
    </div>
  );
}

function Section({ titre, children, droite }: { titre: string; children: ReactNode; droite?: ReactNode }) {
  return (
    <section className="border-t border-neutral-200 py-2" data-section={titre}>
      <div className="flex items-center py-1">
        <p className="flex-1 text-sm font-semibold text-neutral-800">{titre}</p>
        {droite}
      </div>
      {children}
    </section>
  );
}

const PETIT_BOUTON = "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-40";

/** L'aperçu d'un environnement fourni, en dégradé. */
const APERCUS: Record<string, string> = {
  studio: "linear-gradient(180deg, #fafafa, #d9d9d9 60%, #bdbdbd)",
  boites: "linear-gradient(90deg, #111 10%, #f5f5f5 14%, #f5f5f5 30%, #111 34%, #111 70%, #e5e5e5 73%, #e5e5e5 86%, #111 89%)",
  "plein-air": "radial-gradient(circle at 30% 30%, #fffbe8 0 8%, transparent 9%), linear-gradient(180deg, #2f6fd8, #bcd6f7 70%, #8a7f6e 71%)",
  couchant: "radial-gradient(circle at 25% 72%, #ffd08a 0 7%, transparent 8%), linear-gradient(180deg, #2a2457, #e2724a 70%, #2b1c17 71%)",
};

function Lumiere({ el, debut, fin, marque }: { el: ElementObjet3d; debut: () => void; fin: () => void; marque: () => string }) {
  const l = lumiereDe(el.lumiere);
  const changer = (f: (l: Lumiere3d) => Lumiere3d, nom: string) => poserLumiere(el.id, f, `lumiere-3d:${el.id}:${nom}${marque()}`);
  const pretActif = LUMIERES_PRETES.find((p) => p.azimut === l.principale.azimut && p.elevation === l.principale.elevation)?.id;
  return (
    <Section
      titre="Lumière"
      droite={
        <button data-lumiere-depart title="Revenir à la lumière de départ" disabled={!el.lumiere || el.verrouille} onClick={() => poserLumiere(el.id, () => LUMIERE_PAR_DEFAUT, `lumiere-3d-depart:${el.id}`)} className={PETIT_BOUTON}>
          <RotateCcw size={13} /> Départ
        </button>
      }
    >
      <fieldset disabled={el.verrouille} className="disabled:opacity-40">
        <p className="mb-1 text-xs font-medium text-neutral-600">Environnement</p>
        <div className="mb-2.5 grid grid-cols-2 gap-1.5">
          {ENVIRONNEMENTS.map((e) => (
            <button
              key={e.id}
              data-environnement-3d={e.id}
              title={e.description}
              onClick={() => changer((x) => ({ ...x, environnement: { ...x.environnement, id: e.id } }), "environnement")}
              className={`overflow-hidden rounded-md border text-left text-xs ${l.environnement.id === e.id ? "border-accent-500 ring-2 ring-accent-200" : "border-neutral-200 hover:border-neutral-400"}`}
            >
              <span className="block h-8" style={{ background: APERCUS[e.id] }} />
              <span className={`block px-1.5 py-1 ${l.environnement.id === e.id ? "font-medium text-accent-700" : "text-neutral-700"}`}>{e.nom}</span>
            </button>
          ))}
        </div>
        <Reglage def={LUMIERE.intensiteEnvironnement} valeur={l.environnement.intensite} changer={(v) => changer((x) => ({ ...x, environnement: { ...x.environnement, intensite: v } }), "env-intensite")} debut={debut} fin={fin} />
        <Reglage def={LUMIERE.rotationEnvironnement} valeur={l.environnement.rotation} changer={(v) => changer((x) => ({ ...x, environnement: { ...x.environnement, rotation: v } }), "env-rotation")} debut={debut} fin={fin} />
        <p className="mt-3 mb-1 text-xs font-medium text-neutral-600">Lumière principale</p>
        <div className="mb-2.5 flex flex-wrap gap-1">
          {LUMIERES_PRETES.map((p) => (
            <button
              key={p.id}
              data-lumiere-3d={p.id}
              onClick={() => {
                const suivante = lumierePrete(el.lumiere, p.id);
                if (suivante !== null) poserLumiere(el.id, () => suivante ?? LUMIERE_PAR_DEFAUT, `lumiere-3d-prete:${el.id}:${p.id}`);
              }}
              className={`rounded-md border px-2 py-1 text-xs ${pretActif === p.id ? "border-accent-500 bg-accent-50 font-medium text-accent-700" : "border-neutral-200 text-neutral-700 hover:border-neutral-400"}`}
            >
              {p.nom}
            </button>
          ))}
        </div>
        <Reglage def={LUMIERE.azimut} valeur={l.principale.azimut} changer={(v) => changer((x) => ({ ...x, principale: { ...x.principale, azimut: v } }), "azimut")} debut={debut} fin={fin} />
        <Reglage def={LUMIERE.elevation} valeur={l.principale.elevation} changer={(v) => changer((x) => ({ ...x, principale: { ...x.principale, elevation: v } }), "elevation")} debut={debut} fin={fin} />
        <Reglage def={LUMIERE.intensite} valeur={l.principale.intensite} changer={(v) => changer((x) => ({ ...x, principale: { ...x.principale, intensite: v } }), "intensite")} debut={debut} fin={fin} />
        <div className="mb-3 flex items-center justify-between text-xs text-neutral-700" data-couleur-lumiere>
          Couleur
          <SelecteurCouleur titre="Couleur de la lumière principale" valeur={l.principale.couleur} surChoix={(c) => typeof c === "string" && changer((x) => ({ ...x, principale: { ...x.principale, couleur: c } }), "couleur")} />
        </div>
        <Reglage def={LUMIERE.exposition} valeur={l.exposition} changer={(v) => changer((x) => ({ ...x, exposition: v }), "exposition")} debut={debut} fin={fin} />
        <p className="text-[11px] text-neutral-500">La lumière tourne avec la vue, comme le studio d'un plateau tournant : tourner l'objet ne déplace pas ses reflets.</p>
      </fieldset>
    </Section>
  );
}

function OmbreSol({ el, debut, fin, marque }: { el: ElementObjet3d; debut: () => void; fin: () => void; marque: () => string }) {
  const o = el.ombreSol;
  return (
    <Section
      titre="Ombre au sol"
      droite={
        <label className="flex items-center gap-1.5 text-xs text-neutral-600">
          <input data-ombre-sol type="checkbox" disabled={el.verrouille} checked={!!o} onChange={(e) => poserOmbreSol(el.id, e.target.checked ? {} : null, `ombre-sol-3d:${el.id}`)} className="accent-accent-600" />
          {o ? "Oui" : "Non"}
        </label>
      }
    >
      {o ? (
        <fieldset disabled={el.verrouille} className="disabled:opacity-40">
          <Reglage def={OMBRE.opacite} valeur={o.opacite} changer={(v) => poserOmbreSol(el.id, { opacite: v }, `ombre-sol-3d:${el.id}:opacite${marque()}`)} debut={debut} fin={fin} />
          <Reglage def={OMBRE.douceur} valeur={o.douceur} changer={(v) => poserOmbreSol(el.id, { douceur: v }, `ombre-sol-3d:${el.id}:douceur${marque()}`)} debut={debut} fin={fin} />
          <p className="text-[11px] text-neutral-500">Elle part de la lumière principale (une lumière qui vient d'en haut). Coupée au bord de l'objet : agrandir sa boîte ou dézoomer.</p>
        </fieldset>
      ) : (
        <p className="text-[11px] text-neutral-500">L'ombre que le modèle porte sur un sol invisible, sous lui : il se pose sur la page au lieu de flotter.</p>
      )}
    </Section>
  );
}

function Matieres({ el, debut, fin, marque }: { el: ElementObjet3d; debut: () => void; fin: () => void; marque: () => string }) {
  const [, rafraichir] = useState(0);
  useEffect(() => abonnerModele(el.ressource, () => rafraichir((v) => v + 1)), [el.ressource]);
  // Le surlignage ne survit pas au panneau.
  useEffect(() => () => useOrbite.setState({ surligne: null }), [el.id]);
  const modele = modeleCharge(el.ressource);
  const surligner = (matiere: string | null) => useOrbite.setState({ surligne: matiere ? { id: el.id, matiere } : null });
  const repeintes = el.matieres ?? {};
  const ligne = (m: InfosMatiere) => {
    const r = repeintes[m.nom];
    return (
      <div key={m.nom} data-matiere-3d={m.nom} onMouseEnter={() => surligner(m.nom)} onMouseLeave={() => surligner(null)} className="mb-2 rounded-lg border border-neutral-200 p-2 hover:border-accent-300">
        <div className="mb-1 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-800" title={m.nom}>
            {m.nom}
          </span>
          <SelecteurCouleur titre={`Couleur de « ${m.nom} »${m.texture ? " (teinte sa texture)" : ""}`} valeur={r?.couleur ?? m.couleur} surChoix={(c) => typeof c === "string" && poserMatiere(el.id, m.nom, { couleur: c }, `matiere-3d:${el.id}:${m.nom}:couleur`)} />
          <button title={`Remettre « ${m.nom} » comme dans le modèle`} disabled={!r || el.verrouille} onClick={() => poserMatiere(el.id, m.nom, null, `matiere-3d:${el.id}:${m.nom}:remettre`)} className="rounded p-1 text-neutral-500 hover:bg-neutral-100 disabled:opacity-30">
            <RotateCcw size={13} />
          </button>
        </div>
        <Reglage
          def={{ ...BRILLANCE, nom: `brillance:${m.nom}`, defaut: m.brillance }}
          valeur={r?.brillance ?? m.brillance}
          changer={(v) => poserMatiere(el.id, m.nom, { brillance: v }, `matiere-3d:${el.id}:${m.nom}:brillance${marque()}`)}
          debut={debut}
          fin={fin}
        />
        {m.texture && <p className="-mt-1 text-[11px] text-neutral-500">A une texture : la couleur la teinte.</p>}
      </div>
    );
  };
  return (
    <Section
      titre="Matières"
      droite={
        <button data-matieres-depart title="Toutes les matières comme dans le modèle" disabled={!el.matieres || el.verrouille} onClick={() => poserMatiere(el.id, null, null, `matieres-3d-depart:${el.id}`)} className={PETIT_BOUTON}>
          <RotateCcw size={13} /> Toutes
        </button>
      }
    >
      {!modele ? (
        <p className="text-[11px] text-neutral-500">Le modèle se charge.</p>
      ) : modele.infosMatieres.length === 0 ? (
        <p className="text-[11px] text-neutral-500">Ce modèle n'a pas de matière à repeindre.</p>
      ) : (
        <fieldset disabled={el.verrouille} className="disabled:opacity-40">
          <p className="mb-2 text-[11px] text-neutral-500">Survoler une matière la montre sur l'objet. Les couleurs du kit de marque sont dans chaque pastille.</p>
          {modele.infosMatieres.map(ligne)}
        </fieldset>
      )}
    </Section>
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
  // Un geste sur un curseur : une étape d'annulation, et l'objet suit en direct.
  const marqueGeste = useRef("");
  const marque = () => marqueGeste.current;
  const debut = () => {
    marqueGeste.current = etiquetteDeGeste("");
    useOrbite.setState({ curseur: el.id });
  };
  const fin = () => {
    marqueGeste.current = "";
    if (useOrbite.getState().curseur) useOrbite.setState({ curseur: null });
  };
  // Un curseur relâché hors de sa piste finit quand même le geste.
  useEffect(() => {
    window.addEventListener("pointerup", fin);
    return () => {
      window.removeEventListener("pointerup", fin);
      fin();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const changerCamera = (cle: "azimut" | "elevation" | "zoom" | "focale", v: number) => {
    // Le dernier état du document : plusieurs changements peuvent arriver dans la même image.
    const c: Camera3d = { ...(objet3d(el.id)?.camera ?? el.camera), [cle]: v };
    poserCamera(el.id, c, `camera-3d:${el.id}:${cle}${marque()}`);
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
      <Section titre="Vue">
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
          {CAMERA.map((d) => (
            <Reglage key={d.cle} def={d} valeur={camera[d.cle]} changer={(v) => changerCamera(d.cle, v)} debut={debut} fin={fin} />
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
      </Section>
      <Lumiere el={el} debut={debut} fin={fin} marque={marque} />
      <OmbreSol el={el} debut={debut} fin={fin} marque={marque} />
      <Matieres el={el} debut={debut} fin={fin} marque={marque} />
      {ressource && <Modele key={`${ressource.id}-${ressource.modele3d?.miniature ? 1 : 0}`} ressource={ressource} />}
    </div>
  );
}
