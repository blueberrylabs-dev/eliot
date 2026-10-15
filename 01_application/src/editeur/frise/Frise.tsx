// La frise d'une page vidéo, en bas de l'écran, façon CapCut (étape 4, lot 2) : barre de
// lecture, règle graduée, tête de lecture, pistes et clips. Glisser un clip le déplace dans le
// temps ou sur une autre piste, tirer un bord le raccourcit ou le rallonge ; pendant le geste,
// la frise montre déjà le résultat (calculé par `modele/frise.ts`, comme au lâcher). Les bords
// des clips et la tête aimantent.

import { ChevronDown, ChevronUp, CopyPlus, Maximize2, Minus, Pause, Play, Plus, Scissors, Trash2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as PointeurReact } from "react";
import { pageCourante, useEditeur } from "../../etat/editeur";
import { HAUTEUR_FRISE_MIN, useTemps } from "../../etat/temps";
import { aimanter, bordsDesClips, deplacerClip, pistesDe, PISTE_PRINCIPALE, rogner, tempsLisible, visibleA, type Durees } from "../../modele/frise";
import type { ElementPage, PageEliot } from "../../modele/types";
import { Clip } from "./Clip";
import "./horloge";

const ENTETE = 76;
const REGLE = 24;
const HAUTEUR_PRINCIPALE = 62;
const HAUTEUR_PISTE = 34;
/** Distance d'aimantation, en pixels d'écran. */
const AIMANT_PX = 8;
const SEUIL_GESTE_PX = 3;

/** Un début de clip aimanté par son bord gauche ou son bord droit, le plus proche des deux. */
function debutAimante(brut: number, longueur: number, cibles: number[], seuil: number): number {
  const parDebut = aimanter(brut, cibles, seuil);
  const parFin = aimanter(brut + longueur, cibles, seuil) - longueur;
  if (parDebut !== brut && (parFin === brut || Math.abs(parDebut - brut) <= Math.abs(parFin - brut))) return parDebut;
  return parFin;
}

type Geste =
  | { genre: "deplacer"; id: string; x0: number; y0: number; debut0: number; piste0: number; actif: boolean }
  | { genre: "rogner"; id: string; cote: "debut" | "fin"; x0: number; bord0: number }
  | { genre: "tete" };

/** Les pas de graduation possibles, en secondes ; on prend le premier qui laisse 64 px. */
const PAS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

function Regle({ duree, echelle, largeur }: { duree: number; echelle: number; largeur: number }) {
  const pas = PAS.find((p) => p * 1000 * echelle >= 64) ?? 600;
  const traits: React.ReactNode[] = [];
  const fin = Math.max(duree, largeur / echelle);
  for (let s = 0, i = 0; s * 1000 <= fin && i < 4000; s += pas / 5, i++) {
    const x = s * 1000 * echelle;
    const majeur = i % 5 === 0;
    traits.push(<span key={i} className={`absolute bottom-0 w-px ${majeur ? "h-2.5 bg-zinc-400" : "h-1.5 bg-zinc-600"}`} style={{ left: x }} />);
    if (majeur) {
      const total = Math.round(s * 10) / 10;
      const libelle = total >= 60 ? `${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")}` : `${String(total).replace(".", ",")} s`;
      traits.push(
        <span key={`l${i}`} className="absolute top-0.5 text-[10px] text-zinc-400 tabular-nums" style={{ left: x + 3 }}>
          {libelle}
        </span>,
      );
    }
  }
  return <>{traits}</>;
}

/** Le temps de la tête, mis à jour sans redessiner la frise. */
function TempsTete({ duree }: { duree: number }) {
  const texte = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const ecrire = (t: number) => {
      if (texte.current) texte.current.textContent = `${tempsLisible(t)} / ${tempsLisible(duree)}`;
    };
    ecrire(useTemps.getState().tete);
    return useTemps.subscribe((s) => ecrire(s.tete));
  }, [duree]);
  return <span ref={texte} data-temps-frise className="min-w-28 text-sm text-zinc-200 tabular-nums" />;
}

function BarreFrise({ page, largeurZone }: { page: PageEliot; largeurZone: number }) {
  const joue = useTemps((s) => s.joue);
  const repliee = useTemps((s) => s.repliee);
  const pxParSeconde = useTemps((s) => s.pxParSeconde);
  const selection = useEditeur((s) => s.selection);
  const etat = useEditeur.getState();
  const temps = useTemps.getState();
  const duree = page.duree ?? 0;
  const ajuste = ((largeurZone - ENTETE - 32) / Math.max(1000, duree)) * 1000;
  const zoomActuel = pxParSeconde ?? ajuste;
  const bouton = "flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-1.5 text-zinc-200 hover:bg-white/10 disabled:opacity-35 disabled:hover:bg-transparent";
  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b border-black/40 px-2">
      <button className={`${bouton} w-9 bg-white/10`} title={joue ? "Pause (Espace)" : "Lire (Espace)"} aria-label={joue ? "Pause" : "Lire"} onClick={() => temps.basculerLecture()}>
        {joue ? <Pause size={17} /> : <Play size={17} />}
      </button>
      <TempsTete duree={duree} />
      <span className="mx-1.5 h-5 w-px bg-white/15" />
      <button className={bouton} title="Scinder à la tête de lecture (Ctrl+B)" onClick={() => etat.scinderALaTete()}>
        <Scissors size={16} /> <span className="text-sm">Scinder</span>
      </button>
      <button className={bouton} title="Dupliquer (Ctrl+D) : la copie suit l'original" disabled={selection.length === 0} onClick={() => etat.dupliquerSelection()}>
        <CopyPlus size={16} />
      </button>
      <button className={bouton} title="Supprimer (Suppr)" disabled={selection.length === 0} onClick={() => etat.supprimerSelection()}>
        <Trash2 size={16} />
      </button>
      <span className="flex-1" />
      <button className={bouton} title="Dézoomer la frise (Ctrl + molette)" onClick={() => temps.definirZoom(zoomActuel / 1.5)}>
        <Minus size={16} />
      </button>
      <button className={bouton} title="Zoomer la frise (Ctrl + molette)" onClick={() => temps.definirZoom(zoomActuel * 1.5)}>
        <Plus size={16} />
      </button>
      <button className={`${bouton} ${pxParSeconde === null ? "bg-white/10" : ""}`} title="Toute la vidéo dans la largeur" onClick={() => temps.definirZoom(null)}>
        <Maximize2 size={15} />
      </button>
      <button className={bouton} title={repliee ? "Déplier la frise" : "Replier la frise"} onClick={() => temps.basculerRepli()}>
        {repliee ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
      </button>
    </div>
  );
}

export function Frise() {
  const page = useEditeur(pageCourante);
  const selection = useEditeur((s) => s.selection);
  const ressources = useEditeur((s) => s.ressources);
  const hauteurFrise = useTemps((s) => s.hauteurFrise);
  const repliee = useTemps((s) => s.repliee);
  const pxParSeconde = useTemps((s) => s.pxParSeconde);
  const zone = useRef<HTMLDivElement>(null);
  const tete = useRef<HTMLDivElement>(null);
  const lignes = useRef(new Map<number, HTMLDivElement>());
  const [largeurZone, setLargeurZone] = useState(1000);
  const [apercu, setApercu] = useState<PageEliot | null>(null);
  const geste = useRef<Geste | null>(null);
  const durees: Durees = useCallback((id: string) => ressources[id]?.video?.duree, [ressources]);

  const duree = page.duree ?? 0;
  const pxS = pxParSeconde ?? Math.max(8, ((largeurZone - ENTETE - 32) / Math.max(1000, duree)) * 1000);
  const echelle = pxS / 1000;
  const affichee = apercu ?? page;
  const pistes = useMemo(() => pistesDe(affichee), [affichee]);
  const largeurContenu = Math.max(largeurZone - ENTETE, (Math.max(duree, affichee.duree ?? 0) + 4000) * echelle);

  // Largeur de la zone, pour le zoom « tout dans la largeur ».
  useLayoutEffect(() => {
    const n = zone.current;
    if (!n) return;
    const obs = new ResizeObserver(() => setLargeurZone(n.clientWidth));
    obs.observe(n);
    setLargeurZone(n.clientWidth);
    return () => obs.disconnect();
  }, [repliee]);

  // La tête de lecture suit le temps sans redessiner la frise ; en lecture, la frise défile
  // pour la garder en vue.
  useEffect(() => {
    const placer = (t: number, joue: boolean) => {
      const x = ENTETE + t * echelle;
      if (tete.current) tete.current.style.transform = `translateX(${x}px)`;
      const z = zone.current;
      if (z && joue && (x > z.scrollLeft + z.clientWidth - 40 || x < z.scrollLeft + ENTETE)) z.scrollLeft = Math.max(0, x - ENTETE - 60);
    };
    placer(useTemps.getState().tete, false);
    return useTemps.subscribe((s) => placer(s.tete, s.joue));
  }, [echelle, repliee]);

  // Ctrl + molette : zoom autour du pointeur.
  useEffect(() => {
    const z = zone.current;
    if (!z) return;
    const molette = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = z.getBoundingClientRect();
      const xContenu = e.clientX - r.left + z.scrollLeft - ENTETE;
      const instant = xContenu / echelle;
      const suivant = Math.max(8, Math.min(600, pxS * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
      useTemps.getState().definirZoom(suivant);
      requestAnimationFrame(() => {
        z.scrollLeft = Math.max(0, instant * (suivant / 1000) - (e.clientX - r.left - ENTETE));
      });
    };
    z.addEventListener("wheel", molette, { passive: false });
    return () => z.removeEventListener("wheel", molette);
  }, [echelle, pxS, repliee]);

  const instantSous = (clientX: number) => {
    const z = zone.current!;
    const r = z.getBoundingClientRect();
    return (clientX - r.left + z.scrollLeft - ENTETE) / echelle;
  };
  const borner = (t: number) => Math.max(0, Math.min(Math.max(0, duree - 1), Math.round(t)));

  /** La piste sous le pointeur ; au-dessus de la plus haute : une piste neuve. */
  const pisteSous = (clientY: number): number => {
    const max = Math.max(0, ...pistes.map((p) => p.piste));
    for (const [piste, ligne] of lignes.current) {
      const r = ligne.getBoundingClientRect();
      if (clientY >= r.top && clientY < r.bottom) return piste;
    }
    const haut = lignes.current.get(max)?.getBoundingClientRect().top ?? 0;
    return clientY < haut ? max + 1 : PISTE_PRINCIPALE;
  };

  const suivre = (e: PointerEvent) => {
    const g = geste.current;
    if (!g) return;
    const etat = useEditeur.getState();
    const actuelle = pageCourante(etat);
    if (g.genre === "tete") {
      useTemps.getState().allerA(borner(instantSous(e.clientX)));
      return;
    }
    const el = actuelle.elements.find((x) => x.id === g.id);
    if (!el?.temps) return;
    const seuil = AIMANT_PX / echelle;
    const cibles = [...bordsDesClips(actuelle, g.id), useTemps.getState().tete];
    if (g.genre === "deplacer") {
      if (!g.actif && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < SEUIL_GESTE_PX) return;
      g.actif = true;
      const debut = debutAimante(g.debut0 + (e.clientX - g.x0) / echelle, el.temps.fin - el.temps.debut, cibles, seuil);
      setApercu(deplacerClip(actuelle, g.id, debut, pisteSous(e.clientY), durees));
      return;
    }
    const t = aimanter(g.bord0 + (e.clientX - g.x0) / echelle, cibles, seuil);
    const resultat = rogner(actuelle, g.id, g.cote, t, durees);
    setApercu(resultat);
    // La page montre l'image du bord qu'on tire.
    const apres = resultat.elements.find((x) => x.id === g.id)?.temps;
    if (apres) useTemps.getState().allerA(g.cote === "debut" ? apres.debut : Math.max(apres.debut, apres.fin - 1));
  };

  const lacher = (e: PointerEvent) => {
    const g = geste.current;
    geste.current = null;
    window.removeEventListener("pointermove", suivre);
    window.removeEventListener("pointerup", lacher);
    window.removeEventListener("pointercancel", lacher);
    setApercu(null);
    if (!g || g.genre === "tete") return;
    const etat = useEditeur.getState();
    const actuelle = pageCourante(etat);
    const el = actuelle.elements.find((x) => x.id === g.id);
    if (!el?.temps) return;
    if (g.genre === "deplacer") {
      if (!g.actif) {
        // Un simple clic : si le clip ne se voit pas à la tête, la tête va à son début, pour
        // qu'on le voie sur la page.
        if (!visibleA(el, useTemps.getState().tete)) useTemps.getState().allerA(el.temps.debut);
        return;
      }
      const cibles = [...bordsDesClips(actuelle, g.id), useTemps.getState().tete];
      const debut = debutAimante(g.debut0 + (e.clientX - g.x0) / echelle, el.temps.fin - el.temps.debut, cibles, AIMANT_PX / echelle);
      etat.deplacerClip(g.id, debut, pisteSous(e.clientY));
      return;
    }
    const seuil = AIMANT_PX / echelle;
    const t = aimanter(g.bord0 + (e.clientX - g.x0) / echelle, [...bordsDesClips(actuelle, g.id), useTemps.getState().tete], seuil);
    etat.rognerClip(g.id, g.cote, t);
  };

  const commencer = (g: Geste) => {
    geste.current = g;
    window.addEventListener("pointermove", suivre);
    window.addEventListener("pointerup", lacher);
    window.addEventListener("pointercancel", lacher);
  };

  const surCorps = (e: PointeurReact<HTMLDivElement>, el: ElementPage) => {
    if (e.button !== 0 || !el.temps) return;
    e.preventDefault();
    e.stopPropagation();
    const etat = useEditeur.getState();
    if (e.shiftKey) etat.basculerDansSelection(el.id);
    else if (!etat.selection.includes(el.id) || etat.selection.length > 1) etat.selectionnerSeul(el.id);
    if (el.verrouille) return;
    commencer({ genre: "deplacer", id: el.id, x0: e.clientX, y0: e.clientY, debut0: el.temps.debut, piste0: el.piste ?? 0, actif: false });
  };

  const surBord = (e: PointeurReact<HTMLDivElement>, el: ElementPage, cote: "debut" | "fin") => {
    if (e.button !== 0 || !el.temps) return;
    e.preventDefault();
    e.stopPropagation();
    useTemps.getState().pause();
    useEditeur.getState().selectionnerSeul(el.id);
    commencer({ genre: "rogner", id: el.id, cote, x0: e.clientX, bord0: cote === "debut" ? el.temps.debut : el.temps.fin });
  };

  /** Clic sur la règle ou sur un endroit vide : la tête y va, et suit le pointeur. */
  const surFond = (e: PointeurReact<HTMLDivElement>, deselectionner: boolean) => {
    if (e.button !== 0) return;
    e.preventDefault();
    useTemps.getState().pause();
    if (deselectionner) useEditeur.getState().deselectionner();
    useTemps.getState().allerA(borner(instantSous(e.clientX)));
    commencer({ genre: "tete" });
  };

  // La poignée du haut règle la hauteur de la frise.
  const surPoignee = (e: PointeurReact<HTMLDivElement>) => {
    e.preventDefault();
    const y0 = e.clientY;
    const h0 = useTemps.getState().hauteurFrise;
    const bouger = (m: PointerEvent) => useTemps.getState().definirHauteur(Math.min(window.innerHeight * 0.7, Math.max(HAUTEUR_FRISE_MIN, h0 - (m.clientY - y0))));
    const fin = () => {
      window.removeEventListener("pointermove", bouger);
      window.removeEventListener("pointerup", fin);
    };
    window.addEventListener("pointermove", bouger);
    window.addEventListener("pointerup", fin);
  };

  const vide = page.elements.length === 0;
  return (
    <section data-frise className="relative flex shrink-0 flex-col border-t border-black/50 bg-zinc-900 text-zinc-200" style={{ height: repliee ? 40 : hauteurFrise }}>
      {!repliee && <div onPointerDown={surPoignee} title="Tirer pour changer la hauteur de la frise" className="absolute -top-1 left-0 z-40 h-2 w-full cursor-ns-resize" />}
      <BarreFrise page={page} largeurZone={largeurZone} />
      {!repliee && (
        <div ref={zone} data-zone-frise className="relative min-h-0 flex-1 overflow-auto defilement-fin">
          <div className="relative" style={{ width: ENTETE + largeurContenu, minHeight: "100%" }}>
            {/* La règle, collée en haut ; un clic y place la tête. */}
            <div className="sticky top-0 z-20 flex bg-zinc-900" style={{ height: REGLE }}>
              <div className="sticky left-0 z-30 shrink-0 bg-zinc-900" style={{ width: ENTETE }} />
              <div data-regle className="relative flex-1 cursor-text border-b border-white/10" onPointerDown={(e) => surFond(e, false)}>
                <Regle duree={duree} echelle={echelle} largeur={largeurContenu} />
              </div>
            </div>
            {pistes.map(({ piste, clips }) => {
              const hauteur = piste === PISTE_PRINCIPALE ? HAUTEUR_PRINCIPALE : HAUTEUR_PISTE;
              return (
                <div key={piste} className="flex" style={{ height: hauteur }}>
                  <div className="sticky left-0 z-10 flex shrink-0 items-center border-r border-b border-white/10 bg-zinc-900 px-2 text-[11px] text-zinc-400" style={{ width: ENTETE }}>
                    {piste === PISTE_PRINCIPALE ? "Principale" : `Piste ${piste}`}
                  </div>
                  <div
                    ref={(n) => {
                      if (n) lignes.current.set(piste, n);
                      else lignes.current.delete(piste);
                    }}
                    data-piste={piste}
                    className={`relative flex-1 border-b border-white/5 ${piste === PISTE_PRINCIPALE ? "bg-zinc-800" : "bg-zinc-800/50"}`}
                    onPointerDown={(e) => surFond(e, true)}
                  >
                    {piste === PISTE_PRINCIPALE && vide && <span className="absolute top-1/2 left-3 -translate-y-1/2 text-xs text-zinc-500">Importe une vidéo ou une photo : elle se pose ici, bout à bout avec les suivantes.</span>}
                    {piste === PISTE_PRINCIPALE && !vide && clips.length === 0 && <span className="absolute top-1/2 left-3 -translate-y-1/2 text-xs text-zinc-500">Piste principale : glisse ici une vidéo ou une photo.</span>}
                    {clips.map((el) => (
                      <Clip key={el.id} el={el} echelle={echelle} hauteur={hauteur} choisi={selection.includes(el.id)} ressource={el.type === "video" || el.type === "image" ? ressources[el.ressource] : undefined} surCorps={surCorps} surBord={surBord} />
                    ))}
                  </div>
                </div>
              );
            })}
            {/* La tête de lecture : un trait sur toute la hauteur, avec sa poignée sur la règle. */}
            <div ref={tete} data-tete className="pointer-events-none absolute top-0 left-0 z-20 h-full" style={{ width: 0 }}>
              <div className="absolute top-0 h-full w-0.5 -translate-x-1/2 bg-white" />
              <div className="absolute top-0 h-3 w-3 -translate-x-1/2 rotate-45 rounded-[2px] bg-white" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
