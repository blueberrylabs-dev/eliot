// Le pont vers le noyau Rust. C'est le seul fichier qui connaît Tauri : passer à une autre
// enveloppe (Electron) ne toucherait que lui (BRIEF § 6). Hors de Tauri (`npm run dev` dans
// un navigateur), chaque fonction a un équivalent navigateur, pour travailler l'interface
// sans recompiler le Rust.

import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Ressource } from "../modele/types";

export const dansTauri = isTauri();

const EXTENSIONS_IMAGES = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "tif", "tiff"];

/** Ce que renvoie le noyau pour chaque fichier importé. */
interface RessourceNoyau {
  id: string;
  nom: string;
  largeur: number;
  hauteur: number;
  transparence: boolean;
  format_apercu: string;
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

async function urlDepuisNoyau(id: string, genre: "apercu" | "miniature", type: string): Promise<string> {
  const octets = await invoke<ArrayBuffer>("lire_ressource", { id, genre });
  return URL.createObjectURL(new Blob([octets], { type }));
}

async function versRessource(r: RessourceNoyau): Promise<Ressource> {
  const type = r.format_apercu === "png" ? "image/png" : "image/jpeg";
  const [urlApercu, urlMiniature] = await Promise.all([urlDepuisNoyau(r.id, "apercu", type), urlDepuisNoyau(r.id, "miniature", type)]);
  return { id: r.id, nom: r.nom, largeur: r.largeur, hauteur: r.hauteur, transparence: r.transparence, urlApercu, urlMiniature };
}

/** Importe des fichiers déjà choisis (chemins sur le disque) : le noyau lit et prépare tout. */
export async function importerChemins(chemins: string[]): Promise<BilanImport> {
  const resultats = await invoke<ResultatImport[]>("importer_images", { chemins });
  const ressources: Ressource[] = [];
  const erreurs: string[] = [];
  for (const r of resultats) {
    if (r.ressource) ressources.push(await versRessource(r.ressource));
    else erreurs.push(`${r.chemin.split("/").pop()} : ${r.erreur ?? "erreur inconnue"}`);
  }
  return { ressources, erreurs };
}

/** Ouvre le sélecteur de fichiers et importe les images choisies. `null` si on annule. */
export async function choisirEtImporterImages(): Promise<BilanImport | null> {
  if (dansTauri) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const choix = await open({ multiple: true, directory: false, title: "Importer des images", filters: [{ name: "Images", extensions: EXTENSIONS_IMAGES }] });
    if (!choix || (Array.isArray(choix) && choix.length === 0)) return null;
    return importerChemins(Array.isArray(choix) ? choix : [choix]);
  }
  const fichiers = await choisirFichiersNavigateur();
  if (fichiers.length === 0) return null;
  return importerFichiersNavigateur(fichiers);
}

// ---- Équivalents navigateur (développement de l'interface seulement) ----

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

export async function importerFichiersNavigateur(fichiers: File[]): Promise<BilanImport> {
  const ressources: Ressource[] = [];
  const erreurs: string[] = [];
  for (const fichier of fichiers) {
    try {
      const octets = await fichier.arrayBuffer();
      const image = await createImageBitmap(fichier, { imageOrientation: "from-image" });
      const transparence = fichier.type === "image/png" || fichier.type === "image/webp" || fichier.type === "image/gif";
      ressources.push({
        id: await empreinteHex(octets),
        nom: fichier.name,
        largeur: image.width,
        hauteur: image.height,
        transparence,
        urlApercu: await reduireNavigateur(image, 2560, transparence),
        urlMiniature: await reduireNavigateur(image, 256, transparence),
      });
      image.close();
    } catch (erreur) {
      erreurs.push(`${fichier.name} : ${(erreur as Error).message}`);
    }
  }
  return { ressources, erreurs };
}

// ---- Export ----

export type FormatExport = "png" | "jpeg";

/**
 * Écrit le rendu. Dans Tauri : octets bruts vers le noyau, qui vérifie le format et écrit de
 * façon atomique ; renvoie le chemin écrit. Dans un navigateur : téléchargement classique.
 */
export async function ecrireExport(octets: Uint8Array, format: FormatExport, nom: string, chemin?: string): Promise<string> {
  if (dansTauri) {
    return invoke<string>("exporter_rendu", octets, {
      headers: { "x-format": format, "x-nom": encodeURIComponent(nom), "x-chemin": encodeURIComponent(chemin ?? "") },
    });
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

// ---- Essai automatique (développement, Tauri seulement) ----

export async function cheminAutotest(): Promise<string | null> {
  if (!dansTauri) return null;
  return (await invoke<string | null>("autotest_demande")) ?? null;
}

export async function rapportAutotest(rapport: unknown): Promise<void> {
  await invoke("autotest_rapport", { texte: JSON.stringify(rapport, null, 2) });
}
