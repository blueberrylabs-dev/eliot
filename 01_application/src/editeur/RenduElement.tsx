// Un élément du document vers un groupe Konva. Le groupe porte la boîte (position,
// rotation) ; la forme dessinée vit à l'intérieur, dans la boîte [0, largeur] x [0, hauteur].
// Le même rendu sert à la zone de travail, aux vignettes des pages et aux exports.

import type Konva from "konva";
import { memo, useMemo } from "react";
import { Arrow, Ellipse, Group, Image as ImageKonva, Line, Rect, Shape, Text } from "react-konva";
import QRCode from "qrcode";
import { useImageVecteur } from "../bibliotheque/bibliotheque";
import { creuxEtoile, estTrait, pointsEtoile, pointsPolygone, styleTexte, texteAffiche } from "../modele/fabriques";
import { couleurPrincipale, type ElementEmoji, type ElementForme, type ElementIcone, type ElementImage, type ElementPage, type ElementQr, type ElementTexte, type Format, type Ombre, type PageEliot } from "../modele/types";
import { pilePolice, useVersionPolices } from "../polices";
import { remplissageKonva } from "./couleurs";
import { useImageRessource } from "./images";

/** Propriétés d'ombre Konva ; sans ombre, rien (Konva ne calcule alors aucune ombre). */
export function ombreKonva(ombre: Ombre | undefined): Record<string, unknown> {
  if (!ombre || ombre.opacite <= 0) return {};
  return { shadowColor: ombre.couleur, shadowBlur: ombre.flou, shadowOffsetX: ombre.x, shadowOffsetY: ombre.y, shadowOpacity: ombre.opacite, shadowForStrokeEnabled: false };
}

/** Tracé d'un cœur inscrit dans la boîte, en courbes de Bézier. */
function dessinerCoeur(ctx: Konva.Context, l: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(l / 2, h * 0.3);
  ctx.bezierCurveTo(l * 0.5, h * 0.05, l * 0.02, h * 0.02, l * 0.02, h * 0.34);
  ctx.bezierCurveTo(l * 0.02, h * 0.6, l * 0.32, h * 0.78, l / 2, h * 0.98);
  ctx.bezierCurveTo(l * 0.68, h * 0.78, l * 0.98, h * 0.6, l * 0.98, h * 0.34);
  ctx.bezierCurveTo(l * 0.98, h * 0.02, l * 0.5, h * 0.05, l / 2, h * 0.3);
  ctx.closePath();
}

function Trait({ el }: { el: ElementForme }) {
  const { largeur: l, hauteur: h } = el;
  const e = el.epaisseurContour || 1;
  const commun = {
    points: [0, h / 2, l, h / 2],
    stroke: couleurPrincipale(el.remplissage),
    strokeWidth: e,
    lineCap: "round" as const,
    lineJoin: "round" as const,
    dash: el.tirets ? [e * 2.2, e * 1.8] : undefined,
    // Une ligne fine reste facile à attraper à la souris.
    hitStrokeWidth: Math.max(24, e),
    perfectDrawEnabled: false,
    ...ombreKonva(el.ombre),
  };
  if (el.forme === "ligne") return <Line {...commun} />;
  const pointe = e * 3;
  const debut = el.pointes?.debut ?? false;
  const fin = el.pointes?.fin ?? true;
  // La pointe dépasse l'extrémité du trait : on rentre le trait pour qu'elle tienne dans la boîte.
  return (
    <Arrow
      {...commun}
      points={[debut ? pointe * 0.6 : 0, h / 2, fin ? l - pointe * 0.6 : l, h / 2]}
      fill={couleurPrincipale(el.remplissage)}
      pointerLength={pointe}
      pointerWidth={pointe}
      pointerAtBeginning={debut}
      pointerAtEnding={fin}
    />
  );
}

function Forme({ el }: { el: ElementForme }) {
  const { largeur: l, hauteur: h } = el;
  if (estTrait(el.forme)) return <Trait el={el} />;
  const commun = {
    stroke: el.epaisseurContour > 0 ? el.contour : undefined,
    strokeWidth: el.epaisseurContour,
    perfectDrawEnabled: false,
    strokeScaleEnabled: false,
    ...ombreKonva(el.ombre),
  };
  switch (el.forme) {
    case "rectangle":
      return <Rect width={l} height={h} cornerRadius={Math.min(el.arrondi, l / 2, h / 2)} {...remplissageKonva(el.remplissage, l, h)} {...commun} />;
    case "ellipse":
      return <Ellipse x={l / 2} y={h / 2} radiusX={l / 2} radiusY={h / 2} {...remplissageKonva(el.remplissage, l, h, { x: -l / 2, y: -h / 2 })} {...commun} />;
    case "triangle":
      return <Line points={[l / 2, 0, l, h, 0, h]} closed {...remplissageKonva(el.remplissage, l, h)} {...commun} />;
    case "etoile":
      return <Line points={pointsEtoile(l, h, el.cotes ?? 5, creuxEtoile(el.cotes ?? 5))} closed {...remplissageKonva(el.remplissage, l, h)} {...commun} />;
    case "polygone":
      return <Line points={pointsPolygone(l, h, el.cotes ?? 6)} closed {...remplissageKonva(el.remplissage, l, h)} {...commun} />;
    case "coeur":
      return (
        <Shape
          width={l}
          height={h}
          sceneFunc={(ctx, forme) => {
            dessinerCoeur(ctx, l, h);
            ctx.fillStrokeShape(forme);
          }}
          {...remplissageKonva(el.remplissage, l, h)}
          {...commun}
        />
      );
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
      {...ombreKonva(el.ombre)}
    />
  );
}

/** Icône ou emoji de la bibliothèque : une image faite depuis son SVG, à la bonne taille. */
function Vecteur({ el }: { el: ElementIcone | ElementEmoji }) {
  const demande = el.type === "icone" ? { collection: el.collection, nom: el.nom, couleur: el.couleur, trait: el.trait } : { collection: el.collection, nom: el.nom };
  const image = useImageVecteur(demande, Math.max(el.largeur, el.hauteur));
  if (!image) return <Rect width={el.largeur} height={el.hauteur} fill="rgba(0,0,0,0)" />;
  return <ImageKonva image={image} width={el.largeur} height={el.hauteur} perfectDrawEnabled={false} {...ombreKonva(el.ombre)} />;
}

/** Les carrés d'un QR code, recalculés seulement quand le contenu change. */
function useModulesQr(contenu: string, correction: ElementQr["correction"]) {
  return useMemo(() => {
    try {
      const qr = QRCode.create(contenu || " ", { errorCorrectionLevel: correction });
      return { taille: qr.modules.size, sombre: (l: number, c: number) => qr.modules.get(l, c) === 1 };
    } catch {
      return null;
    }
  }, [contenu, correction]);
}

function CodeQr({ el }: { el: ElementQr }) {
  const modules = useModulesQr(el.contenu, el.correction);
  const { largeur: l, hauteur: h } = el;
  // Une marge de deux carrés autour du code quand il a un fond : les lecteurs en ont besoin.
  const marge = el.fond ? 2 : 0;
  return (
    <>
      {el.fond && <Rect width={l} height={h} fill={el.fond} />}
      {modules && (
        <Shape
          width={l}
          height={h}
          fill={el.couleur}
          perfectDrawEnabled={false}
          sceneFunc={(ctx, forme) => {
            const n = modules.taille + marge * 2;
            const pl = l / n;
            const ph = h / n;
            ctx.beginPath();
            for (let ligne = 0; ligne < modules.taille; ligne++) {
              for (let col = 0; col < modules.taille; col++) {
                // Chaque carré déborde d'un cheveu sur le voisin : pas de fines lignes claires entre eux.
                if (modules.sombre(ligne, col)) ctx.rect((col + marge) * pl, (ligne + marge) * ph, pl + 0.5, ph + 0.5);
              }
            }
            ctx.closePath();
            ctx.fillStrokeShape(forme);
          }}
          hitFunc={(ctx, forme) => {
            ctx.beginPath();
            ctx.rect(0, 0, l, h);
            ctx.closePath();
            ctx.fillStrokeShape(forme);
          }}
        />
      )}
    </>
  );
}

function Texte({ el, masque }: { el: ElementTexte; masque: boolean }) {
  // Quand une police finit de se charger, le texte se recompose avec elle.
  const version = useVersionPolices();
  const decoration = [el.souligne ? "underline" : "", el.barre ? "line-through" : ""].filter(Boolean).join(" ");
  const s = el.surlignage;
  return (
    <>
      {s && <Rect x={-s.marge} y={-s.marge} width={el.largeur + 2 * s.marge} height={el.hauteur + 2 * s.marge} cornerRadius={s.arrondi} fill={s.couleur} opacity={masque ? 0.4 : 1} perfectDrawEnabled={false} />}
      <Text
        key={version}
        text={texteAffiche(el)}
        width={el.largeur}
        fontFamily={pilePolice(el.police)}
        fontSize={el.taillePolice}
        fontStyle={styleTexte(el.gras, el.italique)}
        textDecoration={decoration}
        align={el.alignement}
        {...remplissageKonva(el.couleur, el.largeur, el.hauteur)}
        stroke={el.contour && el.contour.epaisseur > 0 ? el.contour.couleur : undefined}
        strokeWidth={el.contour?.epaisseur ?? 0}
        // Le contour passe derrière les lettres : elles gardent leur dessin.
        fillAfterStrokeEnabled
        lineHeight={el.interligne}
        letterSpacing={el.espacement}
        opacity={masque ? 0 : 1}
        perfectDrawEnabled={false}
        {...ombreKonva(el.ombre)}
      />
    </>
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
      {(el.type === "icone" || el.type === "emoji") && <Vecteur el={el} />}
      {el.type === "qr" && <CodeQr el={el} />}
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
