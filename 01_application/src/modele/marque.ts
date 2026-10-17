// Le kit de marque : un nom, des couleurs, trois polices (titre, sous-titre, texte), des logos
// et deux jingles (ouverture et fin, étape 4, lot 5). Rangé par le Rust dans
// `~/Documents/Eliot/Marque/kit/marque.json` ; les logos et les jingles sont des images et des
// sons du dossier du kit, copiés dans chaque design qui s'en sert.

import { stylesValides, type StyleTexte } from "./stylesTexte";
import type { ElementPage } from "./types";

export interface CouleurMarque {
  valeur: string;
  nom?: string;
}

export interface PoliceMarque {
  famille: string;
  gras?: boolean;
}

export type RolePolice = "titre" | "sousTitre" | "texte";

/** Un jingle se pose au début de la vidéo (ouverture) ou à sa fin. */
export type RoleJingle = "ouverture" | "fin";

export const ROLES_JINGLE: { id: RoleJingle; libelle: string; poser: string }[] = [
  { id: "ouverture", libelle: "Jingle d'ouverture", poser: "Poser au début" },
  { id: "fin", libelle: "Jingle de fin", poser: "Poser à la fin" },
];

export interface KitMarque {
  version: 1;
  nom: string;
  couleurs: CouleurMarque[];
  polices: Partial<Record<RolePolice, PoliceMarque>>;
  /** Identifiants des logos (images du dossier du kit), dans l'ordre du panneau. */
  logos: string[];
  /** Identifiants des jingles (sons du dossier du kit). */
  jingles: Partial<Record<RoleJingle, string>>;
  /** Les styles de texte enregistrés (étape 7, lot 2), dans l'ordre du panneau. */
  styles: StyleTexte[];
}

export const ROLES_POLICE: { id: RolePolice; libelle: string; taille: number; gras: boolean }[] = [
  { id: "titre", libelle: "Titre", taille: 96, gras: true },
  { id: "sousTitre", libelle: "Sous-titre", taille: 56, gras: true },
  { id: "texte", libelle: "Texte", taille: 32, gras: false },
];

export const COULEURS_MAX = 24;
export const LOGOS_MAX = 24;

const HEX = /^#[0-9a-f]{6}$/i;

export const kitVide = (): KitMarque => ({ version: 1, nom: "Ma marque", couleurs: [], polices: {}, logos: [], jingles: {}, styles: [] });

/** Remet d'aplomb un kit lu sur le disque : ce qui n'a pas la bonne forme est écarté. */
export function kitValide(brut: unknown): KitMarque {
  const kit = kitVide();
  if (!brut || typeof brut !== "object") return kit;
  const b = brut as Record<string, unknown>;
  if (typeof b.nom === "string" && b.nom.trim()) kit.nom = b.nom.trim().slice(0, 80);
  if (Array.isArray(b.couleurs)) {
    for (const c of b.couleurs) {
      const valeur = typeof c === "string" ? c : (c as CouleurMarque)?.valeur;
      if (typeof valeur !== "string" || !HEX.test(valeur)) continue;
      const v = valeur.toLowerCase();
      if (kit.couleurs.some((x) => x.valeur === v)) continue;
      const nom = typeof (c as CouleurMarque)?.nom === "string" ? (c as CouleurMarque).nom!.slice(0, 40) : undefined;
      kit.couleurs.push(nom ? { valeur: v, nom } : { valeur: v });
    }
    kit.couleurs = kit.couleurs.slice(0, COULEURS_MAX);
  }
  if (b.polices && typeof b.polices === "object") {
    for (const { id } of ROLES_POLICE) {
      const p = (b.polices as Record<string, unknown>)[id] as PoliceMarque | undefined;
      if (p && typeof p.famille === "string" && p.famille.trim()) kit.polices[id] = { famille: p.famille.trim(), ...(typeof p.gras === "boolean" ? { gras: p.gras } : {}) };
    }
  }
  if (Array.isArray(b.logos)) kit.logos = [...new Set(b.logos.filter((l): l is string => typeof l === "string" && /^[0-9a-f]{64}$/.test(l)))].slice(0, LOGOS_MAX);
  if (b.jingles && typeof b.jingles === "object") {
    for (const { id } of ROLES_JINGLE) {
      const j = (b.jingles as Record<string, unknown>)[id];
      if (typeof j === "string" && /^[0-9a-f]{64}$/.test(j)) kit.jingles[id] = j;
    }
  }
  kit.styles = stylesValides(b.styles);
  return kit;
}

/** Ce qu'une couleur de la marque change sur un objet : son texte, son remplissage (le trait
 *  d'une ligne ou d'une flèche), le fond d'un cadre, le boîtier d'une maquette, la première
 *  série d'un graphique, l'en-tête d'un tableau, la tenue d'un Open Peep. `null` si l'objet
 *  n'a pas de couleur. */
export function modifCouleur(el: ElementPage, couleur: string): Partial<ElementPage> | null {
  switch (el.type) {
    case "texte":
    case "icone":
    case "qr":
    case "maquette":
      return { couleur };
    case "forme":
      // Pour une ligne ou une flèche, le remplissage est la couleur du trait.
      return { remplissage: couleur };
    case "cadre":
      return { fond: couleur };
    case "dessin":
      return { couleur };
    case "graphique":
      // La première série (ou la jauge) prend la couleur.
      return { series: el.series.map((s, i) => (i === 0 ? { ...s, couleur } : s)) };
    case "tableau":
      return { fondEntete: couleur };
    case "personnage":
      // Open Peeps : la tenue prend la couleur (les Humaaans se colorient couleur par couleur).
      return el.collection === "open-peeps" ? { couleurs: { ...el.couleurs, corps: couleur } } : null;
    default:
      return null;
  }
}
