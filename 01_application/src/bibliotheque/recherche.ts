// Recherche par mot dans la bibliothèque (icônes, emojis), en français ou en anglais.
// Les icônes n'ont que des mots-clés anglais : un dictionnaire (`mots_fr.json`) traduit les
// mots français courants. Les emojis ont aussi leurs noms français (CLDR).
// Fonctions pures, testées (`recherche.test.ts`) ; le chargement est dans `bibliotheque.ts`.

/** Une entrée de l'index : collection, nom, mots (normalisés, séparés par des espaces). */
export type EntreeIndex = [collection: string, nom: string, mots: string];

/** Minuscules sans accents ; même règle que `outils/preparer_bibliotheque.mjs`. */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[\u2019']/g, " ")
    .replace(/[^a-z0-9 -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Les termes à chercher pour un mot de la requête : le mot lui-même, ses traductions, et
 *  celles des mots du dictionnaire qui commencent par lui (« vel » trouve « vélo »). */
export function termesPour(mot: string, dictionnaire: Record<string, string[]>): string[] {
  const termes = new Set([mot, ...(dictionnaire[mot] ?? [])]);
  if (mot.length >= 3) {
    for (const [cle, traductions] of Object.entries(dictionnaire)) {
      if (cle !== mot && cle.startsWith(mot)) traductions.forEach((t) => termes.add(t));
    }
  }
  // Les mots composés anglais (`shopping-cart`) se cherchent aussi en morceaux.
  for (const t of [...termes]) if (t.includes("-")) t.split("-").forEach((m) => m.length > 2 && termes.add(m));
  return [...termes];
}

/** Note d'un mot de requête pour une entrée : 0 s'il ne s'y trouve pas. */
function noteMot(termes: string[], mots: string[], nom: string): number {
  let meilleure = 0;
  const motsDuNom = nom.split(" ");
  for (const terme of termes) {
    if (nom === terme) return 10;
    // Le mot est dans le nom même du dessin (« heart » dans « red heart ») : très parlant.
    if (motsDuNom.includes(terme)) meilleure = Math.max(meilleure, 6);
    for (const m of mots) {
      if (m === terme) meilleure = Math.max(meilleure, 4);
      else if (m.startsWith(terme)) meilleure = Math.max(meilleure, 2);
    }
  }
  return meilleure;
}

/**
 * Les entrées qui contiennent tous les mots de la requête, les meilleures d'abord. `filtre`
 * limite aux collections voulues (icônes ou emojis, par exemple).
 */
export function chercher(index: EntreeIndex[], requete: string, dictionnaire: Record<string, string[]>, filtre?: (collection: string) => boolean): EntreeIndex[] {
  const mots = normaliser(requete).split(" ").filter(Boolean);
  if (mots.length === 0) return [];
  const termes = mots.map((m) => termesPour(m, dictionnaire));
  const notes: { entree: EntreeIndex; note: number; rang: number }[] = [];
  index.forEach((entree, rang) => {
    if (filtre && !filtre(entree[0])) return;
    const motsEntree = entree[2].split(" ");
    const nom = entree[1].replace(/-/g, " ");
    let total = 0;
    for (const t of termes) {
      const n = noteMot(t, motsEntree, nom);
      if (n === 0) return;
      total += n;
    }
    // À note égale, le dessin le plus simple d'abord : un nom court (« home » avant
    // « home-dollar »), puis le moins de mots-clés. Les noms en code (OpenMoji) comptent long.
    const longueurNom = /^[0-9a-f-]+$/.test(entree[1]) ? 12 : entree[1].length;
    notes.push({ entree, note: total - longueurNom / 100 - motsEntree.length / 1000, rang });
  });
  notes.sort((a, b) => b.note - a.note || a.rang - b.rang);
  return notes.map((n) => n.entree);
}
