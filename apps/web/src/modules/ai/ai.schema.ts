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
 * The scopes that may actually be granted today.
 *
 * The write verbs exist in the vocabulary so the model, the docs and the storage
 * format are settled before the first write endpoint lands — but nothing
 * enforces them yet, and a scope nothing enforces is a permission that silently
 * means nothing. Issuing one would be worse than refusing it: the seller would
 * believe they had limited the AI when they had not. So key issuance refuses
 * them until the endpoints that check them exist.
 *
 * To enable a write scope later: implement the endpoint that requires it, then
 * move it out of `AI_WRITE_SCOPES`.
 */
export const AI_WRITE_SCOPES: readonly AiScope[] = [
  "write:marketing",
  "write:orders",
  "write:products"
];

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
