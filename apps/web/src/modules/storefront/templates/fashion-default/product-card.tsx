import type { StorefrontTemplateProductCardProps } from "../types";
import { FashionEditorialProductCard } from "./fashion-editorial-product-card";
import { toFashionProductCardData } from "./fashion-product-card-data";

export function FashionProductCard(props: StorefrontTemplateProductCardProps) {
  return (
    <FashionEditorialProductCard
      currency={props.currency}
      product={toFashionProductCardData(props.product)}
      storeSlug={props.storeSlug}
    />
  );
}
