// L'export d'une page vidéo (étape 4, lot 4) : les réglages du film dans la fenêtre d'export
// (plateforme, définition, cadence, son ; largeur et cadence d'un GIF), et la fenêtre qui suit
// l'export, avec le bouton Annuler.

import { Clapperboard, X } from "lucide-react";
import { useExportVideo, annulerExportVideo, PLATEFORMES, plateforme, reglagesFilm, remarquesFilm, type OptionsFilm } from "../export/video";
import type { Format } from "../modele/types";

const option = (choisi: boolean) => `flex-1 rounded-md border px-2 py-1.5 text-sm ${choisi ? "border-accent-600 bg-accent-50 text-accent-700" : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"}`;

const secondes = (ms: number) => {
  const s = Math.round(ms / 100) / 10;
  return s >= 60 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${String(s).replace(".", ",")} s`;
};

export function ReglagesDuFilm({ options, changer, format, duree, musique = false }: { options: OptionsFilm; changer: (o: Partial<OptionsFilm>) => void; format: Format; duree: number; musique?: boolean }) {
  const reglages = reglagesFilm(options, format);
  const remarques = remarquesFilm(options, format, duree);
  if (options.format === "gif") {
    return (
      <div className="mb-3">
        <p className="mb-1 text-xs font-medium text-neutral-500">Largeur</p>
        <div className="mb-3 flex gap-2">
          {[320, 480, 640].map((l) => (
            <button key={l} className={option(options.largeurGif === l)} onClick={() => changer({ largeurGif: l })}>
              {l} px
            </button>
          ))}
        </div>
        <p className="mb-1 text-xs font-medium text-neutral-500">Images par seconde</p>
        <div className="mb-3 flex gap-2">
          {[10, 15, 20].map((c) => (
            <button key={c} className={option(options.imagesParSeconde === c)} onClick={() => changer({ imagesParSeconde: c })}>
              {c}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-neutral-500">
          {reglages.largeur} × {reglages.hauteur}, {secondes(duree)}, 256 couleurs, sans son, en boucle.
        </p>
        {remarques.map((r) => (
          <p key={r} className="mt-2 rounded-md bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
            {r}
          </p>
        ))}
      </div>
    );
  }
  const p = plateforme(options.plateforme);
  return (
    <div className="mb-3">
      <p className="mb-1 text-xs font-medium text-neutral-500">Pour</p>
      <div className="mb-2 grid grid-cols-5 gap-1">
        {PLATEFORMES.map((x) => (
          <button key={x.id} className={`rounded-md border px-1 py-1.5 text-xs ${options.plateforme === x.id ? "border-accent-600 bg-accent-50 text-accent-700" : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"}`} onClick={() => changer({ plateforme: x.id })}>
            {x.nom}
          </button>
        ))}
      </div>
      <p className="mb-3 text-[11px] text-neutral-500">{p.conseil}</p>
      <div className="mb-3 flex gap-3">
        <div className="flex-1">
          <p className="mb-1 text-xs font-medium text-neutral-500">Définition</p>
          <div className="flex gap-1">
            {([1080, 720] as const).map((d) => (
              <button key={d} className={option(options.definition === d)} onClick={() => changer({ definition: d })}>
                {d}p
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <p className="mb-1 text-xs font-medium text-neutral-500">Images/s</p>
          <select aria-label="Images par seconde" value={options.imagesParSeconde} onChange={(e) => changer({ imagesParSeconde: Number(e.target.value) })} className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
            {[24, 25, 30, 50, 60].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className="mb-1.5 flex items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" checked={options.son} onChange={(e) => changer({ son: e.target.checked })} className="accent-accent-600" />
        Garder le son
      </label>
      <label className={`mb-1.5 flex items-center gap-2 text-sm ${options.son ? "text-neutral-700" : "text-neutral-400"}`} title="Le son monte ou baisse pour sonner aussi fort que les autres vidéos de la plateforme (norme EBU R128), sans dépasser -1 dBTP en crête.">
        <input type="checkbox" disabled={!options.son} checked={options.niveau} onChange={(e) => changer({ niveau: e.target.checked })} className="accent-accent-600" />
        Caler le niveau sonore ({String(p.niveauLufs).replace("-", "−")} LUFS)
      </label>
      <label
        className={`mb-2 flex items-center gap-2 text-sm ${options.son && musique ? "text-neutral-700" : "text-neutral-400"}`}
        title={musique ? "Un second film, à côté, avec la voix et les bruitages mais sans les musiques : pour ajouter le son tendance de TikTok ou d'Instagram au moment de publier." : "La page n'a pas de musique (onglet Audio)."}
      >
        <input type="checkbox" disabled={!options.son || !musique} checked={options.sansMusique && musique} onChange={(e) => changer({ sansMusique: e.target.checked })} className="accent-accent-600" />
        Aussi une version sans musique
      </label>
      <p className="text-[11px] text-neutral-500">
        {reglages.largeur} × {reglages.hauteur}, {reglages.imagesParSeconde} images/s, {secondes(duree)}, H.264 jusqu'à {Math.round(reglages.debitMaxKbps / 100) / 10} Mbit/s, son AAC {reglages.debitSonKbps} kbit/s.
      </p>
      {remarques.map((r) => (
        <p key={r} className="mt-2 rounded-md bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
          {r}
        </p>
      ))}
    </div>
  );
}

const ETAPES: Record<string, string> = { objets3d: "Objets 3D, image par image", son: "Mixage du son", images: "Images du film", gif: "Palette du GIF", "sans-musique": "Version sans musique", fini: "Fini" };

/** La fenêtre qui suit l'export, par-dessus tout ; Annuler arrête le noyau. */
export function SuiviExportVideo() {
  const enCours = useExportVideo((s) => s.enCours);
  if (!enCours) return null;
  const a = enCours.avancement;
  const pourcent = Math.round((a?.part ?? 0) * 100);
  const texte = enCours.annulation ? "Annulation…" : !a ? "Préparation des calques…" : a.etape === "images" || a.etape === "objets3d" ? `${ETAPES[a.etape]} : ${a.image} sur ${a.images}` : ETAPES[a.etape];
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30" role="dialog" aria-label="Export vidéo en cours">
      <div className="w-96 rounded-xl bg-white p-5 text-neutral-900 shadow-2xl">
        <div className="mb-3 flex items-center gap-2">
          <Clapperboard size={18} className="text-accent-600" />
          <p className="flex-1 text-sm font-semibold">Export {enCours.format === "gif" ? "en GIF" : "en MP4"}</p>
          <span className="tabular-nums text-sm text-neutral-500">{pourcent} %</span>
        </div>
        <div className="mb-2 h-2 overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full rounded-full bg-accent-600 transition-[width] duration-200" style={{ width: `${pourcent}%` }} />
        </div>
        <p className="mb-4 text-xs text-neutral-500" role="status">
          {texte}
        </p>
        <button disabled={enCours.annulation} onClick={annulerExportVideo} className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-60">
          <X size={16} /> Annuler
        </button>
      </div>
    </div>
  );
}
