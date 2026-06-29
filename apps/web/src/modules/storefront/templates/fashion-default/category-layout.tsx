import { TemplateLayoutPlaceholder } from "../shared-template-components";
import type { StorefrontTemplatePlaceholderProps } from "../types";

export function FashionCategoryLayoutPlaceholder(props: StorefrontTemplatePlaceholderProps) {
  return <TemplateLayoutPlaceholder {...props} label="Fashion collection layout" type="category" />;
}
