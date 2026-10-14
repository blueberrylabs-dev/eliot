// Le rail d'onglets à gauche et son panneau, comme dans Canva. Un clic sur l'onglet actif
// replie le panneau.

import { Image as IconeImage, Layers, Shapes, Type } from "lucide-react";
import { useState, type ReactNode } from "react";
import { PanneauCalques } from "./panneaux/PanneauCalques";
import { PanneauFormes } from "./panneaux/PanneauFormes";
import { PanneauImages } from "./panneaux/PanneauImages";
import { PanneauTextes } from "./panneaux/PanneauTextes";

type Onglet = "textes" | "formes" | "images" | "calques";

const ONGLETS: { id: Onglet; libelle: string; icone: ReactNode }[] = [
  { id: "textes", libelle: "Textes", icone: <Type size={22} /> },
  { id: "formes", libelle: "Formes", icone: <Shapes size={22} /> },
  { id: "images", libelle: "Images", icone: <IconeImage size={22} /> },
  { id: "calques", libelle: "Calques", icone: <Layers size={22} /> },
];

export function BarreLaterale() {
  const [onglet, setOnglet] = useState<Onglet | null>("textes");
  return (
    <aside className="flex shrink-0">
      <nav className="flex w-[72px] flex-col items-center gap-1 border-r border-neutral-200 bg-white py-2">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            onClick={() => setOnglet(onglet === o.id ? null : o.id)}
            className={`flex w-16 flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium ${onglet === o.id ? "bg-accent-50 text-accent-700" : "text-neutral-600 hover:bg-neutral-100"}`}
          >
            {o.icone}
            {o.libelle}
          </button>
        ))}
      </nav>
      {onglet && (
        <div className="w-[300px] overflow-y-auto border-r border-neutral-200 bg-white p-4 defilement-fin">
          {onglet === "textes" && <PanneauTextes />}
          {onglet === "formes" && <PanneauFormes />}
          {onglet === "images" && <PanneauImages />}
          {onglet === "calques" && <PanneauCalques />}
        </div>
      )}
    </aside>
  );
}
