// La barre d'outils qui change selon la sélection : page, texte, forme, image.

import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowDown,
  ArrowUp,
  Blend,
  Bold,
  CopyPlus,
  FlipHorizontal2,
  FlipVertical2,
  Group,
  Italic,
  LayoutGrid,
  Lock,
  LockOpen,
  Minus,
  Paintbrush,
  Plus,
  SlidersHorizontal,
  Trash2,
  Underline,
  Ungroup,
} from "lucide-react";
import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { elementsSelectionnes, pageCourante, useEditeur } from "../etat/editeur";
import type { SensAlignement } from "../modele/geometrie";
import type { Alignement, ElementForme, ElementPage, ElementTexte } from "../modele/types";
import { POLICES, pilePolice } from "../polices";
import { Bulle } from "./Bulle";
import { SelecteurCouleur } from "./SelecteurCouleur";

const bouton = "flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-neutral-700 hover:bg-neutral-100";
const actif = "bg-accent-100 text-accent-700 hover:bg-accent-100";
const separateur = <span className="mx-1.5 h-6 w-px bg-neutral-200" />;

function Bouton({ titre, surClic, enfoncé, children }: { titre: string; surClic: () => void; enfoncé?: boolean; children: ReactNode }) {
  return (
    <button title={titre} onClick={surClic} className={`${bouton} ${enfoncé ? actif : ""}`}>
      {children}
    </button>
  );
}

function ReglagePage() {
  const fond = useEditeur((s) => pageCourante(s).fond);
  const rang = useEditeur((s) => s.document.pages.findIndex((p) => p.id === s.pageActive));
  const nombre = useEditeur((s) => s.document.pages.length);
  const modifierFond = useEditeur((s) => s.modifierFond);
  return (
    <>
      <span className="text-sm font-medium text-neutral-600">{nombre > 1 ? `Page ${rang + 1} sur ${nombre}` : "Page"}</span>
      {separateur}
      <span className="text-sm text-neutral-600">Fond</span>
      <SelecteurCouleur titre="Couleur de fond" degrade valeur={fond} surChoix={(c) => modifierFond(c, "fond")} />
      <span className="ml-4 truncate text-xs text-neutral-400">Astuce : double-clic sur un texte pour l'écrire, Maj+clic pour sélectionner plusieurs objets, Alt+clic pour un seul objet d'un groupe.</span>
    </>
  );
}

const POSITIONS: { sens: SensAlignement; titre: string; icone: ReactNode }[] = [
  { sens: "gauche", titre: "À gauche", icone: <AlignStartVertical size={16} /> },
  { sens: "centre", titre: "Au centre", icone: <AlignCenterVertical size={16} /> },
  { sens: "droite", titre: "À droite", icone: <AlignEndVertical size={16} /> },
  { sens: "haut", titre: "En haut", icone: <AlignStartHorizontal size={16} /> },
  { sens: "milieu", titre: "Au milieu", icone: <AlignCenterHorizontal size={16} /> },
  { sens: "bas", titre: "En bas", icone: <AlignEndHorizontal size={16} /> },
];

function ReglagePosition({ nombreBlocs }: { nombreBlocs: number }) {
  const etat = useEditeur.getState();
  const surPage = nombreBlocs <= 1;
  const case_ = "flex items-center gap-2 rounded-md border border-neutral-200 px-2 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50";
  return (
    <Bulle titre="Position" largeur={260} bouton={<><LayoutGrid size={16} /><span className="text-sm">Position</span></>}>
      <p className="mb-1.5 text-xs font-medium text-neutral-500">{surPage ? "Aligner sur la page" : "Aligner entre eux"}</p>
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {POSITIONS.map((p) => (
          <button key={p.sens} className={case_} onClick={() => etat.alignerSelection(p.sens)}>
            {p.icone}
            {p.titre}
          </button>
        ))}
      </div>
      <p className="mb-1.5 text-xs font-medium text-neutral-500">Répartir l'espace</p>
      <div className="grid grid-cols-2 gap-1.5">
        <button className={case_} disabled={nombreBlocs < 3} onClick={() => etat.repartirSelection("horizontal")} title={nombreBlocs < 3 ? "Sélectionne au moins trois objets" : undefined}>
          <AlignHorizontalDistributeCenter size={16} /> Horizontalement
        </button>
        <button className={case_} disabled={nombreBlocs < 3} onClick={() => etat.repartirSelection("vertical")} title={nombreBlocs < 3 ? "Sélectionne au moins trois objets" : undefined}>
          <AlignVerticalDistributeCenter size={16} /> Verticalement
        </button>
      </div>
    </Bulle>
  );
}

function ReglagesTexte({ textes, modifier }: { textes: ElementTexte[]; modifier: (m: Partial<ElementTexte>, etiquette?: string) => void }) {
  const t = textes[0];
  const taille = (v: number) => modifier({ taillePolice: Math.max(4, Math.min(800, Math.round(v))) }, "taille");
  const alignements: { valeur: Alignement; icone: ReactNode; titre: string }[] = [
    { valeur: "left", icone: <AlignLeft size={16} />, titre: "Aligner à gauche" },
    { valeur: "center", icone: <AlignCenter size={16} />, titre: "Centrer" },
    { valeur: "right", icone: <AlignRight size={16} />, titre: "Aligner à droite" },
  ];
  return (
    <>
      <select
        title="Police"
        className="h-8 w-44 rounded-md border border-neutral-300 bg-white px-2 text-sm"
        style={{ fontFamily: pilePolice(t.police) }}
        value={t.police}
        onChange={(e) => modifier({ police: e.target.value })}
      >
        {POLICES.map((p) => (
          <option key={p.famille} value={p.famille} style={{ fontFamily: pilePolice(p.famille) }}>
            {p.famille}
          </option>
        ))}
      </select>
      <div className="ml-1 flex items-center rounded-md border border-neutral-300">
        <button title="Plus petit" className="flex h-8 w-7 items-center justify-center hover:bg-neutral-100" onClick={() => taille(t.taillePolice - 2)}>
          <Minus size={14} />
        </button>
        <input
          title="Taille du texte"
          className="h-8 w-12 border-x border-neutral-300 text-center text-sm"
          value={Math.round(t.taillePolice)}
          onChange={(e) => Number(e.target.value) > 0 && taille(Number(e.target.value))}
        />
        <button title="Plus grand" className="flex h-8 w-7 items-center justify-center hover:bg-neutral-100" onClick={() => taille(t.taillePolice + 2)}>
          <Plus size={14} />
        </button>
      </div>
      <SelecteurCouleur titre="Couleur du texte" lettre="A" degrade valeur={t.couleur} surChoix={(c) => modifier({ couleur: c }, "couleur")} />
      {separateur}
      <Bouton titre="Gras" enfoncé={t.gras} surClic={() => modifier({ gras: !t.gras })}>
        <Bold size={16} />
      </Bouton>
      <Bouton titre="Italique" enfoncé={t.italique} surClic={() => modifier({ italique: !t.italique })}>
        <Italic size={16} />
      </Bouton>
      <Bouton titre="Souligné" enfoncé={t.souligne} surClic={() => modifier({ souligne: !t.souligne })}>
        <Underline size={16} />
      </Bouton>
      {separateur}
      {alignements.map((a) => (
        <Bouton key={a.valeur} titre={a.titre} enfoncé={t.alignement === a.valeur} surClic={() => modifier({ alignement: a.valeur })}>
          {a.icone}
        </Bouton>
      ))}
      {separateur}
      <Bulle titre="Espacement" bouton={<><SlidersHorizontal size={16} /><span className="text-sm">Espacement</span></>}>
        <label className="mb-3 block text-xs text-neutral-600">
          <span className="mb-1 flex justify-between">Entre les lignes <span className="tabular-nums">{t.interligne.toFixed(2)}</span></span>
          <input type="range" min={0.8} max={2.5} step={0.05} value={t.interligne} onChange={(e) => modifier({ interligne: Number(e.target.value) }, "interligne")} className="w-full accent-accent-600" />
        </label>
        <label className="block text-xs text-neutral-600">
          <span className="mb-1 flex justify-between">Entre les lettres <span className="tabular-nums">{t.espacement}</span></span>
          <input type="range" min={-5} max={40} step={0.5} value={t.espacement} onChange={(e) => modifier({ espacement: Number(e.target.value) }, "espacement")} className="w-full accent-accent-600" />
        </label>
      </Bulle>
    </>
  );
}

function ReglagesForme({ formes, modifier }: { formes: ElementForme[]; modifier: (m: Partial<ElementForme>, etiquette?: string) => void }) {
  const f = formes[0];
  const tousRectangles = formes.every((x) => x.forme === "rectangle");
  return (
    <>
      <span className="text-sm text-neutral-600">Couleur</span>
      <SelecteurCouleur titre="Couleur de remplissage" degrade valeur={f.remplissage} surChoix={(c) => modifier({ remplissage: c }, "remplissage")} />
      {separateur}
      <span className="text-sm text-neutral-600">Contour</span>
      <SelecteurCouleur titre="Couleur du contour" valeur={f.contour} surChoix={(c) => typeof c === "string" && modifier({ contour: c, epaisseurContour: f.epaisseurContour || 4 }, "contour")} />
      <select
        title="Épaisseur du contour"
        className="h-8 rounded-md border border-neutral-300 bg-white px-1.5 text-sm"
        value={f.epaisseurContour}
        onChange={(e) => modifier({ epaisseurContour: Number(e.target.value) })}
      >
        {[0, 2, 4, 6, 8, 12, 16, 24].map((v) => (
          <option key={v} value={v}>
            {v === 0 ? "Aucun" : `${v} px`}
          </option>
        ))}
      </select>
      {tousRectangles && (
        <>
          {separateur}
          <Bulle titre="Arrondi des coins" bouton={<span className="text-sm">Coins</span>}>
            <label className="block text-xs text-neutral-600">
              <span className="mb-1 flex justify-between">Rayon <span className="tabular-nums">{f.arrondi} px</span></span>
              <input type="range" min={0} max={Math.round(Math.min(f.largeur, f.hauteur) / 2)} step={1} value={f.arrondi} onChange={(e) => modifier({ arrondi: Number(e.target.value) }, "arrondi")} className="w-full accent-accent-600" />
            </label>
          </Bulle>
        </>
      )}
    </>
  );
}

export function BarreContexte() {
  const choisis = useEditeur(useShallow(elementsSelectionnes));
  const etat = useEditeur.getState();

  const modifier = (modif: Partial<ElementPage>, etiquette?: string) =>
    etat.modifierElements(
      Object.fromEntries(choisis.map((e) => [e.id, modif])),
      etiquette ? `${etiquette}:${choisis.map((e) => e.id).join(",")}` : undefined,
    );

  const textes = choisis.filter((e): e is ElementTexte => e.type === "texte");
  const formes = choisis.filter((e): e is ElementForme => e.type === "forme");
  const images = choisis.filter((e) => e.type === "image");
  const verrouille = choisis.some((e) => e.verrouille);
  const groupes = new Set(choisis.map((e) => e.groupe ?? e.id));
  const groupe = choisis.length > 1 && groupes.size === 1 && !!choisis[0].groupe;

  return (
    <div className="flex h-12 shrink-0 items-center gap-1 overflow-x-auto border-b border-neutral-200 bg-white px-3 defilement-fin">
      {choisis.length === 0 && <ReglagePage />}
      {choisis.length > 0 && textes.length === choisis.length && <ReglagesTexte textes={textes} modifier={modifier} />}
      {choisis.length > 0 && formes.length === choisis.length && <ReglagesForme formes={formes} modifier={modifier} />}
      {choisis.length > 0 && images.length === choisis.length && (
        <>
          <Bouton titre="Retourner horizontalement" surClic={() => choisis.forEach((e) => e.type === "image" && etat.modifierElements({ [e.id]: { retourneH: !e.retourneH } }))}>
            <FlipHorizontal2 size={16} />
          </Bouton>
          <Bouton titre="Retourner verticalement" surClic={() => choisis.forEach((e) => e.type === "image" && etat.modifierElements({ [e.id]: { retourneV: !e.retourneV } }))}>
            <FlipVertical2 size={16} />
          </Bouton>
        </>
      )}
      {choisis.length > 0 && (
        <>
          {separateur}
          <Bulle titre="Transparence" bouton={<><Blend size={16} /><span className="text-sm">Transparence</span></>}>
            <label className="block text-xs text-neutral-600">
              <span className="mb-1 flex justify-between">Opacité <span className="tabular-nums">{Math.round(choisis[0].opacite * 100)} %</span></span>
              <input type="range" min={0} max={1} step={0.01} value={choisis[0].opacite} onChange={(e) => modifier({ opacite: Number(e.target.value) }, "opacite")} className="w-full accent-accent-600" />
            </label>
          </Bulle>
          <ReglagePosition nombreBlocs={groupes.size} />
          {choisis.length > 1 && (
            <Bouton titre={groupe ? "Dégrouper (Ctrl+Maj+G)" : "Grouper (Ctrl+G)"} surClic={() => (groupe ? etat.degrouperSelection() : etat.grouperSelection())}>
              {groupe ? <Ungroup size={16} /> : <Group size={16} />}
              <span className="ml-1 text-sm">{groupe ? "Dégrouper" : "Grouper"}</span>
            </Bouton>
          )}
          {choisis.length === 1 && (
            <Bouton titre="Copier le style (Ctrl+Alt+C), puis clique sur un autre objet" surClic={() => etat.copierStyle()}>
              <Paintbrush size={16} />
            </Bouton>
          )}
          <span className="flex-1" />
          <Bouton titre="Avancer (Ctrl+↑)" surClic={() => etat.deplacerDansPile("avant")}>
            <ArrowUp size={16} />
          </Bouton>
          <Bouton titre="Reculer (Ctrl+↓)" surClic={() => etat.deplacerDansPile("arriere")}>
            <ArrowDown size={16} />
          </Bouton>
          <Bouton titre="Dupliquer (Ctrl+D)" surClic={() => etat.dupliquerSelection()}>
            <CopyPlus size={16} />
          </Bouton>
          <Bouton titre={verrouille ? "Déverrouiller" : "Verrouiller"} enfoncé={verrouille} surClic={() => etat.basculerVerrou()}>
            {verrouille ? <Lock size={16} /> : <LockOpen size={16} />}
          </Bouton>
          <Bouton titre="Supprimer (Suppr)" surClic={() => etat.supprimerSelection()}>
            <Trash2 size={16} />
          </Bouton>
        </>
      )}
    </div>
  );
}
