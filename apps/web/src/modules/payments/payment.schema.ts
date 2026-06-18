import { z } from "zod";

export const paymentMethodTypes = ["COD", "BKASH_MANUAL", "NAGAD_MANUAL", "ROCKET_MANUAL"] as const;

export const paymentMethodSchema = z.object({
  type: z.enum(paymentMethodTypes),
  name: z.string().trim().min(2, "Display name is required.").max(80),
  description: optionalText(240),
  instructions: optionalText(1000),
  accountNumber: optionalText(40),
  accountType: optionalText(80),
  isEnabled: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(100).default(0)
});

export const paymentSettingsSchema = z.object({
  methods: z.array(paymentMethodSchema).length(paymentMethodTypes.length)
});

export type PaymentMethodTypeValue = (typeof paymentMethodTypes)[number];
export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>;
export type PaymentSettingsInput = z.infer<typeof paymentSettingsSchema>;

function optionalText(max: number) {
  return z
    .union([z.string().trim().max(max), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (value ? value : undefined));
}
