import Link from "next/link";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { CategoryForm } from "../../../modules/categories/components/category-form";
import { createCategoryFormAction } from "../../../modules/categories/category.actions";
import { getCategoriesForStore } from "../../../modules/categories/category.service";
import { requireStore } from "../../../modules/stores/queries";

type CategoriesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  const store = await requireStore();
  const categories = await getCategoriesForStore(store.id);
  const message = getCategoriesMessage(await searchParams);
  const categoryOptions = categories.map((category) => ({
    id: category.id,
    name: category.name
  }));

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Catalog</p>
            <h1>Categories</h1>
            <p className="auth-copy">Organize products into storefront navigation groups.</p>
          </div>
        </div>
        {message ? <p className="success-message">{message}</p> : null}
        <div className="split-layout">
          <div className="panel-card">
            <h2>Create category</h2>
            <CategoryForm
              action={createCategoryFormAction}
              parentOptions={categoryOptions}
              submitLabel="Create category"
            />
          </div>
          <div className="panel-card">
            <h2>All categories</h2>
            {categories.length === 0 ? (
              <div className="empty-state inline-empty">
                <h3>No categories yet</h3>
                <p>Create your first category to group products.</p>
              </div>
            ) : (
              <div className="category-list">
                {categories.map((category) => (
                  <div className="category-row" key={category.id}>
                    <div>
                      <strong>{category.name}</strong>
                      <span>{category.slug}</span>
                    </div>
                    <Link href={`/dashboard/categories/${category.id}/edit`}>Edit</Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}

function getCategoriesMessage(searchParams: Record<string, string | string[] | undefined>) {
  if (searchParams.created) return "Category created.";
  if (searchParams.updated) return "Category updated.";
  return null;
}
