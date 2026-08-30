import { BarChart3 } from "lucide-react";
import { TrackingIdForm } from "../../../../modules/marketing/components/tracking-id-form";
import { TrackingPageShell } from "../../../../modules/marketing/components/tracking-page-shell";
import { updateTrackingSectionAction } from "../../../../modules/marketing/marketing.actions";
import { getMarketingSettingsView } from "../../../../modules/marketing/marketing.service";
import { getStoreAccess } from "../../../../modules/stores/queries";

export default async function GoogleAdsPage() {
  const access = await getStoreAccess();
  const settings = await getMarketingSettingsView(access.store.id);
  const action = updateTrackingSectionAction.bind(null, "google-ads");

  return (
    <TrackingPageShell
      description="Report conversions back to Google Ads so your campaigns can optimise against real orders."
      section="google-ads"
      storeId={access.store.id}
      storeSlug={access.store.slug}
      title="Google Ads"
    >
      <TrackingIdForm
        action={action}
        canManage={access.canManage}
        fields={[
          {
            docHref: "https://support.google.com/google-ads/answer/6331304",
            field: "googleAdsConversionId",
            helper: "Google Ads → Goals → Conversions. Starts with AW-.",
            label: "Conversion ID",
            value: settings.googleAdsConversionId
          }
        ]}
        icon={<BarChart3 className="h-5 w-5" />}
        subtitle="Conversion tracking for Google Ads"
        title="Google Ads"
      />
    </TrackingPageShell>
  );
}
