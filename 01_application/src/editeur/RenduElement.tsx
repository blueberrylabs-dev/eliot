// Un élément du document vers un groupe Konva. Le groupe porte la boîte (position,
// rotation) ; la forme dessinée vit à l'intérieur, dans la boîte [0, largeur] x [0, hauteur].
// Le même rendu sert à la zone de travail, aux vignettes des pages et aux exports.

import { memo } from "react";
import { Ellipse, Group, Image as ImageKonva, Line, Rect, Text } from "react-konva";
import { pointsEtoile, styleTexte } from "../modele/fabriques";
import type { ElementForme, ElementImage, ElementPage, ElementTexte, Format, PageEliot } from "../modele/types";
import { pilePolice } from "../polices";
import { remplissageKonva } from "./couleurs";
import { useImageRessource } from "./images";

function Forme({ el }: { el: ElementForme }) {
  const { largeur: l, hauteur: h } = el;
  const commun = {
    stroke: el.epaisseurContour > 0 ? el.contour : undefined,
    strokeWidth: el.epaisseurContour,
    perfectDrawEnabled: false,
    strokeScaleEnabled: false,
  };
  switch (el.forme) {
    case "rectangle":
      return <Rect width={l} height={h} cornerRadius={Math.min(el.arrondi, l / 2, h / 2)} {...remplissageKonva(el.remplissage, l, h)} {...commun} />;
    case "ellipse":
      return <Ellipse x={l / 2} y={h / 2} radiusX={l / 2} radiusY={h / 2} {...remplissageKonva(el.remplissage, l, h, { x: -l / 2, y: -h / 2 })} {...commun} />;
    case "triangle":
      return <Line points={[l / 2, 0, l, h, 0, h]} closed {...remplissageKonva(el.remplissage, l, h)} {...commun} />;
    case "etoile":
      return <Line points={pointsEtoile(l, h)} closed {...remplissageKonva(el.remplissage, l, h)} {...commun} />;
  }
}

function Photo({ el }: { el: ElementImage }) {
  const image = useImageRessource(el.ressource);
  if (!image) {
    // En attendant l'aperçu (ou s'il manque), une plaque grise à la bonne taille.
    return <Rect width={el.largeur} height={el.hauteur} fill="#d9d6ce" />;
  }
  return (
    <ImageKonva
      image={image}
      width={el.largeur}
      height={el.hauteur}
      x={el.retourneH ? el.largeur : 0}
      y={el.retourneV ? el.hauteur : 0}
      scaleX={el.retourneH ? -1 : 1}
      scaleY={el.retourneV ? -1 : 1}
      perfectDrawEnabled={false}
    />
  );
}

function Texte({ el, masque }: { el: ElementTexte; masque: boolean }) {
  return (
    <Text
      text={el.texte}
      width={el.largeur}
      fontFamily={pilePolice(el.police)}
      fontSize={el.taillePolice}
      fontStyle={styleTexte(el.gras, el.italique)}
      textDecoration={el.souligne ? "underline" : ""}
      align={el.alignement}
      {...remplissageKonva(el.couleur, el.largeur, el.hauteur)}
      lineHeight={el.interligne}
      letterSpacing={el.espacement}
      opacity={masque ? 0 : 1}
      perfectDrawEnabled={false}
    />
  );
}

/** Les gestes sont écoutés une fois pour toutes sur la scène (ZoneDeTravail) ; ce gestionnaire
 *  vide évite seulement un avertissement de react-konva. */
const rien = () => {};

interface Proprietes {
  el: ElementPage;
  enEdition?: boolean;
  /** Rendu figé (vignette, export) : ni glisser ni souris. */
  statique?: boolean;
}

export const RenduElement = memo(function RenduElement({ el, enEdition = false, statique = false }: Proprietes) {
  return (
    <Group
      id={statique ? undefined : el.id}
      name={statique ? undefined : "element"}
      x={el.x}
      y={el.y}
      rotation={el.rotation}
      opacity={el.opacite}
      visible={el.visible}
      draggable={!statique && !el.verrouille && !enEdition}
      listening={!statique}
      onDragEnd={statique ? undefined : rien}
    >
      {el.type === "texte" && <Texte el={el} masque={enEdition} />}
      {el.type === "forme" && <Forme el={el} />}
      {el.type === "image" && <Photo el={el} />}
    </Group>
  );
});

/** Une page entière, figée, à sa taille native : fond puis éléments. */
export const PageStatique = memo(function PageStatique({ page, format }: { page: PageEliot; format: Format }) {
  return (
    <>
      <Rect name="fond-page" width={format.largeur} height={format.hauteur} {...remplissageKonva(page.fond, format.largeur, format.hauteur)} listening={false} />
      {page.elements.map((el) => (
        <RenduElement key={el.id} el={el} statique />
      ))}
    </>
  );
});
