"use client";

import { useMemo, useState } from "react";
import { ProductPrice } from "../../components/product-listing";
import { ProductPurchasePanel } from "../../components/product-purchase-panel";
import type { ProductVariantConfiguration } from "../../../products/product-variants.service";

type ProductVariantControlsProps = {
  addToCartButtonColor: string;
  addToCartButtonRadius: number;
  addToCartText: string;
  baseCompareAtPrice?: string | null | undefined;
  basePrice: string;
  baseSku?: string | null | undefined;
  baseStockQuantity: number;
  buyNowEnabled: boolean;
  currency: string;
  productId: string;
  productSlug: string;
  storeId: string;
  storeSlug: string;
  variantConfiguration: ProductVariantConfiguration;
  variantEnabled: boolean;
  variantStyle: "buttons" | "dropdown";
};

export function ProductVariantControls({
  addToCartButtonColor,
  addToCartButtonRadius,
  addToCartText,
  baseCompareAtPrice,
  basePrice,
  baseSku,
  baseStockQuantity,
  buyNowEnabled,
  currency,
  productId,
  productSlug,
  storeId,
  storeSlug,
  variantConfiguration,
  variantEnabled,
  variantStyle
}: ProductVariantControlsProps) {
  const activeVariants = useMemo(() => variantConfiguration.variants.filter((variant) => variant.status !== "INACTIVE"), [variantConfiguration.variants]);
  const [selectedSignature, setSelectedSignature] = useState(activeVariants[0]?.optionSignature ?? "");
  const selectedVariant = activeVariants.find((variant) => variant.optionSignature === selectedSignature) ?? activeVariants[0];
  const price = selectedVariant?.price ?? basePrice;
  const compareAtPrice = selectedVariant?.compareAtPrice ?? baseCompareAtPrice ?? undefined;
  const sku = selectedVariant?.sku ?? baseSku;
  const stockQuantity = selectedVariant?.stockQuantity ?? baseStockQuantity;
  const canContinueSelling = Boolean(selectedVariant?.continueSelling);

  function selectVariant(signature: string) {
    setSelectedSignature(signature);
    const variant = activeVariants.find((item) => item.optionSignature === signature);

    window.dispatchEvent(new CustomEvent("dash:storefront-variant-media", {
      detail: {
        imageUrl: variant?.imageUrl || ""
      }
    }));
  }

  return (
    <div className="general-product-dynamic-stack">
      <ProductPrice compareAtPrice={compareAtPrice ? String(compareAtPrice) : undefined} currency={currency} price={String(price)} />
      {sku ? <p className="general-product-sku">SKU: {sku}</p> : null}
      {variantEnabled && activeVariants.length > 0 ? (
        <div className="general-product-variant-matrix" aria-label="Product variants">
          <span>Options</span>
          {variantStyle === "dropdown" ? (
            <select
              aria-label="Product options"
              className="general-product-variant-select"
              onChange={(event) => selectVariant(event.target.value)}
              value={selectedSignature}
            >
              {activeVariants.map((variant) => (
                <option key={variant.optionSignature} value={variant.optionSignature}>
                  {variant.title}
                </option>
              ))}
            </select>
          ) : (
            <div>
              {activeVariants.map((variant) => (
                <button
                  aria-pressed={variant.optionSignature === selectedSignature}
                  key={variant.optionSignature}
                  onClick={() => selectVariant(variant.optionSignature)}
                  type="button"
                >
                  {variant.title}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
      <p className="general-product-stock">
        {stockQuantity > 0 || canContinueSelling ? `${stockQuantity} in Stock` : "Out of Stock"}
      </p>
      <ProductPurchasePanel
        addToCartButtonColor={addToCartButtonColor}
        addToCartButtonRadius={addToCartButtonRadius}
        addToCartText={addToCartText}
        buyNowEnabled={buyNowEnabled}
        maxQuantity={canContinueSelling ? 999999 : stockQuantity}
        productId={productId}
        productSlug={productSlug}
        secondaryActionsEnabled={false}
        storeId={storeId}
        storeSlug={storeSlug}
        variantId={selectedVariant?.id ?? null}
      />
    </div>
  );
}
