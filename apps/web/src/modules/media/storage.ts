import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { StoredMediaFile } from "./media.types";

type SaveMediaInput = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  storeId: string;
};

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

  if (!key.startsWith("uploads/")) {
    return;
  }

  try {
    await unlink(join(process.cwd(), "public", key));
  } catch {
    // Missing local files should not block database cleanup.
  }
}

async function saveLocalMediaFile(input: SaveMediaInput) {
  const extension = extensionFor(input.filename, input.mimeType);
  const directoryKey = `uploads/stores/${input.storeId}`;
  const directory = join(process.cwd(), "public", directoryKey);
  const filename = `${Date.now()}-${randomUUID()}${extension}`;
  const key = `${directoryKey}/${filename}`;

  await mkdir(directory, {
    recursive: true
  });
  await writeFile(join(process.cwd(), "public", key), input.buffer);

  return {
    key,
    url: publicUrl(key)
  };
}

function publicUrl(key: string) {
  const baseUrl = process.env.STORAGE_PUBLIC_URL?.replace(/\/+$/, "");

  return baseUrl ? `${baseUrl}/${key}` : `/${key}`;
}

function extensionFor(filename: string, mimeType: string) {
  const extension = extname(filename).toLowerCase();

  if (extension) {
    return extension;
  }

  const mimeExtensions: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/svg+xml": ".svg",
    "image/webp": ".webp"
  };

  return mimeExtensions[mimeType] ?? "";
}
