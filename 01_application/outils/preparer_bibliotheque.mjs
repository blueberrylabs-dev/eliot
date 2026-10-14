// Fabrique la bibliothèque d'Eliot (étape 3) dans `public/bibliotheque/`, hors git :
// icônes (Tabler, Phosphor), emojis (Fluent Emoji en version plate, OpenMoji), leurs mots de
// recherche en français, les polices de Google Fonts, et les personnages (Open Peeps,
// Humaaans) tirés des archives rangées dans `Eliot/telechargements/` (`outils/personnages.mjs`).
//
// Les icônes et les emojis viennent des paquets npm à version fixe du `package.json`
// (`npm install` d'abord). Les polices viennent de Google Fonts ; chaque fichier est contrôlé
// par l'empreinte SHA-256 relevée dans `outils/polices.verrou.json` : un fichier différent est
// refusé. Recopie aussi les licences dans `LICENCES-TIERS.md`.
//
//   npm run bibliotheque               tout fabriquer (réseau nécessaire pour les polices)
//   npm run bibliotheque -- --si-absent  ne rien faire si la bibliothèque est déjà là
//
// Processeur seulement, quelques secondes, plus le téléchargement des polices (38 Mo) la
// première fois ; les polices déjà présentes et conformes ne sont pas retéléchargées.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { preparerPersonnages } from "./personnages.mjs";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULES = path.join(RACINE, "node_modules");
const SORTIE = path.join(RACINE, "public", "bibliotheque");
// Les archives des personnages, téléchargées à la main (hors git).
const TELECHARGEMENTS = path.join(RACINE, "..", "telechargements");
const VERSION_BIBLIOTHEQUE = 2;

const args = new Set(process.argv.slice(2));

const lireJson = async (chemin) => JSON.parse(await fs.readFile(chemin, "utf8"));
const ecrireJson = (chemin, valeur) => fs.writeFile(chemin, JSON.stringify(valeur));
const versionPaquet = async (nom) => (await lireJson(path.join(MODULES, nom, "package.json"))).version;
const empreinte = (octets) => createHash("sha256").update(octets).digest("hex");

/** Minuscules sans accents : la recherche compare des mots normalisés. */
const normaliser = (texte) =>
  texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[\u2019']/g, " ")
    .replace(/[^a-z0-9 -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const motsUniques = (...listes) => [...new Set(listes.flat().filter(Boolean).flatMap((m) => normaliser(String(m)).split(" ")))].filter((m) => m.length > 1).join(" ");

/** Le contenu d'un fichier SVG sans sa balise `<svg>` englobante. */
function interieurSvg(svg) {
  const debut = svg.indexOf(">", svg.indexOf("<svg")) + 1;
  const fin = svg.lastIndexOf("</svg>");
  return svg.slice(debut, fin).replace(/\s*\n\s*/g, "").trim();
}

const echapperAttribut = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const noeudsEnSvg = (noeuds) => noeuds.map(([balise, attributs]) => `<${balise} ${Object.entries(attributs).map(([k, v]) => `${k}="${echapperAttribut(v)}"`).join(" ")}/>`).join("");

// ----------------------------------------------------------------------------------------
// Icônes
// ----------------------------------------------------------------------------------------

async function icones(collections, index) {
  // Tabler : métadonnées (catégorie, mots-clés) et tracés de chaque icône.
  const tabler = await lireJson(path.join(MODULES, "@tabler/icons/icons.json"));
  for (const [style, id, libelle, attributs] of [
    ["outline", "tabler", "Tabler, au trait", { fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" }],
    ["filled", "tabler-plein", "Tabler, plein", { fill: "currentColor" }],
  ]) {
    const noeuds = await lireJson(path.join(MODULES, `@tabler/icons/tabler-nodes-${style}.json`));
    const corps = {};
    for (const [nom, liste] of Object.entries(noeuds)) {
      corps[nom] = noeudsEnSvg(liste);
      const meta = tabler[nom] ?? {};
      index.push([id, nom, motsUniques(nom.split("-"), meta.tags ?? [], meta.category ?? "")]);
    }
    collections.push({ id, libelle, genre: "icone", viewBox: "0 0 24 24", attributs, couleur: true, licence: "MIT", source: "Tabler Icons", nombre: Object.keys(corps).length });
    await ecrireJson(path.join(SORTIE, "vecteurs", `${id}.json`), corps);
  }

  // Phosphor : six épaisseurs, mêmes noms ; l'index ne garde le nom qu'une fois.
  const phosphor = await import(pathToFileURL(path.join(MODULES, "@phosphor-icons/core/dist/index.mjs")).href);
  const metas = new Map(phosphor.icons.map((i) => [i.name, i]));
  const epaisseurs = [
    ["regular", "Phosphor, normal"],
    ["thin", "Phosphor, fin"],
    ["light", "Phosphor, léger"],
    ["bold", "Phosphor, épais"],
    ["fill", "Phosphor, plein"],
    ["duotone", "Phosphor, deux tons"],
  ];
  for (const [epaisseur, libelle] of epaisseurs) {
    const dossier = path.join(MODULES, "@phosphor-icons/core/assets", epaisseur);
    const corps = {};
    for (const fichier of (await fs.readdir(dossier)).sort()) {
      if (!fichier.endsWith(".svg")) continue;
      const nom = fichier.replace(/\.svg$/, "").replace(new RegExp(`-${epaisseur}$`), "");
      corps[nom] = interieurSvg(await fs.readFile(path.join(dossier, fichier), "utf8"));
      if (epaisseur === "regular") {
        const meta = metas.get(nom) ?? {};
        index.push(["phosphor", nom, motsUniques(nom.split("-"), (meta.tags ?? []).filter((t) => !t.startsWith("*")), meta.categories ?? [])]);
      }
    }
    const id = `phosphor-${epaisseur}`;
    collections.push({ id, libelle, genre: "icone", viewBox: "0 0 256 256", attributs: { fill: "currentColor" }, couleur: true, licence: "MIT", source: "Phosphor Icons", nombre: Object.keys(corps).length });
    await ecrireJson(path.join(SORTIE, "vecteurs", `${id}.json`), corps);
  }
}

// ----------------------------------------------------------------------------------------
// Emojis
// ----------------------------------------------------------------------------------------

/** Mots français d'un emoji (CLDR), cherchés sans le sélecteur de variante U+FE0F. */
function motsCldr(cldr, caractere) {
  if (!caractere) return { nom: undefined, mots: [] };
  const cle = caractere.replace(/️/g, "");
  const a = cldr.get(cle) ?? cldr.get(caractere);
  return { nom: a?.tts?.[0], mots: a?.default ?? [] };
}

const SUFFIXES_PEAU = /-(light|medium-light|medium|medium-dark|dark)$/;

async function emojis(collections, index, noms) {
  const cldr = new Map();
  const base = await lireJson(path.join(MODULES, "cldr-annotations-full/annotations/fr/annotations.json"));
  const derives = await lireJson(path.join(MODULES, "cldr-annotations-derived-full/annotationsDerived/fr/annotations.json"));
  for (const [c, a] of Object.entries(derives.annotationsDerived.annotations)) cldr.set(c, a);
  for (const [c, a] of Object.entries(base.annotations.annotations)) cldr.set(c, a);

  // Fluent Emoji, version plate (paquet Iconify, MIT, dessins de Microsoft).
  const fluent = await lireJson(path.join(MODULES, "@iconify-json/fluent-emoji-flat/icons.json"));
  const caracteres = await lireJson(path.join(MODULES, "@iconify-json/fluent-emoji-flat/chars.json"));
  const parNom = new Map(Object.entries(caracteres).map(([hex, nom]) => [nom, String.fromCodePoint(...hex.split("-").map((h) => parseInt(h, 16)))]));
  const corpsFluent = {};
  for (const [nom, icone] of Object.entries(fluent.icons)) {
    if (SUFFIXES_PEAU.test(nom)) continue; // variantes de couleur de peau : la version par défaut suffit
    corpsFluent[nom] = icone.body;
    const { nom: nomFr, mots } = motsCldr(cldr, parNom.get(nom));
    if (nomFr) noms[`fluent/${nom}`] = nomFr;
    index.push(["fluent", nom, motsUniques(nom.split("-"), mots, nomFr ?? "")]);
  }
  collections.push({ id: "fluent", libelle: "Fluent Emoji", genre: "emoji", viewBox: `0 0 ${fluent.width ?? 32} ${fluent.height ?? 32}`, attributs: {}, couleur: false, licence: "MIT", source: "Fluent Emoji (Microsoft)", nombre: Object.keys(corpsFluent).length });
  await ecrireJson(path.join(SORTIE, "vecteurs", "fluent.json"), corpsFluent);

  // OpenMoji (CC-BY-SA 4.0) : le crédit est affiché dans le panneau des éléments.
  const donnees = await lireJson(path.join(MODULES, "openmoji/data/openmoji.json"));
  const corpsOpen = {};
  for (const e of donnees) {
    if (e.skintone !== "" || e.group === "component") continue;
    const fichier = path.join(MODULES, "openmoji/color/svg", `${e.hexcode}.svg`);
    if (!existsSync(fichier)) continue;
    const nom = e.hexcode.toLowerCase();
    // Les identifiants internes (`id="color"`…) ne servent à rien et se répéteraient.
    corpsOpen[nom] = interieurSvg(await fs.readFile(fichier, "utf8")).replace(/ id="[^"]*"/g, "");
    const { nom: nomFr, mots } = motsCldr(cldr, e.emoji);
    noms[`openmoji/${nom}`] = nomFr ?? e.annotation;
    index.push(["openmoji", nom, motsUniques(e.annotation, (e.tags ?? "").split(","), (e.openmoji_tags ?? "").split(","), e.subgroups ?? "", mots, nomFr ?? "")]);
  }
  collections.push({ id: "openmoji", libelle: "OpenMoji", genre: "emoji", viewBox: "0 0 72 72", attributs: {}, couleur: false, licence: "CC-BY-SA-4.0", source: "OpenMoji", credit: "Emojis OpenMoji, https://openmoji.org, licence CC BY-SA 4.0", nombre: Object.keys(corpsOpen).length });
  await ecrireJson(path.join(SORTIE, "vecteurs", "openmoji.json"), corpsOpen);
}

// ----------------------------------------------------------------------------------------
// Polices
// ----------------------------------------------------------------------------------------

const idPolice = (famille) => normaliser(famille).replace(/ /g, "-");

async function telecharger(url) {
  for (let essai = 1; ; essai++) {
    try {
      const reponse = await fetch(url);
      if (!reponse.ok) throw new Error(`réponse ${reponse.status}`);
      return Buffer.from(await reponse.arrayBuffer());
    } catch (erreur) {
      if (essai >= 3) throw new Error(`${url} : ${erreur.message}`);
      await new Promise((ok) => setTimeout(ok, 1000 * essai));
    }
  }
}

async function polices(catalogue) {
  const verrou = await lireJson(path.join(RACINE, "outils/polices.verrou.json"));
  const parFamille = new Map(verrou.familles.map((f) => [f.famille, f]));
  const regles = [];
  const sortie = [];
  const erreurs = [];
  let telecharges = 0;

  const taches = catalogue.map((entree) => async () => {
    const v = parFamille.get(entree.famille);
    if (!v) throw new Error(`police absente du verrou : ${entree.famille}`);
    const id = idPolice(entree.famille);
    const dossier = path.join(SORTIE, "polices", id);
    await fs.mkdir(dossier, { recursive: true });
    const fichiers = [...v.fichiers.map((f) => ({ ...f, police: true })), { fichier: v.fichierLicence, sha256: v.sha256Licence, police: false }];
    for (const f of fichiers) {
      const cible = path.join(dossier, f.fichier);
      if (existsSync(cible) && empreinte(await fs.readFile(cible)) === f.sha256) continue;
      const octets = await telecharger(`${verrou.source}${v.dossier}/${encodeURIComponent(f.fichier)}`);
      if (empreinte(octets) !== f.sha256) {
        erreurs.push(`${entree.famille}, ${f.fichier} : le fichier de Google Fonts a changé depuis le relevé (empreinte différente), il n'est pas pris.`);
        continue;
      }
      await fs.writeFile(cible, octets);
      telecharges += 1;
    }
    for (const f of v.fichiers) {
      const [min, max] = f.poids;
      regles.push(`@font-face{font-family:"${entree.famille}";src:url("./polices/${id}/${encodeURIComponent(f.fichier)}") format("truetype");font-style:${f.style};font-weight:${min === max ? min : `${min} ${max}`};font-display:block}`);
    }
    const couvre = (style, poids) => v.fichiers.some((f) => f.style === style && f.poids[0] <= poids && poids <= f.poids[1]);
    sortie.push({ ...entree, id, gras: couvre("normal", 700), italique: couvre("italic", 400), licence: v.licence });
  });

  // Quatre téléchargements à la fois : assez pour aller vite, sans charger le réseau.
  const file = [...taches];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (file.length) await file.shift()();
  }));

  sortie.sort((a, b) => catalogue.findIndex((c) => c.famille === a.famille) - catalogue.findIndex((c) => c.famille === b.famille));
  regles.sort();
  await fs.writeFile(path.join(SORTIE, "polices.css"), `${regles.join("\n")}\n`);
  await ecrireJson(path.join(SORTIE, "polices.json"), sortie);
  return { sortie, erreurs, telecharges, verrou };
}

// ----------------------------------------------------------------------------------------
// Licences
// ----------------------------------------------------------------------------------------

async function licences(versions, verrou, personnages) {
  const lignes = [
    "# Licences des éléments embarqués dans Eliot",
    "",
    "Fichier écrit par `outils/preparer_bibliotheque.mjs` : ne pas le modifier à la main.",
    "Les fichiers eux-mêmes sont fabriqués sur le poste (`npm run bibliotheque`) et ne sont pas",
    "dans le dépôt.",
    "",
    "## Icônes",
    "",
    `- Tabler Icons ${versions["@tabler/icons"]}, licence MIT, https://tabler.io/icons`,
    `- Phosphor Icons ${versions["@phosphor-icons/core"]}, licence MIT, https://phosphoricons.com`,
    "",
    "## Emojis",
    "",
    `- Fluent Emoji de Microsoft, version plate, par le paquet \`@iconify-json/fluent-emoji-flat\` ${versions["@iconify-json/fluent-emoji-flat"]}, licence MIT, https://github.com/microsoft/fluentui-emoji`,
    `- OpenMoji ${versions.openmoji}, licence CC BY-SA 4.0, https://openmoji.org : crédit obligatoire, et un emoji modifié se partage sous la même licence`,
    `- Noms et mots-clés français des emojis : Unicode CLDR ${versions["cldr-annotations-full"]}, licence Unicode-3.0, https://cldr.unicode.org`,
    "",
    "## Personnages",
    "",
    "Tirés des archives téléchargées sur les sites des auteurs et rangées dans",
    "`telechargements/` (hors git). Dessins de Pablo Stanley, versés dans le domaine public :",
    "utilisables, modifiables et publiables librement, sans crédit obligatoire.",
    "",
    `- Open Peeps, licence CC0 1.0, https://www.openpeeps.com${personnages.collections.includes("Open Peeps") ? "" : " (archive absente)"}`,
    `- Humaaans, licence CC0 1.0, https://www.humaaans.com${personnages.collections.includes("Humaaans") ? "" : " (archive absente)"}`,
    "",
    "## Polices",
    "",
    `Source : Google Fonts, ${verrou.source}. Licence de chaque famille recopiée à côté de ses`,
    "fichiers, dans `public/bibliotheque/polices/<famille>/`.",
    "",
    "| Famille | Licence |",
    "| --- | --- |",
    ...verrou.familles.map((f) => `| ${f.famille} | ${f.licence} |`),
    "",
  ];
  await fs.writeFile(path.join(RACINE, "LICENCES-TIERS.md"), lignes.join("\n"));
}

// ----------------------------------------------------------------------------------------

async function principal() {
  const fichierVersion = path.join(SORTIE, "version.json");
  if (args.has("--si-absent") && existsSync(fichierVersion)) {
    const v = await lireJson(fichierVersion).catch(() => ({}));
    if (v.version === VERSION_BIBLIOTHEQUE && v.complete) return;
  }
  const debut = Date.now();
  await fs.mkdir(path.join(SORTIE, "vecteurs"), { recursive: true });

  const paquets = ["@tabler/icons", "@phosphor-icons/core", "@iconify-json/fluent-emoji-flat", "openmoji", "cldr-annotations-full", "cldr-annotations-derived-full"];
  const versions = Object.fromEntries(await Promise.all(paquets.map(async (p) => [p, await versionPaquet(p).catch(() => null)])));
  const manquants = paquets.filter((p) => !versions[p]);
  if (manquants.length) {
    console.error(`Paquets absents : ${manquants.join(", ")}. Lancer d'abord : npm install`);
    process.exit(1);
  }

  const collections = [];
  const index = [];
  const noms = {};
  await icones(collections, index);
  await emojis(collections, index, noms);
  await ecrireJson(path.join(SORTIE, "collections.json"), collections);
  await ecrireJson(path.join(SORTIE, "index.json"), index);
  await ecrireJson(path.join(SORTIE, "noms-emojis.json"), noms);
  const personnages = await preparerPersonnages(SORTIE, TELECHARGEMENTS);

  const catalogue = await lireJson(path.join(RACINE, "src/bibliotheque/polices.json"));
  const { sortie, erreurs, telecharges, verrou } = await polices(catalogue);
  await licences(versions, verrou, personnages);

  const complete = erreurs.length === 0;
  await ecrireJson(fichierVersion, { version: VERSION_BIBLIOTHEQUE, complete, fabriquee: new Date().toISOString(), paquets: versions });
  // Les six épaisseurs de Phosphor dessinent les mêmes icônes : comptées une fois.
  const nombre = (genre) => collections.filter((c) => c.genre === genre && !/^phosphor-(?!regular)/.test(c.id)).reduce((n, c) => n + c.nombre, 0);
  console.log(`Bibliothèque prête dans ${path.relative(process.cwd(), SORTIE) || SORTIE} en ${((Date.now() - debut) / 1000).toFixed(1)} s :`);
  console.log(`  ${nombre("icone")} icônes, ${nombre("emoji")} emojis, ${sortie.length} polices (${telecharges} fichiers téléchargés)`);
  if (personnages.collections.length) console.log(`  ${personnages.personnages} personnages et ${personnages.pieces} pièces à assembler (${personnages.collections.join(", ")})`);
  if (personnages.absentes.length) {
    console.log(`  Personnages absents : ${personnages.absentes.join(", ")}. Ranger leur archive .zip dans`);
    console.log(`  ${TELECHARGEMENTS} puis relancer npm run bibliotheque.`);
  }
  for (const e of erreurs) console.error(`  ${e}`);
  if (!complete) process.exit(2);
}

await principal();
