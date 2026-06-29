import type { StorefrontTemplateProductCardProps } from "../types";
import { FashionProductCard as FashionProductCardBase } from "./components";

export function FashionProductCard(props: StorefrontTemplateProductCardProps) {
  return <FashionProductCardBase {...props} />;
}
