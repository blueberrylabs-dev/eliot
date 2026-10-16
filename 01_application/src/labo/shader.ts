// L'aperçu en direct du labo photo (étape 5, lot 2), dans un shader WebGL 2 : les réglages qui
// ne regardent qu'un pixel (balance des blancs, exposition, tonalités, couleurs, mélangeur,
// vignetage, grain), avec les formules de `noyau/src/labo.rs`, ligne pour ligne. Le tableau
// commun `modele/labo.attendus.json` les contrôle (essai dans Chromium et dans Tauri).
//
// Les réglages qui regardent les voisins (bruit, netteté, texture, clarté, voile) viennent du
// noyau : une « base », l'aperçu retouché sans vignetage ni grain. Le shader la complète :
// base + (réglages d'un pixel d'aujourd'hui − ceux de la base), puis vignetage et grain. Au
// repos les deux réglages se confondent et l'image est celle du noyau ; pendant qu'on tire un
// curseur, l'écart suit en direct.

import { COULEURS_MELANGEUR, type ReglagesPhoto } from "../modele/labo";

const SOMMETS = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const PIXELS = `#version 300 es
precision highp float;
precision highp int;
struct Reglages {
  vec3 gains;
  float contraste, hl, ombres, blancs, noirs, sat, vib;
  bool melange;
  vec3 melangeur[8];
};
uniform sampler2D u_source;
uniform sampler2D u_base;
uniform bool u_avecBase;
uniform Reglages u_cur;
uniform Reglages u_ref;
uniform vec2 u_taille;
uniform float u_vignetage, u_grain, u_echelleGrain;
out vec4 sortie;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const float CENTRES[8] = float[8](0.0, 30.0, 60.0, 120.0, 180.0, 240.0, 270.0, 300.0);
float versLin(float c) { return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4); }
float versSrgb(float l) { l = clamp(l, 0.0, 1.0); return l <= 0.0031308 ? 12.92 * l : 1.055 * pow(l, 1.0 / 2.4) - 0.055; }
vec3 lin3(vec3 c) { return vec3(versLin(c.r), versLin(c.g), versLin(c.b)); }
uint hachage(uint x, uint y) { uint h = x * 374761393u + y * 668265263u; h = (h ^ (h >> 13u)) * 1274126177u; return h ^ (h >> 16u); }
float noeud(uint x, uint y) { return float(hachage(x, y) & 0xffffu) / 65535.0 - 0.5; }
float bruitValeur(float gx, float gy) {
  float x0 = floor(gx), y0 = floor(gy);
  float fx = gx - x0, fy = gy - y0;
  uint ix = uint(max(x0, 0.0)), iy = uint(max(y0, 0.0));
  float haut = noeud(ix, iy) * (1.0 - fx) + noeud(ix + 1u, iy) * fx;
  float bas = noeud(ix, iy + 1u) * (1.0 - fx) + noeud(ix + 1u, iy + 1u) * fx;
  return haut * (1.0 - fy) + bas * fy;
}
vec3 reglagesPixel(vec3 c, Reglages r) {
  vec3 l = c * r.gains;
  float y0 = dot(l, LUMA);
  if (y0 > 1e-6) {
    float p = pow(y0, 1.0 / 2.2);
    float f = r.contraste >= 0.0 ? 1.0 + r.contraste / 100.0 * 0.8 : 1.0 + r.contraste / 100.0 * 0.6;
    p = 0.5 + (p - 0.5) * f;
    p += 0.3 * r.hl / 100.0 * smoothstep(0.5, 1.0, p) + 0.3 * r.ombres / 100.0 * (1.0 - smoothstep(0.0, 0.5, p))
       + 0.2 * r.blancs / 100.0 * smoothstep(0.7, 1.0, p) + 0.2 * r.noirs / 100.0 * (1.0 - smoothstep(0.0, 0.3, p));
    l *= pow(max(p, 0.0), 2.2) / y0;
  }
  float y1 = dot(l, LUMA);
  float haut = max(l.r, max(l.g, l.b));
  float bas = min(l.r, min(l.g, l.b));
  float chroma = haut > 1e-6 ? (haut - bas) / haut : 0.0;
  float k = (1.0 + r.sat / 100.0) * (1.0 + r.vib / 100.0 * (1.0 - chroma));
  l = y1 + (l - y1) * k;
  if (r.melange && chroma > 0.0) {
    float h2 = max(l.r, max(l.g, l.b));
    float d = h2 - min(l.r, min(l.g, l.b));
    float h;
    if (d <= 1e-9) h = 0.0;
    else if (h2 == l.r) h = 60.0 * ((l.g - l.b) / d);
    else if (h2 == l.g) h = 60.0 * ((l.b - l.r) / d + 2.0);
    else h = 60.0 * ((l.r - l.g) / d + 4.0);
    if (h < 0.0) h += 360.0;
    int i = 7;
    for (int j = 0; j < 7; j++) { if (h < CENTRES[j + 1]) { i = j; break; } }
    int s = (i + 1) % 8;
    float fin = i == 7 ? 360.0 : CENTRES[i + 1];
    float t = (h - CENTRES[i]) / (fin - CENTRES[i]);
    vec3 m = r.melangeur[i] * (1.0 - t) + r.melangeur[s] * t;
    float a = radians(m.x / 100.0 * 30.0);
    float sn = sin(a), co = cos(a);
    float un = (1.0 - co) / 3.0, rac = sn / sqrt(3.0);
    vec3 v0 = l;
    l = vec3(dot(vec3(co + un, un - rac, un + rac), v0), dot(vec3(un + rac, co + un, un - rac), v0), dot(vec3(un - rac, un + rac, co + un), v0));
    float y2 = dot(l, LUMA);
    float ks = 1.0 + m.y / 100.0 * chroma;
    float kl = exp2(m.z / 100.0 * chroma);
    l = (y2 + (l - y2) * ks) * kl;
  }
  return max(l, vec3(0.0));
}
void main() {
  int px = int(gl_FragCoord.x);
  int py = int(u_taille.y) - 1 - int(gl_FragCoord.y);
  vec4 s = texelFetch(u_source, ivec2(px, py), 0);
  vec3 c = lin3(s.rgb);
  vec3 l = reglagesPixel(c, u_cur);
  if (u_avecBase) {
    vec3 b = lin3(texelFetch(u_base, ivec2(px, py), 0).rgb);
    l = max(b + (l - reglagesPixel(c, u_ref)), vec3(0.0));
  }
  if (u_vignetage != 0.0) {
    vec2 uv = vec2((float(px) + 0.5) / u_taille.x * 2.0 - 1.0, (float(py) + 0.5) / u_taille.y * 2.0 - 1.0);
    float dd = sqrt((uv.x * uv.x + uv.y * uv.y) / 2.0);
    l *= exp2(u_vignetage / 100.0 * 1.5 * smoothstep(0.35, 1.0, dd));
  }
  if (u_grain != 0.0) {
    float gx = (float(px) + 0.5) * u_echelleGrain - 0.5;
    float gy = (float(py) + 0.5) * u_echelleGrain - 0.5;
    l *= 1.0 + u_grain / 100.0 * 0.25 * bruitValeur(gx, gy) * 2.0;
  }
  sortie = vec4(versSrgb(l.r), versSrgb(l.g), versSrgb(l.b), s.a);
}`;

/** Des pixels RGBA bruts (la base du noyau). */
export interface PixelsBruts {
  pixels: Uint8Array;
  largeur: number;
  hauteur: number;
}

const CHAMPS = ["gains", "contraste", "hl", "ombres", "blancs", "noirs", "sat", "vib", "melange", "melangeur"] as const;

/** Le moteur : un seul contexte WebGL 2 pour toutes les photos (un moteur web en accorde peu). */
export class MoteurLabo {
  readonly toile: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly prog: WebGLProgram;
  private readonly texSource: WebGLTexture;
  private readonly texBase: WebGLTexture;
  private readonly u = new Map<string, WebGLUniformLocation | null>();
  private sourceChargee: unknown = null;
  private baseChargee: unknown = null;

  constructor() {
    this.toile = document.createElement("canvas");
    // Le dessin doit rester lisible après l'image : on le recopie quand on veut.
    const gl = this.toile.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false, alpha: true });
    if (!gl) throw new Error("WebGL 2 indisponible dans ce moteur web");
    this.gl = gl;
    const compiler = (type: number, code: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, code);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`shader du labo : ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compiler(gl.VERTEX_SHADER, SOMMETS));
    gl.attachShader(prog, compiler(gl.FRAGMENT_SHADER, PIXELS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`programme du labo : ${gl.getProgramInfoLog(prog)}`);
    this.prog = prog;
    const noms = ["u_source", "u_base", "u_avecBase", "u_taille", "u_vignetage", "u_grain", "u_echelleGrain"];
    for (const ensemble of ["u_cur", "u_ref"]) for (const champ of CHAMPS) noms.push(champ === "melangeur" ? `${ensemble}.melangeur[0]` : `${ensemble}.${champ}`);
    for (const nom of noms) this.u.set(nom, gl.getUniformLocation(prog, nom));
    const texture = () => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      return t;
    };
    this.texSource = texture();
    this.texBase = texture();
    // Une base d'un pixel tant qu'il n'y en a pas : une texture vide ferait protester WebGL.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  }

  private charger(texture: WebGLTexture, unite: number, source: TexImageSource | PixelsBruts): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unite);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    if ("pixels" in source) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, source.largeur, source.hauteur, 0, gl.RGBA, gl.UNSIGNED_BYTE, source.pixels);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  private reglages(ensemble: "u_cur" | "u_ref", r: ReglagesPhoto): void {
    const gl = this.gl;
    const u = (champ: string) => this.u.get(`${ensemble}.${champ}`) ?? null;
    const kt = ((r.temperature ?? 0) / 100) * 0.5;
    const ku = ((r.teinte ?? 0) / 100) * 0.3;
    const e = 2 ** (r.exposition ?? 0);
    gl.uniform3f(u("gains"), 2 ** kt * e, 2 ** -ku * e, 2 ** -kt * e);
    gl.uniform1f(u("contraste"), r.contraste ?? 0);
    gl.uniform1f(u("hl"), r.hautesLumieres ?? 0);
    gl.uniform1f(u("ombres"), r.ombres ?? 0);
    gl.uniform1f(u("blancs"), r.blancs ?? 0);
    gl.uniform1f(u("noirs"), r.noirs ?? 0);
    gl.uniform1f(u("sat"), r.saturation ?? 0);
    gl.uniform1f(u("vib"), r.vibrance ?? 0);
    const m = COULEURS_MELANGEUR.flatMap((c) => [r.melangeur?.[c]?.teinte ?? 0, r.melangeur?.[c]?.saturation ?? 0, r.melangeur?.[c]?.luminance ?? 0]);
    gl.uniform1i(u("melange"), m.some((v) => v !== 0) ? 1 : 0);
    gl.uniform3fv(u("melangeur[0]"), new Float32Array(m));
  }

  /**
   * Dessine la photo retouchée dans `this.toile`, à la taille de la source. `base` : l'aperçu
   * retouché par le noyau (réglages voisins compris, sans vignetage ni grain) et les réglages
   * avec lesquels il l'a été.
   */
  dessiner(source: TexImageSource | PixelsBruts, largeur: number, hauteur: number, r: ReglagesPhoto, base?: { image: PixelsBruts; reglages: ReglagesPhoto }): void {
    const gl = this.gl;
    if (this.toile.width !== largeur || this.toile.height !== hauteur) {
      this.toile.width = largeur;
      this.toile.height = hauteur;
    }
    gl.viewport(0, 0, largeur, hauteur);
    gl.useProgram(this.prog);
    if (this.sourceChargee !== source) {
      this.charger(this.texSource, 0, source);
      this.sourceChargee = source;
    }
    const avecBase = !!base && base.image.largeur === largeur && base.image.hauteur === hauteur;
    if (avecBase && this.baseChargee !== base!.image) {
      this.charger(this.texBase, 1, base!.image);
      this.baseChargee = base!.image;
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texSource);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.texBase);
    gl.uniform1i(this.u.get("u_source")!, 0);
    gl.uniform1i(this.u.get("u_base")!, 1);
    gl.uniform1i(this.u.get("u_avecBase")!, avecBase ? 1 : 0);
    this.reglages("u_cur", r);
    this.reglages("u_ref", avecBase ? base!.reglages : r);
    gl.uniform2f(this.u.get("u_taille")!, largeur, hauteur);
    gl.uniform1f(this.u.get("u_vignetage")!, r.vignetage ?? 0);
    gl.uniform1f(this.u.get("u_grain")!, r.grain ?? 0);
    gl.uniform1f(this.u.get("u_echelleGrain")!, 2560 / Math.max(largeur, hauteur, 1));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Des pixels bruts, retouchés (essais : le tableau commun). */
  dessinerPixels(source: PixelsBruts, r: ReglagesPhoto): void {
    this.dessiner(source, source.largeur, source.hauteur, r);
  }

  /** Les pixels dessinés, en RGBA, de haut en bas (essais). */
  lire(): Uint8Array {
    const gl = this.gl;
    const { width: l, height: h } = this.toile;
    const brut = new Uint8Array(l * h * 4);
    gl.readPixels(0, 0, l, h, gl.RGBA, gl.UNSIGNED_BYTE, brut);
    // WebGL lit de bas en haut.
    const sortie = new Uint8Array(brut.length);
    for (let y = 0; y < h; y++) sortie.set(brut.subarray((h - 1 - y) * l * 4, (h - y) * l * 4), y * l * 4);
    return sortie;
  }

  /** Oublie la source et la base chargées (une autre photo arrive). */
  oublier(): void {
    this.sourceChargee = null;
    this.baseChargee = null;
  }
}

let moteur: MoteurLabo | null | undefined;

/** Le moteur partagé, créé au premier besoin ; `null` si le moteur web n'a pas WebGL 2. */
export function moteurLabo(): MoteurLabo | null {
  if (moteur === undefined) {
    try {
      moteur = new MoteurLabo();
    } catch (e) {
      console.warn(String(e));
      moteur = null;
    }
  }
  return moteur;
}
