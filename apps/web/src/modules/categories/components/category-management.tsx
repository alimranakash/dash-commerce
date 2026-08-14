import { Edit3, ImageIcon, Trash2 } from "lucide-react";
import Link from "next/link";
import { DeleteConfirmationButton } from "../../../components/dashboard/delete-confirmation-button";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { createCategoryFormAction, deleteCategoryFormAction } from "../category.actions";
import { CategoryForm } from "./category-form";

type CategoryItem = {
  id: string;
  imageUrl: string | null;
  name: string;
  parent: { name: string } | null;
  slug: string;
};

type CategoryManagementProps = {
  categories: CategoryItem[];
  message?: string | null;
  storeSlug: string;
};

export function CategoryManagement({ categories, message, storeSlug }: CategoryManagementProps) {
  const parentOptions = categories.map(({ id, name }) => ({ id, name }));

  return (
    <DashboardShell storeSlug={storeSlug}>
      <section className="resource-page catalog-management-page">
        <div className="catalog-page-heading">
          <h1>Categories</h1>
        </div>
        {message ? <p className="success-message">{message}</p> : null}
        <div className="catalog-management-grid">
          <section className="catalog-card catalog-list-card">
            <header><h2>Categories List</h2></header>
            <div className="catalog-table-wrap">
              <table className="catalog-management-table">
                <thead>
                  <tr>
                    <th aria-label="Select"><input aria-label="Select all categories" type="checkbox" /></th>
                    <th>Name</th>
                    <th>Slug</th>
                    <th>Parent</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.length ? categories.map((category) => (
                    <tr key={category.id}>
                      <td><input aria-label={`Select ${category.name}`} type="checkbox" /></td>
                      <td>
                        <div className="catalog-name-with-image">
                          <span className="catalog-category-thumb">
                            {category.imageUrl ? (
                              <img alt="" src={category.imageUrl} />
                            ) : (
                              <ImageIcon aria-hidden="true" />
                            )}
                          </span>
                          <span>{category.name}</span>
                        </div>
                      </td>
                      <td>{category.slug}</td>
                      <td>{category.parent?.name ?? "None"}</td>
                      <td>
                        <div className="catalog-row-actions">
                          <Link aria-label={`Edit ${category.name}`} href={`/dashboard/categories/${category.id}/edit`} title="Edit category">
                            <Edit3 aria-hidden="true" />
                          </Link>
                          <DeleteConfirmationButton action={deleteCategoryFormAction.bind(null, category.id)} ariaLabel={`Delete ${category.name}`} title="Delete category">
                            <Trash2 aria-hidden="true" />
                          </DeleteConfirmationButton>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td className="catalog-empty-row" colSpan={5}>No categories yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="catalog-card catalog-form-card">
            <header><h2>Add New Category</h2></header>
            <div className="catalog-form-body">
              <CategoryForm
                action={createCategoryFormAction}
                parentOptions={parentOptions}
                submitLabel="Create Category"
              />
            </div>
          </section>
        </div>
      </section>
    </DashboardShell>
  );
}
