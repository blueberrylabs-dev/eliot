// Cache des images décodées : chaque aperçu n'est demandé au noyau et décodé qu'une fois.

import { useEffect, useState } from "react";
import { useEditeur } from "../etat/editeur";
import type { PageEliot, RefProjet } from "../modele/types";
import { prechargerVecteurs } from "../bibliotheque/bibliotheque";
import { prechargerPersonnages } from "../bibliotheque/personnages";
import { assurerPolicesElements } from "../polices";
import { urlRessource, type GenreImage } from "../pont/tauri";

const pretes = new Map<string, HTMLImageElement>();
const enCours = new Map<string, Promise<HTMLImageElement>>();

export function chargerImage(url: string): Promise<HTMLImageElement> {
  const deja = pretes.get(url);
  if (deja) return Promise.resolve(deja);
  let promesse = enCours.get(url);
  if (!promesse) {
    promesse = new Promise<HTMLImageElement>((ok, ko) => {
      const image = new Image();
      image.onload = () => {
        pretes.set(url, image);
        enCours.delete(url);
        ok(image);
      };
      image.onerror = () => {
        enCours.delete(url);
        ko(new Error(`image illisible : ${url}`));
      };
      image.src = url;
    });
    enCours.set(url, promesse);
  }
  return promesse;
}

/** Adresses déjà connues, pour un rendu synchrone dès la première image affichée. */
const adresses = new Map<string, string>();
const cle = (ref: RefProjet | null, id: string, genre: GenreImage) => `${ref?.rayon}/${ref?.id}/${id}/${genre}`;

/** La ressource derrière chaque adresse d'aperçu : l'export pose l'original à sa place. */
const ressourcesParAdresse = new Map<string, string>();

async function imageDeRessource(ref: RefProjet | null, id: string, genre: GenreImage): Promise<HTMLImageElement> {
  const url = await urlRessource(ref ?? { rayon: "designs", id: "" }, id, genre);
  adresses.set(cle(ref, id, genre), url);
  if (genre === "apercu") ressourcesParAdresse.set(url, id);
  return chargerImage(url);
}

/** La ressource du design qu'une image affichée représente (son aperçu), s'il y en a une. */
export function ressourceDeImage(image: unknown): string | undefined {
  return image instanceof HTMLImageElement ? ressourcesParAdresse.get(image.src) : undefined;
}

/** L'image décodée d'une ressource du design ouvert, ou `undefined` le temps qu'elle arrive. */
export function useImageRessource(id: string | undefined, genre: GenreImage = "apercu"): HTMLImageElement | undefined {
  const projet = useEditeur((s) => s.projet);
  const connue = () => {
    if (!id) return undefined;
    const url = adresses.get(cle(projet, id, genre));
    return url ? pretes.get(url) : undefined;
  };
  const [image, setImage] = useState<HTMLImageElement | undefined>(connue);
  useEffect(() => {
    if (!id) return;
    let actif = true;
    const deja = connue();
    if (deja) setImage(deja);
    imageDeRessource(projet, id, genre).then(
      (i) => actif && setImage(i),
      () => actif && setImage(undefined),
    );
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, genre, projet]);
  return id ? image : undefined;
}

/** Charge tout ce qu'une page dessine avant un rendu hors écran (export, miniature) : images
 *  du design, icônes, emojis et personnages de la bibliothèque, polices des textes. */
export async function prechargerPage(page: PageEliot): Promise<void> {
  const projet = useEditeur.getState().projet;
  const ids = [...new Set(page.elements.flatMap((e) => (e.type === "image" || e.type === "video" ? [e.ressource] : (e.type === "cadre" || e.type === "maquette") && e.ressource ? [e.ressource] : [])))];
  await Promise.all([
    ...ids.map((id) => imageDeRessource(projet, id, "apercu").catch(() => undefined)),
    prechargerVecteurs(page.elements),
    prechargerPersonnages(page.elements),
    assurerPolicesElements(page.elements),
  ]);
}

/** L'adresse d'une image du design ouvert (pour une balise `<img>`), une fois connue. */
export function useUrlRessource(id: string, genre: GenreImage = "miniature"): string | undefined {
  const projet = useEditeur((s) => s.projet);
  const [url, setUrl] = useState<string | undefined>(() => adresses.get(cle(projet, id, genre)));
  useEffect(() => {
    let actif = true;
    void urlRessource(projet ?? { rayon: "designs", id: "" }, id, genre).then(
      (u) => {
        adresses.set(cle(projet, id, genre), u);
        if (actif) setUrl(u);
      },
      () => undefined,
    );
    return () => {
      actif = false;
    };
  }, [id, genre, projet]);
  return url;
}
