import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { Plugin } from "vite";

// Les polices variables ont des virgules dans leur nom (`Inter[opsz,wght].ttf`) ; écrites
// `%2C` dans `polices.css`, le serveur de développement ne les retrouvait pas et la fenêtre
// prenait une police de secours (vu le 2026-10-15). On les remet en clair avant qu'il cherche.
const virgulesDesPolices: Plugin = {
  name: "eliot-virgules-des-polices",
  configureServer(serveur) {
    serveur.middlewares.use((requete, _reponse, suite) => {
      if (requete.url?.startsWith("/bibliotheque/") && /%2C/i.test(requete.url)) requete.url = requete.url.replace(/%2C/gi, ",");
      suite();
    });
  },
};

// Tauri attend la page sur le port 1420 et ne doit pas voir Vite effacer ses erreurs Rust.
export default defineConfig({
  plugins: [react(), tailwindcss(), virgulesDesPolices],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
    watch: { ignored: ["**/src-tauri/**", "**/noyau/**"] },
  },
});
