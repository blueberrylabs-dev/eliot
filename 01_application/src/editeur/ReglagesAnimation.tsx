// Le bouton Animer de la barre de contexte, sur une page vidéo (étape 4, lot 3) : animations
// d'entrée, de sortie et en boucle des éléments choisis, comme dans CapCut. Survoler une
// animation la joue sur la page ; un clic la pose. La durée se règle ici, ou en tirant le bord
// de la zone claire au début (ou à la fin) du clip, dans la frise.

import { Play, WandSparkles } from "lucide-react";
import { useState } from "react";
import { useEditeur } from "../etat/editeur";
import { CATALOGUE, dureeConseillee, type DefinitionAnimation, type GenreAnimation } from "../modele/animation";
import type { ElementPage } from "../modele/types";
import { arreterApercu, montrerAnimation } from "./apercuAnimation";
import { Bulle } from "./Bulle";
import { Curseur } from "./ElementsBarre";

const ONGLETS: { genre: GenreAnimation; libelle: string }[] = [
  { genre: "entree", libelle: "Entrée" },
  { genre: "sortie", libelle: "Sortie" },
  { genre: "boucle", libelle: "Boucle" },
];

/** La partie du clip où l'animation se voit, pour l'aperçu (ms de la page). */
function fenetre(el: ElementPage, genre: GenreAnimation, duree: number): [number, number] {
  const { debut, fin } = el.temps!;
  if (genre === "entree") return [debut, Math.min(fin - 1, debut + duree + 400)];
  if (genre === "sortie") return [Math.max(debut, fin - duree - 400), fin - 1];
  return [debut, Math.min(fin - 1, debut + Math.max(2000, 2 * duree))];
}

const secondes = (ms: number) => Math.round(ms / 100) / 10;

export function ReglagesAnimation({ choisis }: { choisis: ElementPage[] }) {
  const [genre, setGenre] = useState<GenreAnimation>("entree");
  const etat = useEditeur.getState();
  const premier = choisis[0];
  if (!premier?.temps) return null;
  const ids = choisis.map((e) => e.id);
  const textes = choisis.every((e) => e.type === "texte");
  const actuelle = premier.animations?.[genre];
  const longueur = premier.temps.fin - premier.temps.debut;
  const liste = CATALOGUE[genre].filter((d) => !d.texte || textes);

  const essayer = (d: DefinitionAnimation | null) => {
    const animation = d ? { nom: d.nom, duree: dureeConseillee(genre, d.nom, premier) } : null;
    const [debut, fin] = fenetre(premier, genre, animation?.duree ?? 600);
    montrerAnimation(premier.id, debut, fin, { genre, animation });
  };
  const poser = (d: DefinitionAnimation | null) => {
    const animation = d ? { nom: d.nom, duree: actuelle?.nom === d.nom ? actuelle.duree : dureeConseillee(genre, d.nom, premier) } : null;
    etat.definirAnimations(ids, genre, animation);
    if (animation) {
      const [debut, fin] = fenetre(premier, genre, animation.duree);
      montrerAnimation(premier.id, debut, fin);
    } else arreterApercu();
  };
  const revoir = () => {
    if (!actuelle) return;
    const [debut, fin] = fenetre(premier, genre, actuelle.duree);
    montrerAnimation(premier.id, debut, fin);
  };

  const vignette = (actif: boolean) =>
    `rounded-md border px-1.5 py-2 text-[11px] leading-tight ${actif ? "border-accent-500 bg-accent-50 font-medium text-accent-700" : "border-neutral-200 text-neutral-700 hover:border-accent-400 hover:bg-accent-50"}`;
  const marque = (g: GenreAnimation) => !!premier.animations?.[g];

  return (
    <Bulle
      titre="Animer : entrée, sortie, boucle"
      largeur={340}
      donneesBouton={{ "data-animer": "" }}
      bouton={
        <>
          <WandSparkles size={16} />
          <span className="text-sm">Animer</span>
          {(marque("entree") || marque("sortie") || marque("boucle")) && <span className="h-1.5 w-1.5 rounded-full bg-accent-600" />}
        </>
      }
    >
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-neutral-100 p-0.5">
        {ONGLETS.map((o) => (
          <button key={o.genre} data-genre={o.genre} onClick={() => setGenre(o.genre)} className={`flex items-center justify-center gap-1 rounded-md py-1 text-xs ${genre === o.genre ? "bg-white font-medium text-neutral-900 shadow-sm" : "text-neutral-600"}`}>
            {o.libelle}
            {marque(o.genre) && <span className="h-1.5 w-1.5 rounded-full bg-accent-600" />}
          </button>
        ))}
      </div>
      <div className="mb-3 grid grid-cols-3 gap-1" onPointerLeave={() => arreterApercu()}>
        <button data-animation="" className={vignette(!actuelle)} onClick={() => poser(null)}>
          Aucune
        </button>
        {liste.map((d) => (
          <button key={d.nom} data-animation={d.nom} className={vignette(actuelle?.nom === d.nom)} onPointerEnter={() => essayer(d)} onClick={() => poser(d)}>
            {d.libelle}
          </button>
        ))}
      </div>
      {actuelle && !(genre === "boucle" && actuelle.nom === "zoom-lent") && (
        <Curseur
          libelle={genre === "boucle" ? "Durée d'un tour" : "Durée"}
          valeur={secondes(actuelle.duree)}
          min={genre === "boucle" ? 0.2 : 0.1}
          max={genre === "boucle" ? 6 : Math.max(0.2, Math.min(6, secondes(longueur)))}
          pas={0.1}
          unite=" s"
          surChange={(v) => etat.definirAnimations(ids, genre, { nom: actuelle.nom, duree: Math.round(v * 1000) })}
        />
      )}
      {actuelle && (
        <button onClick={revoir} className="mb-2 flex items-center gap-1 text-xs text-accent-700 hover:underline">
          <Play size={12} /> Revoir
        </button>
      )}
      <p className="text-xs text-neutral-500">
        {genre === "boucle"
          ? "Se répète tout le long du clip, avec l'entrée et la sortie."
          : `Dans la frise, la zone claire au ${genre === "entree" ? "début" : "bout"} du clip montre l'animation : tire son bord pour changer sa durée.`}
        {choisis.length > 1 ? ` S'applique aux ${choisis.length} éléments choisis.` : ""}
      </p>
    </Bulle>
  );
}
