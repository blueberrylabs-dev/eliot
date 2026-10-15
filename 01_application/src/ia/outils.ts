// Les outils offerts à une IA (pont MCP, BRIEF § 6) : chacun passe par les actions du store,
// donc par l'historique (Ctrl+Z défait ce que l'IA a fait), et l'utilisateur voit le travail
// se faire dans la fenêtre. Aucun outil ne supprime un design, n'efface une image importée ni
// n'écrit hors des dossiers d'Eliot.

import { elementsCourants, pageCourante, useEditeur } from "../etat/editeur";
import { enregistrerMaintenant } from "../etat/enregistrement";
import { copierPoliceDansDesign, nouveauDesign, ouvrirDesign, renommerDesign, utiliserModele } from "../etat/projets";
import { exporter } from "../export/exporter";
import { rendrePage } from "../export/rendu";
import { collection as collectionBibliotheque, nomsEmojis, rechercher, traces, urlSvg } from "../bibliotheque/bibliotheque";
import { catalogueConnu, cataloguePersonnages, svgDeSource } from "../bibliotheque/personnages";
import { piecesAuHasard, piecesValides, posture as postureDe, trouverDessin, vueComposee, type CollectionPersonnages } from "../modele/personnages";
import { APPAREILS, DISPOSITIONS } from "../modele/cadres";
import { creerCadre, creerEmoji, creerPersonnage, creerForme, creerGraphique, creerGrille, creerIcone, creerImage, creerMaquette, creerQr, creerTableau, creerTexte, creerVideo, mesurerHauteurTexte, nouvelId } from "../modele/fabriques";
import type { SensAlignement } from "../modele/geometrie";
import { FORMATS_PAGE, recoitPhoto, type Appareil, type Couleur, type Degrade, type ElementGraphique, type ElementPage, type ElementPersonnage, type ElementTableau, type ElementVideo, type FormeCadre, type GenreForme, type GenreGraphique, type OutilDessin, type Ressource } from "../modele/types";
import { logoDansDesign, useMarque } from "../etat/marque";
import { appliquerModele, modeleParId, nouveauDesignDepuisModele, vignetteModele } from "../etat/modeles";
import { MODELES_DEPART } from "../modeles/depart";
import { normaliser } from "../bibliotheque/recherche";
import { telechargerPhotoPixabay, telechargerVideoPixabay } from "../etat/photos";
import { ROLES_POLICE, type KitMarque } from "../modele/marque";
import { creerTrait, OUTILS_DESSIN } from "../modele/dessin";
import { GENRES_GRAPHIQUE, PALETTE_GRAPHIQUE, seriesValides } from "../modele/graphiques";
import { mesurePolice } from "../modele/mesure";
import { cellulesValides, disposerTableau } from "../modele/tableaux";
import { chercherPixabay, chercherVideosPixabay, estCheminVideo, etatPixabay, importerChemins, listerProjets, urlApercuPixabay, urlApercuVideoPixabay, type PhotoPixabay, type VideoPixabay } from "../pont/tauri";
import { avecSuivi, suiviFichiers } from "../editeur/SuiviImport";
import { VITESSES } from "../editeur/ReglagesVideo";
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
  video: ["retourneH", "retourneV", "arrondi", "bordure", "coupe", "vitesse", "volume"],
  icone: ["couleur", "trait"],
  emoji: [],
  personnage: ["posture", "pieces", "couleurs", "retourneH"],
  qr: ["contenu", "couleur", "fond", "correction"],
  cadre: ["forme", "ressource", "recadrage", "bordure", "fond"],
  maquette: ["appareil", "couleur", "ressource", "recadrage"],
  dessin: ["couleur", "epaisseur", "outil"],
  graphique: ["genre", "etiquettes", "series", "couleursParts", "police", "taillePolice", "couleurTexte", "legende", "valeurs", "grille", "unite", "maximum"],
  tableau: ["cellules", "colonnes", "entete", "police", "taillePolice", "couleurTexte", "fond", "fondEntete", "texteEntete", "rayures", "bordure", "alignement", "marge"],
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

/** Une collection de personnages connue, catalogue chargé (`await cataloguePersonnages()`). */
function collectionPersonnages(id: unknown): CollectionPersonnages {
  const catalogue = catalogueConnu();
  exiger(catalogue?.collections.length, "personnages absents : la bibliothèque n'a pas les archives Open Peeps et Humaaans (npm run bibliotheque)");
  const c = catalogue!.collections.find((x) => x.id === id);
  exiger(c, `collection : ${catalogue!.collections.map((x) => x.id).join(" ou ")}`);
  return c!;
}

/** Les pièces demandées par l'IA, vérifiées une à une pour la posture (`""` : rien, pour un
 *  emplacement facultatif), ajoutées à `base`. */
function piecesDemandees(c: CollectionPersonnages, idPosture: string, demandees: unknown, base: Record<string, string> = {}): Record<string, string> {
  const p = postureDe(c.composition, idPosture);
  exiger(p.id === idPosture, `posture : ${c.composition.postures.map((x) => x.id).join(", ")}`);
  if (demandees === undefined) return { ...base };
  exiger(demandees && typeof demandees === "object" && !Array.isArray(demandees), "pieces : objet { emplacement: pièce }");
  const sortie = { ...base };
  for (const [emplacement, valeur] of Object.entries(demandees as Record<string, unknown>)) {
    const place = p.emplacements.find((x) => x.id === emplacement);
    exiger(place, `emplacement inconnu en posture ${p.id} : ${emplacement} (${p.emplacements.map((x) => x.id).join(", ")})`);
    const options = c.composition.groupes[place!.groupe] ?? [];
    if (valeur === "" || valeur === null) {
      exiger(place!.facultatif, `${emplacement} : une pièce est obligatoire`);
      sortie[emplacement] = "";
      continue;
    }
    exiger(options.some((o) => o.id === valeur), `pièce inconnue pour ${emplacement} en posture ${p.id} : ${String(valeur)} (voir lister_personnages avec emplacement)`);
    sortie[emplacement] = valeur as string;
  }
  return sortie;
}

/** Les couleurs demandées : partie ou couleur d'origine → `#rrggbb`, `null` pour revenir à
 *  l'origine ; ajoutées à `base`. `null` à la place de l'objet : toutes d'origine. */
function couleursDemandees(valeur: unknown, base: Record<string, string> = {}): Record<string, string> | undefined {
  if (valeur === null) return undefined;
  exiger(valeur && typeof valeur === "object" && !Array.isArray(valeur), "couleurs : objet { partie ou #couleur d'origine: \"#rrggbb\" }");
  const sortie = { ...base };
  for (const [cle, v] of Object.entries(valeur as Record<string, unknown>)) {
    const k = cle.startsWith("#") ? cle.toUpperCase() : cle;
    exiger(!cle.startsWith("#") || HEX.test(cle), `couleurs : clé ${cle} : une partie (trait, tete, corps, barbe, accessoire) ou une couleur #rrggbb du dessin`);
    if (v === null) {
      delete sortie[k];
      continue;
    }
    exiger(typeof v === "string" && HEX.test(v), `couleurs.${cle} : couleur #rrggbb attendue`);
    sortie[k] = (v as string).toLowerCase();
  }
  return Object.keys(sortie).length ? sortie : undefined;
}

/** Coupe, vitesse et volume d'une vidéo envoyés par l'IA, vérifiés contre la durée du fichier.
 *  `null` remet la valeur par défaut (tout le fichier, vitesse 1, volume 1). */
function reglagesVideo(ressource: Ressource | undefined, brut: Arguments): Partial<ElementVideo> {
  const sortie: Partial<ElementVideo> = {};
  const duree = ressource?.video?.duree ?? 0;
  if ("coupe" in brut) {
    const c = brut.coupe as { debut?: unknown; fin?: unknown } | null;
    if (c === null) sortie.coupe = undefined;
    else {
      exiger(c && typeof c === "object", "coupe : { debut, fin } en millisecondes du fichier, ou null");
      const debut = Math.round(nombre(c.debut, 0)!);
      const fin = c.fin === undefined || c.fin === null ? undefined : Math.round(nombre(c.fin)!);
      exiger(debut >= 0 && debut < duree, `coupe.debut : de 0 à ${duree - 1} ms (durée du fichier : ${duree} ms)`);
      if (fin !== undefined) exiger(fin > debut && fin <= duree, `coupe.fin : après debut, ${duree} ms au plus`);
      sortie.coupe = debut === 0 && (fin === undefined || fin >= duree) ? undefined : { debut, ...(fin !== undefined && fin < duree ? { fin } : {}) };
    }
  }
  if ("vitesse" in brut) {
    const v = brut.vitesse === null ? 1 : nombre(brut.vitesse);
    exiger(v !== undefined && VITESSES.includes(v), `vitesse : ${VITESSES.join(", ")}`);
    sortie.vitesse = v === 1 ? undefined : v;
  }
  if ("volume" in brut) {
    const v = brut.volume === null ? 1 : nombre(brut.volume);
    exiger(v !== undefined && v >= 0 && v <= 1, "volume : de 0 (muet) à 1");
    sortie.volume = v === 1 ? undefined : v;
  }
  return sortie;
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
      // Un tableau garde toujours sa bordure : « aucune », c'est une épaisseur nulle.
      if (b === null) propre[cle] = el.type === "tableau" ? { ...el.bordure, epaisseur: 0 } : undefined;
      else propre[cle] = { couleur: couleur(b.couleur ?? (el.type === "tableau" ? el.bordure.couleur : "#ffffff"), "bordure.couleur") as string, epaisseur: Math.max(0, nombre(b.epaisseur, el.type === "tableau" ? el.bordure.epaisseur : 8)!) };
    } else if (el.type === "personnage" && (cle === "posture" || cle === "pieces")) {
      exiger(!el.dessin, "personnage tout fait : posture et pieces ne se changent que sur un personnage composé");
      const c = collectionPersonnages(el.collection);
      const idPosture = brut.posture !== undefined ? String(brut.posture) : piecesValides(c.composition, el.posture, el.pieces).posture;
      propre.posture = idPosture;
      propre.pieces = piecesDemandees(c, idPosture, brut.pieces, el.pieces);
    } else if (el.type === "personnage" && cle === "couleurs") propre[cle] = couleursDemandees(valeur, valeur === null ? {} : el.couleurs);
    else if (cle === "retourneH" || cle === "retourneV") {
      exiger(typeof valeur === "boolean", `${cle} : vrai ou faux`);
      propre[cle] = valeur;
    } else if (el.type === "video" && (cle === "coupe" || cle === "vitesse" || cle === "volume")) {
      Object.assign(propre, reglagesVideo(etat().ressources[el.ressource], { [cle]: valeur }));
    } else if (cle === "ressource" && (el.type === "cadre" || el.type === "maquette")) {
      exiger(valeur === null || etat().ressources[String(valeur)], `image inconnue dans ce design : ${String(valeur)}`);
      exiger(valeur === null || !etat().ressources[String(valeur)].video, "une vidéo ne va pas dans un cadre ni un écran : la poser avec ajouter_video");
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
    } else if (cle === "fond" && el.type === "tableau") {
      exiger(valeur !== null, "fond : couleur #rrggbb attendue");
      propre[cle] = couleur(valeur, cle) as string;
    } else if (["couleurTexte", "fondEntete", "texteEntete"].includes(cle)) {
      propre[cle] = couleur(valeur, cle);
      exiger(typeof propre[cle] === "string", `${cle} : couleur unie #rrggbb attendue`);
    } else if (cle === "rayures") propre[cle] = valeur === null ? undefined : (couleur(valeur, cle) as string);
    else if (cle === "etiquettes") {
      exiger(Array.isArray(valeur) && valeur.length > 0, "etiquettes : liste de textes");
      const etiquettes = (valeur as unknown[]).slice(0, 60).map((v) => String(v ?? "").slice(0, 60));
      propre[cle] = etiquettes;
      // Les séries suivent le nombre d'étiquettes quand elles ne sont pas données avec.
      if (el.type === "graphique" && !("series" in brut)) propre.series = el.series.map((x) => ({ ...x, valeurs: etiquettes.map((_, i) => x.valeurs[i] ?? null) }));
    } else if (cle === "series") {
      const etiquettes = (propre.etiquettes as string[] | undefined) ?? (el as ElementGraphique).etiquettes;
      exiger(Array.isArray(valeur) && valeur.length > 0, "series : liste de { nom, valeurs, couleur? }");
      propre[cle] = seriesValides(etiquettes, valeur);
    } else if (cle === "couleursParts") {
      exiger(Array.isArray(valeur) && valeur.every((c) => typeof c === "string" && HEX.test(c)), "couleursParts : liste de couleurs #rrggbb");
      propre[cle] = (valeur as string[]).map((c) => c.toLowerCase());
    } else if (cle === "genre") {
      exiger(GENRES_GRAPHIQUE.some((g) => g.id === valeur), `genre : ${GENRES_GRAPHIQUE.map((g) => g.id).join(", ")}`);
      propre[cle] = valeur;
    } else if (cle === "outil") {
      exiger(typeof valeur === "string" && valeur in OUTILS_DESSIN, "outil : stylo, marqueur ou surligneur");
      propre[cle] = valeur;
    } else if (cle === "cellules") {
      const cellules = cellulesValides(valeur);
      propre[cle] = cellules;
      // Une largeur de tableau qui change : les colonnes suivent.
      if (el.type === "tableau" && cellules[0].length !== el.colonnes.length && !("colonnes" in brut)) propre.colonnes = cellules[0].map((_, i) => el.colonnes[i] ?? 1);
    } else if (cle === "colonnes") {
      exiger(Array.isArray(valeur) && valeur.every((v) => typeof v === "number" && v > 0), "colonnes : largeurs relatives, nombres positifs");
      propre[cle] = valeur;
    } else if (["legende", "valeurs", "grille", "entete"].includes(cle)) {
      exiger(typeof valeur === "boolean", `${cle} : vrai ou faux`);
      propre[cle] = valeur;
    } else if (cle === "alignement") {
      exiger(["left", "center", "right"].includes(String(valeur)), "alignement : left, center ou right");
      propre[cle] = valeur;
    } else if (["x", "y", "largeur", "hauteur", "rotation", "opacite", "taillePolice", "interligne", "espacement", "epaisseurContour", "arrondi", "cotes", "trait", "epaisseur", "marge", "maximum"].includes(cle)) {
      exiger(typeof valeur === "number" && Number.isFinite(valeur), `${cle} : nombre attendu`);
      propre[cle] = valeur;
    } else propre[cle] = valeur;
  }
  if (typeof propre.largeur === "number") propre.largeur = Math.max(1, propre.largeur);
  if (typeof propre.hauteur === "number") propre.hauteur = Math.max(1, propre.hauteur);
  if (typeof propre.opacite === "number") propre.opacite = Math.max(0, Math.min(1, propre.opacite));
  if (el.type === "tableau") {
    const nbCol = ((propre.cellules as string[][] | undefined) ?? el.cellules)[0].length;
    const colonnes = (propre.colonnes as number[] | undefined) ?? el.colonnes;
    exiger(colonnes.length === nbCol, `colonnes : ${nbCol} largeurs attendues, une par colonne`);
  }
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

/** Une image prête à dessiner : un SVG (personnage, icône) passe par une balise image, le
 *  reste (photos, vignettes) par `createImageBitmap`, qui ne lit pas le SVG. */
async function decoderImage(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (!blob.type.includes("svg")) return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Une planche d'images numérotées, quatre par rangée, pour que l'IA voie avant de choisir.
 *  `couvrir` : l'image remplit sa case (coupée au centre) ; sinon elle y tient entière. */
async function planche(adresses: (() => Promise<string>)[], l: number, h: number, couvrir: boolean): Promise<Blob> {
  const colonnes = 4;
  const marge = 6;
  const lignes = Math.ceil(adresses.length / colonnes);
  const toile = document.createElement("canvas");
  toile.width = colonnes * l + (colonnes + 1) * marge;
  toile.height = lignes * h + (lignes + 1) * marge;
  const c = toile.getContext("2d")!;
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, toile.width, toile.height);
  await Promise.all(
    adresses.map(async (adresse, i) => {
      const x = marge + (i % colonnes) * (l + marge);
      const y = marge + Math.floor(i / colonnes) * (h + marge);
      c.fillStyle = "#e5e5e5";
      c.fillRect(x, y, l, h);
      try {
        const image = await decoderImage(await (await fetch(await adresse())).blob());
        if (couvrir) {
          const echelle = Math.max(l / image.width, h / image.height);
          const [lw, lh] = [l / echelle, h / echelle];
          c.drawImage(image, (image.width - lw) / 2, (image.height - lh) / 2, lw, lh, x, y, l, h);
        } else {
          const echelle = Math.min(l / image.width, h / image.height);
          const [lw, lh] = [image.width * echelle, image.height * echelle];
          c.drawImage(image, x + (l - lw) / 2, y + (h - lh) / 2, lw, lh);
        }
        if ("close" in image) image.close();
      } catch {
        // Case laissée grise : l'image n'a pas pu venir.
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

const plancheDePhotos = (photos: PhotoPixabay[]) => planche(photos.map((p) => () => urlApercuPixabay(p.id)), 240, 180, true);
const plancheDeVideos = (videos: VideoPixabay[]) => planche(videos.map((v) => () => urlApercuVideoPixabay(v.id)), 240, 135, true);

/** Une vidéo posée par l'IA : boîte, puis coupe, vitesse et volume. */
function poserVideo(ressource: Ressource, args: Arguments): ElementVideo {
  const base = creerVideo(etat().document.format, ressource);
  const largeur = nombre(args.largeur);
  const hauteur = nombre(args.hauteur);
  const ratio = ressource.largeur / ressource.hauteur;
  const dimensions = largeur && hauteur ? { largeur, hauteur } : largeur ? { largeur, hauteur: largeur / ratio } : hauteur ? { largeur: hauteur * ratio, hauteur } : {};
  const el = { ...placer(base, { ...args, ...dimensions }), ...reglagesVideo(ressource, args) };
  for (const cle of ["coupe", "vitesse", "volume"] as const) if (el[cle] === undefined) delete el[cle];
  etat().ajouterElements([el]);
  return el;
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

  async lister_personnages(args) {
    const catalogue = await cataloguePersonnages();
    exiger(catalogue, "personnages absents : la bibliothèque n'a pas les archives Open Peeps et Humaaans (npm run bibliotheque)");
    if (args.collection === undefined) {
      return {
        donnees: {
          collections: catalogue!.collections.map((c) => ({
            id: c.id,
            libelle: c.libelle,
            style: c.style,
            licence: "CC0 (domaine public), crédit facultatif",
            toutFaits: c.categories.map((k) => ({ categorie: k.id, libelle: k.libelle, nombre: k.elements.length })),
            composeur: {
              postures: c.composition.postures.map((p) => ({ id: p.id, emplacements: p.emplacements.map((e) => (e.facultatif ? `${e.id} (facultatif)` : e.id)) })),
              emplacements: c.composition.emplacements,
              couleursParPartie: c.composition.couleurs.map((x) => x.id),
              defaut: c.composition.defaut,
            },
          })),
          conseil: "personnages tout faits : collection + categorie pour la liste et une planche ; composeur : collection + emplacement (et posture) pour les pièces et leur planche, ou pieces à vrai pour tout lister ; puis ajouter_personnage",
        },
      };
    }
    const c = collectionPersonnages(args.collection);
    const debut = Math.max(0, Math.round(nombre(args.debut, 0)!));
    if (args.pieces === true) {
      return { donnees: { collection: c.id, postures: c.composition.postures.map((p) => ({ id: p.id, emplacements: p.emplacements.map((e) => ({ id: e.id, facultatif: !!e.facultatif, pieces: (c.composition.groupes[e.groupe] ?? []).map((o) => ({ id: o.id, libelle: o.libelle })) })) })) } };
    }
    if (args.emplacement !== undefined) {
      const p = postureDe(c.composition, texte(args.posture) ?? c.composition.defaut.posture);
      const place = p.emplacements.find((e) => e.id === args.emplacement);
      exiger(place, `emplacement en posture ${p.id} : ${p.emplacements.map((e) => e.id).join(", ")}`);
      const base = piecesValides(c.composition, p.id, c.composition.defaut.pieces);
      const options = (c.composition.groupes[place!.groupe] ?? []).slice(debut, debut + 24);
      const tete = c.id === "open-peeps" && ["tete", "visage", "barbe", "accessoire"].includes(place!.id) ? ["tete", "visage", "barbe", "accessoire"] : place!.id === "tete" ? ["tete"] : undefined;
      const donnees = { posture: p.id, emplacement: place!.id, facultatif: !!place!.facultatif, total: c.composition.groupes[place!.groupe]?.length ?? 0, pieces: options.map((o, i) => ({ numero: i + 1, id: o.id, libelle: o.libelle })), conseil: "la planche montre les pièces numérotées, sur le personnage par défaut ; debut pour la suite" };
      if (!options.length) return { donnees };
      return { donnees, image: await base64(await planche(options.map((o) => async () => urlSvg((await svgDeSource({ collection: c.id, posture: p.id, pieces: { ...base.pieces, [place!.id]: o.id } }, 240, tete))!)), 200, 200, false)) };
    }
    const categorie = c.categories.find((k) => k.id === args.categorie);
    exiger(categorie, `categorie : ${c.categories.map((k) => k.id).join(", ")}`);
    const liste = categorie!.elements.slice(debut, debut + 24);
    const donnees = { categorie: categorie!.id, total: categorie!.elements.length, personnages: liste.map((e, i) => ({ numero: i + 1, dessin: e.nom })), conseil: "la planche montre les personnages numérotés ; debut pour la suite ; ajouter_personnage avec collection et dessin" };
    if (!liste.length) return { donnees };
    return { donnees, image: await base64(await planche(liste.map((e) => async () => urlSvg((await svgDeSource({ collection: c.id, dessin: e.nom }, 240))!)), 160, 220, false)) };
  },

  async ajouter_personnage(args) {
    designOuvert();
    await cataloguePersonnages();
    const c = collectionPersonnages(args.collection);
    const format = etat().document.format;
    let source: Pick<ElementPersonnage, "collection" | "dessin" | "posture" | "pieces" | "couleurs">;
    let vue;
    if (args.dessin !== undefined) {
      const trouve = trouverDessin(c, String(args.dessin));
      exiger(trouve, `dessin inconnu dans ${c.id} : ${String(args.dessin)} (voir lister_personnages avec categorie)`);
      source = { collection: c.id, dessin: String(args.dessin) };
      vue = trouve!.vue;
    } else {
      const idPosture = texte(args.posture) ?? c.composition.defaut.posture;
      const demandees = piecesDemandees(c, idPosture, args.pieces);
      // Au hasard : ce que l'IA n'a pas choisi est tiré, le reste est gardé.
      const depart = args.hasard === true ? { ...piecesAuHasard(c.composition, idPosture).pieces, ...demandees } : demandees;
      const v = piecesValides(c.composition, idPosture, depart);
      source = { collection: c.id, posture: v.posture, pieces: v.pieces };
      vue = vueComposee(c.composition, v.posture, v.pieces);
    }
    if (args.couleurs !== undefined) source.couleurs = couleursDemandees(args.couleurs);
    const base = creerPersonnage(format, source, vue);
    // Une seule dimension donnée : l'autre suit les proportions du dessin.
    const ratio = vue[2] / vue[3];
    const largeur = nombre(args.largeur) ?? (nombre(args.hauteur) !== undefined ? Math.round(nombre(args.hauteur)! * ratio) : undefined);
    const hauteur = nombre(args.hauteur) ?? (largeur !== undefined ? Math.round(largeur / ratio) : undefined);
    const el = placer({ ...base, ...(booleen(args.retourneH) ? { retourneH: true } : {}) }, { ...args, largeur, hauteur });
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
    if (ressource) exiger(etat().ressources[ressource] && !etat().ressources[ressource].video, `image inconnue dans ce design : ${ressource} (voir etat ou importer_image ; une vidéo se pose avec ajouter_video)`);
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
    if (ressource) exiger(etat().ressources[ressource] && !etat().ressources[ressource].video, `image inconnue dans ce design : ${ressource} (voir etat ou importer_image ; une vidéo se pose avec ajouter_video)`);
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
      exiger(etat().ressources[ressource] && !etat().ressources[ressource].video, `image inconnue dans ce design : ${ressource} (voir etat ou importer_image ; une vidéo se pose avec ajouter_video)`);
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

  async importer_video(args) {
    designOuvert();
    const chemin = texte(args.chemin);
    exiger(chemin?.startsWith("/"), "chemin absolu attendu");
    exiger(estCheminVideo(chemin!), "fichier vidéo attendu : .mp4, .mov, .m4v, .webm, .mkv, .avi, .mpg ou .mpeg (une image passe par importer_image)");
    const projet = etat().projet!;
    const bilan = await avecSuivi(() => importerChemins(projet, [chemin!], suiviFichiers));
    exiger(bilan.ressources.length, bilan.erreurs.join(" ; ") || "import impossible");
    etat().ajouterRessources(bilan.ressources);
    return { donnees: bilan.ressources[0] };
  },

  ajouter_video(args) {
    designOuvert();
    const r = etat().ressources[String(args.ressource)];
    exiger(r?.video, `vidéo inconnue dans ce design : ${String(args.ressource)} (voir etat ou importer_video)`);
    return { donnees: poserVideo(r!, args) };
  },

  async chercher_videos(args) {
    const requete = texte(args.requete)?.trim();
    exiger(requete, "requete : quelques mots, en français ou en anglais");
    const etatCle = await etatPixabay();
    exiger(etatCle, "les vidéos de Pixabay ne s'ouvrent que dans la fenêtre Eliot");
    exiger(etatCle.cle, `pas de clé Pixabay : Alexandre doit ajouter PIXABAY_API_KEY dans ${etatCle.fichier}`);
    const orientation = texte(args.orientation);
    if (orientation) exiger(orientation === "horizontal" || orientation === "vertical", "orientation : horizontal ou vertical");
    const page = Math.max(1, Math.min(12, Math.round(nombre(args.page, 1)!)));
    const resultat = await chercherVideosPixabay(requete!, page);
    // Pixabay ne filtre pas les vidéos par orientation : le tri se fait ici.
    const triees = resultat.videos.filter((v) => !orientation || (orientation === "vertical" ? v.hauteur > v.largeur : v.largeur >= v.hauteur));
    const nombreVideos = Math.max(1, Math.min(20, Math.round(nombre(args.nombre, 12)!)));
    const videos = triees.slice(0, nombreVideos);
    const donnees = {
      total: resultat.total,
      page,
      videos: videos.map((v, i) => ({ numero: i + 1, id: v.id, largeur: v.largeur, hauteur: v.hauteur, duree_s: v.duree, auteur: v.auteur, mots: v.mots })),
      conseil: "la planche montre une image de chaque vidéo, numérotée ; ajouter_video_pixabay avec l'id choisi",
    };
    if (videos.length === 0) return { donnees };
    return { donnees, image: await base64(await plancheDeVideos(videos)) };
  },

  async ajouter_video_pixabay(args) {
    designOuvert();
    const id = nombre(args.id);
    exiger(id !== undefined && Number.isInteger(id) && id > 0, "id : l'identifiant d'une vidéo trouvée par chercher_videos");
    const ressource = await telechargerVideoPixabay(id!);
    return { donnees: { element: poserVideo(ressource, args), ressource } };
  },

  ajouter_image(args) {
    designOuvert();
    const r = etat().ressources[String(args.ressource)];
    exiger(r, `image inconnue dans ce design : ${String(args.ressource)} (voir etat ou importer_image)`);
    if (r.video) return OUTILS.ajouter_video(args);
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

  dessiner(args) {
    designOuvert();
    exiger(Array.isArray(args.traits) && args.traits.length > 0, "traits : liste de { points: [x1, y1, x2, y2…], couleur?, epaisseur?, outil? }");
    const elements = (args.traits as Arguments[]).slice(0, 200).map((t, i) => {
      const points = Array.isArray(t.points) ? (t.points as unknown[]).filter((v): v is number => typeof v === "number" && Number.isFinite(v)) : [];
      exiger(points.length >= 2 && points.length % 2 === 0, `traits[${i}].points : des nombres par paires x, y (pixels de la page)`);
      const outil = (texte(t.outil) ?? "stylo") as OutilDessin;
      exiger(outil in OUTILS_DESSIN, `traits[${i}].outil : stylo, marqueur ou surligneur`);
      const c = (couleur(t.couleur ?? "#1f1f1d", `traits[${i}].couleur`) as string) ?? "#1f1f1d";
      exiger(typeof c === "string", `traits[${i}].couleur : couleur unie #rrggbb`);
      const epaisseur = Math.max(1, Math.min(200, nombre(t.epaisseur, OUTILS_DESSIN[outil].epaisseur)!));
      return creerTrait(points, outil, c, epaisseur, nouvelId());
    });
    // Plusieurs traits forment un dessin : ils restent groupés.
    const groupe = elements.length > 1 ? nouvelId("g") : undefined;
    const poses = elements.map((e) => (groupe ? { ...e, groupe } : e));
    etat().ajouterElements(poses);
    return { donnees: poses.map((e) => ({ id: e.id, x: e.x, y: e.y, largeur: e.largeur, hauteur: e.hauteur })) };
  },

  async ajouter_graphique(args) {
    designOuvert();
    const genre = texte(args.genre) as GenreGraphique;
    exiger(GENRES_GRAPHIQUE.some((g) => g.id === genre), `genre : ${GENRES_GRAPHIQUE.map((g) => g.id).join(", ")}`);
    const couleursMarque = useMarque.getState().kit.couleurs.map((c) => c.valeur).filter((c) => c !== "#ffffff");
    const base = creerGraphique(etat().document.format, genre, [...couleursMarque, ...PALETTE_GRAPHIQUE]);
    const brut: Arguments = {};
    for (const cle of ["etiquettes", "series", "couleursParts", "police", "taillePolice", "couleurTexte", "legende", "valeurs", "grille", "unite", "maximum"]) if (args[cle] !== undefined) brut[cle] = args[cle];
    // Des séries sans étiquettes : des étiquettes numérotées, une par valeur.
    if (brut.series && !brut.etiquettes) {
      const n = Math.max(...(brut.series as { valeurs?: unknown[] }[]).map((s) => (Array.isArray(s?.valeurs) ? s.valeurs.length : 0)), 1);
      brut.etiquettes = Array.from({ length: n }, (_, i) => String(i + 1));
    }
    if (brut.etiquettes && !brut.series) brut.series = base.series;
    const propre = nettoyerModification(base, brut) as Partial<ElementGraphique>;
    if (propre.police) {
      await assurerPolice(propre.police, true, false);
      await copierPoliceDansDesign(propre.police);
    }
    const el = placer({ ...base, ...propre }, args);
    etat().ajouterElements([el]);
    return { donnees: el };
  },

  async ajouter_tableau(args) {
    designOuvert();
    exiger(Array.isArray(args.cellules) && args.cellules.length > 0, "cellules : liste de rangées, chacune une liste de textes");
    const cellules = cellulesValides(args.cellules);
    const options: Arguments = {};
    for (const cle of ["entete", "police", "taillePolice", "couleurTexte", "fond", "fondEntete", "texteEntete", "rayures", "bordure", "alignement", "marge", "colonnes"]) if (args[cle] !== undefined) options[cle] = args[cle];
    const base = creerTableau(etat().document.format, cellules);
    const propre = nettoyerModification(base, options) as Partial<ElementTableau>;
    if (propre.police) {
      await assurerPolice(propre.police, true, false);
      await copierPoliceDansDesign(propre.police);
    }
    const place = placer({ ...base, ...propre }, { ...args, hauteur: undefined });
    // La hauteur suit le contenu, à la largeur choisie.
    const el = { ...place, hauteur: Math.round(disposerTableau({ ...place, hauteur: 0 }, mesurePolice(place.police)).hauteurNaturelle) };
    if (nombre(args.y) === undefined) el.y = Math.round((etat().document.format.hauteur - el.hauteur) / 2);
    etat().ajouterElements([el]);
    return { donnees: el };
  },

  async lister_modeles_depart(args) {
    const format = texte(args.format);
    if (format) exiger(FORMATS_PAGE.some((f) => f.id === format), `format : ${FORMATS_PAGE.map((f) => f.id).join(", ")}`);
    const q = normaliser(texte(args.requete) ?? "");
    const liste = MODELES_DEPART.filter((m) => (!format || m.format === format) && (!q || q.split(" ").every((mot) => normaliser(`${m.nom} ${m.mots}`).includes(mot))));
    const donnees = {
      modeles: liste.map((m, i) => ({ numero: i + 1, id: m.id, nom: m.nom, format: m.format, mots: m.mots })),
      conseil: "utiliser_modele_depart avec l'id choisi ; la planche montre les modèles numérotés (12 au plus)",
    };
    if (liste.length === 0) return { donnees };
    return { donnees, image: await base64(await planche(liste.slice(0, 12).map((m) => () => vignetteModele(m)), 240, 240, false)) };
  },

  async utiliser_modele_depart(args) {
    const m = modeleParId(String(args.id));
    exiger(m, `modèle inconnu : ${String(args.id)} (voir lister_modeles_depart)`);
    if (args.nouveau_design === true || !(etat().projet && etat().vue === "editeur")) {
      exiger(await nouveauDesignDepuisModele(m!), "création impossible");
      return { donnees: { cree: "nouveau design", ...resumer() } };
    }
    const ou = await appliquerModele(m!);
    return { donnees: { pose: ou === "page" ? "sur la page affichée, qui était vide" : "sur une nouvelle page, après la page affichée", ...resumer() } };
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
    // Les pièces d'un personnage se vérifient dans le catalogue.
    if ([...parId.values()].some((e) => e.type === "personnage")) await cataloguePersonnages();
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
