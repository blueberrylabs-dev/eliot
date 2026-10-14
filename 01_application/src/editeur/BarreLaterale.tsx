// Le rail d'onglets à gauche et son panneau, comme dans Canva. Un clic sur l'onglet actif
// replie le panneau.

import { Brush, CloudUpload, Image as IconeImage, LayoutTemplate, Layers, Palette, Shapes, Type } from "lucide-react";
import { useState, type ReactNode } from "react";
import { PanneauCalques } from "./panneaux/PanneauCalques";
import { PanneauDessin } from "./panneaux/PanneauDessin";
import { PanneauElements } from "./panneaux/PanneauElements";
import { PanneauImages } from "./panneaux/PanneauImages";
import { PanneauMarque } from "./panneaux/PanneauMarque";
import { PanneauModeles } from "./panneaux/PanneauModeles";
import { PanneauPhotos } from "./panneaux/PanneauPhotos";
import { PanneauTextes } from "./panneaux/PanneauTextes";

type Onglet = "modeles" | "elements" | "textes" | "photos" | "images" | "marque" | "dessin" | "calques";

const ONGLETS: { id: Onglet; libelle: string; icone: ReactNode }[] = [
  { id: "modeles", libelle: "Modèles", icone: <LayoutTemplate size={22} /> },
  { id: "elements", libelle: "Éléments", icone: <Shapes size={22} /> },
  { id: "textes", libelle: "Texte", icone: <Type size={22} /> },
  { id: "photos", libelle: "Photos", icone: <IconeImage size={22} /> },
  { id: "images", libelle: "Importer", icone: <CloudUpload size={22} /> },
  { id: "marque", libelle: "Marque", icone: <Palette size={22} /> },
  { id: "dessin", libelle: "Dessin", icone: <Brush size={22} /> },
  { id: "calques", libelle: "Calques", icone: <Layers size={22} /> },
];

export function BarreLaterale() {
  const [onglet, setOnglet] = useState<Onglet | null>("elements");
  return (
    <aside className="flex shrink-0">
      <nav className="flex w-[72px] flex-col items-center gap-1 border-r border-neutral-200 bg-white py-2">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            data-onglet={o.id}
            onClick={() => setOnglet(onglet === o.id ? null : o.id)}
            className={`flex w-16 flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium ${onglet === o.id ? "bg-accent-50 text-accent-700" : "text-neutral-600 hover:bg-neutral-100"}`}
          >
            {o.icone}
            {o.libelle}
          </button>
        ))}
      </nav>
      {onglet && (
        // Une clé par onglet : chaque panneau s'ouvre en haut, pas au défilement du précédent.
        <div key={onglet} className="w-[320px] overflow-y-auto border-r border-neutral-200 bg-white p-4 defilement-fin">
          {onglet === "modeles" && <PanneauModeles />}
          {onglet === "elements" && <PanneauElements />}
          {onglet === "textes" && <PanneauTextes />}
          {onglet === "photos" && <PanneauPhotos />}
          {onglet === "images" && <PanneauImages />}
          {onglet === "marque" && <PanneauMarque />}
          {onglet === "dessin" && <PanneauDessin />}
          {onglet === "calques" && <PanneauCalques />}
        </div>
      )}
    </aside>
  );
}
