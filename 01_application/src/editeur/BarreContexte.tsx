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
  ImageOff,
  Group,
  Italic,
  LayoutGrid,
  Lock,
  LockOpen,
  Minus,
  Move,
  CaseUpper,
  Paintbrush,
  Plus,
  Sparkles,
  Strikethrough,
  SlidersHorizontal,
  Trash2,
  Underline,
  ZoomIn,
  Ungroup,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { elementsSelectionnes, pageCourante, useEditeur } from "../etat/editeur";
import type { SensAlignement } from "../modele/geometrie";
import type { Alignement, ElementForme, ElementPage, ElementTexte } from "../modele/types";
import { estTrait } from "../modele/fabriques";
import { APPAREILS, COULEURS_APPAREIL } from "../modele/cadres";
import { couleurPrincipale, type ElementCadre, type ElementIcone, type ElementImage, type ElementMaquette, type ElementQr, type FormeCadre, type Ombre } from "../modele/types";
import { Bulle } from "./Bulle";
import { SelecteurCouleur } from "./SelecteurCouleur";
import { SelecteurPolice } from "./SelecteurPolice";
import { variantesPossibles } from "../polices";
import { copierPoliceDansDesign } from "../etat/projets";
import { ouvrirLien } from "../pont/tauri";

const bouton = "flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md px-1.5 whitespace-nowrap text-neutral-700 hover:bg-neutral-100";
const actif = "bg-accent-100 text-accent-700 hover:bg-accent-100";
const separateur = <span className="mx-1.5 h-6 w-px bg-neutral-200" />;

function Bouton({ titre, surClic, enfoncé, inactif, children }: { titre: string; surClic: () => void; enfoncé?: boolean; inactif?: boolean; children: ReactNode }) {
  return (
    <button title={titre} onClick={surClic} disabled={inactif} className={`${bouton} ${enfoncé ? actif : ""} disabled:cursor-not-allowed disabled:opacity-35`}>
      {children}
    </button>
  );
}

function Curseur({ libelle, valeur, min, max, pas = 1, unite = "", surChange }: { libelle: string; valeur: number; min: number; max: number; pas?: number; unite?: string; surChange: (v: number) => void }) {
  return (
    <label className="mb-2 block text-xs text-neutral-600">
      <span className="mb-1 flex justify-between">
        {libelle}
        <span className="tabular-nums">
          {Number.isInteger(pas) ? Math.round(valeur) : valeur.toFixed(2)}
          {unite}
        </span>
      </span>
      <input type="range" min={min} max={max} step={pas} value={valeur} onChange={(e) => surChange(Number(e.target.value))} className="w-full accent-accent-600" />
    </label>
  );
}

const OMBRE_DOUCE: Ombre = { couleur: "#000000", flou: 24, x: 0, y: 10, opacite: 0.35 };

/** Réglages d'une ombre portée : présente ou non, couleur, flou, décalage, opacité. */
function ReglesOmbre({ ombre, surChange, etiquette }: { ombre: Ombre | undefined; surChange: (o: Ombre | undefined, etiquette?: string) => void; etiquette: string }) {
  const o = ombre ?? OMBRE_DOUCE;
  const avec = (m: Partial<Ombre>) => surChange({ ...o, ...m }, etiquette);
  return (
    <>
      <label className="mb-2 flex items-center gap-2 text-xs font-medium text-neutral-700">
        <input type="checkbox" checked={!!ombre} onChange={(e) => surChange(e.target.checked ? OMBRE_DOUCE : undefined)} className="accent-accent-600" />
        Ombre portée
      </label>
      {ombre && (
        <>
          <div className="mb-2 flex items-center gap-2 text-xs text-neutral-600">
            Couleur
            <SelecteurCouleur titre="Couleur de l'ombre" valeur={o.couleur} surChoix={(c) => typeof c === "string" && avec({ couleur: c })} />
          </div>
          <Curseur libelle="Flou" valeur={o.flou} min={0} max={120} surChange={(v) => avec({ flou: v })} />
          <Curseur libelle="Décalage horizontal" valeur={o.x} min={-80} max={80} surChange={(v) => avec({ x: v })} />
          <Curseur libelle="Décalage vertical" valeur={o.y} min={-80} max={80} surChange={(v) => avec({ y: v })} />
          <Curseur libelle="Opacité" valeur={o.opacite} min={0} max={1} pas={0.01} surChange={(v) => avec({ opacite: v })} />
        </>
      )}
    </>
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
  const possibles = variantesPossibles(t.police, { gras: true, italique: true });
  const taille = (v: number) => modifier({ taillePolice: Math.max(4, Math.min(800, Math.round(v))) }, "taille");
  const alignements: { valeur: Alignement; icone: ReactNode; titre: string }[] = [
    { valeur: "left", icone: <AlignLeft size={16} />, titre: "Aligner à gauche" },
    { valeur: "center", icone: <AlignCenter size={16} />, titre: "Centrer" },
    { valeur: "right", icone: <AlignRight size={16} />, titre: "Aligner à droite" },
  ];
  return (
    <>
      <SelecteurPolice
        valeur={t.police}
        surChoix={(famille) => {
          modifier({ police: famille, ...variantesPossibles(famille, t) });
          void copierPoliceDansDesign(famille);
        }}
      />
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
      <Bouton titre={possibles.gras ? "Gras" : "Cette police n'a pas de gras"} enfoncé={t.gras} inactif={!possibles.gras && !t.gras} surClic={() => modifier({ gras: !t.gras })}>
        <Bold size={16} />
      </Bouton>
      <Bouton titre={possibles.italique ? "Italique" : "Cette police n'a pas d'italique"} enfoncé={t.italique} inactif={!possibles.italique && !t.italique} surClic={() => modifier({ italique: !t.italique })}>
        <Italic size={16} />
      </Bouton>
      <Bouton titre="Souligné" enfoncé={t.souligne} surClic={() => modifier({ souligne: !t.souligne })}>
        <Underline size={16} />
      </Bouton>
      <Bouton titre="Barré" enfoncé={!!t.barre} surClic={() => modifier({ barre: !t.barre })}>
        <Strikethrough size={16} />
      </Bouton>
      <Bouton titre="Capitales" enfoncé={!!t.majuscules} surClic={() => modifier({ majuscules: !t.majuscules })}>
        <CaseUpper size={18} />
      </Bouton>
      {separateur}
      {alignements.map((a) => (
        <Bouton key={a.valeur} titre={a.titre} enfoncé={t.alignement === a.valeur} surClic={() => modifier({ alignement: a.valeur })}>
          {a.icone}
        </Bouton>
      ))}
      {separateur}
      <Bulle titre="Espacement" bouton={<SlidersHorizontal size={16} />}>
        <label className="mb-3 block text-xs text-neutral-600">
          <span className="mb-1 flex justify-between">Entre les lignes <span className="tabular-nums">{t.interligne.toFixed(2)}</span></span>
          <input type="range" min={0.8} max={2.5} step={0.05} value={t.interligne} onChange={(e) => modifier({ interligne: Number(e.target.value) }, "interligne")} className="w-full accent-accent-600" />
        </label>
        <label className="block text-xs text-neutral-600">
          <span className="mb-1 flex justify-between">Entre les lettres <span className="tabular-nums">{t.espacement}</span></span>
          <input type="range" min={-5} max={40} step={0.5} value={t.espacement} onChange={(e) => modifier({ espacement: Number(e.target.value) }, "espacement")} className="w-full accent-accent-600" />
        </label>
      </Bulle>
      <EffetsTexte t={t} modifier={modifier} />
    </>
  );
}

/** Les effets d'un texte, comme dans Canva : des préréglages, puis le détail de chacun. */
function EffetsTexte({ t, modifier }: { t: ElementTexte; modifier: (m: Partial<ElementTexte>, etiquette?: string) => void }) {
  const couleurTexte = couleurPrincipale(t.couleur);
  const prereglages: { nom: string; effet: Partial<ElementTexte> }[] = [
    { nom: "Aucun", effet: { ombre: undefined, contour: undefined, surlignage: undefined } },
    { nom: "Ombre", effet: { ombre: { couleur: "#000000", flou: Math.round(t.taillePolice * 0.2), x: Math.round(t.taillePolice * 0.04), y: Math.round(t.taillePolice * 0.06), opacite: 0.45 }, contour: undefined, surlignage: undefined } },
    { nom: "Néon", effet: { ombre: { couleur: couleurTexte, flou: Math.round(t.taillePolice * 0.35), x: 0, y: 0, opacite: 1 }, contour: undefined, surlignage: undefined } },
    { nom: "Contour", effet: { contour: { couleur: "#000000", epaisseur: Math.max(2, Math.round(t.taillePolice * 0.06)) }, ombre: undefined, surlignage: undefined } },
    { nom: "Surligné", effet: { surlignage: { couleur: "#ffde59", marge: Math.round(t.taillePolice * 0.15), arrondi: Math.round(t.taillePolice * 0.12) }, ombre: undefined, contour: undefined } },
  ];
  return (
    <Bulle titre="Effets" largeur={280} bouton={<><Sparkles size={16} /><span className="text-sm">Effets</span></>}>
      <div className="mb-3 grid grid-cols-5 gap-1">
        {prereglages.map((p) => (
          <button key={p.nom} onClick={() => modifier(p.effet)} className="rounded-md border border-neutral-200 py-1.5 text-[11px] text-neutral-700 hover:border-accent-500 hover:bg-accent-50">
            {p.nom}
          </button>
        ))}
      </div>
      <ReglesOmbre ombre={t.ombre} etiquette="ombre-texte" surChange={(o, e) => modifier({ ombre: o }, e)} />
      <label className="mt-1 mb-2 flex items-center gap-2 text-xs font-medium text-neutral-700">
        <input type="checkbox" checked={!!t.contour} onChange={(e) => modifier({ contour: e.target.checked ? { couleur: "#000000", epaisseur: Math.max(2, Math.round(t.taillePolice * 0.06)) } : undefined })} className="accent-accent-600" />
        Contour des lettres
      </label>
      {t.contour && (
        <>
          <div className="mb-2 flex items-center gap-2 text-xs text-neutral-600">
            Couleur
            <SelecteurCouleur titre="Couleur du contour" valeur={t.contour.couleur} surChoix={(c) => typeof c === "string" && modifier({ contour: { ...t.contour!, couleur: c } }, "contour-texte")} />
          </div>
          <Curseur libelle="Épaisseur" valeur={t.contour.epaisseur} min={1} max={Math.max(20, Math.round(t.taillePolice / 4))} surChange={(v) => modifier({ contour: { ...t.contour!, epaisseur: v } }, "contour-texte")} />
        </>
      )}
      <label className="mt-1 mb-2 flex items-center gap-2 text-xs font-medium text-neutral-700">
        <input type="checkbox" checked={!!t.surlignage} onChange={(e) => modifier({ surlignage: e.target.checked ? { couleur: "#ffde59", marge: Math.round(t.taillePolice * 0.15), arrondi: Math.round(t.taillePolice * 0.12) } : undefined })} className="accent-accent-600" />
        Surlignage (bande derrière le texte)
      </label>
      {t.surlignage && (
        <>
          <div className="mb-2 flex items-center gap-2 text-xs text-neutral-600">
            Couleur
            <SelecteurCouleur titre="Couleur du surlignage" valeur={t.surlignage.couleur} surChoix={(c) => typeof c === "string" && modifier({ surlignage: { ...t.surlignage!, couleur: c } }, "surlignage")} />
          </div>
          <Curseur libelle="Marge" valeur={t.surlignage.marge} min={0} max={Math.max(40, Math.round(t.taillePolice / 2))} surChange={(v) => modifier({ surlignage: { ...t.surlignage!, marge: v } }, "surlignage")} />
          <Curseur libelle="Arrondi" valeur={t.surlignage.arrondi} min={0} max={Math.max(40, Math.round(t.taillePolice / 2))} surChange={(v) => modifier({ surlignage: { ...t.surlignage!, arrondi: v } }, "surlignage")} />
        </>
      )}
    </Bulle>
  );
}

function ReglagesTrait({ f, modifier }: { f: ElementForme; modifier: (m: Partial<ElementForme>, etiquette?: string) => void }) {
  return (
    <>
      <span className="text-sm text-neutral-600">Couleur</span>
      <SelecteurCouleur titre="Couleur du trait" valeur={couleurPrincipale(f.remplissage)} surChoix={(c) => typeof c === "string" && modifier({ remplissage: c }, "remplissage")} />
      <select title="Épaisseur du trait" className="h-8 rounded-md border border-neutral-300 bg-white px-1.5 text-sm" value={f.epaisseurContour} onChange={(e) => modifier({ epaisseurContour: Number(e.target.value) })}>
        {[...new Set([2, 4, 6, 8, 12, 16, 24, 32, f.epaisseurContour])].sort((a, b) => a - b).map((v) => (
          <option key={v} value={v}>{`${v} px`}</option>
        ))}
      </select>
      <Bouton titre="Tirets" enfoncé={!!f.tirets} surClic={() => modifier({ tirets: !f.tirets })}>
        <span className="text-sm">- - -</span>
      </Bouton>
      {f.forme === "fleche" && (
        <>
          {separateur}
          <Bouton titre="Pointe au début" enfoncé={!!f.pointes?.debut} surClic={() => modifier({ pointes: { debut: !f.pointes?.debut, fin: f.pointes?.fin ?? true } })}>
            <span className="text-sm">◀</span>
          </Bouton>
          <Bouton titre="Pointe à la fin" enfoncé={f.pointes?.fin ?? true} surClic={() => modifier({ pointes: { debut: !!f.pointes?.debut, fin: !(f.pointes?.fin ?? true) } })}>
            <span className="text-sm">▶</span>
          </Bouton>
        </>
      )}
    </>
  );
}

function ReglagesForme({ formes, modifier }: { formes: ElementForme[]; modifier: (m: Partial<ElementForme>, etiquette?: string) => void }) {
  const f = formes[0];
  const tousRectangles = formes.every((x) => x.forme === "rectangle");
  if (formes.every((x) => estTrait(x.forme))) return <ReglagesTrait f={f} modifier={modifier} />;
  const avecCotes = formes.every((x) => x.forme === "polygone" || x.forme === "etoile");
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
      {avecCotes && (
        <>
          {separateur}
          <Bulle titre={f.forme === "etoile" ? "Branches" : "Côtés"} bouton={<span className="text-sm">{f.forme === "etoile" ? "Branches" : "Côtés"}</span>}>
            <Curseur libelle={f.forme === "etoile" ? "Nombre de branches" : "Nombre de côtés"} valeur={f.cotes ?? (f.forme === "etoile" ? 5 : 6)} min={3} max={f.forme === "etoile" ? 24 : 12} surChange={(v) => modifier({ cotes: v }, "cotes")} />
          </Bulle>
        </>
      )}
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

function ReglagesIcone({ icones, modifier }: { icones: ElementIcone[]; modifier: (m: Partial<ElementIcone>, etiquette?: string) => void }) {
  const i = icones[0];
  const auTrait = icones.every((x) => x.collection === "tabler");
  return (
    <>
      <span className="text-sm text-neutral-600">Couleur</span>
      <SelecteurCouleur titre="Couleur de l'icône" valeur={i.couleur} surChoix={(c) => typeof c === "string" && modifier({ couleur: c }, "couleur-icone")} />
      {auTrait && (
        <>
          {separateur}
          <Bulle titre="Épaisseur du trait" bouton={<span className="text-sm">Trait</span>}>
            <Curseur libelle="Épaisseur du trait" valeur={i.trait ?? 2} min={0.5} max={3} pas={0.25} surChange={(v) => modifier({ trait: v }, "trait")} />
          </Bulle>
        </>
      )}
    </>
  );
}

function ReglagesQr({ q, modifier }: { q: ElementQr; modifier: (m: Partial<ElementQr>, etiquette?: string) => void }) {
  const [contenu, setContenu] = useState(q.contenu);
  useEffect(() => setContenu(q.contenu), [q.id, q.contenu]);
  const valider = () => contenu !== q.contenu && modifier({ contenu });
  return (
    <>
      <input
        title="Adresse ou texte du QR code"
        value={contenu}
        onChange={(e) => setContenu(e.target.value)}
        onBlur={valider}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") valider();
        }}
        placeholder="https://"
        className="h-8 w-64 rounded-md border border-neutral-300 px-2 text-sm"
      />
      {separateur}
      <span className="text-sm text-neutral-600">Couleur</span>
      <SelecteurCouleur titre="Couleur des carrés" valeur={q.couleur} surChoix={(c) => typeof c === "string" && modifier({ couleur: c }, "couleur-qr")} />
      <span className="text-sm text-neutral-600">Fond</span>
      {q.fond ? <SelecteurCouleur titre="Couleur du fond" valeur={q.fond} surChoix={(c) => typeof c === "string" && modifier({ fond: c }, "fond-qr")} /> : null}
      <Bouton titre={q.fond ? "Fond transparent" : "Remettre un fond"} enfoncé={!q.fond} surClic={() => modifier({ fond: q.fond ? null : "#ffffff" })}>
        <span className="text-xs">{q.fond ? "Sans fond" : "Fond"}</span>
      </Bouton>
      <select title="Résistance aux taches (correction d'erreur)" value={q.correction} onChange={(e) => modifier({ correction: e.target.value as ElementQr["correction"] })} className="h-8 rounded-md border border-neutral-300 bg-white px-1.5 text-sm">
        <option value="L">Résistance faible</option>
        <option value="M">Résistance moyenne</option>
        <option value="Q">Résistance forte</option>
        <option value="H">Résistance maximale</option>
      </select>
    </>
  );
}

const FORMES_CADRE: { forme: FormeCadre; nom: string }[] = [
  { forme: "rectangle", nom: "Rectangle" },
  { forme: "arrondi", nom: "Arrondi" },
  { forme: "cercle", nom: "Rond" },
  { forme: "arche", nom: "Arche" },
  { forme: "goutte", nom: "Organique" },
  { forme: "hexagone", nom: "Hexagone" },
  { forme: "etoile", nom: "Étoile" },
  { forme: "coeur", nom: "Cœur" },
];

/** Le crédit d'une photo venue de Pixabay : auteur, et un clic ouvre sa page. */
function CreditPhoto({ ressource }: { ressource: string | undefined }) {
  const credit = useEditeur((s) => (ressource ? s.ressources[ressource]?.credit : undefined));
  if (!credit) return null;
  return (
    <button
      title={`Ouvrir la page de la photo sur ${credit.source}`}
      onClick={() => void ouvrirLien(credit.lien)}
      className="h-8 shrink-0 rounded-md px-2 text-xs whitespace-nowrap text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
    >
      Photo : {credit.auteur}, {credit.source}
    </button>
  );
}

/** Réglages communs à une photo dans un cadre ou un écran : ajuster, zoom, retirer. */
function ReglagesPhotoCadree({ el }: { el: ElementCadre | ElementMaquette }) {
  const etat = useEditeur.getState();
  if (!el.ressource) return <span className="text-xs whitespace-nowrap text-neutral-500">Glisse une photo dessus depuis Photos ou Importer.</span>;
  return (
    <>
      <Bouton titre="Ajuster la photo (double-clic)" surClic={() => etat.commencerAjustement(el.id)}>
        <Move size={16} />
        <span className="ml-1 text-sm">Ajuster</span>
      </Bouton>
      <Bulle titre="Zoom de la photo" bouton={<ZoomIn size={16} />}>
        <Curseur libelle="Zoom" valeur={el.recadrage.zoom} min={1} max={5} pas={0.05} surChange={(v) => etat.modifierElements({ [el.id]: { recadrage: { ...el.recadrage, zoom: v } } as Partial<ElementPage> }, `zoom-photo:${el.id}`)} />
        <button className="mt-1 text-xs text-accent-700 hover:underline" onClick={() => etat.modifierElements({ [el.id]: { recadrage: { zoom: 1, x: 0.5, y: 0.5 } } as Partial<ElementPage> })}>
          Recentrer
        </button>
      </Bulle>
      <Bouton titre="Retirer la photo" surClic={() => etat.retirerPhoto(el.id)}>
        <ImageOff size={16} />
      </Bouton>
      <CreditPhoto ressource={el.ressource} />
    </>
  );
}

function ReglagesCadre({ c, modifier }: { c: ElementCadre; modifier: (m: Partial<ElementCadre>, etiquette?: string) => void }) {
  return (
    <>
      <select title="Forme du cadre" value={c.forme} onChange={(e) => modifier({ forme: e.target.value as FormeCadre })} className="h-8 shrink-0 rounded-md border border-neutral-300 bg-white px-1.5 text-sm">
        {FORMES_CADRE.map((f) => (
          <option key={f.forme} value={f.forme}>
            {f.nom}
          </option>
        ))}
      </select>
      {separateur}
      <ReglagesPhotoCadree el={c} />
      {separateur}
      <ReglesBordure bordure={c.bordure} surChange={(b, e) => modifier({ bordure: b }, e)} />
    </>
  );
}

function ReglagesMaquette({ m, modifier }: { m: ElementMaquette; modifier: (x: Partial<ElementMaquette>, etiquette?: string) => void }) {
  return (
    <>
      <span className="text-sm text-neutral-600">{APPAREILS[m.appareil].libelle}</span>
      <div className="flex shrink-0 items-center gap-1">
        {COULEURS_APPAREIL.map((c) => (
          <button key={c.couleur} title={c.nom} onClick={() => modifier({ couleur: c.couleur })} className={`h-6 w-6 rounded-full border ${m.couleur === c.couleur ? "border-accent-600 ring-2 ring-accent-200" : "border-neutral-300"}`} style={{ background: c.couleur }} />
        ))}
      </div>
      {separateur}
      <ReglagesPhotoCadree el={m} />
    </>
  );
}

/** Bordure d'une photo ou d'un cadre : présente ou non, couleur, épaisseur. */
function ReglesBordure({ bordure, surChange }: { bordure: { couleur: string; epaisseur: number } | undefined; surChange: (b: { couleur: string; epaisseur: number } | undefined, etiquette?: string) => void }) {
  return (
    <Bulle titre="Bordure" bouton={<span className="text-sm">Bordure</span>}>
      <label className="mb-2 flex items-center gap-2 text-xs font-medium text-neutral-700">
        <input type="checkbox" checked={!!bordure} onChange={(e) => surChange(e.target.checked ? { couleur: "#ffffff", epaisseur: 12 } : undefined)} className="accent-accent-600" />
        Bordure
      </label>
      {bordure && (
        <>
          <div className="mb-2 flex items-center gap-2 text-xs text-neutral-600">
            Couleur
            <SelecteurCouleur titre="Couleur de la bordure" valeur={bordure.couleur} surChoix={(c) => typeof c === "string" && surChange({ ...bordure, couleur: c }, "bordure")} />
          </div>
          <Curseur libelle="Épaisseur" valeur={bordure.epaisseur} min={1} max={80} surChange={(v) => surChange({ ...bordure, epaisseur: v }, "bordure")} />
        </>
      )}
    </Bulle>
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
  const icones = choisis.filter((e): e is ElementIcone => e.type === "icone");
  const qrs = choisis.filter((e): e is ElementQr => e.type === "qr");
  const cadres = choisis.filter((e): e is ElementCadre => e.type === "cadre");
  const maquettes = choisis.filter((e): e is ElementMaquette => e.type === "maquette");
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
          {separateur}
          <Bulle titre="Coins arrondis" bouton={<span className="text-sm">Coins</span>}>
            <Curseur
              libelle="Rayon"
              valeur={(choisis[0] as ElementImage).arrondi ?? 0}
              min={0}
              max={Math.round(Math.min(choisis[0].largeur, choisis[0].hauteur) / 2)}
              unite=" px"
              surChange={(v) => modifier({ arrondi: v } as Partial<ElementImage>, "arrondi-image")}
            />
          </Bulle>
          <ReglesBordure bordure={(choisis[0] as ElementImage).bordure} surChange={(b, e) => modifier({ bordure: b } as Partial<ElementImage>, e)} />
          {choisis.length === 1 && <CreditPhoto ressource={(choisis[0] as ElementImage).ressource} />}
        </>
      )}
      {choisis.length > 0 && icones.length === choisis.length && <ReglagesIcone icones={icones} modifier={modifier} />}
      {choisis.length === 1 && qrs.length === 1 && <ReglagesQr q={qrs[0]} modifier={modifier} />}
      {choisis.length === 1 && cadres.length === 1 && <ReglagesCadre c={cadres[0]} modifier={modifier} />}
      {choisis.length === 1 && maquettes.length === 1 && <ReglagesMaquette m={maquettes[0]} modifier={modifier} />}
      {choisis.length > 0 && (
        <>
          {separateur}
          {textes.length === 0 && qrs.length === 0 && (
            <Bulle titre="Ombre" largeur={260} bouton={<span className="text-sm">Ombre</span>}>
              <ReglesOmbre ombre={choisis[0].ombre} etiquette="ombre" surChange={(o, e) => modifier({ ombre: o }, e)} />
            </Bulle>
          )}
          <Bulle titre="Transparence" bouton={<Blend size={16} />}>
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
