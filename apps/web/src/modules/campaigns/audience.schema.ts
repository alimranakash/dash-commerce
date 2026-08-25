import { z } from "zod";

/**
 * How a seller describes who a campaign is for.
 *
 * Stored as JSON on `CampaignAudience.rules` and frozen onto the campaign when
 * a send begins. Everything here is a *rule*, never a list of customer ids —
 * "people who have never ordered" has to mean the people who qualify on the day
 * it runs, not the ones who qualified when the segment was saved.
 *
 * Rules are combined with AND. A seller reaching for "A or B" is better served
 * by two campaigns than by a boolean builder nobody can read back later.
 */

export const audienceRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("all") }),
  z.object({ type: z.literal("has_ordered") }),
  z.object({ type: z.literal("never_ordered") }),
  z.object({ minOrders: z.number().int().min(1).max(10_000), type: z.literal("min_orders") }),
  z.object({ minSpend: z.number().min(0).max(100_000_000), type: z.literal("min_spend") }),
  /** Customers whose most recent order is older than N days — the win-back segment. */
  z.object({ days: z.number().int().min(1).max(3650), type: z.literal("inactive_days") }),
  z.object({ type: z.literal("has_abandoned_cart") }),
  // Mirrors `CustomerFlagStatus` in schema.prisma. Kept as an explicit list
  // rather than a loose string so a value the database does not have fails to
  // save instead of quietly matching nobody.
  z.object({
    status: z.enum(["NORMAL", "WATCHLIST", "BLOCKED"]),
    type: z.literal("flag_status")
  })
]);

export const audienceRulesSchema = z
  .array(audienceRuleSchema)
  .max(10, "An audience takes at most 10 rules.")
  // An empty rule set is "everyone" spelled ambiguously. Saying so explicitly
  // keeps `compileAudienceRules` from having to guess at intent.
  .transform((rules) => (rules.length === 0 ? [{ type: "all" as const }] : rules));

export const audienceSchema = z.object({
  description: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => value?.trim() || undefined)
    .optional(),
  name: z.string().trim().min(2, "Audience name is required.").max(140),
  rules: audienceRulesSchema
});

export type AudienceRule = z.infer<typeof audienceRuleSchema>;
export type AudienceRules = z.infer<typeof audienceRulesSchema>;
export type AudienceInput = z.infer<typeof audienceSchema>;

/** Everyone. The default a campaign gets when no audience is chosen. */
export const ALL_CUSTOMERS_RULES: AudienceRules = [{ type: "all" }];

/** One-line summary of a rule set, for list rows and the send confirmation. */
export function describeAudienceRules(rules: AudienceRules): string {
  if (rules.length === 1 && rules[0]?.type === "all") {
    return "All customers";
  }

  return rules.map(describeRule).join(" and ");
}

function describeRule(rule: AudienceRule): string {
  switch (rule.type) {
    case "all":
      return "all customers";
    case "has_ordered":
      return "have ordered";
    case "never_ordered":
      return "have never ordered";
    case "min_orders":
      return `${rule.minOrders}+ orders`;
    case "min_spend":
      return `spent ${rule.minSpend} or more`;
    case "inactive_days":
      return `no order in ${rule.days} days`;
    case "has_abandoned_cart":
      return "abandoned a cart";
    case "flag_status":
      return `flagged ${rule.status.toLowerCase()}`;
  }
}
