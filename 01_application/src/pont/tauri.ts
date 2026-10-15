// Le pont vers le noyau Rust. C'est le seul fichier qui connaît Tauri : passer à une autre
// enveloppe (Electron) ne toucherait que lui (BRIEF § 6). Hors de Tauri (`npm run dev` dans
// un navigateur), chaque fonction a un équivalent navigateur, pour travailler l'interface
// sans recompiler le Rust : les designs vivent alors dans la mémoire de l'onglet.

import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import type { Credit, DocumentEliot, InfoProjet, InfosVideo, RefProjet, RefRessources, Ressource } from "../modele/types";

export const dansTauri = isTauri();

const EXTENSIONS_IMAGES = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "tif", "tiff"];
/** Les mêmes que le noyau (`videos::EXTENSIONS`). */
export const EXTENSIONS_VIDEOS = ["mp4", "mov", "m4v", "webm", "mkv", "avi", "mpg", "mpeg"];
const extension = (chemin: string) => chemin.toLowerCase().split(".").pop() ?? "";
export const estCheminVideo = (chemin: string) => EXTENSIONS_VIDEOS.includes(extension(chemin));
export const estCheminImage = (chemin: string) => EXTENSIONS_IMAGES.includes(extension(chemin));

/** Ce que renvoie le noyau pour une image ou une vidéo. */
interface RessourceNoyau {
  id: string;
  nom: string;
  largeur: number;
  hauteur: number;
  transparence: boolean;
  credit?: Credit | null;
  video?: {
    duree: number;
    images_par_seconde: number;
    son: boolean;
    copie: string;
    vignettes: { nombre: number; intervalle: number; largeur: number; hauteur: number };
  } | null;
}

/** Où en est un import : le fichier en cours (à partir de 0), sa part faite de 0 à 1, et le
 *  nombre de fichiers. */
export type SuiviImport = (fichier: number, part: number, total: number) => void;
interface ResultatImport {
  chemin: string;
  ressource: RessourceNoyau | null;
  erreur: string | null;
}

export interface BilanImport {
  ressources: Ressource[];
  erreurs: string[];
}

const versRessource = (r: RessourceNoyau): Ressource => ({
  id: r.id,
  nom: r.nom,
  largeur: r.largeur,
  hauteur: r.hauteur,
  transparence: r.transparence,
  ...(r.credit ? { credit: { source: r.credit.source, auteur: r.credit.auteur, lien: r.credit.lien } } : {}),
  ...(r.video
    ? {
        video: {
          duree: r.video.duree,
          imagesParSeconde: r.video.images_par_seconde,
          son: r.video.son,
          copie: r.video.copie === "mp4" ? "mp4" : "webm",
          vignettes: { ...r.video.vignettes },
        } satisfies InfosVideo,
      }
    : {}),
});

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

// Images et vidéos du navigateur : préparées dans l'onglet, gardées le temps de la session.
// Pour une vidéo, la « copie » est le fichier lui-même (il n'y a pas de Rust ici).
const ressourcesNavigateur = new Map<string, { ressource: Ressource; urls: Record<GenreImage, string> & { copie?: string } }>();

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
const cleUrl = (ref: RefRessources, id: string, genre: GenreImage) => `${ref.rayon}/${ref.id}/${id}/${genre}`;

/** Adresse de l'aperçu ou de la miniature d'une image, gardée en mémoire après la première
 *  demande. Dans Tauri, le noyau lit le fichier et l'interface en fait une adresse locale. */
export function urlRessource(ref: RefRessources, id: string, genre: GenreImage): Promise<string> {
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

/** Adresse de la copie d'aperçu d'une vidéo, pour une balise `<video>`. Le noyau lit le
 *  fichier, la fenêtre en fait une adresse locale ; jamais l'original (règle 5). */
export function urlCopieVideo(ref: RefRessources, ressource: Ressource): Promise<string> {
  const navigateur = ressourcesNavigateur.get(ressource.id);
  if (navigateur?.urls.copie) return Promise.resolve(navigateur.urls.copie);
  const cle = `${ref.rayon}/${ref.id}/${ressource.id}/copie`;
  let promesse = urls.get(cle);
  if (!promesse) {
    const type = ressource.video?.copie === "mp4" ? "video/mp4" : "video/webm";
    promesse = invoke<ArrayBuffer>("lire_ressource", { rayonNom: ref.rayon, projetId: ref.id, id: ressource.id, genre: "copie" }).then((octets) => URL.createObjectURL(new Blob([octets], { type })));
    promesse.catch(() => urls.delete(cle));
    urls.set(cle, promesse);
  }
  return promesse;
}

/** Libère les adresses d'images d'un design qu'on quitte. */
export function oublierImages(ref: RefRessources | null): void {
  if (!ref) return;
  const prefixe = `${ref.rayon}/${ref.id}/`;
  for (const [cle, promesse] of urls) {
    if (!cle.startsWith(prefixe)) continue;
    urls.delete(cle);
    void promesse.then((u) => URL.revokeObjectURL(u), () => undefined);
  }
}

export async function listerRessources(ref: RefRessources): Promise<Ressource[]> {
  if (!dansTauri) return [];
  const liste = await invoke<RessourceNoyau[]>("ressources_lister", { rayonNom: ref.rayon, projetId: ref.id });
  return liste.map(versRessource);
}

function bilanDe(resultats: ResultatImport[], bilan: BilanImport = { ressources: [], erreurs: [] }): BilanImport {
  for (const r of resultats) {
    if (r.ressource) bilan.ressources.push(versRessource(r.ressource));
    else bilan.erreurs.push(`${r.chemin.split("/").pop()} : ${r.erreur ?? "erreur inconnue"}`);
  }
  return bilan;
}

/** Importe des fichiers déjà choisis ou déposés (chemins sur le disque) : le noyau lit et
 *  prépare tout, dans le dossier du design. Les vidéos passent après les images, l'une après
 *  l'autre (copie d'aperçu, vignettes, forme d'onde) ; `suivi` dit où en est chacune. Un
 *  fichier qui n'est ni une image ni une vidéo connue est tenté comme une image. */
export async function importerChemins(ref: RefRessources, chemins: string[], suivi?: SuiviImport): Promise<BilanImport> {
  const videos = chemins.filter(estCheminVideo);
  const images = chemins.filter((c) => !estCheminVideo(c));
  const bilan: BilanImport = { ressources: [], erreurs: [] };
  if (images.length) bilanDe(await invoke<ResultatImport[]>("importer_images", { rayonNom: ref.rayon, projetId: ref.id, chemins: images }), bilan);
  if (videos.length) {
    const canal = new Channel<{ fichier: number; part: number }>();
    canal.onmessage = (a) => suivi?.(a.fichier, a.part, videos.length);
    suivi?.(0, 0, videos.length);
    bilanDe(await invoke<ResultatImport[]>("importer_videos", { rayonNom: ref.rayon, projetId: ref.id, chemins: videos, avancement: canal }), bilan);
  }
  return bilan;
}

/** Ouvre le sélecteur de fichiers et importe les images et les vidéos choisies. `null` si on
 *  annule. */
export async function choisirEtImporterImages(ref: RefRessources, suivi?: SuiviImport, videos = true): Promise<BilanImport | null> {
  if (dansTauri) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const filtres = videos
      ? [
          { name: "Images et vidéos", extensions: [...EXTENSIONS_IMAGES, ...EXTENSIONS_VIDEOS] },
          { name: "Images", extensions: EXTENSIONS_IMAGES },
          { name: "Vidéos", extensions: EXTENSIONS_VIDEOS },
        ]
      : [{ name: "Images", extensions: EXTENSIONS_IMAGES }];
    const choix = await open({ multiple: true, directory: false, title: videos ? "Importer des images ou des vidéos" : "Importer des images", filters: filtres });
    if (!choix || (Array.isArray(choix) && choix.length === 0)) return null;
    return importerChemins(ref, Array.isArray(choix) ? choix : [choix], suivi);
  }
  const fichiers = await choisirFichiersNavigateur(videos);
  if (fichiers.length === 0) return null;
  return importerFichiersNavigateur(fichiers);
}

/** Importe une image reçue en octets : collage depuis le presse-papiers, fichier déposé dans
 *  le navigateur. */
export async function importerFichiers(ref: RefRessources, fichiers: File[]): Promise<BilanImport> {
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
export async function copierRessources(source: RefRessources, cible: RefRessources, ids: string[]): Promise<Ressource[]> {
  if (!dansTauri || ids.length === 0) return ids.flatMap((id) => (ressourcesNavigateur.has(id) ? [ressourcesNavigateur.get(id)!.ressource] : []));
  const liste = await invoke<RessourceNoyau[]>("ressources_copier", { sourceRayon: source.rayon, sourceId: source.id, cibleRayon: cible.rayon, cibleId: cible.id, ids });
  return liste.map(versRessource);
}

// ---- Équivalents navigateur ----

function choisirFichiersNavigateur(videos = false): Promise<File[]> {
  return new Promise((resoudre) => {
    const champ = document.createElement("input");
    champ.type = "file";
    champ.multiple = true;
    champ.accept = videos ? "image/*,video/*" : "image/*";
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

/** Une vidéo du navigateur : sa durée et sa taille, et une couverture prise à une seconde
 *  (au dixième d'une vidéo plus courte), comme le fait le noyau. */
async function sonderVideoNavigateur(url: string): Promise<{ video: HTMLVideoElement; couverture: ImageBitmap }> {
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  const attendre = (evenement: string) =>
    new Promise<void>((ok, ko) => {
      video.addEventListener(evenement, () => ok(), { once: true });
      video.addEventListener("error", () => ko(new Error("vidéo illisible dans ce navigateur")), { once: true });
    });
  const meta = attendre("loadeddata");
  video.src = url;
  await meta;
  const saut = attendre("seeked");
  video.currentTime = Math.min(1, video.duration / 10);
  await saut;
  return { video, couverture: await createImageBitmap(video) };
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
      if (fichier.type.startsWith("video/") || estCheminVideo(fichier.name)) {
        const copie = URL.createObjectURL(fichier);
        const { video, couverture } = await sonderVideoNavigateur(copie);
        const duree = Math.round(video.duration * 1000);
        const ressource: Ressource = {
          id,
          nom: fichier.name || "vidéo",
          largeur: video.videoWidth,
          hauteur: video.videoHeight,
          transparence: false,
          video: { duree, imagesParSeconde: 30, son: true, copie: fichier.type.includes("mp4") ? "mp4" : "webm", vignettes: { nombre: 0, intervalle: 1000, largeur: 0, hauteur: 0 } },
        };
        ressourcesNavigateur.set(id, { ressource, urls: { apercu: await reduireNavigateur(couverture, 2560, false), miniature: await reduireNavigateur(couverture, 256, false), copie } });
        couverture.close();
        ressources.push(ressource);
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

// ========================================================================================
// Photos de Pixabay (étape 3) : tout passe par le Rust, qui seul connaît la clé
// ========================================================================================

export interface PhotoPixabay {
  id: number;
  largeur: number;
  hauteur: number;
  auteur: string;
  /** Page de la photo sur Pixabay. */
  lien: string;
  mots: string;
}

export interface PagePixabay {
  total: number;
  photos: PhotoPixabay[];
}

export interface FiltresPixabay {
  orientation?: "horizontal" | "vertical";
  couleur?: string;
}

export interface EtatPixabay {
  /** Une clé a été trouvée par le Rust (sa valeur ne vient jamais jusqu'ici). */
  cle: boolean;
  /** Le fichier où l'ajouter. */
  fichier: string;
}

/** Hors de Tauri, la recherche n'existe pas (la clé ne doit pas venir dans la page). Les essais
 *  de l'interface dans un navigateur, en développement seulement, peuvent poser un faux
 *  Pixabay dans `window.__pixabayEssai`. */
interface PixabayEssai {
  etat(): Promise<EtatPixabay>;
  chercher(requete: string, page: number, filtres: FiltresPixabay): Promise<PagePixabay>;
  apercu(id: number): Promise<Blob>;
  importer(id: number): Promise<{ fichier: File; credit: Credit }>;
}
const pixabayEssai = (): PixabayEssai | undefined =>
  !dansTauri && import.meta.env.DEV ? (window as unknown as { __pixabayEssai?: PixabayEssai }).__pixabayEssai : undefined;

export async function etatPixabay(): Promise<EtatPixabay | null> {
  if (dansTauri) return invoke<EtatPixabay>("pixabay_etat");
  return (await pixabayEssai()?.etat()) ?? null;
}

export async function chercherPixabay(requete: string, page: number, filtres: FiltresPixabay = {}): Promise<PagePixabay> {
  if (dansTauri) return invoke<PagePixabay>("pixabay_chercher", { requete, page, filtres });
  const essai = pixabayEssai();
  if (!essai) throw new Error("les photos de Pixabay ne s'ouvrent que dans la fenêtre Eliot");
  return essai.chercher(requete, page, filtres);
}

// Les aperçus arrivent six par six : une page de 40 vignettes ne lance pas 40 téléchargements
// d'un coup.
const APERCUS_EN_PARALLELE = 6;
let apercusEnCours = 0;
const fileApercus: (() => void)[] = [];
const urlsApercus = new Map<number, Promise<string>>();

async function aTonTour<T>(travail: () => Promise<T>): Promise<T> {
  if (apercusEnCours >= APERCUS_EN_PARALLELE) await new Promise<void>((ok) => fileApercus.push(ok));
  apercusEnCours++;
  try {
    return await travail();
  } finally {
    apercusEnCours--;
    fileApercus.shift()?.();
  }
}

/** Adresse locale de l'aperçu d'une photo (340 px de haut), gardée le temps de la session. */
export function urlApercuPixabay(id: number): Promise<string> {
  let promesse = urlsApercus.get(id);
  if (!promesse) {
    promesse = aTonTour(async () => {
      if (dansTauri) {
        const octets = await invoke<ArrayBuffer>("pixabay_apercu", { id });
        return URL.createObjectURL(new Blob([octets], { type: "image/jpeg" }));
      }
      const essai = pixabayEssai();
      if (!essai) throw new Error("indisponible");
      return URL.createObjectURL(await essai.apercu(id));
    });
    promesse.catch(() => urlsApercus.delete(id));
    urlsApercus.set(id, promesse);
  }
  return promesse;
}

/** Télécharge la photo choisie (1 280 px) et la range dans le design, avec son crédit. */
export async function importerPixabay(ref: RefRessources, id: number): Promise<Ressource> {
  if (dansTauri) return versRessource(await invoke<RessourceNoyau>("pixabay_importer", { rayonNom: ref.rayon, projetId: ref.id, id }));
  const essai = pixabayEssai();
  if (!essai) throw new Error("les photos de Pixabay ne s'ouvrent que dans la fenêtre Eliot");
  const { fichier, credit } = await essai.importer(id);
  const bilan = await importerFichiersNavigateur([fichier]);
  if (bilan.erreurs.length) throw new Error(bilan.erreurs[0]);
  const ressource = bilan.ressources[0];
  ressource.credit = credit;
  return ressource;
}

// ========================================================================================
// Vidéos de Pixabay (étape 4) : même chemin que les photos, par le Rust
// ========================================================================================

export interface VideoPixabay {
  id: number;
  /** Taille du fichier qui sera téléchargé (1080p le plus souvent). */
  largeur: number;
  hauteur: number;
  /** Secondes. */
  duree: number;
  auteur: string;
  lien: string;
  mots: string;
}

export interface PageVideosPixabay {
  total: number;
  videos: VideoPixabay[];
}

interface PixabayVideosEssai {
  chercherVideos(requete: string, page: number): Promise<PageVideosPixabay>;
  apercuVideo(id: number): Promise<Blob>;
  importerVideo(id: number): Promise<{ fichier: File; credit: Credit }>;
}
const pixabayVideosEssai = () => pixabayEssai() as unknown as Partial<PixabayVideosEssai> | undefined;

export async function chercherVideosPixabay(requete: string, page: number): Promise<PageVideosPixabay> {
  if (dansTauri) return invoke<PageVideosPixabay>("pixabay_chercher_videos", { requete, page });
  const essai = pixabayVideosEssai();
  if (!essai?.chercherVideos) throw new Error("les vidéos de Pixabay ne s'ouvrent que dans la fenêtre Eliot");
  return essai.chercherVideos(requete, page);
}

const urlsApercusVideos = new Map<number, Promise<string>>();

/** Adresse locale de l'image d'aperçu d'une vidéo, gardée le temps de la session. */
export function urlApercuVideoPixabay(id: number): Promise<string> {
  let promesse = urlsApercusVideos.get(id);
  if (!promesse) {
    promesse = aTonTour(async () => {
      if (dansTauri) {
        const octets = await invoke<ArrayBuffer>("pixabay_apercu_video", { id });
        return URL.createObjectURL(new Blob([octets], { type: "image/jpeg" }));
      }
      const essai = pixabayVideosEssai();
      if (!essai?.apercuVideo) throw new Error("indisponible");
      return URL.createObjectURL(await essai.apercuVideo(id));
    });
    promesse.catch(() => urlsApercusVideos.delete(id));
    urlsApercusVideos.set(id, promesse);
  }
  return promesse;
}

/** Télécharge la vidéo choisie (1080p) et l'importe dans le design, avec son crédit. `suivi`
 *  reçoit la part faite, téléchargement puis préparation. */
export async function importerVideoPixabay(ref: RefRessources, id: number, suivi?: (part: number) => void): Promise<Ressource> {
  if (dansTauri) {
    const canal = new Channel<{ fichier: number; part: number }>();
    canal.onmessage = (a) => suivi?.(a.part);
    suivi?.(0);
    return versRessource(await invoke<RessourceNoyau>("pixabay_importer_video", { rayonNom: ref.rayon, projetId: ref.id, id, avancement: canal }));
  }
  const essai = pixabayVideosEssai();
  if (!essai?.importerVideo) throw new Error("les vidéos de Pixabay ne s'ouvrent que dans la fenêtre Eliot");
  const { fichier, credit } = await essai.importerVideo(id);
  const bilan = await importerFichiersNavigateur([fichier]);
  if (bilan.erreurs.length) throw new Error(bilan.erreurs[0]);
  const ressource = bilan.ressources[0];
  ressource.credit = credit;
  return ressource;
}

// ========================================================================================
// Kit de marque (étape 3) : `~/Documents/Eliot/Marque/kit/`
// ========================================================================================

const CLE_MARQUE = "eliot-marque";

export async function lireMarque(): Promise<unknown> {
  if (dansTauri) return invoke<unknown>("marque_lire");
  try {
    const brut = localStorage.getItem(CLE_MARQUE);
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null;
  }
}

export async function enregistrerMarque(kit: unknown): Promise<void> {
  if (dansTauri) {
    await invoke("marque_enregistrer", { kit });
    return;
  }
  try {
    localStorage.setItem(CLE_MARQUE, JSON.stringify(kit));
  } catch {
    // Stockage indisponible : le kit reste en mémoire le temps de l'onglet.
  }
}

/** Ouvre une page web (le crédit d'une photo) dans le navigateur du poste. */
export async function ouvrirLien(adresse: string): Promise<void> {
  if (!/^https:\/\//.test(adresse)) return;
  if (dansTauri) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(adresse);
    return;
  }
  window.open(adresse, "_blank", "noopener");
}
