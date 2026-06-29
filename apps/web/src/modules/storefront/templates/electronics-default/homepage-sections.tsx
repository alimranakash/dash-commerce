import { TemplateHomepageBase } from "../shared-template-components";
import type { StorefrontTemplateHomepageProps } from "../types";

export function ElectronicsHomepageSections(props: StorefrontTemplateHomepageProps) {
  return (
    <TemplateHomepageBase
      {...props}
      accent={{
        description: "A tech-focused storefront foundation for devices, specs, accessories, and fast comparison.",
        label: "Electronics Template",
        tone: {
          background: "#eef6ff",
          border: "#bfdbfe",
          color: "#10233f"
        }
      }}
    />
  );
}
