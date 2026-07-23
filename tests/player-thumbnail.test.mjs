import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { normalizePlayerThumbnail } from "../lib/player-thumbnail.ts";

test("decodes and re-encodes real thumbnail pixels", async () => {
  const source = await sharp({ create: { width: 16, height: 8, channels: 3, background: "#ff7d2a" } }).png().toBuffer();
  const output = await normalizePlayerThumbnail(source);
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
  await assert.rejects(() => normalizePlayerThumbnail(Buffer.from("<script>alert(1)</script>")));
});
