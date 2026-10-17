import { describe, expect, it } from "vitest";
import { creditsAPublier, creditsDes3d, texteDesCredits, texteDuCredit } from "./credits";
import type { ElementObjet3d, PageEliot } from "./types";

const objet = (id: string, ressource: string, extra: Partial<ElementObjet3d> = {}): ElementObjet3d => ({
  id,
  type: "objet3d",
  ressource,
  x: 0,
  y: 0,
  largeur: 100,
  hauteur: 100,
  rotation: 0,
  opacite: 1,
  visible: true,
  verrouille: false,
  camera: { azimut: 0, elevation: 10, zoom: 1, focale: 50 },
  ...extra,
});
const lumiere = (environnement: string) => ({ environnement: { id: environnement, intensite: 1, rotation: 0 }, principale: { azimut: 30, elevation: 40, intensite: 1, couleur: "#ffffff" }, exposition: 0 });
const ressources = {
  flacon: { nom: "flacon", credit: { source: "Sketchfab", auteur: "Ana", lien: "https://sketchfab.com/3d-models/flacon", licence: "CC BY 4.0", titre: "Flacon" } },
  chaise: { nom: "chaise", credit: { source: "Poly Haven", auteur: "Rico", lien: "https://polyhaven.com/a/chaise", licence: "CC0 1.0" } },
  perso: { nom: "perso.glb" },
  studio: { nom: "studio", credit: { source: "Poly Haven", auteur: "Greg", lien: "https://polyhaven.com/a/studio", licence: "CC0 1.0", titre: "Studio" } },
  musique: { nom: "piano.mp3", credit: { source: "Freesound", auteur: "Lou", lien: "https://freesound.org/s/1/", licence: "CC BY 4.0", titre: "Piano" } },
};
const page = (elements: PageEliot["elements"], extra: Partial<PageEliot> = {}): PageEliot => ({ id: "p", fond: "#ffffff", elements, ...extra });

describe("crédits à recopier sous une publication", () => {
  it("le texte d'un crédit : titre, auteur, banque, licence, lien", () => {
    expect(texteDuCredit(ressources.flacon.credit)).toBe("« Flacon », par Ana, sur Sketchfab, licence CC BY 4.0 : https://sketchfab.com/3d-models/flacon");
    expect(texteDuCredit(ressources.chaise.credit)).toBe("Modèle 3D, par Rico, sur Poly Haven, licence CC0 1.0 : https://polyhaven.com/a/chaise");
  });

  it("les objets 3D visibles : modèles puis environnements, chacun une fois", () => {
    const p1 = page([objet("a", "flacon", { lumiere: lumiere("studio") }), objet("b", "flacon"), objet("c", "perso"), objet("d", "chaise", { visible: false })]);
    const p2 = page([objet("e", "chaise")]);
    expect(creditsDes3d([p1], ressources)).toEqual([texteDuCredit(ressources.flacon.credit), "« Studio », par Greg, sur Poly Haven, licence CC0 1.0 : https://polyhaven.com/a/studio"]);
    expect(creditsDes3d([p1, p2], ressources)).toHaveLength(3);
  });

  it("un film ajoute les sons de sa page ; une licence CC BY rend le crédit obligatoire", () => {
    const p = page([objet("e", "chaise")], { duree: 5000, audio: [{ id: "s", ressource: "musique", piste: 0, role: "musique", temps: { debut: 0, fin: 5000 } }] as PageEliot["audio"] });
    const image = creditsAPublier([p], ressources, false);
    expect(image).toEqual({ photos: [], modeles3d: [texteDuCredit(ressources.chaise.credit)], sons: [], obligatoire: false });
    const film = creditsAPublier([p], ressources, true);
    expect(film.sons).toEqual(["« Piano » par Lou (https://freesound.org/s/1/), licence CC BY 4.0, via Freesound"]);
    expect(film.obligatoire).toBe(true);
    expect(texteDesCredits(film)).toBe(`Objets 3D :\n${texteDuCredit(ressources.chaise.credit)}\n\nSons :\n${film.sons[0]}`);
    expect(texteDesCredits(creditsAPublier([page([objet("c", "perso")])], ressources, true))).toBe("");
  });

  it("les photos et vidéos de Pexels : le photographe et sa page, une fois chacune ; Pixabay n'en demande pas", () => {
    const base = { rotation: 0, opacite: 1, visible: true, verrouille: false, x: 0, y: 0, largeur: 10, hauteur: 10 };
    const r = {
      px: { nom: "a.jpg", credit: { source: "Pexels", auteur: "Marc", lien: "https://www.pexels.com/photo/1/", lienAuteur: "https://www.pexels.com/@marc" } },
      pv: { nom: "b.mp4", video: { duree: 3000 }, credit: { source: "Pexels", auteur: "Noé", lien: "https://www.pexels.com/video/2/" } },
      pb: { nom: "c.jpg", credit: { source: "Pixabay", auteur: "Anne", lien: "https://pixabay.com/photos/3/" } },
    };
    const p = page([
      { ...base, id: "f", type: "cadre", forme: "rectangle", ressource: "px", enFond: true },
      { ...base, id: "i", type: "image", ressource: "px", retourneH: false, retourneV: false },
      { ...base, id: "v", type: "video", ressource: "pv" },
      { ...base, id: "j", type: "image", ressource: "pb", retourneH: false, retourneV: false },
      { ...base, id: "k", type: "image", ressource: "px", visible: false, retourneH: false, retourneV: false },
    ] as unknown as PageEliot["elements"]);
    const c = creditsAPublier([p], r, false);
    expect(c.photos).toEqual(["Photo de Marc sur Pexels : https://www.pexels.com/@marc", "Vidéo de Noé sur Pexels : https://www.pexels.com/video/2/"]);
    expect(c.obligatoire).toBe(false);
    expect(texteDesCredits(c)).toBe("Photos et vidéos :\nPhoto de Marc sur Pexels : https://www.pexels.com/@marc\nVidéo de Noé sur Pexels : https://www.pexels.com/video/2/");
  });
});
