"use client";

import Link from "next/link";
import { StorefrontImage } from "../../components/storefront-image";
import type { FashionProductCardData } from "./fashion-product-card-data";
import styles from "./fashion-product-card.module.css";

type FashionEditorialProductCardProps = {
  currency: string;
  product: FashionProductCardData;
  storeSlug: string;
};

export function FashionEditorialProductCard({
  currency,
  product,
  storeSlug
}: FashionEditorialProductCardProps) {
  const productHref = product.slug
    ? `/s/${storeSlug}/products/${product.slug}`
    : `/s/${storeSlug}/products`;
  const primaryImage = product.images[0];
  const secondaryImage = product.images[1];
  const price = Number(product.price);
  const comparePrice = product.compareAtPrice ? Number(product.compareAtPrice) : null;
  const isSale = comparePrice !== null && comparePrice > price;
  const saving = isSale && comparePrice
    ? Math.round(((comparePrice - price) / comparePrice) * 100)
    : 0;
  const badges = [
    product.isNew ? "New" : null,
    isSale ? "Sale" : null,
    saving > 0 ? `Save ${saving}%` : null
  ].filter((badge): badge is string => Boolean(badge));
  const canAddToCart = Boolean(product.id && product.slug && product.storeId);

  return (
    <article className={styles.card}>
      <div className={styles.media}>
        <Link aria-label={`View ${product.title}`} className={styles.mediaLink} href={productHref}>
          <StorefrontImage
            alt={primaryImage?.alt ?? product.title}
            fallback={product.title}
            src={primaryImage?.url}
          />
          {secondaryImage ? (
            <img
              alt=""
              className={styles.secondaryImage}
              decoding="async"
              loading="lazy"
              src={secondaryImage.url}
            />
          ) : null}
        </Link>
        {badges.length > 0 ? (
          <div className={styles.badges}>
            {badges.map((badge) => (
              <span data-kind={getBadgeKind(badge)} key={badge}>{badge}</span>
            ))}
          </div>
        ) : null}
        {canAddToCart ? (
          <form action="/api/cart" className={styles.quickAdd} method="post">
            <input name="cartAction" type="hidden" value="add" />
            <input name="storeId" type="hidden" value={product.storeId ?? ""} />
            <input name="storeSlug" type="hidden" value={storeSlug} />
            <input name="productId" type="hidden" value={product.id ?? ""} />
            <input name="productSlug" type="hidden" value={product.slug ?? ""} />
            <input name="quantity" type="hidden" value="1" />
            <button disabled={product.stockQuantity < 1} type="submit">
              {product.stockQuantity < 1 ? "Out of stock" : "Add to cart"}
            </button>
          </form>
        ) : null}
      </div>
      <div className={styles.details}>
        {product.category ? <p>{product.category.name}</p> : null}
        <h3><Link href={productHref}>{product.title}</Link></h3>
        <div className={styles.price}>
          {isSale && comparePrice ? <del>{formatMoney(String(comparePrice), currency)}</del> : null}
          <strong data-sale={isSale}>{formatMoney(product.price, currency)}</strong>
        </div>
      </div>
    </article>
  );
}

function getBadgeKind(badge: string) {
  if (badge === "Sale") return "sale";
  if (badge.startsWith("Save")) return "save";
  return "new";
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(Number(value));
}
