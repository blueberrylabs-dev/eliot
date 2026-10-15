// Le nettoyage d'une voix (étape 4, lot 6), en fonctions pures : les réglages bornés comme le
// noyau les borne (`noyau/src/voix.rs`), le réglage prêt « Voix nette », et ce qu'un clip
// demande d'écouter.

import type { ClipAudio, NettoyageVoix } from "./types";

/** Le réglage prêt « Voix nette » : le même que `voix_nette()` du noyau. */
export const VOIX_NETTE: NettoyageVoix = { bruit: 0.85, graves: true, chaleur: 1.5, presence: 3, compresseur: 0.5, deesseur: 0.4, niveau: true };

/** Le niveau visé par « niveau de la voix ». */
export const CIBLE_VOIX = -16;

const fini = (v: number | undefined): v is number => v !== undefined && Number.isFinite(v);
const part = (v: number | undefined) => {
  if (!fini(v)) return undefined;
  const x = Math.round(Math.max(0, Math.min(1, v)) * 100) / 100;
  return x === 0 ? undefined : x;
};
const db = (v: number | undefined) => {
  if (!fini(v)) return undefined;
  const x = Math.round(Math.max(-6, Math.min(6, v)) * 10) / 10;
  return x === 0 ? undefined : x;
};

/** Les réglages dans leurs bornes ; ce qui ne fait rien disparaît (comme `borne()` du noyau). */
export function borneNettoyage(n: NettoyageVoix | undefined): NettoyageVoix {
  if (!n) return {};
  const b: NettoyageVoix = {
    bruit: part(n.bruit),
    graves: n.graves ? true : undefined,
    chaleur: db(n.chaleur),
    presence: db(n.presence),
    compresseur: part(n.compresseur),
    deesseur: part(n.deesseur),
    niveau: n.niveau ? true : undefined,
  };
  return Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)) as NettoyageVoix;
}

/** Les réglages font-ils quelque chose ? */
export const nettoyageActif = (n: NettoyageVoix | undefined): boolean => Object.keys(borneNettoyage(n)).length > 0;

/** Une clé pour reconnaître des réglages identiques une fois bornés. */
export const cleNettoyage = (n: NettoyageVoix | undefined): string => JSON.stringify(borneNettoyage(n), ["bruit", "graves", "chaleur", "presence", "compresseur", "deesseur", "niveau"]);

/** Les réglages sont-ils exactement « Voix nette » ? */
export const estVoixNette = (n: NettoyageVoix | undefined): boolean => cleNettoyage(n) === cleNettoyage(VOIX_NETTE);

/** Ce qu'un clip fait jouer : la ressource, et les réglages du nettoyage s'il y en a. */
export function sourceDuClip(c: Pick<ClipAudio, "ressource" | "nettoyage">): { ressource: string; nettoyage?: NettoyageVoix; cle: string } {
  if (!nettoyageActif(c.nettoyage)) return { ressource: c.ressource, cle: c.ressource };
  const n = borneNettoyage(c.nettoyage);
  return { ressource: c.ressource, nettoyage: n, cle: `${c.ressource}|${cleNettoyage(n)}` };
}

/** Les libellés des réglages, dans l'ordre de la chaîne. */
export const REGLAGES_NETTOYAGE: { cle: keyof NettoyageVoix; libelle: string; aide: string }[] = [
  { cle: "bruit", libelle: "Réduction du bruit", aide: "Le bruit de fond (pièce, souffle, ventilation) baisse ; la voix reste." },
  { cle: "graves", libelle: "Couper les graves (sous 80 Hz)", aide: "Retire la rumeur, les chocs sur le micro et le ronflement." },
  { cle: "chaleur", libelle: "Chaleur", aide: "Plus de corps (vers 180 Hz) ; en moins, une voix moins sourde." },
  { cle: "presence", libelle: "Présence", aide: "Plus de clarté (vers 4,5 kHz) : la voix passe devant." },
  { cle: "compresseur", libelle: "Compresseur", aide: "Rapproche les passages forts et faibles : la voix reste égale." },
  { cle: "deesseur", libelle: "Dé-esseur", aide: "Adoucit les « s » et les « ch » qui sifflent." },
  { cle: "niveau", libelle: "Caler le niveau (−16 LUFS)", aide: "Le niveau courant d'une voix : au-dessus d'une musique baissée sous elle." },
];
