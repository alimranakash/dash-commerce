"use client";

import { useMemo, useState } from "react";
import { ProductPrice } from "../../components/product-listing";
import { ProductPurchasePanel } from "../../components/product-purchase-panel";
import { VariantOptionPicker } from "../../components/variant-option-picker";
import {
  initialPickerVariant,
  pickerVariantImage,
  variantOptionGroups
} from "../../variant-options";
import type {
  ProductVariantConfiguration,
  ProductVariantRecord
} from "../../../products/product-variants.service";

type ProductVariantControlsProps = {
  addToCartButtonColor: string;
  addToCartButtonRadius: number;
  addToCartText: string;
  baseCompareAtPrice?: string | null | undefined;
  basePrice: string;
  baseSku?: string | null | undefined;
  baseStockQuantity: number;
  currency: string;
  directCheckoutEnabled: boolean;
  directCheckoutText: string;
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
  currency,
  directCheckoutEnabled,
  directCheckoutText,
  productId,
  productSlug,
  storeId,
  storeSlug,
  variantConfiguration,
  variantEnabled,
  variantStyle
}: ProductVariantControlsProps) {
  const activeVariants = useMemo(() => variantConfiguration.variants.filter((variant) => variant.status !== "INACTIVE"), [variantConfiguration.variants]);
  const optionGroups = useMemo(() => variantOptionGroups(activeVariants), [activeVariants]);
  const [selectedSignature, setSelectedSignature] = useState(
    () => initialPickerVariant(activeVariants)?.optionSignature ?? ""
  );
  const selectedVariant = activeVariants.find((variant) => variant.optionSignature === selectedSignature) ?? activeVariants[0];
  const price = selectedVariant?.price ?? basePrice;
  const compareAtPrice = selectedVariant?.compareAtPrice ?? baseCompareAtPrice ?? undefined;
  const sku = selectedVariant?.sku ?? baseSku;
  const stockQuantity = selectedVariant?.stockQuantity ?? baseStockQuantity;
  const canContinueSelling = Boolean(selectedVariant?.continueSelling);

  function selectVariant(variant: ProductVariantRecord) {
    setSelectedSignature(variant.optionSignature);

    window.dispatchEvent(new CustomEvent("dash:storefront-variant-media", {
      detail: {
        imageUrl: pickerVariantImage(activeVariants, optionGroups, variant)
      }
    }));
  }

  return (
    <div className="general-product-dynamic-stack">
      <ProductPrice compareAtPrice={compareAtPrice ? String(compareAtPrice) : undefined} currency={currency} price={String(price)} />
      {sku ? <p className="general-product-sku">SKU: {sku}</p> : null}
      {variantEnabled && activeVariants.length > 0 ? (
        <div className="general-product-variant-matrix">
          <VariantOptionPicker
            groups={optionGroups}
            onSelect={selectVariant}
            selected={selectedVariant}
            variantStyle={variantStyle}
            variants={activeVariants}
          />
        </div>
      ) : null}
      <p className="general-product-stock">
        {stockQuantity > 0 || canContinueSelling ? `${stockQuantity} in Stock` : "Out of Stock"}
      </p>
      <ProductPurchasePanel
        addToCartButtonColor={addToCartButtonColor}
        addToCartButtonRadius={addToCartButtonRadius}
        addToCartText={addToCartText}
        directCheckoutEnabled={directCheckoutEnabled}
        directCheckoutText={directCheckoutText}
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
