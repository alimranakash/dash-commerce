import { TemplateLayoutPlaceholder } from "../shared-template-components";
import type { StorefrontTemplatePlaceholderProps } from "../types";

export function GeneralCategoryLayoutPlaceholder(props: StorefrontTemplatePlaceholderProps) {
  return <TemplateLayoutPlaceholder {...props} label="General category layout" type="category" />;
}
