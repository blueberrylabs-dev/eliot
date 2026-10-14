// Rendu Konva du dessin à main levée, des graphiques et des tableaux. Les calculs de place
// vivent dans le modèle (`modele/graphiques.ts`, `modele/tableaux.ts`) ; ici, on ne fait que
// traduire leurs formes en nœuds Konva.

import { memo, useMemo } from "react";
import { Arc, Circle, Group, Line, Rect, Text } from "react-konva";
import { OUTILS_DESSIN } from "../modele/dessin";
import { disposerGraphique, type Primitive } from "../modele/graphiques";
import { mesurePolice } from "../modele/mesure";
import { disposerTableau, INTERLIGNE_TABLEAU } from "../modele/tableaux";
import type { ElementDessin, ElementGraphique, ElementTableau, Ombre } from "../modele/types";
import { pilePolice, useVersionPolices } from "../polices";

function ombreKonva(ombre: Ombre | undefined): Record<string, unknown> {
  if (!ombre || ombre.opacite <= 0) return {};
  return { shadowColor: ombre.couleur, shadowBlur: ombre.flou, shadowOffsetX: ombre.x, shadowOffsetY: ombre.y, shadowOpacity: ombre.opacite, shadowForStrokeEnabled: false };
}

export function Dessin({ el }: { el: ElementDessin }) {
  const reglage = OUTILS_DESSIN[el.outil] ?? OUTILS_DESSIN.stylo;
  const sx = el.largeur / el.vue.largeur;
  const sy = el.hauteur / el.vue.hauteur;
  return (
    <>
      <Group scaleX={sx} scaleY={sy}>
        <Line
          points={el.points}
          stroke={el.couleur}
          strokeWidth={el.epaisseur}
          lineCap={reglage.bout}
          lineJoin="round"
          tension={el.points.length > 4 ? 0.45 : 0}
          opacity={reglage.opacite}
          // Le surligneur teinte ce qu'il recouvre au lieu de le cacher.
          globalCompositeOperation={el.outil === "surligneur" ? "multiply" : "source-over"}
          hitStrokeWidth={Math.max(el.epaisseur, 18 / Math.max(0.1, Math.min(sx, sy)))}
          perfectDrawEnabled={false}
          {...ombreKonva(el.ombre)}
        />
      </Group>
    </>
  );
}

/** Un texte posé par son point d'accroche (gauche, centre ou droite ; haut, milieu ou bas). */
function TexteAccroche({ f, police }: { f: Extract<Primitive, { k: "texte" }>; police: string }) {
  // La boîte du texte colle à sa largeur réelle : le cadre de sélection du graphique reste juste.
  const largeur = Math.ceil(mesurePolice(police)(f.texte, f.taille, f.gras)) + 2;
  const x = f.aligner === "left" ? f.x : f.aligner === "center" ? f.x - largeur / 2 : f.x - largeur;
  const h = f.taille * 1.2;
  const y = f.base === "top" ? f.y : f.base === "middle" ? f.y - h / 2 : f.y - h;
  return <Text x={x} y={y} width={largeur} height={h} text={f.texte} fontSize={f.taille} fontFamily={pilePolice(police)} fontStyle={f.gras ? "bold" : "normal"} fill={f.couleur} align={f.aligner} verticalAlign="middle" wrap="none" listening={false} perfectDrawEnabled={false} />;
}

export const Graphique = memo(function Graphique({ el }: { el: ElementGraphique }) {
  // Quand une police finit de se charger, les largeurs de texte changent : on recalcule.
  const version = useVersionPolices();
  const formes = useMemo(() => disposerGraphique(el, mesurePolice(el.police)), [el, version]);
  const ombre = ombreKonva(el.ombre);
  return (
    <>
      {/* Toute la boîte réagit à la souris, même les vides entre les barres. */}
      <Rect width={el.largeur} height={el.hauteur} fill="rgba(0,0,0,0)" />
      {formes.map((f, i) => {
        switch (f.k) {
          case "rect":
            return <Rect key={i} x={f.x} y={f.y} width={f.l} height={f.h} fill={f.couleur} cornerRadius={f.arrondi} listening={false} perfectDrawEnabled={false} {...(f.ombre ? ombre : {})} />;
          case "ligne":
            return <Line key={i} points={f.points} stroke={f.couleur} strokeWidth={f.epaisseur} opacity={f.opacite ?? 1} lineCap="round" lineJoin="round" listening={false} perfectDrawEnabled={false} />;
          case "aire":
            return <Line key={i} points={f.points} closed fill={f.couleur} opacity={f.opacite} listening={false} perfectDrawEnabled={false} />;
          case "point":
            return <Circle key={i} x={f.x} y={f.y} radius={f.r} fill="#ffffff" stroke={f.couleur} strokeWidth={Math.max(2, f.r * 0.6)} listening={false} perfectDrawEnabled={false} />;
          case "arc":
            return (
              <Arc
                key={i}
                x={f.cx}
                y={f.cy}
                innerRadius={f.interieur}
                outerRadius={f.exterieur}
                angle={f.angle}
                rotation={f.debut}
                fill={f.couleur}
                // Un fin liseré blanc sépare les parts d'un camembert.
                stroke={f.angle < 360 && !f.arrondi ? "#ffffff" : undefined}
                strokeWidth={f.angle < 360 && !f.arrondi ? Math.max(1, f.exterieur * 0.012) : 0}
                listening={false}
                perfectDrawEnabled={false}
                {...(f.ombre ? ombre : {})}
              />
            );
          case "texte":
            return <TexteAccroche key={i} f={f} police={el.police} />;
        }
      })}
    </>
  );
});

export const Tableau = memo(function Tableau({ el, celluleMasquee }: { el: ElementTableau; celluleMasquee?: { ligne: number; colonne: number } | null }) {
  const version = useVersionPolices();
  const d = useMemo(() => disposerTableau(el, mesurePolice(el.police)), [el, version]);
  const bas = d.rangees[d.rangees.length - 1];
  const b = el.bordure;
  const t = el.taillePolice;
  const hLigne = t * INTERLIGNE_TABLEAU;
  return (
    <>
      <Rect width={el.largeur} height={bas} fill={el.fond} {...ombreKonva(el.ombre)} />
      {d.rangees.slice(0, -1).map((y, r) => {
        const fond = el.entete && r === 0 ? el.fondEntete : el.rayures && (r - (el.entete ? 1 : 0)) % 2 === 1 ? el.rayures : null;
        return fond ? <Rect key={`f${r}`} y={y} width={el.largeur} height={d.rangees[r + 1] - y} fill={fond} listening={false} perfectDrawEnabled={false} /> : null;
      })}
      {d.cellules.map((c) => {
        if (celluleMasquee && celluleMasquee.ligne === c.ligne && celluleMasquee.colonne === c.colonne) return null;
        const couleur = el.entete && c.ligne === 0 ? el.texteEntete : el.couleurTexte;
        const hauteurTexte = c.lignes.length * hLigne;
        return (
          <Text
            key={`${c.ligne}-${c.colonne}`}
            x={c.x + el.marge}
            y={c.y + (c.h - hauteurTexte) / 2}
            width={Math.max(1, c.l - 2 * el.marge)}
            text={c.lignes.join("\n")}
            fontSize={t}
            lineHeight={INTERLIGNE_TABLEAU}
            fontFamily={pilePolice(el.police)}
            fontStyle={c.gras ? "bold" : "normal"}
            fill={couleur}
            align={el.alignement}
            wrap="none"
            listening={false}
            perfectDrawEnabled={false}
          />
        );
      })}
      {b.epaisseur > 0 && (
        <>
          {d.rangees.slice(1, -1).map((y, i) => (
            <Line key={`h${i}`} points={[0, y, el.largeur, y]} stroke={b.couleur} strokeWidth={b.epaisseur} listening={false} perfectDrawEnabled={false} />
          ))}
          {d.colonnes.slice(1, -1).map((x, i) => (
            <Line key={`v${i}`} points={[x, 0, x, bas]} stroke={b.couleur} strokeWidth={b.epaisseur} listening={false} perfectDrawEnabled={false} />
          ))}
          <Rect width={el.largeur} height={bas} stroke={b.couleur} strokeWidth={b.epaisseur} listening={false} perfectDrawEnabled={false} />
        </>
      )}
    </>
  );
});
