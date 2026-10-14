// Les outils offerts à une IA (pont MCP, BRIEF § 6) : chacun passe par les actions du store,
// donc par l'historique (Ctrl+Z défait ce que l'IA a fait), et l'utilisateur voit le travail
// se faire dans la fenêtre. Aucun outil ne supprime un design, n'efface une image importée ni
// n'écrit hors des dossiers d'Eliot.

import { elementsCourants, pageCourante, useEditeur } from "../etat/editeur";
import { enregistrerMaintenant } from "../etat/enregistrement";
import { nouveauDesign, ouvrirDesign, renommerDesign, utiliserModele } from "../etat/projets";
import { exporter } from "../export/exporter";
import { rendrePage } from "../export/rendu";
import { creerForme, creerImage, creerTexte, mesurerHauteurTexte } from "../modele/fabriques";
import type { SensAlignement } from "../modele/geometrie";
import { FORMATS_PAGE, type Couleur, type Degrade, type ElementPage, type GenreForme } from "../modele/types";
import { importerChemins, listerProjets } from "../pont/tauri";
import { POLICES } from "../polices";
import definitions from "./outils.json";

export type Arguments = Record<string, unknown>;

/** Ce qu'un outil renvoie : des données (montrées en JSON à l'IA) et, pour une capture, une
 *  image PNG en base64. */
export interface Resultat {
  donnees: unknown;
  imagePng?: string;
}

export class ErreurOutil extends Error {}

const etat = () => useEditeur.getState();

function exiger(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ErreurOutil(message);
}

function designOuvert() {
  exiger(etat().projet && etat().vue === "editeur", "aucun design ouvert : utilise nouveau_design ou ouvrir_design");
}

const nombre = (v: unknown, defaut?: number): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : defaut);
const texte = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const booleen = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);
const listeIds = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

const HEX = /^#[0-9a-fA-F]{6}$/;

function couleur(v: unknown, nom: string): Couleur | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "string") {
    exiger(HEX.test(v), `${nom} : couleur attendue au format #rrggbb`);
    return v.toLowerCase();
  }
  const d = v as Partial<Degrade>;
  exiger(d && (d.type === "lineaire" || d.type === "radial") && Array.isArray(d.arrets) && d.arrets.length >= 2, `${nom} : dégradé incomplet (type et deux arrêts au moins)`);
  const arrets = d.arrets!.map((a) => {
    exiger(typeof a.position === "number" && typeof a.couleur === "string" && HEX.test(a.couleur), `${nom} : arrêt de dégradé invalide`);
    return { position: Math.max(0, Math.min(1, a.position)), couleur: a.couleur.toLowerCase() };
  });
  return { type: d.type!, angle: nombre(d.angle, 0)!, arrets };
}

/** Le résumé de l'état, ce que l'IA lit avant d'agir. */
function resumer() {
  const s = etat();
  if (!s.projet || s.vue !== "editeur") return { designOuvert: false, conseil: "aucun design ouvert : lister_designs, puis ouvrir_design ou nouveau_design" };
  const page = pageCourante(s);
  return {
    designOuvert: true,
    nom: s.document.nom,
    format: s.document.format,
    pages: s.document.pages.length,
    pageAffichee: s.document.pages.findIndex((p) => p.id === page.id) + 1,
    fond: page.fond,
    elements: page.elements,
    selection: s.selection,
    images: s.ordreRessources.map((id) => s.ressources[id]).filter(Boolean),
    polices: POLICES.map((p) => p.famille),
    annulable: s.passe.length,
  };
}

/** Propriétés qu'une modification peut toucher, selon le type de l'élément. */
const COMMUNES = ["x", "y", "largeur", "hauteur", "rotation", "opacite", "visible", "verrouille", "nom"];
const PAR_TYPE: Record<ElementPage["type"], string[]> = {
  texte: ["texte", "police", "taillePolice", "couleur", "gras", "italique", "souligne", "alignement", "interligne", "espacement"],
  forme: ["remplissage", "contour", "epaisseurContour", "arrondi", "forme"],
  image: ["retourneH", "retourneV"],
};

function nettoyerModification(el: ElementPage, brut: Arguments): Partial<ElementPage> {
  const permises = new Set([...COMMUNES, ...PAR_TYPE[el.type]]);
  const propre: Record<string, unknown> = {};
  for (const [cle, valeur] of Object.entries(brut)) {
    if (cle === "id") continue;
    exiger(permises.has(cle), `propriété inconnue pour un élément ${el.type} : ${cle}`);
    if (cle === "couleur" || cle === "remplissage") propre[cle] = couleur(valeur, cle);
    else if (cle === "contour") propre[cle] = couleur(valeur, cle) as string;
    else if (cle === "police") {
      exiger(POLICES.some((p) => p.famille === valeur), `police inconnue : ${String(valeur)} (voir etat)`);
      propre[cle] = valeur;
    } else if (["x", "y", "largeur", "hauteur", "rotation", "opacite", "taillePolice", "interligne", "espacement", "epaisseurContour", "arrondi"].includes(cle)) {
      exiger(typeof valeur === "number" && Number.isFinite(valeur), `${cle} : nombre attendu`);
      propre[cle] = valeur;
    } else propre[cle] = valeur;
  }
  if (typeof propre.largeur === "number") propre.largeur = Math.max(1, propre.largeur);
  if (typeof propre.hauteur === "number") propre.hauteur = Math.max(1, propre.hauteur);
  if (typeof propre.opacite === "number") propre.opacite = Math.max(0, Math.min(1, propre.opacite));
  return propre as Partial<ElementPage>;
}

function placer<T extends ElementPage>(el: T, args: Arguments): T {
  const sortie = { ...el };
  const largeur = nombre(args.largeur);
  const hauteur = nombre(args.hauteur);
  if (largeur !== undefined) sortie.largeur = Math.max(1, largeur);
  if (hauteur !== undefined) sortie.hauteur = Math.max(1, hauteur);
  const format = etat().document.format;
  sortie.x = nombre(args.x, Math.round((format.largeur - sortie.largeur) / 2))!;
  sortie.y = nombre(args.y, Math.round((format.hauteur - sortie.hauteur) / 2))!;
  sortie.rotation = nombre(args.rotation, 0)!;
  sortie.opacite = Math.max(0, Math.min(1, nombre(args.opacite, 1)!));
  return sortie;
}

async function base64(blob: Blob): Promise<string> {
  const octets = new Uint8Array(await blob.arrayBuffer());
  let binaire = "";
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(binaire);
}

type Outil = (args: Arguments) => Promise<Resultat> | Resultat;

const OUTILS: Record<string, Outil> = {
  etat: () => ({ donnees: resumer() }),

  async capture(args) {
    designOuvert();
    const s = etat();
    const numero = nombre(args.page, s.document.pages.findIndex((p) => p.id === s.pageActive) + 1)!;
    const page = s.document.pages[numero - 1];
    exiger(page, `page ${numero} introuvable (le design en a ${s.document.pages.length})`);
    const largeur = Math.max(100, Math.min(1600, nombre(args.largeur, 800)!));
    const blob = await rendrePage(page, s.document.format, { pixelRatio: largeur / s.document.format.largeur, type: "image/png" });
    return { donnees: { page: numero, largeur, format: s.document.format }, imagePng: await base64(blob) };
  },

  async lister_designs() {
    const [designs, modeles] = await Promise.all([listerProjets("designs"), listerProjets("modeles")]);
    return { donnees: { designs, modeles, ouvert: etat().vue === "editeur" ? etat().projet : null } };
  },

  async nouveau_design(args) {
    const format = FORMATS_PAGE.find((f) => f.id === args.format);
    const largeur = nombre(args.largeur, format?.largeur);
    const hauteur = nombre(args.hauteur, format?.hauteur);
    exiger(largeur && hauteur, "donne un format (carre, story…) ou une largeur et une hauteur");
    const ok = await nouveauDesign({ largeur: Math.round(largeur), hauteur: Math.round(hauteur) }, texte(args.nom)?.trim() || undefined);
    exiger(ok, "création impossible");
    return { donnees: resumer() };
  },

  async ouvrir_design(args) {
    const id = texte(args.id);
    exiger(id, "id manquant");
    if (booleen(args.modele)) {
      const modele = (await listerProjets("modeles")).find((m) => m.id === id);
      exiger(modele, `modèle introuvable : ${id}`);
      await utiliserModele({ rayon: "modeles", id }, modele.nom);
    } else {
      exiger(await ouvrirDesign({ rayon: "designs", id }), `ouverture impossible : ${id}`);
    }
    return { donnees: resumer() };
  },

  async renommer_design(args) {
    designOuvert();
    const nom = texte(args.nom)?.trim();
    exiger(nom, "nom vide");
    await renommerDesign(nom);
    return { donnees: { nom: etat().document.nom, id: etat().projet?.id } };
  },

  ajouter_texte(args) {
    designOuvert();
    const contenu = texte(args.texte);
    exiger(contenu?.trim(), "texte vide");
    const format = etat().document.format;
    const police = texte(args.police);
    if (police) exiger(POLICES.some((p) => p.famille === police), `police inconnue : ${police} (voir etat)`);
    const base = creerTexte(format, {
      texte: contenu!,
      taillePolice: nombre(args.taillePolice, Math.round((56 * Math.max(format.largeur, format.hauteur)) / 1080))!,
      gras: booleen(args.gras) ?? false,
      ...(police ? { police } : {}),
      ...(args.couleur !== undefined ? { couleur: couleur(args.couleur, "couleur") } : {}),
      ...(booleen(args.italique) !== undefined ? { italique: booleen(args.italique) } : {}),
      ...(booleen(args.souligne) !== undefined ? { souligne: booleen(args.souligne) } : {}),
      ...(["left", "center", "right"].includes(String(args.alignement)) ? { alignement: args.alignement as "left" } : {}),
      ...(nombre(args.interligne) !== undefined ? { interligne: nombre(args.interligne) } : {}),
      ...(nombre(args.espacement) !== undefined ? { espacement: nombre(args.espacement) } : {}),
    });
    const largeur = nombre(args.largeur);
    const avecLargeur = largeur ? { ...base, largeur: Math.max(20, largeur) } : base;
    const el = placer({ ...avecLargeur, hauteur: mesurerHauteurTexte(avecLargeur) }, { ...args, hauteur: undefined, largeur: undefined });
    etat().ajouterElements([el]);
    return { donnees: el };
  },

  ajouter_forme(args) {
    designOuvert();
    const genre = texte(args.forme) as GenreForme;
    exiger(["rectangle", "ellipse", "triangle", "etoile"].includes(genre), "forme : rectangle, ellipse, triangle ou etoile");
    const base = creerForme(etat().document.format, genre, nombre(args.arrondi, 0));
    const el = placer(
      {
        ...base,
        ...(args.remplissage !== undefined ? { remplissage: couleur(args.remplissage, "remplissage")! } : {}),
        ...(args.contour !== undefined ? { contour: couleur(args.contour, "contour") as string } : {}),
        ...(nombre(args.epaisseurContour) !== undefined ? { epaisseurContour: nombre(args.epaisseurContour)! } : {}),
      },
      args,
    );
    etat().ajouterElements([el]);
    return { donnees: el };
  },

  async importer_image(args) {
    designOuvert();
    const chemin = texte(args.chemin);
    exiger(chemin?.startsWith("/"), "chemin absolu attendu");
    const bilan = await importerChemins(etat().projet!, [chemin!]);
    exiger(bilan.ressources.length, bilan.erreurs.join(" ; ") || "import impossible");
    etat().ajouterRessources(bilan.ressources);
    return { donnees: bilan.ressources[0] };
  },

  ajouter_image(args) {
    designOuvert();
    const r = etat().ressources[String(args.ressource)];
    exiger(r, `image inconnue dans ce design : ${String(args.ressource)} (voir etat ou importer_image)`);
    const base = creerImage(etat().document.format, r);
    const largeur = nombre(args.largeur);
    const hauteur = nombre(args.hauteur);
    const ratio = r.largeur / r.hauteur;
    const dimensions =
      largeur && hauteur ? { largeur, hauteur } : largeur ? { largeur, hauteur: largeur / ratio } : hauteur ? { largeur: hauteur * ratio, hauteur } : {};
    const el = placer(base, { ...args, ...dimensions });
    etat().ajouterElements([el]);
    return { donnees: el };
  },

  modifier(args) {
    designOuvert();
    exiger(Array.isArray(args.modifications) && args.modifications.length, "modifications : liste d'objets { id, … }");
    const parId = new Map(elementsCourants(etat()).map((e) => [e.id, e]));
    const modifs: Record<string, Partial<ElementPage>> = {};
    for (const m of args.modifications as Arguments[]) {
      const el = parId.get(String(m.id));
      exiger(el, `élément introuvable sur la page affichée : ${String(m.id)}`);
      modifs[el.id] = nettoyerModification(el, m);
    }
    etat().modifierElements(modifs);
    const apres = new Map(elementsCourants(etat()).map((e) => [e.id, e]));
    return { donnees: Object.keys(modifs).map((id) => apres.get(id)) };
  },

  supprimer(args) {
    designOuvert();
    useEditeur.setState({ selection: listeIds(args.ids) });
    etat().supprimerSelection();
    return { donnees: { restants: elementsCourants(etat()).length } };
  },

  ordre(args) {
    designOuvert();
    useEditeur.setState({ selection: listeIds(args.ids) });
    etat().deplacerDansPile(args.sens as "premier");
    return { donnees: { ordre: elementsCourants(etat()).map((e) => e.id) } };
  },

  aligner(args) {
    designOuvert();
    useEditeur.setState({ selection: listeIds(args.ids) });
    etat().alignerSelection(args.sens as SensAlignement);
    return { donnees: elementsSelectionnesParIds(listeIds(args.ids)) };
  },

  repartir(args) {
    designOuvert();
    useEditeur.setState({ selection: listeIds(args.ids) });
    etat().repartirSelection(args.axe === "vertical" ? "vertical" : "horizontal");
    return { donnees: elementsSelectionnesParIds(listeIds(args.ids)) };
  },

  grouper(args) {
    designOuvert();
    useEditeur.setState({ selection: listeIds(args.ids) });
    if (booleen(args.degrouper)) etat().degrouperSelection();
    else etat().grouperSelection();
    return { donnees: elementsSelectionnesParIds(listeIds(args.ids)) };
  },

  fond_page(args) {
    designOuvert();
    etat().modifierFond(couleur(args.couleur, "couleur")!);
    return { donnees: { fond: pageCourante(etat()).fond } };
  },

  pages(args) {
    designOuvert();
    const s = etat();
    const page = (n: unknown) => {
      const p = s.document.pages[(nombre(n) ?? 0) - 1];
      exiger(p, `page ${String(n)} introuvable (le design en a ${s.document.pages.length})`);
      return p;
    };
    switch (args.action) {
      case "ajouter":
        s.ajouterPage();
        break;
      case "dupliquer":
        s.dupliquerPageActive();
        break;
      case "supprimer":
        exiger(s.document.pages.length > 1, "la dernière page ne se supprime pas");
        s.supprimerPage(page(args.numero).id);
        break;
      case "aller":
        s.allerALaPage(page(args.numero).id);
        break;
      case "deplacer":
        s.deplacerPage(page(args.numero).id, (nombre(args.vers) ?? 1) - 1);
        break;
      default:
        throw new ErreurOutil("action : ajouter, dupliquer, supprimer, aller ou deplacer");
    }
    const apres = etat();
    return { donnees: { pages: apres.document.pages.length, pageAffichee: apres.document.pages.findIndex((p) => p.id === apres.pageActive) + 1 } };
  },

  changer_format(args) {
    designOuvert();
    const largeur = nombre(args.largeur);
    const hauteur = nombre(args.hauteur);
    exiger(largeur && hauteur && largeur >= 16 && hauteur >= 16, "largeur et hauteur en pixels, 16 au moins");
    etat().modifierFormat({ largeur: Math.round(largeur), hauteur: Math.round(hauteur) }, booleen(args.adapter) ?? true);
    etat().definirZoom(null);
    return { donnees: { format: etat().document.format } };
  },

  annuler(args) {
    for (let i = 0; i < Math.min(50, nombre(args.fois, 1)!); i++) etat().annuler();
    return { donnees: { annulable: etat().passe.length, retablissable: etat().futur.length } };
  },

  retablir(args) {
    for (let i = 0; i < Math.min(50, nombre(args.fois, 1)!); i++) etat().retablir();
    return { donnees: { annulable: etat().passe.length, retablissable: etat().futur.length } };
  },

  async exporter(args) {
    designOuvert();
    await enregistrerMaintenant();
    const chemins = await exporter({
      format: args.format === "jpeg" ? "jpeg" : "png",
      pages: args.pages === "toutes" ? "toutes" : "courante",
      ratio: args.ratio === 2 ? 2 : 1,
      transparent: booleen(args.transparent) ?? false,
    });
    return { donnees: { chemins } };
  },
};

function elementsSelectionnesParIds(ids: string[]) {
  return elementsCourants(etat()).filter((e) => ids.includes(e.id));
}

/** Exécute un outil. Une erreur devient un message clair pour l'IA, jamais un plantage. */
export async function executerOutil(nom: string, args: Arguments): Promise<Resultat> {
  const outil = OUTILS[nom];
  if (!outil) throw new ErreurOutil(`outil inconnu : ${nom}`);
  return outil(args ?? {});
}

/** Contrôle au chargement : chaque outil décrit a son code, et inversement. */
export const OUTILS_DECRITS = (definitions as { name: string }[]).map((d) => d.name);
export const OUTILS_CODES = Object.keys(OUTILS);
