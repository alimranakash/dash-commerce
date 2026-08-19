import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import "../../../lib/env";

/**
 * Generating and checking the six digits themselves.
 *
 * `randomInt` rather than `Math.random`: the code is the only thing standing
 * between a stranger and an account, and `Math.random` is seeded state an
 * attacker who sees one output can continue predicting.
 *
 * Only a hash is ever stored. A six-digit code is trivially brute-forced from a
 * hash offline, so the point is not secrecy of the code — it is that a leaked
 * database row cannot be replayed against a live challenge, since the hash is
 * bound to both a server secret and the identifier it was issued for.
 */

const codeLength = 6;
const codeCeiling = 10 ** codeLength;

export function generateOtpCode() {
  return String(randomInt(0, codeCeiling)).padStart(codeLength, "0");
}

export function hashOtpCode(identifier: string, code: string) {
  return createHash("sha256").update(`${readSecret()}:${identifier}:${code}`).digest("hex");
}

/** Constant-time, so a wrong code cannot be narrowed down by timing the reply. */
export function matchesOtpCode(identifier: string, code: string, storedHash: string) {
  const candidate = Buffer.from(hashOtpCode(identifier, code), "utf8");
  const stored = Buffer.from(storedHash, "utf8");

  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

/**
 * `OTP_SECRET` is optional: an install that never sets it still gets a stable,
 * deployment-specific pepper from the NextAuth secret rather than a constant
 * baked into the source. Rotating either invalidates codes already in flight,
 * which is a few minutes of failed verifications and nothing worse.
 */
function readSecret() {
  return process.env.OTP_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dash-commerce-local-otp-pepper";
}
