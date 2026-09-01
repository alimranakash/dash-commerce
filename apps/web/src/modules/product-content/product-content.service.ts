import {
  AiProviderError,
  parseJsonObject,
  requestGeminiCompletion,
  requestOpenAiCompletion
} from "../ai-provider/ai-provider-client";
import { AI_PROVIDER_META } from "../ai-provider/ai-provider.schema";
import {
  getAiContentDefaults,
  hasOwnAiProvider,
  resolveAiProvider
} from "../ai-provider/ai-provider.service";
import { hasPlanFeature } from "../billing/subscription-limits";
import { getProductByIdForStore } from "../products/product.repository";
import {
  getProductTaxonomyIds,
  getProductTaxonomyItems
} from "../products/product-taxonomy.service";
import { updateProduct } from "../products/product.service";
import { requestStoreOSProductContent } from "../storeos/storeos-product-content";
import { composeProductContent, type ProductContentSubject } from "./product-content-composer";
import {
  buildProductContentSystemPrompt,
  buildProductContentUserPrompt,
  readProductContentJson
} from "./product-content-prompt";
import {
  getProductContentRecord,
  getStoreContentContext,
  upsertProductContentRecord,
  type ProductContentWrite
} from "./product-content.repository";
import {
  applyProductContentSchema,
  generateProductContentSchema,
  isProductOwnedContentField,
  PRODUCT_CONTENT_FIELDS,
  type ApplyProductContentInput,
  type GenerateProductContentInput,
  type ProductContentDraft,
  type ProductContentDraftContext,
  type ProductContentField,
  type ProductContentLanguage,
  type ProductContentSource,
  type ProductContentValues
} from "./product-content.schema";

/** BCP-47 for the two languages the studio offers, as StoreOS expects them. */
const LOCALES: Record<ProductContentLanguage, string> = {
  bn: "bn-BD",
  en: "en-US"
};

export type ProductContentView = {
  /** Null until something has been generated for this product. */
  lastGeneratedAt: Date | null;
  productId: string;
  productTitle: string;
  values: ProductContentValues;
};

export class ProductContentNotFoundError extends Error {
  constructor() {
    super("Product not found for this store.");
    this.name = "ProductContentNotFoundError";
  }
}

/**
 * Thrown when the store's plan does not include StoreIM AI.
 *
 * Only generation raises it. Editing and saving the content fields is ordinary
 * product work and stays open on every plan — the paid capability is having the
 * copy written for you, not having somewhere to keep it.
 */
export class ProductContentAiLockedError extends Error {
  constructor() {
    super(
      "Generating needs either your own Gemini or OpenAI key, added in StoreIM AI settings, or a plan that includes StoreIM AI."
    );
    this.name = "ProductContentAiLockedError";
  }
}

/**
 * Whether the Generate buttons should be live for this store.
 *
 * Two independent ways to qualify, and the first is the one that was missing:
 *
 * - the store has **its own** provider key, which it pays for — no plan has any
 *   business standing in the way of a credential the seller bought; or
 * - the plan includes **StoreIM AI**, the platform's own engine, which the platform
 *   pays for and therefore gets to gate.
 *
 * Pages call this to decide whether to disable the buttons, and
 * `generateProductContent` re-checks it rather than trusting them.
 */
export async function canGenerateProductContent(storeId: string) {
  const [ownKey, planAi] = await Promise.all([
    hasOwnAiProvider(storeId),
    hasPlanFeature(storeId, "ai_product_content")
  ]);

  return ownKey || planAi;
}

/**
 * The product's content as the studio shows it: the three `Product` columns and
 * the five `ProductContent` ones, read as one record.
 *
 * Every read is scoped by `storeId` — `getProductByIdForStore` filters on it and
 * so does the satellite read — so a product id belonging to another tenant
 * resolves to nothing rather than to somebody else's copy.
 */
export async function getProductContentForStore(
  storeId: string,
  productId: string
): Promise<ProductContentView> {
  const product = await getProductByIdForStore(storeId, productId);

  if (!product) {
    throw new ProductContentNotFoundError();
  }

  const record = await getProductContentRecord(storeId, productId);

  return {
    lastGeneratedAt: record?.lastGeneratedAt ?? null,
    productId: product.id,
    productTitle: product.title,
    values: {
      description: product.description,
      features: record?.features ?? null,
      keywords: record?.keywords ?? null,
      metaDescription: record?.metaDescription ?? null,
      seoTitle: record?.seoTitle ?? null,
      shortDescription: product.shortDescription,
      socialCaption: record?.socialCaption ?? null,
      title: product.title
    }
  };
}

/**
 * Write a draft, for the whole set of fields or for one of them.
 *
 * Three engines, tried in order, and the seller is always told which one
 * answered:
 *
 *   1. the store's **own provider key** — Gemini or OpenAI — when one is set;
 *   2. **StoreIM AI** over the platform's StoreOS link;
 *   3. the **offline composer**, which arranges the product's own facts into
 *      sentences and is labelled as not being AI at all.
 *
 * Falling forward rather than failing is deliberate: someone who clicked
 * Generate wants something to edit, and a rate-limited key at 9pm should cost
 * them a weaker draft rather than their evening. Every downgrade adds a warning
 * sentence, so nobody is left believing a template was written by a model.
 *
 * Nothing is persisted here. A draft the seller has not read is not content,
 * and generating must never quietly overwrite copy they wrote themselves.
 */
export async function generateProductContent(
  storeId: string,
  input: GenerateProductContentInput
): Promise<ProductContentDraft> {
  const data = generateProductContentSchema.parse(input);
  const [provider, planAllowsDashAi] = await Promise.all([
    resolveAiProvider(storeId),
    hasPlanFeature(storeId, "ai_product_content")
  ]);

  if (!provider && !planAllowsDashAi) {
    throw new ProductContentAiLockedError();
  }

  const defaults = await getAiContentDefaults(storeId);
  const language = data.language ?? defaults.language;
  const tone = data.tone ?? defaults.tone;
  const subject = data.productId
    ? await buildProductContentSubject(storeId, data.productId)
    : await buildDraftSubject(storeId, data.draft as ProductContentDraftContext);
  const composed = composeProductContent({ fields: data.fields, language, subject, tone });
  const warnings: string[] = [];

  if (provider) {
    const system = buildProductContentSystemPrompt({
      brandVoice: defaults.brandVoice,
      language,
      storeName: subject.storeName,
      tone
    });
    const user = buildProductContentUserPrompt({
      fields: data.fields,
      instructions: data.instructions,
      subject
    });
    const call = provider.provider === "gemini" ? requestGeminiCompletion : requestOpenAiCompletion;

    try {
      const parsed = parseJsonObject(
        await call({ apiKey: provider.apiKey, model: provider.model, system, user })
      );

      if (parsed) {
        return mergeDraft({
          composed,
          fields: data.fields,
          source: provider.provider,
          values: readProductContentJson(parsed, data.fields),
          warnings
        });
      }

      warnings.push(
        `${AI_PROVIDER_META[provider.provider].label} answered in a format this page could not read, so a simpler draft was used instead.`
      );
    } catch (error) {
      // The provider's own sentence is the useful half: it names the key or the
      // model, both of which the seller controls in StoreIM AI settings. Anything
      // else — a stack, a URL, a request body — stays in the server log.
      warnings.push(
        error instanceof AiProviderError
          ? error.message
          : `${AI_PROVIDER_META[provider.provider].label} could not be reached, so a simpler draft was used instead.`
      );
    }
  }

  // StoreIM AI is only reached for a store whose plan grants it. A store running
  // on its own key falls straight past this to the offline composer, so a
  // failed provider call cannot quietly spend the platform's engine instead.
  const response = planAllowsDashAi
    ? await requestStoreOSProductContent(storeId, {
        fields: data.fields,
        ...(data.instructions ? { instructions: data.instructions } : {}),
        locale: LOCALES[language],
        product: toStoreOSProduct(subject),
        tone
      })
    : null;

  if (response) {
    return mergeDraft({
      composed,
      fields: data.fields,
      source: "storeos",
      values: readStoreOSValues(response.content, data.fields),
      warnings: [...warnings, ...(response.warnings ?? [])]
    });
  }

  return {
    source: "template",
    values: composed,
    warnings: [
      ...warnings,
      "No AI provider answered, so this draft was composed from your own product details rather than written by AI. Add a Gemini or OpenAI key in StoreIM AI settings, or edit anything below that does not fit."
    ]
  };
}

/**
 * Fill the gaps an engine left with the composed line for the same field.
 *
 * "Generate all" then always returns something for every box that was ticked,
 * so a model that quietly skipped two of eight does not leave two empty panels
 * with no explanation.
 */
function mergeDraft(params: {
  composed: ProductContentValues;
  fields: readonly ProductContentField[];
  source: ProductContentSource;
  values: ProductContentValues;
  warnings: string[];
}): ProductContentDraft {
  const values: ProductContentValues = {};
  const missing: ProductContentField[] = [];

  for (const field of params.fields) {
    const generated = params.values[field];

    if (generated) {
      values[field] = generated;
      continue;
    }

    missing.push(field);

    const fallback = params.composed[field];

    if (fallback) {
      values[field] = fallback;
    }
  }

  return {
    source: params.source,
    values,
    warnings: [
      ...params.warnings,
      ...(missing.length
        ? [
            `${missing.length} of the requested fields came back empty, so those were filled in from your product details instead.`
          ]
        : [])
    ]
  };
}

function readStoreOSValues(
  content: Partial<Record<string, string>>,
  fields: readonly ProductContentField[]
): ProductContentValues {
  const values: ProductContentValues = {};

  for (const field of fields) {
    const value = content[field]?.trim();

    if (value) {
      values[field] = value;
    }
  }

  return values;
}

/**
 * Save the fields the seller approved.
 *
 * Split by where each field lives: title, short description and description go
 * through `updateProduct`, which is the same path the product editor uses and
 * therefore the same slug, SKU and category rules; the other five go to the
 * satellite row. Both halves are scoped by `storeId`.
 *
 * A field the caller did not send is left alone, so applying one generated
 * field cannot blank the seven the seller did not look at.
 */
export async function applyProductContent(storeId: string, input: ApplyProductContentInput) {
  const data = applyProductContentSchema.parse(input);
  const product = await getProductByIdForStore(storeId, data.productId);

  if (!product) {
    throw new ProductContentNotFoundError();
  }

  const productUpdate: {
    description?: string | null;
    shortDescription?: string | null;
    title?: string;
  } = {};
  const contentUpdate: ProductContentWrite = {};

  for (const field of PRODUCT_CONTENT_FIELDS) {
    const value = data.values[field];

    if (value === undefined) {
      continue;
    }

    if (!isProductOwnedContentField(field)) {
      contentUpdate[field] = value;
      continue;
    }

    if (field === "title") {
      // The one field with no "clear it" meaning: a product must have a title,
      // and `createProductSchema` requires two characters.
      if (value) {
        productUpdate.title = value;
      }

      continue;
    }

    productUpdate[field] = value;
  }

  if (Object.keys(productUpdate).length > 0) {
    // The slug is deliberately not re-derived from a new title: it is the
    // storefront URL the product is already linked and indexed at, and silently
    // moving it is not something applying copy should do.
    await updateProduct(storeId, data.productId, productUpdate);
  }

  await upsertProductContentRecord({
    productId: data.productId,
    ...(data.source ? { source: data.source } : {}),
    storeId,
    values: contentUpdate
  });

  return getProductContentForStore(storeId, data.productId);
}

/**
 * The five satellite fields, written as part of an ordinary product create or
 * update.
 *
 * Exported for `product.actions.ts` so the SEO card on the product form saves in
 * the same submit as the title beside it, rather than needing a second trip
 * through the studio.
 */
export async function saveProductContentFields(
  storeId: string,
  productId: string,
  values: ProductContentWrite
) {
  await upsertProductContentRecord({ productId, storeId, values });
}

export async function getProductContentFields(storeId: string, productId: string) {
  return getProductContentRecord(storeId, productId);
}

/**
 * Everything the engines are told about the product, derived server-side from
 * the store's own rows.
 *
 * `costPrice` is not in it, matching the redaction rule in `ai-products.service`
 * — margin is the seller's business and no copywriter needs it. Tags and brand
 * come from the taxonomy tables because they are the words the seller already
 * uses for this product, and a draft in their vocabulary needs less editing
 * than one that invents its own.
 */
async function buildProductContentSubject(
  storeId: string,
  productId: string
): Promise<ProductContentSubject> {
  const product = await getProductByIdForStore(storeId, productId);

  if (!product) {
    throw new ProductContentNotFoundError();
  }

  const [record, tags, brands, store] = await Promise.all([
    getProductContentRecord(storeId, productId),
    resolveTaxonomyNames(storeId, productId, "TAG"),
    resolveTaxonomyNames(storeId, productId, "BRAND"),
    getStoreName(storeId)
  ]);

  return {
    brand: brands[0] ?? null,
    categoryName: product.category?.name ?? null,
    currency: store.currency,
    description: product.description,
    features: record?.features ?? null,
    keywords: record?.keywords ?? null,
    price: product.price.toString(),
    productId,
    shortDescription: product.shortDescription,
    sku: product.sku,
    storeName: store.name,
    tags,
    title: product.title
  };
}

/**
 * The same subject, assembled from a product that does not exist yet.
 *
 * This is what makes the inline buttons work on **New product**: the form knows
 * its own title, price, category and tags before anything is saved, so there is
 * no reason to make someone save a half-written draft just to get a description
 * for it. Only the store name and currency come from the database — the rest is
 * what the seller has typed, and none of it is a selector.
 */
async function buildDraftSubject(
  storeId: string,
  draft: ProductContentDraftContext
): Promise<ProductContentSubject> {
  const store = await getStoreName(storeId);

  return {
    brand: draft.brand,
    categoryName: draft.categoryName,
    currency: store.currency,
    description: draft.description,
    features: draft.features,
    keywords: draft.keywords,
    price: draft.price ?? "0",
    productId: null,
    shortDescription: draft.shortDescription,
    sku: draft.sku,
    storeName: store.name,
    tags: draft.tags,
    title: draft.title
  };
}

function toStoreOSProduct(subject: ProductContentSubject) {
  return {
    ...(subject.brand ? { brand: subject.brand } : {}),
    ...(subject.categoryName ? { categoryName: subject.categoryName } : {}),
    currency: subject.currency,
    ...(subject.description ? { description: subject.description } : {}),
    ...(subject.features ? { features: subject.features } : {}),
    // An unsaved product has no id yet, and StoreOS is told so rather than being
    // handed an invented one.
    id: subject.productId ?? "draft",
    ...(subject.keywords ? { keywords: subject.keywords } : {}),
    price: subject.price,
    ...(subject.shortDescription ? { shortDescription: subject.shortDescription } : {}),
    ...(subject.sku ? { sku: subject.sku } : {}),
    ...(subject.tags.length ? { tags: subject.tags } : {}),
    title: subject.title
  };
}

async function resolveTaxonomyNames(
  storeId: string,
  productId: string,
  type: "BRAND" | "TAG"
): Promise<string[]> {
  const [ids, items] = await Promise.all([
    getProductTaxonomyIds(storeId, productId, type),
    getProductTaxonomyItems(storeId, type)
  ]);
  const selected = new Set(ids);

  return items.filter((item) => selected.has(item.id)).map((item) => item.name);
}

async function getStoreName(storeId: string) {
  const store = await getStoreContentContext(storeId);

  if (!store) {
    throw new ProductContentNotFoundError();
  }

  return store;
}
