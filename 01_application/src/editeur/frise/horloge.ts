// L'horloge de la lecture : tant que la page joue, la tête de lecture avance avec le temps
// réel, image après image, jusqu'au bout de la page. Les vidéos suivent la tête (voir
// `editeur/videos.ts`), elle ne les attend pas. Une tête déplacée pendant la lecture (clic
// sur la règle) repart de là.

import { pageCourante, useEditeur } from "../../etat/editeur";
import { useTemps } from "../../etat/temps";

let image = 0;
let depart = 0;
let teteDepart = 0;
let ecriture = false;

function ecrire(etat: Partial<{ tete: number; joue: boolean; arret: number | null }>) {
  ecriture = true;
  useTemps.setState(etat);
  ecriture = false;
}

function boucle(maintenant: number) {
  if (!useTemps.getState().joue) {
    image = 0;
    return;
  }
  const duree = pageCourante(useEditeur.getState()).duree ?? 0;
  const t = teteDepart + (maintenant - depart);
  const arret = useTemps.getState().arret;
  if (arret !== null && t >= arret && arret < duree - 1) {
    ecrire({ tete: arret, joue: false, arret: null });
    image = 0;
    return;
  }
  if (t >= duree - 1) {
    // Arrêt sur la dernière image (au bout exact, plus rien ne se verrait).
    ecrire({ tete: Math.max(0, duree - 1), joue: false });
    image = 0;
    return;
  }
  ecrire({ tete: Math.round(t) });
  image = requestAnimationFrame(boucle);
}

useTemps.subscribe((s, avant) => {
  if (ecriture) return;
  if (s.joue && !avant.joue) {
    const duree = pageCourante(useEditeur.getState()).duree;
    if (!duree) {
      ecrire({ joue: false });
      return;
    }
    // Au bout de la page, « lire » repart du début.
    if (s.tete >= duree - 2) ecrire({ tete: 0 });
    depart = performance.now();
    teteDepart = useTemps.getState().tete;
    if (!image) image = requestAnimationFrame(boucle);
  } else if (!s.joue && avant.joue) {
    if (image) cancelAnimationFrame(image);
    image = 0;
  } else if (s.joue && s.tete !== avant.tete) {
    depart = performance.now();
    teteDepart = s.tete;
  }
});

/** Pour les essais : la tête et la lecture se pilotent sans horloge. */
export const horloge = { enMarche: () => image !== 0 };
