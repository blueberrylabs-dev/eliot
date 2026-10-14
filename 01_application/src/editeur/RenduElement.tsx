// Un élément du document vers un groupe Konva. Le groupe porte la boîte (position,
// rotation) ; la forme dessinée vit à l'intérieur, dans la boîte [0, largeur] x [0, hauteur].

import { memo } from "react";
import { Ellipse, Group, Image as ImageKonva, Line, Rect, Text } from "react-konva";
import { pointsEtoile, styleTexte } from "../modele/fabriques";
import type { ElementForme, ElementImage, ElementPage, ElementTexte } from "../modele/types";
import { useEditeur } from "../etat/editeur";
import { pilePolice } from "../polices";
import { useImage } from "./images";

function Forme({ el }: { el: ElementForme }) {
  const commun = {
    fill: el.remplissage,
    stroke: el.epaisseurContour > 0 ? el.contour : undefined,
    strokeWidth: el.epaisseurContour,
    perfectDrawEnabled: false,
    strokeScaleEnabled: false,
  };
  const { largeur: l, hauteur: h } = el;
  switch (el.forme) {
    case "rectangle":
      return <Rect width={l} height={h} cornerRadius={Math.min(el.arrondi, l / 2, h / 2)} {...commun} />;
    case "ellipse":
      return <Ellipse x={l / 2} y={h / 2} radiusX={l / 2} radiusY={h / 2} {...commun} />;
    case "triangle":
      return <Line points={[l / 2, 0, l, h, 0, h]} closed {...commun} />;
    case "etoile":
      return <Line points={pointsEtoile(l, h)} closed {...commun} />;
  }
}

function Photo({ el }: { el: ElementImage }) {
  const url = useEditeur((s) => s.ressources[el.ressource]?.urlApercu);
  const image = useImage(url);
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
      fill={el.couleur}
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

export const RenduElement = memo(function RenduElement({ el, enEdition }: { el: ElementPage; enEdition: boolean }) {
  return (
    <Group
      id={el.id}
      name="element"
      x={el.x}
      y={el.y}
      rotation={el.rotation}
      opacity={el.opacite}
      visible={el.visible}
      draggable={!el.verrouille && !enEdition}
      onDragEnd={rien}
    >
      {el.type === "texte" && <Texte el={el} masque={enEdition} />}
      {el.type === "forme" && <Forme el={el} />}
      {el.type === "image" && <Photo el={el} />}
    </Group>
  );
});
