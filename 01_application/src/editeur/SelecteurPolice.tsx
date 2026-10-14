// Choix d'une police : polices de la marque en tête, recherche par nom ou par usage, filtre
// par genre, chaque nom écrit dans sa propre police. Une police ne se charge que lorsque son nom devient visible dans la liste.

import { Check, ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { normaliser } from "../bibliotheque/recherche";
import { useMarque } from "../etat/marque";
import { ROLES_POLICE } from "../modele/marque";
import { assurerPolice, GENRES_POLICE, pilePolice, usePolices, type GenrePolice, type Police } from "../polices";
import { useApparu } from "./apparu";
import { Bulle } from "./Bulle";

/** Le nom d'une police, écrit avec elle dès qu'il apparaît à l'écran. */
function NomPolice({ police, choisie, surChoix }: { police: Police; choisie: boolean; surChoix: () => void }) {
  const [ref, visible] = useApparu<HTMLButtonElement>();
  return (
    <button ref={ref} onClick={surChoix} className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-neutral-100 ${choisie ? "bg-accent-50" : ""}`}>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[17px] leading-tight text-neutral-900" style={visible ? { fontFamily: pilePolice(police.famille) } : undefined}>
          {police.famille}
        </span>
        <span className="block truncate text-[11px] text-neutral-500">{police.usage}</span>
      </span>
      {choisie && <Check size={16} className="text-accent-600" />}
    </button>
  );
}

export function SelecteurPolice({ valeur, surChoix }: { valeur: string; surChoix: (famille: string) => void }) {
  const liste = usePolices();
  const [requete, setRequete] = useState("");
  const [genre, setGenre] = useState<GenrePolice | "toutes">("toutes");

  const filtrees = useMemo(() => {
    const q = normaliser(requete);
    return liste.filter((p) => (genre === "toutes" || p.genre === genre) && (!q || normaliser(`${p.famille} ${p.usage}`).includes(q)));
  }, [liste, requete, genre]);

  const genresPresents = GENRES_POLICE.filter((g) => liste.some((p) => p.genre === g.id));
  const policesMarque = useMarque((s) => s.kit.polices);
  const deLaMarque = ROLES_POLICE.flatMap((r) => {
    const famille = policesMarque[r.id]?.famille;
    const police = famille ? filtrees.find((p) => p.famille === famille) : undefined;
    return police ? [{ role: r.libelle, police }] : [];
  });
  const choisir = (p: Police) => {
    // La police est chargée avant d'être posée : le texte se mesure avec elle.
    void assurerPolice(p.famille, p.gras, p.italique).then(() => surChoix(p.famille));
  };

  return (
    <Bulle
      titre="Police"
      largeur={300}
      classeBouton="flex h-8 w-48 shrink-0 items-center justify-between gap-1 rounded-md border border-neutral-300 bg-white px-2 text-sm hover:bg-neutral-50"
      bouton={
        <>
          <span className="truncate" style={{ fontFamily: pilePolice(valeur) }}>
            {valeur}
          </span>
          <ChevronDown size={14} className="shrink-0 text-neutral-500" />
        </>
      }
    >
      <div className="relative mb-2">
        <Search size={15} className="absolute top-2 left-2 text-neutral-400" />
        <input autoFocus value={requete} onChange={(e) => setRequete(e.target.value)} placeholder="Nom ou usage : luxe, sport, manuscrite…" className="h-8 w-full rounded-md border border-neutral-300 pr-2 pl-7 text-sm outline-none focus:border-accent-500" />
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {[{ id: "toutes" as const, libelle: "Toutes" }, ...genresPresents].map((g) => (
          <button key={g.id} onClick={() => setGenre(g.id)} className={`rounded-full px-2 py-0.5 text-[11px] ${genre === g.id ? "bg-accent-600 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}>
            {g.libelle}
          </button>
        ))}
      </div>
      <div className="max-h-80 overflow-y-auto defilement-fin">
        {deLaMarque.length > 0 && (
          <div className="mb-1 border-b border-neutral-100 pb-1">
            <p className="px-2 pt-1 text-[11px] font-medium text-neutral-500">Polices de la marque</p>
            {deLaMarque.map(({ role, police }) => (
              <NomPolice key={`marque-${role}`} police={{ ...police, usage: role }} choisie={police.famille === valeur} surChoix={() => choisir(police)} />
            ))}
          </div>
        )}
        {filtrees.map((p) => (
          <NomPolice key={p.famille} police={p} choisie={p.famille === valeur} surChoix={() => choisir(p)} />
        ))}
        {filtrees.length === 0 && <p className="py-4 text-center text-xs text-neutral-500">Aucune police ne correspond.</p>}
      </div>
    </Bulle>
  );
}
