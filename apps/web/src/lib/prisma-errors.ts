/**
 * Whether a rejected Prisma write is a unique violation over `column`.
 *
 * Duck-typed rather than checked with `instanceof`, because `@dash/db` exports
 * Prisma as a type only and the error class is not available here as a value.
 *
 * The spelling has to be normalised because the layers disagree about how to
 * name what was violated, and the shape is not the one Prisma's own docs
 * describe: under `@prisma/adapter-pg` there is no `meta.target` at all, and the
 * columns arrive at `meta.driverAdapterError.cause.constraint` — as
 * `["store_id"]` for a constraint Prisma generated, and as
 * `["\"storeId\"", "\"checkoutSubmissionId\""]`, quotes and all, for an index
 * one of the `ensure*Schema` helpers wrote by hand. `meta.target` is still read
 * for the library engine, which reports a field list or a constraint name
 * instead. Matching case-insensitively without quotes or underscores is what
 * lets one predicate answer for every one of those.
 *
 * `column` alone is the test, so call this where the `try` covers writes to a
 * single model — otherwise a name two tables share could answer for the wrong
 * one.
 */
export function isUniqueConstraintError(error: unknown, column: string) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const { code, meta } = error as { code?: unknown; meta?: UniqueViolationMeta };

  if (code !== "P2002") {
    return false;
  }

  const constraint = meta?.driverAdapterError?.cause?.constraint;
  const needle = normaliseColumn(column);

  return [meta?.target, constraint?.fields, constraint?.index]
    .flat()
    .some((value) => typeof value === "string" && normaliseColumn(value).includes(needle));
}

type UniqueViolationMeta = {
  driverAdapterError?: {
    cause?: {
      constraint?: {
        fields?: string[] | undefined;
        index?: string | undefined;
      };
    };
  };
  target?: string | string[] | undefined;
};

function normaliseColumn(value: string) {
  return value.toLowerCase().replace(/["_]/g, "");
}
