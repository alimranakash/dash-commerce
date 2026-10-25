import type { StoreVariantOption } from "../products/product-variants.service";

type SaleCatalogProduct = {
  barcode: string | null;
  id: string;
  price: { toString(): string };
  sku: string | null;
  stockQuantity: number;
  title: string;
};

/**
 * The catalogue as the sale form needs it — the new-sale and edit-sale pages
 * share it so the two cannot disagree about what can be sold. Each product
 * carries its active options: a product with any is sold as one of them, at
 * that option's price and from its stock, and each option's barcode is what
 * the scanner matches. Nothing here is a cost price or anything else the
 * counter has no use for.
 */
export function toSaleProductOptions(
  products: SaleCatalogProduct[],
  variantsByProduct: Map<string, StoreVariantOption[]>
) {
  return products.map((product) => ({
    barcode: product.barcode,
    id: product.id,
    price: product.price.toString(),
    sku: product.sku,
    stockQuantity: product.stockQuantity,
    title: product.title,
    variants: (variantsByProduct.get(product.id) ?? []).map((variant) => ({
      barcode: variant.barcode,
      continueSelling: variant.continueSelling,
      id: variant.id,
      price: variant.price,
      sku: variant.sku,
      stockQuantity: variant.stockQuantity,
      title: variant.title
    }))
  }));
}
