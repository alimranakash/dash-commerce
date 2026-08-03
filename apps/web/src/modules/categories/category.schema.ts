import { z } from "zod";
import { normalizeSlug } from "../../lib/slug";

const categoryBaseSchema = z.object({
  name: z.string().trim().min(2, "Category name is required.").max(120),
  slug: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? normalizeSlug(value) : undefined)),
  description: z
    .union([z.string().trim().max(2000), z.null(), z.undefined()])
    .transform((value) => value || null),
  imageUrl: z
    .union([z.string().trim(), z.null(), z.undefined()])
    .transform((value) => (value ? value : null)),
  parentId: z
    .union([z.string().trim(), z.null(), z.undefined()])
    .transform((value) => value || null)
});

export const createCategorySchema = categoryBaseSchema;
export const updateCategorySchema = categoryBaseSchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
