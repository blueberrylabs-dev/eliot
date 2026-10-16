// Étape 5, lot 0 : l'aperçu en direct du labo photo. Deux voies à départager (BRIEF § 6) :
// - le Rust recalcule à chaque mouvement du curseur une copie à la taille de l'écran et renvoie
//   les pixels bruts par l'IPC binaire de Tauri (`labo.rs`) ;
// - un shader WebGL fait le même calcul dans la fenêtre, sur la carte graphique.
// On imite un curseur qu'on tire sans arrêt pendant 5 s (exposition, contraste, température,
// hautes lumières, ombres, vibrance qui bougent ensemble ; mélangeur, vignetage et grain posés),
// et on mesure ce que voit l'œil : images par seconde, temps entre le curseur et l'image.
// Puis l'écart entre les deux rendus sur les mêmes pixels, et le coût des réglages qui
// regardent les pixels voisins (calculés par le Rust au relâchement du curseur).

import Konva from "konva";
import { invoke } from "@tauri-apps/api/core";
import { PAGE } from "./scene";
import { centile, juger, mediane, mesurerAnimation } from "./mesure";
import type { Contexte, Resultat, Scenario } from "./scenarios";

const DUREE_MS = 5000;
const PHOTO = "/donnees/photo_apercu_2560.jpg";
const arrondi = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

export interface Reglages {
  exposition: number;
  contraste: number;
  hautesLumieres: number;
  ombres: number;
  blancs: number;
  noirs: number;
  temperature: number;
  teinte: number;
  vibrance: number;
  saturation: number;
  /** Huit couleurs : teinte, saturation, luminance. */
  melangeur: [number, number, number][];
  vignetage: number;
  grain: number;
}

/** Les réglages d'essai, les mêmes que `reglages_essai` du Rust. */
export function reglagesEssai(): Reglages {
  const melangeur: [number, number, number][] = Array.from({ length: 8 }, () => [0, 0, 0]);
  melangeur[1] = [10, 20, -10];
  melangeur[5] = [-15, 30, -20];
  return { exposition: 0.4, contraste: 25, hautesLumieres: -40, ombres: 35, blancs: 10, noirs: -10, temperature: 12, teinte: -5, vibrance: 20, saturation: 10, melangeur, vignetage: -30, grain: 15 };
}

/** Un curseur qu'on tire : plusieurs réglages bougent à chaque image. */
function reglagesA(ms: number): Reglages {
  const r = reglagesEssai();
  const a = (periode: number) => Math.sin((ms / periode) * 2 * Math.PI);
  return { ...r, exposition: 1.2 * a(2000), contraste: 40 * a(2600), temperature: 30 * a(3100), hautesLumieres: -50 * Math.abs(a(1700)), ombres: 50 * Math.abs(a(2300)), vibrance: 40 * a(1900) };
}

// ---- Le shader ----

const SOMMETS = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/** Les formules de `labo.rs`, ligne pour ligne. */
const PIXELS = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_tex;
uniform bool u_exact;
uniform vec2 u_taille;
uniform vec3 u_gains;
uniform float u_contraste, u_hl, u_ombres, u_blancs, u_noirs, u_sat, u_vib, u_vignetage, u_grain;
uniform bool u_melange;
uniform vec3 u_melangeur[8];
out vec4 sortie;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const float CENTRES[8] = float[8](0.0, 30.0, 60.0, 120.0, 180.0, 240.0, 270.0, 300.0);
float versLin(float c) { return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4); }
float versSrgb(float l) { l = clamp(l, 0.0, 1.0); return l <= 0.0031308 ? 12.92 * l : 1.055 * pow(l, 1.0 / 2.4) - 0.055; }
uint hachage(uint x, uint y) { uint h = x * 374761393u + y * 668265263u; h = (h ^ (h >> 13u)) * 1274126177u; return h ^ (h >> 16u); }
void main() {
  int px = int(gl_FragCoord.x);
  int py = int(u_taille.y) - 1 - int(gl_FragCoord.y);
  vec3 c = u_exact ? texelFetch(u_tex, ivec2(px, py), 0).rgb : texture(u_tex, vec2((float(px) + 0.5) / u_taille.x, (float(py) + 0.5) / u_taille.y)).rgb;
  vec3 l = vec3(versLin(c.r), versLin(c.g), versLin(c.b)) * u_gains;
  float y0 = dot(l, LUMA);
  if (y0 > 1e-6) {
    float p = pow(y0, 1.0 / 2.2);
    float f = u_contraste >= 0.0 ? 1.0 + u_contraste / 100.0 * 0.8 : 1.0 + u_contraste / 100.0 * 0.6;
    p = 0.5 + (p - 0.5) * f;
    p += 0.3 * u_hl / 100.0 * smoothstep(0.5, 1.0, p) + 0.3 * u_ombres / 100.0 * (1.0 - smoothstep(0.0, 0.5, p))
       + 0.2 * u_blancs / 100.0 * smoothstep(0.7, 1.0, p) + 0.2 * u_noirs / 100.0 * (1.0 - smoothstep(0.0, 0.3, p));
    l *= pow(max(p, 0.0), 2.2) / y0;
  }
  float y1 = dot(l, LUMA);
  float haut = max(l.r, max(l.g, l.b));
  float bas = min(l.r, min(l.g, l.b));
  float chroma = haut > 1e-6 ? (haut - bas) / haut : 0.0;
  float k = (1.0 + u_sat / 100.0) * (1.0 + u_vib / 100.0 * (1.0 - chroma));
  l = y1 + (l - y1) * k;
  if (u_melange && chroma > 0.0) {
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
    vec3 m = u_melangeur[i] * (1.0 - t) + u_melangeur[s] * t;
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
  if (u_vignetage != 0.0) {
    vec2 uv = vec2((float(px) + 0.5) / u_taille.x * 2.0 - 1.0, (float(py) + 0.5) / u_taille.y * 2.0 - 1.0);
    float dd = sqrt((uv.x * uv.x + uv.y * uv.y) / 2.0);
    l *= exp2(u_vignetage / 100.0 * 1.5 * smoothstep(0.35, 1.0, dd));
  }
  if (u_grain != 0.0) {
    float n = float(hachage(uint(px), uint(py)) & 0xffffu) / 65535.0 - 0.5;
    l *= 1.0 + u_grain / 100.0 * 0.25 * n;
  }
  sortie = vec4(versSrgb(l.r), versSrgb(l.g), versSrgb(l.b), 1.0);
}`;

class Shader {
  readonly toile: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  private readonly prog: WebGLProgram;
  private readonly tex: WebGLTexture;
  private readonly u: Record<string, WebGLUniformLocation | null> = {};
  exact = false;

  constructor(largeur: number, hauteur: number) {
    this.toile = document.createElement("canvas");
    this.toile.width = largeur;
    this.toile.height = hauteur;
    // Le dessin doit rester lisible après la fin de l'image : Konva le recopie quand il veut.
    const gl = this.toile.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
    if (!gl) throw new Error("WebGL 2 indisponible dans ce moteur");
    this.gl = gl;
    const compiler = (type: number, code: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, code);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`shader : ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compiler(gl.VERTEX_SHADER, SOMMETS));
    gl.attachShader(prog, compiler(gl.FRAGMENT_SHADER, PIXELS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`programme : ${gl.getProgramInfoLog(prog)}`);
    this.prog = prog;
    gl.useProgram(prog);
    for (const nom of ["u_tex", "u_exact", "u_taille", "u_gains", "u_contraste", "u_hl", "u_ombres", "u_blancs", "u_noirs", "u_sat", "u_vib", "u_vignetage", "u_grain", "u_melange", "u_melangeur"]) {
      this.u[nom] = gl.getUniformLocation(prog, nom);
    }
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.viewport(0, 0, largeur, hauteur);
  }

  /** Une image, une vidéo (son image courante) ou des pixels bruts. */
  charger(source: TexImageSource | { pixels: Uint8Array; largeur: number; hauteur: number }, mipmaps: boolean): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    if ("pixels" in source) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, source.largeur, source.hauteur, 0, gl.RGBA, gl.UNSIGNED_BYTE, source.pixels);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    if (mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  }

  dessiner(r: Reglages): void {
    const gl = this.gl;
    const u = this.u;
    gl.useProgram(this.prog);
    const kt = (r.temperature / 100) * 0.5;
    const ku = (r.teinte / 100) * 0.3;
    const e = 2 ** r.exposition;
    gl.uniform1i(u.u_tex, 0);
    gl.uniform1i(u.u_exact, this.exact ? 1 : 0);
    gl.uniform2f(u.u_taille, this.toile.width, this.toile.height);
    gl.uniform3f(u.u_gains, 2 ** kt * e, 2 ** -ku * e, 2 ** -kt * e);
    gl.uniform1f(u.u_contraste, r.contraste);
    gl.uniform1f(u.u_hl, r.hautesLumieres);
    gl.uniform1f(u.u_ombres, r.ombres);
    gl.uniform1f(u.u_blancs, r.blancs);
    gl.uniform1f(u.u_noirs, r.noirs);
    gl.uniform1f(u.u_sat, r.saturation);
    gl.uniform1f(u.u_vib, r.vibrance);
    gl.uniform1f(u.u_vignetage, r.vignetage);
    gl.uniform1f(u.u_grain, r.grain);
    gl.uniform1i(u.u_melange, r.melangeur.flat().some((v) => v !== 0) ? 1 : 0);
    gl.uniform3fv(u.u_melangeur, r.melangeur.flat());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Les pixels dessinés, de haut en bas (WebGL les rend de bas en haut). */
  lire(): Uint8Array {
    const gl = this.gl;
    const { width: l, height: h } = this.toile;
    const brut = new Uint8Array(l * h * 4);
    gl.readPixels(0, 0, l, h, gl.RGBA, gl.UNSIGNED_BYTE, brut);
    const sortie = new Uint8Array(l * h * 4);
    for (let y = 0; y < h; y++) sortie.set(brut.subarray((h - 1 - y) * l * 4, (h - y) * l * 4), y * l * 4);
    return sortie;
  }

  liberer(): void {
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

// ---- Le montage dans la page, comme dans Eliot ----

/** Le calque de la photo, au-dessus de la page, même échelle et même découpe (règle 11). */
function calquePhoto(ctx: Contexte): Konva.Layer {
  const calque = new Konva.Layer({ listening: false });
  ctx.scene.stage.add(calque);
  calque.zIndex(ctx.scene.calquePage.zIndex() + 1);
  const groupe = ctx.scene.groupePage;
  calque.position(groupe.getAbsolutePosition());
  calque.scale(groupe.getAbsoluteScale());
  calque.clip({ x: 0, y: 0, width: PAGE, height: PAGE });
  return calque;
}

/** La photo couvre la largeur de la page, centrée en hauteur. */
const boite = (largeur: number, hauteur: number) => {
  const h = (PAGE * hauteur) / largeur;
  return { x: 0, y: (PAGE - h) / 2, width: PAGE, height: h };
};

function chargerImage(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ko(new Error(`${src} introuvable (commande 4 bis du CLAUDE.md)`));
    img.src = src;
  });
}

const sansTauri = (id: string, titre: string): Resultat => ({ id, titre, statut: "sans objet", note: "seulement dans la fenêtre Tauri" });
const resume = (v: number[]) => ({ med: arrondi(mediane(v)), p95: arrondi(centile(v, 95)) });

// ---- Voie 1 : le Rust en direct ----

async function rustEnDirect(ctx: Contexte, largeur: number): Promise<Resultat> {
  const id = `labo_rust_${largeur}`;
  const titre = `Labo, Rust en direct, ${largeur} px`;
  if (!ctx.dansTauri) return sansTauri(id, titre);
  const [l, h] = await invoke<[number, number]>("labo_preparer", { largeur });
  const toile = document.createElement("canvas");
  toile.width = l;
  toile.height = h;
  const c2d = toile.getContext("2d")!;
  const calque = calquePhoto(ctx);
  calque.add(new Konva.Image({ image: toile, ...boite(l, h) }));
  const allers: number[] = [];
  const calculs: number[] = [];
  const poses: number[] = [];
  const latences: number[] = [];
  let recues = 0;
  let enVol = false;
  let erreur: string | null = null;
  try {
    const debut = performance.now();
    const stats = await mesurerAnimation(
      DUREE_MS,
      (ecoule) => {
        if (enVol) return;
        enVol = true;
        const t0 = performance.now();
        invoke<ArrayBuffer>("labo_rendre", { largeur, reglages: reglagesA(ecoule) }).then(
          (tampon) => {
            const t1 = performance.now();
            const vue = new DataView(tampon);
            calculs.push(vue.getUint32(8, true) / 1000);
            const t2 = performance.now();
            c2d.putImageData(new ImageData(new Uint8ClampedArray(tampon, 16, l * h * 4), l, h), 0, 0);
            calque.batchDraw();
            const t3 = performance.now();
            allers.push(t1 - t0);
            poses.push(t3 - t2);
            latences.push(t3 - t0);
            recues++;
            enVol = false;
          },
          (e: unknown) => {
            erreur = String(e);
            enVol = false;
          },
        );
      },
      () => undefined,
    );
    const duree = (performance.now() - debut) / 1000;
    if (erreur) return { id, titre, statut: "erreur", note: erreur };
    const transferts = allers.map((a, i) => a - (calculs[i] ?? 0));
    return {
      id,
      titre,
      statut: "ok",
      stats,
      verdict: juger(stats, ctx.frequenceHz),
      mesures: {
        "taille": `${l} × ${h}`,
        "images réglées par seconde": arrondi(recues / duree),
        "curseur → image, médiane (ms)": resume(latences).med,
        "curseur → image, p95 (ms)": resume(latences).p95,
        "calcul Rust, médiane (ms)": resume(calculs).med,
        "transfert, médiane (ms)": resume(transferts).med,
        "pose dans la page, médiane (ms)": resume(poses).med,
        "Mo par image": arrondi((l * h * 4) / 1e6, 2),
      },
    };
  } finally {
    calque.destroy();
    ctx.scene.stage.batchDraw();
  }
}

// ---- Voie 2 : le shader WebGL ----

async function shaderPhoto(ctx: Contexte, mode: "konva" | "dessus"): Promise<Resultat> {
  const id = `labo_webgl_photo_${mode}`;
  const titre = mode === "konva" ? "Labo, shader WebGL, photo dessinée dans Konva" : "Labo, shader WebGL, photo posée sur la page";
  const photo = await chargerImage(PHOTO);
  // La taille de l'écran : la photo couvre la page, à l'échelle de la page et de l'écran.
  const echelle = ctx.scene.echelle() * window.devicePixelRatio;
  const l = Math.round(PAGE * echelle);
  const h = Math.round((l * photo.naturalHeight) / photo.naturalWidth);
  let shader: Shader;
  try {
    shader = new Shader(l, h);
  } catch (e) {
    return { id, titre, statut: "impossible", note: String((e as Error).message) };
  }
  const t0 = performance.now();
  shader.charger(photo, true);
  const chargement = performance.now() - t0;
  const soumissions: number[] = [];
  let calque: Konva.Layer | null = null;
  try {
    if (mode === "konva") {
      calque = calquePhoto(ctx);
      calque.add(new Konva.Image({ image: shader.toile, ...boite(l, h) }));
    } else {
      // Le canvas WebGL posé par-dessus la page, à la place de la photo (sans copie par Konva).
      const groupe = ctx.scene.groupePage.getAbsolutePosition();
      const b = boite(l, h);
      const s = ctx.scene.echelle();
      Object.assign(shader.toile.style, { position: "absolute", left: `${groupe.x + b.x * s}px`, top: `${groupe.y + b.y * s}px`, width: `${b.width * s}px`, height: `${b.height * s}px`, pointerEvents: "none" });
      ctx.scene.stage.container().style.position = "relative";
      ctx.scene.stage.container().appendChild(shader.toile);
    }
    const stats = await mesurerAnimation(
      DUREE_MS,
      (ecoule) => {
        const t = performance.now();
        shader.dessiner(reglagesA(ecoule));
        soumissions.push(performance.now() - t);
      },
      () => calque?.draw(),
    );
    return {
      id,
      titre,
      statut: "ok",
      stats,
      verdict: juger(stats, ctx.frequenceHz),
      mesures: { "taille": `${l} × ${h}`, "envoi d'une image, médiane (ms)": resume(soumissions).med, "chargement de la photo 2560 px (ms)": arrondi(chargement) },
    };
  } finally {
    calque?.destroy();
    shader.toile.remove();
    shader.liberer();
    ctx.scene.stage.batchDraw();
  }
}

async function videoSource(): Promise<string> {
  try {
    const r = await fetch("/donnees/copies/copies.json", { cache: "no-store" });
    const liste = (await r.json()) as { copies: { id: string; fichier: string }[] };
    const copie = liste.copies.find((c) => c.id === "vp9_720p");
    if (copie) {
      const essai = await fetch(`/donnees/copies/${copie.fichier}`, { method: "HEAD" });
      if (essai.ok && (essai.headers.get("content-type") ?? "").startsWith("video")) return `/donnees/copies/${copie.fichier}`;
    }
  } catch {
    // Pas de copies : la vidéo VP9 1080p des fichiers de test.
  }
  return "/donnees/video_1080p_vp9.webm";
}

async function shaderVideo(ctx: Contexte): Promise<Resultat> {
  const id = "labo_webgl_video";
  const titre = "Labo, shader WebGL, vidéo qui joue, dans Konva";
  const src = await videoSource();
  const video = document.createElement("video");
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.src = src;
  try {
    await new Promise<void>((ok, ko) => {
      video.addEventListener("canplay", () => ok(), { once: true });
      video.addEventListener("error", () => ko(new Error(`lecture impossible, code ${video.error?.code ?? "?"}`)), { once: true });
      setTimeout(() => ko(new Error("la vidéo ne charge pas en 10 s")), 10000);
    });
  } catch (e) {
    return { id, titre, statut: "impossible", note: `${src} : ${(e as Error).message}` };
  }
  const echelle = ctx.scene.echelle() * window.devicePixelRatio;
  const l = Math.round(PAGE * echelle);
  const h = Math.round((l * video.videoHeight) / video.videoWidth);
  let shader: Shader;
  try {
    shader = new Shader(l, h);
  } catch (e) {
    return { id, titre, statut: "impossible", note: String((e as Error).message) };
  }
  const calque = calquePhoto(ctx);
  calque.add(new Konva.Image({ image: shader.toile, ...boite(l, h) }));
  const envois: number[] = [];
  let imagesVideo = 0;
  const compter = () => {
    imagesVideo++;
    (video as HTMLVideoElement & { requestVideoFrameCallback?: (f: () => void) => void }).requestVideoFrameCallback?.(compter);
  };
  try {
    await video.play();
    (video as HTMLVideoElement & { requestVideoFrameCallback?: (f: () => void) => void }).requestVideoFrameCallback?.(compter);
    const qAvant = video.getVideoPlaybackQuality?.();
    const tAvant = video.currentTime;
    const debut = performance.now();
    const stats = await mesurerAnimation(
      DUREE_MS,
      (ecoule) => {
        const t = performance.now();
        shader.charger(video, false);
        shader.dessiner(reglagesA(ecoule));
        envois.push(performance.now() - t);
      },
      () => calque.draw(),
    );
    const duree = (performance.now() - debut) / 1000;
    const qApres = video.getVideoPlaybackQuality?.();
    return {
      id,
      titre,
      statut: "ok",
      stats,
      verdict: juger(stats, ctx.frequenceHz),
      mesures: {
        "vidéo": src.split("/").pop() ?? src,
        "taille": `${l} × ${h}`,
        "images de la vidéo par seconde": imagesVideo ? arrondi(imagesVideo / duree) : "inconnu",
        "images perdues": qApres && qAvant ? qApres.droppedVideoFrames - qAvant.droppedVideoFrames : "inconnu",
        "vitesse de lecture": arrondi((video.currentTime - tAvant) / duree, 2),
        "envoi d'une image (texture et dessin), médiane (ms)": resume(envois).med,
      },
    };
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    calque.destroy();
    shader.liberer();
    ctx.scene.stage.batchDraw();
  }
}

// ---- Les deux voies sur les mêmes pixels ----

async function ecart(ctx: Contexte): Promise<Resultat> {
  const id = "labo_ecart";
  const titre = "Labo, écart entre le Rust et le shader";
  if (!ctx.dansTauri) return sansTauri(id, titre);
  const largeur = 1280;
  const source = await invoke<ArrayBuffer>("labo_source", { largeur });
  const vue = new DataView(source);
  const l = vue.getUint32(0, true);
  const h = vue.getUint32(4, true);
  let shader: Shader;
  try {
    shader = new Shader(l, h);
  } catch (e) {
    return { id, titre, statut: "impossible", note: String((e as Error).message) };
  }
  try {
    shader.exact = true;
    shader.charger({ pixels: new Uint8Array(source, 8, l * h * 4), largeur: l, hauteur: h }, false);
    const reglages = reglagesEssai();
    shader.dessiner(reglages);
    const gpu = shader.lire();
    const rust = new Uint8Array(await invoke<ArrayBuffer>("labo_rendre", { largeur, reglages }), 16);
    let somme = 0;
    let max = 0;
    let audela = 0;
    for (let i = 0; i < l * h; i++) {
      let pire = 0;
      for (let k = 0; k < 3; k++) {
        const d = Math.abs(gpu[4 * i + k] - rust[4 * i + k]);
        somme += d;
        pire = Math.max(pire, d);
      }
      max = Math.max(max, pire);
      if (pire > 2) audela++;
    }
    const moyen = somme / (l * h * 3);
    return {
      id,
      titre,
      statut: "ok",
      mesures: { "taille": `${l} × ${h}`, "écart moyen (sur 255)": arrondi(moyen, 3), "écart maximal (sur 255)": max, "pixels à plus de 2 (%)": arrondi((100 * audela) / (l * h), 3) },
      note: moyen <= 2 ? "les deux rendus se confondent" : "les deux rendus s'écartent : formules à revoir avant le lot 2",
    };
  } finally {
    shader.liberer();
  }
}

// ---- Les réglages qui regardent les voisins, et l'export ----

interface MesureVoisins {
  largeur: number;
  hauteur: number;
  clarte_ms: number;
  texture_ms: number;
  nettete_ms: number;
  bruit_ms: number;
  voile_ms: number;
  tous_ms: number;
}

async function voisins(ctx: Contexte): Promise<Resultat[]> {
  const titres = ["Labo, Rust, réglages voisins sur l'aperçu 2560 px", "Labo, Rust, tout le labo sur l'original 24 Mpx"];
  if (!ctx.dansTauri) return [sansTauri("labo_voisins_2560", titres[0]), sansTauri("labo_original", titres[1])];
  const [apercu, original] = await invoke<[MesureVoisins, { decodage_ms: number; pixels_ms: number; voisins: MesureVoisins; total_ms: number }]>("labo_voisins");
  const detail = (m: MesureVoisins) => ({ "taille": `${m.largeur} × ${m.hauteur}`, "clarté (ms)": m.clarte_ms, "texture (ms)": m.texture_ms, "netteté (ms)": m.nettete_ms, "réduction du bruit (ms)": m.bruit_ms, "correction du voile (ms)": m.voile_ms });
  return [
    { id: "labo_voisins_2560", titre: titres[0], statut: "ok", mesures: { "total ms": apercu.tous_ms, ...detail(apercu) } },
    { id: "labo_original", titre: titres[1], statut: "ok", mesures: { "total ms": original.total_ms, "décodage (ms)": original.decodage_ms, "réglages d'un pixel (ms)": original.pixels_ms, "réglages voisins (ms)": original.voisins.tous_ms, ...detail(original.voisins) } },
  ];
}

export function scenariosLabo(): Scenario[] {
  const resultatsVoisins: { liste: Resultat[] | null } = { liste: null };
  return [
    { id: "labo_rust_1280", titre: "Labo, Rust en direct, 1280 px", executer: (ctx) => rustEnDirect(ctx, 1280) },
    { id: "labo_rust_1920", titre: "Labo, Rust en direct, 1920 px", executer: (ctx) => rustEnDirect(ctx, 1920) },
    { id: "labo_rust_2560", titre: "Labo, Rust en direct, 2560 px", executer: (ctx) => rustEnDirect(ctx, 2560) },
    { id: "labo_webgl_photo_konva", titre: "Labo, shader WebGL, photo dans Konva", executer: (ctx) => shaderPhoto(ctx, "konva") },
    { id: "labo_webgl_photo_dessus", titre: "Labo, shader WebGL, photo posée sur la page", executer: (ctx) => shaderPhoto(ctx, "dessus") },
    { id: "labo_webgl_video", titre: "Labo, shader WebGL, vidéo qui joue", executer: (ctx) => shaderVideo(ctx) },
    { id: "labo_ecart", titre: "Labo, écart entre le Rust et le shader", executer: (ctx) => ecart(ctx) },
    {
      id: "labo_voisins_2560",
      titre: "Labo, Rust, réglages voisins sur l'aperçu 2560 px",
      executer: async (ctx) => {
        resultatsVoisins.liste = await voisins(ctx);
        return resultatsVoisins.liste[0];
      },
    },
    {
      id: "labo_original",
      titre: "Labo, Rust, tout le labo sur l'original 24 Mpx",
      executer: async (ctx) => (resultatsVoisins.liste ?? (await voisins(ctx)))[1],
    },
  ];
}
