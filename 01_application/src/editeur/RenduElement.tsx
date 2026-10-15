// Un élément du document vers un groupe Konva. Le groupe porte la boîte (position,
// rotation) ; la forme dessinée vit à l'intérieur, dans la boîte [0, largeur] x [0, hauteur].
// Le même rendu sert à la zone de travail, aux vignettes des pages et aux exports.

import type Konva from "konva";
import { memo, useMemo, useRef } from "react";
import { Arrow, Ellipse, Group, Image as ImageKonva, Line, Rect, Shape, Text } from "react-konva";
import QRCode from "qrcode";
import { useImageVecteur } from "../bibliotheque/bibliotheque";
import { useImagePersonnage } from "../bibliotheque/personnages";
import { creuxEtoile, estTrait, pointsEtoile, pointsPolygone, styleTexte, texteAffiche } from "../modele/fabriques";
import { ecranAppareil, placerPhoto, tracerCadre, tracerRectangleArrondi } from "../modele/cadres";
import { couleurPrincipale, type ElementCadre, type ElementEmoji, type ElementForme, type ElementIcone, type ElementImage, type ElementMaquette, type ElementPage, type ElementPersonnage, type ElementQr, type ElementTexte, type ElementVideo, type Format, type Ombre, type PageEliot, type Recadrage } from "../modele/types";
import { pilePolice, useVersionPolices } from "../polices";
import { remplissageKonva } from "./couleurs";
import { useImageRessource } from "./images";
import { Dessin, Graphique, Tableau } from "./RenduDonnees";
import { useLecteurVideo, useLecture } from "./videos";
import { useTemps } from "../etat/temps";
import { visibleA } from "../modele/frise";

/** L'élément se voit-il à l'instant de la tête de lecture (ou à `instant`, pour un rendu
 *  figé) ? Le composant ne se redessine que quand la réponse change. */
function useDansLeTemps(el: ElementPage, instant?: number): boolean {
  const vivant = useTemps((s) => instant !== undefined || !el.temps || visibleA(el, s.tete));
  return instant !== undefined ? visibleA(el, instant) : vivant;
}

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
  return <Plaque el={el} image={image} />;
}

/**
 * Une vidéo. Figée (vignette, export en image), elle montre sa couverture ; dans la zone de
 * travail, sa copie d'aperçu, qui joue quand on la lance ; dans l'aperçu plein écran, elle
 * joue toute seule, en boucle, avec le son.
 */
function Video({ el, statique, anime, image }: { el: ElementVideo; statique: boolean; anime: boolean; image?: CanvasImageSource }) {
  const couverture = useImageRessource(el.ressource);
  const enLecture = useLecture((s) => !!s.enLecture[el.id]);
  const noeud = useRef<Konva.Image>(null);
  const video = useLecteurVideo(el, anime || enLecture, true, noeud, statique && !anime);
  // Figée : l'image exacte de l'instant quand le rendu l'a préparée, sinon la couverture.
  if (statique && !anime) return <Plaque el={el} image={image ?? couverture} />;
  return <Plaque el={el} image={video ?? couverture} noeud={noeud} />;
}

/** Une photo ou l'image courante d'une vidéo dans sa boîte : retournée, coins arrondis,
 *  bordure, ombre. */
function Plaque({ el, image, noeud }: { el: ElementImage | ElementVideo; image: CanvasImageSource | undefined; noeud?: React.Ref<Konva.Image> }) {
  const arrondi = Math.min(el.arrondi ?? 0, el.largeur / 2, el.hauteur / 2);
  if (!image) {
    // En attendant l'aperçu (ou s'il manque), une plaque grise à la bonne taille.
    return <Rect width={el.largeur} height={el.hauteur} cornerRadius={arrondi} fill="#d9d6ce" />;
  }
  const photo = (
    <ImageKonva
      ref={noeud}
      image={image}
      width={el.largeur}
      height={el.hauteur}
      x={el.retourneH ? el.largeur : 0}
      y={el.retourneV ? el.hauteur : 0}
      scaleX={el.retourneH ? -1 : 1}
      scaleY={el.retourneV ? -1 : 1}
      perfectDrawEnabled={false}
      {...(arrondi > 0 ? {} : ombreKonva(el.ombre))}
    />
  );
  const bordure = el.bordure && el.bordure.epaisseur > 0 && (
    <Rect width={el.largeur} height={el.hauteur} cornerRadius={arrondi} stroke={el.bordure.couleur} strokeWidth={el.bordure.epaisseur} listening={false} perfectDrawEnabled={false} />
  );
  if (arrondi <= 0) {
    return (
      <>
        {photo}
        {bordure}
      </>
    );
  }
  // Coins arrondis : la photo est découpée ; l'ombre est portée par une plaque de même forme.
  return (
    <>
      {el.ombre && <Rect width={el.largeur} height={el.hauteur} cornerRadius={arrondi} fill="#ffffff" {...ombreKonva(el.ombre)} listening={false} />}
      <Group clipFunc={(ctx) => tracerRectangleArrondi(ctx as unknown as Parameters<typeof tracerRectangleArrondi>[0], 0, 0, el.largeur, el.hauteur, arrondi)}>{photo}</Group>
      {bordure}
    </>
  );
}

/** Une photo qui couvre une zone, cadrée comme le dit `recadrage`. */
function PhotoCadree({ ressource, largeur, hauteur, recadrage }: { ressource: string; largeur: number; hauteur: number; recadrage: Recadrage }) {
  const image = useImageRessource(ressource);
  if (!image) return <Rect width={largeur} height={hauteur} fill="#d9d6ce" />;
  const p = placerPhoto(image.naturalWidth || image.width, image.naturalHeight || image.height, largeur, hauteur, recadrage);
  return <ImageKonva image={image} x={p.x} y={p.y} width={p.largeur} height={p.hauteur} perfectDrawEnabled={false} />;
}

/** L'invitation d'un cadre vide : une petite montagne et, à l'écran, « Glisse une photo ». */
function CadreVide({ largeur, hauteur, fond, statique, sombre = false }: { largeur: number; hauteur: number; fond: string; statique: boolean; sombre?: boolean }) {
  const cote = Math.min(largeur, hauteur) * 0.22;
  const cx = largeur / 2;
  const cy = hauteur / 2 - (statique ? 0 : cote * 0.25);
  const trait = sombre ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.28)";
  return (
    <>
      <Rect width={largeur} height={hauteur} fill={fond} />
      <Line
        points={[cx - cote / 2, cy + cote / 3, cx - cote / 8, cy - cote / 6, cx + cote / 8, cy + cote / 8, cx + cote / 4, cy, cx + cote / 2, cy + cote / 3]}
        stroke={trait}
        strokeWidth={Math.max(2, cote / 14)}
        lineJoin="round"
        lineCap="round"
        listening={false}
      />
      <Ellipse x={cx + cote / 4} y={cy - cote / 3} radiusX={cote / 10} radiusY={cote / 10} fill={trait} listening={false} />
      {!statique && largeur > 120 && (
        <Text text="Glisse une photo ici" width={largeur} y={cy + cote / 2} align="center" fontSize={Math.max(12, Math.min(largeur, hauteur) * 0.055)} fontFamily={pilePolice("Inter")} fill={trait} listening={false} />
      )}
    </>
  );
}

function Cadre({ el, statique, ajustement }: { el: ElementCadre; statique: boolean; ajustement: boolean }) {
  const { largeur: l, hauteur: h } = el;
  const decouper = (ctx: Konva.Context) => tracerCadre(ctx as unknown as Parameters<typeof tracerCadre>[0], el.forme, l, h);
  return (
    <>
      {/* L'ombre suit la forme du cadre : une plaque de même contour, sous la photo. */}
      {el.ombre && (
        <Shape
          sceneFunc={(ctx, forme) => {
            decouper(ctx);
            ctx.fillStrokeShape(forme);
          }}
          fill="#ffffff"
          {...ombreKonva(el.ombre)}
          listening={false}
        />
      )}
      {/* Pendant l'ajustement, toute la photo se devine autour du cadre, comme dans Canva. */}
      {ajustement && el.ressource && (
        <Group opacity={0.35} listening={false}>
          <PhotoCadree ressource={el.ressource} largeur={l} hauteur={h} recadrage={el.recadrage} />
        </Group>
      )}
      <Group clipFunc={decouper}>
        {el.ressource ? <PhotoCadree ressource={el.ressource} largeur={l} hauteur={h} recadrage={el.recadrage} /> : <CadreVide largeur={l} hauteur={h} fond={el.fond} statique={statique} />}
      </Group>
      {el.bordure && el.bordure.epaisseur > 0 && (
        <Shape
          sceneFunc={(ctx, forme) => {
            decouper(ctx);
            ctx.fillStrokeShape(forme);
          }}
          stroke={el.bordure.couleur}
          strokeWidth={el.bordure.epaisseur}
          listening={false}
        />
      )}
      {/* Toute la boîte réagit à la souris, même les coins découpés d'un cercle. */}
      <Rect width={l} height={h} fill="rgba(0,0,0,0)" />
    </>
  );
}

/** Teinte un peu plus sombre (ou plus claire) d'une couleur, pour les reliefs du boîtier. */
function nuance(hex: string, facteur: number): string {
  const n = parseInt(hex.slice(1), 16);
  const canal = (d: number) => Math.max(0, Math.min(255, Math.round(((n >> d) & 255) * facteur)));
  return `#${[16, 8, 0].map((d) => canal(d).toString(16).padStart(2, "0")).join("")}`;
}

function Maquette({ el, statique, ajustement }: { el: ElementMaquette; statique: boolean; ajustement: boolean }) {
  const { largeur: l, hauteur: h, couleur } = el;
  const ecran = ecranAppareil(el.appareil, l, h);
  const clair = parseInt(couleur.slice(1, 3), 16) > 200;
  const bord = nuance(couleur, clair ? 0.82 : 1.35);
  const decouperEcran = (ctx: Konva.Context) => tracerRectangleArrondi(ctx as unknown as Parameters<typeof tracerRectangleArrondi>[0], 0, 0, ecran.largeur, ecran.hauteur, ecran.rayon);
  const contenuEcran = (
    <>
      {ajustement && el.ressource && (
        <Group x={ecran.x} y={ecran.y} opacity={0.35} listening={false}>
          <PhotoCadree ressource={el.ressource} largeur={ecran.largeur} hauteur={ecran.hauteur} recadrage={el.recadrage} />
        </Group>
      )}
      <Group x={ecran.x} y={ecran.y} clipFunc={decouperEcran}>
        {el.ressource ? (
          <PhotoCadree ressource={el.ressource} largeur={ecran.largeur} hauteur={ecran.hauteur} recadrage={el.recadrage} />
        ) : (
          <CadreVide largeur={ecran.largeur} hauteur={ecran.hauteur} fond="#2a2f3a" statique={statique} sombre />
        )}
      </Group>
    </>
  );
  const ombre = ombreKonva(el.ombre);
  switch (el.appareil) {
    case "telephone":
    case "tablette":
    case "montre": {
      const corps = el.appareil === "montre" ? { x: 0, l: l * 0.92, rayon: l * 0.24 } : { x: 0, l, rayon: el.appareil === "telephone" ? l * 0.155 : l * 0.065 };
      return (
        <>
          {el.appareil === "montre" && (
            <>
              <Rect x={l * 0.88} y={h * 0.27} width={l * 0.12} height={h * 0.15} cornerRadius={l * 0.03} fill={bord} />
              <Rect x={l * 0.89} y={h * 0.5} width={l * 0.07} height={h * 0.13} cornerRadius={l * 0.02} fill={bord} />
            </>
          )}
          <Rect x={corps.x} width={corps.l} height={h} cornerRadius={corps.rayon} fill={couleur} stroke={bord} strokeWidth={Math.max(1, l * 0.006)} {...ombre} />
          <Rect x={ecran.x - l * 0.012} y={ecran.y - l * 0.012} width={ecran.largeur + l * 0.024} height={ecran.hauteur + l * 0.024} cornerRadius={ecran.rayon + l * 0.012} fill="#0b0b0d" />
          {contenuEcran}
          {el.appareil === "telephone" && <Rect x={l * 0.35} y={ecran.y + l * 0.03} width={l * 0.3} height={l * 0.085} cornerRadius={l * 0.0425} fill="#0b0b0d" />}
          {el.appareil === "tablette" && <Ellipse x={l / 2} y={ecran.y / 2} radiusX={l * 0.008} radiusY={l * 0.008} fill="#3a3a3c" />}
        </>
      );
    }
    case "ordinateur": {
      const couvercle = { x: l * 0.09, y: 0, l: l * 0.82, h: h * 0.885 };
      return (
        <>
          <Rect x={couvercle.x} y={couvercle.y} width={couvercle.l} height={couvercle.h} cornerRadius={l * 0.018} fill="#0b0b0d" stroke={bord} strokeWidth={Math.max(1, l * 0.003)} {...ombre} />
          {contenuEcran}
          <Ellipse x={l / 2} y={ecran.y / 2} radiusX={l * 0.004} radiusY={l * 0.004} fill="#3a3a3c" />
          <Shape
            sceneFunc={(ctx, forme) => {
              // Le socle, en trapèze vu de face, plus large que l'écran.
              ctx.beginPath();
              ctx.moveTo(couvercle.x - l * 0.02, h * 0.885);
              ctx.lineTo(couvercle.x + couvercle.l + l * 0.02, h * 0.885);
              ctx.lineTo(l, h * 0.955);
              ctx.lineTo(0, h * 0.955);
              ctx.closePath();
              ctx.fillStrokeShape(forme);
            }}
            fill={couleur}
            stroke={bord}
            strokeWidth={Math.max(1, l * 0.002)}
          />
          <Rect x={0} y={h * 0.95} width={l} height={h * 0.05} cornerRadius={[0, 0, l * 0.03, l * 0.03]} fill={nuance(couleur, clair ? 0.85 : 0.75)} />
          <Rect x={l * 0.42} y={h * 0.885} width={l * 0.16} height={h * 0.018} cornerRadius={[0, 0, l * 0.01, l * 0.01]} fill={nuance(couleur, clair ? 0.8 : 0.7)} />
        </>
      );
    }
  }
}

/** Icône ou emoji de la bibliothèque : une image faite depuis son SVG, à la bonne taille. */
function Vecteur({ el }: { el: ElementIcone | ElementEmoji }) {
  const demande = el.type === "icone" ? { collection: el.collection, nom: el.nom, couleur: el.couleur, trait: el.trait } : { collection: el.collection, nom: el.nom };
  const image = useImageVecteur(demande, Math.max(el.largeur, el.hauteur));
  if (!image) return <Rect width={el.largeur} height={el.hauteur} fill="rgba(0,0,0,0)" />;
  return <ImageKonva image={image} width={el.largeur} height={el.hauteur} perfectDrawEnabled={false} {...ombreKonva(el.ombre)} />;
}

/** Un personnage de la bibliothèque : une image faite depuis son SVG (couleurs comprises),
 *  retournée au besoin comme une photo. */
function Personnage({ el }: { el: ElementPersonnage }) {
  const image = useImagePersonnage(el, Math.max(el.largeur, el.hauteur));
  if (!image) return <Rect width={el.largeur} height={el.hauteur} fill="rgba(0,0,0,0)" />;
  return <ImageKonva image={image} x={el.retourneH ? el.largeur : 0} scaleX={el.retourneH ? -1 : 1} width={el.largeur} height={el.hauteur} perfectDrawEnabled={false} {...ombreKonva(el.ombre)} />;
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
  /** La photo du cadre se déplace dans le cadre : le cadre, lui, ne bouge pas. */
  enAjustement?: boolean;
  /** Rendu figé (vignette, export) : ni glisser ni souris. */
  statique?: boolean;
  /** Mode dessin : la souris trace, les objets ne se déplacent pas. */
  fige?: boolean;
  /** Tableau : la cellule en cours d'écriture (son texte est dans la zone de saisie). */
  celluleMasquee?: { ligne: number; colonne: number } | null;
  /** Aperçu plein écran : les vidéos jouent toutes seules. */
  anime?: boolean;
  /** Rendu figé d'une page vidéo : l'instant montré (ms de la page). */
  instant?: number;
  /** Rendu figé : l'image exacte d'une vidéo à cet instant, préparée par le rendu. */
  imageVideo?: CanvasImageSource;
}

export const RenduElement = memo(function RenduElement({ el, enEdition = false, enAjustement = false, statique = false, fige = false, celluleMasquee = null, anime = false, instant, imageVideo }: Proprietes) {
  const dansLeTemps = useDansLeTemps(el, instant);
  return (
    <Group
      id={statique ? undefined : el.id}
      name={statique ? undefined : "element"}
      x={el.x}
      y={el.y}
      rotation={el.rotation}
      opacity={el.opacite}
      visible={el.visible && dansLeTemps}
      draggable={!statique && !fige && !el.verrouille && !enEdition && !enAjustement}
      listening={!statique}
      onDragEnd={statique ? undefined : rien}
    >
      {el.type === "texte" && <Texte el={el} masque={enEdition} />}
      {el.type === "forme" && <Forme el={el} />}
      {el.type === "image" && <Photo el={el} />}
      {el.type === "video" && <Video el={el} statique={statique} anime={anime} image={imageVideo} />}
      {(el.type === "icone" || el.type === "emoji") && <Vecteur el={el} />}
      {el.type === "personnage" && <Personnage el={el} />}
      {el.type === "qr" && <CodeQr el={el} />}
      {el.type === "cadre" && <Cadre el={el} statique={statique} ajustement={enAjustement} />}
      {el.type === "maquette" && <Maquette el={el} statique={statique} ajustement={enAjustement} />}
      {el.type === "dessin" && <Dessin el={el} />}
      {el.type === "graphique" && <Graphique el={el} />}
      {el.type === "tableau" && <Tableau el={el} celluleMasquee={celluleMasquee} />}
    </Group>
  );
});

/** Une page entière, figée, à sa taille native : fond puis éléments. `anime` : les vidéos
 *  jouent (aperçu plein écran ; sur une page vidéo, au rythme de la tête de lecture). Une
 *  page vidéo figée se montre à l'instant `instant` (0 par défaut), avec les images exactes
 *  de ses vidéos quand le rendu les a préparées (`imagesVideo`, par identifiant d'élément). */
export const PageStatique = memo(function PageStatique({ page, format, anime = false, instant, imagesVideo }: { page: PageEliot; format: Format; anime?: boolean; instant?: number; imagesVideo?: Map<string, CanvasImageSource> }) {
  const moment = anime || page.duree === undefined ? undefined : (instant ?? 0);
  return (
    <>
      <Rect name="fond-page" width={format.largeur} height={format.hauteur} {...remplissageKonva(page.fond, format.largeur, format.hauteur)} listening={false} />
      {page.elements.map((el) => (
        <RenduElement key={el.id} el={el} statique anime={anime} instant={moment} imageVideo={imagesVideo?.get(el.id)} />
      ))}
    </>
  );
});
