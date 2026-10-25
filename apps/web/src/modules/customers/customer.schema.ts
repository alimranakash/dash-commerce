import { z } from "zod";

/**
 * A customer added by hand at the counter, from the sale form.
 *
 * The same rules checkout and the manual order form apply when they create a
 * customer — a name, and a number in a phone's shape — because a `Customer`
 * row cannot exist without either. A walk-in sale needs neither: this schema
 * is only reached when staff choose to save a customer.
 */
export const counterCustomerSchema = z.object({
  name: z.string().trim().min(2, "Customer name is required.").max(120),
  phone: z
    .string()
    .trim()
    .min(8, "Phone number is required.")
    .max(30)
    .regex(/^[+\d][\d\s-]+$/, "Use a valid phone number.")
});

export type CounterCustomerInput = z.input<typeof counterCustomerSchema>;
