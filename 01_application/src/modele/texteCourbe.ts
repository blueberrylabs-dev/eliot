// Le texte courbé et les listes (étape 7, lot 2), en fonctions pures : la géométrie d'un texte
// posé sur un arc de cercle, et la disposition d'une liste à puces ou numérotée. Les mesures des
// lettres (largeur d'une ligne, hauteur d'un paragraphe) viennent de l'appelant, qui les prend à
// Konva : ces fonctions se testent sans toile.

/** Courbe, de -100 à 100 : positive, le texte s'arrondit vers le haut (en arche) ; négative,
 *  vers le bas (en sourire). À 100, il fait presque le tour du cercle. */
export const COURBE_MAX = 100;
/** L'angle que le texte couvre à 100, en radians (un peu moins d'un tour, pour que la fin ne
 *  touche pas le début). */
const ANGLE_MAX = 2 * Math.PI * 0.95;
/** Au-dessus et au-dessous de la ligne de base, en part de la taille des lettres. */
const MONTANTE = 0.95;
const DESCENDANTE = 0.3;

export interface GeometrieCourbe {
  /** La boîte du texte courbé, en pixels de la page. */
  largeur: number;
  hauteur: number;
  /** Le rayon de la ligne de base. */
  rayon: number;
  /** L'arc de la ligne de base, en données de tracé SVG, dans le repère de la boîte. */
  chemin: string;
}

export const bornerCourbe = (c: number) => Math.max(-COURBE_MAX, Math.min(COURBE_MAX, Math.round(c)));

/** Le texte est-il courbé ? (une courbe de moins de 1 reste droite). */
export const estCourbe = (courbe: number | undefined): courbe is number => courbe !== undefined && Math.abs(courbe) >= 1;

/**
 * La géométrie d'une ligne de texte de `longueur` pixels (sa largeur droite, espacement compris)
 * et de `taille` pixels, posée sur un arc : la longueur de l'arc vaut celle du texte, l'angle
 * suit la courbe. Les lettres se tiennent sur l'arc (ligne de base), tournées vers l'extérieur
 * en arche, vers le centre en sourire. `null` si le texte est droit.
 */
export function geometrieCourbe(longueur: number, taille: number, courbe: number | undefined): GeometrieCourbe | null {
  if (!estCourbe(courbe)) return null;
  const c = bornerCourbe(courbe);
  const angle = (Math.abs(c) / COURBE_MAX) * ANGLE_MAX;
  const montante = taille * MONTANTE;
  const descendante = taille * DESCENDANTE;
  // Assez grand pour que les lettres ne se rejoignent pas au centre d'un sourire serré.
  const rayon = Math.max(Math.max(1, longueur) / angle, montante * 1.2);
  const arche = c > 0;
  // En arche : le haut du cercle, de gauche à droite (sens des aiguilles d'une montre, y vers le
  // bas) ; en sourire : le bas du cercle, de gauche à droite aussi (sens inverse).
  const a0 = arche ? -Math.PI / 2 - angle / 2 : Math.PI / 2 + angle / 2;
  const a1 = arche ? -Math.PI / 2 + angle / 2 : Math.PI / 2 - angle / 2;
  const [rIn, rOut] = arche ? [rayon - descendante, rayon + montante] : [rayon - montante, rayon + descendante];
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  const pas = 96;
  for (let i = 0; i <= pas; i++) {
    const a = a0 + ((a1 - a0) * i) / pas;
    for (const r of [rIn, rOut]) {
      const x = r * Math.cos(a);
      const y = r * Math.sin(a);
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  const [cx, cy] = [-x0, -y0];
  const point = (a: number) => `${(cx + rayon * Math.cos(a)).toFixed(2)} ${(cy + rayon * Math.sin(a)).toFixed(2)}`;
  const grand = angle > Math.PI ? 1 : 0;
  const sens = arche ? 1 : 0;
  return {
    largeur: Math.ceil(x1 - x0),
    hauteur: Math.ceil(y1 - y0),
    rayon,
    chemin: `M ${point(a0)} A ${rayon.toFixed(2)} ${rayon.toFixed(2)} 0 ${grand} ${sens} ${point(a1)}`,
  };
}

export type GenreListe = "puces" | "numeros";

/** La marque d'un élément de liste (le `rang`-ième, à partir de 0). */
export const marqueListe = (genre: GenreListe, rang: number) => (genre === "puces" ? "•" : `${rang + 1}.`);

/** Les paragraphes d'une liste : un élément par ligne du texte saisi. */
export const paragraphesListe = (texte: string) => texte.split("\n");

/**
 * La disposition d'une liste : chaque paragraphe à sa hauteur (mesurée à la largeur qui lui
 * reste), les uns sous les autres, la marque dans le retrait. Renvoie le haut de chacun et la
 * hauteur totale.
 */
export function dispositionListe(hauteurs: readonly number[]): { hauts: number[]; hauteur: number } {
  const hauts: number[] = [];
  let y = 0;
  for (const h of hauteurs) {
    hauts.push(y);
    y += h;
  }
  return { hauts, hauteur: y };
}

/** Le retrait des lignes d'une liste : la marque la plus large, plus un demi-cadratin. */
export const retraitListe = (largeurMarqueMax: number, taille: number) => Math.ceil(largeurMarqueMax + taille * 0.5);

/** La boîte d'un texte qui change de taille en gardant son centre, malgré sa rotation (degrés). */
export function garderCentre(avant: { x: number; y: number; largeur: number; hauteur: number; rotation: number }, largeur: number, hauteur: number): { x: number; y: number } {
  const r = (avant.rotation * Math.PI) / 180;
  const [cos, sin] = [Math.cos(r), Math.sin(r)];
  // Le centre, dans la page : le coin, plus la demi-boîte tournée.
  const cx = avant.x + (avant.largeur / 2) * cos - (avant.hauteur / 2) * sin;
  const cy = avant.y + (avant.largeur / 2) * sin + (avant.hauteur / 2) * cos;
  return { x: Math.round(cx - (largeur / 2) * cos + (hauteur / 2) * sin), y: Math.round(cy - (largeur / 2) * sin - (hauteur / 2) * cos) };
}
