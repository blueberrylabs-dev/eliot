// Les styles de texte prêts pour la vidéo (étape 4, lot 3) : une police, des couleurs, un
// effet, et des animations d'entrée et de sortie, à la façon des textes de CapCut ou de TikTok.
// Les tailles sont données pour une page de 1080 px de large et suivent le format.

import { dureeConseillee, estAnimationUnites } from "./animation";
import { creerTexte } from "./fabriques";
import type { Animations, ElementTexte, Format } from "./types";

export interface StyleVideo {
  id: string;
  libelle: string;
  /** Le texte posé par défaut. */
  exemple: string;
  /** Taille de police pour une page de 1080 px de large. */
  taille: number;
  police: string;
  /** Couleurs et effets, d'après la taille de police réelle. */
  effets: (taille: number) => Partial<ElementTexte>;
  animations: Animations;
}

export const STYLES_VIDEO: StyleVideo[] = [
  {
    id: "legende",
    libelle: "Légende réseaux",
    exemple: "Attends la fin",
    taille: 72,
    police: "Montserrat",
    effets: (t) => ({ gras: true, couleur: "#ffffff", contour: { couleur: "#000000", epaisseur: Math.max(2, Math.round(t * 0.09)) }, ombre: undefined, surlignage: undefined, majuscules: false }),
    animations: { entree: { nom: "rebond", duree: 500 }, sortie: { nom: "fondu", duree: 300 } },
  },
  {
    id: "bandeau",
    libelle: "Bandeau",
    exemple: "Nouveau",
    taille: 64,
    police: "Archivo Black",
    effets: (t) => ({ gras: false, couleur: "#111111", surlignage: { couleur: "#ffde59", marge: Math.round(t * 0.18), arrondi: Math.round(t * 0.08) }, contour: undefined, ombre: undefined, majuscules: true }),
    animations: { entree: { nom: "glissement-droite", duree: 500 }, sortie: { nom: "glissement-gauche", duree: 400 } },
  },
  {
    id: "sous-titre",
    libelle: "Sous-titre",
    exemple: "Voici ce qu'il faut savoir",
    taille: 42,
    police: "Inter",
    effets: (t) => ({ gras: true, couleur: "#ffffff", surlignage: { couleur: "#000000", marge: Math.round(t * 0.28), arrondi: Math.round(t * 0.2) }, contour: undefined, ombre: undefined, majuscules: false }),
    animations: { entree: { nom: "fondu", duree: 200 }, sortie: { nom: "fondu", duree: 200 } },
  },
  {
    id: "choc",
    libelle: "Titre qui claque",
    exemple: "-50 %",
    taille: 150,
    police: "Anton",
    effets: (t) => ({ gras: false, couleur: "#ffffff", ombre: { couleur: "#000000", flou: Math.round(t * 0.12), x: 0, y: Math.round(t * 0.05), opacite: 0.5 }, contour: undefined, surlignage: undefined, majuscules: true }),
    animations: { entree: { nom: "zoom-arriere", duree: 350 }, sortie: { nom: "zoom", duree: 300 } },
  },
  {
    id: "neon",
    libelle: "Néon",
    exemple: "Ce soir",
    taille: 96,
    police: "Righteous",
    effets: (t) => ({ gras: false, couleur: "#ff4fd8", ombre: { couleur: "#ff4fd8", flou: Math.round(t * 0.4), x: 0, y: 0, opacite: 1 }, contour: undefined, surlignage: undefined, majuscules: false }),
    animations: { entree: { nom: "fondu", duree: 600 }, boucle: { nom: "clignotement", duree: 1600 } },
  },
  {
    id: "machine",
    libelle: "Machine à écrire",
    exemple: "Il était une fois",
    taille: 56,
    police: "Space Mono",
    effets: () => ({ gras: true, couleur: "#ffffff", ombre: undefined, contour: undefined, surlignage: undefined, majuscules: false }),
    animations: { entree: { nom: "machine-a-ecrire", duree: 1500 }, sortie: { nom: "fondu", duree: 300 } },
  },
  {
    id: "mots",
    libelle: "Mot par mot",
    exemple: "Trois idées pour vendre plus",
    taille: 64,
    police: "Poppins",
    effets: (t) => ({ gras: true, couleur: "#ffffff", contour: { couleur: "#000000", epaisseur: Math.max(2, Math.round(t * 0.07)) }, ombre: undefined, surlignage: undefined, majuscules: false }),
    animations: { entree: { nom: "mots", duree: 1200 }, sortie: { nom: "fondu", duree: 300 } },
  },
  {
    id: "citation",
    libelle: "Citation",
    exemple: "Le meilleur moment pour commencer, c'est maintenant",
    taille: 54,
    police: "Playfair Display",
    effets: () => ({ gras: false, italique: true, couleur: "#ffffff", ombre: undefined, contour: undefined, surlignage: undefined, majuscules: false }),
    animations: { entree: { nom: "lignes", duree: 1000 }, sortie: { nom: "fondu", duree: 400 } },
  },
];

export const styleVideo = (id: string) => STYLES_VIDEO.find((s) => s.id === id);

/** Les animations d'un style pour ce texte : un texte par morceaux prend une durée qui suit sa
 *  longueur. */
export function animationsPour(s: StyleVideo, el: ElementTexte): Animations {
  const a: Animations = {};
  for (const genre of ["entree", "sortie", "boucle"] as const) {
    const x = s.animations[genre];
    if (x) a[genre] = estAnimationUnites(x.nom) ? { nom: x.nom, duree: dureeConseillee(genre, x.nom, el) } : x;
  }
  return a;
}

/** Un texte neuf dans ce style, centré, un peu au-dessus du milieu de la page. */
export function creerTexteStyle(page: Format, s: StyleVideo, texte = s.exemple): ElementTexte {
  const taille = Math.round((s.taille * page.largeur) / 1080);
  const el = creerTexte(page, { texte, taillePolice: taille, gras: false, police: s.police, alignement: "center", ...s.effets(taille) });
  return { ...el, y: Math.round(page.hauteur * 0.42 - el.hauteur / 2), animations: animationsPour(s, el) };
}

/** Ce qu'un texte existant reçoit du style : police, couleurs, effets, animations ; il garde sa
 *  taille. */
export function modificationsStyle(el: ElementTexte, s: StyleVideo): Partial<ElementTexte> {
  return { police: s.police, italique: false, ...s.effets(el.taillePolice), animations: animationsPour(s, el) };
}
