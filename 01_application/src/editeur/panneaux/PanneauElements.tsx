// Le panneau Éléments, comme dans Canva : formes, lignes et flèches, icônes, emojis, QR code,
// avec une recherche par mot (en français). Un clic pose l'élément au centre de la page, un
// glisser le pose sous le pointeur.

import { ChevronLeft, QrCode, Search, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { bibliothequePresente, collections as chargerCollections, rechercher, traces, useUrlVecteur, type Collection } from "../../bibliotheque/bibliotheque";
import { normaliser, type EntreeIndex } from "../../bibliotheque/recherche";
import { creerEmoji, creerIcone, creerQr } from "../../modele/fabriques";
import type { ElementPage, Format } from "../../modele/types";
import { glisserDepuisPanneau } from "../glisser";
import { FORMES, GrilleFormes, TRAITS } from "./PanneauFormes";

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

const PAR_PAGE = 96;

type Vue = { genre: "icone" | "emoji"; collection?: string } | null;

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
  const idVue = vue ? (vue.collection === "phosphor" ? `phosphor-${epaisseur}` : vue.collection) : undefined;
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
          {formesTrouvees.length + icones.length + emojis.length === 0 && <p className="mt-6 text-center text-xs text-neutral-500">Rien trouvé. Essaie un autre mot, en français ou en anglais.</p>}
        </>
      )}

      {!requete && !vue && (
        <>
          <Titre>Formes</Titre>
          <GrilleFormes liste={FORMES} />
          <Titre>Lignes et flèches</Titre>
          <GrilleFormes liste={TRAITS} />
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
        Icônes Tabler et Phosphor, emojis Fluent (Microsoft) : licence MIT. Emojis OpenMoji, https://openmoji.org : licence CC BY-SA 4.0.
      </p>
    </div>
  );
}
