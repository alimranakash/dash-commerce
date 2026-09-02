import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { ShippingSettingsForm } from "../../../modules/shipping/components/shipping-settings-form";
import { updateShippingSettingsFormAction } from "../../../modules/shipping/shipping.actions";
import { getShippingSettings } from "../../../modules/shipping/shipping.service";
import { FreeShippingConsole } from "../../../modules/free-shipping/components/free-shipping-console";
import { saveFreeShippingAction } from "../../../modules/free-shipping/free-shipping.actions";
import { getFreeShippingSettings } from "../../../modules/free-shipping/free-shipping.service";
import { getStoreAccess } from "../../../modules/stores/queries";

type ShippingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ShippingPage({ searchParams }: ShippingPageProps) {
  const access = await getStoreAccess();
  const store = access.store;
  const zones = await getShippingSettings(store.id);
  const freeShipping = await getFreeShippingSettings(store.id);
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

        {/* Below the rates, because it is a rule *about* them: a threshold only
          means something once a seller can see what they charge without it. */}
        <div className="resource-header">
          <div>
            <p className="eyebrow">Free shipping</p>
            <h2>Give free delivery over an order value</h2>
            <p className="auth-copy">
              One threshold, enforced at checkout and announced in the cart. The progress bar reads
              the same number this rule charges by, so it can never promise a discount the last
              screen does not give.
            </p>
          </div>
        </div>

        <FreeShippingConsole
          action={saveFreeShippingAction}
          canManage={access.canManage}
          currency={store.currency}
          settings={freeShipping}
          zones={zones.map((zone) => ({
            id: zone.id,
            name: zone.name,
            rates: zone.rates
              .filter((rate) => rate.isEnabled)
              .map((rate) => ({ amount: rate.amount.toString(), name: rate.name }))
          }))}
        />
      </section>
    </DashboardShell>
  );
}
