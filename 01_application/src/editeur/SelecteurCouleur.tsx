// Choix d'une couleur : couleurs de la marque, du document, palette de départ, sélecteur du
// système, pipette (étape 7, lot 4 : un clic sur la page en prend la couleur) ; et, là où c'est
// permis (fond, forme, texte), un dégradé linéaire ou radial.

import { Pipette } from "lucide-react";
import { useState } from "react";
import { useEditeur } from "../etat/editeur";
import { useMarque } from "../etat/marque";
import { usePipette } from "../etat/pipette";
import { couleurPrincipale, type Couleur, type Degrade } from "../modele/types";
import { Bulle } from "./Bulle";
import { cssDeCouleur, memeCouleur } from "./couleurs";

const PALETTE = [
  "#000000", "#545454", "#a6a6a6", "#ffffff",
  "#ff3131", "#ff7a59", "#ffbd59", "#ffde59",
  "#7ed957", "#1d9e75", "#5ce1e6", "#38b6ff",
  "#4f46e5", "#8c52ff", "#cb6ce6", "#ff66c4",
];

const lineaire = (angle: number, a: string, b: string): Degrade => ({ type: "lineaire", angle, arrets: [{ position: 0, couleur: a }, { position: 1, couleur: b }] });

const DEGRADES: Degrade[] = [
  lineaire(45, "#ff5f6d", "#ffc371"),
  lineaire(45, "#4f46e5", "#cb6ce6"),
  lineaire(90, "#00c6ff", "#0072ff"),
  lineaire(135, "#11998e", "#38ef7d"),
  lineaire(90, "#f7971e", "#ffd200"),
  lineaire(135, "#232526", "#414345"),
  lineaire(0, "#fc5c7d", "#6a82fb"),
  lineaire(90, "#ffffff", "#e9e7e2"),
  { type: "radial", angle: 0, arrets: [{ position: 0, couleur: "#fdfbfb" }, { position: 1, couleur: "#ebedee" }] },
  { type: "radial", angle: 0, arrets: [{ position: 0, couleur: "#ffde59" }, { position: 1, couleur: "#ff3131" }] },
  { type: "radial", angle: 0, arrets: [{ position: 0, couleur: "#38b6ff" }, { position: 1, couleur: "#1f1f6b" }] },
  { type: "radial", angle: 0, arrets: [{ position: 0, couleur: "#ffffff" }, { position: 1, couleur: "#000000" }] },
];

function couleursDuDocument(): string[] {
  const { document } = useEditeur.getState();
  const vues = new Set<string>();
  const ajouter = (c: Couleur) => (typeof c === "string" ? [c] : c.arrets.map((a) => a.couleur)).forEach((x) => vues.add(x.toLowerCase()));
  for (const page of document.pages) {
    ajouter(page.fond);
    for (const e of page.elements) {
      if (e.type === "texte") {
        ajouter(e.couleur);
        if (e.contour) ajouter(e.contour.couleur);
        if (e.surlignage) ajouter(e.surlignage.couleur);
      }
      if (e.type === "forme") {
        ajouter(e.remplissage);
        if (e.epaisseurContour > 0) ajouter(e.contour);
      }
      if (e.type === "icone" || e.type === "qr" || e.type === "dessin") ajouter(e.couleur);
      if (e.type === "graphique") e.series.forEach((s) => ajouter(s.couleur));
      if (e.type === "tableau") ajouter(e.fondEntete);
    }
  }
  return [...vues].slice(0, 18);
}

const hexValide = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : "#000000");

/** La pipette : la bulle se ferme, le pointeur devient un viseur sur la page (Pipette.tsx). */
function BoutonPipette({ recevoir, cote, titre, libelle }: { recevoir: (hex: string) => void; cote: string; titre: string; libelle?: string }) {
  return (
    <button
      data-pipette={cote}
      title={`${titre} Échap pour annuler.`}
      onClick={() => usePipette.getState().commencer(recevoir)}
      className="flex h-7 shrink-0 items-center gap-1 rounded border border-neutral-300 px-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
    >
      <Pipette size={14} />
      {libelle}
    </button>
  );
}

interface Proprietes {
  valeur: Couleur;
  surChoix: (couleur: Couleur) => void;
  titre: string;
  /** Petit libellé au-dessus de la pastille (« A » pour un texte). */
  lettre?: string;
  /** Propose l'onglet Dégradé. */
  degrade?: boolean;
}

function EditeurDegrade({ valeur, surChoix }: { valeur: Degrade; surChoix: (d: Degrade) => void }) {
  const [debut, fin] = [valeur.arrets[0]?.couleur ?? "#ffffff", valeur.arrets[valeur.arrets.length - 1]?.couleur ?? "#000000"];
  const avec = (modif: Partial<Degrade>) => surChoix({ ...valeur, ...modif });
  const arrets = (a: string, b: string) => [{ position: 0, couleur: a }, { position: 1, couleur: b }];
  return (
    <div className="mt-3 rounded-lg border border-neutral-200 p-2">
      <div className="mb-2 h-6 rounded-md border border-neutral-200" style={{ background: cssDeCouleur(valeur) }} />
      <div className="mb-2 flex items-center gap-2 text-xs text-neutral-600">
        <input type="color" value={hexValide(debut)} onChange={(e) => avec({ arrets: arrets(e.target.value, fin) })} className="h-7 w-9 cursor-pointer rounded border border-neutral-300" title="Couleur de départ" />
        <BoutonPipette cote="debut" titre="Pipette : la couleur de départ, prise d'un clic sur la page." recevoir={(hex) => avec({ arrets: arrets(hex, fin) })} />
        <input type="color" value={hexValide(fin)} onChange={(e) => avec({ arrets: arrets(debut, e.target.value) })} className="h-7 w-9 cursor-pointer rounded border border-neutral-300" title="Couleur d'arrivée" />
        <BoutonPipette cote="fin" titre="Pipette : la couleur d'arrivée, prise d'un clic sur la page." recevoir={(hex) => avec({ arrets: arrets(debut, hex) })} />
        <button className="rounded border border-neutral-300 px-1.5 py-1 hover:bg-neutral-50" title="Inverser" onClick={() => avec({ arrets: arrets(fin, debut) })}>
          ⇄
        </button>
      </div>
      <label className="mb-2 flex items-center justify-between text-xs text-neutral-600">
        Forme
        <select value={valeur.type} onChange={(e) => avec({ type: e.target.value as Degrade["type"] })} className="h-7 rounded border border-neutral-300 bg-white px-1 text-xs">
          <option value="lineaire">Linéaire</option>
          <option value="radial">Radial</option>
        </select>
      </label>
      {valeur.type === "lineaire" && (
        <label className="block text-xs text-neutral-600">
          <span className="mb-1 flex justify-between">
            Angle <span className="tabular-nums">{Math.round(valeur.angle)}°</span>
          </span>
          <input type="range" min={0} max={360} step={1} value={valeur.angle} onChange={(e) => avec({ angle: Number(e.target.value) })} className="w-full accent-accent-600" />
        </label>
      )}
    </div>
  );
}

export function SelecteurCouleur({ valeur, surChoix, titre, lettre, degrade = false }: Proprietes) {
  const [onglet, setOnglet] = useState<"uni" | "degrade">(typeof valeur === "string" ? "uni" : "degrade");
  const couleursMarque = useMarque((s) => s.kit.couleurs);
  const pastille = (c: string) => (
    <button
      key={c}
      title={c}
      onClick={() => surChoix(c)}
      className={`h-7 w-7 rounded-md border ${typeof valeur === "string" && c.toLowerCase() === valeur.toLowerCase() ? "border-accent-600 ring-2 ring-accent-200" : "border-neutral-300"}`}
      style={{ background: c }}
    />
  );
  const ongletClasse = (actif: boolean) => `flex-1 rounded-md py-1 text-xs font-medium ${actif ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"}`;

  return (
    <Bulle
      titre={titre}
      largeur={248}
      bouton={
        <span className="flex flex-col items-center">
          {lettre && <span className="text-sm leading-none font-bold text-neutral-800">{lettre}</span>}
          <span className={`rounded-sm border border-neutral-300 ${lettre ? "mt-0.5 h-1.5 w-5" : "h-5 w-5"}`} style={{ background: cssDeCouleur(valeur) }} />
        </span>
      }
    >
      {degrade && (
        <div className="mb-3 flex gap-1 rounded-lg bg-neutral-100 p-0.5">
          <button className={ongletClasse(onglet === "uni")} onClick={() => setOnglet("uni")}>
            Uni
          </button>
          <button className={ongletClasse(onglet === "degrade")} onClick={() => setOnglet("degrade")}>
            Dégradé
          </button>
        </div>
      )}
      {onglet === "uni" || !degrade ? (
        <>
          {couleursMarque.length > 0 && (
            <>
              <p className="mb-1.5 text-xs font-medium text-neutral-500">Couleurs de la marque</p>
              <div className="mb-3 grid grid-cols-6 gap-1.5">{couleursMarque.map((c) => pastille(c.valeur))}</div>
            </>
          )}
          <p className="mb-1.5 text-xs font-medium text-neutral-500">Couleurs du document</p>
          <div className="mb-3 grid grid-cols-6 gap-1.5">{couleursDuDocument().map(pastille)}</div>
          <p className="mb-1.5 text-xs font-medium text-neutral-500">Palette</p>
          <div className="mb-3 grid grid-cols-6 gap-1.5">{PALETTE.map(pastille)}</div>
          <div className="flex items-center gap-2">
            <label className="flex flex-1 items-center gap-2 text-xs text-neutral-600">
              <input type="color" value={hexValide(couleurPrincipale(valeur))} onChange={(e) => surChoix(e.target.value)} className="h-7 w-10 cursor-pointer rounded border border-neutral-300" />
              Autre couleur
            </label>
            <BoutonPipette cote="uni" titre="Pipette : prendre une couleur d'un clic sur la page (photos comprises)." libelle="Pipette" recevoir={surChoix} />
          </div>
        </>
      ) : (
        <>
          <p className="mb-1.5 text-xs font-medium text-neutral-500">Dégradés prêts</p>
          <div className="grid grid-cols-6 gap-1.5">
            {DEGRADES.map((d, i) => (
              <button
                key={i}
                onClick={() => surChoix(d)}
                className={`h-7 w-7 rounded-md border ${memeCouleur(d, valeur) ? "border-accent-600 ring-2 ring-accent-200" : "border-neutral-300"}`}
                style={{ background: cssDeCouleur(d) }}
                title={d.type === "radial" ? "Radial" : `Linéaire, ${d.angle}°`}
              />
            ))}
          </div>
          <EditeurDegrade valeur={typeof valeur === "string" ? lineaire(90, valeur, "#ffffff") : valeur} surChoix={surChoix} />
        </>
      )}
    </Bulle>
  );
}
