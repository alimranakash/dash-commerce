import { basename, extname } from "node:path";
import sharp from "sharp";
import { mediaUploadGuideForUsage, type MediaUsageType } from "./media.schema";

type OptimizeMediaInput = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  usageType: MediaUsageType;
};

export type OptimizedMedia = {
  buffer: Buffer;
  filename: string;
  /** Null for formats sharp cannot decode, such as SVG and ICO. */
  height: number | null;
  mimeType: string;
  size: number;
  width: number | null;
};

export const webpMimeType = "image/webp";

/**
 * WebP at this quality is visually indistinguishable from the JPEG a phone
 * camera produces, at roughly a tenth of the bytes.
 */
const webpQuality = 82;

/** Formats sharp can decode. ICO and SVG are stored byte-for-byte instead. */
const decodableMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Every upload passes through here, so what a seller picks and what the
 * storefront serves are two different files: a 4MB camera JPEG is stored as a
 * ~150KB WebP capped to the usage's recommended box. Sellers never have to
 * export anything themselves, and product grids stay light.
 *
 * Throws when a raster file cannot be decoded, which also makes this the first
 * check that an upload really is an image rather than a renamed file.
 */
export async function optimizeMediaUpload(input: OptimizeMediaInput): Promise<OptimizedMedia> {
  const guide = mediaUploadGuideForUsage(input.usageType);

  if (!guide.autoOptimize || !decodableMimeTypes.has(input.mimeType)) {
    return {
      buffer: input.buffer,
      filename: input.filename,
      height: null,
      mimeType: input.mimeType,
      size: input.buffer.byteLength,
      width: null
    };
  }

  const source = orientedSize(await sharp(input.buffer).metadata());
  const result = await sharp(input.buffer)
    // Phone photos carry their orientation in EXIF; bake it in before resizing,
    // or portrait shots come out sideways once that metadata is dropped.
    .rotate()
    .resize({
      fit: "inside",
      height: guide.recommendedHeight,
      width: guide.recommendedWidth,
      withoutEnlargement: true
    })
    .webp({ quality: webpQuality })
    .toBuffer({ resolveWithObject: true });

  // Re-encoding an image that was already exported well comes out *larger* —
  // a 20KB WebP becomes 22KB. When the original needs no downscale and is
  // already the smaller file, it is kept exactly as uploaded.
  if (
    source &&
    source.width <= guide.recommendedWidth &&
    source.height <= guide.recommendedHeight &&
    result.data.byteLength >= input.buffer.byteLength
  ) {
    return {
      buffer: input.buffer,
      filename: input.filename,
      height: source.height,
      mimeType: input.mimeType,
      size: input.buffer.byteLength,
      width: source.width
    };
  }

  return {
    buffer: result.data,
    filename: toWebpFilename(input.filename),
    height: result.info.height,
    mimeType: webpMimeType,
    size: result.data.byteLength,
    width: result.info.width
  };
}

/** Dimensions as the image will be displayed, not as its pixels are stored. */
function orientedSize(metadata: sharp.Metadata) {
  const { height, orientation, width } = metadata;

  if (!width || !height) {
    return null;
  }

  // EXIF orientations 5-8 mean `.rotate()` will swap the two axes.
  return orientation && orientation >= 5 ? { height: width, width: height } : { height, width };
}

function toWebpFilename(filename: string) {
  const extension = extname(filename);
  const stem = extension ? basename(filename, extension) : filename;

  return `${stem || "image"}.webp`;
}
