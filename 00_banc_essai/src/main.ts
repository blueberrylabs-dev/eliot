// Point d'entrée du banc d'essai : détecte le moteur, monte la scène, lance les tests,
// affiche et enregistre les résultats.

import { invoke, isTauri } from "@tauri-apps/api/core";
import { activerSelection, creerScene } from "./scene";
import { mesurerFrequence } from "./mesure";
import { SCENARIOS, fichiersManquants, type Contexte, type Resultat, type Scenario } from "./scenarios";
import { listeCopies, scenariosCopies, type ListeCopies } from "./copies";
import { scenariosLabo } from "./labo";

interface InfosSysteme {
  processeur: string;
  coeurs: number;
  memoire_go: number;
  cartes_graphiques: string[];
  session: string;
  variables: [string, string][];
  lancement_automatique: boolean;
  serie_automatique: string;
}

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const etat = element<HTMLParagraphElement>("etat");
const corpsTableau = element<HTMLTableElement>("tableau").tBodies[0];
const boutonLancer = element<HTMLButtonElement>("bouton-lancer");
const boutonCopies = element<HTMLButtonElement>("bouton-copies");
const boutonLabo = element<HTMLButtonElement>("bouton-labo");
const boutonLibre = element<HTMLButtonElement>("bouton-libre");
const boutonCopier = element<HTMLButtonElement>("bouton-copier");
const compteur = element<HTMLDivElement>("compteur");

const dansTauri = isTauri();

function nomMoteur(): string {
  if (dansTauri) return "tauri-webkitgtk";
  const ua = navigator.userAgent;
  // Navigateur intégré de l'application Claude : à distinguer de Chrome dans les résultats.
  if (/Claude/i.test(ua)) return "navigateur-claude";
  if (/Electron\//.test(ua)) return "electron";
  if (/Edg\//.test(ua)) return "edge";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/AppleWebKit/.test(ua)) return "webkit";
  return "navigateur";
}

function horodatage(): string {
  const d = new Date();
  const deux = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}_${deux(d.getHours())}${deux(d.getMinutes())}${deux(d.getSeconds())}`;
}

const moteur = nomMoteur();
element("moteur").textContent = dansTauri ? "Tauri, moteur web d'Ubuntu (WebKitGTK)" : `Navigateur : ${moteur}`;

const scene = creerScene(element<HTMLDivElement>("scene"));
let infos: InfosSysteme | null = null;
let frequenceHz = 60;
let dernierJson = "";

function decrireEcran(): void {
  element("ecran").textContent =
    `Écran ${screen.width} x ${screen.height}, rapport ${window.devicePixelRatio}, ${frequenceHz} Hz · ` +
    `fenêtre ${window.innerWidth} x ${window.innerHeight}`;
}

function afficherMachine(): void {
  if (!infos) {
    element("machine").textContent = "Machine : visible seulement dans la fenêtre Tauri.";
    return;
  }
  const variables = infos.variables.length
    ? infos.variables.map(([n, v]) => `${n}=${v}`).join(", ")
    : "aucune";
  element("machine").textContent =
    `Processeur : ${infos.processeur} (${infos.coeurs} fils)\n` +
    `Mémoire : ${infos.memoire_go} Go\n` +
    `Cartes : ${infos.cartes_graphiques.join(" ; ") || "?"}\n` +
    `Session : ${infos.session}\n` +
    `Variables de rendu : ${variables}`;
}

function cellule(ligne: HTMLTableRowElement, texte: string, classe?: string, colonnes?: number): void {
  const td = ligne.insertCell();
  td.textContent = texte;
  if (classe) td.className = classe;
  if (colonnes) td.colSpan = colonnes;
}

function afficherResultat(r: Resultat): void {
  const ligne = corpsTableau.insertRow();
  cellule(ligne, r.titre);
  if (r.stats) {
    cellule(ligne, String(r.stats.imagesParSeconde), "nombre");
    cellule(ligne, String(r.stats.dureeImageP95), "nombre");
    cellule(ligne, String(r.stats.acoups), "nombre");
    cellule(ligne, r.verdict ?? "", `verdict-${r.verdict === "saccadé" ? "saccade" : r.verdict}`);
  } else if (r.statut === "ok") {
    const entrees = Object.entries(r.mesures ?? {});
    const principal = entrees.find(([cle]) => cle.startsWith("total") || cle.startsWith("durée")) ?? entrees[0];
    cellule(ligne, principal ? `${principal[1]} ${principal[0].includes("ms") ? "ms" : ""}` : "mesuré", "nombre", 4);
  } else {
    cellule(ligne, r.statut, `verdict-${r.statut === "sans objet" ? "correct" : r.statut}`, 4);
  }

  const details: string[] = [];
  if (r.stats) {
    details.push(`médiane ${r.stats.dureeImageP50} ms, max ${r.stats.dureeImageMax} ms, dessin JS ${r.stats.dessinMoyenMs} ms`);
  }
  for (const [cle, valeur] of Object.entries(r.mesures ?? {})) details.push(`${cle} : ${valeur}`);
  if (r.note) details.push(r.note);
  if (details.length) {
    const ligneDetail = corpsTableau.insertRow();
    cellule(ligneDetail, details.join(" · "), "detail", 5);
  }
}

async function enregistrer(resultats: Resultat[], serie?: { nom: string; copies?: ListeCopies }): Promise<void> {
  const donnees = {
    version: 1,
    ...(serie ? { serie: serie.nom, ...(serie.copies ? { copies: serie.copies } : {}) } : {}),
    horodatage: horodatage(),
    moteur,
    navigateur: navigator.userAgent,
    ecran: { largeur: screen.width, hauteur: screen.height, rapportPixels: window.devicePixelRatio, frequenceHz },
    fenetre: { largeur: window.innerWidth, hauteur: window.innerHeight },
    scene: { largeur: scene.stage.width(), hauteur: scene.stage.height(), echellePage: Math.round(scene.echelle() * 1000) / 1000 },
    machine: infos,
    resultats,
  };
  dernierJson = JSON.stringify(donnees, null, 2);
  boutonCopier.hidden = false;
  const zone = element("enregistrement");
  try {
    const reponse = await fetch("/__banc/resultats", { method: "POST", headers: { "Content-Type": "application/json" }, body: dernierJson });
    if (!reponse.ok) throw new Error(`réponse ${reponse.status}`);
    const { fichier } = (await reponse.json()) as { fichier: string };
    zone.textContent = `Résultats enregistrés dans ${fichier}`;
  } catch (erreur) {
    zone.textContent = `Enregistrement impossible (${(erreur as Error).message}) : utilise « Copier les résultats ».`;
  }
}

let modeLibre = false;
let boucleCompteur = 0;

function basculerModeLibre(actif: boolean): void {
  modeLibre = actif;
  boutonLibre.textContent = actif ? "Quitter le mode libre" : "Mode libre";
  compteur.hidden = !actif;
  scene.transformer.nodes([]);
  scene.stage.batchDraw();
  cancelAnimationFrame(boucleCompteur);
  if (!actif) return;
  // Compteur d'images par seconde, sur la dernière seconde, pendant que tu manipules la page.
  const instants: number[] = [];
  const tic = (t: number) => {
    instants.push(t);
    while (instants.length && t - instants[0] > 1000) instants.shift();
    compteur.textContent = `${instants.length} images/s`;
    boucleCompteur = requestAnimationFrame(tic);
  };
  boucleCompteur = requestAnimationFrame(tic);
}

async function lancerTests(liste: Scenario[] = SCENARIOS, serie?: { nom: string; copies?: ListeCopies }): Promise<void> {
  basculerModeLibre(false);
  boutonLancer.disabled = true;
  boutonCopies.disabled = true;
  boutonLabo.disabled = true;
  boutonLibre.disabled = true;
  boutonCopier.hidden = true;
  corpsTableau.replaceChildren();
  element("enregistrement").textContent = "";

  etat.textContent = "Mesure de la fréquence de l'écran…";
  frequenceHz = await mesurerFrequence();
  decrireEcran();

  const ctx: Contexte = { scene, frequenceHz, dansTauri };
  const resultats: Resultat[] = [];
  for (const [rang, scenario] of liste.entries()) {
    etat.textContent = `Test ${rang + 1}/${liste.length} : ${scenario.titre}…`;
    let resultat: Resultat;
    try {
      // Un test qui ne répond plus ne doit jamais bloquer la série : une minute au plus.
      resultat = await Promise.race([
        scenario.executer(ctx),
        new Promise<never>((_, ko) => setTimeout(() => ko(new Error("test arrêté : plus de réponse après une minute")), 60_000)),
      ]);
    } catch (erreur) {
      resultat = { id: scenario.id, titre: scenario.titre, statut: "erreur", note: String((erreur as Error)?.message ?? erreur) };
    }
    resultats.push(resultat);
    afficherResultat(resultat);
  }

  etat.textContent = "Terminé. Tu peux passer en mode libre pour manipuler la page à la main.";
  await enregistrer(resultats, serie);
  boutonLancer.disabled = false;
  boutonCopies.disabled = false;
  boutonLabo.disabled = false;
  boutonLibre.disabled = false;
}

/** Étape 4, lot 0 : les copies d'aperçu fabriquées par `outils/generer_copies.py`. */
async function lancerCopies(): Promise<void> {
  const copies = await listeCopies();
  if (!copies) {
    etat.textContent = "Copies d'aperçu absentes : lance d'abord outils/generer_copies.py (commande 4 ter du CLAUDE.md).";
    return;
  }
  await lancerTests(scenariosCopies(copies), { nom: "copies", copies });
}

boutonLancer.addEventListener("click", () => void lancerTests());
boutonCopies.addEventListener("click", () => void lancerCopies());
// Étape 5, lot 0 : l'aperçu en direct du labo photo (environ une minute).
boutonLabo.addEventListener("click", () => void lancerTests(scenariosLabo(), { nom: "labo" }));
boutonLibre.addEventListener("click", () => basculerModeLibre(!modeLibre));
boutonCopier.addEventListener("click", () => {
  void navigator.clipboard.writeText(dernierJson).then(
    () => (boutonCopier.textContent = "Résultats copiés"),
    () => (boutonCopier.textContent = "Copie impossible"),
  );
});
activerSelection(scene);

async function demarrer(): Promise<void> {
  if (dansTauri) {
    try {
      infos = await invoke<InfosSysteme>("infos_systeme");
    } catch (erreur) {
      console.error("infos_systeme", erreur);
    }
  }
  afficherMachine();
  decrireEcran();
  const manquants = await fichiersManquants();
  if (manquants.length) {
    etat.textContent =
      `Fichiers de test absents (${manquants.map((f) => f.split("/").pop()).join(", ")}) : ` +
      "lance la commande 4 bis du CLAUDE.md, sinon les tests photo, vidéo et réduction seront sautés.";
  }
  const auto = new URLSearchParams(location.search).get("auto") === "1" || infos?.lancement_automatique === true;
  if (auto) {
    await new Promise((r) => setTimeout(r, 1500));
    await lancerTests();
  } else if (infos?.serie_automatique === "labo") {
    await new Promise((r) => setTimeout(r, 1500));
    await lancerTests(scenariosLabo(), { nom: "labo" });
  }
}

void demarrer();
