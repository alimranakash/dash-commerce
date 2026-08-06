import { beautyDefaultTemplate } from "./beauty-default/config";
import { electronicsDefaultTemplate } from "./electronics-default/config";
import { fashionDefaultTemplate } from "./fashion-default/config";
import { generalDefaultTemplate } from "./general-default/config";
import { DEFAULT_STOREFRONT_TEMPLATE_ID, getTemplateIdForBusinessType } from "./template-mapping";
import type { StorefrontTemplateConfig } from "./types";

export const storefrontTemplateRegistry = {
  [beautyDefaultTemplate.id]: beautyDefaultTemplate,
  [electronicsDefaultTemplate.id]: electronicsDefaultTemplate,
  [fashionDefaultTemplate.id]: fashionDefaultTemplate,
  [generalDefaultTemplate.id]: generalDefaultTemplate
} satisfies Record<string, StorefrontTemplateConfig>;

export function getStorefrontTemplateById(templateId: string | null | undefined) {
  if (!templateId) {
    return generalDefaultTemplate;
  }

  return storefrontTemplateRegistry[templateId] ?? generalDefaultTemplate;
}

export function getStorefrontTemplateForStore(store: {
  activeTemplate?: string | null;
  businessType?: string | null;
}) {
  return getStorefrontTemplateById(
    store.activeTemplate || getTemplateIdForBusinessType(store.businessType) || DEFAULT_STOREFRONT_TEMPLATE_ID
  );
}

export function getAvailableStorefrontTemplates() {
  return Object.values(storefrontTemplateRegistry);
}

// The template library previews a template by rendering the real storefront with
// `?previewTemplate=<id>` instead of the store's saved template. Only ids that
// exist in the registry are honoured, so the parameter can never resolve to
// anything the seller could not also apply.
export function resolveStorefrontPreviewTemplateId(value: string | string[] | undefined) {
  const templateId = Array.isArray(value) ? value[0] : value;

  return templateId && templateId in storefrontTemplateRegistry ? templateId : null;
}
