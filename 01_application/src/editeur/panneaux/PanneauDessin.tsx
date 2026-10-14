// Le panneau Dessin : stylo, marqueur, surligneur et gomme, comme dans Canva. Tant que le
// panneau est ouvert, la souris dessine sur la page ; chaque trait devient un objet qu'on peut
// ensuite déplacer, agrandir ou recolorer. Échap (ou « Sélectionner ») rend la main.

import { Eraser, Highlighter, MousePointer2, PenLine, PenTool } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useEditeur } from "../../etat/editeur";
import { useMarque } from "../../etat/marque";
import { OUTILS_DESSIN, type OutilCrayon, type ReglagesDessin } from "../../modele/dessin";

const COULEURS = ["#1f1f1d", "#ffffff", "#ff3131", "#ff7a59", "#ffde59", "#7ed957", "#38b6ff", "#4f46e5", "#cb6ce6", "#ff66c4"];

// Les derniers réglages, gardés le temps de la session (et d'un outil à l'autre).
let derniers: ReglagesDessin = { outil: "stylo", couleur: "#1f1f1d", epaisseur: OUTILS_DESSIN.stylo.epaisseur };
const epaisseurs: Record<OutilCrayon, number> = { stylo: OUTILS_DESSIN.stylo.epaisseur, marqueur: OUTILS_DESSIN.marqueur.epaisseur, surligneur: OUTILS_DESSIN.surligneur.epaisseur, gomme: 40 };

const OUTILS: { id: OutilCrayon; libelle: string; icone: ReactNode }[] = [
  { id: "stylo", libelle: "Stylo", icone: <PenLine size={20} /> },
  { id: "marqueur", libelle: "Marqueur", icone: <PenTool size={20} /> },
  { id: "surligneur", libelle: "Surligneur", icone: <Highlighter size={20} /> },
  { id: "gomme", libelle: "Gomme", icone: <Eraser size={20} /> },
];

export function PanneauDessin() {
  const dessin = useEditeur((s) => s.dessin);
  const definir = useEditeur((s) => s.definirDessin);
  const couleursMarque = useMarque((s) => s.kit.couleurs);

  // Ouvrir le panneau, c'est prendre le crayon ; le fermer le repose.
  useEffect(() => {
    useEditeur.getState().definirDessin(derniers);
    return () => useEditeur.getState().definirDessin(null);
  }, []);

  const changer = (modif: Partial<ReglagesDessin>) => {
    const base = dessin ?? derniers;
    const suivant = { ...base, ...modif };
    if (modif.outil) suivant.epaisseur = epaisseurs[modif.outil];
    if (modif.epaisseur) epaisseurs[suivant.outil] = modif.epaisseur;
    derniers = suivant;
    definir(suivant);
  };

  const courant = dessin ?? derniers;
  const couleurs = [...new Set([...couleursMarque.map((c) => c.valeur), ...COULEURS])];
  const bouton = (actif: boolean) => `flex flex-col items-center gap-1 rounded-lg border py-2 text-[11px] ${actif ? "border-accent-500 bg-accent-50 text-accent-700" : "border-neutral-200 text-neutral-700 hover:bg-neutral-50"}`;

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-neutral-800">Dessin</p>
      <div className="mb-4 grid grid-cols-5 gap-1.5">
        <button title="Sélectionner (Échap)" onClick={() => definir(null)} className={bouton(!dessin)}>
          <MousePointer2 size={20} />
          Choisir
        </button>
        {OUTILS.map((o) => (
          <button key={o.id} data-outil={o.id} title={o.libelle} onClick={() => changer({ outil: o.id })} className={bouton(dessin?.outil === o.id)}>
            {o.icone}
            {o.libelle}
          </button>
        ))}
      </div>

      {courant.outil !== "gomme" && (
        <>
          <p className="mb-1.5 text-xs font-medium text-neutral-500">Couleur</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {couleurs.map((c) => (
              <button
                key={c}
                title={c}
                data-couleur-dessin={c}
                onClick={() => changer({ couleur: c })}
                className={`h-7 w-7 rounded-full border ${courant.couleur === c ? "border-accent-600 ring-2 ring-accent-200" : "border-neutral-300"}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <label className="mb-4 flex items-center gap-2 text-xs text-neutral-600">
            <input type="color" value={courant.couleur} onChange={(e) => changer({ couleur: e.target.value })} className="h-7 w-10 cursor-pointer rounded border border-neutral-300" />
            Autre couleur
          </label>
        </>
      )}

      <label className="block text-xs text-neutral-600">
        <span className="mb-1 flex justify-between">
          {courant.outil === "gomme" ? "Taille de la gomme" : "Épaisseur"} <span className="tabular-nums">{courant.epaisseur} px</span>
        </span>
        <input type="range" min={2} max={courant.outil === "gomme" ? 160 : 120} step={1} value={courant.epaisseur} onChange={(e) => changer({ epaisseur: Number(e.target.value) })} className="w-full accent-accent-600" />
      </label>

      {courant.outil !== "gomme" && (
        <div className="mt-4 flex h-16 items-center justify-center rounded-lg border border-neutral-200 bg-[repeating-conic-gradient(#f4f4f4_0_25%,#fff_0_50%)] bg-[length:14px_14px]">
          <svg viewBox="0 0 200 50" className="h-12 w-48">
            <path
              d="M10 32 C 50 6, 80 46, 110 24 S 170 14, 190 28"
              fill="none"
              stroke={courant.couleur}
              strokeWidth={Math.min(30, Math.max(1.5, courant.epaisseur / 3))}
              strokeLinecap={OUTILS_DESSIN[courant.outil].bout}
              opacity={OUTILS_DESSIN[courant.outil].opacite}
            />
          </svg>
        </div>
      )}

      <p className="mt-4 text-xs text-neutral-500">
        Dessine sur la page à la souris ou au stylet. Chaque trait devient un objet : Échap, puis clique dessus pour le déplacer, l'agrandir ou changer sa couleur. La gomme efface les traits qu'elle touche.
      </p>
    </div>
  );
}
