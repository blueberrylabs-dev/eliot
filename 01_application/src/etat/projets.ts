// Les opérations sur les designs, qui passent par le noyau puis mettent le store à jour :
// créer, ouvrir, renommer, copier, supprimer, transporter dans un fichier .eliot.

import { documentVide, NOM_PAR_DEFAUT } from "../modele/fabriques";
import { pagesReprises, ressourcesDesElements, ressourcesDesPages } from "../modele/reprendre";
import type { DocumentEliot, ElementPage, Format, InfoProjet, PageEliot, RefProjet, Ressource } from "../modele/types";
import * as pont from "../pont/tauri";
import { assurerPolicesDocument, chargerPolicesDesign, fichiersDuPoste } from "../polices";
import { enregistrerMaintenant, miniatureAvantDeQuitter, miniatureMaintenant } from "./enregistrement";
import { useEditeur } from "./editeur";
import { voixUtilisees } from "./nettoyage";

const erreur = (texte: string, e: unknown) => useEditeur.getState().notifier(`${texte} : ${String(e instanceof Error ? e.message : e)}`, { erreur: true });

/** Ouvre un design dans l'éditeur, après avoir enregistré celui qu'on quitte. */
export async function ouvrirDesign(ref: RefProjet): Promise<boolean> {
  try {
    await enregistrerMaintenant();
    await miniatureAvantDeQuitter();
    const precedent = useEditeur.getState().projet;
    const { info, document } = await pont.ouvrirProjet(ref);
    const ressources = await pont.listerRessources(ref);
    if (precedent && (precedent.rayon !== ref.rayon || precedent.id !== ref.id)) pont.oublierImages(precedent);
    // Les textes se mesurent avec leur vraie police : elle doit être chargée avant, y compris
    // une police du poste copiée dans le design.
    await chargerPolicesDesign(await pont.policesDesign(ref).catch(() => []), (f) => pont.lirePoliceDesign(ref, f));
    await assurerPolicesDocument(document);
    useEditeur.getState().chargerProjet(ref, document, ressources);
    if (!info.miniature) void miniatureMaintenant(ref, document);
    // Les voix nettoyées dont plus aucun clip ne se sert (versions essayées puis abandonnées).
    void pont.purgerVoix(ref, voixUtilisees(document.pages)).catch(() => undefined);
    return true;
  } catch (e) {
    erreur("Ouverture impossible", e);
    return false;
  }
}

/** Crée un design et l'ouvre ; `page` donne le contenu de sa première page (modèle de départ). */
export async function nouveauDesign(format: Format, nom = NOM_PAR_DEFAUT, page?: Pick<PageEliot, "fond" | "elements">): Promise<boolean> {
  try {
    await enregistrerMaintenant();
    await miniatureAvantDeQuitter();
    const vide = documentVide(format, nom);
    const document = page ? { ...vide, pages: [{ ...vide.pages[0], ...page }] } : vide;
    const info = await pont.creerProjet(document);
    const ref: RefProjet = { rayon: "designs", id: info.id };
    useEditeur.getState().chargerProjet(ref, document, []);
    void miniatureMaintenant(ref, document);
    return true;
  } catch (e) {
    erreur("Création impossible", e);
    return false;
  }
}

/** Renomme le design ouvert : le nom dans le document et le dossier sur le disque. */
export async function renommerDesign(nom: string): Promise<void> {
  const propre = nom.trim();
  const etat = useEditeur.getState();
  if (!etat.projet || !propre || propre === etat.document.nom) return;
  try {
    await enregistrerMaintenant();
    const ancien = etat.projet;
    const info = await pont.renommerProjet(ancien, propre);
    useEditeur.getState().definirProjet({ rayon: ancien.rayon, id: info.id });
    useEditeur.getState().definirNom(propre);
    pont.oublierImages(ancien);
  } catch (e) {
    erreur("Renommage impossible", e);
  }
}

/** Renomme un design depuis l'accueil, sans l'ouvrir. */
export async function renommerDepuisAccueil(ref: RefProjet, nom: string): Promise<InfoProjet | null> {
  try {
    return await pont.renommerProjet(ref, nom.trim());
  } catch (e) {
    erreur("Renommage impossible", e);
    return null;
  }
}

/** « Faire une copie » du design ouvert, puis ouvrir la copie. */
export async function faireUneCopie(): Promise<void> {
  const { projet, document } = useEditeur.getState();
  if (!projet) return;
  try {
    await enregistrerMaintenant();
    const info = await pont.dupliquerProjet(projet, "designs", `${document.nom} (copie)`);
    await ouvrirDesign({ rayon: "designs", id: info.id });
    useEditeur.getState().notifier(`Copie créée : ${info.nom}`);
  } catch (e) {
    erreur("Copie impossible", e);
  }
}

export async function copierDepuisAccueil(ref: RefProjet, nom: string): Promise<InfoProjet | null> {
  try {
    return await pont.dupliquerProjet(ref, ref.rayon, `${nom} (copie)`);
  } catch (e) {
    erreur("Copie impossible", e);
    return null;
  }
}

/** Range une copie du design ouvert parmi les modèles maison. */
export async function enregistrerCommeModele(): Promise<void> {
  const { projet, document } = useEditeur.getState();
  if (!projet) return;
  try {
    await enregistrerMaintenant();
    await miniatureMaintenant();
    const info = await pont.dupliquerProjet(projet, "modeles", document.nom);
    useEditeur.getState().notifier(`Enregistré parmi tes modèles : ${info.nom}`);
  } catch (e) {
    erreur("Enregistrement du modèle impossible", e);
  }
}

/** Crée un design à partir d'un modèle maison, puis l'ouvre. */
export async function utiliserModele(ref: RefProjet, nom: string): Promise<void> {
  try {
    await enregistrerMaintenant();
    const info = await pont.dupliquerProjet(ref, "designs", nom);
    await ouvrirDesign({ rayon: "designs", id: info.id });
  } catch (e) {
    erreur("Impossible d'utiliser ce modèle", e);
  }
}

/** Envoie un design à la corbeille du système, après confirmation. */
export async function supprimerDesign(ref: RefProjet, nom: string): Promise<boolean> {
  const ok = await pont.confirmer(`« ${nom} » part dans la corbeille. Tu pourras l'y récupérer.`, "Supprimer le design");
  if (!ok) return false;
  try {
    const { projet } = useEditeur.getState();
    if (projet && projet.rayon === ref.rayon && projet.id === ref.id) {
      useEditeur.getState().allerALAccueil();
      useEditeur.setState({ projet: null });
    }
    await pont.supprimerProjet(ref);
    return true;
  } catch (e) {
    erreur("Suppression impossible", e);
    return false;
  }
}

/** Écrit le design ouvert dans un fichier `.eliot`. */
export async function exporterDesign(ref?: RefProjet, nom?: string): Promise<void> {
  const etat = useEditeur.getState();
  const cible = ref ?? etat.projet;
  if (!cible) return;
  try {
    if (!ref) {
      await enregistrerMaintenant();
      await miniatureMaintenant();
    }
    const chemin = await pont.exporterArchive(cible, nom ?? etat.document.nom);
    if (chemin) useEditeur.getState().notifier(`Design exporté : ${chemin}`, { chemin });
  } catch (e) {
    erreur("Export du design impossible", e);
  }
}

/** Ouvre un fichier `.eliot` : il devient un nouveau design, qu'on ouvre. */
export async function importerDesign(): Promise<void> {
  try {
    const info = await pont.importerArchive();
    if (info) await ouvrirDesign({ rayon: "designs", id: info.id });
  } catch (e) {
    erreur("Import impossible", e);
  }
}

/** Retour à l'accueil : le design est enregistré et sa miniature mise à jour avant. */
export async function retourAccueil(): Promise<void> {
  await enregistrerMaintenant();
  await miniatureMaintenant();
  useEditeur.getState().allerALAccueil();
}

/** Coller : si les objets viennent d'un autre design, leurs images sont copiées d'abord. */
export async function collerAvecImages(): Promise<void> {
  const etat = useEditeur.getState();
  const { pressePapiers, projet } = etat;
  if (pressePapiers.elements.length === 0) return;
  const source = pressePapiers.projet;
  // Les photos, les vidéos, les photos des cadres et des maquettes, les modèles 3D et leurs
  // environnements HDRI (étape 6).
  const ids = ressourcesDesElements(pressePapiers.elements);
  if (projet && source && ids.length && (source.rayon !== projet.rayon || source.id !== projet.id)) {
    try {
      etat.ajouterRessources(await pont.copierRessources(source, projet, ids));
    } catch (e) {
      erreur("Images non copiées", e);
    }
  }
  if (projet && source && (source.rayon !== projet.rayon || source.id !== projet.id)) void copierPolicesDesTextes(pressePapiers.elements);
  useEditeur.getState().coller();
}

/** Une police du poste employée dans le design y est copiée : il s'ouvrira pareil ailleurs. */
export async function copierPoliceDansDesign(famille: string): Promise<void> {
  const ref = useEditeur.getState().projet;
  const chemins = fichiersDuPoste(famille);
  if (!ref || chemins.length === 0) return;
  try {
    await Promise.all(chemins.map((c) => pont.policeVersDesign(ref, c)));
  } catch (e) {
    erreur(`Police ${famille} non copiée dans le design`, e);
  }
}

const memeDesign = (a: RefProjet, b: RefProjet) => a.rayon === b.rayon && a.id === b.id;

/** Les polices du poste dont des textes venus d'un autre design se servent, copiées dans le
 *  design ouvert (BRIEF § 6 : il doit s'ouvrir pareil sur une autre machine). */
async function copierPolicesDesTextes(elements: readonly ElementPage[]): Promise<void> {
  const familles = [...new Set(elements.flatMap((e) => (e.type === "texte" ? [e.police] : [])))];
  await Promise.all(familles.map((f) => copierPoliceDansDesign(f)));
}

/** Onglet Projets : copie dans le design ouvert des ressources d'un autre design, qui n'est
 *  jamais modifié ; elles rejoignent celles du design (onglet Importer). */
export async function reprendreRessources(source: RefProjet, ids: string[]): Promise<Ressource[]> {
  const etat = useEditeur.getState();
  const cible = etat.projet;
  if (!cible || ids.length === 0) return [];
  if (memeDesign(source, cible)) return ids.flatMap((id) => (etat.ressources[id] ? [etat.ressources[id]] : []));
  const copiees = await pont.copierRessources(source, cible, ids);
  useEditeur.getState().ajouterRessources(copiees);
  return copiees;
}

/** Onglet Projets : les pages `numeros` (à partir de 1) d'un autre design, avec leurs photos,
 *  vidéos, modèles 3D et sons, posées après la page affichée, mises à l'échelle du format
 *  comme Redimensionner. Une étape d'annulation. */
export async function reprendrePages(source: RefProjet, document: DocumentEliot, numeros: number[]): Promise<PageEliot[]> {
  const choisies = numeros.flatMap((n) => (document.pages[n - 1] ? [document.pages[n - 1]] : []));
  if (choisies.length === 0 || !useEditeur.getState().projet) return [];
  await reprendreRessources(source, ressourcesDesPages(choisies));
  // Les textes se mesurent avec leur vraie police : chargée avant ; une police du poste est
  // copiée dans ce design, qui s'ouvrira pareil sur une autre machine.
  await assurerPolicesDocument({ pages: choisies });
  void copierPolicesDesTextes(choisies.flatMap((p) => p.elements));
  const etat = useEditeur.getState();
  const pages = pagesReprises(choisies, document.format, etat.document.format);
  etat.insererPages(pages);
  return pages;
}
