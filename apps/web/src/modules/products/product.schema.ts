import { z } from "zod";
import { normalizeSlug } from "../../lib/slug";

export const productStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

const moneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), {
    message: "Use a valid amount with up to 2 decimal places."
  });

const optionalMoneySchema = z
  .union([moneySchema, z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value ? value : null));

const productImageSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Choose a product image or remove the empty image slot.")
    .max(20000)
    .refine(isValidProductImagePath, {
      message: "Use a valid image URL or uploaded media path."
    }),
  alt: z.string().trim().max(160).optional(),
  position: z.coerce.number().int().min(0).default(0)
});

const productBaseSchema = z.object({
  title: z.string().trim().min(2, "Product title is required.").max(160),
  slug: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? normalizeSlug(value) : undefined)),
  description: z
    .union([z.string().trim().max(10000), z.null(), z.undefined()])
    .transform((value) => value || null),
  shortDescription: z
    .union([z.string().trim().max(320), z.null(), z.undefined()])
    .transform((value) => value || null),
  sku: z
    .union([z.string().trim().max(80), z.null(), z.undefined()])
    .transform((value) => value || null),
  price: moneySchema,
  compareAtPrice: optionalMoneySchema,
  costPrice: optionalMoneySchema,
  stockQuantity: z.coerce.number().int().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(0),
  /**
   * Taking orders for stock that has not arrived.
   *
   * The date is what the shopper is shown beside the button, so it is worth
   * asking for even though it is optional — "pre-order" with no date reads as
   * a delay of unknown length.
   */
  allowPreorder: z.coerce.boolean().default(false),
  freeShipping: z.coerce.boolean().default(false),
  preorderReleaseAt: z
    .union([z.string().trim(), z.date(), z.null(), z.undefined()])
    .transform((value) => {
      if (!value) {
        return null;
      }

      const date = new Date(value);

      return Number.isNaN(date.getTime()) ? null : date;
    }),
  status: productStatusSchema.default("DRAFT"),
  visibility: z.enum(["PUBLIC", "HIDDEN"]).default("HIDDEN"),
  categoryId: z
    .union([z.string().trim(), z.null(), z.undefined()])
    .transform((value) => (value ? value : null)),
  images: z.array(productImageSchema).max(4).default([])
});

export const createProductSchema = productBaseSchema;

export const updateProductSchema = productBaseSchema.partial().extend({
  images: z.array(productImageSchema).max(4).optional()
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

function isValidProductImagePath(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) {
    return true;
  }

  if (/^data:image\/(jpeg|jpg|png|webp|svg\+xml);/i.test(value)) {
    return true;
  }

  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
