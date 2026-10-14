// Un modèle de départ devient une vraie page : identifiants neufs, polices chargées, textes et
// tableaux mesurés, groupes reliés. Dans un autre format que le sien, la page est mise à
// l'échelle et centrée, comme par « Redimensionner ».

import { creerGraphique, creerTableau, mesurerHauteurTexte, nouvelId } from "../modele/fabriques";
import { redimensionnerElements } from "../modele/geometrie";
import { mesurePolice } from "../modele/mesure";
import { disposerTableau } from "../modele/tableaux";
import { FORMATS_PAGE, type Couleur, type ElementGraphique, type ElementPage, type ElementTableau, type ElementTexte, type Format, type GenreGraphique } from "../modele/types";
import { assurerPolice, variantesPossibles } from "../polices";
import type { ModeleDepart } from "./depart";

export const formatDuModele = (m: ModeleDepart): Format => {
  const f = FORMATS_PAGE.find((x) => x.id === m.format)!;
  return { largeur: f.largeur, hauteur: f.hauteur };
};

export async function instancier(m: ModeleDepart, cible?: Format): Promise<{ fond: Couleur; elements: ElementPage[] }> {
  const format = formatDuModele(m);
  // Les polices d'abord : les textes se mesurent avec elles.
  const polices = new Map<string, { gras: boolean; italique: boolean }>();
  for (const b of m.elements) {
    if (typeof b.police !== "string") continue;
    const d = polices.get(b.police) ?? { gras: false, italique: false };
    polices.set(b.police, { gras: d.gras || b.gras === true || b.type !== "texte", italique: d.italique || b.italique === true });
  }
  await Promise.all([...polices].map(([f, d]) => assurerPolice(f, d.gras, d.italique)));

  const groupes = new Map<string, string>();
  const groupe = (g: unknown) => {
    if (typeof g !== "string") return undefined;
    if (!groupes.has(g)) groupes.set(g, nouvelId("g"));
    return groupes.get(g);
  };

  const elements = m.elements.map((b): ElementPage => {
    const commun = { id: nouvelId(), rotation: b.rotation ?? 0, opacite: b.opacite ?? 1, visible: true, verrouille: false, ...(b.groupe ? { groupe: groupe(b.groupe) } : {}) };
    switch (b.type) {
      case "texte": {
        const t = { ...b, ...commun } as unknown as ElementTexte;
        Object.assign(t, variantesPossibles(t.police, t));
        return { ...t, hauteur: mesurerHauteurTexte(t) };
      }
      case "graphique": {
        const base = creerGraphique(format, b.genre as GenreGraphique);
        const { type: _t, ...reste } = b;
        return { ...base, ...(reste as Partial<ElementGraphique>), ...commun, type: "graphique" } as ElementGraphique;
      }
      case "tableau": {
        const { type: _t, cellules, ...reste } = b;
        const base = creerTableau(format, cellules as string[][], reste as Partial<ElementTableau>);
        const t = { ...base, x: b.x, y: b.y, largeur: b.largeur, ...commun };
        return { ...t, hauteur: Math.round(disposerTableau({ ...t, hauteur: 0 }, mesurePolice(t.police)).hauteurNaturelle) };
      }
      default:
        return { ...b, ...commun, hauteur: b.hauteur ?? b.largeur } as unknown as ElementPage;
    }
  });

  const memeFormat = !cible || (cible.largeur === format.largeur && cible.hauteur === format.hauteur);
  return { fond: m.fond, elements: memeFormat ? elements : redimensionnerElements(elements, format, cible) };
}
