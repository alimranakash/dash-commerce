import { Edit3, Trash2 } from "lucide-react";
import { DeleteConfirmationButton } from "../../../components/dashboard/delete-confirmation-button";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { createProductTaxonomyFormAction, deleteProductTaxonomyFormAction } from "../product-taxonomy.actions";
import type { ProductTaxonomyItem, ProductTaxonomyType } from "../product-taxonomy.service";

type ProductTaxonomyManagementProps = {
  items: ProductTaxonomyItem[];
  message?: string | null;
  pluralLabel: string;
  singularLabel: string;
  storeSlug: string;
  type: ProductTaxonomyType;
};

export function ProductTaxonomyManagement({
  items,
  message,
  pluralLabel,
  singularLabel,
  storeSlug,
  type
}: ProductTaxonomyManagementProps) {
  return (
    <DashboardShell storeSlug={storeSlug}>
      <section className="resource-page catalog-management-page">
        <div className="catalog-page-heading">
          <h1>{pluralLabel}</h1>
        </div>
        {message ? <p className="success-message">{message}</p> : null}
        <div className="catalog-management-grid">
          <section className="catalog-card catalog-list-card">
            <header><h2>{pluralLabel} List</h2></header>
            <div className="catalog-table-wrap">
              <table className="catalog-management-table">
                <thead><tr><th><input aria-label={`Select all ${pluralLabel.toLowerCase()}`} type="checkbox" /></th><th>Name</th><th>Slug</th><th>Action</th></tr></thead>
                <tbody>
                  {items.length ? items.map((item) => (
                    <tr key={item.id}>
                      <td><input aria-label={`Select ${item.name}`} type="checkbox" /></td>
                      <td>{item.name}</td>
                      <td>{item.slug}</td>
                      <td>
                        <div className="catalog-row-actions">
                          <button aria-label={`Edit ${item.name}`} disabled title={`Edit ${singularLabel.toLowerCase()}`} type="button"><Edit3 /></button>
                          <DeleteConfirmationButton
                            action={deleteProductTaxonomyFormAction.bind(null, type, item.id)}
                            ariaLabel={`Delete ${item.name}`}
                            title={`Delete ${singularLabel.toLowerCase()}`}
                          >
                            <Trash2 />
                          </DeleteConfirmationButton>
                        </div>
                      </td>
                    </tr>
                  )) : <tr><td className="catalog-empty-row" colSpan={4}>No {pluralLabel.toLowerCase()} yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <section className="catalog-card catalog-form-card">
            <header><h2>Add New {singularLabel}</h2></header>
            <div className="catalog-form-body">
              <form action={createProductTaxonomyFormAction.bind(null, type)} className="resource-form compact-form catalog-create-form">
                <label>
                  Name
                  <input name="name" placeholder="Enter name" required type="text" />
                </label>
                <div className="form-actions">
                  <button className="catalog-submit-button" type="submit">Create {singularLabel}</button>
                </div>
              </form>
            </div>
          </section>
        </div>
      </section>
    </DashboardShell>
  );
}
