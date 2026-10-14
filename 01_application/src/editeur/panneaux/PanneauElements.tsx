// Le panneau Éléments, comme dans Canva : formes, lignes et flèches, personnages, icônes,
// emojis, QR code, avec une recherche par mot (en français). Un clic pose l'élément au centre de la page, un
// glisser le pose sous le pointeur.

import { ChevronLeft, QrCode, Search, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { bibliothequePresente, collections as chargerCollections, rechercher, traces, useUrlVecteur, type Collection } from "../../bibliotheque/bibliotheque";
import { normaliser, type EntreeIndex } from "../../bibliotheque/recherche";
import { APPAREILS, cheminSvg, DISPOSITIONS } from "../../modele/cadres";
import { useMarque } from "../../etat/marque";
import { creerCadre, creerEmoji, creerGraphique, creerGrille, creerIcone, creerMaquette, creerQr, creerTableau } from "../../modele/fabriques";
import { GENRES_GRAPHIQUE, PALETTE_GRAPHIQUE } from "../../modele/graphiques";
import type { Appareil, ElementPage, FormeCadre, Format, GenreGraphique } from "../../modele/types";
import { glisserDepuisPanneau } from "../glisser";
import { FORMES, GrilleFormes, TRAITS } from "./PanneauFormes";
import { ApercuPersonnages, PersonnagesTrouves, usePersonnagesTrouves, VuePersonnages } from "./SectionPersonnages";

/** Quelques emojis et icônes très utilisés en publicité, montrés avant toute recherche. */
const EMOJIS_COURANTS = ["fire", "sparkles", "red-heart", "star", "party-popper", "thumbs-up", "check-mark-button", "hundred-points", "rocket", "money-bag", "wrapped-gift", "shopping-bags", "megaphone", "light-bulb", "trophy", "clapping-hands", "face-with-tears-of-joy", "smiling-face-with-heart-eyes", "star-struck", "exploding-head", "eyes", "backhand-index-pointing-down", "high-voltage", "alarm-clock"];
const ICONES_COURANTES = ["arrow-right", "check", "star", "heart", "shopping-cart", "truck-delivery", "discount", "gift", "phone", "mail", "map-pin", "clock", "calendar", "brand-instagram", "brand-tiktok", "brand-youtube", "player-play", "camera", "bolt", "rocket", "trophy", "thumb-up", "users", "lock"];

function Vignette({ collection, nom, titre, fabriquer }: { collection: string; nom: string; titre: string; fabriquer: (f: Format) => ElementPage[] }) {
  const url = useUrlVecteur({ collection, nom, couleur: "#3f3f46" }, 72);
  return (
    <button
      title={titre}
      onPointerDown={(e) => glisserDepuisPanneau(e, fabriquer)}
      className="flex aspect-square cursor-grab items-center justify-center rounded-lg p-2 hover:bg-neutral-100"
    >
      {url ? <img src={url} alt="" draggable={false} className="h-full w-full" /> : <span className="h-6 w-6 rounded bg-neutral-100" />}
    </button>
  );
}

function Titre({ children, voirTout }: { children: ReactNode; voirTout?: () => void }) {
  return (
    <div className="mt-5 mb-2 flex items-center justify-between">
      <p className="text-sm font-semibold text-neutral-800">{children}</p>
      {voirTout && (
        <button onClick={voirTout} className="text-xs font-medium text-accent-700 hover:underline">
          Tout voir
        </button>
      )}
    </div>
  );
}

const CADRES: { forme: FormeCadre; libelle: string; mots: string }[] = [
  { forme: "rectangle", libelle: "Cadre rectangle", mots: "cadre photo rectangle carre" },
  { forme: "arrondi", libelle: "Cadre arrondi", mots: "cadre photo arrondi" },
  { forme: "cercle", libelle: "Cadre rond", mots: "cadre photo cercle rond portrait" },
  { forme: "arche", libelle: "Cadre en arche", mots: "cadre photo arche fenetre" },
  { forme: "goutte", libelle: "Cadre organique", mots: "cadre photo goutte organique tache" },
  { forme: "hexagone", libelle: "Cadre hexagone", mots: "cadre photo hexagone" },
  { forme: "etoile", libelle: "Cadre étoile", mots: "cadre photo etoile" },
  { forme: "coeur", libelle: "Cadre cœur", mots: "cadre photo coeur amour" },
];

const MAQUETTES: { appareil: Appareil; mots: string; dessin: ReactNode }[] = [
  { appareil: "telephone", mots: "maquette telephone smartphone mobile iphone ecran", dessin: <><rect x="20" y="4" width="24" height="56" rx="5" /><rect x="22.5" y="6.5" width="19" height="51" rx="3.5" className="fill-white" /></> },
  { appareil: "tablette", mots: "maquette tablette ipad ecran", dessin: <><rect x="12" y="6" width="40" height="52" rx="4" /><rect x="15" y="9" width="34" height="46" rx="1.5" className="fill-white" /></> },
  { appareil: "ordinateur", mots: "maquette ordinateur portable laptop macbook ecran", dessin: <><rect x="10" y="12" width="44" height="30" rx="2" /><rect x="12.5" y="14.5" width="39" height="25" className="fill-white" /><path d="M6 44 H58 L60 48 H4 Z" /></> },
  { appareil: "montre", mots: "maquette montre connectee watch ecran", dessin: <><rect x="18" y="14" width="26" height="34" rx="9" /><rect x="21" y="17" width="20" height="28" rx="6.5" className="fill-white" /><rect x="44" y="22" width="3" height="6" rx="1" /></> },
];

function GrilleCadres({ liste }: { liste: typeof CADRES }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {liste.map((c) => (
        <button
          key={c.forme}
          title={c.libelle}
          onPointerDown={(e) => glisserDepuisPanneau(e, (format) => [creerCadre(format, c.forme)])}
          className="flex aspect-square cursor-grab items-center justify-center rounded-lg border border-neutral-200 hover:border-accent-500 hover:bg-accent-50"
        >
          <svg viewBox="-4 -4 72 72" className="h-10 w-10">
            <path d={cheminSvg(c.forme, 64, c.forme === "arche" ? 64 : 64)} className="fill-neutral-300" />
            <path d="M18 44 L28 30 L36 40 L41 34 L48 44" fill="none" className="stroke-neutral-500" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}

function GrilleMaquettes({ liste }: { liste: typeof MAQUETTES }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {liste.map((m) => (
        <button
          key={m.appareil}
          title={APPAREILS[m.appareil].libelle}
          onPointerDown={(e) => glisserDepuisPanneau(e, (format) => [creerMaquette(format, m.appareil)])}
          className="flex aspect-square cursor-grab items-center justify-center rounded-lg border border-neutral-200 hover:border-accent-500 hover:bg-accent-50"
        >
          <svg viewBox="0 0 64 64" className="h-10 w-10 fill-neutral-800">
            {m.dessin}
          </svg>
        </button>
      ))}
    </div>
  );
}

function GrillesPhotos() {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {DISPOSITIONS.map((d) => (
        <button
          key={d.id}
          title={`Grille : ${d.libelle.toLowerCase()}`}
          onPointerDown={(e) => glisserDepuisPanneau(e, (format) => creerGrille(format, d.id))}
          className="flex aspect-square cursor-grab items-center justify-center rounded-lg border border-neutral-200 p-2 hover:border-accent-500 hover:bg-accent-50"
        >
          <svg viewBox="0 0 64 64" className="h-full w-full">
            {d.cases.map(([x, y, l, h], i) => (
              <rect key={i} x={x * 64 + 1.5} y={y * 64 + 1.5} width={l * 64 - 3} height={h * 64 - 3} rx="2" className="fill-neutral-300" />
            ))}
          </svg>
        </button>
      ))}
    </div>
  );
}

/** Le dessin de chaque genre de graphique, en miniature. */
const DESSINS_GRAPHIQUES: Record<GenreGraphique, ReactNode> = {
  colonnes: <><rect x="10" y="30" width="9" height="24" rx="1.5" className="fill-accent-600" /><rect x="23" y="18" width="9" height="36" rx="1.5" className="fill-amber-500" /><rect x="36" y="24" width="9" height="30" rx="1.5" className="fill-accent-600" /><rect x="49" y="10" width="9" height="44" rx="1.5" className="fill-amber-500" /></>,
  barres: <><rect x="10" y="10" width="40" height="8" rx="1.5" className="fill-accent-600" /><rect x="10" y="22" width="28" height="8" rx="1.5" className="fill-amber-500" /><rect x="10" y="34" width="46" height="8" rx="1.5" className="fill-accent-600" /><rect x="10" y="46" width="20" height="8" rx="1.5" className="fill-amber-500" /></>,
  lignes: <><path d="M8 48 L20 36 L32 40 L44 22 L56 14" fill="none" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" className="stroke-accent-600" /><circle cx="20" cy="36" r="3" className="fill-white stroke-accent-600" strokeWidth="2" /><circle cx="44" cy="22" r="3" className="fill-white stroke-accent-600" strokeWidth="2" /></>,
  aires: <><path d="M8 54 L8 44 L20 32 L32 38 L44 20 L56 14 L56 54 Z" className="fill-accent-200" /><path d="M8 44 L20 32 L32 38 L44 20 L56 14" fill="none" strokeWidth="3" strokeLinejoin="round" className="stroke-accent-600" /></>,
  secteurs: <><path d="M32 32 L32 8 A24 24 0 0 1 54 41 Z" className="fill-accent-600" /><path d="M32 32 L54 41 A24 24 0 0 1 16 50 Z" className="fill-amber-500" /><path d="M32 32 L16 50 A24 24 0 0 1 32 8 Z" className="fill-emerald-500" /></>,
  anneau: <><circle cx="32" cy="32" r="19" fill="none" strokeWidth="10" className="stroke-emerald-500" /><path d="M32 13 A19 19 0 0 1 50 38" fill="none" strokeWidth="10" className="stroke-accent-600" /><path d="M50 38 A19 19 0 0 1 22 48" fill="none" strokeWidth="10" className="stroke-amber-500" /></>,
  progression: <><circle cx="32" cy="32" r="20" fill="none" strokeWidth="7" className="stroke-neutral-200" /><path d="M32 12 A20 20 0 1 1 13 38" fill="none" strokeWidth="7" strokeLinecap="round" className="stroke-accent-600" /><text x="32" y="37" textAnchor="middle" fontSize="13" fontWeight="700" className="fill-neutral-800">%</text></>,
};

function GrilleGraphiques({ liste }: { liste: typeof GENRES_GRAPHIQUE }) {
  // Les couleurs de la marque passent en premier, la palette complète ensuite.
  const couleursMarque = useMarque((s) => s.kit.couleurs);
  const couleurs = [...couleursMarque.map((c) => c.valeur).filter((c) => c !== "#ffffff"), ...PALETTE_GRAPHIQUE];
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {liste.map((g) => (
        <button
          key={g.id}
          title={`Graphique : ${g.libelle.toLowerCase()}`}
          onPointerDown={(e) => glisserDepuisPanneau(e, (format) => [creerGraphique(format, g.id, couleurs)])}
          className="flex aspect-square cursor-grab items-center justify-center rounded-lg border border-neutral-200 hover:border-accent-500 hover:bg-accent-50"
        >
          <svg viewBox="0 0 64 64" className="h-10 w-10">
            {DESSINS_GRAPHIQUES[g.id]}
          </svg>
        </button>
      ))}
    </div>
  );
}

export const MODELES_TABLEAUX: { id: string; libelle: string; mots: string; cellules: string[][] }[] = [
  { id: "simple", libelle: "Tableau simple", mots: "tableau simple vide grille", cellules: [["Colonne 1", "Colonne 2", "Colonne 3"], ["", "", ""], ["", "", ""]] },
  { id: "comparatif", libelle: "Comparatif", mots: "tableau comparatif comparaison avantages concurrence", cellules: [["", "Nous", "Les autres"], ["Livraison", "24 h", "3 à 5 jours"], ["Retours", "Gratuits", "Payants"], ["Garantie", "2 ans", "1 an"]] },
  { id: "tarifs", libelle: "Tarifs", mots: "tableau tarifs prix offres formules abonnement", cellules: [["Formule", "Prix", "Pour qui"], ["Essentiel", "19 €", "Pour débuter"], ["Pro", "49 €", "Pour vendre plus"], ["Équipe", "99 €", "Pour grandir"]] },
  { id: "planning", libelle: "Planning", mots: "tableau planning semaine horaires calendrier", cellules: [["Jour", "Matin", "Après-midi"], ["Lundi", "", ""], ["Mardi", "", ""], ["Mercredi", "", ""], ["Jeudi", "", ""], ["Vendredi", "", ""]] },
];

function GrilleTableaux({ liste }: { liste: typeof MODELES_TABLEAUX }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {liste.map((m) => (
        <button
          key={m.id}
          title={m.libelle}
          onPointerDown={(e) => glisserDepuisPanneau(e, (format) => [creerTableau(format, m.cellules)])}
          className="flex cursor-grab flex-col items-center gap-1 rounded-lg border border-neutral-200 p-2 hover:border-accent-500 hover:bg-accent-50"
        >
          <svg viewBox="0 0 64 40" className="h-9 w-14">
            {m.cellules.slice(0, 5).map((r, i) =>
              r.map((_, j) => (
                <rect key={`${i}-${j}`} x={1 + (j * 62) / r.length} y={1 + (i * 38) / Math.min(5, m.cellules.length)} width={62 / r.length - 1} height={38 / Math.min(5, m.cellules.length) - 1} className={i === 0 ? "fill-neutral-700" : i % 2 === 0 ? "fill-neutral-200" : "fill-neutral-100"} />
              )),
            )}
          </svg>
          <span className="text-[11px] text-neutral-600">{m.libelle}</span>
        </button>
      ))}
    </div>
  );
}

const PAR_PAGE = 96;

type Vue = { genre: "icone" | "emoji"; collection?: string } | { genre: "personnage"; collection?: string; categorie?: string } | null;

export function PanneauElements() {
  const [presente, setPresente] = useState<boolean | null>(null);
  const [requete, setRequete] = useState("");
  const [resultats, setResultats] = useState<EntreeIndex[]>([]);
  const [listeCollections, setListeCollections] = useState<Collection[]>([]);
  const [epaisseur, setEpaisseur] = useState("regular");
  const [vue, setVue] = useState<Vue>(null);
  const [nombre, setNombre] = useState(PAR_PAGE);
  const [tousLesNoms, setTousLesNoms] = useState<string[]>([]);

  useEffect(() => {
    void bibliothequePresente().then(setPresente);
    void chargerCollections().then(setListeCollections, () => undefined);
  }, []);

  // Recherche au fil de la frappe, un peu retardée.
  useEffect(() => {
    if (!normaliser(requete)) {
      setResultats([]);
      return;
    }
    const minuteur = setTimeout(() => void rechercher(requete).then(setResultats, () => setResultats([])), 150);
    return () => clearTimeout(minuteur);
  }, [requete]);

  // « Tout voir » : la liste complète d'une collection, page par page.
  const idVue = vue && vue.genre !== "personnage" ? (vue.collection === "phosphor" ? `phosphor-${epaisseur}` : vue.collection) : undefined;
  useEffect(() => {
    setNombre(PAR_PAGE);
    if (!idVue) return;
    void traces(idVue).then((t) => setTousLesNoms(Object.keys(t)));
  }, [idVue]);

  const collectionReelle = (c: string) => (c === "phosphor" ? `phosphor-${epaisseur}` : c);
  const fabriquer = (collection: string, nom: string) => (format: Format) => {
    const c = listeCollections.find((x) => x.id === collectionReelle(collection));
    return [c?.genre === "emoji" ? creerEmoji(format, collection, nom) : creerIcone(format, collectionReelle(collection), nom)];
  };

  const formesTrouvees = useMemo(() => {
    const q = normaliser(requete);
    return q ? [...FORMES, ...TRAITS].filter((f) => q.split(" ").every((m) => f.mots.includes(m))) : [];
  }, [requete]);
  const cadresTrouves = useMemo(() => {
    const q = normaliser(requete);
    return q ? CADRES.filter((c) => q.split(" ").every((m) => c.mots.includes(m))) : [];
  }, [requete]);
  const maquettesTrouvees = useMemo(() => {
    const q = normaliser(requete);
    return q ? MAQUETTES.filter((c) => q.split(" ").every((m) => c.mots.includes(m))) : [];
  }, [requete]);
  const grillesTrouvees = useMemo(() => {
    const q = normaliser(requete);
    return q !== "" && "grille photos collage mosaique".includes(q);
  }, [requete]);
  const graphiquesTrouves = useMemo(() => {
    const q = normaliser(requete);
    return q ? GENRES_GRAPHIQUE.filter((g) => q.split(" ").every((m) => g.mots.includes(m) || `${g.mots} diagramme statistiques chiffres donnees`.includes(m))) : [];
  }, [requete]);
  const personnagesTrouves = usePersonnagesTrouves(requete);
  const tableauxTrouves = useMemo(() => {
    const q = normaliser(requete);
    return q ? MODELES_TABLEAUX.filter((t) => q.split(" ").every((m) => t.mots.includes(m))) : [];
  }, [requete]);

  if (presente === false) {
    return (
      <div>
        <p className="mb-2 text-sm font-semibold text-neutral-800">Éléments</p>
        <p className="mb-3 text-xs text-neutral-600">La bibliothèque (icônes, emojis, polices) n'est pas encore fabriquée sur ce poste. Dans un terminal :</p>
        <pre className="rounded-md bg-neutral-100 p-2 text-[11px] whitespace-pre-wrap">cd /home/nushoko/Bureau/Logiciels/Eliot/01_application && npm run bibliotheque</pre>
        <p className="mt-3 text-xs text-neutral-600">Les formes restent disponibles :</p>
        <div className="mt-2">
          <GrilleFormes liste={[...FORMES, ...TRAITS]} />
        </div>
      </div>
    );
  }

  const icones = resultats.filter((r) => listeCollections.find((c) => c.id === collectionReelle(r[0]))?.genre === "icone");
  const emojis = resultats.filter((r) => listeCollections.find((c) => c.id === r[0])?.genre === "emoji");
  const libelleCollection = (id: string) => listeCollections.find((c) => c.id === id)?.libelle ?? id;

  const choixEpaisseur = (
    <select title="Style des icônes Phosphor" value={epaisseur} onChange={(e) => setEpaisseur(e.target.value)} className="h-7 rounded-md border border-neutral-300 bg-white px-1 text-xs">
      <option value="regular">normal</option>
      <option value="thin">fin</option>
      <option value="light">léger</option>
      <option value="bold">épais</option>
      <option value="fill">plein</option>
      <option value="duotone">deux tons</option>
    </select>
  );

  return (
    <div>
      <div className="relative mb-1">
        <Search size={16} className="absolute top-2.5 left-2.5 text-neutral-400" />
        <input
          value={requete}
          onChange={(e) => {
            setRequete(e.target.value);
            setVue(null);
          }}
          placeholder="Chercher : cœur, panier, flèche…"
          className="h-9 w-full rounded-lg border border-neutral-300 pr-8 pl-8 text-sm outline-none focus:border-accent-500"
        />
        {requete && (
          <button title="Effacer" onClick={() => setRequete("")} className="absolute top-2 right-2 text-neutral-400 hover:text-neutral-700">
            <X size={16} />
          </button>
        )}
      </div>

      {vue?.genre === "personnage" && !requete && <VuePersonnages retour={() => setVue(null)} collection={vue.collection} categorie={vue.categorie} />}

      {vue && !requete && idVue && (
        <>
          <div className="mt-3 mb-2 flex items-center gap-2">
            <button title="Retour" onClick={() => setVue(null)} className="rounded-md p-1 hover:bg-neutral-100">
              <ChevronLeft size={18} />
            </button>
            <p className="flex-1 text-sm font-semibold text-neutral-800">{vue.collection === "phosphor" ? "Phosphor" : libelleCollection(idVue)}</p>
            {vue.collection === "phosphor" && choixEpaisseur}
          </div>
          <p className="mb-2 text-xs text-neutral-500">{tousLesNoms.length} dessins</p>
          <div className="grid grid-cols-5 gap-0.5">
            {tousLesNoms.slice(0, nombre).map((n) => (
              <Vignette key={n} collection={idVue} nom={n} titre={n.replace(/-/g, " ")} fabriquer={fabriquer(vue.collection === "phosphor" ? "phosphor" : idVue, n)} />
            ))}
          </div>
          {nombre < tousLesNoms.length && (
            <button onClick={() => setNombre(nombre + PAR_PAGE * 2)} className="mt-3 w-full rounded-lg border border-neutral-200 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
              Afficher plus
            </button>
          )}
        </>
      )}

      {requete && (
        <>
          {formesTrouvees.length > 0 && (
            <>
              <Titre>Formes</Titre>
              <GrilleFormes liste={formesTrouvees} />
            </>
          )}
          {cadresTrouves.length > 0 && (
            <>
              <Titre>Cadres photo</Titre>
              <GrilleCadres liste={cadresTrouves} />
            </>
          )}
          {grillesTrouvees && (
            <>
              <Titre>Grilles photo</Titre>
              <GrillesPhotos />
            </>
          )}
          {maquettesTrouvees.length > 0 && (
            <>
              <Titre>Maquettes</Titre>
              <GrilleMaquettes liste={maquettesTrouvees} />
            </>
          )}
          {graphiquesTrouves.length > 0 && (
            <>
              <Titre>Graphiques</Titre>
              <GrilleGraphiques liste={graphiquesTrouves} />
            </>
          )}
          {tableauxTrouves.length > 0 && (
            <>
              <Titre>Tableaux</Titre>
              <GrilleTableaux liste={tableauxTrouves} />
            </>
          )}
          {(personnagesTrouves.categories.length > 0 || personnagesTrouves.composer) && (
            <>
              <Titre>Personnages</Titre>
              <PersonnagesTrouves
                trouves={personnagesTrouves}
                voirTout={(collection, categorie) => {
                  setRequete("");
                  setVue({ genre: "personnage", collection, categorie });
                }}
              />
            </>
          )}
          {icones.length > 0 && (
            <>
              <Titre>
                Icônes <span className="font-normal text-neutral-500">({icones.length})</span>
              </Titre>
              <div className="mb-1 flex justify-end">{choixEpaisseur}</div>
              <div className="grid grid-cols-5 gap-0.5">
                {icones.slice(0, nombre).map(([c, n]) => (
                  <Vignette key={`${c}/${n}`} collection={collectionReelle(c)} nom={n} titre={`${n.replace(/-/g, " ")} (${c === "phosphor" ? "Phosphor" : libelleCollection(c)})`} fabriquer={fabriquer(c, n)} />
                ))}
              </div>
            </>
          )}
          {emojis.length > 0 && (
            <>
              <Titre>
                Emojis <span className="font-normal text-neutral-500">({emojis.length})</span>
              </Titre>
              <div className="grid grid-cols-5 gap-0.5">
                {emojis.slice(0, nombre).map(([c, n]) => (
                  <Vignette key={`${c}/${n}`} collection={c} nom={n} titre={`${libelleCollection(c)}`} fabriquer={fabriquer(c, n)} />
                ))}
              </div>
            </>
          )}
          {(icones.length > nombre || emojis.length > nombre) && (
            <button onClick={() => setNombre(nombre + PAR_PAGE * 2)} className="mt-3 w-full rounded-lg border border-neutral-200 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
              Afficher plus
            </button>
          )}
          {formesTrouvees.length + cadresTrouves.length + maquettesTrouvees.length + graphiquesTrouves.length + tableauxTrouves.length + personnagesTrouves.categories.length + icones.length + emojis.length === 0 && !grillesTrouvees && !personnagesTrouves.composer && <p className="mt-6 text-center text-xs text-neutral-500">Rien trouvé. Essaie un autre mot, en français ou en anglais.</p>}
        </>
      )}

      {!requete && !vue && (
        <>
          <Titre>Formes</Titre>
          <GrilleFormes liste={FORMES} />
          <Titre>Lignes et flèches</Titre>
          <GrilleFormes liste={TRAITS} />
          <Titre voirTout={() => setVue({ genre: "personnage" })}>Personnages</Titre>
          <ApercuPersonnages />
          <Titre>Cadres photo</Titre>
          <GrilleCadres liste={CADRES} />
          <p className="mt-1.5 text-[11px] text-neutral-500">Glisse ensuite une photo dessus (panneau Importer) ; double-clic pour la recadrer.</p>
          <Titre>Grilles photo</Titre>
          <GrillesPhotos />
          <Titre>Maquettes d'appareils</Titre>
          <GrilleMaquettes liste={MAQUETTES} />
          <Titre>Graphiques</Titre>
          <GrilleGraphiques liste={GENRES_GRAPHIQUE} />
          <p className="mt-1.5 text-[11px] text-neutral-500">Les chiffres se changent dans la barre du haut, bouton Données.</p>
          <Titre>Tableaux</Titre>
          <GrilleTableaux liste={MODELES_TABLEAUX} />
          <p className="mt-1.5 text-[11px] text-neutral-500">Double-clic sur une case pour écrire, Tab pour passer à la suivante.</p>
          <Titre voirTout={() => setVue({ genre: "emoji", collection: "fluent" })}>Emojis</Titre>
          <div className="grid grid-cols-6 gap-0.5">
            {EMOJIS_COURANTS.map((n) => (
              <Vignette key={n} collection="fluent" nom={n} titre={n.replace(/-/g, " ")} fabriquer={fabriquer("fluent", n)} />
            ))}
          </div>
          <div className="mt-1 flex gap-3 text-xs">
            <button onClick={() => setVue({ genre: "emoji", collection: "fluent" })} className="text-accent-700 hover:underline">Fluent Emoji</button>
            <button onClick={() => setVue({ genre: "emoji", collection: "openmoji" })} className="text-accent-700 hover:underline">OpenMoji</button>
          </div>
          <Titre voirTout={() => setVue({ genre: "icone", collection: "tabler" })}>Icônes</Titre>
          <div className="grid grid-cols-6 gap-0.5">
            {ICONES_COURANTES.map((n) => (
              <Vignette key={n} collection="tabler" nom={n} titre={n.replace(/-/g, " ")} fabriquer={fabriquer("tabler", n)} />
            ))}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <button onClick={() => setVue({ genre: "icone", collection: "tabler" })} className="text-accent-700 hover:underline">Tabler, au trait</button>
            <button onClick={() => setVue({ genre: "icone", collection: "tabler-plein" })} className="text-accent-700 hover:underline">Tabler, plein</button>
            <button onClick={() => setVue({ genre: "icone", collection: "phosphor" })} className="text-accent-700 hover:underline">Phosphor</button>
          </div>
          <Titre>QR code</Titre>
          <button
            onPointerDown={(e) => glisserDepuisPanneau(e, (format) => [creerQr(format)])}
            className="flex w-full cursor-grab items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 text-left hover:border-accent-500 hover:bg-accent-50"
          >
            <QrCode size={28} className="text-neutral-700" />
            <span className="text-xs text-neutral-600">Poser un QR code, puis écrire son adresse dans la barre du haut.</span>
          </button>
        </>
      )}

      <p className="mt-5 text-[11px] leading-snug text-neutral-400">
        Icônes Tabler et Phosphor, emojis Fluent (Microsoft) : licence MIT. Emojis OpenMoji, https://openmoji.org : licence CC BY-SA 4.0. Personnages Open Peeps et Humaaans (Pablo Stanley) : licence CC0.
      </p>
    </div>
  );
}
