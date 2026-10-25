import { ScanLine } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { formatVariantLine } from "../../../../modules/barcodes/barcode-label.layout";
import { getLabelProductsForStore } from "../../../../modules/barcodes/barcode.service";
import {
  BarcodeLabelStudio,
  type LabelStudioItem
} from "../../../../modules/barcodes/components/barcode-label-studio";
import { getStoreVariantOptions } from "../../../../modules/products/product-variants.service";
import { requireStore } from "../../../../modules/stores/queries";

type BarcodeLabelsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BarcodeLabelsPage({ searchParams }: BarcodeLabelsPageProps) {
  const store = await requireStore();
  const [products, variantsByProduct, params] = await Promise.all([
    getLabelProductsForStore(store.id),
    getStoreVariantOptions(store.id),
    searchParams
  ]);
  // A product sold by option is labelled option by option — the sale needs to
  // know which size went, and each has its own price and stock — so it has no
  // row of its own. One without options is labelled as itself.
  const items = products.flatMap((product): LabelStudioItem[] => {
    const imageUrl = product.images[0]?.url ?? null;
    const variants = variantsByProduct.get(product.id) ?? [];

    if (!variants.length) {
      return [
        {
          barcode: product.barcode,
          imageUrl,
          key: `p:${product.id}`,
          price: product.price.toString(),
          productId: product.id,
          sku: product.sku,
          stockQuantity: product.stockQuantity,
          title: product.title,
          variant: null,
          variantId: null,
          variantTitle: null
        }
      ];
    }

    return variants.map((variant) => ({
      barcode: variant.barcode,
      imageUrl: variant.imageUrl ?? imageUrl,
      key: `v:${variant.id}`,
      price: variant.price,
      productId: product.id,
      sku: variant.sku,
      stockQuantity: variant.stockQuantity,
      title: product.title,
      variant: formatVariantLine(variant.options, variant.title),
      variantId: variant.id,
      variantTitle: variant.title
    }));
  });

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Products</p>
            <h1>Barcode labels</h1>
            <p className="auth-copy">
              Print price labels with your company name, the product, its size or colour, a
              scannable barcode and the selling price. Scan one on the sale page and that exact item
              is added to the sale.
            </p>
          </div>
          <Link className="secondary link-button inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap" href="/dashboard/sales/new">
            <ScanLine aria-hidden="true" className="h-4 w-4" />
            Open the sale page
          </Link>
        </div>
        <BarcodeLabelStudio
          currency={store.currency}
          initialSelection={idsFromParam(params.ids)}
          items={items}
          storeName={store.name}
        />
      </section>
    </DashboardShell>
  );
}

/** `?ids=a,b,c` from the product list's bulk bar; ids from another store match nothing. */
function idsFromParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "");

  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 500);
}
