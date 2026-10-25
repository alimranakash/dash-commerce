import { z } from "zod";
import {
  ledgerEntryProblem,
  LOYALTY_ADJUSTMENT_MAX,
  LOYALTY_POINTS_MAX,
  loyaltyLedgerKey
} from "./loyalty.rules";

export const LOYALTY_TRANSACTION_TYPES = [
  "EARN",
  "EARN_REVERSAL",
  "REDEEM",
  "REDEEM_REVERSAL",
  "ADJUSTMENT"
] as const;

/** In the order `schema.prisma` declares them; `verify-loyalty` holds the two together. */
export const LOYALTY_SOURCE_TYPES = ["ORDER", "MANUAL", "SALE"] as const;

export type LoyaltyTransactionType = (typeof LOYALTY_TRANSACTION_TYPES)[number];
export type LoyaltySourceType = (typeof LOYALTY_SOURCE_TYPES)[number];

export const LOYALTY_PROGRAM_NAME_MAX = 60;
export const LOYALTY_AMOUNT_PER_POINT_MAX = 1_000_000;
export const LOYALTY_NOTE_MAX = 500;

/**
 * Exactly what `loyaltyLedgerKey` writes: `<source>:<id>:<purpose>:<sequence>`.
 * A key in any other shape was not made by the ledger's own builder.
 */
export const LOYALTY_LEDGER_KEY_PATTERN =
  /^(?:order|manual|sale):[A-Za-z0-9_-]{1,64}:(?:adjust|earn|redeem|redeem-reversal):\d{1,9}$/;

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Use a valid id.");

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]+/g;

/**
 * Money per point, as the cents-exact string the database column holds.
 * Positive: a point that costs nothing would be a programme that pays out on
 * an empty basket.
 */
const amountPerPointSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), {
    message: "Use an amount with up to 2 decimal places."
  })
  .refine((value) => Number(value) > 0, { message: "A point has to cost more than nothing." })
  .refine((value) => Number(value) <= LOYALTY_AMOUNT_PER_POINT_MAX, {
    message: `Keep the amount per point at or under ${LOYALTY_AMOUNT_PER_POINT_MAX}.`
  })
  .transform((value) => Number(value).toFixed(2));

/** Whole numbers posted as form text, refused rather than rounded. */
const wholeNumberSchema = (min: number, max: number, label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => String(value).trim())
    .refine((value) => /^\d{1,9}$/.test(value), { message: `${label} must be a whole number.` })
    .transform((value) => Number(value))
    .refine((value) => value >= min && value <= max, {
      message: `${label} must be between ${min} and ${max.toLocaleString("en")}.`
    });

export const loyaltySettingsSchema = z.object({
  amountPerPoint: amountPerPointSchema,
  enabled: z.boolean(),
  maxRedeemPercent: wholeNumberSchema(1, 100, "The share points may cover"),
  minRedeemPoints: wholeNumberSchema(1, LOYALTY_ADJUSTMENT_MAX, "The minimum to redeem"),
  // The same cents-exact money rule as the spend per point: positive, two places.
  pointValue: z
    .union([z.string(), z.number()])
    .transform((value) => String(value).trim())
    .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), {
      message: "Use a point value with up to 2 decimal places."
    })
    .refine((value) => Number(value) > 0, { message: "A point has to be worth something." })
    .refine((value) => Number(value) <= LOYALTY_AMOUNT_PER_POINT_MAX, {
      message: `Keep a point's value at or under ${LOYALTY_AMOUNT_PER_POINT_MAX}.`
    })
    .transform((value) => Number(value).toFixed(2)),
  // One line: it is a name shoppers will read, and a pasted newline or
  // control character has nowhere sensible to go.
  programName: z
    .string()
    .transform((value) => value.replace(CONTROL_CHARACTERS, " ").replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(1, "Give the programme a name.")
        .max(
          LOYALTY_PROGRAM_NAME_MAX,
          `Keep the name under ${LOYALTY_PROGRAM_NAME_MAX} characters.`
        )
    ),
  redemptionEnabled: z.boolean()
});

export type LoyaltySettingsInput = z.input<typeof loyaltySettingsSchema>;
export type LoyaltySettings = z.output<typeof loyaltySettingsSchema>;

export const LOYALTY_SETTINGS_DEFAULTS: LoyaltySettings = {
  amountPerPoint: "100.00",
  enabled: false,
  maxRedeemPercent: 50,
  minRedeemPoints: 100,
  pointValue: "1.00",
  programName: "Rewards",
  redemptionEnabled: false
};

/**
 * One ledger write, as the server composes it. Nothing here is read from a
 * form: the points come from `loyalty.rules.ts`, the member from a store-scoped
 * lookup, the actor from the session.
 */
export const loyaltyLedgerEntrySchema = z
  .object({
    actorUserId: idSchema.nullable(),
    // The rate an earn row was priced at. Only order and sale earn rows carry one.
    amountPerPoint: amountPerPointSchema.nullable().optional(),
    idempotencyKey: z.string().regex(LOYALTY_LEDGER_KEY_PATTERN, "Use a ledger key."),
    memberId: idSchema,
    note: z
      .string()
      .trim()
      .max(LOYALTY_NOTE_MAX)
      .nullable()
      .transform((value) => (value ? value : null)),
    points: z.number().int().min(-LOYALTY_POINTS_MAX).max(LOYALTY_POINTS_MAX),
    sourceId: idSchema.nullable(),
    sourceType: z.enum(LOYALTY_SOURCE_TYPES),
    type: z.enum(LOYALTY_TRANSACTION_TYPES)
  })
  .superRefine((entry, context) => {
    const problem = ledgerEntryProblem(entry);

    if (problem) {
      context.addIssue({ code: "custom", message: problem, path: ["points"] });
    }
  });

export type LoyaltyLedgerEntryInput = z.input<typeof loyaltyLedgerEntrySchema>;
export type LoyaltyLedgerEntry = z.output<typeof loyaltyLedgerEntrySchema>;

export const LOYALTY_ADJUSTMENT_REASON_MIN = 3;

/**
 * A manual adjustment as the form posts it. The member, the amount and the
 * reason are the seller's; the store and the person making it come from the
 * session and are never part of this.
 *
 * `requestId` is minted by the server when the form is drawn and travels back
 * with it. It is only ever an idempotency key — the same submission arriving
 * twice records one adjustment — so a forged one can at worst collide with an
 * adjustment it does not match, which the ledger refuses.
 */
export const loyaltyAdjustmentSchema = z.object({
  memberId: idSchema,
  points: z
    .union([z.string(), z.number()])
    .transform((value) => String(value).trim())
    .refine((value) => /^[+-]?\d{1,9}$/.test(value), {
      message: "Enter a whole number of points, with a minus sign to take points away."
    })
    .transform((value) => Number(value))
    .refine((value) => value !== 0, { message: "An adjustment has to change the balance." })
    .refine((value) => Math.abs(value) <= LOYALTY_ADJUSTMENT_MAX, {
      message: `Adjust by at most ${LOYALTY_ADJUSTMENT_MAX.toLocaleString("en")} points at a time.`
    }),
  reason: z
    .string()
    .transform((value) => value.replace(CONTROL_CHARACTERS, " ").replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(LOYALTY_ADJUSTMENT_REASON_MIN, "Say why — the reason is kept with the adjustment.")
        .max(LOYALTY_NOTE_MAX, `Keep the reason under ${LOYALTY_NOTE_MAX} characters.`)
    ),
  requestId: idSchema
});

export type LoyaltyAdjustmentInput = z.input<typeof loyaltyAdjustmentSchema>;
export type LoyaltyAdjustment = z.output<typeof loyaltyAdjustmentSchema>;

/**
 * The ledger row a manual adjustment becomes: an ADJUSTMENT from a MANUAL
 * source, keyed by the form's request id, naming who made it and why.
 */
export function adjustmentLedgerEntry(
  adjustment: LoyaltyAdjustment,
  actorUserId: string
): LoyaltyLedgerEntryInput {
  return {
    actorUserId,
    idempotencyKey: loyaltyLedgerKey({
      purpose: "adjust",
      sequence: 0,
      sourceId: adjustment.requestId,
      sourceType: "MANUAL"
    }),
    memberId: adjustment.memberId,
    note: adjustment.reason,
    points: adjustment.points,
    sourceId: null,
    sourceType: "MANUAL",
    type: "ADJUSTMENT"
  };
}

/** A membership id or conflict id posted back by a dashboard form. */
export const loyaltyRecordIdSchema = idSchema;
