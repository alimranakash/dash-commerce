import { z } from "zod";

export const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(120),
  phone: z
    .string()
    .trim()
    .min(8, "Phone number is required.")
    .max(30)
    .regex(/^[+\d][\d\s-]+$/, "Use a valid phone number."),
  email: z
    .union([z.email("Use a valid email address."), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (value ? value : undefined)),
  country: z.string().trim().min(2).max(80).default("Bangladesh"),
  district: z.string().trim().min(2, "District is required.").max(100),
  city: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
  area: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
  addressLine1: z.string().trim().min(8, "Full address is required.").max(320),
  addressLine2: z
    .string()
    .trim()
    .max(320)
    .optional()
    .transform((value) => value || undefined),
  postalCode: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((value) => value || undefined),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => value || undefined),
  paymentMethod: z.literal("COD")
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
