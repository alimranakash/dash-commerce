import {
  PRODUCT_CONTENT_FIELD_META,
  PRODUCT_CONTENT_LIMITS,
  type ProductContentField,
  type ProductContentLanguage,
  type ProductContentTone,
  type ProductContentValues
} from "./product-content.schema";
import type { ProductContentSubject } from "./product-content-composer";

/**
 * The prompt, in one place.
 *
 * Both bring-your-own-key providers get the same two blocks — an instruction
 * block that never varies with the product, and a request block that is
 * entirely this product's own facts. Splitting them that way is what lets the
 * instruction half be cached by a provider that supports it, and it keeps the
 * one place a seller's catalogue data is turned into a prompt readable in a
 * single screen.
 *
 * The model is asked for a flat JSON object keyed by field name, because the
 * caller writes those names into eight separate textareas and anything else is
 * a shape it would have to guess at.
 */

const LANGUAGE_INSTRUCTIONS: Record<ProductContentLanguage, string> = {
  bn: "Write every value in natural Bangla (bn-BD) as a Bangladeshi shopper would read it. Do not transliterate English sentences into Bangla script.",
  en: "Write every value in clear, plain English."
};

const TONE_INSTRUCTIONS: Record<ProductContentTone, string> = {
  friendly:
    "Warm and conversational, the way a good shopkeeper talks. No hype, no exclamation stacking.",
  premium:
    "Restrained and confident, the register of a considered brand. Short sentences. Never shout.",
  professional:
    "Factual and neutral. Lead with specifics; leave out adjectives that carry no information."
};

const FIELD_INSTRUCTIONS: Record<ProductContentField, string> = {
  description:
    "The full product story in 2-4 short paragraphs. Separate paragraphs with a blank line. No markdown headings.",
  features:
    "Between three and six highlights, one per line, no bullet characters and no numbering.",
  keywords:
    "Between six and twelve comma-separated search terms a buyer would actually type. Lowercase.",
  metaDescription: "One sentence for the search-result snippet. Include the product name.",
  seoTitle:
    "A search-result title with the product name first. No pipe-separated keyword stuffing beyond one qualifier.",
  shortDescription: "One sentence for product cards and listings.",
  socialCaption:
    "A Facebook or Instagram caption. Two or three short lines, then up to four hashtags on the last line.",
  title: "A clean product name. Refine what is there rather than inventing a new product."
};

export function buildProductContentSystemPrompt(params: {
  brandVoice: string | null;
  language: ProductContentLanguage;
  storeName: string;
  tone: ProductContentTone;
}) {
  const lines = [
    `You are a product copywriter for "${params.storeName}", an online shop.`,
    LANGUAGE_INSTRUCTIONS[params.language],
    `Tone: ${TONE_INSTRUCTIONS[params.tone]}`,
    "",
    "Rules:",
    "- Use only the product facts you are given. Never invent a material, a measurement, a certification, a warranty, a delivery time, or a discount.",
    "- If a fact is missing, write around it rather than guessing at it.",
    "- Never mention the cost price, the profit margin, or the shop's suppliers.",
    "- Answer with a single JSON object and nothing else. No markdown fence, no commentary.",
    "- Every value is a plain string. Omit a key entirely rather than returning an empty string for it."
  ];

  if (params.brandVoice) {
    lines.push("", `The shop describes its own voice as: ${params.brandVoice}`);
  }

  return lines.join("\n");
}

export function buildProductContentUserPrompt(params: {
  fields: readonly ProductContentField[];
  instructions: string | null;
  subject: ProductContentSubject;
}) {
  const { fields, instructions, subject } = params;
  const facts: string[] = [
    `Product name: ${subject.title}`,
    `Price: ${subject.currency} ${subject.price}`
  ];

  if (subject.categoryName) {
    facts.push(`Category: ${subject.categoryName}`);
  }

  if (subject.brand) {
    facts.push(`Brand: ${subject.brand}`);
  }

  if (subject.tags.length) {
    facts.push(`Tags: ${subject.tags.join(", ")}`);
  }

  if (subject.sku) {
    facts.push(`SKU: ${subject.sku}`);
  }

  if (subject.shortDescription) {
    facts.push(`Existing short description: ${subject.shortDescription}`);
  }

  if (subject.description) {
    facts.push(`Existing description: ${subject.description}`);
  }

  if (subject.features) {
    facts.push(`Existing highlights:\n${subject.features}`);
  }

  const requested = fields.map(
    (field) =>
      `- "${field}" (${PRODUCT_CONTENT_FIELD_META[field].label}, max ${PRODUCT_CONTENT_LIMITS[field]} characters): ${FIELD_INSTRUCTIONS[field]}`
  );
  const blocks = [
    "Product facts:",
    facts.join("\n"),
    "",
    "Return a JSON object with exactly these keys:",
    requested.join("\n")
  ];

  if (instructions) {
    blocks.push("", `The shop owner also asks: ${instructions}`);
  }

  return blocks.join("\n");
}

/**
 * Read the provider's object into the eight fields, keeping only what was asked
 * for and only what is a non-empty string.
 *
 * A key the model invented is dropped rather than trusted, and an over-long
 * value is cut on a word boundary rather than rejected: the seller is about to
 * read and edit every one of these, so a slightly short sentence is a better
 * outcome than an error.
 */
export function readProductContentJson(
  parsed: Record<string, unknown>,
  fields: readonly ProductContentField[]
): ProductContentValues {
  const values: ProductContentValues = {};

  for (const field of fields) {
    const raw = parsed[field];

    if (typeof raw !== "string") {
      // A model that answers `features` as an array is being helpful, not wrong.
      if (Array.isArray(raw) && raw.every((entry) => typeof entry === "string")) {
        const joined = (raw as string[]).join(field === "keywords" ? ", " : "\n").trim();

        if (joined) {
          values[field] = clamp(joined, PRODUCT_CONTENT_LIMITS[field]);
        }
      }

      continue;
    }

    const value = raw.trim();

    if (value) {
      values[field] = clamp(value, PRODUCT_CONTENT_LIMITS[field]);
    }
  }

  return values;
}

function clamp(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  const cut = value.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");

  return (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
}
