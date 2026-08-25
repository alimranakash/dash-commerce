import { z } from "zod";
import { campaignChannelSchema } from "./campaign.schema";

export const templateSchema = z.object({
  body: z.string().trim().min(1, "Write the message body.").max(1000),
  channel: campaignChannelSchema.default("SMS"),
  name: z.string().trim().min(2, "Template name is required.").max(140),
  subject: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => value?.trim() || undefined)
    .pipe(z.string().max(200).optional())
    .optional()
});

export type TemplateInput = z.infer<typeof templateSchema>;
export type TemplateFormInput = z.input<typeof templateSchema>;
