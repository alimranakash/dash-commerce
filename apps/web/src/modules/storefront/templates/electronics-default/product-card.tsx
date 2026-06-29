import { TemplateProductCardBase } from "../shared-template-components";
import type { StorefrontTemplateProductCardProps } from "../types";

export function ElectronicsProductCard(props: StorefrontTemplateProductCardProps) {
  return <TemplateProductCardBase {...props} variant="electronics-spec-card" />;
}
