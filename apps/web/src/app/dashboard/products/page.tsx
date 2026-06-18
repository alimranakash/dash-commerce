import Link from "next/link";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { archiveProductFormAction } from "../../../modules/products/product.actions";
import { getProductsForStore } from "../../../modules/products/product.service";
import { requireStore } from "../../../modules/stores/queries";

type ProductsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const store = await requireStore();
  const products = await getProductsForStore(store.id);
  const message = getProductsMessage(await searchParams);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Catalog</p>
            <h1>Products</h1>
            <p className="auth-copy">Create, edit, and archive products for {store.name}.</p>
          </div>
          <Link className="primary link-button" href="/dashboard/products/new">
            Add product
          </Link>
        </div>
        {message ? <p className="success-message">{message}</p> : null}
        {products.length === 0 ? (
          <div className="empty-state">
            <h2>Add your first product</h2>
            <p>Start building the storefront catalog with a draft product.</p>
            <Link className="primary link-button" href="/dashboard/products/new">
              Add product
            </Link>
          </div>
        ) : (
          <div className="table-card">
            <table className="resource-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Category</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td data-label="Title">
                      <strong>{product.title}</strong>
                      <span>{product.slug}</span>
                    </td>
                    <td data-label="Status">
                      <span className="status-pill">{product.status.toLowerCase()}</span>
                    </td>
                    <td data-label="Price">{formatMoney(product.price, store.currency)}</td>
                    <td data-label="Stock">{product.stockQuantity}</td>
                    <td data-label="Category">{product.category?.name ?? "None"}</td>
                    <td data-label="Updated">{formatDate(product.updatedAt)}</td>
                    <td data-label="Actions">
                      <div className="table-actions">
                        <Link href={`/dashboard/products/${product.id}/edit`}>Edit</Link>
                        {product.status !== "ARCHIVED" ? (
                          <form action={archiveProductFormAction.bind(null, product.id)}>
                            <button type="submit">Archive</button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}

function getProductsMessage(searchParams: Record<string, string | string[] | undefined>) {
  if (searchParams.created) return "Product created.";
  if (searchParams.updated) return "Product updated.";
  if (searchParams.archived) return "Product archived.";
  return null;
}

function formatMoney(value: unknown, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency
  }).format(Number(value));
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium"
  }).format(value);
}
