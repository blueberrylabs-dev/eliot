import { beforeEach, describe, expect, it, vi } from "vitest";
import { documentVide } from "../modele/fabriques";
import type { ElementForme } from "../modele/types";
import { elementsCourants, etiquetteDeGeste, pageCourante, useEditeur } from "./editeur";
import { useTemps } from "./temps";
import { voixUtilisees } from "./nettoyage";
import { VOIX_NETTE } from "../modele/voix";

const forme = (id: string, x = 0, y = 0): ElementForme => ({
  id, type: "forme", forme: "rectangle", x, y, largeur: 100, hauteur: 100, rotation: 0, opacite: 1, visible: true, verrouille: false,
  remplissage: "#4f46e5", contour: "#000000", epaisseurContour: 0, arrondi: 0,
});
const etat = () => useEditeur.getState();

beforeEach(() => {
  etat().chargerProjet({ rayon: "designs", id: "Essai" }, documentVide({ largeur: 1080, hauteur: 1080 }, "Essai"), []);
});

describe("store", () => {
  it("ajoute sur la page affichée et annule", () => {
    etat().ajouterElements([forme("a")]);
    expect(elementsCourants(etat()).map((e) => e.id)).toEqual(["a"]);
    etat().annuler();
    expect(elementsCourants(etat())).toEqual([]);
    etat().retablir();
    expect(elementsCourants(etat()).map((e) => e.id)).toEqual(["a"]);
  });

  it("ajoute, duplique, supprime et réordonne des pages ; annuler revient sur la bonne page", () => {
    etat().ajouterElements([forme("a")]);
    const p1 = etat().pageActive;
    etat().ajouterPage();
    const p2 = etat().pageActive;
    expect(p2).not.toBe(p1);
    expect(etat().document.pages.map((p) => p.id)).toEqual([p1, p2]);
    etat().ajouterElements([forme("b")]);
    etat().allerALaPage(p1);
    etat().annuler(); // défait l'ajout de « b », sur la page 2
    expect(etat().pageActive).toBe(p2);
    expect(elementsCourants(etat())).toEqual([]);
    etat().allerALaPage(p1);
    etat().dupliquerPageActive();
    const copie = pageCourante(etat());
    expect(copie.elements).toHaveLength(1);
    expect(copie.elements[0].id).not.toBe("a");
    expect(etat().document.pages.map((p) => p.id)).toEqual([p1, copie.id, p2]);
    etat().deplacerPage(p2, 0);
    expect(etat().document.pages[0].id).toBe(p2);
    etat().supprimerPage(copie.id);
    expect(etat().document.pages).toHaveLength(2);
    expect(etat().document.pages.some((p) => p.id === etat().pageActive)).toBe(true);
  });

  it("la dernière page ne se supprime pas", () => {
    etat().supprimerPage(etat().pageActive);
    expect(etat().document.pages).toHaveLength(1);
  });

  it("un groupe se sélectionne d'un clic et se dégroupe", () => {
    etat().ajouterElements([forme("a"), forme("b", 200), forme("c", 400)]);
    etat().selectionner(["a", "b"]);
    etat().grouperSelection();
    etat().selectionner(["a"]);
    expect([...etat().selection].sort()).toEqual(["a", "b"]);
    etat().selectionnerSeul("a");
    expect(etat().selection).toEqual(["a"]);
    etat().selectionner(["b"]);
    etat().dupliquerSelection();
    const copies = elementsCourants(etat()).slice(3);
    expect(copies).toHaveLength(2);
    expect(copies[0].groupe).toBeDefined();
    expect(copies[0].groupe).toBe(copies[1].groupe);
    expect(copies[0].groupe).not.toBe(elementsCourants(etat())[0].groupe);
    etat().selectionner(["a"]);
    etat().degrouperSelection();
    etat().selectionner(["a"]);
    expect(etat().selection).toEqual(["a"]);
  });

  it("aligne un objet seul sur la page, plusieurs entre eux", () => {
    etat().ajouterElements([forme("a", 10, 10), forme("b", 500, 300)]);
    etat().selectionner(["a"]);
    etat().alignerSelection("centre");
    expect(elementsCourants(etat())[0].x).toBe(490);
    etat().selectionner(["a", "b"]);
    etat().alignerSelection("haut");
    expect(elementsCourants(etat()).map((e) => e.y)).toEqual([10, 10]);
  });

  it("copier le style d'une forme vers une autre", () => {
    etat().ajouterElements([{ ...forme("a"), remplissage: "#ff0000", epaisseurContour: 6 }, forme("b", 300)]);
    etat().selectionner(["a"]);
    etat().copierStyle();
    etat().appliquerStyle("b");
    const b = elementsCourants(etat())[1] as ElementForme;
    expect(b.remplissage).toBe("#ff0000");
    expect(b.epaisseurContour).toBe(6);
    expect(etat().styleCopie).toBeNull();
  });

  it("changer de format en adaptant le contenu", () => {
    etat().ajouterElements([{ ...forme("a"), largeur: 1080, hauteur: 1080 }]);
    etat().modifierFormat({ largeur: 1080, hauteur: 1920 }, true);
    expect(etat().document.format).toEqual({ largeur: 1080, hauteur: 1920 });
    expect(elementsCourants(etat())[0]).toMatchObject({ y: 420, largeur: 1080 });
  });

  it("un geste reste une seule étape à annuler, même avec une pause au milieu", () => {
    vi.useFakeTimers();
    try {
      etat().ajouterElements([forme("a")]);
      const avant = etat().passe.length;
      // Sans marque de geste : une pause de plus de 700 ms coupe en deux étapes.
      etat().modifierElements({ a: { x: 10 } }, "glisser");
      vi.advanceTimersByTime(900);
      etat().modifierElements({ a: { x: 20 } }, "glisser");
      expect(etat().passe.length).toBe(avant + 2);
      // Avec la marque : une seule étape, quelle que soit la pause ; le geste suivant en fait une autre.
      const geste = etiquetteDeGeste("glisser");
      etat().modifierElements({ a: { x: 30 } }, geste);
      vi.advanceTimersByTime(4000);
      etat().modifierElements({ a: { x: 40 } }, geste);
      expect(etat().passe.length).toBe(avant + 3);
      etat().modifierElements({ a: { x: 50 } }, etiquetteDeGeste("glisser"));
      expect(etat().passe.length).toBe(avant + 4);
      etat().annuler();
      etat().annuler();
      expect((elementsCourants(etat())[0] as ElementForme).x).toBe(20);
    } finally {
      vi.useRealTimers();
    }
  });

  it("le renommage ne s'annule pas", () => {
    etat().ajouterElements([forme("a")]);
    etat().definirNom("Pub sneakers");
    etat().annuler();
    expect(etat().document.nom).toBe("Pub sneakers");
  });
});

describe("sons d'une page vidéo (étape 4, lot 5)", () => {
  const H = "a".repeat(64);
  const musique = { id: H, nom: "musique.mp3", largeur: 0, hauteur: 0, transparence: false, son: { duree: 30_000, copie: "webm" as const } };
  const bip = { id: "b".repeat(64), nom: "bip.wav", largeur: 0, hauteur: 0, transparence: false, son: { duree: 800, copie: "webm" as const } };
  const film = { id: "c".repeat(64), nom: "film.mp4", largeur: 1920, hauteur: 1080, transparence: false, video: { duree: 4000, imagesParSeconde: 30, son: true, copie: "webm" as const, vignettes: { nombre: 4, intervalle: 1000, largeur: 160, hauteur: 90 } } };
  const sons = () => pageCourante(etat()).audio ?? [];

  beforeEach(() => etat().ajouterRessources([musique, bip, film]));

  it("une musique posée sur une page fixe en fait une vidéo et va jusqu'au bout, avec un fondu de fin", () => {
    etat().ajouterElements([forme("a")]);
    const id = etat().ajouterSon(musique)!;
    const p = pageCourante(etat());
    expect(p.duree).toBe(5000);
    expect(sons()).toEqual([{ id, ressource: H, role: "musique", jusquALaFin: true, fonduSortie: 2000, piste: 0, temps: { debut: 0, fin: 5000 } }]);
    expect(etat().selectionAudio).toEqual([id]);
    expect(etat().selection).toEqual([]);
    // Un bruitage se pose à la tête de lecture, sur une autre piste s'il croise la musique.
    const b = etat().ajouterSon(bip, { debut: 1200 })!;
    expect(sons().find((c) => c.id === b)).toMatchObject({ role: "bruitage", piste: 1, temps: { debut: 1200, fin: 2000 } });
    // Annuler retire le bruitage et la sélection suit.
    etat().annuler();
    expect(sons().map((c) => c.id)).toEqual([id]);
    expect(etat().selectionAudio).toEqual([]);
  });

  it("choisir un élément vide la sélection des sons, et l'inverse", () => {
    etat().ajouterElements([forme("a")]);
    const id = etat().ajouterSon(bip)!;
    etat().selectionnerSeul("a");
    expect(etat().selectionAudio).toEqual([]);
    etat().selectionnerSons([id]);
    expect([etat().selection, etat().selectionAudio]).toEqual([[], [id]]);
    etat().deselectionner();
    expect(etat().selectionAudio).toEqual([]);
  });

  it("supprimer, dupliquer et scinder visent les sons choisis", () => {
    etat().basculerPageVideo(true);
    const id = etat().ajouterSon(musique, { role: "bruitage" })!;
    expect(sons()[0].temps).toEqual({ debut: 0, fin: 30_000 });
    etat().dupliquerSelection();
    expect(sons()).toHaveLength(2);
    const copie = etat().selectionAudio[0];
    expect(sons().find((c) => c.id === copie)!.temps).toEqual({ debut: 30_000, fin: 60_000 });
    // Scinder à la tête de lecture : la seconde moitié reprend le fichier.
    etat().selectionnerSons([id]);
    useTemps.getState().allerA(10_000);
    etat().scinderALaTete();
    const moitie = etat().selectionAudio[0];
    expect(sons().find((c) => c.id === id)).toMatchObject({ coupe: { debut: 0, fin: 10_000 }, temps: { debut: 0, fin: 10_000 } });
    expect(sons().find((c) => c.id === moitie)).toMatchObject({ coupe: { debut: 10_000 }, temps: { debut: 10_000, fin: 30_000 } });
    etat().selectionnerSons([id, moitie]);
    etat().supprimerSelection();
    expect(sons().map((c) => c.id)).toEqual([copie]);
  });

  it("le son d'une vidéo se détache sur une piste de sons, la vidéo devient muette", () => {
    etat().ajouterElements([{ id: "v", type: "video", ressource: film.id, x: 0, y: 0, largeur: 1080, hauteur: 608, rotation: 0, opacite: 1, visible: true, verrouille: false, retourneH: false, retourneV: false, coupe: { debut: 500, fin: 3500 }, fonduEntree: 200 }]);
    const v = elementsCourants(etat())[0];
    expect(v.temps).toEqual({ debut: 0, fin: 3000 });
    const id = etat().detacherSon("v")!;
    expect(sons()).toEqual([{ id, ressource: film.id, role: "voix", coupe: { debut: 500, fin: 3500 }, fonduEntree: 200, piste: 0, temps: { debut: 0, fin: 3000 } }]);
    expect(elementsCourants(etat())[0]).toMatchObject({ volume: 0 });
    // Déjà muette : rien à détacher ; à une autre vitesse non plus.
    expect(etat().detacherSon("v")).toBeNull();
    etat().annuler();
    etat().modifierElements({ v: { vitesse: 2 } });
    expect(etat().detacherSon("v")).toBeNull();
  });

  it("un jingle de fin finit avec la page, et un son lâché sur une piste y va", () => {
    etat().ajouterElements([{ id: "v", type: "video", ressource: film.id, x: 0, y: 0, largeur: 1080, hauteur: 608, rotation: 0, opacite: 1, visible: true, verrouille: false, retourneH: false, retourneV: false }]);
    const fin = etat().ajouterSon(bip, { jingle: "fin" })!;
    expect(sons().find((c) => c.id === fin)).toMatchObject({ role: "musique", temps: { debut: 3200, fin: 4000 } });
    expect(sons().find((c) => c.id === fin)!.jusquALaFin).toBeUndefined();
    const debut = etat().ajouterSon(bip, { jingle: "ouverture" })!;
    expect(sons().find((c) => c.id === debut)!.temps).toEqual({ debut: 0, fin: 800 });
    const autre = etat().ajouterSon(bip, { debut: 1000, piste: 2 })!;
    expect(sons().find((c) => c.id === autre)!.piste).toBe(1);
    expect(pageCourante(etat()).duree).toBe(4000);
  });
});

describe("la voix (étape 4, lot 6)", () => {
  const prise = { id: "d".repeat(64), nom: "Prise 1", largeur: 0, hauteur: 0, transparence: false, son: { duree: 9000, copie: "webm" as const, origine: "micro" as const } };
  const sons = () => pageCourante(etat()).audio ?? [];

  beforeEach(() => etat().ajouterRessources([prise]));

  it("une prise se pose au rôle voix, coupée au top et nettoyée, et le nettoyage se garde quand on scinde", () => {
    etat().basculerPageVideo(true);
    // Le compte à rebours (3 s) reste dans le fichier : le clip commence au top.
    const id = etat().ajouterSon(prise, { debut: 1000, coupe: { debut: 3000 }, nettoyage: { ...VOIX_NETTE, graves: false } })!;
    const c = sons().find((x) => x.id === id)!;
    expect(c).toMatchObject({ role: "voix", coupe: { debut: 3000 }, temps: { debut: 1000, fin: 7000 } });
    expect(c.nettoyage).toEqual({ bruit: 0.85, chaleur: 1.5, presence: 3, compresseur: 0.5, deesseur: 0.4, niveau: true });
    expect(pageCourante(etat()).duree).toBe(7000);
    // Reprise de la liste des sons, une prise commence au top.
    const reprise = etat().ajouterSon({ ...prise, son: { ...prise.son, marque: 2500 } }, { debut: 12_000 })!;
    expect(sons().find((x) => x.id === reprise)).toMatchObject({ coupe: { debut: 2500 }, temps: { debut: 12_000, fin: 18_500 } });
    // Sans rôle donné, un son fait par Eliot est une voix, même long.
    const autre = etat().ajouterSon({ ...prise, id: "e".repeat(64), son: { ...prise.son, duree: 40_000 } })!;
    expect(sons().find((x) => x.id === autre)!.role).toBe("voix");
    // Scinder garde le nettoyage des deux côtés ; l'enlever s'annule.
    etat().selectionnerSons([id]);
    useTemps.getState().allerA(4000);
    etat().scinderALaTete();
    const moitie = etat().selectionAudio[0];
    expect(sons().find((x) => x.id === moitie)!.nettoyage).toEqual(c.nettoyage);
    etat().modifierSons({ [id]: { nettoyage: undefined } });
    expect(sons().find((x) => x.id === id)!.nettoyage).toBeUndefined();
    etat().annuler();
    expect(sons().find((x) => x.id === id)!.nettoyage).toEqual(c.nettoyage);
  });

  it("les voix nettoyées du document, une fois chacune, pour le cache du noyau", () => {
    etat().basculerPageVideo(true);
    etat().ajouterSon(prise, { nettoyage: VOIX_NETTE });
    etat().ajouterSon(prise, { debut: 9000, nettoyage: { ...VOIX_NETTE } });
    etat().ajouterSon(prise, { debut: 20_000 });
    expect(voixUtilisees(etat().document.pages)).toEqual([{ ressource: prise.id, nettoyage: VOIX_NETTE }]);
  });
});


describe("post animé (vérification de l'étape 4)", () => {
  it("une animation posée sur une image fixe en fait une page vidéo, en une seule étape d'annulation", () => {
    etat().ajouterElements([forme("a"), forme("b", 100, 100)]);
    expect(pageCourante(etat()).duree).toBeUndefined();
    etat().definirAnimations(["a"], "entree", { nom: "fondu", duree: 500 });
    const page = pageCourante(etat());
    expect(page.duree).toBe(5000);
    expect(page.elements.map((e) => [e.id, e.temps])).toEqual([
      ["a", { debut: 0, fin: 5000 }],
      ["b", { debut: 0, fin: 5000 }],
    ]);
    expect(page.elements[0].animations).toEqual({ entree: { nom: "fondu", duree: 500 } });
    expect(page.elements[1].animations).toBeUndefined();
    etat().annuler();
    const avant = pageCourante(etat());
    expect(avant.duree).toBeUndefined();
    expect(avant.elements.every((e) => !e.temps && !e.animations)).toBe(true);
  });

  it("retirer une animation sur une image fixe ne change rien", () => {
    etat().ajouterElements([forme("a")]);
    const avant = pageCourante(etat());
    etat().definirAnimations(["a"], "entree", null);
    expect(pageCourante(etat())).toBe(avant);
  });
});
