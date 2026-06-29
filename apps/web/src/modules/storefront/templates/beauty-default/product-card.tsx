import { TemplateProductCardBase } from "../shared-template-components";
import type { StorefrontTemplateProductCardProps } from "../types";

export function BeautyProductCard(props: StorefrontTemplateProductCardProps) {
  return <TemplateProductCardBase {...props} variant="beauty-soft-card" />;
}
