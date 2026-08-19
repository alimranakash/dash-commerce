/**
 * The caller's address, as best a reverse proxy will tell us.
 *
 * Behind Caddy the socket address is always the proxy, so `X-Forwarded-For` is
 * the only useful signal — and its first entry is the client, the rest being
 * the hops in between. It is client-controllable and therefore worthless as
 * identity; it is used here purely to make abuse cost something, which is all a
 * rate-limit bucket needs from it.
 */
export function readClientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();

  if (first) {
    return first.slice(0, 45);
  }

  return headers.get("x-real-ip")?.trim().slice(0, 45) ?? null;
}
