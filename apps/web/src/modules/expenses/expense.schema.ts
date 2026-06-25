import { z } from "zod";

export const expenseStatusSchema = z.enum(["PAID", "PENDING", "CANCELLED"]);
export const expensePaymentMethodSchema = z.enum(["CASH", "BANK", "BKASH", "NAGAD", "CARD", "OTHER"]);

export const expenseCategorySchema = z.object({
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a valid hex color.").default("#7C3AED"),
  icon: z.string().trim().max(40).default("receipt"),
  name: z.string().trim().min(2, "Category name is required.").max(80)
});

const moneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), {
    message: "Use a valid amount with up to 2 decimal places."
  });

export const expenseBaseSchema = z.object({
  amount: moneySchema,
  attachmentUrl: z
    .union([z.url("Use a valid attachment URL."), z.literal(""), z.null(), z.undefined()])
    .transform((value) => value || undefined),
  categoryId: z.string().trim().min(1, "Select an expense category."),
  expenseDate: z.string().trim().min(1, "Expense date is required."),
  notes: z.string().trim().max(2000).optional(),
  paymentMethod: expensePaymentMethodSchema.default("CASH"),
  reference: z.string().trim().max(160).optional(),
  status: expenseStatusSchema.default("PENDING"),
  title: z.string().trim().min(2, "Expense title is required.").max(160)
});

export const createExpenseSchema = expenseBaseSchema;
export const updateExpenseSchema = expenseBaseSchema;

export type ExpenseStatus = z.infer<typeof expenseStatusSchema>;
export type ExpensePaymentMethod = z.infer<typeof expensePaymentMethodSchema>;
export type ExpenseCategoryInput = z.infer<typeof expenseCategorySchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
