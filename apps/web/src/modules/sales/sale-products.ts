import type { StoreVariantOption } from "../products/product-variants.service";
import type { SaleProductOption } from "./sale-scan";

type SaleCatalogProduct = {
  barcode: string | null;
  id: string;
  price: { toString(): string };
  sku: string | null;
  status: string;
  stockQuantity: number;
  title: string;
};

/**
 * The catalogue as the sale form needs it — the new-sale and edit-sale pages
 * share it so the two cannot disagree about what can be sold. Each product
 * carries its active options: a product with any is sold as one of them, at
 * that option's price and from its stock, and each option's barcode is what
 * the scanner matches. Drafts are sold like any other product, as the label
 * page prints them, because a shop that sells only at the counter keeps its
 * catalogue off the storefront; the trash is flagged so a scan refuses it.
 * Nothing here is a cost price or anything else the counter has no use for.
 */
export function toSaleProductOptions(
  products: SaleCatalogProduct[],
  variantsByProduct: Map<string, StoreVariantOption[]>
): SaleProductOption[] {
  return products.map((product) => ({
    archived: product.status === "ARCHIVED",
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
