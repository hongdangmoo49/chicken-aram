import sharp from "sharp";

const allowedFormats = new Set(["jpeg", "png", "webp"]);

export async function normalizePlayerThumbnail(input: Buffer) {
  const image = sharp(input, { failOn: "error", limitInputPixels: 40_000_000 });
  const metadata = await image.metadata();
  if (!metadata.format || !allowedFormats.has(metadata.format)) throw new Error("unsupported image format");
  return image.rotate().resize(512, 512, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
}
