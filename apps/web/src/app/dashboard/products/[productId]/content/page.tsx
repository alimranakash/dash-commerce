import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { BILLING_UPGRADE_PATH } from "../../../../../modules/billing/components/paid-badge";
import { ProductContentStudio } from "../../../../../modules/product-content/components/product-content-studio";
import {
  canGenerateProductContent,
  getProductContentForStore,
  ProductContentNotFoundError
} from "../../../../../modules/product-content/product-content.service";
import { requireStore } from "../../../../../modules/stores/queries";

type ProductContentPageProps = {
  params: Promise<{
    productId: string;
  }>;
};

/**
 * Dashboard → Products → a product → AI Content Studio.
 *
 * A page of its own rather than a card inside the product editor. The editor's
 * Save writes variants, relations and taxonomy in one go, so a studio living
 * inside it would either apply into an unsaved form or write behind the form's
 * back — and "Apply" has to mean the copy is on the product. Here it does.
 *
 * `requireStore()` matches the product editor: writing product copy is ordinary
 * catalogue work. Whether *generating* is available is a separate and narrower
 * question — `canGenerateProductContent` answers it, and it is true for a store
 * with its own provider key whatever the plan says. Editing and saving are never
 * gated, and the actions re-check for themselves.
 */
export default async function ProductContentPage({ params }: ProductContentPageProps) {
  const store = await requireStore();
  const { productId } = await params;

  const [content, aiEnabled] = await Promise.all([
    getProductContentForStore(store.id, productId).catch((error: unknown) => {
      if (error instanceof ProductContentNotFoundError) {
        return null;
      }

      throw error;
    }),
    canGenerateProductContent(store.id)
  ]);

  if (!content) {
    notFound();
  }

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">StoreIM AI</p>
            <h1>Product Content Studio</h1>
            <p className="auth-copy">
              Write the storefront copy, SEO fields, and social caption for {content.productTitle}.
            </p>
          </div>
          <Link className="secondary link-button" href={`/dashboard/products/${productId}/edit`}>
            Back to product
          </Link>
        </div>

        <ProductContentStudio
          aiEnabled={aiEnabled}
          billingHref={BILLING_UPGRADE_PATH}
          lastGeneratedAt={
            content.lastGeneratedAt
              ? content.lastGeneratedAt.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric"
                })
              : null
          }
          productId={content.productId}
          productTitle={content.productTitle}
          values={content.values}
        />
      </section>
    </DashboardShell>
  );
}
