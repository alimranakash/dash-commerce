import { CourierError } from "./courier-errors";

/**
 * Per (storeId, provider) token bucket, so one store cannot hammer a carrier's
 * API — or burn through its own rate allowance — on behalf of everyone else.
 *
 * Deliberately in-process: it protects against click-spam and runaway loops,
 * which is what actually happens here. A multi-instance deployment would need a
 * shared store, and until then the DB idempotency constraint, not this bucket,
 * is what guarantees a parcel is never booked twice.
 */

const bucketCapacity = 30;
const refillWindowMs = 60_000;

type Bucket = {
  tokens: number;
  updatedAt: number;
};

const buckets = new Map<string, Bucket>();

export function consumeCourierToken(storeId: string, provider: string, cost = 1) {
  const key = `${storeId}:${provider}`;
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: bucketCapacity, updatedAt: now };
  const refill = ((now - bucket.updatedAt) / refillWindowMs) * bucketCapacity;
  const tokens = Math.min(bucketCapacity, bucket.tokens + Math.max(0, refill));

  if (tokens < cost) {
    buckets.set(key, { tokens, updatedAt: now });

    return false;
  }

  buckets.set(key, { tokens: tokens - cost, updatedAt: now });

  return true;
}

export function assertCourierRateLimit(storeId: string, provider: string, cost = 1) {
  if (!consumeCourierToken(storeId, provider, cost)) {
    throw new CourierError("RATE_LIMIT", "Too many courier requests for this store right now.");
  }
}
