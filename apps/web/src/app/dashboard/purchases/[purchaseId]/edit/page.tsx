import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { getProductsForStore } from "../../../../../modules/products/product.service";
import { PurchaseForm } from "../../../../../modules/purchases/components/purchase-form";
import { updatePurchaseFormAction } from "../../../../../modules/purchases/purchase.actions";
import { getPurchaseByIdForStore } from "../../../../../modules/purchases/purchase.service";
import { getSuppliersForOrganization } from "../../../../../modules/suppliers/supplier.service";
import { requireStore } from "../../../../../modules/stores/queries";

type EditPurchasePageProps = {
  params: Promise<{
    purchaseId: string;
  }>;
};

export default async function EditPurchasePage({ params }: EditPurchasePageProps) {
  const store = await requireStore();
  const { purchaseId } = await params;
  const [purchase, suppliers, products] = await Promise.all([
    getPurchaseByIdForStore(store.organizationId, store.id, purchaseId),
    getSuppliersForOrganization(store.organizationId),
    getProductsForStore(store.id)
  ]);

  if (!purchase) {
    notFound();
  }

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Purchases</p>
            <h1>Edit {purchase.purchaseNumber}</h1>
            <p className="auth-copy">Update supplier, items, totals, and purchase status.</p>
          </div>
          <Link className="secondary link-button" href={`/dashboard/purchases/${purchase.id}`}>
            Back
          </Link>
        </div>
        <div className="panel-card">
          <PurchaseForm
            action={updatePurchaseFormAction.bind(null, purchase.id)}
            cancelHref={`/dashboard/purchases/${purchase.id}`}
            currency={store.currency}
            products={products.map((product) => ({
              costPrice: product.costPrice?.toString() ?? null,
              id: product.id,
              sku: product.sku,
              title: product.title
            }))}
            purchase={{
              discountAmount: purchase.discountAmount.toString(),
              items: purchase.items.map((item) => ({
                id: item.id,
                productId: item.productId ?? "",
                productName: item.productName,
                quantity: item.quantity,
                sku: item.sku ?? "",
                unitCost: item.unitCost.toString()
              })),
              notes: purchase.notes,
              paidAmount: purchase.paidAmount.toString(),
              purchaseDate: purchase.purchaseDate.toISOString().slice(0, 10),
              status: purchase.status,
              supplierId: purchase.supplierId,
              taxAmount: purchase.taxAmount.toString()
            }}
            suppliers={suppliers.filter((supplier) => supplier.status === "ACTIVE" || supplier.id === purchase.supplierId).map((supplier) => ({
              id: supplier.id,
              label: supplier.companyName ? `${supplier.name} - ${supplier.companyName}` : supplier.name
            }))}
          />
        </div>
      </section>
    </DashboardShell>
  );
}
