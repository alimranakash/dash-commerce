import type { StorefrontTemplateProductCardProps } from "../types";
import { ElectronicsProductCard as ElectronicsProductCardBase } from "./components";

export function ElectronicsProductCard(props: StorefrontTemplateProductCardProps) {
  return <ElectronicsProductCardBase {...props} />;
}
