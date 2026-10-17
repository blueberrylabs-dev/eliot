// Le rail d'onglets à gauche et son panneau, comme dans Canva. Un clic sur l'onglet actif
// replie le panneau. Le labo photo (étape 5) s'ouvre à la place du panneau, comme « Modifier
// l'image » chez Canva, pour une photo ou un clip vidéo ; un onglet du rail le referme. Le
// panneau « 3D » d'un objet 3D (étape 6) s'ouvre de la même façon.

import { Box, Brush, CloudUpload, FolderOpen, Image as IconeImage, LayoutTemplate, Layers, Music, Palette, Shapes, Type } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { elementsCourants, useEditeur } from "../etat/editeur";
import { useLabo } from "../labo/retouche";
import { PanneauLabo } from "../labo/PanneauLabo";
import { estRetouchable, type ElementObjet3d, type ElementRetouchable } from "../modele/types";
import { Panneau3d } from "../trois/Panneau3d";
import { PanneauBanques } from "../trois/PanneauBanques";
import { useBanques } from "../trois/banques";
import { usePanneau3d } from "../trois/orbite";
import { PanneauAudio } from "./panneaux/PanneauAudio";
import { PanneauCalques } from "./panneaux/PanneauCalques";
import { PanneauDessin } from "./panneaux/PanneauDessin";
import { PanneauElements } from "./panneaux/PanneauElements";
import { PanneauImages } from "./panneaux/PanneauImages";
import { PanneauMarque } from "./panneaux/PanneauMarque";
import { PanneauModeles } from "./panneaux/PanneauModeles";
import { PanneauPhotos } from "./panneaux/PanneauPhotos";
import { PanneauProjets } from "./panneaux/PanneauProjets";
import { PanneauTextes } from "./panneaux/PanneauTextes";

type Onglet = "modeles" | "elements" | "textes" | "photos" | "images" | "3d" | "audio" | "marque" | "dessin" | "projets" | "calques";

const ONGLETS: { id: Onglet; libelle: string; icone: ReactNode; aide: string }[] = [
  { id: "modeles", libelle: "Modèles", icone: <LayoutTemplate size={22} />, aide: "Modèles : des designs prêts à reprendre, et les tiens" },
  { id: "elements", libelle: "Éléments", icone: <Shapes size={22} />, aide: "Éléments : formes, lignes, icônes, emojis, personnages, cadres photo, maquettes, graphiques, tableaux, QR codes" },
  { id: "textes", libelle: "Texte", icone: <Type size={22} />, aide: "Texte : titres, associations de polices, styles enregistrés, styles pour la vidéo" },
  { id: "photos", libelle: "Photos", icone: <IconeImage size={22} />, aide: "Photos : photos et vidéos libres de Pixabay et de Pexels, à poser d'un clic" },
  { id: "images", libelle: "Importer", icone: <CloudUpload size={22} />, aide: "Importer : tes images, tes vidéos et tes modèles 3D, rangés avec le design" },
  { id: "3d", libelle: "3D", icone: <Box size={22} />, aide: "3D : modèles des banques libres (Kenney, Poly Haven, Sketchfab) et environnements de lumière" },
  { id: "audio", libelle: "Audio", icone: <Music size={22} />, aide: "Audio : musiques, bruitages, voix au micro ou de synthèse, pour une page vidéo" },
  { id: "marque", libelle: "Marque", icone: <Palette size={22} />, aide: "Marque : tes couleurs, tes polices, tes logos et tes jingles, gardés d'un design à l'autre" },
  { id: "dessin", libelle: "Dessin", icone: <Brush size={22} />, aide: "Dessin : crayon, marqueur, surligneur et gomme, à main levée" },
  { id: "projets", libelle: "Projets", icone: <FolderOpen size={22} />, aide: "Projets : tes autres designs ; reprendre leurs pages, leurs photos ou leurs sons dans celui-ci, ou les ouvrir" },
  { id: "calques", libelle: "Calques", icone: <Layers size={22} />, aide: "Calques : l'ordre des objets, leurs noms ; glisser une ligne pour passer devant ou derrière" },
];

export function BarreLaterale() {
  const [onglet, setOnglet] = useState<Onglet | null>("elements");
  const ouvert = useLabo((s) => s.ouvert);
  // Une photo, un clip, ou la photo d'un cadre ou d'une maquette (vérification de l'étape 5).
  const photo = useEditeur((s) => (ouvert ? elementsCourants(s).find((e) => e.id === ouvert && estRetouchable(e)) as ElementRetouchable | undefined : undefined));
  const selection = useEditeur(useShallow((s) => s.selection));
  const seulePhoto = useEditeur((s) => (s.selection.length === 1 ? elementsCourants(s).find((e) => e.id === s.selection[0] && estRetouchable(e))?.id : undefined));
  const ouvert3d = usePanneau3d((s) => s.ouvert);
  const objet = useEditeur((s) => (ouvert3d ? (elementsCourants(s).find((e) => e.id === ouvert3d && e.type === "objet3d") as ElementObjet3d | undefined) : undefined));
  const seulObjet = useEditeur((s) => (s.selection.length === 1 ? elementsCourants(s).find((e) => e.id === s.selection[0] && e.type === "objet3d")?.id : undefined));
  // Le panneau 3D suit l'objet choisi, et se ferme si son objet disparaît.
  useEffect(() => {
    if (ouvert3d && seulObjet && seulObjet !== ouvert3d) usePanneau3d.setState({ ouvert: seulObjet });
  }, [ouvert3d, seulObjet]);
  useEffect(() => {
    if (ouvert3d && !objet) usePanneau3d.setState({ ouvert: null });
  }, [ouvert3d, objet]);
  // Le labo et le panneau 3D ne s'ouvrent pas ensemble : le dernier ouvert l'emporte.
  useEffect(() => {
    if (ouvert) usePanneau3d.setState({ ouvert: null });
  }, [ouvert]);
  const special = !!photo || !!objet;
  // La section Lumière du panneau 3D ouvre l'onglet 3D sur ses environnements.
  const demande = useBanques((s) => s.demande);
  useEffect(() => {
    if (!demande) return;
    useLabo.setState({ ouvert: null });
    usePanneau3d.setState({ ouvert: null });
    setOnglet("3d");
  }, [demande]);
  // Le labo suit la photo choisie ; il se ferme si sa photo disparaît (autre page, supprimée).
  useEffect(() => {
    if (ouvert && seulePhoto && seulePhoto !== ouvert) useLabo.setState({ ouvert: seulePhoto });
  }, [ouvert, seulePhoto, selection]);
  useEffect(() => {
    if (ouvert && !photo) useLabo.setState({ ouvert: null, geste: false, avant: false });
  }, [ouvert, photo]);
  const choisir = (o: Onglet) => {
    if (ouvert || ouvert3d) {
      useLabo.setState({ ouvert: null });
      usePanneau3d.setState({ ouvert: null });
      setOnglet(o);
      return;
    }
    setOnglet(onglet === o ? null : o);
  };
  return (
    <aside className="flex shrink-0">
      <nav className="flex w-[72px] flex-col items-center gap-1 overflow-y-auto border-r border-neutral-200 bg-white py-2 defilement-fin">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            data-onglet={o.id}
            title={o.aide}
            onClick={() => choisir(o.id)}
            className={`flex w-16 flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium ${onglet === o.id && !special ? "bg-accent-50 text-accent-700" : "text-neutral-600 hover:bg-neutral-100"}`}
          >
            {o.icone}
            {o.libelle}
          </button>
        ))}
      </nav>
      {photo && (
        <div key={`labo-${photo.id}`} className="w-[320px] overflow-y-auto border-r border-neutral-200 bg-white p-4 defilement-fin">
          <PanneauLabo el={photo} />
        </div>
      )}
      {!photo && objet && (
        <div key={`objet3d-${objet.id}`} className="w-[320px] overflow-y-auto border-r border-neutral-200 bg-white p-4 defilement-fin">
          <Panneau3d el={objet} />
        </div>
      )}
      {!special && onglet && (
        // Une clé par onglet : chaque panneau s'ouvre en haut, pas au défilement du précédent.
        <div key={onglet} className="w-[320px] overflow-y-auto border-r border-neutral-200 bg-white p-4 defilement-fin">
          {onglet === "modeles" && <PanneauModeles />}
          {onglet === "elements" && <PanneauElements />}
          {onglet === "textes" && <PanneauTextes />}
          {onglet === "photos" && <PanneauPhotos />}
          {onglet === "images" && <PanneauImages />}
          {onglet === "3d" && <PanneauBanques />}
          {onglet === "audio" && <PanneauAudio />}
          {onglet === "marque" && <PanneauMarque />}
          {onglet === "dessin" && <PanneauDessin />}
          {onglet === "projets" && <PanneauProjets />}
          {onglet === "calques" && <PanneauCalques />}
        </div>
      )}
    </aside>
  );
}
