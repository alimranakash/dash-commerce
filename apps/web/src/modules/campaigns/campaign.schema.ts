import { z } from "zod";
import { audienceRulesSchema } from "./audience.schema";

export const campaignChannelSchema = z.enum(["SMS", "EMAIL"]);

/**
 * One SMS segment is 160 GSM-7 characters, or 70 if the message contains any
 * non-Latin character — which every Bangla message does. Sellers are billed per
 * segment, so the limit here is about cost, not about what the gateway accepts.
 */
export const SMS_SEGMENT_LIMIT_GSM7 = 160;
export const SMS_SEGMENT_LIMIT_UNICODE = 70;
const SMS_BODY_MAX = 1000;

export const campaignBaseSchema = z.object({
  /** A saved segment. Mutually exclusive with `rules`; `audienceId` wins. */
  audienceId: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => value?.trim() || undefined)
    .optional(),
  body: z.string().trim().min(1, "Write the message you want to send.").max(SMS_BODY_MAX),
  channel: campaignChannelSchema.default("SMS"),
  couponId: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => value?.trim() || undefined)
    .optional(),
  name: z.string().trim().min(2, "Campaign name is required.").max(140),
  /** Rules written on the campaign itself, when no saved audience is used. */
  rules: audienceRulesSchema.optional(),
  subject: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => value?.trim() || undefined)
    .pipe(z.string().max(200).optional())
    .optional()
});

export const createCampaignSchema = campaignBaseSchema.superRefine((value, ctx) => {
  if (value.channel === "EMAIL" && !value.subject) {
    ctx.addIssue({
      code: "custom",
      message: "An email campaign needs a subject line.",
      path: ["subject"]
    });
  }
});

export const updateCampaignSchema = createCampaignSchema;

export type CampaignChannel = z.infer<typeof campaignChannelSchema>;
export type CampaignFormInput = z.input<typeof createCampaignSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

/**
 * What one message will cost the store, in SMS segments.
 *
 * Any non-ASCII character drops the whole message to the 70-character Unicode
 * alphabet — a single Bangla word in an otherwise English message more than
 * halves how much fits in a segment, which is exactly the kind of surprise a
 * seller should see before they send to five thousand people.
 *
 * GSM-7 is not exactly ASCII, but the difference only ever makes this estimate
 * pessimistic, and a cost estimate that errs high is the harmless direction.
 */
export function countSmsSegments(body: string) {
  const unicode = [...body].some((character) => character.charCodeAt(0) > 127);
  const limit = unicode ? SMS_SEGMENT_LIMIT_UNICODE : SMS_SEGMENT_LIMIT_GSM7;
  // Concatenated messages spend part of each segment on the join header, so a
  // long message fits less per part than a single-segment one does.
  const perPart = unicode ? 67 : 153;

  if (body.length === 0) {
    return { limit, segments: 0, unicode };
  }

  if (body.length <= limit) {
    return { limit, segments: 1, unicode };
  }

  return { limit, segments: Math.ceil(body.length / perPart), unicode };
}
