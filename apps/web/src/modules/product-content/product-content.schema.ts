import { z } from "zod";

/**
 * The eight pieces of copy the studio writes, in the order the editor shows
 * them: the three that already live on `Product`, then the five that live on
 * `ProductContent`.
 *
 * One list, exported, because four other things are derived from it — the Zod
 * enum below, the field metadata the editor renders, the request sent to
 * StoreOS, and what "Generate all" means. A ninth field is added here and the
 * rest follow.
 */
export const PRODUCT_CONTENT_FIELDS = [
  "title",
  "shortDescription",
  "description",
  "features",
  "seoTitle",
  "metaDescription",
  "keywords",
  "socialCaption"
] as const;

export type ProductContentField = (typeof PRODUCT_CONTENT_FIELDS)[number];

/**
 * The fields that are columns on `Product`, saved through `updateProduct` so
 * they pick up the same slug, SKU, and tenancy rules every other product write
 * goes through. Everything else is a `ProductContent` column.
 */
export const PRODUCT_OWNED_CONTENT_FIELDS = [
  "title",
  "shortDescription",
  "description"
] as const satisfies readonly ProductContentField[];

export type ProductOwnedContentField = (typeof PRODUCT_OWNED_CONTENT_FIELDS)[number];

export function isProductOwnedContentField(
  field: ProductContentField
): field is ProductOwnedContentField {
  return (PRODUCT_OWNED_CONTENT_FIELDS as readonly ProductContentField[]).includes(field);
}

export const PRODUCT_CONTENT_TONES = ["friendly", "professional", "premium"] as const;
export type ProductContentTone = (typeof PRODUCT_CONTENT_TONES)[number];

/**
 * Bangla sits beside English because the storefronts this platform serves sell
 * in both, and the assistant already answers in `bn-BD`. It is a real choice
 * rather than a placeholder: the offline composer writes both, so picking it
 * does not quietly stop working when StoreIM AI is unreachable.
 */
export const PRODUCT_CONTENT_LANGUAGES = ["en", "bn"] as const;
export type ProductContentLanguage = (typeof PRODUCT_CONTENT_LANGUAGES)[number];

export const productContentFieldSchema = z.enum(PRODUCT_CONTENT_FIELDS);

/**
 * Per-field ceilings.
 *
 * The first three match `product.schema.ts` exactly, because that is what the
 * apply step re-validates against and a draft the seller cannot save is worse
 * than one that was never offered. The other five are the lengths the surfaces
 * they are written for actually use: a `<title>` past ~70 characters and a meta
 * description past ~160 get truncated in search results, so the editor counts
 * down to those rather than to a database limit nobody can see.
 */
export const PRODUCT_CONTENT_LIMITS: Record<ProductContentField, number> = {
  description: 10000,
  features: 2000,
  keywords: 500,
  metaDescription: 160,
  seoTitle: 70,
  shortDescription: 320,
  socialCaption: 600,
  title: 160
};

export type ProductContentFieldMeta = {
  description: string;
  label: string;
  /** How many rows of textarea the value is edited in. */
  rows: number;
};

/**
 * What each field is for, in the seller's words.
 *
 * Kept here rather than in the component so the labels the editor shows, the
 * validation messages, and any future surface that lists the fields cannot
 * drift apart.
 */
export const PRODUCT_CONTENT_FIELD_META: Record<ProductContentField, ProductContentFieldMeta> = {
  description: {
    description: "The full product story: what it is, what it is made of, and who it suits.",
    label: "Long description",
    rows: 8
  },
  features: {
    description: "One highlight per line. Reads as the bullet list on the product page.",
    label: "Features and highlights",
    rows: 5
  },
  keywords: {
    description: "Comma-separated search terms buyers would actually type.",
    label: "Keywords",
    rows: 2
  },
  metaDescription: {
    description: "The grey line under the title in search results.",
    label: "Meta description",
    rows: 3
  },
  seoTitle: {
    description: "The clickable line in search results. Keep the product name first.",
    label: "SEO title",
    rows: 2
  },
  shortDescription: {
    description: "One sentence for product cards and listings.",
    label: "Short description",
    rows: 2
  },
  socialCaption: {
    description: "A Facebook or Instagram caption, ready to paste.",
    label: "Social caption",
    rows: 4
  },
  title: {
    description: "The product name shown everywhere on the storefront.",
    label: "Product title",
    rows: 2
  }
};

/** Trimmed, capped, and empty-to-null — the shape every optional text field takes. */
function nullableText(max: number) {
  return z
    .union([z.string().trim().max(max), z.literal(""), z.null()])
    .optional()
    .transform((value) => value || null);
}

/**
 * One field's value: trimmed, and empty-to-null so a cleared textarea clears the
 * column instead of storing a blank string.
 */
function contentValueSchema(field: ProductContentField) {
  return z
    .union([z.string().trim(), z.null()])
    .transform((value) => value || null)
    .refine((value) => (value?.length ?? 0) <= PRODUCT_CONTENT_LIMITS[field], {
      message: `Keep the ${PRODUCT_CONTENT_FIELD_META[field].label.toLowerCase()} under ${PRODUCT_CONTENT_LIMITS[field]} characters.`
    });
}

/**
 * A draft, or a saved record: every field optional, every value nullable.
 *
 * One shape carries a generated draft in and a stored row out, so the editor
 * has a single type for "content" and the apply path can accept a subset
 * without a second schema describing which fields are present. An absent key
 * means "leave this field alone"; an explicit `null` means "clear it".
 */
export const productContentValuesSchema = z
  .object({
    description: contentValueSchema("description"),
    features: contentValueSchema("features"),
    keywords: contentValueSchema("keywords"),
    metaDescription: contentValueSchema("metaDescription"),
    seoTitle: contentValueSchema("seoTitle"),
    shortDescription: contentValueSchema("shortDescription"),
    socialCaption: contentValueSchema("socialCaption"),
    title: contentValueSchema("title")
  })
  .partial();

export type ProductContentValues = {
  [Field in ProductContentField]?: string | null;
};

/**
 * A product that has not been saved yet, as the form knows it.
 *
 * This is what makes the inline Generate buttons work on **New product**. None
 * of it is a selector — no id, no store, no tenant — it is the copy and the
 * catalogue labels the seller has typed, handed back so the engine has
 * something to write from. The store still comes from the session.
 */
export const productContentDraftContextSchema = z.object({
  brand: nullableText(80),
  categoryName: nullableText(120),
  description: nullableText(PRODUCT_CONTENT_LIMITS.description),
  features: nullableText(PRODUCT_CONTENT_LIMITS.features),
  keywords: nullableText(PRODUCT_CONTENT_LIMITS.keywords),
  price: nullableText(32),
  shortDescription: nullableText(PRODUCT_CONTENT_LIMITS.shortDescription),
  sku: nullableText(80),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  title: z
    .string()
    .trim()
    .min(2, "Add a product title first — the AI writes from it.")
    .max(PRODUCT_CONTENT_LIMITS.title)
});

export type ProductContentDraftContext = z.infer<typeof productContentDraftContextSchema>;

export const generateProductContentSchema = z
  .object({
    /**
     * The unsaved product, for the New product form. Ignored when `productId` is
     * present: a saved product is read from the database, which cannot be
     * talked into describing a different one.
     */
    draft: productContentDraftContextSchema.optional(),
    /**
     * Ordered and de-duplicated against the canonical list, so the request the
     * engine receives is the same whatever order the boxes were ticked in.
     */
    fields: z
      .array(productContentFieldSchema)
      .min(1, "Choose at least one field to generate.")
      .transform((fields) => PRODUCT_CONTENT_FIELDS.filter((field) => fields.includes(field))),
    /**
     * The seller's own steer, passed to the engine as written.
     *
     * `.optional()` rather than a `z.undefined()` arm in the union: in Zod 4 the
     * union alone still requires the key to be present, so a caller that simply
     * has no instructions would be rejected.
     */
    instructions: z
      .union([z.string().trim().max(500), z.null()])
      .optional()
      .transform((value) => value || null),
    /** Left unset by the inline buttons, which take the store's saved default. */
    language: z.enum(PRODUCT_CONTENT_LANGUAGES).optional(),
    /** Absent while creating, when `draft` carries the product instead. */
    productId: z.string().trim().min(1).optional(),
    tone: z.enum(PRODUCT_CONTENT_TONES).optional()
  })
  .refine((data) => Boolean(data.productId ?? data.draft), {
    error: "Save the product first, or fill in a title to generate from.",
    path: ["draft"]
  });

export const applyProductContentSchema = z.object({
  productId: z.string().trim().min(1, "Select a product."),
  /**
   * Where the copy being saved came from, when the seller is saving a draft
   * rather than their own edits. Recorded as provenance so the studio can say
   * "last generated by StoreIM AI on ...", and never read as a permission.
   */
  source: z
    .union([z.enum(["gemini", "openai", "storeos", "template"]), z.null(), z.undefined()])
    .default(null),
  values: productContentValuesSchema
});

export type GenerateProductContentInput = z.input<typeof generateProductContentSchema>;
export type ApplyProductContentInput = z.input<typeof applyProductContentSchema>;

/**
 * Where a draft came from, so the seller is never told the wrong thing.
 *
 * `gemini` and `openai` are the store's own key. `storeos` is the platform's
 * built-in engine. `template` is the offline composer in
 * `product-content-composer.ts`, which arranges the seller's own catalogue data
 * into sentences and invents nothing it was not given — and is labelled as such
 * in the editor, because calling it AI would be a lie.
 */
export type ProductContentSource = "gemini" | "openai" | "storeos" | "template";

export type ProductContentDraft = {
  source: ProductContentSource;
  values: ProductContentValues;
  /** What the seller should know about this draft. Never a URL or a variable name. */
  warnings: string[];
};
