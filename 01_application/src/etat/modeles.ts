// Les modèles de départ dans l'éditeur et à l'accueil : poser un modèle sur la page (ou sur une
// nouvelle page si celle-ci est déjà remplie), créer un design à partir d'un modèle, et les
// vignettes, dessinées une fois par session.

import { rendrePage } from "../export/rendu";
import { nouvelId } from "../modele/fabriques";
import { FORMATS_PAGE } from "../modele/types";
import { MODELES_DEPART, type ModeleDepart } from "../modeles/depart";
import { formatDuModele, instancier } from "../modeles/instancier";
import { pageCourante, useEditeur } from "./editeur";
import { nouveauDesign } from "./projets";

export const modeleParId = (id: string) => MODELES_DEPART.find((m) => m.id === id);

/** Pose le modèle sur la page affichée si elle est vide, sinon sur une nouvelle page juste
 *  après. Une seule étape d'annulation. Renvoie où il a été posé. */
export async function appliquerModele(m: ModeleDepart): Promise<"page" | "nouvelle-page"> {
  const { fond, elements } = await instancier(m, useEditeur.getState().document.format);
  const etat = useEditeur.getState();
  if (pageCourante(etat).elements.length === 0) {
    etat.appliquerPage((p) => ({ ...p, fond, elements }));
    useEditeur.setState({ selection: [] });
    return "page";
  }
  const rang = etat.document.pages.findIndex((p) => p.id === etat.pageActive);
  const page = { id: nouvelId("p"), fond, elements };
  etat.appliquer((d) => ({ ...d, pages: [...d.pages.slice(0, rang + 1), page, ...d.pages.slice(rang + 1)] }));
  useEditeur.setState({ pageActive: page.id, selection: [] });
  return "nouvelle-page";
}

/** Un nouveau design, au format du modèle, qui commence par lui. */
export async function nouveauDesignDepuisModele(m: ModeleDepart): Promise<boolean> {
  const page = await instancier(m);
  return nouveauDesign(formatDuModele(m), m.nom, page);
}

const vignettes = new Map<string, Promise<string>>();

/** L'adresse d'une vignette du modèle (240 px sur son plus grand côté). */
export function vignetteModele(m: ModeleDepart, cote = 240): Promise<string> {
  const cle = `${m.id}/${cote}`;
  let promesse = vignettes.get(cle);
  if (!promesse) {
    promesse = (async () => {
      const f = formatDuModele(m);
      const page = { id: "vignette", ...(await instancier(m)) };
      const blob = await rendrePage(page, f, { pixelRatio: cote / Math.max(f.largeur, f.hauteur), type: "image/png", sansEffets: true });
      return URL.createObjectURL(blob);
    })();
    promesse.catch(() => vignettes.delete(cle));
    vignettes.set(cle, promesse);
  }
  return promesse;
}

/** Le libellé d'un format de modèle (« Carré 1:1 »). */
export const libelleFormat = (id: ModeleDepart["format"]) => FORMATS_PAGE.find((f) => f.id === id)?.libelle ?? id;
