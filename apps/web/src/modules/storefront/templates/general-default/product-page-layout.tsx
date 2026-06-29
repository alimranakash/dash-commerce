import { TemplateLayoutPlaceholder } from "../shared-template-components";
import type { StorefrontTemplatePlaceholderProps } from "../types";

export function GeneralProductPageLayoutPlaceholder(props: StorefrontTemplatePlaceholderProps) {
  return <TemplateLayoutPlaceholder {...props} label="General product layout" type="product" />;
}
