import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { FeatureGate } from "../../../../modules/billing/components/feature-gate";
import { OrderBumpForm } from "../../../../modules/merchandising/components/order-bump-form";
import {
  getOrderBumpProducts,
  getOrderBumpSettings
} from "../../../../modules/merchandising/order-bump.service";
import { requireStore } from "../../../../modules/stores/queries";

export default async function OrderBumpPage() {
  const store = await requireStore();
  const [settings, products] = await Promise.all([
    getOrderBumpSettings(store.id),
    getOrderBumpProducts(store.id)
  ]);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Marketing</p>
            <h1>Order bump</h1>
            <p className="auth-copy">
              One tick box above the Place Order button. It is the last thing a shopper reads before
              they commit, which is why it is worth more than the same offer anywhere else.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FeatureGate feature="order_bump" storeId={store.id} />
            <Link className="secondary link-button" href="/dashboard/marketing">
              Back
            </Link>
          </div>
        </div>
        <OrderBumpForm currency={store.currency} products={products} settings={settings} />
      </section>
    </DashboardShell>
  );
}
