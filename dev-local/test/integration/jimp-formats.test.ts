import { describe, expect, test } from "bun:test";
import { VALID_AVATAR_DATA_URL } from "../setup";

const OUTPUT_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

async function getSupportMap(buffer: Buffer) {
  const { Jimp } = await import("jimp");
  const image = await Jimp.read(buffer);
  const support: Record<(typeof OUTPUT_MIMES)[number], boolean> = {
    "image/jpeg": false,
    "image/png": false,
    "image/gif": false,
    "image/webp": false,
  };

  for (const mime of OUTPUT_MIMES) {
    try {
      await image.getBuffer(mime as "image/jpeg");
      support[mime] = true;
    } catch {
      support[mime] = false;
    }
  }

  return support;
}

describe("Jimp format support", () => {
  test("matches expected encoder support", async () => {
    const base64Data = VALID_AVATAR_DATA_URL.split(",")[1];
    const buffer = Buffer.from(base64Data, "base64");
    const support = await getSupportMap(buffer);

    expect(support["image/jpeg"]).toBe(true);
    expect(support["image/png"]).toBe(true);
    expect(support["image/gif"]).toBe(true);
    expect(support["image/webp"]).toBe(false);
  });
});
