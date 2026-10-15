// Le pont vers le noyau Rust. C'est le seul fichier qui connaît Tauri : passer à une autre
// enveloppe (Electron) ne toucherait que lui (BRIEF § 6). Hors de Tauri (`npm run dev` dans
// un navigateur), chaque fonction a un équivalent navigateur, pour travailler l'interface
// sans recompiler le Rust : les designs vivent alors dans la mémoire de l'onglet.

import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import type { Credit, DocumentEliot, InfoProjet, InfosSon, InfosVideo, NettoyageVoix, RefProjet, RefRessources, Ressource } from "../modele/types";

export const dansTauri = isTauri();

const EXTENSIONS_IMAGES = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "tif", "tiff"];
/** Les mêmes que le noyau (`videos::EXTENSIONS`). */
export const EXTENSIONS_VIDEOS = ["mp4", "mov", "m4v", "webm", "mkv", "avi", "mpg", "mpeg"];
const extension = (chemin: string) => chemin.toLowerCase().split(".").pop() ?? "";
/** Les mêmes que le noyau (`sons::EXTENSIONS`). */
export const EXTENSIONS_SONS = ["mp3", "wav", "ogg", "oga", "opus", "m4a", "aac", "flac", "aif", "aiff", "wma"];
export const estCheminVideo = (chemin: string) => EXTENSIONS_VIDEOS.includes(extension(chemin));
export const estCheminImage = (chemin: string) => EXTENSIONS_IMAGES.includes(extension(chemin));
export const estCheminSon = (chemin: string) => EXTENSIONS_SONS.includes(extension(chemin));
export const estFichierSon = (f: File) => f.type.startsWith("audio/") || estCheminSon(f.name);

/** Ce que renvoie le noyau pour une image, une vidéo ou un son. */
interface RessourceNoyau {
  id: string;
  nom: string;
  largeur: number;
  hauteur: number;
  transparence: boolean;
  credit?: (Omit<Credit, "licence" | "titre"> & { licence?: string | null; titre?: string | null }) | null;
  son?: { duree: number; copie: string; lufs?: number | null; crete?: number | null; origine?: string | null; marque?: number | null } | null;
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
  ...(r.credit
    ? {
        credit: {
          source: r.credit.source,
          auteur: r.credit.auteur,
          lien: r.credit.lien,
          ...(r.credit.licence ? { licence: r.credit.licence } : {}),
          ...(r.credit.titre ? { titre: r.credit.titre } : {}),
        },
      }
    : {}),
  ...(r.son
    ? {
        son: {
          duree: r.son.duree,
          copie: "webm",
          ...(typeof r.son.lufs === "number" ? { lufs: r.son.lufs } : {}),
          ...(typeof r.son.crete === "number" ? { crete: r.son.crete } : {}),
          ...(r.son.origine === "micro" || r.son.origine === "synthese" ? { origine: r.son.origine } : {}),
          ...(typeof r.son.marque === "number" ? { marque: r.son.marque } : {}),
        } satisfies InfosSon,
      }
    : {}),
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
const ressourcesNavigateur = new Map<string, { ressource: Ressource; urls: Record<"apercu" | "miniature", string> & { copie?: string; vignettes?: string } }>();

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

/** `vignettes` : la bande des vignettes d'une vidéo, pour sa frise. */
export type GenreImage = "apercu" | "miniature" | "vignettes";

const urls = new Map<string, Promise<string>>();
const cleUrl = (ref: RefRessources, id: string, genre: GenreImage) => `${ref.rayon}/${ref.id}/${id}/${genre}`;

/** Adresse de l'aperçu ou de la miniature d'une image, gardée en mémoire après la première
 *  demande. Dans Tauri, le noyau lit le fichier et l'interface en fait une adresse locale. */
export function urlRessource(ref: RefRessources, id: string, genre: GenreImage): Promise<string> {
  const navigateur = ressourcesNavigateur.get(id);
  if (navigateur) {
    const url = navigateur.urls[genre];
    return url ? Promise.resolve(url) : Promise.reject(new Error("pas de vignettes"));
  }
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

/** Adresse de la copie d'aperçu d'une vidéo, pour une balise `<video>`, ou de la copie
 *  d'écoute d'un son, pour une balise `<audio>`. Le noyau lit le fichier, la fenêtre en fait
 *  une adresse locale ; jamais l'original (règle 5). */
export function urlCopie(ref: RefRessources, ressource: Ressource): Promise<string> {
  const navigateur = ressourcesNavigateur.get(ressource.id);
  if (navigateur?.urls.copie) return Promise.resolve(navigateur.urls.copie);
  const cle = `${ref.rayon}/${ref.id}/${ressource.id}/copie`;
  let promesse = urls.get(cle);
  if (!promesse) {
    const type = ressource.son ? "audio/webm" : ressource.video?.copie === "mp4" ? "video/mp4" : "video/webm";
    promesse = invoke<ArrayBuffer>("lire_ressource", { rayonNom: ref.rayon, projetId: ref.id, id: ressource.id, genre: "copie" }).then((octets) => URL.createObjectURL(new Blob([octets], { type })));
    promesse.catch(() => urls.delete(cle));
    urls.set(cle, promesse);
  }
  return promesse;
}

/** L'image d'une vidéo à l'instant `ms` de son fichier (JPEG), tirée de la copie d'aperçu par
 *  le noyau ; dans le navigateur, par une balise vidéo. */
export async function imageVideo(ref: RefRessources, ressource: Ressource, ms: number): Promise<Blob> {
  if (dansTauri) {
    const octets = await invoke<ArrayBuffer>("image_video", { rayonNom: ref.rayon, projetId: ref.id, id: ressource.id, ms: Math.max(0, Math.round(ms)) });
    return new Blob([octets], { type: "image/jpeg" });
  }
  const url = await urlCopie(ref, ressource);
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  await new Promise<void>((ok, ko) => {
    video.addEventListener("loadeddata", () => ok(), { once: true });
    video.addEventListener("error", () => ko(new Error("vidéo illisible")), { once: true });
    video.src = url;
  });
  await new Promise<void>((ok) => {
    video.addEventListener("seeked", () => ok(), { once: true });
    video.currentTime = Math.min(ms / 1000, Math.max(0, video.duration - 0.01));
  });
  const toile = document.createElement("canvas");
  toile.width = video.videoWidth;
  toile.height = video.videoHeight;
  toile.getContext("2d")!.drawImage(video, 0, 0);
  video.removeAttribute("src");
  video.load();
  return new Promise<Blob>((ok, ko) => toile.toBlob((b) => (b ? ok(b) : ko(new Error("image impossible"))), "image/jpeg", 0.9));
}

/** La forme d'onde d'une vidéo : le pic du son (0 à 100), `par_seconde` fois par seconde. */
export interface Onde {
  par_seconde: number;
  pics: number[];
}
const ondes = new Map<string, Promise<Onde | null>>();

/** La forme d'onde d'une vidéo ou d'un son du design, gardée en mémoire ; `null` si elle n'a
 *  pas de son. */
export function ondeRessource(ref: RefRessources, id: string): Promise<Onde | null> {
  if (!dansTauri) return Promise.resolve(ondesNavigateur.get(id) ?? null);
  const cle = `${ref.rayon}/${ref.id}/${id}`;
  let promesse = ondes.get(cle);
  if (!promesse) {
    promesse = invoke<ArrayBuffer>("lire_ressource", { rayonNom: ref.rayon, projetId: ref.id, id, genre: "onde" }).then(
      (octets) => JSON.parse(new TextDecoder().decode(octets)) as Onde,
      () => null,
    );
    ondes.set(cle, promesse);
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
export async function importerChemins(ref: RefRessources, chemins: string[], suivi?: SuiviImport, suiviSons?: SuiviImport): Promise<BilanImport> {
  const videos = chemins.filter(estCheminVideo);
  const sons = chemins.filter(estCheminSon);
  const images = chemins.filter((c) => !estCheminVideo(c) && !estCheminSon(c));
  const bilan: BilanImport = { ressources: [], erreurs: [] };
  if (images.length) bilanDe(await invoke<ResultatImport[]>("importer_images", { rayonNom: ref.rayon, projetId: ref.id, chemins: images }), bilan);
  if (videos.length) {
    const canal = new Channel<{ fichier: number; part: number }>();
    canal.onmessage = (a) => suivi?.(a.fichier, a.part, videos.length);
    suivi?.(0, 0, videos.length);
    bilanDe(await invoke<ResultatImport[]>("importer_videos", { rayonNom: ref.rayon, projetId: ref.id, chemins: videos, avancement: canal }), bilan);
  }
  if (sons.length) {
    const s = suiviSons ?? suivi;
    const canal = new Channel<{ fichier: number; part: number }>();
    canal.onmessage = (a) => s?.(a.fichier, a.part, sons.length);
    s?.(0, 0, sons.length);
    bilanDe(await invoke<ResultatImport[]>("importer_sons", { rayonNom: ref.rayon, projetId: ref.id, chemins: sons, avancement: canal }), bilan);
  }
  return bilan;
}

/** Ouvre le sélecteur de fichiers et importe les sons choisis (lot 5) : le noyau range
 *  l'original, prépare la copie d'écoute et la forme d'onde, mesure le niveau. `null` si on
 *  annule. */
export async function choisirEtImporterSons(ref: RefRessources, suivi?: SuiviImport): Promise<BilanImport | null> {
  if (dansTauri) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const choix = await open({ multiple: true, directory: false, title: "Importer des sons", filters: [{ name: "Sons", extensions: EXTENSIONS_SONS }] });
    if (!choix || (Array.isArray(choix) && choix.length === 0)) return null;
    return importerChemins(ref, Array.isArray(choix) ? choix : [choix], undefined, suivi);
  }
  const fichiers = await choisirFichiersNavigateur(false, true);
  if (fichiers.length === 0) return null;
  return importerFichiersNavigateur(fichiers);
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

function choisirFichiersNavigateur(videos = false, sons = false): Promise<File[]> {
  return new Promise((resoudre) => {
    const champ = document.createElement("input");
    champ.type = "file";
    champ.multiple = true;
    champ.accept = sons ? "audio/*" : videos ? "image/*,video/*" : "image/*";
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

/** La bande des vignettes d'une vidéo du navigateur, comme celle du noyau : une image par
 *  seconde (20 au plus ici), 90 px de haut, côte à côte. */
async function vignettesNavigateur(video: HTMLVideoElement, duree: number): Promise<{ infos: InfosVideo["vignettes"]; url?: string }> {
  const nombre = Math.max(1, Math.min(20, Math.ceil(duree / 1000)));
  const hauteur = 90;
  const largeur = Math.max(2, Math.round((hauteur * video.videoWidth) / video.videoHeight / 2) * 2);
  const toile = document.createElement("canvas");
  toile.width = largeur * nombre;
  toile.height = hauteur;
  const c = toile.getContext("2d")!;
  for (let i = 0; i < nombre; i++) {
    await new Promise<void>((ok) => {
      video.addEventListener("seeked", () => ok(), { once: true });
      video.currentTime = Math.min((i * duree) / nombre / 1000, Math.max(0, video.duration - 0.01));
    });
    c.drawImage(video, i * largeur, 0, largeur, hauteur);
  }
  const blob = await new Promise<Blob | null>((ok) => toile.toBlob(ok, "image/jpeg", 0.8));
  return { infos: { nombre, intervalle: Math.round(duree / nombre), largeur, hauteur }, url: blob ? URL.createObjectURL(blob) : undefined };
}

const ondesNavigateur = new Map<string, Onde>();

/** Un son du navigateur : sa durée et sa forme d'onde (50 pics par seconde), comme le noyau. */
async function sonderSonNavigateur(octets: ArrayBuffer): Promise<{ duree: number; onde: Onde }> {
  const contexte = new OfflineAudioContext(1, 1, 8000);
  const tampon = await contexte.decodeAudioData(octets.slice(0));
  const parPic = Math.max(1, Math.round(tampon.sampleRate / 50));
  const canaux = Array.from({ length: tampon.numberOfChannels }, (_, i) => tampon.getChannelData(i));
  const pics: number[] = [];
  for (let debut = 0; debut < tampon.length; debut += parPic) {
    let max = 0;
    for (const c of canaux) for (let i = debut; i < Math.min(tampon.length, debut + parPic); i++) max = Math.max(max, Math.abs(c[i]));
    pics.push(Math.min(100, Math.round(max * 100)));
  }
  return { duree: Math.round(tampon.duration * 1000), onde: { par_seconde: 50, pics } };
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
      if (estFichierSon(fichier)) {
        const { duree, onde } = await sonderSonNavigateur(octets);
        const ressource: Ressource = { id, nom: fichier.name || "son", largeur: 0, hauteur: 0, transparence: false, son: { duree, copie: "webm" } };
        ressourcesNavigateur.set(id, { ressource, urls: { apercu: "", miniature: "", copie: URL.createObjectURL(fichier) } });
        ondesNavigateur.set(id, onde);
        ressources.push(ressource);
        continue;
      }
      if (fichier.type.startsWith("video/") || estCheminVideo(fichier.name)) {
        const copie = URL.createObjectURL(fichier);
        const { video, couverture } = await sonderVideoNavigateur(copie);
        const duree = Math.round(video.duration * 1000);
        const vignettes = await vignettesNavigateur(video, duree);
        const ressource: Ressource = {
          id,
          nom: fichier.name || "vidéo",
          largeur: video.videoWidth,
          hauteur: video.videoHeight,
          transparence: false,
          video: { duree, imagesParSeconde: 30, son: true, copie: fichier.type.includes("mp4") ? "mp4" : "webm", vignettes: vignettes.infos },
        };
        ressourcesNavigateur.set(id, { ressource, urls: { apercu: await reduireNavigateur(couverture, 2560, false), miniature: await reduireNavigateur(couverture, 256, false), copie, vignettes: vignettes.url } });
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

// ---- Export vidéo (étape 4, lot 4) ----

/** Les réglages d'un film, tels que le noyau les attend (`noyau/src/montage.rs`). */
export interface ReglagesFilm {
  format: "mp4" | "gif";
  largeur: number;
  hauteur: number;
  imagesParSeconde: number;
  crf: number;
  debitMaxKbps: number;
  gopSecondes: number;
  debitSonKbps: number;
  son: boolean;
  /** Le niveau visé, en LUFS (crête vraie plafonnée à -1 dBTP) ; `null` : tel que mixé. */
  niveauLufs: number | null;
  /** Aussi une version sans les musiques, à côté du film. */
  sansMusique: boolean;
}

/** Ce que l'export a écrit : le film, la version sans musique, le niveau final du son. */
export interface ResultatFilm {
  chemin: string;
  sansMusique: string | null;
  niveau: { lufs: number | null; crete: number | null; gain: number } | null;
}

/** Où en est un export vidéo : `son`, `images` (image faite sur le total), `gif`,
 *  `sans-musique`, `fini`. */
export interface AvancementFilm {
  etape: "son" | "images" | "gif" | "sans-musique" | "fini";
  image: number;
  images: number;
  part: number;
}

/** Fait le film d'une page décrite (`export/calques.ts`) ; renvoie ce qui a été écrit. Le
 *  noyau écrit dans Vidéos/Eliot sous un nom libre, ou au chemin choisi. */
export async function exporterFilm(ref: RefRessources, description: unknown, reglages: ReglagesFilm, nom: string, chemin: string | undefined, suivi: (a: AvancementFilm) => void): Promise<ResultatFilm> {
  if (!dansTauri) throw new Error("l'export vidéo se fait dans l'application Eliot (Tauri)");
  const canal = new Channel<AvancementFilm>();
  canal.onmessage = suivi;
  const r = await invoke<{ chemin: string; sans_musique: string | null; niveau: ResultatFilm["niveau"] }>("exporter_video", { rayonNom: ref.rayon, projetId: ref.id, description, reglages, nom, chemin: chemin ?? null, avancement: canal });
  return { chemin: r.chemin, sansMusique: r.sans_musique ?? null, niveau: r.niveau ?? null };
}

export async function annulerFilm(): Promise<void> {
  if (dansTauri) await invoke("annuler_export_video");
}

export async function dossierExportVideo(): Promise<string> {
  return dansTauri ? invoke<string>("dossier_export_video") : "Téléchargements";
}

/** « Enregistrer sous » pour un film : le chemin choisi, ou `null` si on annule. */
export async function choisirEmplacementFilm(nom: string, format: "mp4" | "gif"): Promise<string | null> {
  if (!dansTauri) return null;
  const { save } = await import("@tauri-apps/plugin-dialog");
  const dossier = await dossierExportVideo();
  return save({
    title: "Enregistrer la vidéo",
    defaultPath: `${dossier}/${nom}.${format}`,
    filters: [{ name: format === "mp4" ? "Vidéo MP4" : "Image animée GIF", extensions: [format] }],
  });
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
// Sons de Freesound (étape 4, lot 5) : même chemin, par le Rust, qui seul connaît la clé
// ========================================================================================

export type GenreFreesound = "bruitages" | "musiques" | "tout";

export interface SonFreesound {
  id: number;
  nom: string;
  auteur: string;
  /** `CC0 1.0`, `CC BY 4.0`… */
  licence: string;
  /** Secondes. */
  duree: number;
  /** Page du son sur Freesound. */
  lien: string;
  mots: string;
}

export interface PageSonsFreesound {
  total: number;
  sons: SonFreesound[];
}

/** Les essais de l'interface dans un navigateur posent un faux Freesound dans
 *  `window.__freesoundEssai` (développement seulement). */
interface FreesoundEssai {
  etat(): Promise<EtatPixabay>;
  chercher(requete: string, page: number, genre: GenreFreesound): Promise<PageSonsFreesound>;
  extrait(id: number): Promise<Blob>;
  importer(id: number): Promise<{ fichier: File; credit: Credit }>;
}
const freesoundEssai = (): FreesoundEssai | undefined =>
  !dansTauri && import.meta.env.DEV ? (window as unknown as { __freesoundEssai?: FreesoundEssai }).__freesoundEssai : undefined;

export async function etatFreesound(): Promise<EtatPixabay | null> {
  if (dansTauri) return invoke<EtatPixabay>("freesound_etat");
  return (await freesoundEssai()?.etat()) ?? null;
}

export async function chercherFreesound(requete: string, page: number, genre: GenreFreesound): Promise<PageSonsFreesound> {
  if (dansTauri) return invoke<PageSonsFreesound>("freesound_chercher", { requete, page, genre });
  const essai = freesoundEssai();
  if (!essai) throw new Error("les sons de Freesound ne s'ouvrent que dans la fenêtre Eliot");
  return essai.chercher(requete, page, genre);
}

const urlsExtraits = new Map<number, Promise<string>>();

/** Adresse locale de l'extrait d'un son (MP3 léger), gardée le temps de la session. */
export function urlExtraitFreesound(id: number): Promise<string> {
  let promesse = urlsExtraits.get(id);
  if (!promesse) {
    promesse = (async () => {
      if (dansTauri) {
        const octets = await invoke<ArrayBuffer>("freesound_extrait", { id });
        return URL.createObjectURL(new Blob([octets], { type: "audio/mpeg" }));
      }
      const essai = freesoundEssai();
      if (!essai) throw new Error("indisponible");
      return URL.createObjectURL(await essai.extrait(id));
    })();
    promesse.catch(() => urlsExtraits.delete(id));
    urlsExtraits.set(id, promesse);
  }
  return promesse;
}

/** Télécharge le son choisi et l'importe dans le design (ou le kit), avec son crédit et sa
 *  licence. `suivi` reçoit la part faite, téléchargement puis préparation. */
export async function importerFreesound(ref: RefRessources, id: number, suivi?: (part: number) => void): Promise<Ressource> {
  if (dansTauri) {
    const canal = new Channel<{ fichier: number; part: number }>();
    canal.onmessage = (a) => suivi?.(a.part);
    suivi?.(0);
    return versRessource(await invoke<RessourceNoyau>("freesound_importer", { rayonNom: ref.rayon, projetId: ref.id, id, avancement: canal }));
  }
  const essai = freesoundEssai();
  if (!essai) throw new Error("les sons de Freesound ne s'ouvrent que dans la fenêtre Eliot");
  const { fichier, credit } = await essai.importer(id);
  const bilan = await importerFichiersNavigateur([fichier]);
  if (bilan.erreurs.length) throw new Error(bilan.erreurs[0]);
  const ressource = { ...bilan.ressources[0], nom: credit.titre ?? bilan.ressources[0].nom, credit };
  ressourcesNavigateur.get(ressource.id)!.ressource = ressource;
  return ressource;
}

// ========================================================================================
// La voix (étape 4, lot 6) : le micro, le nettoyage, la voix de synthèse
// ========================================================================================

/** Un micro du poste, tel que PulseAudio (ou PipeWire) le présente. */
export interface Micro {
  nom: string;
  description: string;
  defaut: boolean;
}

/** Le niveau du micro, tous les 50 ms : crête et moyenne en dBFS, saturation, depuis combien de
 *  ms la prise court (après le compte à rebours), et l'erreur si le micro s'arrête. */
export interface NiveauMicro {
  crete: number;
  rms: number;
  ecretage: boolean;
  prise?: number;
  erreur?: string;
}

/** Une prise rangée dans le design : la ressource, l'instant du top (ms du fichier) et la durée
 *  du fichier. */
export interface PriseRangee {
  ressource: Ressource;
  marque: number;
  duree: number;
}

/** Une version nettoyée d'un son du design, faite par le noyau. */
export interface Traitee {
  cle: string;
  duree: number;
  lufs?: number;
  crete?: number;
}

/** Une voix de Piper trouvée sur le poste. */
export interface VoixPiper {
  id: string;
  nom: string;
  langue: string;
  qualite: string;
  licence?: string;
  donnees?: string;
}

export interface EtatPiper {
  installe: boolean;
  voix: VoixPiper[];
  /** Le dossier où ranger les voix téléchargées. */
  dossier: string;
}

/** Les essais de l'interface dans un navigateur posent une fausse voix dans
 *  `window.__voixEssai` (développement seulement) : faux micro, faux nettoyage, faux Piper. */
interface VoixEssai {
  micros(): Promise<Micro[]>;
  ouvrir(source: string, niveau: (n: NiveauMicro) => void): Promise<void>;
  commencer(): Promise<void>;
  marquer(): Promise<number>;
  arreter(): Promise<{ fichier: File; marque: number; duree: number }>;
  abandonner(): void;
  fermer(): void;
  nettoyer(ressource: string, nettoyage: NettoyageVoix): Promise<{ traitee: Traitee; fichier: File }>;
  piper(): Promise<EtatPiper>;
  dire(voix: string, texte: string, vitesse: number): Promise<{ fichier: File; credit: Credit }>;
}
const voixEssai = (): VoixEssai | undefined => (!dansTauri && import.meta.env.DEV ? (window as unknown as { __voixEssai?: VoixEssai }).__voixEssai : undefined);

const HORS_FENETRE = "la voix ne s'enregistre et ne se prépare que dans la fenêtre Eliot";

/** La voix est-elle possible ici (dans Tauri, ou avec la fausse voix des essais) ? */
export const voixDisponible = (): boolean => dansTauri || !!voixEssai();

export async function listerMicros(): Promise<Micro[]> {
  if (dansTauri) return invoke<Micro[]>("micro_lister");
  const essai = voixEssai();
  if (!essai) throw new Error(HORS_FENETRE);
  return essai.micros();
}

/** Ouvre le micro `source` ; son niveau arrive à `surNiveau` tous les 50 ms. */
export async function ouvrirMicro(source: string, surNiveau: (n: NiveauMicro) => void): Promise<void> {
  if (dansTauri) {
    const canal = new Channel<NiveauMicro>();
    canal.onmessage = surNiveau;
    await invoke("micro_ouvrir", { source, niveaux: canal });
    return;
  }
  const essai = voixEssai();
  if (!essai) throw new Error(HORS_FENETRE);
  await essai.ouvrir(source, surNiveau);
}

export async function commencerPrise(): Promise<void> {
  if (dansTauri) return invoke("micro_commencer");
  await voixEssai()?.commencer();
}

/** Le top : renvoie l'instant de la prise (ms du fichier) où le clip commencera. */
export async function marquerPrise(): Promise<number> {
  if (dansTauri) return invoke<number>("micro_marquer");
  return (await voixEssai()?.marquer()) ?? 0;
}

export function abandonnerPrise(): void {
  if (dansTauri) void invoke("micro_abandonner");
  else voixEssai()?.abandonner();
}

export function fermerMicro(): void {
  if (dansTauri) void invoke("micro_fermer");
  else voixEssai()?.fermer();
}

/** Arrête la prise et la range dans le design sous le nom `nom`. */
export async function arreterPrise(ref: RefRessources, nom: string): Promise<PriseRangee> {
  if (dansTauri) {
    const r = await invoke<{ ressource: RessourceNoyau; marque: number; duree: number }>("micro_arreter", { rayonNom: ref.rayon, projetId: ref.id, nom });
    return { ressource: versRessource(r.ressource), marque: r.marque, duree: r.duree };
  }
  const essai = voixEssai();
  if (!essai) throw new Error(HORS_FENETRE);
  const { fichier, marque, duree } = await essai.arreter();
  const bilan = await importerFichiersNavigateur([fichier]);
  if (bilan.erreurs.length) throw new Error(bilan.erreurs[0]);
  const ressource: Ressource = { ...bilan.ressources[0], nom, son: { ...bilan.ressources[0].son!, origine: "micro", marque } };
  ressourcesNavigateur.get(ressource.id)!.ressource = ressource;
  return { ressource, marque, duree };
}

const urlsNettoyees = new Map<string, string>();

/** La version nettoyée d'un son du design (faite par le noyau au besoin, relue sinon). */
export async function nettoyerVoix(ref: RefRessources, ressource: string, nettoyage: NettoyageVoix): Promise<Traitee> {
  if (dansTauri) {
    const t = await invoke<{ cle: string; duree: number; lufs?: number | null; crete?: number | null }>("voix_nettoyer", { rayonNom: ref.rayon, projetId: ref.id, id: ressource, nettoyage });
    return { cle: t.cle, duree: t.duree, ...(typeof t.lufs === "number" ? { lufs: t.lufs } : {}), ...(typeof t.crete === "number" ? { crete: t.crete } : {}) };
  }
  const essai = voixEssai();
  if (!essai) throw new Error(HORS_FENETRE);
  const { traitee, fichier } = await essai.nettoyer(ressource, nettoyage);
  const cle = `${ressource}/${traitee.cle}`;
  if (!urlsNettoyees.has(cle)) {
    urlsNettoyees.set(cle, URL.createObjectURL(fichier));
    ondesNavigateur.set(cle, (await sonderSonNavigateur(await fichier.arrayBuffer())).onde);
  }
  return traitee;
}

/** L'adresse de la copie d'écoute d'une version nettoyée. */
export async function urlCopieNettoyee(ref: RefRessources, ressource: string, cle: string): Promise<string> {
  const navigateur = urlsNettoyees.get(`${ressource}/${cle}`);
  if (navigateur) return navigateur;
  const fil = `${ref.rayon}/${ref.id}/${ressource}/nettoyee/${cle}`;
  let promesse = urls.get(fil);
  if (!promesse) {
    promesse = invoke<ArrayBuffer>("voix_lire", { rayonNom: ref.rayon, projetId: ref.id, id: ressource, cle, genre: "copie" }).then((octets) => URL.createObjectURL(new Blob([octets], { type: "audio/webm" })));
    promesse.catch(() => urls.delete(fil));
    urls.set(fil, promesse);
  }
  return promesse;
}

/** La forme d'onde d'une version nettoyée. */
export function ondeNettoyee(ref: RefRessources, ressource: string, cle: string): Promise<Onde | null> {
  if (!dansTauri) return Promise.resolve(ondesNavigateur.get(`${ressource}/${cle}`) ?? null);
  const fil = `${ref.rayon}/${ref.id}/${ressource}/nettoyee/${cle}`;
  let promesse = ondes.get(fil);
  if (!promesse) {
    promesse = invoke<ArrayBuffer>("voix_lire", { rayonNom: ref.rayon, projetId: ref.id, id: ressource, cle, genre: "onde" }).then(
      (octets) => JSON.parse(new TextDecoder().decode(octets)) as Onde,
      () => null,
    );
    ondes.set(fil, promesse);
  }
  return promesse;
}

/** Efface les versions nettoyées dont plus aucun clip du design ne se sert. */
export async function purgerVoix(ref: RefRessources, utilisees: { ressource: string; nettoyage: NettoyageVoix }[]): Promise<void> {
  if (!dansTauri) return;
  await invoke("voix_purger", { rayonNom: ref.rayon, projetId: ref.id, utilisees });
}

/** Piper est-il installé, quelles voix sont là. `null` hors de la fenêtre Eliot. */
export async function etatPiper(): Promise<EtatPiper | null> {
  if (dansTauri) return invoke<EtatPiper>("piper_etat");
  return (await voixEssai()?.piper()) ?? null;
}

const urlsDites = new Map<string, Promise<string>>();

/** L'adresse locale du texte dit par la voix, à écouter avant de l'ajouter. */
export function urlVoixDite(voix: string, texte: string, vitesse: number): Promise<string> {
  const cle = `${voix}\n${vitesse}\n${texte}`;
  let promesse = urlsDites.get(cle);
  if (!promesse) {
    promesse = (async () => {
      if (dansTauri) {
        const octets = await invoke<ArrayBuffer>("piper_ecouter", { voix, texte, vitesse });
        return URL.createObjectURL(new Blob([octets], { type: "audio/wav" }));
      }
      const essai = voixEssai();
      if (!essai) throw new Error(HORS_FENETRE);
      return URL.createObjectURL((await essai.dire(voix, texte, vitesse)).fichier);
    })();
    promesse.catch(() => urlsDites.delete(cle));
    urlsDites.set(cle, promesse);
  }
  return promesse;
}

/** Le texte dit par la voix, rangé dans le design comme un son (avec le crédit de la voix). */
export async function ajouterVoixDite(ref: RefRessources, voix: string, texte: string, vitesse: number): Promise<Ressource> {
  if (dansTauri) return versRessource(await invoke<RessourceNoyau>("piper_ajouter", { rayonNom: ref.rayon, projetId: ref.id, voix, texte, vitesse }));
  const essai = voixEssai();
  if (!essai) throw new Error(HORS_FENETRE);
  const { fichier, credit } = await essai.dire(voix, texte, vitesse);
  const bilan = await importerFichiersNavigateur([fichier]);
  if (bilan.erreurs.length) throw new Error(bilan.erreurs[0]);
  const ressource: Ressource = { ...bilan.ressources[0], nom: credit.titre ?? "voix", credit, son: { ...bilan.ressources[0].son!, origine: "synthese" } };
  ressourcesNavigateur.get(ressource.id)!.ressource = ressource;
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
