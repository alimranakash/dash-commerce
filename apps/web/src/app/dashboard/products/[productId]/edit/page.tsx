import { notFound } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { getCategoriesForStore } from "../../../../../modules/categories/category.service";
import { ProductStockHistory } from "../../../../../modules/inventory/components/product-stock-history";
import { getStockMovementsForProduct } from "../../../../../modules/inventory/inventory.service";
import { getPlatformRootDomain } from "../../../../../lib/host-routing";
import {
  getProductRelationCandidates,
  getProductRelationSelections,
  getProductRelationSuggestions
} from "../../../../../modules/merchandising/merchandising.service";
import { ProductForm } from "../../../../../modules/products/components/product-form";
import { updateProductFormAction } from "../../../../../modules/products/product.actions";
import {
  getProductCategoryAssignmentIds,
  getProductTaxonomyIds,
  getProductTaxonomyItems
} from "../../../../../modules/products/product-taxonomy.service";
import { getProductVariantConfiguration } from "../../../../../modules/products/product-variants.service";
import { getProductByIdForStore } from "../../../../../modules/products/product.service";
import { requireStore } from "../../../../../modules/stores/queries";

type EditProductPageProps = {
  params: Promise<{
    productId: string;
  }>;
};

export default async function EditProductPage({ params }: EditProductPageProps) {
  const store = await requireStore();
  const { productId } = await params;
  const [product, categories, stockMovements, tags, brands, selectedTagIds, selectedBrandIds, selectedCategoryIds, variantConfiguration, relationCandidates, relationSelections, relationSuggestions] = await Promise.all([
    getProductByIdForStore(store.id, productId),
    getCategoriesForStore(store.id),
    getStockMovementsForProduct(store.organizationId, store.id, productId, 8),
    getProductTaxonomyItems(store.id, "TAG"),
    getProductTaxonomyItems(store.id, "BRAND"),
    getProductTaxonomyIds(store.id, productId, "TAG"),
    getProductTaxonomyIds(store.id, productId, "BRAND"),
    getProductCategoryAssignmentIds(store.id, productId),
    getProductVariantConfiguration(store.id, productId),
    getProductRelationCandidates(store.id),
    getProductRelationSelections(store.id, productId),
    getProductRelationSuggestions(store.id, productId)
  ]);

  if (!product) {
    notFound();
  }

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Catalog</p>
            <h1>Edit product</h1>
            <p className="auth-copy">Update product details for {product.title}.</p>
          </div>
          <Link className="secondary link-button" href="/dashboard/products">
            Back
          </Link>
        </div>
        <ProductForm
          action={updateProductFormAction.bind(null, product.id)}
          brands={brands.map((brand) => ({
            id: brand.id,
            name: brand.name
          }))}
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name
          }))}
          currency={store.currency}
          platformDomain={getPlatformRootDomain()}
          product={{
            id: product.id,
            title: product.title,
            slug: product.slug,
            shortDescription: product.shortDescription ?? undefined,
            description: product.description ?? undefined,
            sku: product.sku ?? undefined,
            price: product.price.toString(),
            compareAtPrice: product.compareAtPrice?.toString(),
            costPrice: product.costPrice?.toString(),
            stockQuantity: product.stockQuantity,
            lowStockThreshold: product.lowStockThreshold,
            categoryId: product.categoryId ?? undefined,
            categoryIds: selectedCategoryIds.length ? selectedCategoryIds : product.categoryId ? [product.categoryId] : [],
            status: product.status,
            visibility: product.visibility,
            brandIds: selectedBrandIds,
            imageUrls: product.images.slice(0, 4).map((image) => image.url),
            tagIds: selectedTagIds,
            variantConfiguration
          }}
          relationCandidates={relationCandidates}
          relationSelections={relationSelections}
          relationSuggestions={relationSuggestions}
          storeSlug={store.slug}
          submitLabel="Save product"
          tags={tags.map((tag) => ({
            id: tag.id,
            name: tag.name
          }))}
        />
        <ProductStockHistory movements={stockMovements} productId={product.id} />
      </section>
    </DashboardShell>
  );
}
