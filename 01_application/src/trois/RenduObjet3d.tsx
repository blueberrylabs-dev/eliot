// Un objet 3D sur la page (étape 6, lot 1) : la toile rendue par le moteur 3D, posée dans la
// boîte de l'objet comme une photo détourée (son ombre suit la silhouette). Dans la zone de
// travail, le rendu suit le zoom de la vue et la densité de l'écran ; hors écran (export,
// vignettes), la finesse demandée par l'export.

import type Konva from "konva";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Image as ImageKonva, Rect, Text } from "react-konva";
import { useEditeur } from "../etat/editeur";
import { tailleDeRendu } from "../modele/objet3d";
import type { ElementObjet3d, Ombre } from "../modele/types";
import { pilePolice } from "../polices";
import { abonnerEnvironnements, abonnerModele, abonnerRendu, COTE_MAX_RENDU, finesseHorsEcran, reglagesDe, rendreObjet } from "./moteur";
import { cameraAffichee, useOrbite } from "./orbite";

export function RenduObjet3d({ el, statique, ombre }: { el: ElementObjet3d; statique: boolean; ombre: (o: Ombre | undefined) => Record<string, unknown> }) {
  const ressource = useEditeur((s) => s.ressources[el.ressource]);
  const zoom = useEditeur((s) => s.zoom ?? s.zoomAjuste);
  // Hors écran (export, vignettes), le document seul : pas le geste en cours, ni le surlignage.
  const geste = useOrbite((s) => (s.id === el.id && !statique ? s.geste : null));
  const surligne = useOrbite((s) => (!statique && s.surligne?.id === el.id ? s.surligne.matiere : undefined));
  // Un curseur du panneau 3D tiré, ou un glisser sur la page : la toile du moteur en direct.
  const enGeste = useOrbite((s) => !statique && ((s.id === el.id && s.geste !== null) || s.curseur === el.id));
  const [, rafraichir] = useState(0);
  const noeud = useRef<Konva.Image>(null);
  useEffect(() => abonnerModele(el.ressource, () => rafraichir((v) => v + 1)), [el.ressource]);
  useEffect(() => abonnerEnvironnements(() => rafraichir((v) => v + 1)), []);
  useEffect(() => (statique ? undefined : abonnerRendu(el.id, () => rafraichir((v) => v + 1))), [el.id, statique]);
  // La toile reste le même objet quand on la redessine : Konva doit en être prévenu.
  useLayoutEffect(() => {
    noeud.current?.getLayer()?.batchDraw();
  });
  const camera = cameraAffichee(el, geste, el.id);
  let l: number;
  let h: number;
  if (statique) {
    const f = finesseHorsEcran();
    const k = Math.min(f, COTE_MAX_RENDU / Math.max(el.largeur, el.hauteur));
    [l, h] = [el.largeur * k, el.hauteur * k];
  } else {
    [l, h] = tailleDeRendu(el.largeur, el.hauteur, zoom * (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1));
  }
  // Pendant qu'on tourne l'objet, la page montre la toile du moteur elle-même (règle 11).
  const rendu = ressource ? rendreObjet(ressource, reglagesDe(el, camera, surligne), l, h, statique ? `${el.id}#hors-ecran` : el.id, enGeste) : { etat: "chargement" as const };
  if (rendu.etat !== "pret") {
    // Hors écran, un objet qui ne se dessine pas ne laisse rien ; à l'écran, une plaque dit
    // pourquoi.
    if (statique) return null;
    const texte = rendu.etat === "erreur" ? `Modèle 3D illisible : ${rendu.erreur}` : "Modèle 3D…";
    return (
      <>
        <Rect width={el.largeur} height={el.hauteur} fill="rgba(79,70,229,0.06)" stroke="#a5a1f0" strokeWidth={1} dash={[6, 4]} />
        <Text text={texte} width={el.largeur} y={el.hauteur / 2 - 8} align="center" fontSize={Math.max(11, Math.min(18, el.largeur / 20))} fontFamily={pilePolice("Inter")} fill="#6d68c9" listening={false} />
      </>
    );
  }
  return <ImageKonva ref={noeud} image={rendu.toile} width={el.largeur} height={el.hauteur} perfectDrawEnabled={false} {...ombre(el.ombre)} />;
}
