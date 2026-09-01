import { z } from "zod";

/**
 * The contracts for the external AI API (`/api/ai/v1/**`).
 *
 * Everything that crosses the boundary is declared here and nowhere else. No
 * route serialises a Prisma model: a response is built as an explicit,
 * allow-listed object and then parsed by the schema below before it is sent, so
 * a column added to `Store` next month cannot leak by being picked up in a
 * spread. The parse is deliberately on the *response*, which is the unusual
 * direction — it is cheap, and it turns "someone widened the select" from a
 * silent disclosure into a loud failure.
 */

/**
 * The scope vocabulary.
 *
 * Stored on `StoreApiKey.scopes` as plain strings rather than a database enum,
 * so adding one is a code change instead of a migration. Read and write are kept
 * as separate verbs on the same resources because the AI is expected to be
 * granted the former long before anyone is comfortable granting the latter.
 */
export const AI_SCOPES = [
  "read:analytics",
  "read:customers",
  "read:orders",
  "read:products",
  "read:store",
  "write:marketing",
  "write:orders",
  "write:products"
] as const;

export type AiScope = (typeof AI_SCOPES)[number];

export const aiScopeSchema = z.enum(AI_SCOPES);

/**
 * Scopes that exist in the vocabulary but cannot be granted yet.
 *
 * The rule this list enforces: **a scope nothing checks is a permission that
 * silently means nothing**, and issuing one would be worse than refusing it —
 * the seller would believe they had limited the AI when they had not. So a
 * scope stays here until an endpoint actually requires it.
 *
 * It is empty now. All three write verbs were listed here until the action
 * endpoints landed:
 *
 *   - `write:products`  → PATCH /api/ai/v1/products/[productId]
 *   - `write:marketing` → POST  /api/ai/v1/coupons
 *   - `write:orders`    → POST  /api/ai/v1/orders/[orderId]/status
 *
 * Adding a scope: name it in `AI_SCOPES`, put it here, and take it out again in
 * the same change that adds the endpoint checking it.
 */
export const AI_WRITE_SCOPES: readonly AiScope[] = [];

export function isGrantableScope(scope: AiScope) {
  return !AI_WRITE_SCOPES.includes(scope);
}

/** Parses whatever came out of the database column back into the vocabulary. */
export function parseStoredScopes(values: readonly string[]): AiScope[] {
  return values.filter((value): value is AiScope =>
    (AI_SCOPES as readonly string[]).includes(value)
  );
}

const grantableScopeListSchema = z
  .array(aiScopeSchema)
  .min(1, "A key needs at least one scope.")
  // Sorted and de-duplicated on the way in, so two keys granting the same
  // access always store the same array and a diff of the settings page is
  // readable.
  .transform((scopes) => [...new Set(scopes)].sort())
  .refine((scopes) => scopes.every(isGrantableScope), {
    message: "Write scopes cannot be granted yet — no endpoint enforces them."
  });

/**
 * An expiry, or none. `null` and `""` both mean "never expires", because a form
 * and a JSON caller spell that differently.
 */
const optionalExpirySchema = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    return value instanceof Date ? value : new Date(value);
  })
  .refine((value) => value === undefined || !Number.isNaN(value.getTime()), {
    message: "Use a valid expiry date."
  })
  .refine((value) => value === undefined || value.getTime() > Date.now(), {
    message: "An expiry has to be in the future."
  });

export const issueApiKeyInputSchema = z.object({
  // `.optional()` on top of a schema that already accepts null and "": the union
  // handles the values a form or a JSON body can send, and this handles the key
  // simply not being there. Zod does not treat a transform that returns
  // `undefined` as making its key optional.
  expiresAt: optionalExpirySchema.optional(),
  name: z
    .string()
    .trim()
    .min(1, "Give the key a name.")
    .max(80, "Key names are at most 80 characters."),
  scopes: grantableScopeListSchema
});

export type IssueApiKeyInput = z.input<typeof issueApiKeyInputSchema>;

/**
 * What settings may show about a key. Note what is absent: `tokenHash` is never
 * selected, let alone returned, and the stored ciphertext of the key is
 * collapsed to `canReveal` inside the repository rather than travelling with
 * the summary. The key itself is fetched on its own, by its own action, only
 * when a manager asks to see it.
 */
export const apiKeySummarySchema = z.object({
  /**
   * Whether this key can still be shown. False for keys minted before the
   * store kept a readable copy, and for every key on a deployment with no
   * encryption key configured — both authenticate normally.
   */
  canReveal: z.boolean(),
  createdAt: z.date(),
  expiresAt: z.date().nullable(),
  hint: z.string(),
  id: z.string(),
  lastUsedAt: z.date().nullable(),
  name: z.string(),
  revokedAt: z.date().nullable(),
  scopes: z.array(aiScopeSchema)
});

export type ApiKeySummary = z.infer<typeof apiKeySummarySchema>;

/**
 * `GET /api/ai/v1/context` — the identity of the one store this key resolves to,
 * and what that key is allowed to ask for.
 *
 * Deliberately the smallest useful payload: who am I talking to, in what
 * currency, in what timezone, and which doors are open. No counts, no customers,
 * no money. It is the endpoint StoreOS AI calls to prove a key works and to
 * learn how to format everything it will later be told.
 *
 * `scopes` is what the authenticated key was actually granted, echoed back from
 * `identity.scopes` — the same array the scope checks on every other endpoint
 * read. It is here so a client can decide which features to light up before it
 * starts collecting 403s, and it is typed as the scope vocabulary rather than
 * plain strings so a value outside it cannot be introduced by this response.
 */
export const aiStoreContextSchema = z
  .object({
    businessType: z.string(),
    country: z.string(),
    currency: z.string(),
    scopes: z.array(aiScopeSchema),
    slug: z.string(),
    storeId: z.string(),
    storeName: z.string(),
    timezone: z.string()
  })
  // Anything the caller did not ask for is dropped rather than passed through,
  // which is the whole point of parsing on the way out.
  .strict();

export type AiStoreContext = z.infer<typeof aiStoreContextSchema>;

/** Every non-2xx body on this API, so a client can branch on `code`. */
export const aiErrorResponseSchema = z.strictObject({
  code: z.string(),
  message: z.string()
});

export type AiErrorResponse = z.infer<typeof aiErrorResponseSchema>;

/* -------------------------------------------------------------------------- */
/*                                 Pagination                                  */
/* -------------------------------------------------------------------------- */

/** The ceiling on one page, so a caller cannot ask for the whole catalogue. */
export const AI_PAGE_LIMIT_MAX = 100;
export const AI_PAGE_LIMIT_DEFAULT = 25;

/**
 * Cursor pagination, following `listMediaAssetsRecord`. Offset pagination would
 * repeat and skip rows on a list that is being written to while it is walked,
 * which for orders is every list.
 *
 * `limit` arrives as a string from the query, hence the coercion; anything
 * unparseable or out of range is a 400 rather than a silent clamp, because a
 * caller asking for 5000 rows should be told it will not happen.
 *
 * Unknown parameters are stripped rather than rejected. That is the documented
 * contract for this API — a caller may send whatever it likes alongside its
 * credentials and it is ignored — and it is what makes `?storeId=…` a no-op
 * instead of a special case somebody could later be tempted to honour.
 */
export const aiPageQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce
    .number()
    .int("limit has to be a whole number.")
    .min(1, "limit has to be at least 1.")
    .max(AI_PAGE_LIMIT_MAX, `limit cannot be more than ${AI_PAGE_LIMIT_MAX}.`)
    .default(AI_PAGE_LIMIT_DEFAULT)
});

export type AiPageQuery = z.infer<typeof aiPageQuerySchema>;

export const aiPageInfoSchema = z.strictObject({
  hasMore: z.boolean(),
  /** Pass back as `?cursor=` to get the next page. Null on the last one. */
  nextCursor: z.string().nullable()
});

/* -------------------------------------------------------------------------- */
/*                                  Products                                   */
/* -------------------------------------------------------------------------- */

export const aiProductStatusSchema = z.enum(["ACTIVE", "ARCHIVED", "DRAFT"]);
export const aiProductVisibilitySchema = z.enum(["HIDDEN", "PUBLIC"]);

export const aiProductQuerySchema = aiPageQuerySchema.extend({
  /** Matched against title and SKU. */
  search: z.string().trim().min(1).max(120).optional(),
  status: aiProductStatusSchema.optional()
});

export type AiProductQuery = z.infer<typeof aiProductQuerySchema>;

const aiProductImageSchema = z.strictObject({
  alt: z.string().nullable(),
  position: z.number().int(),
  url: z.string()
});

const aiProductCategorySchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  slug: z.string()
});

/**
 * One product, as the AI is allowed to see it.
 *
 * Note the absences, each deliberate: `costPrice` is the seller's margin and is
 * never disclosed to anything outside the dashboard; `description` is not on the
 * agreed field list; `isDemoContent`, `demoPackId`, `lowStockThreshold` and
 * `searchVector` are internal bookkeeping. Money is a string, following the
 * convention `analytics.service.ts` already uses — a Decimal through
 * `JSON.stringify` would silently become a float and lose paisa.
 */
export const aiProductSchema = z.strictObject({
  category: aiProductCategorySchema.nullable(),
  compareAtPrice: z.string().nullable(),
  createdAt: z.string(),
  id: z.string(),
  images: z.array(aiProductImageSchema),
  price: z.string(),
  sku: z.string().nullable(),
  slug: z.string(),
  status: aiProductStatusSchema,
  stockQuantity: z.number().int(),
  title: z.string(),
  updatedAt: z.string(),
  visibility: aiProductVisibilitySchema
});

export type AiProduct = z.infer<typeof aiProductSchema>;

export const aiProductListResponseSchema = z.strictObject({
  data: z.array(aiProductSchema),
  page: aiPageInfoSchema,
  storeId: z.string()
});

export type AiProductListResponse = z.infer<typeof aiProductListResponseSchema>;

/* -------------------------------------------------------------------------- */
/*                                   Orders                                    */
/* -------------------------------------------------------------------------- */

export const aiOrderStatusSchema = z.enum([
  "CANCELLED",
  "COMPLETED",
  "CONFIRMED",
  "PENDING",
  "PROCESSING"
]);

export const aiOrderQuerySchema = aiPageQuerySchema.extend({
  status: aiOrderStatusSchema.optional()
});

export type AiOrderQuery = z.infer<typeof aiOrderQuerySchema>;

const aiOrderItemSchema = z.strictObject({
  id: z.string(),
  price: z.string(),
  productId: z.string().nullable(),
  quantity: z.number().int(),
  sku: z.string().nullable(),
  title: z.string(),
  total: z.string()
});

/**
 * The customer on an order, reduced to what an assistant can answer questions
 * with.
 *
 * The name is whole: an AI that cannot say "Rahim's order" is not much use, and
 * a name is the seller's own record of their own customer. The phone and email
 * are masked, because in Bangladesh the phone number *is* the customer identity
 * — `Customer` is keyed `@@unique([storeId, phone])` — and handing a full
 * contact list to an external service is a different act from answering a
 * question about an order.
 */
const aiOrderCustomerSchema = z.strictObject({
  /** Domain-preserving mask, e.g. `r•••@gmail.com`. Null when there is none. */
  email: z.string().nullable(),
  name: z.string(),
  /** Last four digits only, e.g. `•••••••5678`. */
  phone: z.string()
});

/**
 * One order, redacted.
 *
 * Everything the fraud tooling writes is absent by construction: `ipAddress`,
 * `riskScore`, `riskLevel`, `riskFactors`, `verificationStatus` and the decision
 * timestamps. `riskFactors` in particular describes how the rule engine scores
 * an order, and publishing that teaches evasion.
 *
 * Addresses are reduced to city and district. `shippingArea` and the `Address`
 * rows themselves stay behind: a district is enough to reason about delivery
 * and courier performance, a street address is somebody's home.
 *
 * `storeId` rides along because `orderNumber` is unique per store, not globally
 * (`@@unique([storeId, orderNumber])`) — an order number on its own is
 * ambiguous, so it is never sent on its own.
 */
export const aiOrderSchema = z.strictObject({
  createdAt: z.string(),
  currency: z.string(),
  customer: aiOrderCustomerSchema,
  id: z.string(),
  items: z.array(aiOrderItemSchema),
  orderNumber: z.string(),
  paymentStatus: z.string(),
  shipping: z.strictObject({
    city: z.string().nullable(),
    district: z.string().nullable()
  }),
  status: aiOrderStatusSchema,
  storeId: z.string(),
  totalAmount: z.string()
});

export type AiOrder = z.infer<typeof aiOrderSchema>;

export const aiOrderListResponseSchema = z.strictObject({
  data: z.array(aiOrderSchema),
  page: aiPageInfoSchema,
  storeId: z.string()
});

export type AiOrderListResponse = z.infer<typeof aiOrderListResponseSchema>;

/* -------------------------------------------------------------------------- */
/*                                  Metrics                                    */
/* -------------------------------------------------------------------------- */

/**
 * The dashboard's own summary, unchanged.
 *
 * Every number here is an aggregate the seller already sees on their home page,
 * computed by `analytics.service.ts`. This endpoint adds no arithmetic of its
 * own — duplicating a revenue calculation is how two surfaces end up quoting
 * different totals for the same day.
 */
export const aiMetricsResponseSchema = z.strictObject({
  currency: z.string(),
  lowStockProducts: z.array(
    z.strictObject({
      id: z.string(),
      lowStockThreshold: z.number().int(),
      stockQuantity: z.number().int(),
      title: z.string()
    })
  ),
  recentOrders: z.array(
    z.strictObject({
      createdAt: z.string(),
      currency: z.string(),
      customerName: z.string(),
      id: z.string(),
      orderNumber: z.string(),
      status: z.string(),
      totalAmount: z.string()
    })
  ),
  storeId: z.string(),
  summary: z.strictObject({
    lowStockProducts: z.number().int(),
    pendingOrders: z.number().int(),
    thisMonthRevenue: z.string(),
    todayRevenue: z.string(),
    totalOrders: z.number().int(),
    totalProducts: z.number().int()
  }),
  topProducts: z.array(
    z.strictObject({
      productId: z.string(),
      quantitySold: z.number().int(),
      revenue: z.string(),
      title: z.string()
    })
  )
});

export type AiMetricsResponse = z.infer<typeof aiMetricsResponseSchema>;

/* -------------------------------------------------------------------------- */
/*                                   Reports                                   */
/* -------------------------------------------------------------------------- */

/**
 * The report keys, one per function `report.service.ts` already exposes. There
 * is no key that does not map to an existing report: this endpoint is a
 * transport for the dashboard's reports, not a query language.
 */
export const AI_REPORT_KEYS = [
  "abandoned-carts",
  "customers",
  "incomplete-orders",
  "merchandising",
  "orders",
  "overview",
  "products",
  "revenues"
] as const;

export type AiReportKey = (typeof AI_REPORT_KEYS)[number];

export const aiReportKeySchema = z.enum(AI_REPORT_KEYS);

/** Mirrors `parseReportRange` in report.types.ts. */
export const aiReportRangeSchema = z.enum(["12m", "30d", "90d"]);

/**
 * `?range=` on a report.
 *
 * Validated rather than coerced: `parseReportRange` silently falls back to 30d
 * for the dashboard, which is right for a URL a seller can typo but wrong for an
 * API, where a caller asking for `?range=6m` should be told it does not exist
 * rather than handed a month of data it did not ask for.
 */
export const aiReportQuerySchema = z.object({
  range: aiReportRangeSchema.default("30d")
});

export type AiReportQuery = z.infer<typeof aiReportQuerySchema>;

/**
 * Reports that name individual customers need `read:customers` on top of
 * `read:analytics`.
 *
 * A revenue chart and a list of a store's best customers are not the same
 * disclosure, and a key granted only analytics access should not be able to
 * reach the second by asking for a different report key.
 */
export const AI_REPORT_EXTRA_SCOPES: Partial<Record<AiReportKey, AiScope>> = {
  customers: "read:customers",
  orders: "read:customers",
  overview: "read:customers"
};

const reportMetricSchema = z.object({
  change: z.number(),
  value: z.number()
});

const reportSeriesPointSchema = z.object({
  label: z.string(),
  secondary: z.number().optional(),
  value: z.number()
});

const reportTopProductSchema = z.object({
  quantity: z.number(),
  revenue: z.number(),
  title: z.string()
});

const reportTopCustomerSchema = z.object({
  name: z.string(),
  orders: z.number(),
  purchased: z.number()
});

const reportLabelValueSchema = z.object({
  label: z.string(),
  value: z.number()
});

const aiOverviewReportSchema = z.object({
  currency: z.string(),
  customerOverview: z.object({
    aov: z.number(),
    itemsPerCustomer: z.number(),
    ordersPerCustomer: z.number(),
    topCustomers: z.array(reportTopCustomerSchema)
  }),
  customers: reportMetricSchema,
  daily: z.array(
    z.object({
      date: z.string(),
      label: z.string(),
      netRevenue: z.number(),
      newCustomerOrders: z.number(),
      orderCount: z.number(),
      refundCount: z.number(),
      refunds: z.number(),
      returningCustomerOrders: z.number(),
      sales: z.number()
    })
  ),
  netRevenue: reportMetricSchema,
  orderStatuses: z.array(z.object({ count: z.number(), label: z.string() })),
  orders: reportMetricSchema,
  productStats: z.object({
    averagePrice: z.number(),
    inventoryCount: z.number(),
    productsInCatalog: z.number(),
    variations: z.number()
  }),
  productsSold: reportMetricSchema,
  refunds: reportMetricSchema,
  sales: reportMetricSchema,
  topProducts: z.array(reportTopProductSchema)
});

const aiOrdersReportSchema = z.object({
  currency: z.string(),
  daily: z.array(reportSeriesPointSchema),
  metrics: z.object({
    cancelled: z.number(),
    completed: z.number(),
    pending: z.number(),
    processing: z.number(),
    refunded: z.number(),
    total: z.number()
  }),
  monthly: z.array(reportSeriesPointSchema),
  recentOrders: z.array(
    z.object({
      createdAt: z.string(),
      customer: z.string(),
      id: z.string(),
      orderNumber: z.string(),
      status: z.string(),
      total: z.number()
    })
  ),
  statuses: z.array(reportLabelValueSchema)
});

const aiRevenuesReportSchema = z.object({
  currency: z.string(),
  daily: z.array(reportSeriesPointSchema),
  metrics: z.object({
    aov: z.number(),
    gross: z.number(),
    net: z.number(),
    refunds: z.number()
  }),
  monthly: z.array(reportSeriesPointSchema),
  topDays: z.array(z.object({ date: z.string(), orders: z.number(), revenue: z.number() }))
});

const aiProductsReportSchema = z.object({
  categoryPerformance: z.array(
    z.object({ category: z.string(), quantity: z.number(), revenue: z.number() })
  ),
  currency: z.string(),
  inventory: z.array(reportLabelValueSchema),
  lowStock: z.array(
    z.object({
      id: z.string(),
      stock: z.number(),
      threshold: z.number(),
      title: z.string()
    })
  ),
  metrics: z.object({
    active: z.number(),
    lowStock: z.number(),
    outOfStock: z.number(),
    total: z.number()
  }),
  topProducts: z.array(reportTopProductSchema)
});

const aiCustomersReportSchema = z.object({
  currency: z.string(),
  frequency: z.array(reportLabelValueSchema),
  growth: z.array(reportSeriesPointSchema),
  metrics: z.object({
    averageValue: z.number(),
    newCustomers: z.number(),
    returning: z.number(),
    total: z.number()
  }),
  topCustomers: z.array(reportTopCustomerSchema)
});

const aiIncompleteOrdersReportSchema = z.object({
  currency: z.string(),
  daily: z.array(
    z.object({
      failed: z.number(),
      incomplete: z.number(),
      label: z.string(),
      lostRevenue: z.number(),
      recovered: z.number(),
      recoveredRevenue: z.number(),
      recoveryRate: z.number()
    })
  ),
  failureReasons: z.array(reportLabelValueSchema),
  metrics: z.object({
    failed: z.number(),
    lostRevenue: z.number(),
    recoveredRevenue: z.number(),
    recoveryRate: z.number(),
    total: z.number()
  }),
  recoveryChannels: z.array(reportLabelValueSchema)
});

const aiAbandonedCartsReportSchema = z.object({
  currency: z.string(),
  daily: z.array(
    z.object({
      abandoned: z.number(),
      label: z.string(),
      lostRevenue: z.number(),
      recovered: z.number(),
      recoveredRevenue: z.number(),
      recoveryRate: z.number()
    })
  ),
  metrics: z.object({
    lostRevenue: z.number(),
    recoveredRevenue: z.number(),
    recoveryRate: z.number(),
    total: z.number()
  }),
  recoveryChannels: z.array(reportLabelValueSchema)
});

const aiMerchandisingReportSchema = z.object({
  currency: z.string(),
  daily: z.array(z.object({ crossSell: z.number(), label: z.string(), orderBump: z.number() })),
  metrics: z.object({
    attachRate: z.number(),
    bundleOrders: z.number(),
    bundleSavings: z.number(),
    crossSellRevenue: z.number(),
    crossSellUnits: z.number(),
    orderBumpRevenue: z.number(),
    orderBumpUnits: z.number(),
    suggestedRevenue: z.number()
  }),
  topBundles: z.array(
    z.object({ name: z.string(), savings: z.number(), timesApplied: z.number() })
  ),
  topSuggested: z.array(
    z.object({
      quantity: z.number(),
      revenue: z.number(),
      source: z.string(),
      title: z.string()
    })
  ),
  totalRevenue: z.number()
});

/**
 * One schema per report key. Each mirrors its type in `report.types.ts`.
 *
 * These are the one place on this API that *strip* rather than reject. Every
 * other response is built field by field in the AI module, so an unknown key
 * cannot appear and `strictObject` catches a mapper that drifted from its
 * schema. A report is different: it is somebody else's DTO, computed for the
 * dashboard, and it will gain fields. Stripping keeps the allow-list exactly as
 * binding — anything not listed here never reaches the caller — while a new
 * dashboard metric ships without turning this endpoint into a 500. Adding it to
 * the API is then a deliberate line in this file.
 */
export const AI_REPORT_SCHEMAS = {
  "abandoned-carts": aiAbandonedCartsReportSchema,
  customers: aiCustomersReportSchema,
  "incomplete-orders": aiIncompleteOrdersReportSchema,
  merchandising: aiMerchandisingReportSchema,
  orders: aiOrdersReportSchema,
  overview: aiOverviewReportSchema,
  products: aiProductsReportSchema,
  revenues: aiRevenuesReportSchema
} as const;

export const aiReportResponseSchema = z.strictObject({
  data: z.unknown(),
  key: aiReportKeySchema,
  range: aiReportRangeSchema,
  storeId: z.string()
});

export type AiReportResponse = z.infer<typeof aiReportResponseSchema>;

/* -------------------------------------------------------------------------- */
/*                                  Customers                                  */
/* -------------------------------------------------------------------------- */

export const aiCustomerQuerySchema = aiPageQuerySchema.extend({
  /** Matched against name, phone and email. */
  search: z.string().trim().min(1).max(120).optional()
});

export type AiCustomerQuery = z.infer<typeof aiCustomerQuerySchema>;

/**
 * One customer, as the AI is allowed to see it.
 *
 * The contact details are **masked** — `maskPhone` and `maskEmail` from
 * `ai-redact.ts`, the same treatment the orders endpoint already gives them.
 * An assistant answering "who are my best customers" needs to name and rank
 * them; it does not need a list of reachable phone numbers, and a key that
 * leaked would otherwise hand over the store's whole contact book.
 *
 * `totalSpent` is a string for the same reason every other money field is: a
 * Decimal through `JSON.stringify` becomes a float and loses paisa.
 */
export const aiCustomerSchema = z.strictObject({
  createdAt: z.string(),
  currency: z.string(),
  /** Masked, e.g. `a***@shop.com`. Null when the account has no email. */
  email: z.string().nullable(),
  id: z.string(),
  lastOrderAt: z.string().nullable(),
  name: z.string(),
  orderCount: z.number().int(),
  /** Masked, e.g. `+8801*****89`. */
  phone: z.string(),
  totalSpent: z.string()
});

export type AiCustomer = z.infer<typeof aiCustomerSchema>;

export const aiCustomerListResponseSchema = z.strictObject({
  data: z.array(aiCustomerSchema),
  page: aiPageInfoSchema,
  storeId: z.string()
});

export type AiCustomerListResponse = z.infer<typeof aiCustomerListResponseSchema>;

/* -------------------------------------------------------------------------- */
/*                                  Inventory                                  */
/* -------------------------------------------------------------------------- */

/**
 * What the seller is actually asking when they ask about stock.
 *
 * `low` and `out` are the two questions worth a round trip — "what do I need to
 * reorder" and "what am I losing sales on" — so they are filters rather than
 * something the caller reconstructs by walking the whole catalogue and
 * comparing two numbers itself.
 */
export const aiInventoryFilterSchema = z.enum(["all", "low", "out"]);

export const aiInventoryQuerySchema = aiPageQuerySchema.extend({
  filter: aiInventoryFilterSchema.default("all")
});

export type AiInventoryQuery = z.infer<typeof aiInventoryQuerySchema>;

/** Derived, not stored: the comparison every caller would otherwise redo. */
export const aiStockStateSchema = z.enum(["in_stock", "low", "out_of_stock"]);

export const aiInventoryItemSchema = z.strictObject({
  /** True when the product may still be sold past zero. */
  allowPreorder: z.boolean(),
  id: z.string(),
  lowStockThreshold: z.number().int(),
  sku: z.string().nullable(),
  state: aiStockStateSchema,
  /** Negative on a pre-order product means units owed, not a data error. */
  stockQuantity: z.number().int(),
  title: z.string()
});

export type AiInventoryItem = z.infer<typeof aiInventoryItemSchema>;

export const aiInventoryListResponseSchema = z.strictObject({
  data: z.array(aiInventoryItemSchema),
  page: aiPageInfoSchema,
  storeId: z.string()
});

export type AiInventoryListResponse = z.infer<typeof aiInventoryListResponseSchema>;

/* -------------------------------------------------------------------------- */
/*                                   Actions                                   */
/* -------------------------------------------------------------------------- */

/**
 * The write half of the API.
 *
 * Three deliberate constraints run through everything below:
 *
 * 1. **No creation of products or orders, and no deletion of anything.** An
 *    assistant that can edit what exists is useful; one that can invent
 *    catalogue entries or remove a seller's records is a liability. Coupons are
 *    the one create, because a coupon is additive and expires.
 * 2. **Every field is optional and absent means untouched.** A patch that
 *    reaches only the field the seller asked about cannot blank the eleven it
 *    never mentioned.
 * 3. **The bodies validate here, but the *rules* stay in the domain services.**
 *    These schemas check shape; `updateProduct`, `createCoupon` and
 *    `updateOrderStatus` still enforce slug/SKU uniqueness, coupon invariants
 *    and status transitions, so the API cannot reach a state the dashboard
 *    could not.
 */

const aiMoneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), {
    message: "Use a valid amount with up to 2 decimal places."
  });

const aiOptionalTextSchema = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .transform((value) => value || null)
    .optional();

export const aiProductUpdateBodySchema = z
  .strictObject({
    compareAtPrice: z.union([aiMoneySchema, z.null()]).optional(),
    description: aiOptionalTextSchema(10000),
    features: aiOptionalTextSchema(2000),
    keywords: aiOptionalTextSchema(500),
    metaDescription: aiOptionalTextSchema(160),
    price: aiMoneySchema.optional(),
    seoTitle: aiOptionalTextSchema(70),
    shortDescription: aiOptionalTextSchema(320),
    socialCaption: aiOptionalTextSchema(600),
    status: aiProductStatusSchema.optional(),
    stockQuantity: z.coerce.number().int().min(0).optional(),
    title: z.string().trim().min(2).max(160).optional(),
    visibility: aiProductVisibilitySchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Send at least one field to update."
  });

export type AiProductUpdateBody = z.infer<typeof aiProductUpdateBodySchema>;

export const aiProductUpdateResponseSchema = z.strictObject({
  /** The field names that actually changed, so the assistant can say so. */
  changed: z.array(z.string()),
  product: aiProductSchema,
  storeId: z.string()
});

export type AiProductUpdateResponse = z.infer<typeof aiProductUpdateResponseSchema>;

/**
 * Coupon creation.
 *
 * A thin echo of `createCouponSchema` rather than a re-import of it: that schema
 * is shaped for an HTML form, where every key is always present and dates
 * arrive as `YYYY-MM-DD` strings. This one is shaped for a JSON caller, and the
 * values it produces are handed straight to `createCoupon`, which re-validates
 * them against the real thing including every cross-field invariant.
 */
export const aiCouponCreateBodySchema = z.strictObject({
  code: z.string().trim().min(3).max(40),
  description: z.string().trim().max(500).optional(),
  discountType: z.enum(["FIXED_CART", "FREE_SHIPPING", "PERCENTAGE"]).default("PERCENTAGE"),
  discountValue: aiMoneySchema,
  /** `YYYY-MM-DD`, read as the end of that day. */
  expiresAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  maxDiscountAmount: aiMoneySchema.optional(),
  maxSubtotal: aiMoneySchema.optional(),
  minSubtotal: aiMoneySchema.optional(),
  name: z.string().trim().min(2).max(140),
  startsAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  usageLimitPerCustomer: z.coerce.number().int().min(1).optional(),
  usageLimitTotal: z.coerce.number().int().min(1).optional()
});

export type AiCouponCreateBody = z.infer<typeof aiCouponCreateBodySchema>;

export const aiCouponSchema = z.strictObject({
  code: z.string(),
  discountType: z.string(),
  discountValue: z.string(),
  expiresAt: z.string().nullable(),
  id: z.string(),
  name: z.string(),
  startsAt: z.string().nullable(),
  status: z.string()
});

export const aiCouponCreateResponseSchema = z.strictObject({
  coupon: aiCouponSchema,
  storeId: z.string()
});

export type AiCouponCreateResponse = z.infer<typeof aiCouponCreateResponseSchema>;

/**
 * Order status.
 *
 * Exactly the three the dashboard's own buttons set. `PENDING` and `CONFIRMED`
 * are absent because nothing in the dashboard moves an order *back* into them,
 * and an API that can is an API that can undo a seller's decision. Refunds and
 * payment status are not here at all: money moving is not an agent's call.
 */
export const aiOrderStatusUpdateSchema = z.enum(["CANCELLED", "COMPLETED", "PROCESSING"]);

export const aiOrderStatusBodySchema = z.strictObject({
  status: aiOrderStatusUpdateSchema
});

export type AiOrderStatusBody = z.infer<typeof aiOrderStatusBodySchema>;

export const aiOrderStatusResponseSchema = z.strictObject({
  id: z.string(),
  orderNumber: z.string(),
  /** What it was, so the assistant can report the change rather than the state. */
  previousStatus: aiOrderStatusSchema,
  status: aiOrderStatusSchema,
  storeId: z.string()
});

export type AiOrderStatusResponse = z.infer<typeof aiOrderStatusResponseSchema>;
