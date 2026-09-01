import { readFile, stat } from "node:fs/promises";
import { NextResponse, type NextRequest } from "next/server";
import { contentTypeForMediaKey, resolveLocalMediaPath } from "../../../modules/media/storage";

/**
 * `GET /uploads/**` — seller-uploaded media, read from disk per request.
 *
 * Without this route an upload only works in development. `next start` walks
 * `public/` once at boot and afterwards answers static requests from that
 * snapshot alone, so a file an upload writes minutes later is not in the set and
 * 404s until the service restarts — every product photo, logo and category image
 * a seller adds between deploys shows as a broken image. `next dev` stats the
 * disk on each miss instead, which is exactly why this never reproduces locally.
 *
 * Reading the file here is independent of that snapshot, so an upload is visible
 * immediately in both. The URL is unchanged (`/uploads/stores/<id>/<file>`), so
 * every media URL already stored on a product, category or settings row starts
 * working again with no migration. Files that predate the last restart are still
 * answered by the static handler first, which is the same bytes by a shorter
 * path; this route picks up everything after it.
 *
 * The directory stays under `public/` deliberately: the deploy's
 * `--exclude='apps/web/public/uploads/'` and the systemd unit's `ReadWritePaths`
 * both name it, and moving it would mean a manual step on the server to keep
 * existing media — with `rsync --delete` waiting for anyone who skipped it.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ key: string[] }> }) {
  const { key } = await context.params;
  const path = resolveLocalMediaPath(["uploads", ...key].join("/"));
  const contentType = path ? contentTypeForMediaKey(path) : null;

  if (!path || !contentType) {
    return notFound();
  }

  const stats = await stat(path).catch(() => null);

  if (!stats?.isFile()) {
    return notFound();
  }

  // Stored names carry a timestamp and a UUID, so a URL never comes to point at
  // different bytes — but a size and mtime tag costs nothing and lets Caddy and
  // any proxy in front of it revalidate rather than refetch.
  const etag = `"${stats.size.toString(16)}-${Math.trunc(stats.mtimeMs).toString(16)}"`;
  const headers = {
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Type": contentType,
    // An uploaded SVG is same-origin markup. Upload already rejects scripted
    // SVGs; this refuses to run one anyway, and stops any file being sniffed
    // into a type it was not served as.
    "Content-Security-Policy": "default-src 'none'; sandbox",
    ETag: etag,
    "X-Content-Type-Options": "nosniff"
  };

  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { headers, status: 304 });
  }

  return new NextResponse(new Uint8Array(await readFile(path)), { headers, status: 200 });
}

function notFound() {
  return new NextResponse(null, { status: 404 });
}
