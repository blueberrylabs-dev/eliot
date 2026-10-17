import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App";
import { scene } from "./editeur/scene";
import { pageCourante, useEditeur } from "./etat/editeur";
import { demarrerEnregistrementAuto, enregistrerMaintenant, miniatureMaintenant } from "./etat/enregistrement";
import { enregistrerMarqueMaintenant, useMarque } from "./etat/marque";
import { nouveauDesign, ouvrirDesign, renommerDesign } from "./etat/projets";
import { exporter } from "./export/exporter";
import { creerImage, creerTitre } from "./modele/fabriques";
import { cheminAutotest, importerChemins, lirePolicePoste, listerProjets, ouvrirProjet, policesPoste, rapportAutotest, surFermeture } from "./pont/tauri";
import { brancherPiloteIa } from "./ia/pilote";
import { chargerCatalogue, chargerPolicesPoste } from "./polices";
import { appliquerTheme } from "./etat/theme";

// Le thème de l'interface, posé avant tout affichage (pas d'éclair blanc en thème sombre).
appliquerTheme();

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Essai automatique, en développement seulement (variable ELIOT_AUTOTEST, voir le noyau) :
 * création d'un design, import d'une image par le Rust, deux pages, enregistrement,
 * réouverture, renommage, export PNG. Le rapport est écrit dans le dossier temporaire.
 */
async function autotest(chemin: string): Promise<void> {
  const rapport: Record<string, unknown> = { debut: new Date().toISOString(), chemin };
  try {
    const etat = () => useEditeur.getState();
    await nouveauDesign({ largeur: 1080, hauteur: 1350 }, "Essai automatique");
    const projet = etat().projet!;
    rapport.projetCree = projet.id;
    const t0 = performance.now();
    const bilan = await importerChemins(projet, [chemin]);
    rapport.importMs = Math.round(performance.now() - t0);
    rapport.ressources = bilan.ressources.map((r) => ({ id: r.id, largeur: r.largeur, hauteur: r.hauteur }));
    rapport.erreursImport = bilan.erreurs;
    etat().ajouterRessources(bilan.ressources);
    const format = etat().document.format;
    if (bilan.ressources[0]) etat().ajouterElements([creerImage(format, bilan.ressources[0])]);
    etat().ajouterElements([creerTitre(format)]);
    etat().ajouterPage();
    etat().ajouterElements([creerTitre(format)]);
    await enregistrerMaintenant();
    await miniatureMaintenant();
    const relu = await ouvrirProjet(projet);
    rapport.pagesRelues = relu.document.pages.length;
    rapport.elementsRelus = relu.document.pages.map((p) => p.elements.length);
    rapport.miniature = relu.info.miniature;
    await renommerDesign("Essai automatique renommé");
    rapport.projetRenomme = etat().projet?.id;
    rapport.listeDesigns = (await listerProjets("designs")).map((d) => d.nom);
    // Réouverture complète, comme depuis l'accueil.
    await ouvrirDesign(etat().projet!);
    rapport.pageActiveApresReouverture = pageCourante(etat()).elements.length;
    await attendre(800);
    const t1 = performance.now();
    rapport.export = await exporter({ format: "png", echelle: 1, transparent: false, pages: "toutes" });
    rapport.exportMs = Math.round(performance.now() - t1);
    rapport.ok = true;
  } catch (erreur) {
    rapport.ok = false;
    rapport.erreur = String(erreur);
  }
  await rapportAutotest(rapport);
  // Dernière modification laissée en attente : la fermeture de la fenêtre doit l'enregistrer.
  useEditeur.getState().modifierFond("#123456");
}

async function demarrer() {
  await chargerCatalogue();
  // Les polices du poste arrivent ensuite, sans retarder l'ouverture.
  void chargerPolicesPoste(policesPoste, lirePolicePoste);
  demarrerEnregistrementAuto();
  void brancherPiloteIa();
  void useMarque.getState().charger();
  void surFermeture(async () => {
    await enregistrerMarqueMaintenant();
    await enregistrerMaintenant();
    await miniatureMaintenant();
  });
  createRoot(document.getElementById("racine")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  if (import.meta.env.DEV) {
    // Accès au store pour les essais automatisés dans un navigateur.
    Object.assign(window, { __eliot: useEditeur, __marque: useMarque, __scene: scene, __enregistrer: enregistrerMaintenant });
    const chemin = await cheminAutotest().catch(() => null);
    if (chemin) setTimeout(() => void autotest(chemin), 1500);
  }
}

void demarrer();
