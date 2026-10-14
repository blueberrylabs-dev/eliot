// Réglages de la barre contextuelle pour les traits de dessin, les graphiques et les tableaux.

import { AlignCenter, AlignLeft, AlignRight, Minus, Plus, Table2, X } from "lucide-react";
import { useEffect, useState, type ClipboardEvent, type ReactNode } from "react";
import { copierPoliceDansDesign } from "../etat/projets";
import { OUTILS_DESSIN } from "../modele/dessin";
import { aAxes, donneesDepuisCollage, GENRES_GRAPHIQUE, PALETTE_GRAPHIQUE } from "../modele/graphiques";
import { ajouterColonne, ajouterRangee, COLONNES_MAX, LIGNES_MAX, retirerColonne, retirerRangee } from "../modele/tableaux";
import type { Alignement, ElementDessin, ElementGraphique, ElementPage, ElementTableau, GenreGraphique, OutilDessin, SerieGraphique } from "../modele/types";
import { Bulle } from "./Bulle";
import { Bouton, Curseur, separateur } from "./ElementsBarre";
import { SelecteurCouleur } from "./SelecteurCouleur";
import { SelecteurPolice } from "./SelecteurPolice";

type Modifier<T> = (m: Partial<T>, etiquette?: string) => void;

function TaillePolice({ valeur, surChange }: { valeur: number; surChange: (v: number) => void }) {
  const borner = (v: number) => surChange(Math.max(6, Math.min(300, Math.round(v))));
  return (
    <div className="ml-1 flex shrink-0 items-center rounded-md border border-neutral-300">
      <button title="Plus petit" className="flex h-8 w-7 items-center justify-center hover:bg-neutral-100" onClick={() => borner(valeur - 2)}>
        <Minus size={14} />
      </button>
      <input title="Taille du texte" className="h-8 w-11 border-x border-neutral-300 text-center text-sm" value={Math.round(valeur)} onChange={(e) => Number(e.target.value) > 0 && borner(Number(e.target.value))} />
      <button title="Plus grand" className="flex h-8 w-7 items-center justify-center hover:bg-neutral-100" onClick={() => borner(valeur + 2)}>
        <Plus size={14} />
      </button>
    </div>
  );
}

// ---- Dessin ----

export function ReglagesDessin({ traits, modifier }: { traits: ElementDessin[]; modifier: Modifier<ElementPage> }) {
  const t = traits[0];
  return (
    <>
      <select title="Outil du trait" value={t.outil} onChange={(e) => modifier({ outil: e.target.value as OutilDessin } as Partial<ElementDessin>)} className="h-8 shrink-0 rounded-md border border-neutral-300 bg-white px-1.5 text-sm">
        {(Object.keys(OUTILS_DESSIN) as OutilDessin[]).map((o) => (
          <option key={o} value={o}>
            {OUTILS_DESSIN[o].libelle}
          </option>
        ))}
      </select>
      <SelecteurCouleur titre="Couleur du trait" valeur={t.couleur} surChoix={(c) => typeof c === "string" && modifier({ couleur: c } as Partial<ElementDessin>, "couleur-trait")} />
      <Bulle titre="Épaisseur du trait" bouton={<span className="text-sm">Épaisseur</span>}>
        <Curseur libelle="Épaisseur" valeur={t.epaisseur} min={1} max={120} unite=" px" surChange={(v) => modifier({ epaisseur: v } as Partial<ElementDessin>, "epaisseur-trait")} />
      </Bulle>
    </>
  );
}

// ---- Graphiques ----

/** Un nombre qu'on tape à la française (virgule) ; vide, il n'y a pas de valeur. */
function ChampNombre({ valeur, surChange, titre, largeur = "w-20" }: { valeur: number | null; surChange: (v: number | null) => void; titre: string; largeur?: string }) {
  const texteDe = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));
  const [texte, setTexte] = useState(texteDe(valeur));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setTexte(texteDe(valeur));
  }, [valeur, focus]);
  return (
    <input
      title={titre}
      value={texte}
      inputMode="decimal"
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onChange={(e) => {
        setTexte(e.target.value);
        const propre = e.target.value.replace(/[\s ]/g, "").replace(",", ".");
        if (propre === "") surChange(null);
        else if (Number.isFinite(Number(propre))) surChange(Number(propre));
      }}
      className={`h-7 ${largeur} rounded border border-neutral-300 px-1.5 text-right text-xs tabular-nums outline-none focus:border-accent-500`}
    />
  );
}

function Pastille({ couleur, titre, surChoix }: { couleur: string; titre: string; surChoix: (c: string) => void }) {
  return (
    <label title={titre} className="relative block h-5 w-5 shrink-0 cursor-pointer overflow-hidden rounded border border-neutral-300" style={{ background: couleur }}>
      <input type="color" value={couleur} onChange={(e) => surChoix(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
    </label>
  );
}

/** Le tableau des données d'un graphique : une ligne par étiquette, une colonne par série. Un
 *  collage depuis un tableur remplace tout. */
function EditeurDonnees({ g, modifier }: { g: ElementGraphique; modifier: Modifier<ElementGraphique> }) {
  const etiquette = `donnees:${g.id}`;
  const parts = g.genre === "secteurs" || g.genre === "anneau";
  const series = parts ? g.series.slice(0, 1) : g.series;
  const changerSeries = (s: SerieGraphique[]) => modifier({ series: parts ? [...s, ...g.series.slice(1)] : s }, etiquette);
  const changerValeur = (si: number, i: number, v: number | null) => changerSeries(series.map((s, j) => (j === si ? { ...s, valeurs: s.valeurs.map((x, k) => (k === i ? v : x)) } : s)));

  const coller = (e: ClipboardEvent<HTMLDivElement>) => {
    const texte = e.clipboardData.getData("text/plain");
    if (!texte.includes("\t")) return;
    const d = donneesDepuisCollage(texte);
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    modifier(
      {
        etiquettes: d.etiquettes,
        series: d.series.slice(0, parts ? 1 : 12).map((s, i) => ({ ...s, couleur: g.series[i]?.couleur ?? PALETTE_GRAPHIQUE[i % PALETTE_GRAPHIQUE.length] })),
      },
      etiquette,
    );
  };

  if (g.genre === "progression") {
    return (
      <div className="flex flex-col gap-2 text-xs text-neutral-600">
        <label className="flex items-center justify-between gap-2">
          Valeur <ChampNombre titre="Valeur" valeur={g.series[0]?.valeurs[0] ?? 0} surChange={(v) => changerValeur(0, 0, v ?? 0)} />
        </label>
        <label className="flex items-center justify-between gap-2">
          Sur un total de <ChampNombre titre="Maximum" valeur={g.maximum ?? 100} surChange={(v) => modifier({ maximum: v && v > 0 ? v : 100 }, etiquette)} />
        </label>
        <label className="flex items-center justify-between gap-2">
          Texte sous le chiffre
          <input value={g.etiquettes[0] ?? ""} onChange={(e) => modifier({ etiquettes: [e.target.value] }, etiquette)} className="h-7 w-40 rounded border border-neutral-300 px-1.5 text-xs outline-none focus:border-accent-500" />
        </label>
        <div className="flex items-center justify-between gap-2">
          Couleurs
          <span className="flex gap-1.5">
            <Pastille titre="Couleur de la jauge" couleur={g.series[0]?.couleur ?? PALETTE_GRAPHIQUE[0]} surChoix={(c) => changerSeries(g.series.map((s, i) => (i === 0 ? { ...s, couleur: c } : s)))} />
            <Pastille titre="Couleur du fond de la jauge" couleur={g.couleursParts?.[0] ?? "#e5e7eb"} surChoix={(c) => modifier({ couleursParts: [c] }, etiquette)} />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div onPaste={coller}>
      <div className="max-h-72 overflow-auto defilement-fin">
        <table className="text-xs">
          <thead>
            <tr>
              <th />
              {series.map((s, si) => (
                <th key={si} className="px-0.5 pb-1 font-normal">
                  <div className="flex items-center gap-1">
                    {!parts && <Pastille titre="Couleur de la série" couleur={s.couleur} surChoix={(c) => changerSeries(series.map((x, j) => (j === si ? { ...x, couleur: c } : x)))} />}
                    <input value={s.nom} title="Nom de la série" onChange={(e) => changerSeries(series.map((x, j) => (j === si ? { ...x, nom: e.target.value } : x)))} className="h-7 w-16 rounded border border-neutral-300 px-1 font-medium outline-none focus:border-accent-500" />
                    {series.length > 1 && (
                      <button title="Retirer la série" onClick={() => changerSeries(series.filter((_, j) => j !== si))} className="text-neutral-400 hover:text-red-600">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {g.etiquettes.map((e, i) => (
              <tr key={i}>
                <td className="pr-1">
                  <div className="flex items-center gap-1">
                    {parts && <Pastille titre="Couleur de la part" couleur={g.couleursParts?.[i] ?? PALETTE_GRAPHIQUE[i % PALETTE_GRAPHIQUE.length]} surChoix={(c) => modifier({ couleursParts: g.etiquettes.map((_, k) => (k === i ? c : (g.couleursParts?.[k] ?? PALETTE_GRAPHIQUE[k % PALETTE_GRAPHIQUE.length]))) }, etiquette)} />}
                    <input value={e} title="Étiquette" onChange={(ev) => modifier({ etiquettes: g.etiquettes.map((x, k) => (k === i ? ev.target.value : x)) }, etiquette)} className="h-7 w-24 rounded border border-neutral-300 px-1 outline-none focus:border-accent-500" />
                  </div>
                </td>
                {series.map((s, si) => (
                  <td key={si} className="px-0.5 py-0.5">
                    <ChampNombre titre={`${s.nom}, ${e}`} largeur="w-16" valeur={s.valeurs[i] ?? null} surChange={(v) => changerValeur(si, i, v)} />
                  </td>
                ))}
                <td>
                  {g.etiquettes.length > 1 && (
                    <button
                      title="Retirer la ligne"
                      onClick={() =>
                        modifier(
                          {
                            etiquettes: g.etiquettes.filter((_, k) => k !== i),
                            series: g.series.map((s) => ({ ...s, valeurs: s.valeurs.filter((_, k) => k !== i) })),
                            ...(g.couleursParts ? { couleursParts: g.couleursParts.filter((_, k) => k !== i) } : {}),
                          },
                          etiquette,
                        )
                      }
                      className="px-1 text-neutral-400 hover:text-red-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() =>
            modifier(
              {
                etiquettes: [...g.etiquettes, `Étiquette ${g.etiquettes.length + 1}`],
                series: g.series.map((s) => ({ ...s, valeurs: [...s.valeurs, null] })),
                ...(parts ? { couleursParts: [...g.etiquettes.map((_, k) => g.couleursParts?.[k] ?? PALETTE_GRAPHIQUE[k % PALETTE_GRAPHIQUE.length]), PALETTE_GRAPHIQUE[g.etiquettes.length % PALETTE_GRAPHIQUE.length]] } : {}),
              },
              etiquette,
            )
          }
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
        >
          + Ligne
        </button>
        {!parts && g.series.length < 12 && (
          <button
            onClick={() => modifier({ series: [...g.series, { nom: `Série ${g.series.length + 1}`, couleur: PALETTE_GRAPHIQUE[g.series.length % PALETTE_GRAPHIQUE.length], valeurs: g.etiquettes.map(() => null) }] }, etiquette)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
          >
            + Série
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-neutral-500">Tu peux coller un tableau copié depuis un tableur : première ligne, les noms des séries ; première colonne, les étiquettes.</p>
    </div>
  );
}

export function ReglagesGraphique({ g, modifier }: { g: ElementGraphique; modifier: Modifier<ElementPage> }) {
  const m = modifier as Modifier<ElementGraphique>;
  return (
    <>
      <select title="Genre de graphique" value={g.genre} onChange={(e) => m({ genre: e.target.value as GenreGraphique })} className="h-8 shrink-0 rounded-md border border-neutral-300 bg-white px-1.5 text-sm">
        {GENRES_GRAPHIQUE.map((x) => (
          <option key={x.id} value={x.id}>
            {x.libelle}
          </option>
        ))}
      </select>
      <Bulle titre="Données du graphique" largeur={g.genre === "progression" ? 300 : 420} bouton={<><Table2 size={16} /><span className="text-sm">Données</span></>}>
        <EditeurDonnees g={g} modifier={m} />
      </Bulle>
      {separateur}
      {g.genre !== "progression" && (
        <Bouton titre="Légende" enfoncé={g.legende} surClic={() => m({ legende: !g.legende })}>
          <span className="text-sm">Légende</span>
        </Bouton>
      )}
      {g.genre !== "progression" && (
        <Bouton titre="Écrire les valeurs" enfoncé={g.valeurs} surClic={() => m({ valeurs: !g.valeurs })}>
          <span className="text-sm">Valeurs</span>
        </Bouton>
      )}
      {aAxes(g.genre) && (
        <Bouton titre="Lignes de repère" enfoncé={g.grille} surClic={() => m({ grille: !g.grille })}>
          <span className="text-sm">Grille</span>
        </Bouton>
      )}
      {separateur}
      <SelecteurPolice
        valeur={g.police}
        surChoix={(famille) => {
          m({ police: famille });
          void copierPoliceDansDesign(famille);
        }}
      />
      <TaillePolice valeur={g.taillePolice} surChange={(v) => m({ taillePolice: v }, "taille")} />
      <SelecteurCouleur titre="Couleur des textes" lettre="A" valeur={g.couleurTexte} surChoix={(c) => typeof c === "string" && m({ couleurTexte: c }, "couleur")} />
      <input
        title="Unité ajoutée aux valeurs (%, €, k…)"
        placeholder="unité"
        value={g.unite ?? ""}
        onChange={(e) => m({ unite: e.target.value.slice(0, 8) || undefined }, "unite")}
        className="ml-1 h-8 w-16 shrink-0 rounded-md border border-neutral-300 px-1.5 text-sm outline-none focus:border-accent-500"
      />
    </>
  );
}

// ---- Tableaux ----

export function ReglagesTableau({ t, modifier }: { t: ElementTableau; modifier: Modifier<ElementPage> }) {
  const m = modifier as Modifier<ElementTableau>;
  const alignements: { valeur: Alignement; icone: ReactNode; titre: string }[] = [
    { valeur: "left", icone: <AlignLeft size={16} />, titre: "Aligner à gauche" },
    { valeur: "center", icone: <AlignCenter size={16} />, titre: "Centrer" },
    { valeur: "right", icone: <AlignRight size={16} />, titre: "Aligner à droite" },
  ];
  const ligneCouleur = (libelle: string, valeur: string, surChoix: (c: string) => void) => (
    <div className="mb-2 flex items-center justify-between gap-2 text-xs text-neutral-600">
      {libelle}
      <SelecteurCouleur titre={libelle} valeur={valeur} surChoix={(c) => typeof c === "string" && surChoix(c)} />
    </div>
  );
  return (
    <>
      <Bouton titre="Ajouter une rangée en bas" inactif={t.cellules.length >= LIGNES_MAX} surClic={() => m(ajouterRangee(t))}>
        <Plus size={14} />
        <span className="ml-0.5 text-sm">Rangée</span>
      </Bouton>
      <Bouton titre="Retirer la dernière rangée" inactif={t.cellules.length <= 1} surClic={() => m(retirerRangee(t))}>
        <Minus size={14} />
      </Bouton>
      <Bouton titre="Ajouter une colonne à droite" inactif={t.colonnes.length >= COLONNES_MAX} surClic={() => m(ajouterColonne(t))}>
        <Plus size={14} />
        <span className="ml-0.5 text-sm">Colonne</span>
      </Bouton>
      <Bouton titre="Retirer la dernière colonne" inactif={t.colonnes.length <= 1} surClic={() => m(retirerColonne(t))}>
        <Minus size={14} />
      </Bouton>
      {separateur}
      <Bouton titre="Première rangée en en-tête" enfoncé={t.entete} surClic={() => m({ entete: !t.entete })}>
        <span className="text-sm">En-tête</span>
      </Bouton>
      <Bouton titre="Une rangée sur deux teintée" enfoncé={!!t.rayures} surClic={() => m({ rayures: t.rayures ? undefined : "#f4f3ef" })}>
        <span className="text-sm">Rayures</span>
      </Bouton>
      {separateur}
      <SelecteurPolice
        valeur={t.police}
        surChoix={(famille) => {
          m({ police: famille });
          void copierPoliceDansDesign(famille);
        }}
      />
      <TaillePolice valeur={t.taillePolice} surChange={(v) => m({ taillePolice: v }, "taille")} />
      {alignements.map((a) => (
        <Bouton key={a.valeur} titre={a.titre} enfoncé={t.alignement === a.valeur} surClic={() => m({ alignement: a.valeur })}>
          {a.icone}
        </Bouton>
      ))}
      <Bulle titre="Couleurs et bordures du tableau" largeur={260} bouton={<span className="text-sm">Couleurs</span>}>
        {ligneCouleur("Texte", t.couleurTexte, (c) => m({ couleurTexte: c }, "couleur-tableau"))}
        {ligneCouleur("Fond des cases", t.fond, (c) => m({ fond: c }, "couleur-tableau"))}
        {t.entete && ligneCouleur("Fond de l'en-tête", t.fondEntete, (c) => m({ fondEntete: c }, "couleur-tableau"))}
        {t.entete && ligneCouleur("Texte de l'en-tête", t.texteEntete, (c) => m({ texteEntete: c }, "couleur-tableau"))}
        {t.rayures && ligneCouleur("Rayures", t.rayures, (c) => m({ rayures: c }, "couleur-tableau"))}
        {ligneCouleur("Bordures", t.bordure.couleur, (c) => m({ bordure: { ...t.bordure, couleur: c } }, "couleur-tableau"))}
        <Curseur libelle="Épaisseur des bordures" valeur={t.bordure.epaisseur} min={0} max={12} unite=" px" surChange={(v) => m({ bordure: { ...t.bordure, epaisseur: v } }, "bordure-tableau")} />
        <Curseur libelle="Marge dans les cases" valeur={t.marge} min={0} max={60} unite=" px" surChange={(v) => m({ marge: v }, "marge-tableau")} />
      </Bulle>
    </>
  );
}
