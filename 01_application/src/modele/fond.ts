// La photo en fond de page (étape 7, lot 4) : un cadre rectangulaire qui couvre la page, sous
// tout le reste. Une photo (ou un cadre rempli) s'y met d'un clic, et s'en détache. Ce n'est pas
// un réglage du fond de la page : le cadre garde ce qu'un cadre sait faire (ajuster la photo,
// le labo, l'export par le noyau), et le fond de couleur reste dessous. Pour une page fixe : sur
// une page vidéo, c'est la piste principale qui fait le fond.

import { RECADRAGE_PAR_DEFAUT } from "./cadres";
import type { ElementCadre, ElementImage, ElementPage, Format, PageEliot } from "./types";

export const estFondPhoto = (e: ElementPage): e is ElementCadre => e.type === "cadre" && !!e.enFond;

/** La photo du fond d'une page, s'il y en a une. */
export const fondPhoto = (page: PageEliot): ElementCadre | undefined => page.elements.find(estFondPhoto);

/** Un élément qui peut devenir le fond : une photo, ou un cadre qui en a une. */
export const peutAllerEnFond = (e: ElementPage): e is ElementImage | ElementCadre => (e.type === "image" && !!e.ressource) || (e.type === "cadre" && !!e.ressource && !e.enFond);

const couvre = (format: Format) => ({ x: 0, y: 0, largeur: format.largeur, hauteur: format.hauteur, rotation: 0 });

/** L'élément devenu la photo du fond : un cadre rectangulaire, la photo centrée et couvrant la
 *  page (un cadre garde son cadrage), ses réglages du labo, son nom, son opacité. */
export function mettreEnFond(e: ElementImage | ElementCadre, format: Format): ElementCadre {
  const { groupe: _g, temps: _t, piste: _p, animations: _a, cles: _c, transition: _tr, ...commun } = e;
  if (e.type === "cadre") return { ...(commun as ElementCadre), ...couvre(format), forme: "rectangle", verrouille: false, visible: true, enFond: true };
  const base = commun as ElementImage;
  return {
    id: base.id,
    type: "cadre",
    ...couvre(format),
    opacite: base.opacite,
    visible: true,
    verrouille: false,
    ...(base.nom ? { nom: base.nom } : {}),
    ...(base.libelle ? { libelle: base.libelle } : {}),
    forme: "rectangle",
    ressource: base.ressource,
    recadrage: { ...RECADRAGE_PAR_DEFAUT },
    fond: "#dcd8cf",
    ...(base.reglages ? { reglages: base.reglages } : {}),
    enFond: true,
  };
}

/** La photo du fond devenue un cadre comme un autre, à la même place (toute la page). */
export function detacherFond(e: ElementCadre): ElementCadre {
  const { enFond: _f, ...reste } = e;
  return reste;
}

/**
 * Remet en ordre la photo du fond d'une page : une seule (les autres redeviennent des cadres),
 * tout en dessous, qui couvre la page entière, droite, hors de tout groupe. Sur une page vidéo,
 * elle redevient un cadre comme un autre. Rend la page telle quelle si rien ne change.
 */
export function rangerFond(page: PageEliot, format: Format): PageEliot {
  const fonds = page.elements.filter(estFondPhoto);
  if (fonds.length === 0) return page;
  if (page.duree !== undefined) return { ...page, elements: page.elements.map((e) => (estFondPhoto(e) ? detacherFond(e) : e)) };
  const [garde, ...autres] = fonds;
  const place = couvre(format);
  const enPlace = page.elements[0] === garde && autres.length === 0 && !garde.groupe && garde.forme === "rectangle" && (Object.keys(place) as (keyof typeof place)[]).every((k) => garde[k] === place[k]);
  if (enPlace) return page;
  const { groupe: _g, ...sansGroupe } = garde;
  const fond: ElementCadre = { ...sansGroupe, ...place, forme: "rectangle" };
  return { ...page, elements: [fond, ...page.elements.filter((e) => e !== garde).map((e) => (autres.includes(e as ElementCadre) ? detacherFond(e as ElementCadre) : e))] };
}
