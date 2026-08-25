"use client";

import { useStorefrontBasePath } from "../base-path-provider";
import Link from "next/link";
import { formatStorefrontMoney } from "../format";
import type { StorefrontProduct } from "../storefront.types";
import { StorefrontImage } from "./storefront-image";

type ProductCardProps = {
  currency: string;
  product: StorefrontProduct;
  storeSlug: string;
};

export function ProductCard({ currency, product }: ProductCardProps) {
  const basePath = useStorefrontBasePath();
  const image = product.images[0];

  return (
    <Link className="sf-product-card" href={`${basePath}/products/${product.slug}`}>
      <div className="sf-product-image">
        <StorefrontImage alt={image?.alt ?? product.title} fallback="No image" src={image?.url} />
      </div>
      <div className="sf-product-meta">
        <div>
          <h3>{product.title}</h3>
          {product.category ? <span>{product.category.name}</span> : null}
        </div>
        <ProductPrice
          compareAtPrice={product.compareAtPrice?.toString()}
          currency={currency}
          price={product.price.toString()}
        />
        <StockStatus stockQuantity={product.stockQuantity} />
        <span className="sf-product-link">View Product</span>
      </div>
    </Link>
  );
}

export function ProductPrice({
  compareAtPrice,
  currency,
  price
}: {
  compareAtPrice?: string | undefined;
  currency: string;
  price: string;
}) {
  return (
    <div className="sf-price">
      <strong>{formatStorefrontMoney(price, currency)}</strong>
      {compareAtPrice ? <span>{formatStorefrontMoney(compareAtPrice, currency)}</span> : null}
    </div>
  );
}

/**
 * What a shopper is told when they are buying something that is not here yet.
 *
 * The date is the point of it: "pre-order" on its own reads as a delay of
 * unknown length, which is how a seller loses the order they just took.
 */
export function preorderLabel(releaseAt: Date | string | null | undefined) {
  if (!releaseAt) {
    return "Pre-order";
  }

  const date = new Date(releaseAt);

  if (Number.isNaN(date.getTime())) {
    return "Pre-order";
  }

  return `Pre-order · ships around ${new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(date)}`;
}

export function StockStatus({
  allowPreorder,
  preorderReleaseAt,
  stockQuantity
}: {
  allowPreorder?: boolean | undefined;
  preorderReleaseAt?: Date | string | null | undefined;
  stockQuantity: number;
}) {
  if (stockQuantity <= 0 && allowPreorder) {
    return <p className="sf-stock in-stock">{preorderLabel(preorderReleaseAt)}</p>;
  }

  return (
    <p className={stockQuantity > 0 ? "sf-stock in-stock" : "sf-stock out-stock"}>
      {stockQuantity > 0 ? `${stockQuantity} in stock` : "Out of stock"}
    </p>
  );
}
