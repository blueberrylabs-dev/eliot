// Les opérations sur les designs, qui passent par le noyau puis mettent le store à jour :
// créer, ouvrir, renommer, copier, supprimer, transporter dans un fichier .eliot.

import { documentVide, NOM_PAR_DEFAUT } from "../modele/fabriques";
import type { Format, InfoProjet, PageEliot, RefProjet } from "../modele/types";
import * as pont from "../pont/tauri";
import { assurerPolicesDocument, chargerPolicesDesign, fichiersDuPoste } from "../polices";
import { enregistrerMaintenant, miniatureMaintenant } from "./enregistrement";
import { useEditeur } from "./editeur";

const erreur = (texte: string, e: unknown) => useEditeur.getState().notifier(`${texte} : ${String(e instanceof Error ? e.message : e)}`, { erreur: true });

/** Ouvre un design dans l'éditeur, après avoir enregistré celui qu'on quitte. */
export async function ouvrirDesign(ref: RefProjet): Promise<boolean> {
  try {
    await enregistrerMaintenant();
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
  const ids = [...new Set(pressePapiers.elements.flatMap((e) => (e.type === "image" || e.type === "video" ? [e.ressource] : (e.type === "cadre" || e.type === "maquette") && e.ressource ? [e.ressource] : [])))];
  if (projet && source && ids.length && (source.rayon !== projet.rayon || source.id !== projet.id)) {
    try {
      etat.ajouterRessources(await pont.copierRessources(source, projet, ids));
    } catch (e) {
      erreur("Images non copiées", e);
    }
  }
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
