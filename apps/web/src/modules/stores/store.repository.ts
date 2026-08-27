import { prisma } from "@dash/db";

/**
 * Store reads that are not about the *current* session.
 *
 * `queries.ts` answers "which store is this signed-in seller working in", which
 * every dashboard page needs and which starts from a cookie. This file answers
 * "tell me about store X", which is what a caller that has already resolved a
 * tenant some other way needs — today that is the machine-to-machine AI API,
 * whose tenant comes from an API key rather than a session.
 *
 * It lives here rather than in `modules/ai/` on purpose: the AI module is not
 * allowed to reach Prisma for commerce data, and a store read belongs to the
 * stores domain regardless of who is asking.
 */

/**
 * The identity of one store: the fields that describe *which shop this is* and
 * how to format numbers and times for it.
 *
 * An explicit select rather than a whole row, because this feeds an external
 * API. A column added to `Store` next month — a billing flag, an internal note —
 * must not start being disclosed because a `findUnique` was returning everything.
 * `status` is included for the caller's own gate and is not part of any response
 * contract.
 */
export async function getStoreIdentityById(storeId: string) {
  return prisma.store.findUnique({
    where: {
      id: storeId
    },
    select: {
      businessType: true,
      country: true,
      currency: true,
      id: true,
      name: true,
      slug: true,
      status: true,
      timezone: true
    }
  });
}
