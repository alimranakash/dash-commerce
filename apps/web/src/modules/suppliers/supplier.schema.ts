import { z } from "zod";

export const supplierStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

const supplierBaseSchema = z.object({
  name: z.string().trim().min(2, "Supplier name is required.").max(140),
  companyName: z.string().trim().max(160).optional(),
  phone: z.string().trim().min(5, "Phone number is required.").max(40),
  email: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .pipe(z.email("Enter a valid email address.").optional()),
  address: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
  status: supplierStatusSchema.default("ACTIVE")
});

export const createSupplierSchema = supplierBaseSchema;
export const updateSupplierSchema = supplierBaseSchema.partial();

export type SupplierStatus = z.infer<typeof supplierStatusSchema>;
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
