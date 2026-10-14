// Le pilote : il reçoit les appels d'outils relayés par le noyau (pont MCP, src-tauri/src/ia.rs),
// les exécute dans l'interface et renvoie la réponse. Branché une fois au démarrage, dans
// Tauri seulement.

import { useEditeur } from "../etat/editeur";
import { dansTauri } from "../pont/tauri";
import { executerOutil, type Arguments } from "./outils";

interface AppelIa {
  id: number;
  outil: string;
  arguments: Arguments;
}

export async function brancherPiloteIa(): Promise<void> {
  if (!dansTauri) return;
  const { listen } = await import("@tauri-apps/api/event");
  const { invoke } = await import("@tauri-apps/api/core");
  await listen<AppelIa>("ia-appel", async ({ payload }) => {
    useEditeur.getState().signalerIa(payload.outil);
    try {
      const r = await executerOutil(payload.outil, payload.arguments);
      // Le champ garde son nom d'origine (`imagePng`) ; le pont reconnaît le JPEG à ses octets.
      await invoke("ia_repondre", { id: payload.id, ok: true, resultat: { donnees: r.donnees ?? null, imagePng: r.image ?? null }, erreur: null });
    } catch (e) {
      await invoke("ia_repondre", { id: payload.id, ok: false, resultat: null, erreur: e instanceof Error ? e.message : String(e) });
    }
  });
  // Les appels arrivés pendant le chargement de la fenêtre attendaient ce signal.
  await invoke("ia_pret");
}
