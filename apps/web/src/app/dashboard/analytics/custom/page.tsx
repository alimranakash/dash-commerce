import { TrackingPageShell } from "../../../../modules/marketing/components/tracking-page-shell";
import { CustomTrackingForm } from "../../../../modules/marketing/components/custom-tracking-form";
import { updateTrackingSectionAction } from "../../../../modules/marketing/marketing.actions";
import { getMarketingSettingsView } from "../../../../modules/marketing/marketing.service";
import { getStoreAccess } from "../../../../modules/stores/queries";

export default async function CustomTrackingPage() {
  const access = await getStoreAccess();
  const settings = await getMarketingSettingsView(access.store.id);
  const action = updateTrackingSectionAction.bind(null, "custom");

  return (
    <TrackingPageShell
      description="For a tag we do not have a page for yet. Accepts raw tracking markup, checked against an allowlist before it is saved."
      section="custom"
      storeId={access.store.id}
      storeSlug={access.store.slug}
      title="Custom Tracking"
    >
      <CustomTrackingForm
        action={action}
        canManage={access.canManage}
        settings={settings}
      />
    </TrackingPageShell>
  );
}
