import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { ShippingSettingsForm } from "../../../modules/shipping/components/shipping-settings-form";
import { updateShippingSettingsFormAction } from "../../../modules/shipping/shipping.actions";
import { getShippingSettings } from "../../../modules/shipping/shipping.service";
import { requireStore } from "../../../modules/stores/queries";

type ShippingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ShippingPage({ searchParams }: ShippingPageProps) {
  const store = await requireStore();
  const zones = await getShippingSettings(store.id);
  const message = (await searchParams).updated ? "Shipping settings updated." : null;

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Shipping</p>
            <h1>Delivery zones and rates</h1>
            <p className="auth-copy">
              Configure manual Bangladesh delivery methods with trusted server-side flat rates.
            </p>
          </div>
        </div>
        {message ? <p className="success-message">{message}</p> : null}
        <div className="dashboard-shell">
          <ShippingSettingsForm
            action={updateShippingSettingsFormAction}
            zones={zones.map((zone) => ({
              id: zone.id,
              name: zone.name,
              description: zone.description,
              isEnabled: zone.isEnabled,
              sortOrder: zone.sortOrder,
              rates: zone.rates.map((rate) => ({
                id: rate.id,
                zoneId: rate.zoneId,
                name: rate.name,
                district: rate.district,
                city: rate.city,
                area: rate.area,
                amount: rate.amount.toString(),
                isEnabled: rate.isEnabled,
                sortOrder: rate.sortOrder
              }))
            }))}
          />
        </div>
      </section>
    </DashboardShell>
  );
}
