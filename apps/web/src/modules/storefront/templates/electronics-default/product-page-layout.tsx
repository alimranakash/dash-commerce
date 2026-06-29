import { TemplateLayoutPlaceholder } from "../shared-template-components";
import type { StorefrontTemplatePlaceholderProps } from "../types";

export function ElectronicsProductPageLayoutPlaceholder(props: StorefrontTemplatePlaceholderProps) {
  return <TemplateLayoutPlaceholder {...props} label="Electronics product layout" type="product" />;
}
