// Les réglages : pour l'instant, le pont qui laisse une IA piloter Eliot (BRIEF § 6).

import { Bot, Check, Copy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useEditeur } from "../etat/editeur";
import { activerIa, dansTauri, infosIa, type InfosIa } from "../pont/tauri";

function Bloc({ titre, texte }: { titre: string; texte: string }) {
  const [copie, setCopie] = useState(false);
  return (
    <div className="mb-3">
      <p className="mb-1 text-xs font-medium text-neutral-600">{titre}</p>
      <div className="flex items-start gap-2 rounded-lg bg-neutral-900 p-2.5">
        <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-[11px] leading-relaxed whitespace-pre text-neutral-100 select-text">{texte}</pre>
        <button
          className="shrink-0 rounded p-1 text-neutral-300 hover:bg-white/10"
          title="Copier"
          onClick={() => {
            void navigator.clipboard?.writeText(texte).then(() => {
              setCopie(true);
              setTimeout(() => setCopie(false), 1500);
            });
          }}
        >
          {copie ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

export function Reglages() {
  const fermer = () => useEditeur.setState({ reglagesOuverts: false });
  const [infos, setInfos] = useState<InfosIa | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    void infosIa().then(setInfos);
    const echap = (e: KeyboardEvent) => e.key === "Escape" && fermer();
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, []);

  const basculer = async () => {
    if (!infos) return;
    setOccupe(true);
    setErreur(null);
    try {
      setInfos(await activerIa(!infos.active));
    } catch (e) {
      setErreur(String(e));
      setInfos(await infosIa());
    } finally {
      setOccupe(false);
    }
  };

  const configuration = infos ? JSON.stringify({ mcpServers: { eliot: { command: infos.binaire } } }, null, 2) : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onMouseDown={fermer}>
      <div className="max-h-[90vh] w-[600px] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl defilement-fin" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center">
          <p className="text-lg font-semibold text-neutral-900">Réglages</p>
          <span className="flex-1" />
          <button onClick={fermer} className="rounded p-1 text-neutral-500 hover:bg-neutral-100" title="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="mb-3 flex items-start gap-3">
          <Bot size={22} className="mt-0.5 shrink-0 text-accent-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-neutral-900">Laisser une IA piloter Eliot</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-600">
              Une IA comme Claude peut alors lire le design ouvert, poser et modifier des objets, gérer les pages, importer une image du poste, regarder une capture de la page et
              exporter. Tu la vois travailler dans la fenêtre, et Ctrl+Z défait chacune de ses actions. Elle ne peut ni supprimer un design ni écrire hors des dossiers d'Eliot.
              Pendant l'échange, le design et ses captures partent chez le fournisseur de l'IA (Anthropic pour Claude).
            </p>
          </div>
          {dansTauri && infos && (
            <button
              disabled={occupe}
              onClick={() => void basculer()}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${infos.active ? "bg-accent-600" : "bg-neutral-300"}`}
              title={infos.active ? "Désactiver" : "Activer"}
              data-interrupteur-ia
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${infos.active ? "left-[22px]" : "left-0.5"}`} />
            </button>
          )}
        </div>

        {!dansTauri && <p className="text-xs text-neutral-500">Disponible dans l'application seulement.</p>}
        {erreur && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{erreur}</p>}

        {infos?.active && (
          <div className="mt-4 border-t border-neutral-200 pt-4">
            <p className="mb-3 text-xs text-neutral-600">
              {infos.ecoute ? "Le pont est ouvert tant qu'Eliot l'est." : "Le pont est activé mais pas ouvert ; voir le message ci-dessus."} Il reste à le déclarer une fois dans ton
              application d'IA.
            </p>
            {!infos.binaire_present && (
              <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Le programme du pont n'est pas encore compilé : commande 13 du CLAUDE.md, puis reviens ici.
              </p>
            )}
            <Bloc titre="Claude Code (terminal)" texte={`claude mcp add eliot -- ${infos.binaire}`} />
            <Bloc titre="Application Claude de bureau : section à ajouter au fichier de configuration des serveurs MCP" texte={configuration} />
            <p className="text-[11px] text-neutral-500">Fichier de communication : {infos.socket}</p>
          </div>
        )}
      </div>
    </div>
  );
}
