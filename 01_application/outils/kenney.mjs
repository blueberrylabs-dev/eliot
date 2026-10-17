// Les paquets 3D de Kenney (étape 6, lot 3) : des modèles sous licence CC0, téléchargés à la main
// sur kenney.nl (un .zip par paquet) et rangés dans `Eliot/telechargements/kenney/`, hors git.
// `npm run bibliotheque` en tire chaque modèle au format GLB : sa texture commune (rangée à
// côté de lui dans le paquet, `Textures/colormap.png`) entre dans le fichier, qui se suffit ;
// son aperçu (`Previews/<nom>.png`) l'accompagne. Le tout va dans
// `public/bibliotheque/kenney/<paquet>/`, avec un catalogue (`catalogue.json`).

import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { lireZip } from "./personnages.mjs";

const MAGIE_GLB = 0x46546c67;
const BLOC_JSON = 0x4e4f534a;
const BLOC_BIN = 0x004e4942;

/** Le JSON et le bloc binaire d'un GLB. */
export function lireGlb(octets) {
  if (octets.readUInt32LE(0) !== MAGIE_GLB) throw new Error("pas un GLB");
  const longJson = octets.readUInt32LE(12);
  if (octets.readUInt32LE(16) !== BLOC_JSON) throw new Error("GLB sans JSON");
  const json = JSON.parse(octets.toString("utf8", 20, 20 + longJson));
  let bin = Buffer.alloc(0);
  const debutBin = 20 + longJson;
  if (debutBin + 8 <= octets.length && octets.readUInt32LE(debutBin + 4) === BLOC_BIN) {
    bin = octets.subarray(debutBin + 8, debutBin + 8 + octets.readUInt32LE(debutBin));
  }
  return { json, bin };
}

/** Un GLB à partir de son JSON et de son bloc binaire. */
export function ecrireGlb(json, bin) {
  const texte = Buffer.from(JSON.stringify(json), "utf8");
  const json4 = Buffer.concat([texte, Buffer.alloc((4 - (texte.length % 4)) % 4, 0x20)]);
  const bin4 = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4, 0)]);
  const morceaux = [Buffer.alloc(12), Buffer.alloc(8), json4];
  if (bin4.length) morceaux.push(Buffer.alloc(8), bin4);
  const total = morceaux.reduce((n, m) => n + m.length, 0);
  morceaux[0].writeUInt32LE(MAGIE_GLB, 0);
  morceaux[0].writeUInt32LE(2, 4);
  morceaux[0].writeUInt32LE(total, 8);
  morceaux[1].writeUInt32LE(json4.length, 0);
  morceaux[1].writeUInt32LE(BLOC_JSON, 4);
  if (bin4.length) {
    morceaux[3].writeUInt32LE(bin4.length, 0);
    morceaux[3].writeUInt32LE(BLOC_BIN, 4);
  }
  return Buffer.concat(morceaux);
}

/** Les images qu'un GLB cite par leur nom entrent dans son bloc binaire ; `lire(relatif)` rend
 *  leurs octets. Le GLB rendu se suffit. */
export function emporterTextures(octets, lire) {
  const { json, bin } = lireGlb(octets);
  const images = json.images ?? [];
  if (!images.some((i) => typeof i.uri === "string" && !i.uri.startsWith("data:"))) return octets;
  const morceaux = [bin];
  let longueur = bin.length;
  json.bufferViews ??= [];
  for (const image of images) {
    if (typeof image.uri !== "string" || image.uri.startsWith("data:")) continue;
    const relatif = decodeURIComponent(image.uri);
    if (relatif.split("/").some((p) => p === ".." || p === "") || relatif.startsWith("/")) throw new Error(`texture citée hors du paquet : ${image.uri}`);
    const donnees = lire(relatif);
    const bourrage = (4 - (longueur % 4)) % 4;
    if (bourrage) {
      morceaux.push(Buffer.alloc(bourrage));
      longueur += bourrage;
    }
    json.bufferViews.push({ buffer: 0, byteOffset: longueur, byteLength: donnees.length });
    morceaux.push(donnees);
    longueur += donnees.length;
    delete image.uri;
    image.bufferView = json.bufferViews.length - 1;
    image.mimeType = relatif.toLowerCase().endsWith(".jpg") || relatif.toLowerCase().endsWith(".jpeg") ? "image/jpeg" : "image/png";
  }
  const nouveau = Buffer.concat(morceaux);
  if (json.buffers?.length) json.buffers[0].byteLength = nouveau.length;
  else json.buffers = [{ byteLength: nouveau.length }];
  return ecrireGlb(json, nouveau);
}

/** « apple-half » devient « Apple half ». */
const nomLisible = (id) => {
  const t = id.replace(/[-_]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Le nom du paquet, d'après la première ligne de sa licence (« Food Kit (2.0) »). */
function nomDuPaquet(licence, repli) {
  const ligne = licence.split(/\r?\n/).map((l) => l.trim()).find((l) => l);
  return (ligne ?? repli).replace(/\s*\([\d.]+\)\s*$/, "").trim() || repli;
}

/** Lit les paquets de `dossier` (des .zip) et range leurs modèles dans `sortieBibliotheque`. */
export async function preparerKenney(sortieBibliotheque, dossier) {
  const sortie = path.join(sortieBibliotheque, "kenney");
  await fs.rm(sortie, { recursive: true, force: true });
  await fs.mkdir(sortie, { recursive: true });
  const paquets = [];
  const ecartes = [];
  let modeles = 0;
  const fichiers = existsSync(dossier) ? (await fs.readdir(dossier)).filter((f) => f.toLowerCase().endsWith(".zip")).sort() : [];
  for (const f of fichiers) {
    let archive;
    try {
      archive = lireZip(await fs.readFile(path.join(dossier, f)));
    } catch (e) {
      ecartes.push(`${f} (${e.message})`);
      continue;
    }
    const nomLicence = archive.noms.find((n) => /(^|\/)License\.txt$/i.test(n));
    const licence = nomLicence ? archive.lire(nomLicence).toString("utf8") : "";
    // Seuls les paquets qui se disent CC0 entrent.
    if (!/Creative Commons Zero|CC0/i.test(licence)) {
      ecartes.push(`${f} (licence CC0 introuvable)`);
      continue;
    }
    const glbs = archive.noms.filter((n) => /(^|\/)Models\/GLB format\/[^/]+\.glb$/i.test(n)).sort();
    if (glbs.length === 0) {
      ecartes.push(`${f} (pas de modèle au format GLB)`);
      continue;
    }
    const id = f.replace(/\.zip$/i, "").replace(/^kenney[_-]/i, "").toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const paquet = { id, nom: nomDuPaquet(licence, nomLisible(id)), licence: "CC0 1.0", lien: `https://kenney.nl/assets/${id}`, modeles: [] };
    await fs.mkdir(path.join(sortie, id), { recursive: true });
    for (const n of glbs) {
      const nom = path.posix.basename(n, path.posix.extname(n));
      const base = path.posix.dirname(n);
      let octets;
      try {
        octets = emporterTextures(archive.lire(n), (relatif) => archive.lire(path.posix.join(base, relatif)));
      } catch (e) {
        ecartes.push(`${f} : ${nom} (${e.message})`);
        continue;
      }
      await fs.writeFile(path.join(sortie, id, `${nom}.glb`), octets);
      const racine = n.slice(0, n.indexOf("Models/"));
      const apercu = archive.noms.find((x) => x === `${racine}Previews/${nom}.png`);
      if (apercu) await fs.writeFile(path.join(sortie, id, `${nom}.png`), archive.lire(apercu));
      paquet.modeles.push({ id: nom, nom: nomLisible(nom), apercu: !!apercu });
      modeles++;
    }
    paquets.push(paquet);
  }
  await fs.writeFile(path.join(sortie, "catalogue.json"), JSON.stringify({ version: 1, paquets }));
  return { paquets: paquets.map((p) => p.nom), modeles, ecartes, absent: fichiers.length === 0 };
}
