import { z } from "zod";

const optionalText = (max = 160) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

const moneyString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Use a valid amount.")
  .refine((value) => Number(value) >= 0, "Amount must be zero or more.");

export const shippingZoneInputSchema = z.object({
  id: z.string().trim().min(1),
  description: optionalText(240),
  isEnabled: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(1000)
});

export const shippingRateInputSchema = z.object({
  id: z.string().trim().min(1).optional(),
  zoneId: z.string().trim().min(1, "Choose a zone."),
  name: z.string().trim().min(2, "Rate name is required.").max(120),
  district: optionalText(100),
  city: optionalText(100),
  area: optionalText(100),
  amount: moneyString,
  isEnabled: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(1000)
});

export const shippingSettingsSchema = z.object({
  zones: z.array(shippingZoneInputSchema).min(1),
  rates: z.array(shippingRateInputSchema),
  deleteRateIds: z.array(z.string().trim().min(1)),
  newRate: shippingRateInputSchema.optional()
});

export type ShippingZoneInput = z.infer<typeof shippingZoneInputSchema>;
export type ShippingRateInput = z.infer<typeof shippingRateInputSchema>;
export type ShippingSettingsInput = z.infer<typeof shippingSettingsSchema>;
