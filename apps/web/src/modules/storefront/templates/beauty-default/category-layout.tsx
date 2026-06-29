import { TemplateLayoutPlaceholder } from "../shared-template-components";
import type { StorefrontTemplatePlaceholderProps } from "../types";

export function BeautyCategoryLayoutPlaceholder(props: StorefrontTemplatePlaceholderProps) {
  return <TemplateLayoutPlaceholder {...props} label="Beauty category layout" type="category" />;
}
