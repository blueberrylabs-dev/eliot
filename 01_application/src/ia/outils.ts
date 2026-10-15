// Les outils offerts à une IA (pont MCP, BRIEF § 6) : chacun passe par les actions du store,
// donc par l'historique (Ctrl+Z défait ce que l'IA a fait), et l'utilisateur voit le travail
// se faire dans la fenêtre. Aucun outil ne supprime un design, n'efface une image importée ni
// n'écrit hors des dossiers d'Eliot.

import { dureesDe, elementsCourants, pageCourante, useEditeur } from "../etat/editeur";
import { apercuCoupe, couperLesBlancs, creerLesSousTitres, useParole, whisperPret } from "../etat/parole";
import { clipsACouper, estHesitation, OPTIONS_BLANCS, SILENCE_MIN, type LangueParole } from "../modele/parole";
import { ajusterSousTitres, centreParDefaut, estSousTitre, motsDeLaPage, retirerSousTitres, sourcesDeParole, STYLES_SOUS_TITRES } from "../modele/sousTitres";
import { enregistrerMaintenant } from "../etat/enregistrement";
import { copierPoliceDansDesign, nouveauDesign, ouvrirDesign, renommerDesign, utiliserModele } from "../etat/projets";
import { exporter } from "../export/exporter";
import { exporterVideo, type IdPlateforme } from "../export/video";
import { rendrePage } from "../export/rendu";
import { collection as collectionBibliotheque, nomsEmojis, rechercher, traces, urlSvg } from "../bibliotheque/bibliotheque";
import { catalogueConnu, cataloguePersonnages, svgDeSource } from "../bibliotheque/personnages";
import { piecesAuHasard, piecesValides, posture as postureDe, trouverDessin, vueComposee, type CollectionPersonnages } from "../modele/personnages";
import { APPAREILS, DISPOSITIONS } from "../modele/cadres";
import { creerCadre, creerEmoji, creerPersonnage, creerForme, creerGraphique, creerGrille, creerIcone, creerImage, creerMaquette, creerQr, creerTableau, creerTexte, creerVideo, mesurerHauteurTexte, nouvelId } from "../modele/fabriques";
import type { SensAlignement } from "../modele/geometrie";
import { FORMATS_PAGE, recoitPhoto, type Appareil, type Couleur, type Degrade, type ElementGraphique, type ElementPage, type ElementPersonnage, type ElementTableau, type ElementVideo, type FormeCadre, type GenreForme, type GenreGraphique, type OutilDessin, type Ressource } from "../modele/types";
import { logoDansDesign, poserJingle, useMarque } from "../etat/marque";
import { telechargerSonFreesound } from "../etat/sons";
import { versionNettoyee } from "../etat/nettoyage";
import { borneNettoyage, nettoyageActif, VOIX_NETTE } from "../modele/voix";
import { creditsDesSons, pistesAudio, ROLES_SON } from "../modele/son";
import { ROLES_JINGLE } from "../modele/marque";
import { appliquerModele, modeleParId, nouveauDesignDepuisModele, vignetteModele } from "../etat/modeles";
import { MODELES_DEPART } from "../modeles/depart";
import { normaliser } from "../bibliotheque/recherche";
import { telechargerPhotoPixabay, telechargerVideoPixabay } from "../etat/photos";
import { ROLES_POLICE, type KitMarque } from "../modele/marque";
import { creerTrait, OUTILS_DESSIN } from "../modele/dessin";
import { GENRES_GRAPHIQUE, PALETTE_GRAPHIQUE, seriesValides } from "../modele/graphiques";
import { mesurePolice } from "../modele/mesure";
import { cellulesValides, disposerTableau } from "../modele/tableaux";
import { ajouterVoixDite, chercherFreesound, chercherPixabay, chercherVideosPixabay, estCheminSon, estCheminVideo, etatFreesound, etatPiper, etatPixabay, importerChemins, listerProjets, urlApercuPixabay, urlApercuVideoPixabay, type GenreFreesound, type PhotoPixabay, type VideoPixabay } from "../pont/tauri";
import { avecSuivi, suiviFichiers, suiviSons } from "../editeur/SuiviImport";
import { useTemps } from "../etat/temps";
import { estPageVideo, pistesDe, PISTE_PRINCIPALE, versVideo } from "../modele/frise";
import { CATALOGUE, definitionAnimation, dureeConseillee, DUREE_TRANSITION, poseA, TRANSITIONS, type GenreAnimation } from "../modele/animation";
import { animationsPour, STYLES_VIDEO, styleVideo } from "../modele/stylesVideo";
import type { Animations, ClipAudio, CleAnimation, NettoyageVoix, RoleSon } from "../modele/types";
import { nomSon } from "../editeur/frise/ClipSon";
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
    images: s.ordreRessources.map((id) => s.ressources[id]).filter((r) => r && !r.son),
    // Les sons importés dans le design (lot 5) : durée en ms, niveau sonore, crédit.
    sons: s.ordreRessources.map((id) => s.ressources[id]).filter((r) => r?.son),
    // Les polices de la bibliothèque ; celles du poste (souvent des dizaines) par lister_polices.
    polices: polices().filter((p) => p.genre !== "poste").map((p) => p.famille),
    policesDuPoste: `${polices().filter((p) => p.genre === "poste").length} (voir lister_polices, genre poste)`,
    annulable: s.passe.length,
    // Le kit de marque en bref ; tout le détail (logos compris) par l'outil marque.
    marque: { nom: useMarque.getState().kit.nom, couleurs: useMarque.getState().kit.couleurs.map((c) => c.valeur), polices: useMarque.getState().kit.polices },
    // Page vidéo : sa frise en bref (le détail des clips est dans `elements`, champs temps et piste).
    ...(estPageVideo(page) ? { frise: resumerFrise() } : {}),
  };
}

/** Un son de la frise, tel que l'IA le lit. */
function resumerSon(c: ClipAudio) {
  return {
    id: c.id,
    ressource: c.ressource,
    nom: nomSon(etat().ressources[c.ressource]),
    role: c.role,
    piste: c.piste,
    debut: c.temps.debut,
    fin: c.temps.fin,
    ...(c.coupe ? { coupe: c.coupe } : {}),
    volume: c.volume ?? 1,
    ...(c.fonduEntree ? { fonduEntree: c.fonduEntree } : {}),
    ...(c.fonduSortie ? { fonduSortie: c.fonduSortie } : {}),
    ...(c.boucle ? { boucle: true } : {}),
    ...(c.jusquALaFin ? { jusquALaFin: true } : {}),
    ...(c.role === "musique" ? { sousLaVoix: c.sousLaVoix ?? 0.3 } : {}),
    ...(nettoyageActif(c.nettoyage) ? { nettoyage: borneNettoyage(c.nettoyage) } : {}),
  };
}

/** La frise de la page vidéo affichée : durée, tête de lecture, pistes et clips (en ms), pistes
 *  des sons et crédits à coller. */
function resumerFrise() {
  const page = pageCourante(etat());
  const credits = creditsDesSons(page, etat().ressources);
  return {
    duree: page.duree,
    tete: useTemps.getState().tete,
    pistesSons: pistesAudio(page).map(({ piste, sons }) => ({ piste, sons: sons.map(resumerSon) })),
    ...(credits.length ? { creditsSons: credits } : {}),
    pistes: pistesDe(page).map(({ piste, clips }) => ({
      piste,
      nom: piste === 0 ? "principale" : `superposition ${piste}`,
      clips: clips.map((e) => ({
        id: e.id,
        type: e.type,
        nom: e.nom ?? (e.type === "texte" ? e.texte.slice(0, 40) : e.type),
        ...(e.type === "texte" && e.sousTitre ? { sousTitre: true } : {}),
        debut: e.temps?.debut,
        fin: e.temps?.fin,
        ...(e.type === "video" ? { coupe: e.coupe ?? null, vitesse: e.vitesse ?? 1 } : {}),
        ...(e.animations ? { animations: Object.fromEntries(Object.entries(e.animations).map(([g, a]) => [g, `${a.nom} (${a.duree} ms)`])) } : {}),
        ...(e.cles?.length ? { imagesCles: e.cles.length } : {}),
        ...(e.transition ? { transition: `${e.transition.nom} (${e.transition.duree} ms) depuis le clip précédent` } : {}),
      })),
    })),
  };
}

/** Propriétés qu'une modification peut toucher, selon le type de l'élément. */
const COMMUNES = ["x", "y", "largeur", "hauteur", "rotation", "opacite", "visible", "verrouille", "nom", "ombre", "temps", "piste"];
const PAR_TYPE: Record<ElementPage["type"], string[]> = {
  texte: ["texte", "police", "taillePolice", "couleur", "gras", "italique", "souligne", "barre", "majuscules", "alignement", "interligne", "espacement", "contour", "surlignage"],
  forme: ["remplissage", "contour", "epaisseurContour", "arrondi", "forme", "cotes", "tirets", "pointes"],
  image: ["retourneH", "retourneV", "arrondi", "bordure"],
  video: ["retourneH", "retourneV", "arrondi", "bordure", "coupe", "vitesse", "volume", "fonduEntree", "fonduSortie"],
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
    } else if (cle === "temps" || cle === "piste") {
      exiger(el.temps !== undefined, `${cle} : seulement sur une page vidéo (page_video pour en faire une)`);
      if (cle === "temps") {
        const t = valeur as { debut?: unknown; fin?: unknown } | null;
        exiger(t && typeof t === "object", "temps : { debut, fin } en millisecondes de la page");
        const debut = Math.round(nombre(t!.debut, el.temps!.debut)!);
        const fin = Math.round(nombre(t!.fin, el.type === "video" ? debut + (el.temps!.fin - el.temps!.debut) : el.temps!.fin)!);
        exiger(debut >= 0 && fin - debut >= 100, "temps : debut ≥ 0 et fin au moins 100 ms après debut (une vidéo garde la durée de sa coupe : changer sa coupe ou sa vitesse)");
        propre[cle] = { debut, fin };
      } else {
        const n = nombre(valeur);
        exiger(n !== undefined && Number.isInteger(n) && n >= 0, "piste : 0 pour la principale (vidéos et photos), 1, 2, 3… pour les superpositions");
        propre[cle] = n;
      }
    } else if (el.type === "video" && (cle === "coupe" || cle === "vitesse" || cle === "volume")) {
      Object.assign(propre, reglagesVideo(etat().ressources[el.ressource], { [cle]: valeur }));
    } else if (cle === "fonduEntree" || cle === "fonduSortie") {
      const v = valeur === null ? 0 : nombre(valeur);
      exiger(v !== undefined && v >= 0 && v <= 10_000, `${cle} : durée du fondu du son en ms, de 0 à 10000 (null ou 0 : sans fondu)`);
      propre[cle] = v > 0 ? Math.round(v) : undefined;
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

/** Pose un élément sur la page affichée et le renvoie tel que la page l'a rangé (sur une page
 *  vidéo : avec son temps et sa piste). */
function ajouter<T extends ElementPage>(el: T): T {
  etat().ajouterElements([el]);
  return (elementsCourants(etat()).find((e) => e.id === el.id) as T | undefined) ?? el;
}

/** Une vidéo posée par l'IA : boîte, puis coupe, vitesse et volume. */
function poserVideo(ressource: Ressource, args: Arguments): ElementVideo {
  const base = creerVideo(etat().document.format, ressource);
  const largeur = nombre(args.largeur);
  const hauteur = nombre(args.hauteur);
  const ratio = ressource.largeur / ressource.hauteur;
  const dimensions = largeur && hauteur ? { largeur, hauteur } : largeur ? { largeur, hauteur: largeur / ratio } : hauteur ? { largeur: hauteur * ratio, hauteur } : {};
  const el = { ...placer(base, { ...args, ...dimensions }), ...reglagesVideo(ressource, args) };
  for (const cle of ["coupe", "vitesse", "volume"] as const) if (el[cle] === undefined) delete el[cle];
  // Sans position ni taille demandées, une vidéo de la piste principale remplit la page.
  const boiteVoulue = ["x", "y", "largeur", "hauteur"].some((k) => args[k] !== undefined);
  etat().ajouterElements([el], { garderBoite: boiteVoulue });
  // L'élément tel que la frise l'a posé (temps et piste).
  return (elementsCourants(etat()).find((e) => e.id === el.id) as ElementVideo | undefined) ?? el;
}

/** Ce que l'IA voit du kit de marque. */
function resumerMarque(kit: KitMarque) {
  const images = useMarque.getState().images;
  return {
    nom: kit.nom,
    couleurs: kit.couleurs,
    polices: kit.polices,
    logos: kit.logos.map((id) => images[id]).filter(Boolean).map((r) => ({ id: r.id, nom: r.nom, largeur: r.largeur, hauteur: r.hauteur, transparence: r.transparence })),
    // Les jingles (sons), à poser avec ajouter_son et jingle : ouverture ou fin.
    jingles: Object.fromEntries(
      ROLES_JINGLE.flatMap((j) => {
        const r = kit.jingles[j.id] ? images[kit.jingles[j.id]!] : undefined;
        return r?.son ? [[j.id, { nom: r.nom, duree: r.son.duree }]] : [];
      }),
    ),
  };
}

const ROLES = ROLES_SON.map((r) => r.id);

/** Les réglages d'un son donnés par l'IA, vérifiés : ce qu'il faut passer à modifierSons. */
function reglagesSon(args: Arguments, longueur: number): Partial<ClipAudio> {
  const m: Partial<ClipAudio> = {};
  if (args.role !== undefined) {
    exiger(ROLES.includes(args.role as RoleSon), "role : musique, voix ou bruitage");
    m.role = args.role as RoleSon;
  }
  const volume = nombre(args.volume);
  if (args.volume !== undefined) {
    exiger(volume !== undefined && volume >= 0 && volume <= 1, "volume : de 0 (muet) à 1");
    m.volume = volume === 1 ? undefined : volume;
  }
  for (const cle of ["fonduEntree", "fonduSortie"] as const) {
    if (args[cle] === undefined) continue;
    const v = nombre(args[cle]);
    exiger(v !== undefined && v >= 0 && v <= Math.max(100, longueur), `${cle} : de 0 à la longueur du son, en ms`);
    m[cle] = v ? Math.round(v) : undefined;
  }
  if (args.sousLaVoix !== undefined) {
    const v = nombre(args.sousLaVoix);
    exiger(v !== undefined && v >= 0 && v <= 1, "sousLaVoix : la part du volume gardée sous une voix, de 0 à 1 (0,3 par défaut)");
    m.sousLaVoix = v;
  }
  if (args.jusquALaFin !== undefined) {
    exiger(typeof args.jusquALaFin === "boolean", "jusquALaFin : vrai ou faux");
    m.jusquALaFin = args.jusquALaFin ? true : undefined;
    if (args.jusquALaFin) m.boucle = undefined;
  }
  if (args.boucle !== undefined) {
    exiger(typeof args.boucle === "boolean", "boucle : vrai ou faux");
    m.boucle = args.boucle ? true : undefined;
    if (!args.boucle) m.jusquALaFin = undefined;
  }
  if (args.coupe !== undefined) {
    const c = args.coupe as { debut?: unknown; fin?: unknown } | null;
    if (c === null) m.coupe = undefined;
    else {
      const debut = nombre(c?.debut, 0)!;
      const fin = nombre(c?.fin);
      exiger(debut >= 0 && (fin === undefined || fin > debut + 50), "coupe : { debut, fin? } en ms du fichier, fin après debut");
      m.coupe = { debut: Math.round(debut), ...(fin !== undefined ? { fin: Math.round(fin) } : {}) };
    }
  }
  if (args.nettoyage !== undefined) m.nettoyage = nettoyageDonne(args.nettoyage);
  return m;
}

/** Le nettoyage d'une voix donné par l'IA : « voix nette », « aucun » (ou null), ou les
 *  réglages un par un, vérifiés. */
function nettoyageDonne(v: unknown): NettoyageVoix | undefined {
  if (v === null || v === "aucun") return undefined;
  if (v === "voix nette") return { ...VOIX_NETTE };
  exiger(v && typeof v === "object" && !Array.isArray(v), "nettoyage : \"voix nette\", \"aucun\" ou { bruit, graves, chaleur, presence, compresseur, deesseur, niveau }");
  const o = v as Record<string, unknown>;
  const n: NettoyageVoix = {};
  for (const [cle, valeur] of Object.entries(o)) {
    if (cle === "graves" || cle === "niveau") {
      exiger(typeof valeur === "boolean", `nettoyage.${cle} : vrai ou faux`);
      n[cle] = valeur || undefined;
    } else if (cle === "chaleur" || cle === "presence") {
      exiger(typeof valeur === "number" && valeur >= -6 && valeur <= 6, `nettoyage.${cle} : de -6 à 6 dB`);
      n[cle] = valeur;
    } else if (cle === "bruit" || cle === "compresseur" || cle === "deesseur") {
      exiger(typeof valeur === "number" && valeur >= 0 && valeur <= 1, `nettoyage.${cle} : de 0 à 1`);
      n[cle] = valeur;
    } else throw new ErreurOutil(`nettoyage : réglage inconnu « ${cle} » (bruit, graves, chaleur, presence, compresseur, deesseur, niveau)`);
  }
  const b = borneNettoyage(n);
  return nettoyageActif(b) ? b : undefined;
}

/** Attend la version nettoyée d'un son (le noyau la fabrique une fois) : son niveau. */
async function attendreNettoyage(c: ClipAudio): Promise<Record<string, unknown>> {
  if (!nettoyageActif(c.nettoyage)) return {};
  const t = await versionNettoyee(etat().projet!, c.ressource, c.nettoyage!);
  return { voixNettoyee: { lufs: t.lufs ?? null, crete: t.crete ?? null, duree: t.duree } };
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
    // Page vidéo : l'instant demandé, sinon celui de la tête de lecture (page affichée).
    const instant = estPageVideo(page) ? Math.max(0, Math.min((page.duree ?? 1) - 1, nombre(args.temps, page.id === s.pageActive ? useTemps.getState().tete : 0)!)) : undefined;
    const blob = await rendrePage(page, s.document.format, { pixelRatio: largeur / s.document.format.largeur, type: "image/png", instant });
    return { donnees: { page: numero, largeur, format: s.document.format, ...(instant !== undefined ? { temps: instant, duree: page.duree } : {}) }, image: await base64(blob) };
  },

  page_video(args) {
    designOuvert();
    exiger(typeof args.video === "boolean", "video : vrai pour une page vidéo (frise), faux pour une image fixe");
    etat().basculerPageVideo(args.video as boolean);
    const page = pageCourante(etat());
    return { donnees: estPageVideo(page) ? { video: true, frise: resumerFrise() } : { video: false, elements: page.elements.length } };
  },

  aller_a(args) {
    designOuvert();
    const page = pageCourante(etat());
    exiger(estPageVideo(page), "la page affichée est une image fixe (page_video pour en faire une vidéo)");
    const t = nombre(args.temps);
    exiger(t !== undefined && t >= 0, "temps : un instant de la page, en millisecondes");
    useTemps.getState().pause();
    useTemps.getState().allerA(Math.min(t!, (page.duree ?? 1) - 1));
    return { donnees: { tete: useTemps.getState().tete, duree: page.duree } };
  },

  scinder(args) {
    designOuvert();
    const page = pageCourante(etat());
    exiger(estPageVideo(page), "la page affichée est une image fixe (page_video pour en faire une vidéo)");
    const t = args.temps === undefined ? useTemps.getState().tete : nombre(args.temps);
    exiger(t !== undefined && t >= 0, "temps : l'instant de la coupe, en millisecondes de la page");
    const id = texte(args.id);
    const son = !!id && !!page.audio?.some((c) => c.id === id);
    if (id) exiger(son || page.elements.some((e) => e.id === id), `élément ou son introuvable sur la page affichée : ${id}`);
    const avant = page.elements.length + (page.audio?.length ?? 0);
    useTemps.getState().pause();
    useTemps.getState().allerA(t!);
    if (son) etat().selectionnerSons([id!]);
    else if (id) etat().selectionnerSeul(id);
    else etat().deselectionner();
    etat().scinderALaTete();
    const apres = pageCourante(etat());
    exiger(apres.elements.length + (apres.audio?.length ?? 0) > avant, "rien à couper à cet instant (il faut un clip ou un son qui dure au moins 100 ms de chaque côté)");
    return { donnees: { nouveaux: son ? etat().selectionAudio : etat().selection, frise: resumerFrise() } };
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
    const style = args.style === undefined ? undefined : styleVideo(String(args.style));
    exiger(args.style === undefined || style, `style inconnu : ${String(args.style)} (${STYLES_VIDEO.map((x) => x.id).join(", ")})`);
    const police = texte(args.police) ?? style?.police;
    if (police) exiger(polices().some((p) => p.famille === police), `police inconnue : ${police} (voir etat)`);
    await assurerPolice(police ?? "Inter", booleen(args.gras) ?? true, booleen(args.italique) ?? false);
    if (police) await copierPoliceDansDesign(police);
    const taille = nombre(args.taillePolice, style ? Math.round((style.taille * format.largeur) / 1080) : Math.round((56 * Math.max(format.largeur, format.hauteur)) / 1080))!;
    const base = creerTexte(format, {
      texte: contenu!,
      taillePolice: taille,
      gras: booleen(args.gras) ?? false,
      // Un style vidéo donne police, couleurs et effets ; ce que l'IA précise passe devant.
      ...(style ? style.effets(taille) : {}),
      ...(booleen(args.gras) !== undefined ? { gras: booleen(args.gras) } : {}),
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
    // Le style apporte aussi ses animations (prises en compte sur une page vidéo).
    const anime = style && estPageVideo(pageCourante(etat())) ? { ...el, animations: animationsPour(style, el) } : el;
    return { donnees: ajouter(anime) };
  },

  animer(args) {
    designOuvert();
    const page = pageCourante(etat());
    const ids = listeIds(args.ids);
    exiger(ids.length > 0, "ids : les éléments à animer");
    const elements = ids.map((id) => page.elements.find((e) => e.id === id));
    ids.forEach((id, i) => exiger(elements[i], `élément introuvable sur la page affichée : ${id}`));
    const genres = (["entree", "sortie", "boucle"] as GenreAnimation[]).filter((g) => g in args);
    exiger(genres.length > 0, "entree, sortie ou boucle : { nom, duree } (null en retire une)");
    const modifs: Record<string, Partial<ElementPage>> = {};
    for (const el of elements as ElementPage[]) {
      const animations: Animations = { ...el.animations };
      for (const g of genres) {
        const v = args[g] as { nom?: unknown; duree?: unknown } | null;
        if (v === null) {
          delete animations[g];
          continue;
        }
        exiger(v && typeof v === "object", `${g} : { nom, duree } ou null`);
        const nom = texte(v.nom) ?? "";
        const def = definitionAnimation(g, nom);
        exiger(def, `${g}.nom inconnu : ${nom} (${CATALOGUE[g].map((d) => d.nom).join(", ")})`);
        exiger(!def!.texte || el.type === "texte", `${g} ${nom} : seulement pour un texte (${el.id} est un élément ${el.type})`);
        const duree = v.duree === undefined || v.duree === null ? undefined : nombre(v.duree);
        exiger(v.duree === undefined || v.duree === null || (duree !== undefined && duree >= (g === "boucle" ? 0 : 100) && duree <= 20_000), `${g}.duree : de 100 à 20000 ms`);
        animations[g] = { nom, duree: Math.round(duree ?? dureeConseillee(g, nom, el)) };
      }
      modifs[el.id] = { animations: Object.keys(animations).length ? animations : undefined };
    }
    // Sur une image fixe, la page devient d'abord une page vidéo (post animé), dans la même
    // étape d'annulation, comme avec le bouton Animer.
    const durees = dureesDe(etat().ressources);
    etat().appliquerPage((avant) => {
      const p = estPageVideo(avant) ? avant : versVideo(avant, durees);
      return {
        ...p,
        elements: p.elements.map((e) => {
          if (!(e.id in modifs)) return e;
          const { animations: _a, ...sans } = e;
          const a = modifs[e.id].animations;
          return (a ? { ...e, animations: a } : sans) as ElementPage;
        }),
      };
    });
    const apres = pageCourante(etat());
    return { donnees: ids.map((id) => {
      const e = apres.elements.find((x) => x.id === id)!;
      return { id, temps: e.temps, animations: e.animations ?? null };
    }) };
  },

  images_cles(args) {
    designOuvert();
    const id = texte(args.id);
    exiger(pageCourante(etat()).elements.some((e) => e.id === id), `élément introuvable sur la page affichée : ${String(args.id)}`);
    if (args.cles === null && !estPageVideo(pageCourante(etat()))) return { donnees: { id, cles: null } };
    // Sur une image fixe, la page devient d'abord une page vidéo de 5 s (post animé).
    if (!estPageVideo(pageCourante(etat())) && args.cles !== null) etat().basculerPageVideo(true);
    const page = pageCourante(etat());
    const el = page.elements.find((e) => e.id === id);
    exiger(el?.temps, `élément introuvable sur la page affichée : ${String(args.id)}`);
    const longueur = el!.temps!.fin - el!.temps!.debut;
    if (args.cles === null) {
      etat().modifierElements({ [el!.id]: { cles: undefined } });
      return { donnees: { id: el!.id, cles: null } };
    }
    exiger(Array.isArray(args.cles) && args.cles.length > 0, "cles : liste de { t, x, y, echelle, rotation, opacite, courbe } (t en ms depuis le début du clip), ou null pour les retirer");
    const cles = (args.cles as Record<string, unknown>[]).map((c, i) => {
      exiger(c && typeof c === "object", `cles[${i}] : un objet { t, … }`);
      const t = nombre(c.t);
      exiger(t !== undefined && t >= 0 && t <= longueur, `cles[${i}].t : de 0 à ${longueur} ms, compté depuis le début du clip (il commence à ${el!.temps!.debut} ms de la page)`);
      const cle: CleAnimation = { t: Math.round(t!) };
      if (c.x !== undefined || c.y !== undefined) {
        exiger(nombre(c.x) !== undefined && nombre(c.y) !== undefined, `cles[${i}] : x et y vont ensemble (coin haut gauche de l'élément)`);
        cle.x = nombre(c.x)!;
        cle.y = nombre(c.y)!;
      }
      if (c.echelle !== undefined) {
        const e = nombre(c.echelle);
        exiger(e !== undefined && e > 0 && e <= 20, `cles[${i}].echelle : un nombre de 0 (exclu) à 20, 1 pour la taille de l'élément`);
        cle.echelle = e!;
      }
      if (c.rotation !== undefined) {
        exiger(nombre(c.rotation) !== undefined, `cles[${i}].rotation : en degrés`);
        cle.rotation = nombre(c.rotation)!;
      }
      if (c.opacite !== undefined) {
        const o = nombre(c.opacite);
        exiger(o !== undefined && o >= 0 && o <= 1, `cles[${i}].opacite : de 0 à 1`);
        cle.opacite = o!;
      }
      if (c.courbe !== undefined) {
        exiger(c.courbe === "douce" || c.courbe === "lineaire", `cles[${i}].courbe : douce ou lineaire`);
        cle.courbe = c.courbe as "douce" | "lineaire";
      }
      exiger(Object.keys(cle).filter((k) => k !== "t" && k !== "courbe").length > 0, `cles[${i}] : au moins une valeur (x et y, echelle, rotation ou opacite)`);
      return cle;
    }).sort((a, b) => a.t - b.t);
    exiger(cles.every((c, i) => i === 0 || c.t !== cles[i - 1].t), "cles : deux clés au même instant");
    etat().modifierElements({ [el!.id]: { cles } });
    const apres = pageCourante(etat()).elements.find((e) => e.id === el!.id)!;
    const arrondir = (p: ReturnType<typeof poseA>) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Math.round(v * 100) / 100]));
    return { donnees: { id: el!.id, temps: apres.temps, cles: apres.cles, poseAuDebut: arrondir(poseA(apres, 0)), poseALaFin: arrondir(poseA(apres, longueur)) } };
  },

  transition(args) {
    designOuvert();
    const page = pageCourante(etat());
    exiger(estPageVideo(page), "la page affichée est une image fixe (page_video pour en faire une vidéo)");
    const el = page.elements.find((e) => e.id === texte(args.id));
    exiger(el?.piste === PISTE_PRINCIPALE && el.temps, "id : un clip de la piste principale ; la transition le relie au clip d'avant");
    const principale = page.elements.filter((e) => e.piste === PISTE_PRINCIPALE && e.temps).sort((a, b) => a.temps!.debut - b.temps!.debut);
    exiger(principale.indexOf(el!) > 0, "ce clip est le premier de la piste principale : une transition se pose sur un clip qui en suit un autre");
    if (args.nom === null) etat().definirTransition(el!.id, null);
    else {
      const nom = texte(args.nom) ?? "";
      exiger(TRANSITIONS.some((d) => d.nom === nom), `nom inconnu : ${nom} (${TRANSITIONS.map((d) => d.nom).join(", ")}, ou null pour la retirer)`);
      const duree = nombre(args.duree, DUREE_TRANSITION)!;
      exiger(duree >= 100 && duree <= 5000, "duree : de 100 à 5000 ms (au plus la moitié du plus court des deux clips)");
      etat().definirTransition(el!.id, { nom, duree });
    }
    const apres = pageCourante(etat()).elements.find((e) => e.id === el!.id)!;
    return { donnees: { id: apres.id, transition: apres.transition ?? null, temps: apres.temps, duree: pageCourante(etat()).duree, frise: resumerFrise() } };
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
    return { donnees: ajouter(el) };
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
    return { donnees: ajouter(el) };
  },

  async ajouter_emoji(args) {
    designOuvert();
    const id = texte(args.collection);
    const nom = texte(args.nom);
    const c = id ? await collectionBibliotheque(id) : undefined;
    exiger(c && c.genre === "emoji", `collection d'emojis inconnue : ${String(args.collection)} (fluent ou openmoji)`);
    exiger(nom && (await traces(id!))[nom] !== undefined, `emoji inconnu dans ${id} : ${String(args.nom)} (voir chercher_bibliotheque)`);
    const el = placer(creerEmoji(etat().document.format, id!, nom!), { ...args, hauteur: args.hauteur ?? args.largeur, largeur: args.largeur ?? args.hauteur });
    return { donnees: ajouter(el) };
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
    return { donnees: ajouter(el) };
  },

  ajouter_qr(args) {
    designOuvert();
    const contenu = texte(args.contenu);
    exiger(contenu?.trim(), "contenu vide");
    const base = creerQr(etat().document.format, contenu!, (couleur(args.couleur ?? "#1f1f1d", "couleur") as string) ?? "#1f1f1d");
    const fond = args.fond === null ? null : args.fond !== undefined ? (couleur(args.fond, "fond") as string) : base.fond;
    const el = placer({ ...base, fond }, { ...args, hauteur: args.largeur });
    return { donnees: ajouter(el) };
  },

  ajouter_cadre(args) {
    designOuvert();
    const formes = ["rectangle", "arrondi", "cercle", "arche", "goutte", "hexagone", "etoile", "coeur"];
    const forme = texte(args.forme) as FormeCadre;
    exiger(formes.includes(forme), `forme : ${formes.join(", ")}`);
    const ressource = texte(args.ressource);
    if (ressource) exiger(etat().ressources[ressource] && !etat().ressources[ressource].video, `image inconnue dans ce design : ${ressource} (voir etat ou importer_image ; une vidéo se pose avec ajouter_video)`);
    const el = placer(creerCadre(etat().document.format, forme, ressource), args);
    return { donnees: ajouter(el) };
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
    return { donnees: ajouter(el) };
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

  async importer_son(args) {
    designOuvert();
    const chemin = texte(args.chemin);
    exiger(chemin?.startsWith("/"), "chemin absolu attendu");
    exiger(estCheminSon(chemin!), "fichier son attendu : .mp3, .wav, .ogg, .oga, .opus, .m4a, .aac, .flac, .aif, .aiff ou .wma");
    const projet = etat().projet!;
    const bilan = await avecSuivi(() => importerChemins(projet, [chemin!], suiviFichiers, suiviSons));
    exiger(bilan.ressources.length, bilan.erreurs.join(" ; ") || "import impossible");
    etat().ajouterRessources(bilan.ressources);
    return { donnees: bilan.ressources[0] };
  },

  async chercher_sons(args) {
    const requete = texte(args.requete)?.trim();
    exiger(requete, "requete : quelques mots, en anglais de préférence (rain, whoosh, lofi)");
    const genre = (args.genre ?? "tout") as GenreFreesound;
    exiger(["bruitages", "musiques", "tout"].includes(genre), "genre : bruitages (30 s au plus), musiques (20 s et plus) ou tout");
    const etatCle = await etatFreesound();
    exiger(etatCle, "les sons de Freesound ne s'ouvrent que dans la fenêtre Eliot");
    exiger(etatCle.cle, `pas de clé Freesound : Alexandre doit ajouter FREESOUND_API_KEY dans ${etatCle.fichier}`);
    const page = Math.max(1, Math.min(20, Math.round(nombre(args.page, 1)!)));
    const resultat = await chercherFreesound(requete!, page, genre);
    const n = Math.max(1, Math.min(30, Math.round(nombre(args.nombre, 15)!)));
    return {
      donnees: {
        total: resultat.total,
        page,
        sons: resultat.sons.slice(0, n).map((x) => ({ id: x.id, nom: x.nom, auteur: x.auteur, licence: x.licence, duree_s: x.duree, mots: x.mots, lien: x.lien })),
        conseil: "ajouter_son avec freesound : l'id choisi ; CC BY demande de citer l'auteur (Eliot garde le crédit, la liste à coller est dans etat, frise.creditsSons)",
      },
    };
  },

  async ajouter_son(args) {
    designOuvert();
    const sources = ["ressource", "freesound", "jingle", "video"].filter((k) => args[k] !== undefined);
    exiger(sources.length === 1, "une source et une seule : ressource (un son du design), freesound (id donné par chercher_sons), jingle (ouverture ou fin du kit) ou video (id d'un élément vidéo dont on détache le son)");
    if (args.role !== undefined) exiger(ROLES.includes(args.role as RoleSon), "role : musique, voix ou bruitage");
    const debut = nombre(args.debut);
    if (args.debut !== undefined) exiger(debut !== undefined && debut >= 0, "debut : un instant de la page, en ms");
    const piste = nombre(args.piste);
    if (args.piste !== undefined) exiger(piste !== undefined && Number.isInteger(piste) && piste >= 0, "piste : 0 pour la première piste des sons, 1 pour la suivante…");
    useTemps.getState().pause();
    const options = { ...(args.role ? { role: args.role as RoleSon } : {}), ...(debut !== undefined ? { debut } : {}), ...(piste !== undefined ? { piste } : {}) };
    let id: string | null;
    if (args.jingle !== undefined) {
      exiger(args.jingle === "ouverture" || args.jingle === "fin", "jingle : ouverture ou fin (voir marque)");
      id = await poserJingle(args.jingle as "ouverture" | "fin");
    } else if (args.video !== undefined) {
      const v = elementsCourants(etat()).find((e) => e.id === String(args.video));
      exiger(v?.type === "video" && v.temps, `vidéo introuvable sur la page vidéo affichée : ${String(args.video)}`);
      exiger((v.vitesse ?? 1) === 1, "le son ne se détache qu'à vitesse normale (vitesse 1)");
      exiger(etat().ressources[v.ressource]?.video?.son, "cette vidéo n'a pas de son");
      exiger((v.volume ?? 1) > 0, "cette vidéo est muette (volume 0) : son son est peut-être déjà détaché");
      id = etat().detacherSon(v.id);
    } else {
      let r = args.ressource !== undefined ? etat().ressources[String(args.ressource)] : undefined;
      if (args.freesound !== undefined) {
        const fs = nombre(args.freesound);
        exiger(fs !== undefined && Number.isInteger(fs) && fs > 0, "freesound : l'identifiant d'un son trouvé par chercher_sons");
        r = await telechargerSonFreesound(fs!);
      }
      exiger(r?.son, `son inconnu dans ce design : ${String(args.ressource)} (voir etat, sons, ou importer_son)`);
      id = etat().ajouterSon(r!, options);
    }
    exiger(id, "son non posé");
    // Les réglages donnés en plus (volume, fondus…) : une seconde étape d'annulation.
    const c = pageCourante(etat()).audio!.find((x) => x.id === id)!;
    // Le rôle d'un son du design ou de Freesound est déjà posé ; celui d'un jingle ou d'un son
    // détaché se change ici.
    const m = reglagesSon(args.jingle !== undefined || args.video !== undefined ? args : { ...args, role: undefined }, c.temps.fin - c.temps.debut);
    if (Object.keys(m).length) etat().modifierSons({ [id!]: m });
    const apres = pageCourante(etat()).audio!.find((x) => x.id === id)!;
    return { donnees: { son: resumerSon(apres), ...(await attendreNettoyage(apres)), frise: resumerFrise() } };
  },

  async regler_son(args) {
    designOuvert();
    const page = pageCourante(etat());
    const id = texte(args.id);
    const c = page.audio?.find((x) => x.id === id);
    exiger(c, `son introuvable sur la page affichée : ${String(args.id)} (voir etat, frise.pistesSons)`);
    if (args.supprimer === true) {
      etat().selectionnerSons([c.id]);
      etat().supprimerSelection();
      return { donnees: { supprime: c.id, frise: resumerFrise() } };
    }
    const m = reglagesSon(args, c.temps.fin - c.temps.debut);
    if (Object.keys(m).length) etat().modifierSons({ [c.id]: m });
    const debut = nombre(args.debut);
    const piste = nombre(args.piste);
    if (args.debut !== undefined || args.piste !== undefined) {
      exiger((debut === undefined || debut >= 0) && (piste === undefined || (Number.isInteger(piste) && piste >= 0)), "debut en ms (0 ou plus), piste entière (0 ou plus)");
      const actuel = pageCourante(etat()).audio!.find((x) => x.id === c.id)!;
      etat().deplacerSon(c.id, debut ?? actuel.temps.debut, piste ?? actuel.piste);
    }
    if (args.fin !== undefined) {
      const fin = nombre(args.fin);
      exiger(fin !== undefined && fin > 0, "fin : l'instant de la page où le son s'arrête, en ms");
      etat().rognerSon(c.id, "fin", fin!);
    }
    const apres = pageCourante(etat()).audio!.find((x) => x.id === c.id)!;
    return { donnees: { son: resumerSon(apres), ...(args.nettoyage !== undefined ? await attendreNettoyage(apres) : {}), frise: resumerFrise() } };
  },

  async voix_de_synthese(args) {
    designOuvert();
    const piper = await etatPiper();
    exiger(piper, "la voix de synthèse ne s'ouvre que dans la fenêtre Eliot");
    exiger(piper.installe, "Piper n'est pas installé sur le poste : Alexandre doit taper la commande 16 du CLAUDE.md (uv tool install piper-tts), puis relancer Eliot");
    exiger(piper.voix.length > 0, `aucune voix de Piper : Alexandre doit en télécharger une (commande 17 du CLAUDE.md) dans ${piper.dossier}`);
    const texteDit = texte(args.texte)?.trim();
    if (!texteDit) return { donnees: { voix: piper.voix, conseil: "voix_de_synthese avec texte (et voix : un id de cette liste) pour poser la phrase dans la frise" } };
    exiger(texteDit.length <= 3000, "texte : 3 000 caractères au plus ; découpe en plusieurs appels");
    const voix = args.voix !== undefined ? piper.voix.find((v) => v.id === String(args.voix)) : (piper.voix.find((v) => v.langue.startsWith("fr")) ?? piper.voix[0]);
    exiger(voix, `voix inconnue : ${String(args.voix)} (voix_de_synthese sans texte donne la liste)`);
    const vitesse = nombre(args.vitesse, 1)!;
    exiger(vitesse >= 0.7 && vitesse <= 1.5, "vitesse : de 0,7 à 1,5 (1 : normale)");
    const debut = nombre(args.debut);
    if (args.debut !== undefined) exiger(debut !== undefined && debut >= 0, "debut : un instant de la page, en ms");
    const piste = nombre(args.piste);
    if (args.piste !== undefined) exiger(piste !== undefined && Number.isInteger(piste) && piste >= 0, "piste : 0 pour la première piste des sons, 1 pour la suivante…");
    useTemps.getState().pause();
    const projet = etat().projet!;
    const r = await avecSuivi(() => ajouterVoixDite(projet, voix!.id, texteDit, vitesse));
    exiger(etat().projet === projet, "le design a changé pendant la synthèse");
    etat().ajouterRessources([r]);
    const id = etat().ajouterSon(r, { role: "voix", ...(debut !== undefined ? { debut } : {}), ...(piste !== undefined ? { piste } : {}) });
    exiger(id, "voix non posée");
    const c = pageCourante(etat()).audio!.find((x) => x.id === id)!;
    return { donnees: { son: resumerSon(c), voix: { id: voix!.id, nom: voix!.nom, licence: voix!.licence ?? null }, frise: resumerFrise() } };
  },

  async transcrire(args) {
    designOuvert();
    const page = pageCourante(etat());
    exiger(estPageVideo(page), "la transcription se fait sur une page vidéo");
    const parole = useParole.getState();
    const manque = whisperPret(parole.whisper ?? (await parole.verifierWhisper()));
    exiger(!manque, `${manque} ; Alexandre installe Whisper avec les commandes 18 et 19 du CLAUDE.md, puis relance Eliot`);
    if (args.langue !== undefined) {
      exiger(["fr", "en", "auto"].includes(String(args.langue)), "langue : fr, en ou auto");
      parole.definirLangue(String(args.langue) as LangueParole);
    }
    let sources = sourcesDeParole(page, etat().ressources);
    if (args.clip !== undefined) {
      const id = String(args.clip);
      sources = sources.filter((x) => x.id === id);
      exiger(sources.length, `clip inconnu ou sans voix : ${id} (une vidéo qu'on entend, ou un son au rôle voix ; voir etat, frise)`);
    }
    exiger(sources.length, "aucune voix sur cette page : une vidéo qu'on entend, ou un son au rôle voix");
    const analyses = await parole.transcrire([...new Set(sources.map((x) => x.ressource))], booleen(args.forcer) ?? false);
    const toutes = { ...useParole.getState().analyses, ...analyses };
    return {
      donnees: {
        sources: sources.map((x) => {
          const mots = motsDeLaPage([x], toutes, { hesitations: true });
          const t = toutes[x.ressource]?.transcription;
          return {
            clip: x.id,
            genre: x.genre,
            ressource: x.ressource,
            langue: t?.langue ?? null,
            modele: t?.modele ?? null,
            texte: mots.map((m) => m.texte).join(" "),
            // Au temps de la page, en ms ; les hésitations comprises (couper_blancs les retire).
            mots: mots.slice(0, 3000).map((m) => ({ texte: m.texte, debut: m.debut, fin: m.fin, ...(estHesitation(m.texte) ? { hesitation: true } : {}) })),
          };
        }),
      },
    };
  },

  async sous_titres(args) {
    designOuvert();
    const page = pageCourante(etat());
    exiger(estPageVideo(page), "les sous-titres se font sur une page vidéo");
    const durees = dureesDe(etat().ressources);
    const resume = () => ({
      sousTitres: pageCourante(etat())
        .elements.filter(estSousTitre)
        .map((e) => ({ id: e.id, texte: e.texte, debut: e.temps?.debut, fin: e.temps?.fin, piste: e.piste })),
      styles: STYLES_SOUS_TITRES.map((x) => ({ id: x.id, libelle: x.libelle, description: x.description })),
    });
    if (booleen(args.retirer)) {
      etat().appliquerPage((p) => retirerSousTitres(p, durees), "sous-titres-retirer");
      return { donnees: resume() };
    }
    if (args.style !== undefined) exiger(STYLES_SOUS_TITRES.some((x) => x.id === String(args.style)), `style inconnu : ${String(args.style)} (${STYLES_SOUS_TITRES.map((x) => x.id).join(", ")})`);
    const centre = nombre(args.centre);
    if (args.centre !== undefined) exiger(centre !== undefined && centre >= 0.08 && centre <= 0.92, "centre : de 0,08 à 0,92 (part de la hauteur de la page)");
    if (args.langue !== undefined) {
      exiger(["fr", "en", "auto"].includes(String(args.langue)), "langue : fr, en ou auto");
      useParole.getState().definirLangue(String(args.langue) as LangueParole);
    }
    const existants = page.elements.filter(estSousTitre);
    const refaire = args.style !== undefined || booleen(args.refaire) || existants.length === 0 || args.hesitations !== undefined;
    if (refaire) {
      const style = String(args.style ?? existants[0]?.sousTitre.style ?? STYLES_SOUS_TITRES[0].id);
      const format = etat().document.format;
      await creerLesSousTitres({ style, centre: centre ?? (existants.length ? (existants[0].y + existants[0].hauteur / 2) / format.hauteur : centreParDefaut(format)), hesitations: booleen(args.hesitations) ?? false });
    }
    const changement: Parameters<typeof ajusterSousTitres>[2] = {};
    const taille = nombre(args.taille);
    if (args.taille !== undefined) {
      exiger(taille !== undefined && taille >= 12 && taille <= 400, "taille : la taille de police, en pixels de la page (12 à 400)");
      changement.taillePolice = Math.round(taille);
    }
    if (!refaire && centre !== undefined) changement.centre = centre;
    if (args.couleurActif !== undefined) {
      exiger(typeof args.couleurActif === "string" && HEX.test(args.couleurActif), "couleurActif : couleur #rrggbb");
      changement.couleurActif = args.couleurActif.toLowerCase();
    }
    if (args.majuscules !== undefined) changement.majuscules = booleen(args.majuscules);
    if (Object.keys(changement).length) etat().modifierElements(ajusterSousTitres(pageCourante(etat()), etat().document.format, changement, mesurerHauteurTexte), "sous-titres-ia");
    return { donnees: { ...resume(), frise: resumerFrise() } };
  },

  async couper_blancs(args) {
    designOuvert();
    const id = String(args.clip ?? "");
    const page = pageCourante(etat());
    exiger(clipsACouper(page, id), `clip inconnu ou impossible à couper : ${id} (une vidéo de la frise, ou un son qui ne boucle pas ; voir etat, frise)`);
    const silences = nombre(args.silences, OPTIONS_BLANCS.silenceMin)!;
    exiger(silences >= SILENCE_MIN.min && silences <= SILENCE_MIN.max, `silences : de ${SILENCE_MIN.min} à ${SILENCE_MIN.max} ms`);
    const parole = useParole.getState();
    const manque = whisperPret(parole.whisper ?? (await parole.verifierWhisper()));
    const hesitations = booleen(args.hesitations) ?? !manque;
    exiger(!hesitations || !manque, `${manque} : hesitations: false pour ne couper que les blancs, ou Alexandre installe Whisper (commandes 18 et 19 du CLAUDE.md)`);
    const options = { ...OPTIONS_BLANCS, silenceMin: silences, hesitations };
    if (booleen(args.apercu)) {
      if (hesitations) await parole.transcrire([clipsACouper(page, id)!.ressource]);
      const a = await apercuCoupe(id, options);
      exiger(a, "clip introuvable");
      return { donnees: { garder: a.garder, retireMs: a.retire, fenetre: a.fenetre } };
    }
    useTemps.getState().pause();
    const bilan = await couperLesBlancs(id, options);
    if (!bilan) return { donnees: { coupe: false, raison: "aucun blanc assez long, ni hésitation, dans ce clip" } };
    return { donnees: { coupe: true, morceaux: bilan.morceaux, retireMs: bilan.retire, sousTitresRefaits: bilan.sousTitres, selection: etat().selection, frise: resumerFrise() } };
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
    return { donnees: ajouter(el) };
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
    return { donnees: ajouter(el) };
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
    return { donnees: ajouter(el) };
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
    return { donnees: { element: ajouter(el), ressource } };
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
    return { donnees: ajouter(el) };
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
    const ids = listeIds(args.ids);
    const sons = new Set((pageCourante(etat()).audio ?? []).map((c) => c.id));
    const idsSons = ids.filter((id) => sons.has(id));
    if (idsSons.length) {
      useEditeur.setState({ selection: [], selectionAudio: idsSons });
      etat().supprimerSelection();
    }
    useEditeur.setState({ selection: ids.filter((id) => !sons.has(id)), selectionAudio: [] });
    etat().supprimerSelection();
    return { donnees: { restants: elementsCourants(etat()).length, sons: pageCourante(etat()).audio?.length ?? 0 } };
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
    if (args.format === "mp4" || args.format === "gif") {
      const gif = args.format === "gif";
      const ips = nombre(args.imagesParSeconde, gif ? 15 : 30)!;
      const id = ["youtube", "shorts", "tiktok", "reels", "libre"].includes(String(args.plateforme)) ? (String(args.plateforme) as IdPlateforme) : "libre";
      const film = await exporterVideo({
        format: args.format,
        plateforme: id,
        definition: args.definition === 720 ? 720 : 1080,
        imagesParSeconde: Math.max(5, Math.min(60, Math.round(ips))),
        son: booleen(args.son) ?? true,
        niveau: booleen(args.niveau) ?? true,
        sansMusique: booleen(args.sansMusique) ?? false,
        largeurGif: Math.max(64, Math.min(1080, Math.round(nombre(args.largeur, 480)!))),
      });
      return { donnees: { chemins: [film.chemin, ...(film.sansMusique ? [film.sansMusique] : [])], ...(film.niveau ? { niveau: film.niveau } : {}) } };
    }
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
