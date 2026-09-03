/**
 * Collapses concurrent calls of a read-repair bootstrap into one run.
 *
 * The `ensureDefault*` seeders scan for what a database is missing and create
 * it. Two callers that scan at the same time both see the same gap and both
 * try to fill it, and the loser takes a unique-constraint violation instead of
 * the row it asked for. One page is enough to cause that: `/admin/subscriptions`
 * awaits its metrics, its plans and its rows in a single `Promise.all`, and all
 * three of those call a seeder.
 *
 * Only *concurrent* callers share a result. The slot is cleared once the run
 * settles, so the next request repairs the database as it stands rather than
 * replaying an answer from an earlier one.
 */
export function singleFlight<T>(run: () => Promise<T>) {
  let inFlight: Promise<T> | null = null;

  return () => {
    if (inFlight) {
      return inFlight;
    }

    inFlight = run().finally(() => {
      inFlight = null;
    });

    return inFlight;
  };
}
