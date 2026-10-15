import { defineConfig, type Plugin } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = dirname(fileURLToPath(import.meta.url));

/**
 * Le serveur de développement reçoit les résultats d'une série de tests (POST JSON) et les
 * écrit dans `resultats/`. Ça marche pour la fenêtre Tauri comme pour Chrome, puisque les deux
 * chargent la page depuis ce même serveur local.
 */
function enregistrerResultats(): Plugin {
  return {
    name: "eliot-enregistrer-resultats",
    configureServer(serveur) {
      serveur.middlewares.use("/__banc/resultats", (requete, reponse) => {
        if (requete.method !== "POST") {
          reponse.statusCode = 405;
          reponse.end();
          return;
        }
        let corps = "";
        requete.setEncoding("utf8");
        requete.on("data", (morceau: string) => {
          corps += morceau;
          if (corps.length > 5_000_000) requete.destroy();
        });
        requete.on("end", () => {
          try {
            const donnees = JSON.parse(corps) as { moteur?: string; horodatage?: string; serie?: string };
            const moteur = String(donnees.moteur ?? "inconnu").replace(/[^a-z0-9-]/gi, "_");
            const horodatage =
              String(donnees.horodatage ?? "").replace(/[^0-9_-]/g, "") || "sans-date";
            const dossier = join(racine, "resultats");
            mkdirSync(dossier, { recursive: true });
            // Une série à part (les copies d'aperçu de l'étape 4) garde son nom dans le fichier.
            const serie = donnees.serie ? `_${String(donnees.serie).replace(/[^a-z0-9-]/gi, "_")}` : "";
            const nom = `${horodatage}_${moteur}${serie}.json`;
            writeFileSync(join(dossier, nom), JSON.stringify(donnees, null, 2) + "\n", "utf8");
            reponse.setHeader("Content-Type", "application/json");
            reponse.end(JSON.stringify({ fichier: `00_banc_essai/resultats/${nom}` }));
          } catch (erreur) {
            reponse.statusCode = 400;
            reponse.end(String(erreur));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [enregistrerResultats()],
  // Laisse visibles les erreurs du compilateur Rust dans le terminal.
  clearScreen: false,
  server: {
    // Tauri attend la page sur ce port précis.
    port: 1420,
    strictPort: true,
    host: false,
    watch: { ignored: ["**/src-tauri/**", "**/resultats/**"] },
  },
});
