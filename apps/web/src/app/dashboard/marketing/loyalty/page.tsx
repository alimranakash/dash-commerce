import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { FeatureGate } from "../../../../modules/billing/components/feature-gate";
import { LoyaltySettingsForm } from "../../../../modules/loyalty/components/loyalty-settings-form";
import {
  getLoyaltyCapability,
  getLoyaltySettings
} from "../../../../modules/loyalty/loyalty.service";
import { getStoreAccess } from "../../../../modules/stores/queries";

/**
 * Dashboard → Loyalty → Settings.
 *
 * `getStoreAccess()` rather than `requireStore()`, as on Sales Notifications:
 * a member may read how the programme is set up, while saving is a manager's
 * and `saveLoyaltySettingsAction` refuses anyone else.
 */
export default async function LoyaltyPage() {
  const access = await getStoreAccess();
  const settings = await getLoyaltySettings(access.store.id);
  const capability = await getLoyaltyCapability(access.store.id, settings);

  return (
    <DashboardShell storeSlug={access.store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Loyalty</p>
            <h1>Settings</h1>
            <p className="auth-copy">
              A free membership for your customers: every completed order earns points, so the
              people who already buy from you have a reason to come back.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FeatureGate feature="loyalty" storeId={access.store.id} />
            <Link className="secondary link-button" href="/dashboard/marketing/loyalty/members">
              Members
            </Link>
          </div>
        </div>
        <LoyaltySettingsForm
          canManage={access.canManage}
          capability={capability}
          currency={access.store.currency}
          settings={settings}
        />
      </section>
    </DashboardShell>
  );
}
