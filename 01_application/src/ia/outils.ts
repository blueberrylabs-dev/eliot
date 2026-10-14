// Les outils offerts à une IA (pont MCP, BRIEF § 6) : chacun passe par les actions du store,
// donc par l'historique (Ctrl+Z défait ce que l'IA a fait), et l'utilisateur voit le travail
// se faire dans la fenêtre. Aucun outil ne supprime un design, n'efface une image importée ni
// n'écrit hors des dossiers d'Eliot.

import { elementsCourants, pageCourante, useEditeur } from "../etat/editeur";
import { enregistrerMaintenant } from "../etat/enregistrement";
import { copierPoliceDansDesign, nouveauDesign, ouvrirDesign, renommerDesign, utiliserModele } from "../etat/projets";
import { exporter } from "../export/exporter";
import { rendrePage } from "../export/rendu";
import { collection as collectionBibliotheque, nomsEmojis, rechercher, traces } from "../bibliotheque/bibliotheque";
import { APPAREILS, DISPOSITIONS } from "../modele/cadres";
import { creerCadre, creerEmoji, creerForme, creerGrille, creerIcone, creerImage, creerMaquette, creerQr, creerTexte, mesurerHauteurTexte } from "../modele/fabriques";
import type { SensAlignement } from "../modele/geometrie";
import { FORMATS_PAGE, recoitPhoto, type Appareil, type Couleur, type Degrade, type ElementPage, type FormeCadre, type GenreForme } from "../modele/types";
import { logoDansDesign, useMarque } from "../etat/marque";
import { telechargerPhotoPixabay } from "../etat/photos";
import { ROLES_POLICE, type KitMarque } from "../modele/marque";
import { chercherPixabay, etatPixabay, importerChemins, listerProjets, urlApercuPixabay, type PhotoPixabay } from "../pont/tauri";
import { assurerPolice, polices } from "../polices";
import definitions from "./outils.json";

export type Arguments = Record<string, unknown>;

/** Ce qu'un outil renvoie : des données (montrées en JSON à l'IA) et, pour une capture ou une
 *  planche de photos, une image PNG ou JPEG en base64. */
export interface Resultat {
  donnees: unknown;
  image?: string;
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
const famillesConnues = () => polices().map((p) => p.famille);

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
    // Les polices de la bibliothèque ; celles du poste (souvent des dizaines) par lister_polices.
    polices: polices().filter((p) => p.genre !== "poste").map((p) => p.famille),
    policesDuPoste: `${polices().filter((p) => p.genre === "poste").length} (voir lister_polices, genre poste)`,
    annulable: s.passe.length,
    // Le kit de marque en bref ; tout le détail (logos compris) par l'outil marque.
    marque: { nom: useMarque.getState().kit.nom, couleurs: useMarque.getState().kit.couleurs.map((c) => c.valeur), polices: useMarque.getState().kit.polices },
  };
}

/** Propriétés qu'une modification peut toucher, selon le type de l'élément. */
const COMMUNES = ["x", "y", "largeur", "hauteur", "rotation", "opacite", "visible", "verrouille", "nom", "ombre"];
const PAR_TYPE: Record<ElementPage["type"], string[]> = {
  texte: ["texte", "police", "taillePolice", "couleur", "gras", "italique", "souligne", "barre", "majuscules", "alignement", "interligne", "espacement", "contour", "surlignage"],
  forme: ["remplissage", "contour", "epaisseurContour", "arrondi", "forme", "cotes", "tirets", "pointes"],
  image: ["retourneH", "retourneV", "arrondi", "bordure"],
  icone: ["couleur", "trait"],
  emoji: [],
  qr: ["contenu", "couleur", "fond", "correction"],
  cadre: ["forme", "ressource", "recadrage", "bordure", "fond"],
  maquette: ["appareil", "couleur", "ressource", "recadrage"],
};

/** Une ombre envoyée par l'IA : couleur, flou, décalage, opacité ; `null` l'enlève. */
function ombre(v: unknown) {
  if (v === null) return undefined;
  const o = v as Record<string, unknown>;
  exiger(o && typeof o === "object", "ombre : objet { couleur, flou, x, y, opacite } ou null");
  return {
    couleur: (couleur(o.couleur ?? "#000000", "ombre.couleur") as string) ?? "#000000",
    flou: Math.max(0, nombre(o.flou, 20)!),
    x: nombre(o.x, 0)!,
    y: nombre(o.y, 8)!,
    opacite: Math.max(0, Math.min(1, nombre(o.opacite, 0.35)!)),
  };
}

function nettoyerModification(el: ElementPage, brut: Arguments): Partial<ElementPage> {
  const permises = new Set([...COMMUNES, ...PAR_TYPE[el.type]]);
  const propre: Record<string, unknown> = {};
  for (const [cle, valeur] of Object.entries(brut)) {
    if (cle === "id") continue;
    exiger(permises.has(cle), `propriété inconnue pour un élément ${el.type} : ${cle}`);
    if (cle === "couleur" && el.type !== "texte") {
      propre[cle] = couleur(valeur, cle) as string;
      exiger(typeof propre[cle] === "string", `${cle} : couleur unie #rrggbb attendue`);
    } else if (cle === "couleur" || cle === "remplissage") propre[cle] = couleur(valeur, cle);
    else if (cle === "ombre") propre[cle] = ombre(valeur);
    else if (cle === "bordure") {
      const b = valeur as { couleur?: unknown; epaisseur?: unknown } | null;
      propre[cle] = b === null ? undefined : { couleur: couleur(b.couleur ?? "#ffffff", "bordure.couleur") as string, epaisseur: Math.max(0, nombre(b.epaisseur, 8)!) };
    } else if (cle === "ressource" && (el.type === "cadre" || el.type === "maquette")) {
      exiger(valeur === null || etat().ressources[String(valeur)], `image inconnue dans ce design : ${String(valeur)}`);
      propre[cle] = valeur === null ? undefined : valeur;
    }
    else if (cle === "contour" && el.type === "texte") {
      const c = valeur as { couleur?: unknown; epaisseur?: unknown } | null;
      propre[cle] = c === null ? undefined : { couleur: couleur(c.couleur ?? "#000000", "contour.couleur") as string, epaisseur: Math.max(0, nombre(c.epaisseur, 4)!) };
    } else if (cle === "surlignage") {
      const s = valeur as { couleur?: unknown; marge?: unknown; arrondi?: unknown } | null;
      propre[cle] = s === null ? undefined : { couleur: couleur(s.couleur ?? "#ffde59", "surlignage.couleur") as string, marge: Math.max(0, nombre(s.marge, 12)!), arrondi: Math.max(0, nombre(s.arrondi, 8)!) };
    } else if (cle === "contour" || cle === "fond") propre[cle] = valeur === null ? null : (couleur(valeur, cle) as string);
    else if (cle === "police") {
      exiger(polices().some((p) => p.famille === valeur), `police inconnue : ${String(valeur)} (voir etat)`);
      propre[cle] = valeur;
    } else if (["x", "y", "largeur", "hauteur", "rotation", "opacite", "taillePolice", "interligne", "espacement", "epaisseurContour", "arrondi", "cotes", "trait"].includes(cle)) {
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

/** Une planche numérotée des aperçus, pour que l'IA voie les photos avant d'en choisir une. */
async function plancheDePhotos(photos: PhotoPixabay[]): Promise<Blob> {
  const colonnes = 4;
  const [l, h, marge] = [240, 180, 6];
  const lignes = Math.ceil(photos.length / colonnes);
  const toile = document.createElement("canvas");
  toile.width = colonnes * l + (colonnes + 1) * marge;
  toile.height = lignes * h + (lignes + 1) * marge;
  const c = toile.getContext("2d")!;
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, toile.width, toile.height);
  await Promise.all(
    photos.map(async (p, i) => {
      const x = marge + (i % colonnes) * (l + marge);
      const y = marge + Math.floor(i / colonnes) * (h + marge);
      try {
        const image = await createImageBitmap(await (await fetch(await urlApercuPixabay(p.id))).blob());
        // L'aperçu remplit sa case (coupé au centre si ses proportions diffèrent).
        const echelle = Math.max(l / image.width, h / image.height);
        const [lw, lh] = [l / echelle, h / echelle];
        c.drawImage(image, (image.width - lw) / 2, (image.height - lh) / 2, lw, lh, x, y, l, h);
        image.close();
      } catch {
        c.fillStyle = "#e5e5e5";
        c.fillRect(x, y, l, h);
      }
      c.fillStyle = "rgba(0,0,0,0.75)";
      c.fillRect(x, y, 34, 26);
      c.fillStyle = "#ffffff";
      c.font = "bold 17px sans-serif";
      c.textBaseline = "middle";
      c.fillText(String(i + 1), x + 6, y + 14);
    }),
  );
  return new Promise((ok, ko) => toile.toBlob((b) => (b ? ok(b) : ko(new Error("planche impossible"))), "image/jpeg", 0.82));
}

/** Ce que l'IA voit du kit de marque. */
function resumerMarque(kit: KitMarque) {
  const images = useMarque.getState().images;
  return {
    nom: kit.nom,
    couleurs: kit.couleurs,
    polices: kit.polices,
    logos: kit.logos.map((id) => images[id]).filter(Boolean).map((r) => ({ id: r.id, nom: r.nom, largeur: r.largeur, hauteur: r.hauteur, transparence: r.transparence })),
  };
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
    return { donnees: { page: numero, largeur, format: s.document.format }, image: await base64(blob) };
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

  async ajouter_texte(args) {
    designOuvert();
    const contenu = texte(args.texte);
    exiger(contenu?.trim(), "texte vide");
    const format = etat().document.format;
    const police = texte(args.police);
    if (police) exiger(polices().some((p) => p.famille === police), `police inconnue : ${police} (voir etat)`);
    await assurerPolice(police ?? "Inter", booleen(args.gras) ?? false, booleen(args.italique) ?? false);
    if (police) await copierPoliceDansDesign(police);
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
    const genres = ["rectangle", "ellipse", "triangle", "etoile", "polygone", "coeur", "ligne", "fleche"];
    exiger(genres.includes(genre), `forme : ${genres.join(", ")}`);
    const base = creerForme(etat().document.format, genre, { arrondi: nombre(args.arrondi, 0) });
    const pointes = args.pointes as { debut?: unknown; fin?: unknown } | undefined;
    const el = placer(
      {
        ...base,
        ...(nombre(args.cotes) !== undefined ? { cotes: Math.max(3, Math.min(24, Math.round(nombre(args.cotes)!))) } : {}),
        ...(booleen(args.tirets) !== undefined ? { tirets: booleen(args.tirets) } : {}),
        ...(pointes && typeof pointes === "object" ? { pointes: { debut: pointes.debut === true, fin: pointes.fin !== false } } : {}),
        ...(args.remplissage !== undefined ? { remplissage: couleur(args.remplissage, "remplissage")! } : {}),
        ...(args.contour !== undefined ? { contour: couleur(args.contour, "contour") as string } : {}),
        ...(nombre(args.epaisseurContour) !== undefined ? { epaisseurContour: nombre(args.epaisseurContour)! } : {}),
      },
      args,
    );
    etat().ajouterElements([el]);
    return { donnees: el };
  },

  async chercher_bibliotheque(args) {
    const requete = texte(args.requete)?.trim();
    exiger(requete, "requete vide");
    const genre = args.genre === "icone" || args.genre === "emoji" ? args.genre : undefined;
    const resultats = (await rechercher(requete!, genre)).slice(0, Math.max(1, Math.min(100, nombre(args.nombre, 30)!)));
    const noms = await nomsEmojis().catch(() => ({}) as Record<string, string>);
    return {
      donnees: resultats.map(([collection, nom]) => ({
        collection,
        nom,
        genre: collection === "phosphor" || collection.startsWith("tabler") ? "icone" : "emoji",
        ...(noms[`${collection}/${nom}`] ? { nomFrancais: noms[`${collection}/${nom}`] } : {}),
      })),
    };
  },

  async ajouter_icone(args) {
    designOuvert();
    const id = texte(args.collection) === "phosphor" ? "phosphor-regular" : texte(args.collection);
    const nom = texte(args.nom);
    const c = id ? await collectionBibliotheque(id) : undefined;
    exiger(c && c.genre === "icone", `collection d'icônes inconnue : ${String(args.collection)} (voir chercher_bibliotheque)`);
    exiger(nom && (await traces(id!))[nom] !== undefined, `icône inconnue dans ${id} : ${String(args.nom)}`);
    const base = creerIcone(etat().document.format, id!, nom!, (couleur(args.couleur ?? "#1f1f1d", "couleur") as string) ?? "#1f1f1d");
    const el = placer(base, { ...args, hauteur: args.hauteur ?? args.largeur, largeur: args.largeur ?? args.hauteur });
    etat().ajouterElements([el]);
    return { donnees: el };
  },

  async ajouter_emoji(args) {
    designOuvert();
    const id = texte(args.collection);
    const nom = texte(args.nom);
    const c = id ? await collectionBibliotheque(id) : undefined;
    exiger(c && c.genre === "emoji", `collection d'emojis inconnue : ${String(args.collection)} (fluent ou openmoji)`);
    exiger(nom && (await traces(id!))[nom] !== undefined, `emoji inconnu dans ${id} : ${String(args.nom)} (voir chercher_bibliotheque)`);
    const el = placer(creerEmoji(etat().document.format, id!, nom!), { ...args, hauteur: args.hauteur ?? args.largeur, largeur: args.largeur ?? args.hauteur });
    etat().ajouterElements([el]);
    return { donnees: el };
  },

  ajouter_qr(args) {
    designOuvert();
    const contenu = texte(args.contenu);
    exiger(contenu?.trim(), "contenu vide");
    const base = creerQr(etat().document.format, contenu!, (couleur(args.couleur ?? "#1f1f1d", "couleur") as string) ?? "#1f1f1d");
    const fond = args.fond === null ? null : args.fond !== undefined ? (couleur(args.fond, "fond") as string) : base.fond;
    const el = placer({ ...base, fond }, { ...args, hauteur: args.largeur });
    etat().ajouterElements([el]);
    return { donnees: el };
  },

  ajouter_cadre(args) {
    designOuvert();
    const formes = ["rectangle", "arrondi", "cercle", "arche", "goutte", "hexagone", "etoile", "coeur"];
    const forme = texte(args.forme) as FormeCadre;
    exiger(formes.includes(forme), `forme : ${formes.join(", ")}`);
    const ressource = texte(args.ressource);
    if (ressource) exiger(etat().ressources[ressource], `image inconnue dans ce design : ${ressource} (voir etat ou importer_image)`);
    const el = placer(creerCadre(etat().document.format, forme, ressource), args);
    etat().ajouterElements([el]);
    return { donnees: el };
  },

  ajouter_grille(args) {
    designOuvert();
    const id = texte(args.disposition);
    exiger(DISPOSITIONS.some((d) => d.id === id), `disposition : ${DISPOSITIONS.map((d) => d.id).join(", ")}`);
    const cadres = creerGrille(etat().document.format, id!);
    etat().ajouterElements(cadres);
    return { donnees: cadres };
  },

  ajouter_maquette(args) {
    designOuvert();
    const appareil = texte(args.appareil) as Appareil;
    exiger(appareil in APPAREILS, "appareil : telephone, tablette, ordinateur ou montre");
    const ressource = texte(args.ressource);
    if (ressource) exiger(etat().ressources[ressource], `image inconnue dans ce design : ${ressource} (voir etat ou importer_image)`);
    const base = creerMaquette(etat().document.format, appareil, (couleur(args.couleur ?? "#1c1c1e", "couleur") as string) ?? "#1c1c1e", ressource);
    // Les proportions de l'appareil sont gardées : la hauteur suit la largeur, ou l'inverse.
    const proportion = APPAREILS[appareil].proportion;
    const largeur = nombre(args.largeur);
    const hauteur = nombre(args.hauteur);
    const dimensions = largeur ? { largeur, hauteur: largeur / proportion } : hauteur ? { largeur: hauteur * proportion, hauteur } : {};
    const el = placer(base, { ...args, ...dimensions });
    etat().ajouterElements([el]);
    return { donnees: el };
  },

  remplir_photo(args) {
    designOuvert();
    const el = elementsCourants(etat()).find((e) => e.id === texte(args.id));
    exiger(el && recoitPhoto(el), `cadre ou maquette introuvable sur la page affichée : ${String(args.id)}`);
    const ressource = texte(args.ressource);
    if (ressource) {
      exiger(etat().ressources[ressource], `image inconnue dans ce design : ${ressource} (voir etat ou importer_image)`);
      etat().remplirPhoto(el.id, ressource);
    }
    const apres = elementsCourants(etat()).find((e) => e.id === el.id);
    if (apres && recoitPhoto(apres) && (args.zoom !== undefined || args.x !== undefined || args.y !== undefined)) {
      const r = apres.recadrage;
      const borne = (v: number | undefined, defaut: number, min: number, max: number) => Math.max(min, Math.min(max, v ?? defaut));
      etat().modifierElements({ [el.id]: { recadrage: { zoom: borne(nombre(args.zoom), r.zoom, 1, 5), x: borne(nombre(args.x), r.x, 0, 1), y: borne(nombre(args.y), r.y, 0, 1) } } as Partial<ElementPage> });
    }
    return { donnees: elementsCourants(etat()).find((e) => e.id === el.id) };
  },

  lister_polices(args) {
    const genre = texte(args.genre);
    return { donnees: polices().filter((p) => !genre || p.genre === genre).map((p) => ({ famille: p.famille, genre: p.genre, usage: p.usage, gras: p.gras, italique: p.italique })) };
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

  async chercher_photos(args) {
    const requete = texte(args.requete)?.trim();
    exiger(requete, "requete : quelques mots, en français ou en anglais");
    const etatCle = await etatPixabay();
    exiger(etatCle, "les photos de Pixabay ne s'ouvrent que dans la fenêtre Eliot");
    exiger(etatCle.cle, `pas de clé Pixabay : Alexandre doit ajouter PIXABAY_API_KEY dans ${etatCle.fichier}`);
    const orientation = texte(args.orientation);
    if (orientation) exiger(orientation === "horizontal" || orientation === "vertical", "orientation : horizontal ou vertical");
    const page = Math.max(1, Math.min(12, Math.round(nombre(args.page, 1)!)));
    const resultat = await chercherPixabay(requete!, page, { orientation: orientation as "horizontal" | "vertical" | undefined, couleur: texte(args.couleur) });
    const nombrePhotos = Math.max(1, Math.min(20, Math.round(nombre(args.nombre, 12)!)));
    const photos = resultat.photos.slice(0, nombrePhotos);
    const donnees = {
      total: resultat.total,
      page,
      photos: photos.map((p, i) => ({ numero: i + 1, id: p.id, largeur: p.largeur, hauteur: p.hauteur, auteur: p.auteur, mots: p.mots })),
      conseil: "la planche montre les photos numérotées ; ajouter_photo_pixabay avec l'id choisi",
    };
    if (photos.length === 0) return { donnees };
    return { donnees, image: await base64(await plancheDePhotos(photos)) };
  },

  async ajouter_photo_pixabay(args) {
    designOuvert();
    const id = nombre(args.id);
    exiger(id !== undefined && Number.isInteger(id) && id > 0, "id : l'identifiant d'une photo trouvée par chercher_photos");
    const dans = texte(args.dans);
    const cible = dans ? elementsCourants(etat()).find((e) => e.id === dans) : undefined;
    if (dans) exiger(cible && recoitPhoto(cible), `cadre ou maquette introuvable sur la page affichée : ${dans}`);
    const ressource = await telechargerPhotoPixabay(id!);
    if (cible) {
      etat().remplirPhoto(cible.id, ressource.id);
      return { donnees: { element: elementsCourants(etat()).find((e) => e.id === cible.id), ressource } };
    }
    const base = creerImage(etat().document.format, ressource);
    const largeur = nombre(args.largeur);
    const hauteur = nombre(args.hauteur);
    const ratio = ressource.largeur / ressource.hauteur;
    const dimensions = largeur && hauteur ? { largeur, hauteur } : largeur ? { largeur, hauteur: largeur / ratio } : hauteur ? { largeur: hauteur * ratio, hauteur } : {};
    const el = placer(base, { ...args, ...dimensions });
    etat().ajouterElements([el]);
    return { donnees: { element: el, ressource } };
  },

  marque() {
    return { donnees: resumerMarque(useMarque.getState().kit) };
  },

  async modifier_marque(args) {
    const nom = texte(args.nom);
    const couleurs = args.couleurs === undefined ? undefined : Array.isArray(args.couleurs) ? args.couleurs : null;
    exiger(couleurs !== null, "couleurs : liste de { valeur: \"#rrggbb\", nom? }");
    couleurs?.forEach((c, i) => exiger(typeof (c as { valeur?: unknown })?.valeur === "string" && HEX.test((c as { valeur: string }).valeur), `couleurs[${i}] : { valeur: "#rrggbb", nom? }`));
    const polices = args.polices as Record<string, { famille?: unknown; gras?: unknown }> | undefined;
    for (const [role, p] of Object.entries(polices ?? {})) {
      exiger(ROLES_POLICE.some((r) => r.id === role), `polices : rôles titre, sousTitre, texte (pas ${role})`);
      exiger(p && typeof p.famille === "string", `polices.${role} : { famille, gras? } (voir lister_polices)`);
      exiger(famillesConnues().includes(p.famille as string), `police inconnue : ${String(p.famille)} (voir lister_polices)`);
    }
    useMarque.getState().modifier((k) => ({
      ...k,
      ...(nom?.trim() ? { nom: nom.trim() } : {}),
      ...(couleurs ? { couleurs: couleurs as KitMarque["couleurs"] } : {}),
      ...(polices ? { polices: { ...k.polices, ...(polices as KitMarque["polices"]) } } : {}),
    }));
    return { donnees: resumerMarque(useMarque.getState().kit) };
  },

  async ajouter_logo(args) {
    designOuvert();
    const id = texte(args.id);
    exiger(id && useMarque.getState().kit.logos.includes(id), `logo inconnu du kit : ${String(args.id)} (voir marque)`);
    const ressource = await logoDansDesign(id!);
    const base = creerImage(etat().document.format, ressource);
    const largeur = nombre(args.largeur);
    const dimensions = largeur ? { largeur, hauteur: (largeur * ressource.hauteur) / ressource.largeur } : {};
    const el = placer(base, { ...args, ...dimensions });
    etat().ajouterElements([el]);
    return { donnees: el };
  },

  async modifier(args) {
    designOuvert();
    exiger(Array.isArray(args.modifications) && args.modifications.length, "modifications : liste d'objets { id, … }");
    const parId = new Map(elementsCourants(etat()).map((e) => [e.id, e]));
    const modifs: Record<string, Partial<ElementPage>> = {};
    for (const m of args.modifications as Arguments[]) {
      const el = parId.get(String(m.id));
      exiger(el, `élément introuvable sur la page affichée : ${String(m.id)}`);
      modifs[el.id] = nettoyerModification(el, m);
    }
    // Une nouvelle police se charge avant que le texte ne soit remesuré.
    for (const [id, m] of Object.entries(modifs)) {
      const el = { ...parId.get(id), ...m } as ElementPage;
      if (el.type === "texte") await assurerPolice(el.police, el.gras, el.italique);
      if (el.type === "texte" && "police" in m) await copierPoliceDansDesign(el.police);
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
