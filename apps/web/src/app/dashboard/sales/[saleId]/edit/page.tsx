import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { getCustomerRecordsForStore } from "../../../../../modules/customers/customer.repository";
import { getProductsForStore } from "../../../../../modules/products/product.service";
import { SaleForm } from "../../../../../modules/sales/components/sale-form";
import { updateSaleFormAction } from "../../../../../modules/sales/sale.actions";
import { getSaleByIdForStore } from "../../../../../modules/sales/sale.service";
import { requireStore } from "../../../../../modules/stores/queries";

type EditSalePageProps = {
  params: Promise<{ saleId: string }>;
};

export default async function EditSalePage({ params }: EditSalePageProps) {
  const store = await requireStore();
  const { saleId } = await params;
  const [sale, products, customers] = await Promise.all([
    getSaleByIdForStore(store.organizationId, store.id, saleId),
    getProductsForStore(store.id),
    getCustomerRecordsForStore(store.id)
  ]);

  if (!sale) notFound();

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Sales</p>
            <h1>Edit {sale.saleNumber}</h1>
            <p className="auth-copy">Update sale items, payment, and status.</p>
          </div>
          <Link className="secondary link-button" href={`/dashboard/sales/${sale.id}`}>Back</Link>
        </div>
        <div className="panel-card">
          <SaleForm
            action={updateSaleFormAction.bind(null, sale.id)}
            cancelHref={`/dashboard/sales/${sale.id}`}
            currency={store.currency}
            customers={customers.map((customer) => ({
              email: customer.email,
              id: customer.id,
              name: customer.name,
              phone: customer.phone
            }))}
            products={products.map((product) => ({
              id: product.id,
              price: product.price.toString(),
              sku: product.sku,
              stockQuantity: product.stockQuantity,
              title: product.title
            }))}
            sale={{
              customerId: sale.customerId,
              discount: sale.discount.toString(),
              items: sale.items.map((item) => ({
                discount: item.discount.toString(),
                id: item.id,
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice.toString()
              })),
              notes: sale.notes,
              paidAmount: sale.paidAmount.toString(),
              paymentMethod: sale.paymentMethod,
              saleDate: toDateInputValue(sale.saleDate),
              saleType: sale.saleType,
              shipping: sale.shipping.toString(),
              status: sale.status,
              tax: sale.tax.toString()
            }}
          />
        </div>
      </section>
    </DashboardShell>
  );
}

function toDateInputValue(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${value.getFullYear()}-${month}-${day}`;
}
