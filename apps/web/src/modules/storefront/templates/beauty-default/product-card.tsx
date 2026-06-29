import type { StorefrontTemplateProductCardProps } from "../types";
import { BeautyProductCard as BeautyProductCardBase } from "./components";

export function BeautyProductCard(props: StorefrontTemplateProductCardProps) {
  return <BeautyProductCardBase {...props} />;
}
