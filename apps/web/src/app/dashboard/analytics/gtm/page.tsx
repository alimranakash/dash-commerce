import { Boxes } from "lucide-react";
import { TrackingIdForm } from "../../../../modules/marketing/components/tracking-id-form";
import { TrackingPageShell } from "../../../../modules/marketing/components/tracking-page-shell";
import { updateTrackingSectionAction } from "../../../../modules/marketing/marketing.actions";
import { getMarketingSettingsView } from "../../../../modules/marketing/marketing.service";
import { getStoreAccess } from "../../../../modules/stores/queries";

export default async function GtmPage() {
  const access = await getStoreAccess();
  const settings = await getMarketingSettingsView(access.store.id);
  const action = updateTrackingSectionAction.bind(null, "gtm");

  return (
    <TrackingPageShell
      description="Load Google Tag Manager on your storefront and manage your other tags from inside GTM."
      storeSlug={access.store.slug}
      title="Google Tag Manager"
    >
      <TrackingIdForm
        action={action}
        canManage={access.canManage}
        fields={[
          {
            docHref: "https://support.google.com/tagmanager/answer/6103696",
            field: "gtmContainerId",
            helper: "Found at the top of your Tag Manager workspace.",
            label: "GTM Container ID",
            value: settings.gtmContainerId
          }
        ]}
        icon={<Boxes className="h-5 w-5" />}
        subtitle="Container snippet"
        title="Google Tag Manager"
      />
    </TrackingPageShell>
  );
}
