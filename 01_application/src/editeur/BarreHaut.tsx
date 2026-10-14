// La barre du haut : nom, annuler et rétablir, nouveau design, export.

import { Download, FilePlus2, FolderOpen, Redo2, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEditeur } from "../etat/editeur";
import { exporter } from "../export/exporter";
import { choisirEmplacement, dansTauri, dossierExport, type FormatExport } from "../pont/tauri";
import { nomDate } from "../export/exporter";

function PanneauExport({ fermer }: { fermer: () => void }) {
  const page = useEditeur((s) => s.document.page);
  const notifier = useEditeur((s) => s.notifier);
  const [format, setFormat] = useState<FormatExport>("png");
  const [ratio, setRatio] = useState(1);
  const [transparent, setTransparent] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [dossier, setDossier] = useState("");
  const boite = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void dossierExport().then(setDossier);
    const dehors = (e: MouseEvent) => !boite.current?.contains(e.target as Node) && fermer();
    window.addEventListener("mousedown", dehors);
    return () => window.removeEventListener("mousedown", dehors);
  }, [fermer]);

  const lancer = async (avecEmplacement: boolean) => {
    setOccupe(true);
    try {
      let chemin: string | undefined;
      if (avecEmplacement) {
        const choisi = await choisirEmplacement(nomDate(), format);
        if (!choisi) return;
        chemin = choisi;
      }
      const ecrit = await exporter({ format, ratio, transparent, chemin });
      notifier(dansTauri ? `Exporté : ${ecrit}` : `Téléchargé : ${ecrit}`, { chemin: dansTauri ? ecrit : undefined });
      fermer();
    } catch (erreur) {
      notifier(`Export impossible : ${String(erreur)}`, { erreur: true });
    } finally {
      setOccupe(false);
    }
  };

  const option = (choisi: boolean) => `flex-1 rounded-md border px-2 py-1.5 text-sm ${choisi ? "border-accent-600 bg-accent-50 text-accent-700" : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"}`;

  return (
    <div ref={boite} className="absolute top-12 right-3 z-30 w-80 rounded-xl border border-neutral-200 bg-white p-4 shadow-xl">
      <p className="mb-3 text-sm font-semibold text-neutral-800">Exporter la page</p>
      <p className="mb-1 text-xs font-medium text-neutral-500">Format</p>
      <div className="mb-3 flex gap-2">
        <button className={option(format === "png")} onClick={() => setFormat("png")}>
          PNG <span className="block text-[11px] text-neutral-500">net, transparence possible</span>
        </button>
        <button className={option(format === "jpeg")} onClick={() => setFormat("jpeg")}>
          JPEG <span className="block text-[11px] text-neutral-500">plus léger, pour les photos</span>
        </button>
      </div>
      <p className="mb-1 text-xs font-medium text-neutral-500">Taille</p>
      <div className="mb-3 flex gap-2">
        {[1, 2].map((r) => (
          <button key={r} className={option(ratio === r)} onClick={() => setRatio(r)}>
            ×{r} <span className="block text-[11px] text-neutral-500">{page.largeur * r} × {page.hauteur * r}</span>
          </button>
        ))}
      </div>
      <label className={`mb-4 flex items-center gap-2 text-sm ${format === "png" ? "text-neutral-700" : "text-neutral-400"}`}>
        <input type="checkbox" disabled={format !== "png"} checked={transparent && format === "png"} onChange={(e) => setTransparent(e.target.checked)} className="accent-accent-600" />
        Fond transparent
      </label>
      <button disabled={occupe} onClick={() => void lancer(false)} className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-600 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-60">
        <Download size={16} /> {occupe ? "Export en cours…" : dansTauri ? "Exporter dans Images/Eliot" : "Télécharger"}
      </button>
      {dansTauri && (
        <button disabled={occupe} onClick={() => void lancer(true)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-60">
          <FolderOpen size={16} /> Enregistrer sous…
        </button>
      )}
      {dossier && dansTauri && <p className="mt-2 truncate text-[11px] text-neutral-400" title={dossier}>Dossier : {dossier}</p>}
    </div>
  );
}

export function BarreHaut() {
  const peutAnnuler = useEditeur((s) => s.passe.length > 0);
  const peutRetablir = useEditeur((s) => s.futur.length > 0);
  const page = useEditeur((s) => s.document.page);
  const etat = useEditeur.getState();
  const [exportOuvert, setExportOuvert] = useState(false);
  const icone = "flex h-9 w-9 items-center justify-center rounded-md text-white/90 hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent";

  return (
    <header className="relative flex h-12 shrink-0 items-center gap-1 bg-gradient-to-r from-accent-700 to-accent-500 px-3 text-white">
      <div className="mr-3 flex items-center gap-2">
        <svg width="26" height="26" viewBox="0 0 1024 1024" aria-hidden>
          <rect x="40" y="40" width="944" height="944" rx="230" fill="#ffffff" fillOpacity="0.18" />
          <rect x="300" y="270" width="100" height="484" rx="36" fill="#fff" />
          <rect x="300" y="270" width="424" height="100" rx="36" fill="#fff" />
          <rect x="300" y="462" width="340" height="100" rx="36" fill="#fff" />
          <rect x="300" y="654" width="424" height="100" rx="36" fill="#fff" />
          <circle cx="740" cy="500" r="50" fill="#ff7a59" />
        </svg>
        <span className="text-base font-semibold tracking-tight">Eliot</span>
      </div>
      <button className={icone} title="Nouveau design" onClick={() => etat.nouveauDocument()}>
        <FilePlus2 size={18} />
      </button>
      <span className="mx-1 h-6 w-px bg-white/25" />
      <button className={icone} title="Annuler (Ctrl+Z)" disabled={!peutAnnuler} onClick={() => etat.annuler()}>
        <Undo2 size={18} />
      </button>
      <button className={icone} title="Rétablir (Ctrl+Maj+Z)" disabled={!peutRetablir} onClick={() => etat.retablir()}>
        <Redo2 size={18} />
      </button>
      <span className="flex-1" />
      <span className="mr-3 text-sm text-white/80 tabular-nums">
        {page.largeur} × {page.hauteur} px
      </span>
      <button onClick={() => setExportOuvert(!exportOuvert)} className="flex h-9 items-center gap-2 rounded-lg bg-white px-3.5 text-sm font-medium text-accent-700 hover:bg-accent-50">
        <Download size={16} /> Exporter
      </button>
      {exportOuvert && <PanneauExport fermer={() => setExportOuvert(false)} />}
    </header>
  );
}
