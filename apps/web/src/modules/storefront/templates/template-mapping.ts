export const DEFAULT_STOREFRONT_TEMPLATE_ID = "general-default";

export const businessTypeTemplateMap = {
  "Cosmetics & Beauty": "beauty-default",
  Electronics: "electronics-default",
  Fashion: "fashion-default",
  "General Store": DEFAULT_STOREFRONT_TEMPLATE_ID
} as const;

export type StorefrontBusinessType = keyof typeof businessTypeTemplateMap;
export type StorefrontTemplateId = (typeof businessTypeTemplateMap)[StorefrontBusinessType];

export function getTemplateIdForBusinessType(businessType: string | null | undefined) {
  return businessType && businessType in businessTypeTemplateMap
    ? businessTypeTemplateMap[businessType as StorefrontBusinessType]
    : DEFAULT_STOREFRONT_TEMPLATE_ID;
}

/**
 * The seller-facing name of each template.
 *
 * Here rather than only in each template's own `config.ts` because the
 * registration wizard names all four templates before a store exists, and a
 * `config.ts` import pulls that template's whole React tree in behind it. Each
 * config reads its `name` from this map, so the two cannot drift.
 */
export const storefrontTemplateNames = {
  "beauty-default": "Beauty Default",
  "electronics-default": "Electronics Default",
  "fashion-default": "Fashion Default",
  "general-default": "General Default"
} as const satisfies Record<StorefrontTemplateId, string>;
