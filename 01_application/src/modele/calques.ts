// Le panneau des calques (étape 7, lot 1), en fonctions pures : les lignes qu'il montre, du
// premier plan vers le fond, et l'ordre qu'un glisser y donne. Sur une page fixe, l'ordre
// d'empilement est celui du tableau des éléments ; sur une page vidéo, ce sont les pistes (le
// tableau en découle, voir `frise.ts`).

import { estPageVideo, PISTE_PRINCIPALE } from "./frise";
import type { ElementPage, PageEliot } from "./types";

export type LigneCalque =
  /** Un élément ; `groupe` : le groupe dont il fait partie (`retrait` s'il est sous sa ligne). */
  | { genre: "element"; el: ElementPage; groupe?: string; retrait: boolean }
  /** Un groupe dont les membres se suivent dans la pile : sa ligne, puis eux (sauf replié). */
  | { genre: "groupe"; groupe: string; numero: number; membres: ElementPage[]; replie: boolean };

/** Les membres de chaque groupe se suivent-ils dans `elements` ? */
function groupesContigus(elements: readonly ElementPage[]): Set<string> {
  const vus = new Map<string, number[]>();
  elements.forEach((e, i) => {
    if (e.groupe) vus.set(e.groupe, [...(vus.get(e.groupe) ?? []), i]);
  });
  return new Set([...vus].filter(([, rangs]) => rangs.length > 1 && rangs[rangs.length - 1] - rangs[0] === rangs.length - 1).map(([g]) => g));
}

/**
 * Les lignes du panneau, du premier plan vers le fond. Un groupe dont les membres se suivent a sa
 * ligne, numérotée de haut en bas, puis ses membres en retrait (cachés s'il est dans `replies`) ;
 * un groupe éparpillé dans la pile (un document d'avant) laisse chaque membre à sa place, marqué.
 */
export function lignesCalques(elements: readonly ElementPage[], replies: ReadonlySet<string> = new Set()): LigneCalque[] {
  const contigus = groupesContigus(elements);
  const lignes: LigneCalque[] = [];
  const faits = new Set<string>();
  let numero = 0;
  for (const el of [...elements].reverse()) {
    const g = el.groupe;
    if (g && contigus.has(g)) {
      if (faits.has(g)) continue;
      faits.add(g);
      const membres = elements.filter((e) => e.groupe === g).reverse();
      const replie = replies.has(g);
      lignes.push({ genre: "groupe", groupe: g, numero: ++numero, membres, replie });
      if (!replie) for (const m of membres) lignes.push({ genre: "element", el: m, groupe: g, retrait: true });
    } else {
      lignes.push({ genre: "element", el, ...(g ? { groupe: g } : {}), retrait: false });
    }
  }
  return lignes;
}

/** Les éléments d'une ligne (un groupe : tous ses membres). */
export const elementsDeLigne = (l: LigneCalque): ElementPage[] => (l.genre === "groupe" ? l.membres : [l.el]);

/**
 * Pose `ids` juste au-dessus (`dessus`) ou au-dessous de `cible` dans la pile, sans changer
 * l'ordre entre eux. Page fixe : le tableau des éléments. Page vidéo : une piste entre celle de
 * la cible et sa voisine (la normalisation la numérote) ; un clip de la piste principale ne
 * quitte pas sa piste, et rien ne passe sous elle. Renvoie la page inchangée s'il n'y a rien à
 * faire.
 */
export function placerDansPile(page: PageEliot, ids: readonly string[], cible: string, position: "dessus" | "dessous"): PageEliot {
  const choisis = new Set(ids);
  if (choisis.has(cible) || !page.elements.some((e) => e.id === cible)) return page;
  if (estPageVideo(page)) {
    const c = page.elements.find((e) => e.id === cible)!;
    const base = c.piste ?? PISTE_PRINCIPALE;
    const piste = position === "dessus" || base === PISTE_PRINCIPALE ? base + 0.5 : base - 0.5;
    let change = false;
    const elements = page.elements.map((e) => {
      if (!choisis.has(e.id) || e.piste === undefined || e.piste === PISTE_PRINCIPALE || e.piste === piste) return e;
      change = true;
      return { ...e, piste } as ElementPage;
    });
    return change ? { ...page, elements } : page;
  }
  const bouges = page.elements.filter((e) => choisis.has(e.id));
  if (bouges.length === 0) return page;
  const reste = page.elements.filter((e) => !choisis.has(e.id));
  const i = reste.findIndex((e) => e.id === cible);
  const rang = position === "dessus" ? i + 1 : i;
  const elements = [...reste.slice(0, rang), ...bouges, ...reste.slice(rang)];
  return elements.every((e, k) => e === page.elements[k]) ? page : { ...page, elements };
}

/** Sort `ids` de leur groupe ; un groupe qui n'aurait plus qu'un membre disparaît. */
export function sortirDuGroupe(page: PageEliot, ids: readonly string[]): PageEliot {
  const sortants = new Set(ids);
  const groupes = new Set(page.elements.flatMap((e) => (sortants.has(e.id) && e.groupe ? [e.groupe] : [])));
  if (groupes.size === 0) return page;
  const restants = new Map([...groupes].map((g) => [g, page.elements.filter((e) => e.groupe === g && !sortants.has(e.id)).length]));
  const elements = page.elements.map((e) => {
    if (!e.groupe || !groupes.has(e.groupe) || (!sortants.has(e.id) && (restants.get(e.groupe) ?? 0) > 1)) return e;
    const { groupe: _g, ...sans } = e;
    return sans as ElementPage;
  });
  return { ...page, elements };
}

/** Rassemble les membres d'un groupe à la place du plus haut d'entre eux, dans leur ordre :
 *  un groupe se range d'un bloc dans la pile (page fixe seulement). */
export function rassemblerGroupe(page: PageEliot, groupe: string): PageEliot {
  if (estPageVideo(page)) return page;
  const membres = page.elements.filter((e) => e.groupe === groupe);
  if (membres.length < 2) return page;
  const haut = membres[membres.length - 1];
  const autres = membres.slice(0, -1).map((e) => e.id);
  return placerDansPile(page, autres, haut.id, "dessous");
}
