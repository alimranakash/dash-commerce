/**
 * AI Product Content Studio check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * content studio — the same shape as `verify-storeim-ai.mts`, and deliberately
 * the half of it that needs neither a database nor a session.
 *
 * Three layers are driven.
 *
 * The *registry* checks assert that the eight fields agree with themselves
 * everywhere they are listed: metadata, limits, the `Product`/`ProductContent`
 * partition, and the field names the StoreOS wire type declares. A ninth field
 * added to one list and not the others fails here rather than in a seller's
 * draft.
 *
 * The *composer* checks run the offline path for real, across both languages,
 * all three tones and every field, because that path is what a store with no
 * StoreOS connection actually gets. They assert it stays inside the per-field
 * limits, never emits a placeholder, and never overwrites the seller's own
 * highlights.
 *
 * The *source* checks read `product-content.actions.ts` as text rather than
 * calling it — it pulls in the NextAuth options through `requireStore`, which
 * cannot load outside Next, the same reason `verify-staff-permissions.mts`
 * inspects action modules as text. For tenancy it is also the stronger
 * assertion: "the action never takes a store selector from the caller" is true
 * of the code or it is not, whereas one call that happens to pass no `storeId`
 * proves nothing about the next.
 *
 * Covers:
 * - the field list, metadata, limits and owned/satellite partition agreeing;
 * - the three `Product`-owned limits matching `product.schema.ts`, so a draft
 *   the studio offers is always one the product save will accept;
 * - the offline composer writing every field in both languages and all three
 *   tones, inside its limits, with no undefined leaking into the copy;
 * - the composer preferring the seller's own feature lines over generated ones;
 * - generation input normalising field order and refusing an empty ask;
 * - apply input turning a cleared field into null and refusing over-long copy;
 * - the actions guarding with `requireStore()` and taking no store, tenant or
 *   organization selector from the caller;
 * - the settings action guarding with `requireStoreManager()`, because a
 *   provider key is a billable credential rather than ordinary product work;
 * - no API key reaching the browser: the view type carries booleans and a
 *   last-four hint, and only one function in the codebase decrypts a key;
 * - the prompt never carrying cost price, and the provider reader dropping keys
 *   the model invented;
 * - a JSON answer being readable when the model wraps it in a markdown fence.
 *
 * Run with: npm run verify:product-content
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseJsonObject } from "../apps/web/src/modules/ai-provider/ai-provider-client";
import {
  composeProductContent,
  type ProductContentSubject
} from "../apps/web/src/modules/product-content/product-content-composer";
import {
  buildProductContentSystemPrompt,
  buildProductContentUserPrompt,
  readProductContentJson
} from "../apps/web/src/modules/product-content/product-content-prompt";
import {
  applyProductContentSchema,
  generateProductContentSchema,
  isProductOwnedContentField,
  PRODUCT_CONTENT_FIELD_META,
  PRODUCT_CONTENT_FIELDS,
  PRODUCT_CONTENT_LANGUAGES,
  PRODUCT_CONTENT_LIMITS,
  PRODUCT_CONTENT_TONES,
  PRODUCT_OWNED_CONTENT_FIELDS
} from "../apps/web/src/modules/product-content/product-content.schema";

const MODULE_DIR = join(process.cwd(), "apps", "web", "src", "modules", "product-content");
const PROVIDER_DIR = join(process.cwd(), "apps", "web", "src", "modules", "ai-provider");
const SDK_TYPES = join(process.cwd(), "packages", "storeos-sdk", "src", "types.ts");

/** The limits `product.schema.ts` enforces on the three columns it owns. */
const PRODUCT_SCHEMA_LIMITS: Record<string, number> = {
  description: 10000,
  shortDescription: 320,
  title: 160
};

const SUBJECT: ProductContentSubject = {
  brand: "Rongdhonu",
  categoryName: "Cotton Panjabi",
  currency: "BDT",
  description: null,
  features: null,
  keywords: null,
  price: "1450.00",
  productId: "product_1",
  shortDescription: null,
  sku: "PNJ-014",
  storeName: "Dhaka Threads",
  tags: ["eid", "cotton"],
  title: "Slim Fit Panjabi"
};

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  if (!passed) {
    failures += 1;
  }

  console.log(`${passed ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

function main() {
  console.log("=== Field registry ===");

  check(
    "every field has metadata",
    PRODUCT_CONTENT_FIELDS.every((field) => Boolean(PRODUCT_CONTENT_FIELD_META[field]?.label))
  );
  check(
    "every field has a positive limit",
    PRODUCT_CONTENT_FIELDS.every((field) => PRODUCT_CONTENT_LIMITS[field] > 0)
  );
  check(
    "metadata and limits declare no field the list does not",
    Object.keys(PRODUCT_CONTENT_FIELD_META).length === PRODUCT_CONTENT_FIELDS.length &&
      Object.keys(PRODUCT_CONTENT_LIMITS).length === PRODUCT_CONTENT_FIELDS.length
  );

  const owned = PRODUCT_CONTENT_FIELDS.filter(isProductOwnedContentField);
  const satellite = PRODUCT_CONTENT_FIELDS.filter((field) => !isProductOwnedContentField(field));

  check(
    "the owned/satellite split covers every field exactly once",
    owned.length + satellite.length === PRODUCT_CONTENT_FIELDS.length &&
      owned.length === PRODUCT_OWNED_CONTENT_FIELDS.length,
    `${owned.join(", ")} on Product; ${satellite.join(", ")} on ProductContent`
  );
  check(
    "the three Product-owned limits match product.schema.ts",
    owned.every((field) => PRODUCT_CONTENT_LIMITS[field] === PRODUCT_SCHEMA_LIMITS[field]),
    "a draft the studio offers is always one the product save accepts"
  );

  const sdkTypes = readFileSync(SDK_TYPES, "utf8");

  check(
    "the StoreOS wire type declares the same eight fields",
    PRODUCT_CONTENT_FIELDS.every((field) => sdkTypes.includes(`| "${field}"`)),
    "StoreOSProductContentField"
  );
  check(
    "the wire type never carries cost price",
    !/StoreOSProductContentSource[\s\S]*?\n};/.exec(sdkTypes)?.[0]?.includes("costPrice"),
    "margin is the seller's business, matching ai-products.service redaction"
  );

  console.log("\n=== Offline composer ===");

  for (const language of PRODUCT_CONTENT_LANGUAGES) {
    for (const tone of PRODUCT_CONTENT_TONES) {
      const values = composeProductContent({
        fields: PRODUCT_CONTENT_FIELDS,
        language,
        subject: SUBJECT,
        tone
      });
      const written = PRODUCT_CONTENT_FIELDS.filter((field) => Boolean(values[field]));
      const overLimit = PRODUCT_CONTENT_FIELDS.filter(
        (field) => (values[field]?.length ?? 0) > PRODUCT_CONTENT_LIMITS[field]
      );
      const placeholders = written.filter((field) =>
        /undefined|null|NaN|\[object/.test(values[field] ?? "")
      );

      check(
        `${language}/${tone} writes all eight fields`,
        written.length === PRODUCT_CONTENT_FIELDS.length,
        written.length === PRODUCT_CONTENT_FIELDS.length
          ? ""
          : `missing ${PRODUCT_CONTENT_FIELDS.filter((field) => !values[field]).join(", ")}`
      );
      check(
        `${language}/${tone} stays inside every limit`,
        overLimit.length === 0,
        overLimit.join(", ")
      );
      check(
        `${language}/${tone} leaks no placeholder`,
        placeholders.length === 0,
        placeholders.join(", ")
      );
    }
  }

  const withOwnFeatures = composeProductContent({
    fields: ["features"],
    language: "en",
    subject: {
      ...SUBJECT,
      features: "Hand-stitched collar\nPre-shrunk cotton"
    },
    tone: "friendly"
  });

  check(
    "the seller's own highlights survive a re-generate",
    withOwnFeatures.features === "Hand-stitched collar\nPre-shrunk cotton"
  );

  const longTitle = composeProductContent({
    fields: ["seoTitle"],
    language: "en",
    subject: {
      ...SUBJECT,
      storeName: "The Very Long Store Name That Would Overflow A Search Result Title Line",
      title: "An Extremely Long Product Title That Alone Fills The Whole Search Result Line"
    },
    tone: "professional"
  });

  check(
    "an over-long SEO title is cut on a word boundary",
    (longTitle.seoTitle?.length ?? 0) <= PRODUCT_CONTENT_LIMITS.seoTitle &&
      !longTitle.seoTitle?.endsWith(" "),
    longTitle.seoTitle ?? ""
  );

  console.log("\n=== Prompt and provider answer ===");

  const system = buildProductContentSystemPrompt({
    brandVoice: "Plain language, no hype.",
    language: "en",
    storeName: SUBJECT.storeName,
    tone: "friendly"
  });
  const user = buildProductContentUserPrompt({
    fields: PRODUCT_CONTENT_FIELDS,
    instructions: "Mention the Eid offer.",
    subject: { ...SUBJECT, description: "Cotton panjabi with a mandarin collar." }
  });

  check(
    "the prompt forbids inventing facts",
    /Never invent/.test(system) && /only the product facts/i.test(system)
  );
  check("the brand voice reaches the model", system.includes("Plain language, no hype."));
  check(
    "the prompt never carries cost price or margin",
    !/costPrice|cost price|margin/i.test(user),
    "the same redaction ai-products.service applies to the external API"
  );
  check("the seller's own steer reaches the model", user.includes("Mention the Eid offer."));
  check(
    "every requested field is named in the prompt",
    PRODUCT_CONTENT_FIELDS.every((field) => user.includes(`"${field}"`))
  );

  check(
    "a fenced JSON answer is still readable",
    parseJsonObject('Sure!\n```json\n{"title":"Slim Fit Panjabi"}\n```')?.title ===
      "Slim Fit Panjabi",
    "models fence their JSON however firmly they are asked not to"
  );
  check("a non-JSON answer is a null, not a throw", parseJsonObject("no json here") === null);

  const fromModel = readProductContentJson(
    {
      features: ["Hand-stitched collar", "Pre-shrunk cotton"],
      invented: "should be dropped",
      metaDescription: "x".repeat(PRODUCT_CONTENT_LIMITS.metaDescription + 50),
      title: "  Slim Fit Panjabi  "
    },
    ["features", "metaDescription", "title"]
  );

  check("a value from the model is trimmed", fromModel.title === "Slim Fit Panjabi");
  check(
    "an array answer is joined into lines",
    fromModel.features === "Hand-stitched collar\nPre-shrunk cotton"
  );
  check(
    "an over-long value is clamped rather than rejected",
    (fromModel.metaDescription?.length ?? 0) <= PRODUCT_CONTENT_LIMITS.metaDescription
  );
  check("a key the model invented is dropped", !("invented" in fromModel));

  console.log("\n=== The API key never reaches the browser ===");

  const providerSchema = readFileSync(join(PROVIDER_DIR, "ai-provider.schema.ts"), "utf8");
  const providerService = readFileSync(join(PROVIDER_DIR, "ai-provider.service.ts"), "utf8");
  const providerActions = readFileSync(join(PROVIDER_DIR, "ai-provider.actions.ts"), "utf8");
  const settingsPanel = readFileSync(
    join(PROVIDER_DIR, "components", "ai-provider-settings.tsx"),
    "utf8"
  );

  check(
    "the view type carries no cipher",
    !/AiSettingsView = \{[\s\S]*?\};/.exec(providerSchema)?.[0]?.includes("Cipher"),
    "booleans and a last-four hint, never a key"
  );
  check(
    "only the service decrypts",
    providerService.includes("decryptSecret") &&
      !settingsPanel.includes("decryptSecret") &&
      !providerActions.includes("decryptSecret")
  );
  check(
    "the settings panel renders no key value",
    !/value=\{[^}]*ApiKey/.test(settingsPanel) && !/defaultValue=\{[^}]*ApiKey/.test(settingsPanel),
    "the input is always empty; the placeholder says whether one is stored"
  );
  check(
    "saving the provider is manager-only",
    providerActions.includes("requireStoreManager()") &&
      !providerActions.includes("await requireStore()"),
    "a billable credential is an integration change, not product work"
  );
  check(
    "an empty key field keeps the stored key",
    /if \(params\.submitted\) \{\s*return "set"/.test(providerService) &&
      /params\.cleared && params\.hadKey/.test(providerService),
    "clearing is the explicit checkbox, never a blank field"
  );
  check(
    "a provider cannot be defaulted to without a key",
    providerService.includes("before making Gemini the default provider") &&
      providerService.includes("before making OpenAI the default provider")
  );

  const providerClient = readFileSync(join(PROVIDER_DIR, "ai-provider-client.ts"), "utf8");

  const urlLines = providerClient
    .split("\n")
    .filter((line) => /https?:\/\/|ENDPOINT\}|fetch\(/.test(line));

  check(
    "the client never puts the key in a URL",
    !urlLines.some((line) => line.includes("apiKey")),
    "a URL ends up in proxy logs and error messages; both providers take a header"
  );
  check(
    "both providers receive the key as a header",
    /"x-goog-api-key": request\.apiKey/.test(providerClient) &&
      /Authorization: `Bearer \$\{request\.apiKey\}`/.test(providerClient)
  );
  check(
    "the client reads no environment or database",
    !/process\.env|prisma/.test(providerClient),
    "the key arrives as an argument from the one function that decrypts it"
  );

  console.log("\n=== Input contracts ===");

  const generated = generateProductContentSchema.parse({
    fields: ["socialCaption", "title", "title"],
    productId: "product_1"
  });

  check(
    "generation normalises field order and duplicates",
    generated.fields.join(",") === "title,socialCaption",
    generated.fields.join(",")
  );
  check(
    "an unspecified tone and language fall to the store's saved defaults",
    generated.language === undefined && generated.tone === undefined,
    "the inline buttons have nowhere to ask, so the service reads the setting"
  );
  check(
    "an explicit tone and language still win",
    generateProductContentSchema.parse({
      fields: ["title"],
      language: "bn",
      productId: "product_1",
      tone: "premium"
    }).tone === "premium",
    "the studio sets them per draft"
  );
  check(
    "generation refuses an empty ask",
    !generateProductContentSchema.safeParse({ fields: [], productId: "product_1" }).success
  );
  check(
    "generation works from an unsaved product",
    generateProductContentSchema.safeParse({
      draft: { title: "Slim Fit Panjabi" },
      fields: ["description"]
    }).success,
    "the inline buttons on New product have no id to send"
  );
  check(
    "generation refuses a request with neither a product nor a draft",
    !generateProductContentSchema.safeParse({ fields: ["description"] }).success
  );
  check(
    "an unsaved product still needs a title to write from",
    !generateProductContentSchema.safeParse({
      draft: { title: "x" },
      fields: ["description"]
    }).success
  );

  const applied = applyProductContentSchema.parse({
    productId: "product_1",
    values: {
      seoTitle: "   ",
      title: "  Slim Fit Panjabi  "
    }
  });

  check("a cleared field applies as null", applied.values.seoTitle === null);
  check("an applied value is trimmed", applied.values.title === "Slim Fit Panjabi");
  check(
    "an untouched field is absent rather than null",
    !("description" in applied.values),
    "so applying one field cannot blank the other seven"
  );
  check(
    "over-long copy is refused",
    !applyProductContentSchema.safeParse({
      productId: "product_1",
      values: {
        metaDescription: "x".repeat(PRODUCT_CONTENT_LIMITS.metaDescription + 1)
      }
    }).success
  );

  console.log("\n=== The actions cannot be steered from the browser ===");

  const actions = readFileSync(join(MODULE_DIR, "product-content.actions.ts"), "utf8");

  check(
    "both actions resolve the store from the session",
    (actions.match(/await requireStore\(\)/g) ?? []).length === 2,
    "the same guard product.actions.ts uses"
  );
  check(
    "no action reads a store selector from its caller",
    !/\b(storeId|tenantId|organizationId|siteId)\b/.test(actions),
    "productId is the only identifier the browser supplies"
  );
  check(
    "every service call is scoped by the resolved store",
    (actions.match(/\((store\.id), input\)/g) ?? []).length === 2
  );

  const service = readFileSync(join(MODULE_DIR, "product-content.service.ts"), "utf8");

  check(
    "the service reaches StoreOS only through the storeos module",
    service.includes('from "../storeos/storeos-product-content"') &&
      !service.includes('@dash/storeos-sdk";\nimport { createStoreOSClient'),
    "no provider call and no platform credential on the product side"
  );
  check(
    "the studio is entitled by the plan and nothing else",
    /canGenerateProductContent[\s\S]*?return hasPlanFeature\(storeId, "ai_product_content"\);/.test(
      service
    ),
    "a key the seller owns picks the engine below; it does not open the studio"
  );
  check(
    "generation is refused whenever the plan does not include it",
    /if \(!planAllowsDashAi\) \{\s*throw new ProductContentAiLockedError/.test(service)
  );
  check(
    "and no own-key bypass survives beside either read",
    !/ownKey \|\||\|\| planAi\b|!provider && !planAllowsDashAi/.test(service)
  );
  check(
    "the platform engine stays plan-gated",
    /const response = planAllowsDashAi\s*\?/.test(service),
    "StoreIM AI costs the platform money, so a store on its own key does not reach it"
  );
  check(
    "saving is not gated, so a lapsed plan can still edit its own copy",
    !/export async function applyProductContent[\s\S]*?\n}/.exec(service)?.[0]?.includes("canUseAI")
  );
}

main();

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
