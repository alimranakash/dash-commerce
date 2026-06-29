import { TemplateProductCardBase } from "../shared-template-components";
import type { StorefrontTemplateProductCardProps } from "../types";

export function GeneralProductCard(props: StorefrontTemplateProductCardProps) {
  return <TemplateProductCardBase {...props} variant="general-minimal" />;
}
