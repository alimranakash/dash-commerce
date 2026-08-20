import { z } from "zod";

export const planInputSchema = z.object({
  aiEnabled: z.boolean().default(false),
  currency: z.string().trim().min(2, "Currency is required.").max(8),
  customDomainEnabled: z.boolean().default(false),
  customerLimit: z.coerce.number().int().min(0, "Customer limit cannot be negative."),
  description: z.string().trim().max(500, "Description must be 500 characters or less.").optional(),
  isActive: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  orderLimit: z.coerce.number().int().min(0, "Order limit cannot be negative."),
  posEnabled: z.boolean().default(false),
  priceMonthly: z.coerce.number().min(0, "Monthly price cannot be negative."),
  priceYearly: z.coerce.number().min(0, "Yearly price cannot be negative."),
  productLimit: z.coerce.number().int().min(0, "Product limit cannot be negative."),
  // 0 means unlimited, the same convention every other limit on a plan uses.
  smsLimit: z.coerce.number().int().min(0, "SMS limit cannot be negative."),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,60}$/, "Slug can use lowercase letters, numbers, and hyphens."),
  sortOrder: z.coerce.number().int().min(0, "Sort order cannot be negative."),
  staffLimit: z.coerce.number().int().min(0, "Staff limit cannot be negative."),
  storeLimit: z.coerce.number().int().min(0, "Store limit cannot be negative."),
  trialDays: z.coerce.number().int().min(0, "Trial days cannot be negative.")
});

export type PlanInput = z.infer<typeof planInputSchema>;
