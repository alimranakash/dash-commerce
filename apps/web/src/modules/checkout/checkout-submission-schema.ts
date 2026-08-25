import { prisma } from "@dash/db";
import { getDatabaseSchemaName } from "../fake-orders/fake-order-risk-schema";

/**
 * Self-healing DDL for the checkout submission key, in the same shape as
 * `ensureFakeOrderRiskSchema` — see CLAUDE.md.
 *
 * The unique index is the whole point of the column: `createCheckoutOrder`
 * looks for an existing order before creating one, but two taps close enough
 * together both pass that read, and only the database can break the tie.
 *
 * It is deliberately a **partial** index rather than an `@@unique` in
 * schema.prisma, for two reasons that both had to hold:
 *
 *  - `db push` refuses to add a unique constraint without `--accept-data-loss`,
 *    and `deploy/bin/release.sh` runs `db push` unattended. Declaring it in
 *    schema.prisma would fail every deploy against an existing database.
 *  - `db push` *drops* a plain index it does not know about — measured, not
 *    assumed. A `WHERE` clause is something Prisma cannot express at all, so
 *    the diff ignores this one entirely, the same way it ignores the expression
 *    index in `fake-order-risk-schema`. Verified: it survives `db push`.
 *
 * Excluding nulls is also the honest statement of the rule. Orders the seller
 * typed in by hand and every order placed before this shipped carry no key, and
 * "no key" is not a value that can collide with another.
 *
 * The column itself is in schema.prisma and arrives with `db push`; it is
 * repeated here so a database that has not had `db push` run still takes orders
 * rather than 500ing at checkout.
 */

let ensurePromise: Promise<void> | null = null;

export function ensureCheckoutSubmissionSchema() {
  ensurePromise ??= addSubmissionColumn().catch((error) => {
    // A failed migration must not be cached as "done" — the next caller retries.
    ensurePromise = null;

    throw error;
  });

  return ensurePromise;
}

async function addSubmissionColumn() {
  const schema = getDatabaseSchemaName();
  const orderTable = `"${schema}"."Order"`;

  await prisma.$executeRawUnsafe(
    `ALTER TABLE ${orderTable} ADD COLUMN IF NOT EXISTS "checkoutSubmissionId" TEXT`
  );

  // Named so Prisma would never generate it, because it is ours to keep.
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Order_checkout_submission_unique"
       ON ${orderTable} ("storeId", "checkoutSubmissionId")
       WHERE "checkoutSubmissionId" IS NOT NULL`
  );
}
