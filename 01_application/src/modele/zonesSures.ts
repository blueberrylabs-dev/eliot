// Les zones sûres des vidéos verticales (étape 4, lot 4) : là où TikTok, Reels et Shorts posent
// leurs boutons, le nom du compte et la légende. Un texte posé là risque d'être caché. Les
// marges sont données pour une vidéo de 1080 × 1920 et se ramènent à la page en proportion.
// Relevées le 2026-10-15 (sources dans le JOURNAL) ; elles varient avec la longueur de la
// légende et les versions des applications : ce sont des repères, pas des règles exactes.

export type IdZones = "tiktok" | "reels" | "shorts";

/** Une zone que l'application recouvre, en fractions de la page (0 à 1). */
export interface ZoneCachee {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  libelle: string;
}

export interface ZonesSures {
  nom: string;
  zones: ZoneCachee[];
}

const L = 1080;
const H = 1920;

/** Bandes du haut, du bas, de gauche et de droite, en pixels d'une vidéo 1080 × 1920. */
function bandes(haut: number, bas: number, gauche: number, droite: number, libelles: { haut: string; bas: string; droite: string }): ZoneCachee[] {
  return [
    { x: 0, y: 0, largeur: 1, hauteur: haut / H, libelle: libelles.haut },
    { x: 0, y: 1 - bas / H, largeur: 1, hauteur: bas / H, libelle: libelles.bas },
    { x: 0, y: haut / H, largeur: gauche / L, hauteur: 1 - (haut + bas) / H, libelle: "" },
    { x: 1 - droite / L, y: haut / H, largeur: droite / L, hauteur: 1 - (haut + bas) / H, libelle: libelles.droite },
  ];
}

export const ZONES_SURES: Record<IdZones, ZonesSures> = {
  // Modèles de TikTok Ads, relevés par cadenus.io (2026-07-28) : 130 px en haut, 484 en bas,
  // 44 à gauche, 140 à droite.
  tiktok: { nom: "TikTok", zones: bandes(130, 484, 44, 140, { haut: "Onglets", bas: "Nom, légende et son", droite: "Boutons" }) },
  // Meta (aide Reels, relevée par hopperhq.com) : 14 % en haut, 35 % en bas, 6 % sur les côtés,
  // et la colonne des boutons sur le cinquième droit du bas (40 % de la hauteur).
  reels: {
    nom: "Reels",
    zones: [
      ...bandes(0.14 * H, 0.35 * H, 0.06 * L, 0.06 * L, { haut: "Nom du compte", bas: "Légende et son", droite: "" }),
      { x: 0.79, y: 0.6, largeur: 0.21, hauteur: 0.4 - 0.35, libelle: "Boutons" },
    ],
  },
  // Gabarit de Google pour les vidéos verticales, relevé par adkit.so (2026-09-10) : 288 px en
  // haut, 672 en bas, 48 à gauche, 192 à droite.
  shorts: { nom: "Shorts", zones: bandes(288, 672, 48, 192, { haut: "Recherche et menu", bas: "Titre, chaîne et son", droite: "Boutons" }) },
};

/** La page est-elle verticale en 9:16 (à 2 % près) ? Les zones n'ont de sens que là. */
export const estVerticale916 = (format: { largeur: number; hauteur: number }) => Math.abs(format.largeur / format.hauteur - 9 / 16) < 0.02 * (9 / 16);

/** Le rectangle sûr : ce qui reste quand on retire les bandes (fractions de la page). */
export function rectangleSur(id: IdZones): { x: number; y: number; largeur: number; hauteur: number } {
  const z = ZONES_SURES[id].zones;
  const [haut, bas, gauche, droite] = z;
  const x = gauche.largeur;
  const y = haut.hauteur;
  return { x, y, largeur: 1 - x - droite.largeur, hauteur: 1 - y - bas.hauteur };
}
