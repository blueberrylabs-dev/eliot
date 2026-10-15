import { beforeEach, describe, expect, it } from "vitest";
import { bornes, dureeLisible } from "../editeur/videos";
import { elementsCourants, useEditeur } from "../etat/editeur";
import { creerImage, creerVideo, documentVide, dureeJouee } from "./fabriques";
import { redimensionnerElements } from "./geometrie";
import type { ElementVideo, Ressource } from "./types";

const video: Ressource = {
  id: "v1",
  nom: "plage.mp4",
  largeur: 1920,
  hauteur: 1080,
  transparence: false,
  video: { duree: 12_000, imagesParSeconde: 30, son: true, copie: "webm", vignettes: { nombre: 12, intervalle: 1000, largeur: 160, hauteur: 90 } },
};
const etat = () => useEditeur.getState();

beforeEach(() => {
  etat().chargerProjet({ rayon: "designs", id: "Essai" }, documentVide({ largeur: 1080, hauteur: 1920 }, "Essai"), [video]);
});

describe("vidéo dans le design", () => {
  it("entre comme une image : centrée, 60 % de la page au plus, tout le fichier", () => {
    const el = creerVideo({ largeur: 1080, hauteur: 1920 }, video);
    expect(el).toMatchObject({ type: "video", ressource: "v1", largeur: 648, hauteur: 365, x: 216, retourneH: false, retourneV: false });
    expect(el.coupe).toBeUndefined();
    expect(dureeJouee(el, 12_000)).toBe(12_000);
  });

  it("la coupe et la vitesse donnent la durée qui joue", () => {
    const el: ElementVideo = { ...creerVideo({ largeur: 1080, hauteur: 1080 }, video), coupe: { debut: 2000, fin: 8000 }, vitesse: 2 };
    expect(dureeJouee(el, 12_000)).toBe(3000);
    expect(dureeJouee({ ...el, coupe: { debut: 10_000 } }, 12_000)).toBe(1000);
    expect(bornes({ ...el, coupe: { debut: 2000, fin: 99_000 } }, 12_000)).toEqual({ debut: 2, fin: 12 });
    expect(bornes({ ...el, coupe: undefined }, 12_000)).toEqual({ debut: 0, fin: 12 });
  });

  it("change de format avec la page, coins et bordure compris", () => {
    const el: ElementVideo = { ...creerVideo({ largeur: 1080, hauteur: 1080 }, video), arrondi: 40, bordure: { couleur: "#ffffff", epaisseur: 10 }, coupe: { debut: 500 } };
    const [r] = redimensionnerElements([el], { largeur: 1080, hauteur: 1080 }, { largeur: 540, hauteur: 540 }) as ElementVideo[];
    expect(r).toMatchObject({ type: "video", arrondi: 20, bordure: { epaisseur: 5 }, coupe: { debut: 500 } });
  });

  it("une photo et une vidéo se passent leur style", () => {
    const photo = { ...creerImage({ largeur: 1080, hauteur: 1080 }, { ...video, id: "p1", video: undefined }), id: "p", arrondi: 30 };
    const clip = { ...creerVideo({ largeur: 1080, hauteur: 1080 }, video), id: "v" };
    etat().ajouterElements([photo, clip]);
    etat().selectionnerSeul("p");
    etat().copierStyle();
    etat().appliquerStyle("v");
    expect(elementsCourants(etat()).find((e) => e.id === "v")).toMatchObject({ arrondi: 30 });
  });

  it("durée lisible", () => {
    expect(dureeLisible(7_200)).toBe("0:07");
    expect(dureeLisible(65_000)).toBe("1:05");
    expect(dureeLisible(3_723_000)).toBe("1:02:03");
  });
});
