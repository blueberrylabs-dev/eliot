import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { Editeur } from "./editeur/Editeur";
import { scene } from "./editeur/scene";
import { useEditeur } from "./etat/editeur";
import { exporter } from "./export/exporter";
import { creerImage, creerTitre } from "./modele/fabriques";
import { cheminAutotest, importerChemins, rapportAutotest } from "./pont/tauri";
import { chargerPolices } from "./polices";

const attendreImage = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

/**
 * Essai automatique, en développement seulement (variable ELIOT_AUTOTEST, voir le noyau) :
 * import d'une image par le Rust, ajout d'un titre, export PNG par le Rust. Le rapport est
 * écrit dans le dossier temporaire du système.
 */
async function autotest(chemin: string): Promise<void> {
  const rapport: Record<string, unknown> = { debut: new Date().toISOString(), chemin };
  try {
    const etat = useEditeur.getState();
    const t0 = performance.now();
    const bilan = await importerChemins([chemin]);
    rapport.importMs = Math.round(performance.now() - t0);
    rapport.ressources = bilan.ressources.map((r) => ({ id: r.id, nom: r.nom, largeur: r.largeur, hauteur: r.hauteur }));
    rapport.erreursImport = bilan.erreurs;
    etat.ajouterRessources(bilan.ressources);
    const page = etat.document.page;
    if (bilan.ressources[0]) etat.ajouterElements([creerImage(page, bilan.ressources[0])]);
    etat.ajouterElements([creerTitre(page)]);
    await new Promise((r) => setTimeout(r, 800));
    await attendreImage();
    const t1 = performance.now();
    rapport.export = await exporter({ format: "png", ratio: 1, transparent: false });
    rapport.exportMs = Math.round(performance.now() - t1);
    rapport.elements = useEditeur.getState().document.elements.length;
    rapport.ok = true;
  } catch (erreur) {
    rapport.ok = false;
    rapport.erreur = String(erreur);
  }
  await rapportAutotest(rapport);
}

async function demarrer() {
  await chargerPolices();
  createRoot(document.getElementById("racine")!).render(
    <StrictMode>
      <Editeur />
    </StrictMode>,
  );
  if (import.meta.env.DEV) {
    // Accès au store pour les essais automatisés dans un navigateur.
    Object.assign(window, { __eliot: useEditeur, __scene: scene });
    const chemin = await cheminAutotest().catch(() => null);
    if (chemin) setTimeout(() => void autotest(chemin), 1500);
  }
}

void demarrer();
