// Outils de mesure : cadence d'affichage, durées, médianes.

export interface Statistiques {
  images: number;
  dureeMs: number;
  imagesParSeconde: number;
  dureeImageP50: number;
  dureeImageP95: number;
  dureeImageMax: number;
  /** Images de plus de 33 ms : l'œil voit l'à-coup (moins de 30 images/s à cet instant). */
  acoups: number;
  /** Temps passé dans le dessin Konva lui-même (JavaScript), hors composition par le moteur. */
  dessinMoyenMs: number;
}

const arrondir = (valeur: number, decimales = 1): number => {
  const facteur = 10 ** decimales;
  return Math.round(valeur * facteur) / facteur;
};

export function centile(valeurs: number[], p: number): number {
  if (valeurs.length === 0) return 0;
  const tries = [...valeurs].sort((a, b) => a - b);
  const rang = Math.min(tries.length - 1, Math.max(0, Math.ceil((p / 100) * tries.length) - 1));
  return tries[rang];
}

export const mediane = (valeurs: number[]): number => centile(valeurs, 50);

const prochaineImage = (): Promise<number> =>
  new Promise((resoudre) => requestAnimationFrame(resoudre));

/** Fréquence de rafraîchissement de l'écran, mesurée sans rien dessiner. */
export async function mesurerFrequence(dureeMs = 1500): Promise<number> {
  const intervalles: number[] = [];
  let precedent = await prochaineImage();
  const debut = precedent;
  while (precedent - debut < dureeMs) {
    const maintenant = await prochaineImage();
    intervalles.push(maintenant - precedent);
    precedent = maintenant;
  }
  return arrondir(1000 / mediane(intervalles), 0);
}

/**
 * Appelle `animer` puis `dessiner` à chaque image pendant `dureeMs`, après un temps de chauffe
 * qui n'entre pas dans les statistiques (chargement des textures, compilation à la volée).
 */
export async function mesurerAnimation(
  dureeMs: number,
  animer: (ecouleMs: number) => void,
  dessiner: () => void,
  chauffeMs = 400,
): Promise<Statistiques> {
  const intervalles: number[] = [];
  const dessins: number[] = [];
  const debut = await prochaineImage();
  let precedent = debut;
  let debutMesure = -1;

  for (;;) {
    const maintenant = await prochaineImage();
    const ecoule = maintenant - debut;
    animer(ecoule);
    const t0 = performance.now();
    dessiner();
    const tempsDessin = performance.now() - t0;

    if (ecoule >= chauffeMs) {
      if (debutMesure < 0) {
        debutMesure = maintenant;
      } else {
        intervalles.push(maintenant - precedent);
        dessins.push(tempsDessin);
      }
    }
    precedent = maintenant;
    if (debutMesure >= 0 && maintenant - debutMesure >= dureeMs) break;
  }

  const total = intervalles.reduce((a, b) => a + b, 0);
  return {
    images: intervalles.length,
    dureeMs: arrondir(total, 0),
    imagesParSeconde: arrondir((intervalles.length * 1000) / total),
    dureeImageP50: arrondir(centile(intervalles, 50)),
    dureeImageP95: arrondir(centile(intervalles, 95)),
    dureeImageMax: arrondir(Math.max(...intervalles)),
    acoups: intervalles.filter((d) => d > 33.4).length,
    dessinMoyenMs: arrondir(dessins.reduce((a, b) => a + b, 0) / Math.max(1, dessins.length), 2),
  };
}

/** Exécute `travail` plusieurs fois et garde la durée médiane, en millisecondes. */
export async function chronometrer<T>(
  repetitions: number,
  travail: () => Promise<T>,
): Promise<{ medianeMs: number; dernier: T }> {
  const durees: number[] = [];
  let dernier!: T;
  for (let i = 0; i < repetitions; i++) {
    const t0 = performance.now();
    dernier = await travail();
    durees.push(performance.now() - t0);
    await prochaineImage();
  }
  return { medianeMs: arrondir(mediane(durees)), dernier };
}

export type Verdict = "fluide" | "correct" | "saccadé";

/**
 * Règle de lecture, proposée par Claude le 2026-10-14 :
 * fluide si on tient au moins 90 % de la fréquence de l'écran (ou 55 images/s sur un écran
 * rapide) avec un 95e centile sous 25 ms ; correct au-dessus de 30 images/s ; saccadé sinon.
 */
export function juger(stats: Statistiques, frequenceHz: number): Verdict {
  const seuilFluide = Math.min(0.9 * frequenceHz, 55);
  if (stats.imagesParSeconde >= seuilFluide && stats.dureeImageP95 <= 25) return "fluide";
  if (stats.imagesParSeconde >= 30) return "correct";
  return "saccadé";
}
