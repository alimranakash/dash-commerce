import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import type { StoredMediaFile } from "./media.types";

type SaveMediaInput = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  storeId: string;
};

/**
 * Every stored key starts here, and `app/uploads/[...key]/route.ts` serves the
 * matching URL. Uploads sit under `public/` so that the deploy's rsync exclude
 * and the systemd unit's `ReadWritePaths` keep naming one directory, but they
 * are read back through that route rather than by Next's static handler — see
 * the route for why.
 */
const mediaKeyPrefix = "uploads";

export async function saveMediaFile(input: SaveMediaInput): Promise<StoredMediaFile> {
  const driver = process.env.STORAGE_DRIVER || "local";

  if (driver !== "local") {
    throw new Error("S3/R2 storage driver is not implemented yet. Use STORAGE_DRIVER=local.");
  }

  return saveLocalMediaFile(input);
}

export async function deleteStoredMediaFile(key: string) {
  if ((process.env.STORAGE_DRIVER || "local") !== "local") {
    return;
  }

  const path = resolveLocalMediaPath(key);

  if (!path) {
    return;
  }

  try {
    await unlink(path);
  } catch {
    // Missing local files should not block database cleanup.
  }
}

/**
 * Absolute path on disk for a stored key, or null when the key is not one of
 * ours. Resolving first and then checking that the result is still inside the
 * media directory is what makes a crafted `../../.env` request a 404 rather
 * than a file read: it rejects traversal after normalisation, not by pattern.
 */
export function resolveLocalMediaPath(key: string): string | null {
  if (key.includes("\0") || key.includes("\\")) {
    return null;
  }

  const root = join(process.cwd(), "public", mediaKeyPrefix);
  const target = resolve(process.cwd(), "public", key);
  const withinRoot = relative(root, target);

  if (!withinRoot || withinRoot.startsWith("..") || isAbsolute(withinRoot)) {
    return null;
  }

  return target;
}

/** What to send a browser for a stored key. Unknown extensions are not served. */
export function contentTypeForMediaKey(key: string): string | null {
  return mediaContentTypes[extname(key).toLowerCase()] ?? null;
}

async function saveLocalMediaFile(input: SaveMediaInput) {
  const extension = extensionFor(input.filename, input.mimeType);
  const key = `${mediaKeyPrefix}/stores/${input.storeId}/${Date.now()}-${randomUUID()}${extension}`;
  const path = resolveLocalMediaPath(key);

  if (!path) {
    throw new Error("Could not resolve a storage path for that upload.");
  }

  await mkdir(dirname(path), {
    recursive: true
  });
  await writeFile(path, input.buffer);

  return {
    key,
    url: publicUrl(key)
  };
}

function publicUrl(key: string) {
  const baseUrl = process.env.STORAGE_PUBLIC_URL?.replace(/\/+$/, "");

  return baseUrl ? `${baseUrl}/${key}` : `/${key}`;
}

/**
 * Extension -> content type, covering exactly what the media rules accept.
 * `extensionFor` below only ever produces a key ending in one of these, so a
 * file this module stores is always a file the uploads route can serve.
 */
const mediaContentTypes: Record<string, string> = {
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function extensionFor(filename: string, mimeType: string) {
  const extension = extname(filename).toLowerCase();

  // An extension we would not serve is worse than none: fall back to the mime
  // type so the stored key always ends in something `mediaContentTypes` knows.
  if (extension && mediaContentTypes[extension]) {
    return extension;
  }

  const mimeExtensions: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/svg+xml": ".svg",
    "image/vnd.microsoft.icon": ".ico",
    "image/webp": ".webp",
    "image/x-icon": ".ico"
  };

  return mimeExtensions[mimeType] ?? "";
}
