// Types de la fabrique des personnages, pour les tests de l'interface (`personnages.test.ts`).

export interface NoeudSvg {
  balise: string;
  attributs: Record<string, string>;
  enfants: NoeudSvg[];
}

export function lireZip(octets: Buffer): { noms: string[]; lire(nom: string): Buffer };
export function analyserSvg(source: string): NoeudSvg;
export function matrice(transform: string | undefined): number[];
export function pointsTrace(d: string): [number, number][];
export function boiteSvg(svg: NoeudSvg): [number, number, number, number];
export function zoneSvg(svg: NoeudSvg): [number, number, number, number];
export function hexNormalise(c: string): string;
export function contenuSvg(svg: NoeudSvg, options?: { prefixe?: string; decimales?: number; marquer?: boolean; emplacement?: string }): string;
export function preparerPersonnages(sortie: string, dossier: string): Promise<{ collections: string[]; personnages: number; pieces: number; absentes: string[] }>;
