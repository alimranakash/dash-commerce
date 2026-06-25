import { Edit3, Trash2 } from "lucide-react";
import Link from "next/link";
import { DeleteConfirmationButton } from "../../../components/dashboard/delete-confirmation-button";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { createExpenseCategoryFormAction, deleteExpenseCategoryAction } from "../expense.actions";
import { ExpenseCategoryForm } from "./expense-category-form";

type ExpenseCategoryItem = {
  color: string;
  icon: string;
  id: string;
  name: string;
};

type ExpenseCategoryManagementProps = {
  categories: ExpenseCategoryItem[];
  message?: string | null;
  storeSlug: string;
};

export function ExpenseCategoryManagement({ categories, message, storeSlug }: ExpenseCategoryManagementProps) {
  return (
    <DashboardShell storeSlug={storeSlug}>
      <section className="resource-page catalog-management-page">
        <div className="catalog-page-heading">
          <h1>Expense Categories</h1>
        </div>
        {message ? <p className="success-message">{message}</p> : null}
        <div className="catalog-management-grid">
          <section className="catalog-card catalog-list-card">
            <header><h2>Categories List</h2></header>
            <div className="catalog-table-wrap">
              <table className="catalog-management-table">
                <thead>
                  <tr>
                    <th aria-label="Select"><input aria-label="Select all expense categories" type="checkbox" /></th>
                    <th>Name</th>
                    <th>Color</th>
                    <th>Icon</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td><input aria-label={`Select ${category.name}`} type="checkbox" /></td>
                      <td>{category.name}</td>
                      <td><span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />{category.color}</span></td>
                      <td>{category.icon}</td>
                      <td>
                        <div className="catalog-row-actions">
                          <Link aria-label={`Edit ${category.name}`} href={`/dashboard/expenses/categories/${category.id}/edit`} title="Edit category"><Edit3 aria-hidden="true" /></Link>
                          <DeleteConfirmationButton action={deleteExpenseCategoryAction.bind(null, category.id)} ariaLabel={`Delete ${category.name}`} title="Delete category"><Trash2 aria-hidden="true" /></DeleteConfirmationButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="catalog-card catalog-form-card">
            <header><h2>Add New Category</h2></header>
            <div className="catalog-form-body">
              <ExpenseCategoryForm action={createExpenseCategoryFormAction} submitLabel="Create Category" />
            </div>
          </section>
        </div>
      </section>
    </DashboardShell>
  );
}
