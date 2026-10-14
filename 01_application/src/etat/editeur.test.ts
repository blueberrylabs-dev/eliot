import { beforeEach, describe, expect, it } from "vitest";
import { documentVide } from "../modele/fabriques";
import type { ElementForme } from "../modele/types";
import { elementsCourants, pageCourante, useEditeur } from "./editeur";

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

  it("le renommage ne s'annule pas", () => {
    etat().ajouterElements([forme("a")]);
    etat().definirNom("Pub sneakers");
    etat().annuler();
    expect(etat().document.nom).toBe("Pub sneakers");
  });
});
