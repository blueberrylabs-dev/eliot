// Les personnages de la bibliothèque (étape 3) : Open Peeps et Humaaans, deux collections de
// Pablo Stanley sous licence CC0. Elles ne viennent pas d'un paquet npm : Alexandre télécharge
// les deux archives (.zip) sur openpeeps.com et humaaans.com et les range dans
// `Eliot/telechargements/`, hors git. Ce module les lit sans rien décompresser sur le disque.
//
// Il écrit dans `public/bibliotheque/personnages/` :
//   catalogue.json               collections, catégories, cadrage de chaque dessin, pièces à
//                                assembler et leurs places
//   <collection>-<categorie>.json  les personnages tout faits (nom → contenu SVG)
//   <collection>-pieces.json     les pièces détachées du composeur (groupe → nom → contenu)
//
// Chaque SVG est nettoyé (titres, commentaires, identifiants inutiles, nombres arrondis) et
// mesuré : sa boîte réelle sert de cadrage, sans le vide autour. Dans les Open Peeps, les
// fonds coloriables (« 🎨 ») et l'encre (« 🖍 ») sont marqués `data-c` pour que l'interface
// change la couleur d'une partie (tête, vêtements, trait) sans toucher aux autres.

import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

// ----------------------------------------------------------------------------------------
// Archives zip, lues en mémoire
// ----------------------------------------------------------------------------------------

/** Le sommaire d'une archive zip et de quoi lire chaque fichier (stocké ou « deflate »). */
export function lireZip(octets) {
  let fin = octets.length - 22;
  while (fin >= 0 && octets.readUInt32LE(fin) !== 0x06054b50) fin--;
  if (fin < 0) throw new Error("archive zip illisible (fin de sommaire introuvable)");
  const nombre = octets.readUInt16LE(fin + 10);
  let pos = octets.readUInt32LE(fin + 16);
  const fichiers = new Map();
  for (let i = 0; i < nombre; i++) {
    if (octets.readUInt32LE(pos) !== 0x02014b50) throw new Error("archive zip abîmée (sommaire)");
    const methode = octets.readUInt16LE(pos + 10);
    const taille = octets.readUInt32LE(pos + 20);
    const longNom = octets.readUInt16LE(pos + 28);
    const longExtra = octets.readUInt16LE(pos + 30);
    const longCommentaire = octets.readUInt16LE(pos + 32);
    const local = octets.readUInt32LE(pos + 42);
    const nom = octets.toString("utf8", pos + 46, pos + 46 + longNom);
    pos += 46 + longNom + longExtra + longCommentaire;
    fichiers.set(nom, { methode, taille, local });
  }
  return {
    noms: [...fichiers.keys()],
    lire(nom) {
      const f = fichiers.get(nom);
      if (!f) throw new Error(`absent de l'archive : ${nom}`);
      if (octets.readUInt32LE(f.local) !== 0x04034b50) throw new Error(`archive zip abîmée (${nom})`);
      const debut = f.local + 30 + octets.readUInt16LE(f.local + 26) + octets.readUInt16LE(f.local + 28);
      const brut = octets.subarray(debut, debut + f.taille);
      if (f.methode === 0) return brut;
      if (f.methode === 8) return zlib.inflateRawSync(brut);
      throw new Error(`${nom} : compression ${f.methode} non prise en charge`);
    },
  };
}

// ----------------------------------------------------------------------------------------
// SVG : lecture, mesure, réécriture
// ----------------------------------------------------------------------------------------

/** Un arbre très simple (balise, attributs, enfants) ; le texte des balises est ignoré. */
export function analyserSvg(source) {
  const racine = { balise: "#racine", attributs: {}, enfants: [] };
  const pile = [racine];
  const balises = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<(\/?)([a-zA-Z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  const attribut = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (const m of source.matchAll(balises)) {
    if (!m[2]) continue;
    if (m[1]) {
      if (pile.length > 1) pile.pop();
      continue;
    }
    const attributs = {};
    for (const a of m[3].matchAll(attribut)) attributs[a[1]] = a[2] ?? a[3];
    const noeud = { balise: m[2], attributs, enfants: [] };
    pile[pile.length - 1].enfants.push(noeud);
    if (!m[4]) pile.push(noeud);
  }
  const svg = racine.enfants.find((n) => n.balise === "svg");
  if (!svg) throw new Error("pas de balise <svg>");
  return svg;
}

const IDENTITE = [1, 0, 0, 1, 0, 0];
const multiplier = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const appliquer = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** La matrice d'un attribut `transform` (translate, rotate, scale, matrix). */
export function matrice(transform) {
  let m = IDENTITE;
  for (const t of (transform ?? "").matchAll(/(translate|rotate|scale|matrix)\s*\(([^)]*)\)/g)) {
    const v = t[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let n = IDENTITE;
    if (t[1] === "translate") n = [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0];
    else if (t[1] === "scale") n = [v[0], 0, 0, v[1] ?? v[0], 0, 0];
    else if (t[1] === "matrix") n = v.slice(0, 6);
    else {
      const a = ((v[0] ?? 0) * Math.PI) / 180;
      const [c, s] = [Math.cos(a), Math.sin(a)];
      n = [c, s, -s, c, 0, 0];
      if (v.length >= 3) n = multiplier(multiplier([1, 0, 0, 1, v[1], v[2]], n), [1, 0, 0, 1, -v[1], -v[2]]);
    }
    m = multiplier(m, n);
  }
  return m;
}

/** Les points d'un tracé `d` (courbes échantillonnées), dans le repère du tracé. */
export function pointsTrace(d) {
  const points = [];
  const jetons = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
  let i = 0;
  let cmd = "";
  let [x, y, x0, y0] = [0, 0, 0, 0];
  let [cx, cy] = [0, 0];
  const lire = () => Number(jetons[i++]);
  const cubique = (x1, y1, x2, y2, x3, y3) => {
    for (let k = 1; k <= 12; k++) {
      const t = k / 12;
      const u = 1 - t;
      points.push([u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]);
    }
    [cx, cy, x, y] = [x2, y2, x3, y3];
  };
  while (i < jetons.length) {
    if (/[a-zA-Z]/.test(jetons[i])) cmd = jetons[i++];
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case "M":
        [x, y] = [ox + lire(), oy + lire()];
        [x0, y0] = [x, y];
        points.push([x, y]);
        cmd = rel ? "l" : "L";
        break;
      case "L":
        [x, y] = [ox + lire(), oy + lire()];
        points.push([x, y]);
        break;
      case "H":
        x = ox + lire();
        points.push([x, y]);
        break;
      case "V":
        y = oy + lire();
        points.push([x, y]);
        break;
      case "C":
        cubique(ox + lire(), oy + lire(), ox + lire(), oy + lire(), ox + lire(), oy + lire());
        break;
      case "S": {
        const [x1, y1] = [2 * x - cx, 2 * y - cy];
        cubique(x1, y1, ox + lire(), oy + lire(), ox + lire(), oy + lire());
        break;
      }
      case "Q": {
        const [qx, qy, ex, ey] = [ox + lire(), oy + lire(), ox + lire(), oy + lire()];
        cubique(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey);
        break;
      }
      case "A": {
        // Arc : ses extrémités et son rayon suffisent pour une boîte un peu large.
        const [rx, ry] = [lire(), lire()];
        i += 3;
        const [ex, ey] = [ox + lire(), oy + lire()];
        const r = Math.max(rx, ry);
        points.push([x - r, y - r], [x + r, y + r], [ex, ey]);
        [x, y] = [ex, ey];
        break;
      }
      case "Z":
        [x, y] = [x0, y0];
        break;
      default:
        i++;
    }
  }
  return points;
}

const nombre = (v, defaut = 0) => (v === undefined ? defaut : Number.parseFloat(v));

/** Les points d'une forme simple, dans son repère. */
function pointsForme(n) {
  const a = n.attributs;
  switch (n.balise) {
    case "path":
      return pointsTrace(a.d ?? "");
    case "rect": {
      const [x, y, l, h] = [nombre(a.x), nombre(a.y), nombre(a.width), nombre(a.height)];
      return [[x, y], [x + l, y + h]];
    }
    case "circle":
    case "ellipse": {
      const [cx, cy] = [nombre(a.cx), nombre(a.cy)];
      const [rx, ry] = n.balise === "circle" ? [nombre(a.r), nombre(a.r)] : [nombre(a.rx), nombre(a.ry)];
      // Douze points du contour : tient compte d'une rotation éventuelle.
      return Array.from({ length: 24 }, (_, k) => [cx + rx * Math.cos((k * Math.PI) / 12), cy + ry * Math.sin((k * Math.PI) / 12)]);
    }
    case "polygon":
    case "polyline": {
      const v = (a.points ?? "").split(/[\s,]+/).filter(Boolean).map(Number);
      const p = [];
      for (let k = 0; k + 1 < v.length; k += 2) p.push([v[k], v[k + 1]]);
      return p;
    }
    case "line":
      return [[nombre(a.x1), nombre(a.y1)], [nombre(a.x2), nombre(a.y2)]];
    default:
      return [];
  }
}

const INVISIBLES = new Set(["defs", "mask", "clipPath", "symbol", "title", "desc", "metadata", "linearGradient", "radialGradient"]);

/** La boîte de ce qui se voit dans un nœud : [x, y, largeur, hauteur] ou null. */
export function boiteSvg(svg) {
  const parId = new Map();
  const indexer = (n) => {
    if (n.attributs.id) parId.set(n.attributs.id, n);
    n.enfants.forEach(indexer);
  };
  indexer(svg);
  let [x1, y1, x2, y2] = [Infinity, Infinity, -Infinity, -Infinity];
  const parcourir = (n, m, remplissage, trait) => {
    if (INVISIBLES.has(n.balise)) return;
    const a = n.attributs;
    if (a.display === "none" || a.opacity === "0") return;
    const mm = a.transform ? multiplier(m, matrice(a.transform)) : m;
    const fill = a.fill ?? remplissage;
    const stroke = a.stroke ?? trait;
    if (n.balise === "use") {
      const cible = parId.get((a["xlink:href"] ?? a.href ?? "").replace(/^#/, ""));
      if (cible) parcourir(cible, multiplier(mm, [1, 0, 0, 1, nombre(a.x), nombre(a.y)]), fill, stroke);
      return;
    }
    const visible = fill !== "none" || (stroke && stroke !== "none");
    if (visible) {
      const marge = stroke && stroke !== "none" ? nombre(a["stroke-width"], 1) / 2 : 0;
      for (const [px, py] of pointsForme(n)) {
        const [qx, qy] = appliquer(mm, px, py);
        x1 = Math.min(x1, qx - marge);
        y1 = Math.min(y1, qy - marge);
        x2 = Math.max(x2, qx + marge);
        y2 = Math.max(y2, qy + marge);
      }
    }
    for (const e of n.enfants) parcourir(e, mm, fill, stroke);
  };
  // Remplissage noir par défaut, comme dans un navigateur.
  for (const e of svg.enfants) parcourir(e, IDENTITE, svg.attributs.fill ?? "#000000", svg.attributs.stroke);
  return x1 === Infinity ? null : [x1, y1, x2 - x1, y2 - y1];
}

/** La zone de dessin d'un fichier (son viewBox, sinon largeur et hauteur). */
export function zoneSvg(svg) {
  const v = (svg.attributs.viewBox ?? "").split(/[\s,]+/).filter(Boolean).map(Number);
  if (v.length === 4) return v;
  return [0, 0, nombre(svg.attributs.width), nombre(svg.attributs.height)];
}

const arrondir = (v, decimales) => {
  const r = Number(v.toFixed(decimales));
  return Object.is(r, -0) ? 0 : r;
};

/** Arrondit tous les nombres d'une valeur d'attribut géométrique. */
const arrondirNombres = (texte, decimales) => texte.replace(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi, (n) => String(arrondir(Number(n), decimales)));

/** `#abc` ou `#AABBCC` → `#AABBCC` ; le reste tel quel. */
export function hexNormalise(c) {
  if (typeof c !== "string") return c;
  const t = c.trim();
  if (/^#[0-9a-f]{3}$/i.test(t)) return `#${t.slice(1).split("").map((x) => x + x).join("")}`.toUpperCase();
  if (/^#[0-9a-f]{6}$/i.test(t)) return t.toUpperCase();
  return t;
}

const GEOMETRIQUES = new Set(["d", "points", "transform", "x", "y", "width", "height", "cx", "cy", "r", "rx", "ry", "x1", "y1", "x2", "y2", "stroke-width"]);
const GARDES = new Set(["d", "points", "transform", "x", "y", "width", "height", "cx", "cy", "r", "rx", "ry", "x1", "y1", "x2", "y2", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "fill-rule", "clip-rule", "opacity", "fill-opacity", "stroke-opacity", "mask", "xlink:href", "href", "id", "maskUnits", "maskContentUnits"]);

/** L'emplacement d'une partie d'un Open Peep, d'après le nom de son groupe (`head/Bangs`…). */
function emplacementDuGroupe(id) {
  if (!id) return undefined;
  if (/^(body|pose)\//.test(id)) return "corps";
  if (/^head\//.test(id)) return "tete";
  if (/^facial-hair\//.test(id)) return "barbe";
  if (/^accessories\//.test(id)) return "accessoire";
  return undefined;
}

/**
 * Le contenu d'un SVG (sans la balise `<svg>`), nettoyé : titres, commentaires et attributs de
 * Sketch retirés, nombres arrondis, couleurs en `#RRGGBB`. Les identifiants utilisés par un
 * masque ou un `<use>` sont gardés, préfixés par `prefixe` pour ne jamais entrer en collision
 * quand des pièces sont assemblées. `marquer` : repérer fonds (🎨) et encre (🖍) des Open Peeps,
 * avec `emplacement` pour une pièce détachée (sinon déduit des groupes du dessin).
 */
export function contenuSvg(svg, { prefixe, decimales = 2, marquer = false, emplacement } = {}) {
  const references = new Set();
  const chercher = (n) => {
    for (const [k, v] of Object.entries(n.attributs)) {
      if (k === "xlink:href" || k === "href") references.add(v.replace(/^#/, ""));
      for (const m of v.matchAll(/url\(#([^)]+)\)/g)) references.add(m[1]);
    }
    n.enfants.forEach(chercher);
  };
  chercher(svg);
  const nouvelId = (id) => `${prefixe}${[...references].indexOf(id)}`;

  const ecrire = (n, remplissage, place) => {
    if (n.balise === "title" || n.balise === "desc" || n.balise === "metadata") return "";
    const a = n.attributs;
    const ici = emplacementDuGroupe(a.id) ?? place;
    const fill = a.fill !== undefined ? hexNormalise(a.fill) : remplissage;
    const sortie = [];
    let marque;
    if (marquer && a.id?.startsWith("🎨") && ici && fill && fill !== "none") marque = `f-${ici}`;
    if (marquer && a.id?.startsWith("🖍") && fill && fill !== "none") marque = "i";
    if (marque) sortie.push(["fill", fill], ["data-c", marque]);
    for (const [k, v] of Object.entries(a)) {
      if (!GARDES.has(k)) continue;
      if (k === "fill" && marque) continue;
      if (k === "id") {
        if (references.has(v)) sortie.push(["id", nouvelId(v)]);
        continue;
      }
      let valeur = v;
      if (k === "fill" || k === "stroke") valeur = hexNormalise(v);
      if (GEOMETRIQUES.has(k)) valeur = arrondirNombres(v, decimales);
      if (k === "xlink:href" || k === "href") valeur = `#${nouvelId(v.replace(/^#/, ""))}`;
      valeur = valeur.replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${nouvelId(id)})`);
      sortie.push([k, valeur]);
    }
    const attributs = sortie.map(([k, v]) => ` ${k}="${v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")}"`).join("");
    const enfants = n.enfants.map((e) => ecrire(e, fill, ici)).join("");
    // Un groupe vide ne dessine rien : on le saute.
    if (n.balise === "g" && !enfants) return "";
    return enfants ? `<${n.balise}${attributs}>${enfants}</${n.balise}>` : `<${n.balise}${attributs}/>`;
  };
  return svg.enfants.map((e) => ecrire(e, hexNormalise(svg.attributs.fill), emplacement)).join("");
}

/** Une boîte agrandie d'une petite marge, puis limitée à `limite` si elle est donnée. */
function cadrer(boite, limite, decimales) {
  let [x, y, l, h] = boite;
  const marge = Math.max(l, h) * 0.006;
  [x, y, l, h] = [x - marge, y - marge, l + 2 * marge, h + 2 * marge];
  if (limite) {
    const [lx, ly, ll, lh] = limite;
    const [x2, y2] = [Math.min(x + l, lx + ll), Math.min(y + h, ly + lh)];
    [x, y] = [Math.max(x, lx), Math.max(y, ly)];
    [l, h] = [x2 - x, y2 - y];
  }
  return [arrondir(x, decimales), arrondir(y, decimales), arrondir(l, decimales), arrondir(h, decimales)];
}

// ----------------------------------------------------------------------------------------
// Les deux collections
// ----------------------------------------------------------------------------------------

const slug = (nom) =>
  nom
    .replace(/^\*\s*/, "")
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const numero = (nom) => Number((nom.match(/(\d+)(?!.*\d)/) ?? [0, 0])[1]);
const parNumero = (a, b) => a.replace(/\d+/g, "").localeCompare(b.replace(/\d+/g, ""), "fr") || numero(a) - numero(b);

/** Libellés français des pièces détachées (nom d'origine → libellé). */
const LIBELLES = {
  // Open Peeps, coiffures
  Afro: "Afro", "Bangs 2": "Frange 2", Bangs: "Frange", "Bantu Knots": "Nœuds bantous", Bear: "Bonnet ourson", "Bun 2": "Chignon 2", Bun: "Chignon", Buns: "Deux chignons",
  "Cornrows 2": "Tresses collées 2", Cornrows: "Tresses collées", "Flat Top Long": "Brosse longue", "Flat Top": "Brosse", "Gray Bun": "Chignon gris", "Gray Medium": "Mi-longs gris",
  "Gray Short": "Courts gris", Hijab: "Hijab", "Long Afro": "Afro long", "Long Bangs": "Longs à frange", "Long Curly": "Longs bouclés", Long: "Longs", "Medium 1": "Mi-longs 1",
  "Medium 2": "Mi-longs 2", "Medium 3": "Mi-longs 3", "Medium Bangs 2": "Mi-longs à frange 2", "Medium Bangs 3": "Mi-longs à frange 3", "Medium Bangs": "Mi-longs à frange",
  "Medium Straight": "Mi-longs raides", "Mohawk 2": "Crête 2", Mohawk: "Crête", "No Hair 1": "Chauve 1", "No Hair 2": "Chauve 2", "No Hair 3": "Chauve 3", Pomp: "Banane",
  "Shaved 1": "Rasé 1", "Shaved 2": "Rasé 2", "Shaved 3": "Rasé 3", "Short 1": "Courts 1", "Short 2": "Courts 2", "Short 3": "Courts 3", "Short 4": "Courts 4", "Short 5": "Courts 5",
  Turban: "Turban", "Twists 2": "Vanilles 2", Twists: "Vanilles", "hat-beanie": "Bonnet", "hat-hip": "Chapeau",
  // Open Peeps, visages
  "Angry with Fang": "En colère", Awe: "Émerveillé", Blank: "Neutre", Calm: "Calme", Cheeky: "Coquin", "Concerned Fear": "Inquiet, apeuré", Concerned: "Inquiet", Contempt: "Méprisant",
  Cute: "Mignon", Cyclops: "Cyclope", Driven: "Déterminé", "Eating Happy": "Gourmand", Explaining: "Explique", "Eyes Closed": "Yeux fermés", Fear: "Peur", Hectic: "Débordé",
  "Loving Grin 1": "Sourire tendre 1", "Loving Grin 2": "Sourire tendre 2", Monster: "Monstre", Old: "Âgé", Rage: "Rage", Serious: "Sérieux", "Smile Big": "Grand sourire",
  "Smile LOL": "Mort de rire", "Smile Teeth Gap": "Dents du bonheur", Smile: "Sourire", Solemn: "Solennel", Suspicious: "Soupçonneux", Tired: "Fatigué", "Very Angry": "Furieux",
  // Open Peeps, barbes et accessoires
  Chin: "Collier", "Full 2": "Barbe 2", "Full 3": "Barbe 3", "Full 4": "Barbe 4", Full: "Barbe", "Goatee 1": "Bouc 1", "Goatee 2": "Bouc 2",
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`Moustache ${i + 1}`, `Moustache ${i + 1}`])),
  Eyepatch: "Cache-œil", "Glasses 2": "Lunettes 2", "Glasses 3": "Lunettes 3", "Glasses 4": "Lunettes 4", "Glasses 5": "Lunettes 5", Glasses: "Lunettes",
  "Sunglasses 2": "Lunettes de soleil 2", Sunglasses: "Lunettes de soleil",
  // Open Peeps, bustes
  "Blazer Black Tee": "Blazer et tee-shirt", "Button Shirt 1": "Chemise 1", "Button Shirt 2": "Chemise 2", Coffee: "Avec un café", Device: "Avec un téléphone", Dress: "Robe",
  "Fur Jacket": "Veste fourrée", Gaming: "Manette de jeu", "Gym Shirt": "Débardeur", Hoodie: "Sweat à capuche", Killer: "Avec un couteau", Macbook: "Avec un ordinateur",
  Paper: "Avec une feuille", "Pointing Up": "Montre le haut", "Polka Dot Jacket": "Veste à pois", "Polo and Sweater": "Polo et pull", "Shirt and Coat": "Chemise et manteau",
  "Sporty Tee": "Tee-shirt sport", "Striped Pocket Tee": "Rayures et poche", "Striped Tee": "Tee-shirt rayé", "Sweater Dots": "Pull à pois", Sweater: "Pull", "Tee 1": "Tee-shirt 1",
  "Tee 2": "Tee-shirt 2", "Tee Arms Crossed": "Bras croisés", "Tee Selena": "Tee-shirt 3", "Thunder T-Shirt": "Tee-shirt éclair", Turtleneck: "Col roulé", Whatever: "Bof",
  // Open Peeps, poses
  "blazer-1": "Blazer 1", "blazer-2": "Blazer 2", "blazer-3": "Blazer 3", "blazer-4": "Blazer 4", "crossed_arms-1": "Bras croisés 1", "crossed_arms-2": "Bras croisés 2",
  "easing-1": "Détendu 1", "easing-2": "Détendu 2", "pointing_finger-1": "Montre du doigt 1", "pointing_finger-2": "Montre du doigt 2", polka_dots: "Robe à pois",
  "resting-1": "Au repos 1", "resting-2": "Au repos 2", "robot_dance-1": "Danse robot 1", "robot_dance-2": "Danse robot 2", "robot_dance-3": "Danse robot 3",
  "shirt-1": "Chemise 1", "shirt-2": "Chemise 2", "shirt-3": "Chemise 3", "shirt-4": "Chemise 4", "walking-1": "Marche 1", "walking-2": "Marche 2", "walking-3": "Marche 3",
  bike: "À vélo", "closed_legs-1": "Jambes serrées 1", "closed_legs-2": "Jambes serrées 2", crossed_legs: "Jambes croisées", "hands_back-1": "Mains derrière 1",
  "hands_back-2": "Mains derrière 2", "mid-1": "Assis 1", "mid-2": "Assis 2", "one_leg_up-1": "Jambe repliée 1", "one_leg_up-2": "Jambe repliée 2", wheelchair: "Fauteuil roulant",
  // Humaaans
  Airy: "Aérés", Caesar: "Coupe César", Chongo: "Chignon bas", Curly: "Bouclés", "Hijab 1": "Hijab 1", Hijab2: "Hijab 2", "No Hair": "Chauve", Pony: "Queue-de-cheval",
  Rad: "Rasé sur le côté", "Short Beard": "Courts et barbe", Top: "Chignon haut", "Turban 1": "Turban 1", Turban2: "Turban 2", Wavy: "Ondulés",
  "Jacket 2": "Veste 2", Jacket: "Veste", "Lab Coat": "Blouse", "Long Sleeve": "Manches longues", "Pointing Forward": "Montre devant", Pregnant: "Enceinte",
  "Trench Coat": "Trench", "Turtle Neck": "Col roulé", "Baggy Pants": "Pantalon large", Jogging: "Course", Shorts: "Short", "Skinny Jeans Walk": "Jean, en marche",
  "Skinny Jeans": "Jean", "Skinny Jeans 1": "Jean", Skirt: "Jupe", Sprint: "Sprint", Sweatpants: "Jogging", "Sweat Pants": "Jogging", Wheelchair: "Fauteuil roulant",
  Ball: "Ballon", "Cube 2": "Cube 2", Cube: "Cube",
};

/** Libellé d'une pièce : en français si connu, sinon le nom d'origine lisible. */
const libelle = (nom, groupe) => {
  // « Hoodie », « Pointing Up »… existent dans les deux collections, avec le même sens.
  if (groupe === "haut" && nom === "Pointing Up") return "Montre le haut";
  return LIBELLES[nom] ?? nom.replace(/[_-]+/g, " ");
};

const MOTS_PERSONNAGE = "personnage personnages personne personnes gens humain humains homme femme illustration avatar mascotte people character";

/** Ce que chaque collection prend dans son archive. */
const COLLECTIONS = [
  {
    id: "open-peeps",
    libelle: "Open Peeps",
    style: "Dessin au trait, à colorier",
    auteur: "Pablo Stanley",
    licence: "CC0-1.0",
    lien: "https://www.openpeeps.com",
    reconnaitre: (noms) => noms.some((n) => n.includes("Separate Atoms/head/")),
    marquer: true,
    categories: [
      { id: "buste", libelle: "Bustes", mots: "buste portrait tete visage bust", dossier: "Templates/Bust/", nom: (f) => `buste-${numero(f)}` },
      { id: "debout", libelle: "Debout", mots: "debout corps entier marche standing", dossier: "Templates/Standing/", nom: (f) => `debout-${numero(f)}` },
      { id: "assis", libelle: "Assis", mots: "assis assise chaise bureau sitting", dossier: "Templates/Sitting/", nom: (f) => `assis-${numero(f)}` },
      {
        id: "sante",
        libelle: "Masques et soignants",
        mots: "masque masques covid soignant soignants medecin infirmier infirmiere sante hopital docteur",
        dossier: "Templates/covid-19/SVG/",
        nom: (f) => {
          const n = numero(f);
          if (f.startsWith("bust-mask")) return `masque-buste-${n}`;
          if (f.startsWith("pose-mask")) return `masque-debout-${n}`;
          if (f.startsWith("sit-mask")) return `masque-assis-${n}`;
          return `soignant-${n}`;
        },
      },
    ],
    pieces: {
      tete: "Separate Atoms/head/",
      visage: "Separate Atoms/face/",
      barbe: "Separate Atoms/facial-hair/",
      accessoire: "Separate Atoms/accessories/",
      "corps-buste": "Separate Atoms/body/",
      "corps-debout": "Separate Atoms/pose/standing/",
      "corps-assis": "Separate Atoms/pose/sitting/",
    },
    // Places relevées dans les modèles de l'archive (« Separate Atoms/a person/ »). La tête,
    // le visage, la barbe et l'accessoire se placent par rapport au coin de la tête.
    postures: (() => {
      const tete = (x, y) => [
        { id: "tete", groupe: "tete", x, y },
        { id: "visage", groupe: "visage", x: x + 159, y: y + 186 },
        { id: "barbe", groupe: "barbe", x: x + 123, y: y + 338, facultatif: true },
        { id: "accessoire", groupe: "accessoire", x: x + 47, y: y + 241, facultatif: true },
      ];
      return [
        { id: "buste", libelle: "Buste", emplacements: [{ id: "corps", groupe: "corps-buste", x: 147, y: 639 }, ...tete(372, 180)], defaut: { corps: "tee-1" } },
        { id: "debout", libelle: "Debout", emplacements: [{ id: "corps", groupe: "corps-debout", x: -121, y: 634 }, ...tete(404, 180)], defaut: { corps: "shirt-1" } },
        { id: "assis", libelle: "Assis", emplacements: [{ id: "corps", groupe: "corps-assis", x: -81, y: 637 }, ...tete(345, 180)], defaut: { corps: "crossed-legs" } },
      ];
    })(),
    emplacements: [
      { id: "corps", libelle: "Tenue" },
      { id: "tete", libelle: "Coiffure" },
      { id: "visage", libelle: "Visage" },
      { id: "barbe", libelle: "Barbe" },
      { id: "accessoire", libelle: "Lunettes" },
    ],
    // Couleurs réglables par partie : le trait et le fond de chaque pièce.
    couleurs: [
      { id: "trait", libelle: "Trait", defaut: "#000000" },
      { id: "tete", libelle: "Tête", defaut: "#FFFFFF" },
      { id: "corps", libelle: "Tenue", defaut: "#FFFFFF" },
      { id: "barbe", libelle: "Barbe", defaut: "#FFFFFF" },
      { id: "accessoire", libelle: "Lunettes", defaut: "#FFFFFF" },
    ],
    defaut: { posture: "buste", pieces: { tete: "short-2", visage: "smile" } },
  },
  {
    id: "humaaans",
    libelle: "Humaaans",
    style: "Aplats de couleur",
    auteur: "Pablo Stanley",
    licence: "CC0-1.0",
    lien: "https://www.humaaans.com",
    reconnaitre: (noms) => noms.some((n) => n.includes("Single Pieces/Head/Front/")),
    marquer: false,
    categories: [
      { id: "debout", libelle: "Debout", mots: "debout corps entier marche standing", dossier: "Humaaans/standing-", nom: (f) => `debout-${numero(f)}` },
      { id: "assis", libelle: "Assis", mots: "assis assise chaise bureau sitting", dossier: "Humaaans/sitting-", nom: (f) => `assis-${numero(f)}` },
      {
        id: "decor",
        libelle: "Décors",
        mots: "decor decors scene maison plante plantes tableau ecran meuble",
        dossier: "Single Pieces/Scene/",
        nom: (f) => `decor-${{ Home: "maison", Plants: "plantes", Whiteboard: "tableau-blanc", Wireframe: "ecran" }[f] ?? slug(f)}`,
        personnage: false,
      },
    ],
    pieces: {
      tete: "Single Pieces/Head/Front/",
      haut: "Single Pieces/Body/",
      "bas-debout": "Single Pieces/Bottom/Standing/",
      "bas-assis": "Single Pieces/Bottom/Sitting/",
      siege: "Single Pieces/Objects/Seat/",
    },
    // Places relevées dans les personnages tout faits de l'archive (les plus courantes).
    postures: [
      {
        id: "debout",
        libelle: "Debout",
        emplacements: [
          { id: "tete", groupe: "tete", x: 82, y: 0 },
          { id: "bas", groupe: "bas-debout", x: 0, y: 187 },
          { id: "haut", groupe: "haut", x: 22, y: 82 },
        ],
        defaut: { bas: "skinny-jeans" },
      },
      {
        id: "assis",
        libelle: "Assis",
        emplacements: [
          { id: "tete", groupe: "tete", x: 82, y: 0 },
          { id: "siege", groupe: "siege", x: 10, y: 229, facultatif: true },
          { id: "bas", groupe: "bas-assis", x: 0, y: 187 },
          { id: "haut", groupe: "haut", x: 22, y: 82 },
        ],
        defaut: { bas: "sweat-pants", siege: "cube" },
      },
    ],
    emplacements: [
      { id: "tete", libelle: "Coiffure" },
      { id: "haut", libelle: "Haut" },
      { id: "bas", libelle: "Bas" },
      { id: "siege", libelle: "Siège" },
    ],
    couleurs: [],
    defaut: { posture: "debout", pieces: { tete: "short-1", haut: "hoodie" } },
  },
];

/** Assez de décimales pour rester net en très grand : 2 pour un petit dessin, 1 au-delà de
 *  1000 unités (les pièces détachées des Open Peeps). */
const decimalesPour = (zone) => (Math.max(zone[2], zone[3]) >= 1000 ? 1 : 2);

/** Les fichiers SVG d'un dossier de l'archive (ou commençant par un préfixe), triés. */
function fichiersSvg(noms, racine, prefixe) {
  return noms
    .filter((n) => !n.includes("__MACOSX") && n.endsWith(".svg"))
    .map((n) => n.slice(n.indexOf(racine)))
    .filter((n) => n.startsWith(`${racine}${prefixe}`) && !n.slice(`${racine}${prefixe}`.length).includes("/"));
}

async function preparerCollection(c, archive, sortie) {
  const racine = "Flat Assets/";
  const lire = (chemin) => archive.lire(archive.noms.find((n) => !n.includes("__MACOSX") && n.endsWith(chemin))).toString("utf8");
  const catalogue = { id: c.id, libelle: c.libelle, style: c.style, auteur: c.auteur, licence: c.licence, lien: c.lien, categories: [], composition: null };
  let compteur = 0;
  let nombre = 0;

  for (const cat of c.categories) {
    const corps = {};
    const elements = [];
    const fichiers = fichiersSvg(archive.noms, racine, cat.dossier).sort(parNumero);
    for (const chemin of fichiers) {
      const fichier = path.basename(chemin, ".svg");
      const nom = cat.nom(fichier);
      const svg = analyserSvg(lire(chemin));
      const zone = zoneSvg(svg);
      const boite = boiteSvg(svg);
      if (!boite) continue;
      const decimales = decimalesPour(zone);
      corps[nom] = contenuSvg(svg, { prefixe: `${c.id[0]}${compteur++}-`, decimales, marquer: c.marquer });
      elements.push({ nom, vue: cadrer(boite, zone, decimales) });
    }
    if (!elements.length) continue;
    nombre += cat.personnage === false ? 0 : elements.length;
    catalogue.categories.push({ id: cat.id, libelle: cat.libelle, mots: `${cat.personnage === false ? "" : MOTS_PERSONNAGE} ${cat.mots}`.trim(), fichier: `${c.id}-${cat.id}.json`, elements });
    await fs.writeFile(path.join(sortie, `${c.id}-${cat.id}.json`), JSON.stringify(corps));
  }

  // Les pièces du composeur : leur boîte réelle, dans leur propre repère.
  const pieces = {};
  const groupes = {};
  let nombrePieces = 0;
  for (const [groupe, dossier] of Object.entries(c.pieces)) {
    pieces[groupe] = {};
    groupes[groupe] = [];
    for (const chemin of fichiersSvg(archive.noms, racine, dossier).sort((a, b) => a.localeCompare(b, "en"))) {
      const original = path.basename(chemin, ".svg");
      if (original.startsWith("*")) continue; // « * None » : l'absence de pièce
      const id = slug(original);
      const svg = analyserSvg(lire(chemin));
      const boite = boiteSvg(svg);
      if (!boite) continue;
      const zone = zoneSvg(svg);
      const decimales = decimalesPour(zone);
      const emplacement = groupe.startsWith("corps") ? "corps" : groupe;
      pieces[groupe][id] = contenuSvg(svg, { prefixe: `${c.id[0]}${compteur++}-`, decimales, marquer: c.marquer, emplacement });
      groupes[groupe].push({ id, libelle: libelle(original, groupe), boite: boite.map((v) => arrondir(v, decimales)) });
      nombrePieces += 1;
    }
  }
  await fs.writeFile(path.join(sortie, `${c.id}-pieces.json`), JSON.stringify(pieces));
  catalogue.composition = { fichier: `${c.id}-pieces.json`, postures: c.postures, emplacements: c.emplacements, couleurs: c.couleurs, defaut: c.defaut, groupes };
  return { catalogue, nombre, nombrePieces };
}

/**
 * Fabrique les personnages dans `sortie/personnages/` depuis les archives de `dossier`.
 * Renvoie ce qui a été fait, ou `absentes` : les collections dont l'archive manque.
 */
export async function preparerPersonnages(sortieBibliotheque, dossier) {
  const sortie = path.join(sortieBibliotheque, "personnages");
  const archives = [];
  if (existsSync(dossier)) {
    for (const f of (await fs.readdir(dossier)).sort()) {
      if (!f.toLowerCase().endsWith(".zip")) continue;
      try {
        archives.push(lireZip(await fs.readFile(path.join(dossier, f))));
      } catch (e) {
        throw new Error(`${f} : ${e.message}`);
      }
    }
  }
  await fs.rm(sortie, { recursive: true, force: true });
  await fs.mkdir(sortie, { recursive: true });
  const collections = [];
  const absentes = [];
  let personnages = 0;
  let pieces = 0;
  for (const c of COLLECTIONS) {
    const archive = archives.find((a) => c.reconnaitre(a.noms));
    if (!archive) {
      absentes.push(c.libelle);
      continue;
    }
    const r = await preparerCollection(c, archive, sortie);
    collections.push(r.catalogue);
    personnages += r.nombre;
    pieces += r.nombrePieces;
  }
  await fs.writeFile(path.join(sortie, "catalogue.json"), JSON.stringify({ version: 1, collections }));
  return { collections: collections.map((c) => c.libelle), personnages, pieces, absentes };
}
