import { z } from "zod";

/**
 * The canonical spelling of an address, or null if it is not one.
 *
 * Everything that reads or writes the blocklist goes through this. Two spellings
 * of the same IPv6 address are the same address — `2001:0DB8::0001` and
 * `2001:db8::1` differ only in how somebody typed them — so a list that stores
 * both has a hole in it, and a lookup that does not normalise first will miss
 * the row it is looking for. IPv4 has one spelling and needs only the wrapper
 * stripped; IPv6 is collapsed by the URL parser, which already implements the
 * canonicalisation rules so this file does not have to.
 */
export function normaliseIpAddress(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  const unbracketed = /^\[.*\]$/.test(trimmed) ? trimmed.slice(1, -1) : trimmed;
  // `X-Forwarded-For` entries occasionally carry the source port, and a seller
  // pasting from a server log will paste whatever the log wrote.
  const withoutPort = /^\d{1,3}(?:\.\d{1,3}){3}:\d{1,5}$/.test(unbracketed)
    ? unbracketed.slice(0, unbracketed.lastIndexOf(":"))
    : unbracketed;
  // An IPv4 address that arrived over an IPv6 socket is still that IPv4 address,
  // and is what the seller will see everywhere else. Storing the mapped form
  // would put the same shopper on the list twice under two unrelated strings.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(withoutPort);
  const candidate = mapped?.[1] ?? withoutPort;

  return normaliseIpv4(candidate) ?? normaliseIpv6(candidate);
}

/** Leading zeros are rejected rather than trimmed: `010` is ambiguous, not `10`. */
function normaliseIpv4(value: string) {
  if (!/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(value)) {
    return null;
  }

  return value.split(".").every((octet) => Number(octet) <= 255) ? value : null;
}

function normaliseIpv6(value: string) {
  try {
    // The parser accepts an IPv6 literal only inside brackets, and hands it back
    // canonicalised and still bracketed. Anything else it accepts as a hostname
    // would have failed the bracket wrapper first.
    const { hostname } = new URL(`http://[${value}]`);

    return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : null;
  } catch {
    return null;
  }
}

/**
 * How long a block lasts, as a seller thinks about it.
 *
 * A duration rather than a date because that is the actual decision — "block
 * this for a week" — and because a date input would drag the seller's timezone
 * into a value the server has to interpret.
 */
export const blockedIpDurationSchema = z.enum(["permanent", "1d", "7d", "30d"]);

export function expiresAtFromDuration(duration: BlockedIpDuration, now = new Date()) {
  const days = { "1d": 1, "7d": 7, "30d": 30, permanent: 0 }[duration];

  return days === 0 ? null : new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

const ipAddressSchema = z
  .string()
  .max(45, "That is longer than any IP address.")
  .transform((value) => normaliseIpAddress(value) ?? value.trim())
  .superRefine((value, ctx) => {
    if (!normaliseIpAddress(value)) {
      ctx.addIssue({ code: "custom", message: "Enter a valid IPv4 or IPv6 address." });
    }
  });

export const createBlockedIpSchema = z.object({
  duration: blockedIpDurationSchema.default("permanent"),
  ipAddress: ipAddressSchema,
  reason: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => value?.trim() || undefined)
    .pipe(z.string().max(200, "Keep the reason under 200 characters.").optional())
    .optional()
});

export type BlockedIpDuration = z.infer<typeof blockedIpDurationSchema>;
/** Raw form values, before the schema trims/normalises/validates them. */
export type BlockedIpFormInput = z.input<typeof createBlockedIpSchema>;
export type CreateBlockedIpInput = z.infer<typeof createBlockedIpSchema>;
