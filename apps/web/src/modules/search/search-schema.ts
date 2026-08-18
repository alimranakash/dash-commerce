import { prisma } from "@dash/db";

/**
 * Bump when {@link PRODUCT_SEARCH_VECTOR_SQL} or the trigger's column list
 * changes, so existing databases rebuild instead of keeping a stale vector.
 */
const TRIGGER_NAME = "product_search_vector_v1";

/**
 * Weighted document behind storefront relevance ranking.
 *
 * Every field is indexed twice — once through `simple` (no stemming, so exact
 * tokens and Bangla text survive) and once through `english` (so "shirts"
 * finds "shirt"). Weights are what make a title hit outrank a description hit:
 * A title, B sku, C short description, D description.
 *
 * Category and brand names are deliberately absent: they live on other tables,
 * so a rename there could not keep this column honest. The ranking query joins
 * them instead — see search.repository.ts.
 */
function productSearchVectorSql(ref: string) {
  return `
    setweight(to_tsvector('simple', coalesce(${ref}."title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(${ref}."title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(${ref}."sku", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(${ref}."shortDescription", '')), 'C') ||
    setweight(to_tsvector('english', coalesce(${ref}."shortDescription", '')), 'C') ||
    setweight(to_tsvector('english', coalesce(${ref}."description", '')), 'D')
  `;
}

export type SearchSchemaState = {
  /**
   * False when `pg_trgm` could not be installed — typo tolerance and fuzzy
   * "did you mean" are then skipped, but exact and stemmed search still work.
   */
  trigramEnabled: boolean;
};

let ensurePromise: Promise<SearchSchemaState> | null = null;

export function ensureSearchSchema() {
  ensurePromise ??= buildSearchSchema();

  return ensurePromise;
}

async function buildSearchSchema(): Promise<SearchSchemaState> {
  const schema = getDatabaseSchemaName();
  const productTable = `"${schema}"."Product"`;

  // `db:push` leaves this column alone because schema.prisma declares it, but
  // it is still recreated here so a fresh database needs no manual step.
  await prisma.$executeRawUnsafe(
    `ALTER TABLE ${productTable} ADD COLUMN IF NOT EXISTS "searchVector" tsvector`
  );

  const trigramEnabled = await enableTrigram();

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION "${schema}"."${TRIGGER_NAME}"() RETURNS trigger AS $$
    BEGIN
      NEW."searchVector" := ${productSearchVectorSql("NEW")};
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);

  // Conditional so the ACCESS EXCLUSIVE lock a CREATE TRIGGER takes is paid
  // once per database rather than once per server boot.
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = '${TRIGGER_NAME}'
          AND tgrelid = '${productTable}'::regclass
      ) THEN
        CREATE TRIGGER "${TRIGGER_NAME}"
        BEFORE INSERT OR UPDATE OF "title", "sku", "shortDescription", "description"
        ON ${productTable}
        FOR EACH ROW EXECUTE FUNCTION "${schema}"."${TRIGGER_NAME}"();
      END IF;
    END
    $$
  `);

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Product_searchVector_idx" ON ${productTable} USING GIN ("searchVector")`
  );

  // Rows written before the trigger existed, plus everything `db:push` would
  // have blanked if the column were ever recreated. `updatedAt` is left alone
  // on purpose — storefront sections order by it.
  await prisma.$executeRawUnsafe(`
    UPDATE ${productTable} AS product
    SET "searchVector" = ${productSearchVectorSql("product")}
    WHERE product."searchVector" IS NULL
  `);

  return { trigramEnabled };
}

/**
 * Trigram matching is a nice-to-have, not a requirement: a managed database
 * may refuse `CREATE EXTENSION`. Failing softly keeps search working there.
 */
async function enableTrigram() {
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    return true;
  } catch {
    return false;
  }
}

export function getDatabaseSchemaName() {
  const fallbackSchema = "public";
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return fallbackSchema;
  }

  try {
    const schema = new URL(connectionString).searchParams.get("schema") ?? fallbackSchema;

    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(schema) ? schema : fallbackSchema;
  } catch {
    return fallbackSchema;
  }
}
