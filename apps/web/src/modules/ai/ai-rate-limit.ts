/**
 * Request throttling for the AI API.
 *
 * ## What this is, and what it is not
 *
 * A per-process token bucket, the same shape as
 * `modules/courier/courier-rate-limit.ts`. It is **not** a production-grade
 * distributed limiter and must not be described as one:
 *
 * - state lives in this process's memory, so N app instances allow N times the
 *   configured rate, and a deploy resets every bucket to full;
 * - it therefore cannot enforce a billing quota, and nothing downstream should
 *   ever treat it as if it had.
 *
 * What it does buy, which is the failure mode that actually happens here, is a
 * ceiling on a runaway agent loop or a retry storm from one caller hammering a
 * single instance. Introducing Redis for the stronger guarantee would mean a new
 * infrastructure dependency, which this task explicitly rules out — so the
 * abstraction is shaped for that swap instead. `consumeAiApiToken` is the only
 * entry point and returns a decision object rather than a boolean, so replacing
 * the body with a Redis or Postgres-backed implementation changes this file and
 * nothing else.
 *
 * See `docs/ai-api.md` for the operational limitation as deployed.
 */

/** Per bucket, per window. Generous: this is an abuse ceiling, not a quota. */
const bucketCapacity = 120;
const refillWindowMs = 60_000;

/**
 * Anonymous buckets are keyed by a client-controllable address, so the map is
 * attacker-growable in a way the courier one is not. Past this many entries the
 * sweep below runs; buckets that have refilled to capacity carry no state worth
 * keeping and are dropped.
 */
const maxTrackedBuckets = 10_000;

type Bucket = {
  tokens: number;
  updatedAt: number;
};

const buckets = new Map<string, Bucket>();

export type AiRateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until one token is available again. Zero when allowed. */
  retryAfterSeconds: number;
};

/** An authenticated caller is throttled as the key, not as the address. */
export function aiApiKeyBucket(apiKeyId: string) {
  return `key:${apiKeyId}`;
}

/**
 * Everything that failed to authenticate shares an address-keyed bucket, so
 * guessing at keys costs something even though no key was ever valid.
 */
export function aiAnonymousBucket(clientIp: string | null) {
  return `anon:${clientIp ?? "unknown"}`;
}

export function consumeAiApiToken(bucketKey: string, cost = 1): AiRateLimitDecision {
  const now = Date.now();
  const bucket = buckets.get(bucketKey) ?? { tokens: bucketCapacity, updatedAt: now };
  const refill = ((now - bucket.updatedAt) / refillWindowMs) * bucketCapacity;
  const tokens = Math.min(bucketCapacity, bucket.tokens + Math.max(0, refill));

  if (buckets.size >= maxTrackedBuckets) {
    sweepFullBuckets(now);
  }

  if (tokens < cost) {
    buckets.set(bucketKey, { tokens, updatedAt: now });

    return {
      allowed: false,
      limit: bucketCapacity,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil(((cost - tokens) / bucketCapacity) * (refillWindowMs / 1000))
      )
    };
  }

  const remaining = tokens - cost;

  buckets.set(bucketKey, { tokens: remaining, updatedAt: now });

  return {
    allowed: true,
    limit: bucketCapacity,
    remaining: Math.floor(remaining),
    retryAfterSeconds: 0
  };
}

/** Exposed for the verification script, so one check cannot starve the next. */
export function resetAiApiRateLimits() {
  buckets.clear();
}

/**
 * Drops buckets that have refilled completely. A full bucket is indistinguishable
 * from one that was never created, so forgetting it loses nothing.
 */
function sweepFullBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    const refill = ((now - bucket.updatedAt) / refillWindowMs) * bucketCapacity;

    if (bucket.tokens + refill >= bucketCapacity) {
      buckets.delete(key);
    }
  }
}
