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
