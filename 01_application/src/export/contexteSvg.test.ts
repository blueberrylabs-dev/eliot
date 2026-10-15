import { beforeAll, describe, expect, it } from "vitest";
import { ContexteSvg, DegradeSvg, multiplier, type Calque, type CalqueImage, type CalqueSvg } from "./contexteSvg";

// Pas de navigateur ici : un canevas de mesure minimal (10 px par lettre).
beforeAll(() => {
  (globalThis as unknown as { document: unknown }).document = {
    createElement: () => ({ getContext: () => ({ font: "", measureText: (t: string) => ({ width: t.length * 10 }) }) }),
  };
});

const sources = {
  reconnaitre: (s: unknown) => (s === "photo" ? { ressource: "a".repeat(64) } : s === "film" ? { video: "b".repeat(64) } : undefined),
};
const svgs = (c: Calque[]) => c.filter((x): x is CalqueSvg => x.genre === "svg");

describe("contexte SVG", () => {
  it("écrit les chemins dans le repère de base, transformation appliquée", () => {
    const ctx = new ContexteSvg(sources);
    ctx.translate(10, 20);
    ctx.scale(2, 2);
    ctx.beginPath();
    ctx.rect(0, 0, 5, 5);
    ctx.fillStyle = "#ff0000";
    ctx.fill();
    const [c] = svgs(ctx.calques());
    expect(c.svg).toContain('d="M10 20L20 20L20 30L10 30Z"');
    expect(c.svg).toContain('fill="#ff0000"');
    expect(c.boite).toEqual({ x0: 10, y0: 20, x1: 20, y1: 30 });
    expect(c.svg).toContain('viewBox="10 20 10 10"');
  });

  it("un cercle complet fait quatre courbes ; un remplissage transparent ne fait rien", () => {
    const ctx = new ContexteSvg(sources);
    ctx.beginPath();
    ctx.arc(50, 50, 10, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fill();
    expect(ctx.calques()).toHaveLength(0);
    ctx.fillStyle = "rgba(0, 0, 255, 0.5)";
    ctx.fill();
    const [c] = svgs(ctx.calques());
    expect((c.svg.match(/C/g) ?? []).length).toBe(4);
    expect(c.svg).toContain('fill="rgb(0,0,255)" fill-opacity="0.5"');
    expect(c.boite).toEqual({ x0: 40, y0: 40, x1: 60, y1: 60 });
  });

  it("un trait garde son épaisseur à l'échelle, ses tirets aussi", () => {
    const ctx = new ContexteSvg(sources);
    ctx.scale(2, 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(10, 0);
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 2]);
    ctx.strokeStyle = "#00ff00";
    ctx.stroke();
    const [c] = svgs(ctx.calques());
    expect(c.svg).toContain('stroke-width="6"');
    expect(c.svg).toContain('stroke-dasharray="8 4"');
  });

  it("l'opacité, la fusion et l'ombre : un calque d'ombre à part, décalé par le noyau", () => {
    const ctx = new ContexteSvg(sources);
    ctx.globalAlpha = 0.5;
    ctx.globalCompositeOperation = "multiply";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 7;
    ctx.beginPath();
    ctx.rect(0, 0, 100, 50);
    ctx.fillStyle = "#123456";
    ctx.fill();
    const [ombre, forme] = svgs(ctx.calques());
    expect(ombre.ombre).toEqual({ dx: 5, dy: 7 });
    expect(ombre.svg).toContain('stdDeviation="10"');
    expect(ombre.svg).toContain('flood-opacity="0.6"');
    expect(ombre.boite.x0).toBeLessThan(-30);
    expect(forme.ombre).toBeUndefined();
    expect(forme.opacite).toBe(0.5);
    expect(forme.fusion).toBe("multiply");
  });

  it("les découpes entourent les dessins et suivent save et restore", () => {
    const ctx = new ContexteSvg(sources);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 10, 10);
    ctx.clip();
    ctx.fillRect(0, 0, 100, 100);
    ctx.restore();
    ctx.fillRect(0, 0, 100, 100);
    const [dedans, dehors] = svgs(ctx.calques());
    expect(dedans.svg).toMatch(/<g clip-path="url\(#e?c\d+\)">/);
    expect(dedans.boite).toEqual({ x0: 0, y0: 0, x1: 10, y1: 10 });
    expect(dehors.svg).not.toContain("<g clip-path");
    expect(dehors.boite).toEqual({ x0: 0, y0: 0, x1: 100, y1: 100 });
  });

  it("un dégradé devient une définition, dans le repère du dessin", () => {
    const ctx = new ContexteSvg(sources);
    ctx.translate(100, 0);
    const d = ctx.createLinearGradient(0, 0, 10, 0);
    expect(d).toBeInstanceOf(DegradeSvg);
    d.addColorStop(0, "#ff0000");
    d.addColorStop(1, "rgba(0,0,255,0.5)");
    ctx.fillStyle = d;
    ctx.fillRect(0, 0, 10, 10);
    const [c] = svgs(ctx.calques());
    expect(c.svg).toContain('<linearGradient id="ed1" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="10" y2="0" gradientTransform="matrix(1 0 0 1 100 0)">');
    expect(c.svg).toContain('stop-color="rgb(0,0,255)" stop-opacity="0.5"');
  });

  it("un texte garde sa police, sa taille, son ancre et sa transformation", () => {
    const ctx = new ContexteSvg(sources);
    ctx.translate(5, 6);
    ctx.font = 'italic bold 48px "Space Mono", Inter, sans-serif';
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("Bonjour & co", 100, 50);
    const [c] = svgs(ctx.calques());
    expect(c.svg).toContain('font-family="&quot;Space Mono&quot;, Inter, sans-serif" font-size="48" font-weight="700" font-style="italic"');
    expect(c.svg).toContain('text-anchor="middle"');
    expect(c.svg).toContain('transform="matrix(1 0 0 1 5 6)"');
    expect(c.svg).toContain(">Bonjour &amp; co</text>");
  });

  it("un texte par morceaux : chaque lettre porte ses rangs et son centre", () => {
    const ctx = new ContexteSvg(sources);
    ctx.font = "20px Inter";
    ctx.fillStyle = "#000000";
    ctx.translate(0, 100);
    for (const [i, lettre] of ["A", "B"].entries()) {
      ctx.save();
      ctx.debutMorceau({ lettre: i, mot: 0, ligne: 0 }, i * 10 + 5, -7, 20);
      ctx.fillText(lettre, i * 10, 0);
      ctx.restore();
    }
    ctx.fillText("hors", 0, 0);
    const c = svgs(ctx.calques());
    expect(c.map((x) => x.unite?.lettre)).toEqual([0, 1, undefined]);
    expect(c[1].unite).toMatchObject({ cx: 15, cy: 93, taille: 20 });
  });

  it("une photo et une vidéo : posées par le noyau, le carré unité vers le repère de base", () => {
    const ctx = new ContexteSvg(sources);
    ctx.translate(10, 10);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 200, 100);
    ctx.clip();
    ctx.drawImage({ naturalWidth: 400, naturalHeight: 200 } as unknown as never, 0, 0, 200, 100);
    ctx.restore();
    expect(ctx.calques()).toHaveLength(1);
    const photo = Object.assign({ naturalWidth: 400, naturalHeight: 200 }, {});
    const avec = new ContexteSvg({ reconnaitre: (s) => (s === photo ? { ressource: "a".repeat(64) } : { video: "b".repeat(64) }) });
    avec.translate(10, 10);
    avec.beginPath();
    avec.rect(0, 0, 200, 100);
    avec.clip();
    avec.drawImage(photo, 0, 0, 200, 100);
    avec.drawImage({ width: 1920, height: 1080 }, 50, 0, 100, 50);
    const [p, v] = avec.calques() as CalqueImage[];
    expect(p.genre).toBe("image");
    expect(p.matrice).toEqual(multiplier([1, 0, 0, 1, 10, 10], [200, 0, 0, 100, 0, 0]));
    expect(p.decoupes).toEqual(["M10 10L210 10L210 110L10 110Z"]);
    expect(v.genre).toBe("video");
    expect(v.matrice).toEqual([100, 0, 0, 50, 60, 10]);
  });
});
