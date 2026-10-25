import { z } from "zod";
import { LABEL_PRESET_IDS } from "./barcode-label.layout";

/**
 * Long enough for any retail symbology a shop meets (EAN-13, UPC, ISBN) and an
 * SKU-style code; much longer and Code 128 stops fitting a 38 mm label at a bar
 * width a thermal printer can draw.
 */
export const BARCODE_MAX_LENGTH = 32;

/**
 * One spelling for a code, wherever it comes from — the product form, a
 * scanner, a search box.
 *
 * Whitespace goes because a scanner never sends it inside a code but a person
 * copying the digits printed under an EAN-13 types it between the groups, and
 * a scanner's own Enter or Tab suffix arrives as trailing control characters.
 * Upper case because a keyboard-wedge scanner types through the OS keyboard,
 * and Caps Lock left on at the till inverts every letter it sends: a code
 * stored as typed would stop matching the moment someone pressed it.
 */
export function normalizeBarcodeValue(raw: string) {
  let value = "";

  for (const char of raw) {
    const code = char.charCodeAt(0);

    // Space and every control character below it, DEL, and Unicode whitespace.
    if (code <= 0x20 || code === 0x7f || /\s/.test(char)) {
      continue;
    }

    value += char;
  }

  return value.toUpperCase();
}

const storedBarcodeSchema = z
  .string()
  .max(BARCODE_MAX_LENGTH, `Keep the barcode under ${BARCODE_MAX_LENGTH + 1} characters.`)
  .regex(/^[\x21-\x7E]+$/, "Use letters, digits and common symbols only in the barcode.");

/** A product's barcode field: blank clears it, anything else is normalised then checked. */
export const optionalBarcodeSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => normalizeBarcodeValue(value ?? ""))
  .pipe(z.union([z.literal(""), storedBarcodeSchema]))
  .transform((value) => value || null);

/** One print run's worth; a run larger than this is better split anyway. */
export const MAX_LABEL_PRODUCTS = 500;

/** Counts a product and each of its variants alike: one row of the label page each. */
export const assignBarcodesSchema = z
  .object({
    productIds: z.array(z.string().trim().min(1)).default([]),
    variantIds: z.array(z.string().trim().min(1)).default([])
  })
  .refine((value) => value.productIds.length + value.variantIds.length > 0, {
    message: "Choose at least one product."
  })
  .refine((value) => value.productIds.length + value.variantIds.length <= MAX_LABEL_PRODUCTS, {
    message: `Print at most ${MAX_LABEL_PRODUCTS} products at a time.`
  });

/** Copies of one product's label, and of a whole run. */
export const MAX_LABEL_COPIES = 500;
export const MAX_LABELS_PER_RUN = 2000;

/**
 * How this device prints labels.
 *
 * Kept in the browser rather than on the store: the label stock is whatever is
 * loaded in the printer beside *this* till, and a shop with a thermal roll at
 * the counter and an A4 printer in the office needs both remembered. Every
 * field `catch`es back to its default, so a value an older version saved — or
 * one edited by hand — costs that field and not the whole set.
 */
export const labelSettingsSchema = z.object({
  /** Blank prints the store's own name. */
  companyName: z.string().max(60).catch(""),
  customHeightMm: z.coerce.number().min(15).max(100).catch(25),
  customWidthMm: z.coerce.number().min(25).max(110).catch(38),
  preset: z.enum(LABEL_PRESET_IDS).catch("roll-38x25"),
  showBarcodeText: z.boolean().catch(true),
  showCompany: z.boolean().catch(true),
  showName: z.boolean().catch(true),
  showPrice: z.boolean().catch(true),
  showSku: z.boolean().catch(false),
  /** The size, colour and so on, on labels for a product sold by options. */
  showVariant: z.boolean().catch(true),
  /** Labels already peeled off the first A4 sheet, so a part-used sheet is not wasted. */
  skip: z.coerce.number().int().min(0).max(199).catch(0)
});

export type LabelSettings = z.infer<typeof labelSettingsSchema>;

export const DEFAULT_LABEL_SETTINGS: LabelSettings = labelSettingsSchema.parse({});
