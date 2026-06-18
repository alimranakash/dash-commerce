import { notFound } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { getCategoriesForStore } from "../../../../../modules/categories/category.service";
import { ProductForm } from "../../../../../modules/products/components/product-form";
import { updateProductFormAction } from "../../../../../modules/products/product.actions";
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
  const [product, categories] = await Promise.all([
    getProductByIdForStore(store.id, productId),
    getCategoriesForStore(store.id)
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
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name
          }))}
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
            status: product.status,
            visibility: product.visibility,
            imageUrls: product.images.map((image) => image.url).join("\n")
          }}
          submitLabel="Save product"
        />
      </section>
    </DashboardShell>
  );
}
