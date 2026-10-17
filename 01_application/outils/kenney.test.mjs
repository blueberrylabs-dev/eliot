import { describe, expect, it } from "vitest";
import { ecrireGlb, emporterTextures, lireGlb } from "./kenney.mjs";

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489", "hex");

describe("les modèles de Kenney", () => {
  it("emporte la texture citée dans le GLB, qui se suffit", () => {
    const bin = Buffer.from([1, 2, 3, 4, 5, 6]);
    const glb = ecrireGlb({ asset: { version: "2.0" }, buffers: [{ byteLength: 6 }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 6 }], images: [{ uri: "Textures/colormap.png" }] }, bin);
    const lus = [];
    const sortie = emporterTextures(glb, (relatif) => {
      lus.push(relatif);
      return PNG;
    });
    expect(lus).toEqual(["Textures/colormap.png"]);
    const { json, bin: bloc } = lireGlb(sortie);
    expect(json.images[0].uri).toBeUndefined();
    expect(json.images[0].mimeType).toBe("image/png");
    const vue = json.bufferViews[json.images[0].bufferView];
    expect(vue.byteOffset % 4).toBe(0);
    expect(Buffer.compare(bloc.subarray(vue.byteOffset, vue.byteOffset + vue.byteLength), PNG)).toBe(0);
    expect(json.buffers[0].byteLength).toBe(vue.byteOffset + PNG.length);
    expect(bloc.subarray(0, 6)).toEqual(bin);
  });

  it("laisse tel quel un GLB qui se suffit déjà et refuse une texture hors du paquet", () => {
    const glb = ecrireGlb({ asset: { version: "2.0" } }, Buffer.alloc(0));
    expect(emporterTextures(glb, () => PNG)).toBe(glb);
    const piege = ecrireGlb({ asset: { version: "2.0" }, images: [{ uri: "../../secret.png" }] }, Buffer.alloc(0));
    expect(() => emporterTextures(piege, () => PNG)).toThrow(/hors du paquet/);
  });
});
