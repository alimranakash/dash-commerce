import Link from "next/link";
import type { StorefrontProduct } from "../storefront.types";
import { StorefrontImage } from "./storefront-image";

type ProductCardProps = {
  currency: string;
  product: StorefrontProduct;
  storeSlug: string;
};

export function ProductCard({ currency, product, storeSlug }: ProductCardProps) {
  const image = product.images[0];

  return (
    <Link className="sf-product-card" href={`/s/${storeSlug}/products/${product.slug}`}>
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
      <strong>{formatMoney(price, currency)}</strong>
      {compareAtPrice ? <span>{formatMoney(compareAtPrice, currency)}</span> : null}
    </div>
  );
}

export function StockStatus({ stockQuantity }: { stockQuantity: number }) {
  return (
    <p className={stockQuantity > 0 ? "sf-stock in-stock" : "sf-stock out-stock"}>
      {stockQuantity > 0 ? `${stockQuantity} in stock` : "Out of stock"}
    </p>
  );
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency
  }).format(Number(value));
}
