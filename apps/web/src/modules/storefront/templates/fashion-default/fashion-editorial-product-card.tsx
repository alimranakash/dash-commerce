"use client";

import { useStorefrontBasePath } from "../../base-path-provider";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatStorefrontMoney } from "../../format";
import { QuickViewTrigger } from "../../../quick-view/components/quick-view-trigger";
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
  const basePath = useStorefrontBasePath();
  const productHref = product.slug
    ? `${basePath}/products/${product.slug}`
    : `${basePath}/products`;
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
      {/* The hover reveal for the Quick View button is a global rule, and this
        module has hashed away every class name it could have targeted. The
        attribute is what it keys off instead. */}
      <div className={styles.media} data-quick-view-media="">
        <Link aria-label={`View ${product.title}`} className={styles.mediaLink} href={productHref}>
          <FashionProductImages
            primaryAlt={primaryImage?.alt ?? product.title}
            primaryUrl={primaryImage?.url}
            productTitle={product.title}
            secondaryUrl={secondaryImage?.url}
          />
        </Link>
        {badges.length > 0 ? (
          <div className={styles.badges}>
            {badges.map((badge) => (
              <span data-kind={getBadgeKind(badge)} key={badge}>{badge}</span>
            ))}
          </div>
        ) : null}
        {product.slug ? (
          <QuickViewTrigger productSlug={product.slug} productTitle={product.title} />
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
          {isSale && comparePrice ? (
            <del>{formatStorefrontMoney(comparePrice, currency)}</del>
          ) : null}
          <strong data-sale={isSale}>{formatStorefrontMoney(product.price, currency)}</strong>
        </div>
      </div>
    </article>
  );
}

function FashionProductImages({
  primaryAlt,
  primaryUrl,
  productTitle,
  secondaryUrl
}: {
  primaryAlt: string;
  primaryUrl?: string | undefined;
  productTitle: string;
  secondaryUrl?: string | undefined;
}) {
  const [visiblePrimary, setVisiblePrimary] = useState(primaryUrl ?? secondaryUrl ?? null);
  const [visibleSecondary, setVisibleSecondary] = useState(
    primaryUrl && secondaryUrl ? secondaryUrl : null
  );

  useEffect(() => {
    setVisiblePrimary(primaryUrl ?? secondaryUrl ?? null);
    setVisibleSecondary(primaryUrl && secondaryUrl ? secondaryUrl : null);
  }, [primaryUrl, secondaryUrl]);

  function handlePrimaryError() {
    if (secondaryUrl && visiblePrimary !== secondaryUrl) {
      setVisiblePrimary(secondaryUrl);
      setVisibleSecondary(null);
      return;
    }

    setVisiblePrimary(null);
  }

  return (
    <>
      {visiblePrimary ? (
        <img
          alt={primaryAlt}
          className={styles.primaryImage}
          decoding="async"
          loading="lazy"
          onError={handlePrimaryError}
          src={visiblePrimary}
        />
      ) : (
        <span>{productTitle}</span>
      )}
      {visibleSecondary ? (
        <img
          alt=""
          className={styles.secondaryImage}
          decoding="async"
          loading="lazy"
          onError={() => setVisibleSecondary(null)}
          src={visibleSecondary}
        />
      ) : null}
    </>
  );
}

function getBadgeKind(badge: string) {
  if (badge === "Sale") return "sale";
  if (badge.startsWith("Save")) return "save";
  return "new";
}
