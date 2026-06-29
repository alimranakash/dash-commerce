import { TemplateHomepageBase } from "../shared-template-components";
import type { StorefrontTemplateHomepageProps } from "../types";

export function BeautyHomepageSections(props: StorefrontTemplateHomepageProps) {
  return (
    <TemplateHomepageBase
      {...props}
      accent={{
        description: "A soft storefront foundation for skincare, cosmetics, self-care, and beauty routines.",
        label: "Cosmetics & Beauty Template",
        tone: {
          background: "#fff1f5",
          border: "#fecdd3",
          color: "#4a1624"
        }
      }}
    />
  );
}
