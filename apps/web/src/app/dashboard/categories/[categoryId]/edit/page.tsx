import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { updateCategoryFormAction } from "../../../../../modules/categories/category.actions";
import { CategoryForm } from "../../../../../modules/categories/components/category-form";
import {
  getCategoriesForStore,
  getCategoryByIdForStore
} from "../../../../../modules/categories/category.service";
import { requireStore } from "../../../../../modules/stores/queries";

type EditCategoryPageProps = {
  params: Promise<{
    categoryId: string;
  }>;
};

export default async function EditCategoryPage({ params }: EditCategoryPageProps) {
  const store = await requireStore();
  const { categoryId } = await params;
  const [category, categories] = await Promise.all([
    getCategoryByIdForStore(store.id, categoryId),
    getCategoriesForStore(store.id)
  ]);

  if (!category) {
    notFound();
  }

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Catalog</p>
            <h1>Edit category</h1>
            <p className="auth-copy">Update category metadata and parent grouping.</p>
          </div>
          <Link className="secondary link-button" href="/dashboard/categories">
            Back
          </Link>
        </div>
        <div className="panel-card">
          <CategoryForm
            action={updateCategoryFormAction.bind(null, category.id)}
            category={{
              id: category.id,
              name: category.name,
              slug: category.slug,
              description: category.description ?? undefined,
              imageUrl: category.imageUrl,
              parentId: category.parentId ?? undefined
            }}
            parentOptions={categories.map((entry) => ({
              id: entry.id,
              name: entry.name
            }))}
            submitLabel="Save category"
          />
        </div>
      </section>
    </DashboardShell>
  );
}
