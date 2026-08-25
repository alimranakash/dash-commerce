import { TrackingPageShell } from "../../../../modules/marketing/components/tracking-page-shell";
import { ServerSideTrackingForm } from "../../../../modules/marketing/components/server-side-tracking-form";
import { hasPlanFeature } from "../../../../modules/billing/subscription-limits";
import {
  sendGa4TestEventAction,
  sendMetaTestEventAction,
  updateTrackingSectionAction
} from "../../../../modules/marketing/marketing.actions";
import { getMarketingSettingsView } from "../../../../modules/marketing/marketing.service";
import { getStoreAccess } from "../../../../modules/stores/queries";

export default async function ServerSideTrackingPage() {
  const access = await getStoreAccess();
  const [settings, locked] = await Promise.all([
    getMarketingSettingsView(access.store.id),
    hasPlanFeature(access.store.id, "server_side_tracking").then((entitled) => !entitled)
  ]);
  const action = updateTrackingSectionAction.bind(null, "server-side");

  return (
    <TrackingPageShell
      description="Send purchases to Google and Meta from our server as well as the browser, so ad blockers and privacy settings stop costing you conversions in your reports."
      storeSlug={access.store.slug}
      title="Server-Side Tracking"
    >
      <ServerSideTrackingForm
        action={action}
        canManage={access.canManage}
        locked={locked}
        onSendGa4TestEvent={sendGa4TestEventAction}
        onSendMetaTestEvent={sendMetaTestEventAction}
        settings={settings}
      />
    </TrackingPageShell>
  );
}
