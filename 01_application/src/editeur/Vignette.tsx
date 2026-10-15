// Une page en petit, dessinée avec les mêmes composants que la zone de travail. Elle ne se
// redessine que quand sa page change.

import { memo } from "react";
import { Group, Layer, Stage } from "react-konva";
import type { Format, PageEliot } from "../modele/types";
import { PageStatique } from "./RenduElement";

export const Vignette = memo(function Vignette({ page, format, largeur }: { page: PageEliot; format: Format; largeur: number }) {
  const echelle = largeur / format.largeur;
  const hauteur = Math.max(1, Math.round(format.hauteur * echelle));
  return (
    <div className="pointer-events-none" style={{ width: largeur, height: hauteur }}>
      <Stage width={largeur} height={hauteur} listening={false}>
        <Layer listening={false}>
          <Group scaleX={echelle} scaleY={echelle}>
            <PageStatique page={page} format={format} sansEffets />
          </Group>
        </Layer>
      </Stage>
    </div>
  );
});
