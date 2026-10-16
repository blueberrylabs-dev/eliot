// La perspective dans la fenêtre (étape 5, lot 6) : un shader WebGL 2 pose le visuel à plat sur
// ses quatre coins, avec les formules de `noyau/src/perspective.rs` (homographie inverse et sa
// dérivée exacte, bord lissé sur un pixel, coins arrondis et bordure du visuel à plat, source lue
// en trilinéaire dans ses mipmaps). L'export ne passe pas par ici : l'enregistrement de la page
// (`contexteSvg.ts`) transmet la perspective au noyau, qui la refait depuis l'original.
//
// Une photo garde son rendu tant que rien ne change (sa toile, ses coins, sa taille à l'écran) ;
// l'image d'un clip passe au shader au moment où la page la dessine, sans copie (règle 11).

import { composer, inverser, planPerspective, type Homographie, type Perspective, type PerspectiveCalque, boiteDuVisuel } from "../modele/perspective";
import { matriceRognage, type Rognage } from "../modele/rognage";

const SOMMETS = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const PIXELS = `#version 300 es
precision highp float;
uniform sampler2D u_source;
uniform vec3 u_m0, u_m1, u_m2;
uniform vec2 u_taille;
uniform vec3 u_srcU, u_srcV;
uniform vec2 u_plat;
uniform float u_arrondi, u_demi;
uniform vec3 u_bord;
uniform vec2 u_tailleSource;
uniform float u_niveaux;
out vec4 sortie;
float distanceRectangleArrondi(vec2 p, vec2 t, float r) {
  float rr = max(0.0, min(r, min(t.x / 2.0, t.y / 2.0)));
  vec2 q = abs(p - t / 2.0) - (t / 2.0 - rr);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rr;
}
void main() {
  vec3 p = vec3(gl_FragCoord.x, u_taille.y - gl_FragCoord.y, 1.0);
  float u = dot(u_m0, p);
  float v = dot(u_m1, p);
  float w = dot(u_m2, p);
  float w2 = w * w;
  vec2 f = vec2(u, v) / w;
  vec2 fx = vec2(u_m0.x * w - u * u_m2.x, u_m1.x * w - v * u_m2.x) / w2;
  vec2 fy = vec2(u_m0.y * w - u * u_m2.y, u_m1.y * w - v * u_m2.y) / w2;
  float lg = max(0.5 * (length(fx * u_plat) + length(fy * u_plat)), 1e-9);
  float s = distanceRectangleArrondi(f * u_plat, u_plat, u_arrondi);
  float couverture = clamp(0.5 - (s - u_demi) / lg, 0.0, 1.0);
  if (couverture <= 0.0) { sortie = vec4(0.0); return; }
  vec2 src = vec2(dot(u_srcU, vec3(f, 1.0)), dot(u_srcV, vec3(f, 1.0)));
  vec2 dsx = vec2(dot(u_srcU.xy, fx), dot(u_srcV.xy, fx)) * u_tailleSource;
  vec2 dsy = vec2(dot(u_srcU.xy, fy), dot(u_srcV.xy, fy)) * u_tailleSource;
  float lod = clamp(log2(max(max(length(dsx), length(dsy)), 1e-9)), 0.0, u_niveaux);
  vec4 c = textureLod(u_source, src, lod);
  if (u_demi > 0.0) c = mix(c, vec4(u_bord, 1.0), clamp(0.5 + (s + u_demi) / lg, 0.0, 1.0));
  sortie = c * couverture;
}`;

/** Le visuel à plat vers l'image entière (fractions de sa largeur et de sa hauteur) : le
 *  recadrage, inversé. */
export function sourcePlate(rognage: Rognage | undefined, W: number, H: number): [number, number, number, number, number, number] {
  // Des pixels de l'image vers le cadre gardé (carré unité), puis des fractions vers les pixels.
  const m = matriceRognage(rognage, W, H, 1, 1);
  const a = [m[0] * W, m[1] * W, m[2] * H, m[3] * H, m[4], m[5]];
  const det = a[0] * a[3] - a[1] * a[2] || 1e-12;
  return [a[3] / det, -a[1] / det, -a[2] / det, a[0] / det, (a[2] * a[5] - a[3] * a[4]) / det, (a[1] * a[4] - a[0] * a[5]) / det];
}

/** Le calque de perspective d'un élément dans sa boîte `w` × `h` (repère de la boîte). */
export function calquePerspective(p: Perspective, rognage: Rognage | undefined, W: number, H: number, w: number, h: number, arrondi: number, bordure?: { couleur: string; epaisseur: number }): PerspectiveCalque | null {
  const plan = planPerspective(p, w, h);
  if (!plan) return null;
  return { plan: plan.plan, source: sourcePlate(rognage, W, H), plat: plan.plat, arrondi: Math.max(0, arrondi), ...(bordure && bordure.epaisseur > 0 ? { bordure } : {}) };
}

function couleurRvb(c: string): [number, number, number] {
  const t = c.replace("#", "");
  const v = (i: number) => (parseInt(t.slice(i, i + 2), 16) || 0) / 255;
  return [v(0), v(2), v(4)];
}

export class MoteurPerspective {
  readonly toile: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly prog: WebGLProgram;
  private readonly texture: WebGLTexture;
  private readonly u = new Map<string, WebGLUniformLocation | null>();
  private chargee: unknown = null;
  private niveaux = 0;

  constructor() {
    this.toile = document.createElement("canvas");
    const gl = this.toile.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: true, alpha: true });
    if (!gl) throw new Error("WebGL 2 indisponible dans ce moteur web");
    this.gl = gl;
    const compiler = (type: number, code: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, code);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`shader de la perspective : ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compiler(gl.VERTEX_SHADER, SOMMETS));
    gl.attachShader(prog, compiler(gl.FRAGMENT_SHADER, PIXELS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`programme de la perspective : ${gl.getProgramInfoLog(prog)}`);
    this.prog = prog;
    for (const nom of ["u_source", "u_m0", "u_m1", "u_m2", "u_taille", "u_srcU", "u_srcV", "u_plat", "u_arrondi", "u_demi", "u_bord", "u_tailleSource", "u_niveaux"]) this.u.set(nom, gl.getUniformLocation(prog, nom));
    const tampon = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tampon);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  /** Charge la source (et ses mipmaps) si elle a changé ; `toujours` : une vidéo, dont l'image
   *  change sans que l'objet change. */
  private charger(source: TexImageSource, cle: unknown, toujours: boolean, l: number, h: number): void {
    if (!toujours && this.chargee === cle) return;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    // Prémultipliée : une source transparente ne bave pas sur ses voisins (comme le noyau).
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.niveaux = Math.floor(Math.log2(Math.max(l, h, 1)));
    this.chargee = cle;
  }

  /**
   * Dessine dans `this.toile` (`largeur` × `hauteur` pixels) le visuel `p` (repère de la boîte de
   * l'élément), vu à `echelle` pixels de sortie par pixel de la boîte, sa boîte `boite` en haut à
   * gauche. `l` × `h` : la taille de la source.
   */
  dessiner(source: TexImageSource, cle: unknown, toujours: boolean, l: number, h: number, p: PerspectiveCalque, boite: [number, number, number, number], echelle: number, largeur: number, hauteur: number): boolean {
    const inv = inverser(p.plan);
    if (!inv) return false;
    const gl = this.gl;
    if (this.toile.width !== largeur || this.toile.height !== hauteur) {
      this.toile.width = largeur;
      this.toile.height = hauteur;
    }
    gl.viewport(0, 0, largeur, hauteur);
    gl.useProgram(this.prog);
    this.charger(source, cle, toujours, l, h);
    // Du pixel de sortie à la boîte de l'élément, puis au visuel à plat.
    const versBoite: Homographie = [1 / echelle, 0, boite[0], 0, 1 / echelle, boite[1], 0, 0, 1];
    const m = composer(inv, versBoite);
    const u = (nom: string) => this.u.get(nom)!;
    gl.uniform1i(u("u_source"), 0);
    gl.uniform3f(u("u_m0"), m[0], m[1], m[2]);
    gl.uniform3f(u("u_m1"), m[3], m[4], m[5]);
    gl.uniform3f(u("u_m2"), m[6], m[7], m[8]);
    gl.uniform2f(u("u_taille"), largeur, hauteur);
    gl.uniform3f(u("u_srcU"), p.source[0], p.source[2], p.source[4]);
    gl.uniform3f(u("u_srcV"), p.source[1], p.source[3], p.source[5]);
    gl.uniform2f(u("u_plat"), p.plat[0], p.plat[1]);
    gl.uniform1f(u("u_arrondi"), p.arrondi);
    gl.uniform1f(u("u_demi"), p.bordure ? Math.max(0, p.bordure.epaisseur) / 2 : 0);
    gl.uniform3fv(u("u_bord"), p.bordure ? couleurRvb(p.bordure.couleur) : [0, 0, 0]);
    gl.uniform2f(u("u_tailleSource"), l, h);
    gl.uniform1f(u("u_niveaux"), this.niveaux);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return true;
  }
}

let moteur: MoteurPerspective | null | undefined;

/** Le moteur de la perspective, créé au premier besoin ; `null` sans WebGL 2. */
export function moteurPerspective(): MoteurPerspective | null {
  if (moteur === undefined) {
    try {
      moteur = new MoteurPerspective();
    } catch (e) {
      console.warn(String(e));
      moteur = null;
    }
  }
  return moteur;
}

/** Les rendus gardés des photos en perspective (un par élément), tant que rien ne change. */
const gardes = new Map<string, { cle: string; toile: HTMLCanvasElement }>();
const identites = new WeakMap<object, number>();
let prochaine = 1;
const identite = (o: object) => {
  let i = identites.get(o);
  if (!i) {
    i = prochaine++;
    identites.set(o, i);
  }
  return i;
};

/** Le plus grand côté d'un rendu de perspective à l'écran. */
const COTE_MAX = 4096;

interface Contexte2D {
  drawImage(...a: unknown[]): void;
}

/**
 * Dessine une photo ou l'image d'un clip en perspective dans `ctx` (le repère de la boîte de
 * l'élément, `w` × `h`). L'enregistrement de la page reçoit la perspective telle quelle (le
 * noyau la refait depuis l'original) ; à l'écran, le shader la dessine à la taille où la page
 * la montre (`echelle` : pixels d'écran par pixel de la boîte). `version` : change quand la
 * toile d'une photo est redessinée ; `null` pour l'image d'un clip (toujours rechargée).
 */
export function dessinerEnPerspective(ctx: Contexte2D, id: string, image: CanvasImageSource, calque: PerspectiveCalque, echelle: number, version: number | null): boolean {
  const enregistrement = (ctx as unknown as { _context?: { poserEnPerspective?: (s: unknown, p: PerspectiveCalque) => void } })._context;
  if (enregistrement?.poserEnPerspective) {
    enregistrement.poserEnPerspective(image, calque);
    return true;
  }
  const m = moteurPerspective();
  if (!m) return false;
  const s = image as { naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number; width?: number; height?: number };
  const l = s.naturalWidth || s.videoWidth || s.width || 0;
  const h = s.naturalHeight || s.videoHeight || s.height || 0;
  if (!l || !h) return false;
  const boite = boiteDuVisuel(calque);
  const bl = boite[2] - boite[0];
  const bh = boite[3] - boite[1];
  const e = Math.max(0.05, Math.min(echelle, COTE_MAX / Math.max(bl, bh, 1)));
  const largeur = Math.max(1, Math.ceil(bl * e));
  const hauteur = Math.max(1, Math.ceil(bh * e));
  if (version === null) {
    if (!m.dessiner(image as TexImageSource, image, true, l, h, calque, boite, e, largeur, hauteur)) return false;
    ctx.drawImage(m.toile, boite[0], boite[1], largeur / e, hauteur / e);
    return true;
  }
  const source = `${id}|${identite(image as object)}|${version}`;
  const cle = `${source}|${JSON.stringify(calque)}|${largeur}x${hauteur}`;
  let g = gardes.get(id);
  if (!g || g.cle !== cle) {
    if (!m.dessiner(image as TexImageSource, source, false, l, h, calque, boite, e, largeur, hauteur)) return false;
    const toile = g?.toile ?? document.createElement("canvas");
    toile.width = largeur;
    toile.height = hauteur;
    const c = toile.getContext("2d")!;
    c.clearRect(0, 0, largeur, hauteur);
    c.drawImage(m.toile, 0, 0);
    g = { cle, toile };
    gardes.set(id, g);
  }
  ctx.drawImage(g.toile, boite[0], boite[1], largeur / e, hauteur / e);
  return true;
}
