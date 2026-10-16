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

/** Les toiles des photos retouchées par le labo (étape 5) : l'export y lit la ressource et pose
 *  l'original à sa place (le noyau refait la retouche). */
const ressourcesParToile = new WeakMap<object, string>();

export function marquerToile(toile: HTMLCanvasElement, ressource: string): void {
  ressourcesParToile.set(toile, ressource);
}

/** La ressource du design qu'une image affichée représente (son aperçu, ou sa version
 *  retouchée), s'il y en a une. */
export function ressourceDeImage(image: unknown): string | undefined {
  if (image instanceof HTMLImageElement) return ressourcesParAdresse.get(image.src);
  return typeof image === "object" && image ? ressourcesParToile.get(image) : undefined;
}

/** L'aperçu d'une ressource du design ouvert, chargé au besoin. */
export function apercuRessource(id: string): Promise<HTMLImageElement> {
  return imageDeRessource(useEditeur.getState().projet, id, "apercu");
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
export async function prechargerPage(page: PageEliot, options: { retouches?: boolean } = {}): Promise<void> {
  const projet = useEditeur.getState().projet;
  const ids = [...new Set(page.elements.flatMap((e) => (e.type === "image" || e.type === "video" ? [e.ressource] : (e.type === "cadre" || e.type === "maquette") && e.ressource ? [e.ressource] : [])))];
  await Promise.all([
    ...ids.map((id) => imageDeRessource(projet, id, "apercu").catch(() => undefined)),
    prechargerVecteurs(page.elements),
    prechargerPersonnages(page.elements),
    assurerPolicesElements(page.elements),
  ]);
  // Les photos retouchées par le labo : leur base (réglages voisins), calculée par le noyau.
  // L'export par le noyau n'en a pas besoin : il refait la retouche depuis l'original.
  if (options.retouches === false) return;
  const { assurerRetouches } = await import("../labo/retouche");
  await assurerRetouches(page);
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
