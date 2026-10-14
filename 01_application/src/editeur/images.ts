// Cache des images décodées : chaque aperçu n'est décodé qu'une fois.

import { useEffect, useState } from "react";

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

export function useImage(url: string | undefined): HTMLImageElement | undefined {
  const [image, setImage] = useState<HTMLImageElement | undefined>(() => (url ? pretes.get(url) : undefined));
  useEffect(() => {
    if (!url) return;
    let actif = true;
    chargerImage(url).then((i) => actif && setImage(i), () => actif && setImage(undefined));
    return () => {
      actif = false;
    };
  }, [url]);
  return url ? image : undefined;
}
