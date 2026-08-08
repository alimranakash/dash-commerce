/**
 * Demo pack integrity check.
 *
 * Demo packs are hand-authored static data that points at committed image files
 * and at each other by slug. Nothing at runtime validates that, and a bad path
 * only shows up as a broken image on a seeded storefront - or, for the media
 * metrics table, as a thrown error partway through an import. This script walks
 * every registered pack and fails loudly instead.
 *
 * Run with: npm run verify:demo-packs
 * Narrow to one pack with: npm run verify:demo-packs -- fashion-demo-v1
 */
import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
const sharp = require("sharp");

const repoRoot = path.resolve(import.meta.dirname, "..");
const publicDir = path.join(repoRoot, "apps/web/public");
const registryEntry = path.join(repoRoot, "apps/web/src/modules/demo-packs/registry.ts");

const failures = [];
const notes = [];

function fail(pack, message) {
  failures.push(`${pack}: ${message}`);
}

/** Loads the TypeScript pack registry without booting Next or Prisma. */
async function loadRegistry() {
  const outDir = mkdtempSync(path.join(tmpdir(), "demo-pack-verify-"));
  const outFile = path.join(outDir, "registry.mjs");

  await esbuild.build({
    bundle: true,
    entryPoints: [registryEntry],
    format: "esm",
    logLevel: "silent",
    outfile: outFile,
    platform: "node",
    target: "node20"
  });

  const module = await import(pathToFileURL(outFile).href);

  rmSync(outDir, { force: true, recursive: true });

  return module;
}

/** Every "/demo-assets/..." string anywhere in a value, however deeply nested. */
function collectAssetUrls(value, into = new Set()) {
  if (typeof value === "string") {
    if (value.startsWith("/demo-assets/")) {
      into.add(value);
    }

    return into;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectAssetUrls(item, into);
    }

    return into;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectAssetUrls(item, into);
    }
  }

  return into;
}

function listAssetFiles(verticalDir) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name !== ".gitkeep") {
        out.push(full);
      }
    }
  };

  walk(verticalDir);

  return out;
}

function toPublicPath(url) {
  return path.join(publicDir, url.replace(/^\//, ""));
}

function toUrl(filePath) {
  return `/${path.relative(publicDir, filePath).split(path.sep).join("/")}`;
}

function duplicates(values) {
  const seen = new Set();
  const dupes = new Set();

  for (const value of values) {
    if (seen.has(value)) {
      dupes.add(value);
    }

    seen.add(value);
  }

  return [...dupes];
}

async function verifyPack(pack) {
  const id = pack.id;
  const content = pack.content;
  const products = content.products ?? [];
  const categories = content.categories ?? [];
  const brands = content.brands ?? [];
  const tags = content.tags ?? [];
  const media = content.media ?? [];

  // ---------------------------------------------------------------- slug/SKU
  for (const [label, values] of [
    ["product slug", products.map((product) => product.slug)],
    ["product SKU", products.map((product) => product.sku)],
    ["category slug", categories.map((category) => category.slug)],
    ["brand slug", brands.map((brand) => brand.slug)],
    ["tag slug", tags.map((tag) => tag.slug)],
    ["media key", media.map((asset) => asset.key)]
  ]) {
    const dupes = duplicates(values);

    if (dupes.length > 0) {
      fail(id, `duplicate ${label}: ${dupes.join(", ")}`);
    }
  }

  // ------------------------------------------------- relations, images, price
  const categorySlugs = new Set(categories.map((category) => category.slug));
  const brandSlugs = new Set(brands.map((brand) => brand.slug));
  const tagSlugs = new Set(tags.map((tag) => tag.slug));

  for (const product of products) {
    if (!categorySlugs.has(product.categorySlug)) {
      fail(id, `product "${product.slug}" points at unknown category "${product.categorySlug}"`);
    }

    if (product.brandSlug && !brandSlugs.has(product.brandSlug)) {
      fail(id, `product "${product.slug}" points at unknown brand "${product.brandSlug}"`);
    }

    for (const tagSlug of product.tagSlugs ?? []) {
      if (!tagSlugs.has(tagSlug)) {
        fail(id, `product "${product.slug}" points at unknown tag "${tagSlug}"`);
      }
    }

    const frames = product.images ?? [];

    if (frames.length !== 2) {
      fail(id, `product "${product.slug}" has ${frames.length} gallery frames, expected 2`);
    }

    if (frames[0] && frames[0].url !== product.imageUrl) {
      fail(id, `product "${product.slug}" imageUrl does not match its first gallery frame`);
    }

    if (product.compareAtPrice !== undefined && product.compareAtPrice !== null) {
      const price = Number(product.price);
      const compareAt = Number(product.compareAtPrice);

      if (!(compareAt > price)) {
        fail(
          id,
          `product "${product.slug}" has compareAtPrice ${compareAt} which is not above price ${price}`
        );
      }
    }
  }

  // --------------------------------------------------------- referenced paths
  const referenced = collectAssetUrls({
    advancedSettings: content.advancedSettings,
    brands,
    categories,
    homepage: content.homepage,
    products,
    settings: content.settings
  });

  // A wide hero slide is paired with a portrait companion that the template
  // swaps in below its mobile breakpoint, so it is referenced by convention
  // rather than by a literal path in the pack.
  for (const url of [...referenced]) {
    if (/\/hero\/hero-0\d\.webp$/.test(url)) {
      referenced.add(url.replace(/hero-0\d\.webp$/, "hero-mobile.webp"));
    }
  }

  for (const url of referenced) {
    try {
      statSync(toPublicPath(url));
    } catch {
      fail(id, `referenced asset does not exist on disk: ${url}`);
    }
  }

  // ------------------------------------------------------------ media library
  const mediaUrls = new Set(media.map((asset) => asset.url));

  for (const url of referenced) {
    if (!mediaUrls.has(url)) {
      fail(id, `asset is referenced but missing from the media library: ${url}`);
    }
  }

  for (const url of mediaUrls) {
    if (!referenced.has(url)) {
      fail(id, `stale media library row - nothing references: ${url}`);
    }
  }

  for (const asset of media) {
    if (asset.key !== asset.url.replace(/^\//, "")) {
      fail(id, `media key "${asset.key}" does not match url "${asset.url}"`);
    }

    if (asset.filename !== asset.url.slice(asset.url.lastIndexOf("/") + 1)) {
      fail(id, `media filename "${asset.filename}" does not match url "${asset.url}"`);
    }

    let stats;

    try {
      stats = statSync(toPublicPath(asset.url));
    } catch {
      fail(id, `media row points at a missing file: ${asset.url}`);
      continue;
    }

    if (stats.size !== asset.size) {
      fail(id, `media size for ${asset.url} is ${asset.size}, file is ${stats.size}`);
    }

    const meta = await sharp(toPublicPath(asset.url)).metadata();

    if (meta.width !== asset.width || meta.height !== asset.height) {
      fail(
        id,
        `media dimensions for ${asset.url} are ${asset.width}x${asset.height}, file is ${meta.width}x${meta.height}`
      );
    }
  }

  // ----------------------------------------------------------- orphan files
  const verticals = new Set(
    [...referenced].map((url) => url.split("/")[2]).filter((vertical) => Boolean(vertical))
  );

  for (const vertical of verticals) {
    const verticalDir = path.join(publicDir, "demo-assets", vertical);

    for (const file of listAssetFiles(verticalDir)) {
      const url = toUrl(file);

      if (!referenced.has(url)) {
        fail(id, `orphan asset file - the pack never references it: ${url}`);
      }
    }
  }

  notes.push(
    `${id}: ${products.length} products, ${categories.length} categories, ${brands.length} brands, ${tags.length} tags, ${media.length} media rows`
  );
}

const { demoPackRegistry } = await loadRegistry();
const only = new Set(process.argv.slice(2));
const packs = Object.values(demoPackRegistry).filter(
  (pack) => only.size === 0 || only.has(pack.id)
);

if (packs.length === 0) {
  console.error(`No demo pack matched: ${[...only].join(", ")}`);
  process.exit(1);
}

for (const pack of packs) {
  await verifyPack(pack);
}

for (const note of notes) {
  console.log(`  ${note}`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} demo pack integrity problem(s):\n`);

  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }

  process.exit(1);
}

console.log("\nAll demo packs verified.");
