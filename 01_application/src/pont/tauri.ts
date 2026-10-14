// Le pont vers le noyau Rust. C'est le seul fichier qui connaît Tauri : passer à une autre
// enveloppe (Electron) ne toucherait que lui (BRIEF § 6). Hors de Tauri (`npm run dev` dans
// un navigateur), chaque fonction a un équivalent navigateur, pour travailler l'interface
// sans recompiler le Rust : les designs vivent alors dans la mémoire de l'onglet.

import { invoke, isTauri } from "@tauri-apps/api/core";
import type { DocumentEliot, InfoProjet, RefProjet, Ressource } from "../modele/types";

export const dansTauri = isTauri();

const EXTENSIONS_IMAGES = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "tif", "tiff"];

/** Ce que renvoie le noyau pour une image. */
interface RessourceNoyau {
  id: string;
  nom: string;
  largeur: number;
  hauteur: number;
  transparence: boolean;
}
interface ResultatImport {
  chemin: string;
  ressource: RessourceNoyau | null;
  erreur: string | null;
}

export interface BilanImport {
  ressources: Ressource[];
  erreurs: string[];
}

const versRessource = (r: RessourceNoyau): Ressource => ({ id: r.id, nom: r.nom, largeur: r.largeur, hauteur: r.hauteur, transparence: r.transparence });

/** Type d'image d'après les premiers octets (les aperçus sont en PNG ou en JPEG). */
function typeImage(octets: ArrayBuffer): string {
  const debut = new Uint8Array(octets.slice(0, 4));
  return debut[0] === 0x89 && debut[1] === 0x50 ? "image/png" : "image/jpeg";
}

const enTetes = (valeurs: Record<string, string>) => Object.fromEntries(Object.entries(valeurs).map(([k, v]) => [k, encodeURIComponent(v)]));

// ========================================================================================
// Équivalent navigateur : designs en mémoire, gardés dans le stockage de l'onglet
// ========================================================================================

interface DesignMemoire {
  document: DocumentEliot;
  modifie: number;
  miniature?: string;
}
type Rayons = Record<RefProjet["rayon"], Record<string, DesignMemoire>>;
const CLE_MEMOIRE = "eliot-designs";

function lireMemoire(): Rayons {
  try {
    const brut = localStorage.getItem(CLE_MEMOIRE);
    if (brut) return JSON.parse(brut) as Rayons;
  } catch {
    // Stockage indisponible : on repart de zéro, en mémoire seulement.
  }
  return { designs: {}, modeles: {} };
}
let memoire: Rayons | null = null;
const rayons = () => (memoire ??= lireMemoire());
function sauverMemoire() {
  try {
    localStorage.setItem(CLE_MEMOIRE, JSON.stringify(rayons()));
  } catch {
    // Plein ou interdit : les designs restent en mémoire le temps de l'onglet.
  }
}

const nomDeDossier = (nom: string) => nom.trim().replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_.-]/gu, "").replace(/^\.+/, "") || "Design_sans_titre";
function idLibre(rayon: Record<string, unknown>, nom: string): string {
  const base = nomDeDossier(nom);
  if (!(base in rayon)) return base;
  for (let n = 2; ; n++) if (!(`${base}_${n}` in rayon)) return `${base}_${n}`;
}
function infoMemoire(id: string, d: DesignMemoire): InfoProjet {
  return { id, nom: d.document.nom, largeur: d.document.format.largeur, hauteur: d.document.format.hauteur, pages: d.document.pages.length, modifie: d.modifie, miniature: !!d.miniature };
}
function designMemoire(ref: RefProjet): DesignMemoire {
  const d = rayons()[ref.rayon][ref.id];
  if (!d) throw new Error("ce design n'existe pas");
  return d;
}

// Images du navigateur : préparées dans l'onglet, gardées le temps de la session.
const ressourcesNavigateur = new Map<string, { ressource: Ressource; urls: Record<GenreImage, string> }>();

// ========================================================================================
// Designs
// ========================================================================================

export async function listerProjets(rayon: RefProjet["rayon"]): Promise<InfoProjet[]> {
  if (dansTauri) return invoke<InfoProjet[]>("projets_lister", { rayonNom: rayon });
  return Object.entries(rayons()[rayon])
    .map(([id, d]) => infoMemoire(id, d))
    .sort((a, b) => b.modifie - a.modifie);
}

export async function creerProjet(document: DocumentEliot): Promise<InfoProjet> {
  if (dansTauri) return invoke<InfoProjet>("projet_creer", { document });
  const rayon = rayons().designs;
  const id = idLibre(rayon, document.nom);
  rayon[id] = { document, modifie: Date.now() };
  sauverMemoire();
  return infoMemoire(id, rayon[id]);
}

export async function ouvrirProjet(ref: RefProjet): Promise<{ info: InfoProjet; document: DocumentEliot }> {
  if (dansTauri) return invoke("projet_ouvrir", { rayonNom: ref.rayon, id: ref.id });
  const d = designMemoire(ref);
  return { info: infoMemoire(ref.id, d), document: structuredClone(d.document) };
}

export async function enregistrerProjet(ref: RefProjet, document: DocumentEliot): Promise<InfoProjet> {
  if (dansTauri) {
    const octets = new TextEncoder().encode(JSON.stringify(document));
    return invoke<InfoProjet>("projet_enregistrer", octets, { headers: enTetes({ "x-rayon": ref.rayon, "x-id": ref.id }) });
  }
  const d = designMemoire(ref);
  d.document = structuredClone(document);
  d.modifie = Date.now();
  sauverMemoire();
  return infoMemoire(ref.id, d);
}

export async function enregistrerMiniature(ref: RefProjet, png: Uint8Array): Promise<void> {
  if (dansTauri) {
    await invoke("projet_miniature_enregistrer", png, { headers: enTetes({ "x-rayon": ref.rayon, "x-id": ref.id }) });
    return;
  }
  const d = designMemoire(ref);
  let binaire = "";
  png.forEach((o) => (binaire += String.fromCharCode(o)));
  d.miniature = `data:image/png;base64,${btoa(binaire)}`;
  sauverMemoire();
}

/** Adresse de la miniature d'un design pour l'accueil, ou `null` s'il n'en a pas. L'appelant
 *  libère l'adresse avec `URL.revokeObjectURL` quand il n'en a plus besoin. */
export async function urlMiniatureProjet(ref: RefProjet): Promise<string | null> {
  if (dansTauri) {
    try {
      const octets = await invoke<ArrayBuffer>("projet_miniature_lire", { rayonNom: ref.rayon, id: ref.id });
      return URL.createObjectURL(new Blob([octets], { type: "image/png" }));
    } catch {
      return null;
    }
  }
  return rayons()[ref.rayon][ref.id]?.miniature ?? null;
}

export async function renommerProjet(ref: RefProjet, nom: string): Promise<InfoProjet> {
  if (dansTauri) return invoke<InfoProjet>("projet_renommer", { rayonNom: ref.rayon, id: ref.id, nom });
  const rayon = rayons()[ref.rayon];
  const d = designMemoire(ref);
  delete rayon[ref.id];
  const id = idLibre(rayon, nom);
  d.document = { ...d.document, nom };
  rayon[id] = d;
  sauverMemoire();
  return infoMemoire(id, d);
}

export async function dupliquerProjet(ref: RefProjet, cible: RefProjet["rayon"], nom: string): Promise<InfoProjet> {
  if (dansTauri) return invoke<InfoProjet>("projet_dupliquer", { source: ref.rayon, id: ref.id, cible, nom });
  const d = designMemoire(ref);
  const rayon = rayons()[cible];
  const id = idLibre(rayon, nom);
  rayon[id] = { document: { ...structuredClone(d.document), nom }, modifie: Date.now(), miniature: d.miniature };
  sauverMemoire();
  return infoMemoire(id, rayon[id]);
}

/** Le design part dans la corbeille du système (récupérable). */
export async function supprimerProjet(ref: RefProjet): Promise<void> {
  if (dansTauri) {
    await invoke("projet_supprimer", { rayonNom: ref.rayon, id: ref.id });
    return;
  }
  delete rayons()[ref.rayon][ref.id];
  sauverMemoire();
}

/** Enregistre le design dans un fichier `.eliot` choisi par l'utilisateur. Renvoie le chemin
 *  écrit, ou `null` si on annule. */
export async function exporterArchive(ref: RefProjet, nom: string): Promise<string | null> {
  if (!dansTauri) throw new Error("le fichier .eliot n'existe que dans l'application");
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { documentDir } = await import("@tauri-apps/api/path");
  const chemin = await save({ title: "Exporter le design", defaultPath: `${await documentDir()}/${nomDeDossier(nom)}.eliot`, filters: [{ name: "Design Eliot", extensions: ["eliot"] }] });
  if (!chemin) return null;
  return invoke<string>("projet_exporter_archive", { rayonNom: ref.rayon, id: ref.id, chemin });
}

/** Ouvre un fichier `.eliot` et l'ajoute aux designs. `null` si on annule. */
export async function importerArchive(): Promise<InfoProjet | null> {
  if (!dansTauri) throw new Error("le fichier .eliot n'existe que dans l'application");
  const { open } = await import("@tauri-apps/plugin-dialog");
  const chemin = await open({ multiple: false, directory: false, title: "Ouvrir un design Eliot", filters: [{ name: "Design Eliot", extensions: ["eliot"] }] });
  if (!chemin || Array.isArray(chemin)) return null;
  return importerArchiveChemin(chemin);
}

export async function importerArchiveChemin(chemin: string): Promise<InfoProjet> {
  return invoke<InfoProjet>("projet_importer_archive", { chemin });
}

export async function dossierDesigns(): Promise<string> {
  return dansTauri ? invoke<string>("dossier_designs") : "mémoire de l'onglet";
}

// ========================================================================================
// Images d'un design
// ========================================================================================

export type GenreImage = "apercu" | "miniature";

const urls = new Map<string, Promise<string>>();
const cleUrl = (ref: RefProjet, id: string, genre: GenreImage) => `${ref.rayon}/${ref.id}/${id}/${genre}`;

/** Adresse de l'aperçu ou de la miniature d'une image, gardée en mémoire après la première
 *  demande. Dans Tauri, le noyau lit le fichier et l'interface en fait une adresse locale. */
export function urlRessource(ref: RefProjet, id: string, genre: GenreImage): Promise<string> {
  const navigateur = ressourcesNavigateur.get(id);
  if (navigateur) return Promise.resolve(navigateur.urls[genre]);
  const cle = cleUrl(ref, id, genre);
  let promesse = urls.get(cle);
  if (!promesse) {
    promesse = invoke<ArrayBuffer>("lire_ressource", { rayonNom: ref.rayon, projetId: ref.id, id, genre }).then((octets) =>
      URL.createObjectURL(new Blob([octets], { type: typeImage(octets) })),
    );
    promesse.catch(() => urls.delete(cle));
    urls.set(cle, promesse);
  }
  return promesse;
}

/** Libère les adresses d'images d'un design qu'on quitte. */
export function oublierImages(ref: RefProjet | null): void {
  if (!ref) return;
  const prefixe = `${ref.rayon}/${ref.id}/`;
  for (const [cle, promesse] of urls) {
    if (!cle.startsWith(prefixe)) continue;
    urls.delete(cle);
    void promesse.then((u) => URL.revokeObjectURL(u), () => undefined);
  }
}

export async function listerRessources(ref: RefProjet): Promise<Ressource[]> {
  if (!dansTauri) return [];
  const liste = await invoke<RessourceNoyau[]>("ressources_lister", { rayonNom: ref.rayon, projetId: ref.id });
  return liste.map(versRessource);
}

/** Importe des fichiers déjà choisis ou déposés (chemins sur le disque) : le noyau lit et
 *  prépare tout, dans le dossier du design. */
export async function importerChemins(ref: RefProjet, chemins: string[]): Promise<BilanImport> {
  const resultats = await invoke<ResultatImport[]>("importer_images", { rayonNom: ref.rayon, projetId: ref.id, chemins });
  const ressources: Ressource[] = [];
  const erreurs: string[] = [];
  for (const r of resultats) {
    if (r.ressource) ressources.push(versRessource(r.ressource));
    else erreurs.push(`${r.chemin.split("/").pop()} : ${r.erreur ?? "erreur inconnue"}`);
  }
  return { ressources, erreurs };
}

/** Ouvre le sélecteur de fichiers et importe les images choisies. `null` si on annule. */
export async function choisirEtImporterImages(ref: RefProjet): Promise<BilanImport | null> {
  if (dansTauri) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const choix = await open({ multiple: true, directory: false, title: "Importer des images", filters: [{ name: "Images", extensions: EXTENSIONS_IMAGES }] });
    if (!choix || (Array.isArray(choix) && choix.length === 0)) return null;
    return importerChemins(ref, Array.isArray(choix) ? choix : [choix]);
  }
  const fichiers = await choisirFichiersNavigateur();
  if (fichiers.length === 0) return null;
  return importerFichiersNavigateur(fichiers);
}

/** Importe une image reçue en octets : collage depuis le presse-papiers, fichier déposé dans
 *  le navigateur. */
export async function importerFichiers(ref: RefProjet, fichiers: File[]): Promise<BilanImport> {
  if (!dansTauri) return importerFichiersNavigateur(fichiers);
  const ressources: Ressource[] = [];
  const erreurs: string[] = [];
  for (const fichier of fichiers) {
    try {
      const octets = new Uint8Array(await fichier.arrayBuffer());
      const r = await invoke<RessourceNoyau>("importer_image_octets", octets, {
        headers: enTetes({ "x-rayon": ref.rayon, "x-projet": ref.id, "x-nom": fichier.name || "image collée" }),
      });
      ressources.push(versRessource(r));
    } catch (erreur) {
      erreurs.push(`${fichier.name || "image"} : ${String(erreur)}`);
    }
  }
  return { ressources, erreurs };
}

/** Copie des images d'un design vers un autre (coller entre deux designs). */
export async function copierRessources(source: RefProjet, cible: RefProjet, ids: string[]): Promise<Ressource[]> {
  if (!dansTauri || ids.length === 0) return ids.flatMap((id) => (ressourcesNavigateur.has(id) ? [ressourcesNavigateur.get(id)!.ressource] : []));
  const liste = await invoke<RessourceNoyau[]>("ressources_copier", { sourceRayon: source.rayon, sourceId: source.id, cibleRayon: cible.rayon, cibleId: cible.id, ids });
  return liste.map(versRessource);
}

// ---- Équivalents navigateur ----

function choisirFichiersNavigateur(): Promise<File[]> {
  return new Promise((resoudre) => {
    const champ = document.createElement("input");
    champ.type = "file";
    champ.multiple = true;
    champ.accept = "image/*";
    champ.addEventListener("change", () => resoudre(Array.from(champ.files ?? [])));
    champ.click();
  });
}

async function empreinteHex(octets: ArrayBuffer): Promise<string> {
  const somme = await crypto.subtle.digest("SHA-256", octets);
  return Array.from(new Uint8Array(somme), (o) => o.toString(16).padStart(2, "0")).join("");
}

async function reduireNavigateur(source: ImageBitmap, cote: number, transparence: boolean): Promise<string> {
  const echelle = Math.min(1, cote / Math.max(source.width, source.height));
  const toile = document.createElement("canvas");
  toile.width = Math.max(1, Math.round(source.width * echelle));
  toile.height = Math.max(1, Math.round(source.height * echelle));
  toile.getContext("2d")!.drawImage(source, 0, 0, toile.width, toile.height);
  const blob = await new Promise<Blob>((ok, ko) => toile.toBlob((b) => (b ? ok(b) : ko(new Error("réduction impossible"))), transparence ? "image/png" : "image/jpeg", 0.88));
  return URL.createObjectURL(blob);
}

async function importerFichiersNavigateur(fichiers: File[]): Promise<BilanImport> {
  const ressources: Ressource[] = [];
  const erreurs: string[] = [];
  for (const fichier of fichiers) {
    try {
      const octets = await fichier.arrayBuffer();
      const id = await empreinteHex(octets);
      const deja = ressourcesNavigateur.get(id);
      if (deja) {
        ressources.push(deja.ressource);
        continue;
      }
      const image = await createImageBitmap(fichier, { imageOrientation: "from-image" });
      const transparence = fichier.type === "image/png" || fichier.type === "image/webp" || fichier.type === "image/gif";
      const ressource = { id, nom: fichier.name || "image", largeur: image.width, hauteur: image.height, transparence };
      ressourcesNavigateur.set(id, {
        ressource,
        urls: { apercu: await reduireNavigateur(image, 2560, transparence), miniature: await reduireNavigateur(image, 256, transparence) },
      });
      image.close();
      ressources.push(ressource);
    } catch (erreur) {
      erreurs.push(`${fichier.name} : ${(erreur as Error).message}`);
    }
  }
  return { ressources, erreurs };
}

// ========================================================================================
// Fenêtre
// ========================================================================================

/** Avant de fermer la fenêtre, `avant` est attendu (dernier enregistrement). */
export async function surFermeture(avant: () => Promise<void>): Promise<void> {
  if (!dansTauri) {
    window.addEventListener("beforeunload", () => void avant());
    return;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  // Tauri attend la fin de ce gestionnaire, puis ferme la fenêtre. Une erreur pendant le
  // dernier enregistrement n'empêche jamais de fermer.
  await getCurrentWindow().onCloseRequested(async () => {
    try {
      await Promise.race([avant(), new Promise((r) => setTimeout(r, 5000))]);
    } catch {
      // Rien : la fenêtre se ferme quand même.
    }
  });
}

export async function pleinEcran(actif: boolean): Promise<void> {
  if (dansTauri) {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setFullscreen(actif);
  } else if (actif && !document.fullscreenElement) {
    await document.documentElement.requestFullscreen().catch(() => undefined);
  } else if (!actif && document.fullscreenElement) {
    await document.exitFullscreen().catch(() => undefined);
  }
}

/** Fichiers déposés sur la fenêtre depuis le gestionnaire de fichiers : Tauri donne leurs
 *  chemins et la position, en pixels de la fenêtre. */
export async function surDepotFichiers(gerer: (chemins: string[], x: number, y: number) => void, survol: (actif: boolean) => void): Promise<() => void> {
  if (!dansTauri) return () => undefined;
  const { getCurrentWebview } = await import("@tauri-apps/api/webview");
  return getCurrentWebview().onDragDropEvent((evenement) => {
    const p = evenement.payload;
    if (p.type === "enter" || p.type === "over") survol(true);
    else if (p.type === "leave") survol(false);
    else if (p.type === "drop") {
      survol(false);
      const echelle = window.devicePixelRatio || 1;
      gerer(p.paths, p.position.x / echelle, p.position.y / echelle);
    }
  });
}

/** Demande une confirmation (boîte du système dans Tauri). */
export async function confirmer(message: string, titre: string): Promise<boolean> {
  if (!dansTauri) return window.confirm(message);
  const { ask } = await import("@tauri-apps/plugin-dialog");
  return ask(message, { title: titre, kind: "warning", okLabel: "Oui", cancelLabel: "Annuler" });
}

// ========================================================================================
// Pont vers une IA (MCP)
// ========================================================================================

export interface InfosIa {
  active: boolean;
  ecoute: boolean;
  socket: string;
  binaire: string;
  binaire_present: boolean;
}

export async function infosIa(): Promise<InfosIa | null> {
  return dansTauri ? invoke<InfosIa>("ia_infos") : null;
}

export async function activerIa(active: boolean): Promise<InfosIa> {
  return invoke<InfosIa>("ia_activer", { active });
}

// ========================================================================================
// Export
// ========================================================================================

export type FormatExport = "png" | "jpeg";

/**
 * Écrit le rendu. Dans Tauri : octets bruts vers le noyau, qui vérifie le format et écrit de
 * façon atomique ; renvoie le chemin écrit. Dans un navigateur : téléchargement classique.
 */
export async function ecrireExport(octets: Uint8Array, format: FormatExport, nom: string, chemin?: string): Promise<string> {
  if (dansTauri) {
    return invoke<string>("exporter_rendu", octets, { headers: enTetes({ "x-format": format, "x-nom": nom, "x-chemin": chemin ?? "" }) });
  }
  const nomFichier = `${nom}.${format === "png" ? "png" : "jpg"}`;
  const url = URL.createObjectURL(new Blob([octets as BlobPart], { type: format === "png" ? "image/png" : "image/jpeg" }));
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return nomFichier;
}

export async function dossierExport(): Promise<string> {
  return dansTauri ? invoke<string>("dossier_export") : "Téléchargements";
}

/** « Enregistrer sous » : renvoie le chemin choisi, ou `null` si on annule. */
export async function choisirEmplacement(nom: string, format: FormatExport): Promise<string | null> {
  if (!dansTauri) return nom;
  const { save } = await import("@tauri-apps/plugin-dialog");
  const extension = format === "png" ? "png" : "jpg";
  const dossier = await dossierExport();
  return save({
    title: "Enregistrer l'image",
    defaultPath: `${dossier}/${nom}.${extension}`,
    filters: [{ name: format === "png" ? "Image PNG" : "Image JPEG", extensions: format === "png" ? ["png"] : ["jpg", "jpeg"] }],
  });
}

export async function afficherDansDossier(chemin: string): Promise<void> {
  if (!dansTauri) return;
  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(chemin);
}

// ========================================================================================
// Essai automatique (développement, Tauri seulement)
// ========================================================================================

export async function cheminAutotest(): Promise<string | null> {
  if (!dansTauri) return null;
  return (await invoke<string | null>("autotest_demande")) ?? null;
}

export async function rapportAutotest(rapport: unknown): Promise<void> {
  await invoke("autotest_rapport", { texte: JSON.stringify(rapport, null, 2) });
}

// ---- Polices du poste et polices copiées dans un design (étape 3) ----

export interface FichierPolice {
  /** Chemin complet (poste) ou nom du fichier (design). */
  chemin: string;
  style: "normal" | "italic";
  poids: number;
}

export interface PoliceInstallee {
  famille: string;
  fichiers: FichierPolice[];
}

/** Les polices installées sur le poste (aucune dans le navigateur). */
export async function policesPoste(): Promise<PoliceInstallee[]> {
  return dansTauri ? invoke<PoliceInstallee[]>("polices_poste") : [];
}

export async function lirePolicePoste(chemin: string): Promise<ArrayBuffer> {
  return invoke<ArrayBuffer>("police_poste_lire", { chemin });
}

/** Copie une police du poste dans le design ; renvoie le nom du fichier copié. */
export async function policeVersDesign(ref: RefProjet, chemin: string): Promise<string | null> {
  return dansTauri ? invoke<string>("police_vers_design", { rayonNom: ref.rayon, projetId: ref.id, chemin }) : null;
}

export async function policesDesign(ref: RefProjet): Promise<PoliceInstallee[]> {
  return dansTauri ? invoke<PoliceInstallee[]>("polices_design", { rayonNom: ref.rayon, projetId: ref.id }) : [];
}

export async function lirePoliceDesign(ref: RefProjet, fichier: string): Promise<ArrayBuffer> {
  return invoke<ArrayBuffer>("police_design_lire", { rayonNom: ref.rayon, projetId: ref.id, fichier });
}
