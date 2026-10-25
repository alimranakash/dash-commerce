import { randomUUID } from "node:crypto";
import { prisma } from "@dash/db";
import {
  NOTE_LIST_LIMIT,
  escapeLikePattern,
  type NoteChecklistItem,
  type NoteColor
} from "./note.schema";

/**
 * Every statement here names both `storeId` and `userId`, taken from the
 * session by the actions and never from the request. A note id on its own
 * reaches nothing: another store's id, or a teammate's, matches no row.
 *
 * Raw SQL rather than `prisma.storeNote`, matching `ai-provider.repository.ts`:
 * the model is in `schema.prisma` so `db:push` creates and keeps the table, but
 * a checkout that has not re-run `db:generate` has a client that has never
 * heard of it, and the idempotent DDL below means the page works on a database
 * nobody has pushed. No caller runs inside a transaction, so the DDL can never
 * wait on a lock its own caller holds.
 */

export type NoteOwner = {
  storeId: string;
  userId: string;
};

/** A row as Postgres returns it; the service validates `checklist` before trusting it. */
export type NoteRow = {
  archivedAt: Date | string | null;
  body: string;
  checklist: unknown;
  color: string;
  id: string;
  labels: string[] | null;
  pinned: boolean;
  title: string;
  updatedAt: Date | string;
  version: number;
};

export type NoteWriteValues = {
  body: string;
  checklist: NoteChecklistItem[];
  color: NoteColor;
  labels: string[];
  searchText: string;
  title: string;
};

export type NoteListFilters = {
  archived: boolean;
  label: string;
  q: string;
};

const SELECT_COLUMNS = `"id", "title", "body", "checklist", "color", COALESCE("labels", ARRAY[]::TEXT[]) AS "labels", "pinned", "archivedAt", "version", "updatedAt"`;

let ensurePromise: Promise<void> | null = null;

export async function listNoteRows(owner: NoteOwner, filters: NoteListFilters) {
  await ensureStoreNoteSchema();

  const params: unknown[] = [owner.storeId, owner.userId];
  const where = [
    `"storeId" = $1`,
    `"userId" = $2`,
    filters.archived ? `"archivedAt" IS NOT NULL` : `"archivedAt" IS NULL`
  ];

  if (filters.q) {
    params.push(`%${escapeLikePattern(filters.q)}%`);
    where.push(
      `("title" ILIKE $${params.length} ESCAPE '\\' OR "searchText" ILIKE $${params.length} ESCAPE '\\')`
    );
  }

  if (filters.label) {
    params.push(filters.label);
    where.push(
      `EXISTS (SELECT 1 FROM unnest("labels") AS "label" WHERE lower("label") = lower($${params.length}))`
    );
  }

  return prisma.$queryRawUnsafe<NoteRow[]>(
    `
    SELECT ${SELECT_COLUMNS}
    FROM ${tableName()}
    WHERE ${where.join(" AND ")}
    ORDER BY ${filters.archived ? `"archivedAt" DESC` : `"pinned" DESC, "updatedAt" DESC`}, "id" ASC
    LIMIT ${NOTE_LIST_LIMIT}
  `,
    ...params
  );
}

/** Every label this person has used in this store, archived notes included, one per spelling. */
export async function listNoteLabelRows(owner: NoteOwner) {
  await ensureStoreNoteSchema();

  const rows = await prisma.$queryRawUnsafe<Array<{ label: string }>>(
    `
    SELECT MIN("label") AS "label"
    FROM (
      SELECT unnest("labels") AS "label"
      FROM ${tableName()}
      WHERE "storeId" = $1 AND "userId" = $2
    ) AS "used"
    GROUP BY lower("label")
    ORDER BY lower("label")
    LIMIT 200
  `,
    owner.storeId,
    owner.userId
  );

  return rows.map((row) => row.label);
}

export async function findNoteRow(owner: NoteOwner, id: string) {
  await ensureStoreNoteSchema();

  const rows = await prisma.$queryRawUnsafe<NoteRow[]>(
    `
    SELECT ${SELECT_COLUMNS}
    FROM ${tableName()}
    WHERE "id" = $1 AND "storeId" = $2 AND "userId" = $3
    LIMIT 1
  `,
    id,
    owner.storeId,
    owner.userId
  );

  return rows[0] ?? null;
}

export async function insertNoteRow(owner: NoteOwner, values: NoteWriteValues) {
  await ensureStoreNoteSchema();

  const rows = await prisma.$queryRawUnsafe<NoteRow[]>(
    `
    INSERT INTO ${tableName()}
      ("id", "storeId", "userId", "title", "body", "searchText", "checklist", "color", "labels")
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::text[])
    RETURNING ${SELECT_COLUMNS}
  `,
    randomUUID(),
    owner.storeId,
    owner.userId,
    values.title,
    values.body,
    values.searchText,
    JSON.stringify(values.checklist),
    values.color,
    [...values.labels]
  );

  return rows[0] ?? null;
}

/**
 * Compare-and-set: the content is replaced only if the row is still at the
 * version the editor last saw, and the version moves on in the same statement.
 * `null` means no row matched — a stale version, or no such note for this
 * owner — and the service tells the two apart.
 */
export async function updateNoteContentRow(
  owner: NoteOwner,
  id: string,
  expectedVersion: number,
  values: NoteWriteValues
) {
  await ensureStoreNoteSchema();

  const rows = await prisma.$queryRawUnsafe<NoteRow[]>(
    `
    UPDATE ${tableName()}
    SET "title" = $5,
        "body" = $6,
        "searchText" = $7,
        "checklist" = $8::jsonb,
        "color" = $9,
        "labels" = $10::text[],
        "version" = "version" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = $1 AND "storeId" = $2 AND "userId" = $3 AND "version" = $4
    RETURNING ${SELECT_COLUMNS}
  `,
    id,
    owner.storeId,
    owner.userId,
    expectedVersion,
    values.title,
    values.body,
    values.searchText,
    JSON.stringify(values.checklist),
    values.color,
    [...values.labels]
  );

  return rows[0] ?? null;
}

/**
 * Pinning and archiving are flags, not content: they leave `version` alone, so
 * pinning a note in one tab never turns an edit in another into a conflict.
 * A pinned note is never archived — pinning brings one back, archiving unpins.
 */
export async function setNotePinnedRow(owner: NoteOwner, id: string, pinned: boolean) {
  await ensureStoreNoteSchema();

  const updated = await prisma.$executeRawUnsafe(
    `
    UPDATE ${tableName()}
    SET "pinned" = $4,
        ${pinned ? `"archivedAt" = NULL,` : ""}
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = $1 AND "storeId" = $2 AND "userId" = $3
  `,
    id,
    owner.storeId,
    owner.userId,
    pinned
  );

  return updated > 0;
}

export async function setNoteArchivedRow(owner: NoteOwner, id: string, archived: boolean) {
  await ensureStoreNoteSchema();

  const updated = await prisma.$executeRawUnsafe(
    `
    UPDATE ${tableName()}
    SET ${archived ? `"archivedAt" = COALESCE("archivedAt", CURRENT_TIMESTAMP), "pinned" = false` : `"archivedAt" = NULL`},
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = $1 AND "storeId" = $2 AND "userId" = $3
  `,
    id,
    owner.storeId,
    owner.userId
  );

  return updated > 0;
}

export async function deleteNoteRow(owner: NoteOwner, id: string) {
  await ensureStoreNoteSchema();

  const deleted = await prisma.$executeRawUnsafe(
    `DELETE FROM ${tableName()} WHERE "id" = $1 AND "storeId" = $2 AND "userId" = $3`,
    id,
    owner.storeId,
    owner.userId
  );

  return deleted > 0;
}

/**
 * Once per process. A failure is not memoised: a database that was briefly
 * unreachable should not leave notes broken until the next restart.
 */
export function ensureStoreNoteSchema() {
  ensurePromise ??= createStoreNoteSchema().catch((error: unknown) => {
    ensurePromise = null;
    throw error;
  });

  return ensurePromise;
}

async function createStoreNoteSchema() {
  const schema = getDatabaseSchemaName();

  // Column for column what `db:push` writes for the model, so a table this
  // created and one Prisma created are the same table.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schema}"."StoreNote" (
      "id" TEXT NOT NULL,
      "storeId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "title" TEXT NOT NULL DEFAULT '',
      "body" TEXT NOT NULL DEFAULT '',
      "searchText" TEXT NOT NULL DEFAULT '',
      "checklist" JSONB NOT NULL DEFAULT '[]',
      "color" TEXT NOT NULL DEFAULT 'default',
      "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
      "pinned" BOOLEAN NOT NULL DEFAULT false,
      "archivedAt" TIMESTAMP(3),
      "version" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StoreNote_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "StoreNote_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "${schema}"."Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "StoreNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "${schema}"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "StoreNote_storeId_userId_idx" ON "${schema}"."StoreNote" ("storeId", "userId")`
  );
}

function getDatabaseSchemaName() {
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

function tableName() {
  return `"${getDatabaseSchemaName()}"."StoreNote"`;
}
