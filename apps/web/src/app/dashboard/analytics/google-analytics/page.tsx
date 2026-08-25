import { Globe2 } from "lucide-react";
import { TrackingIdForm } from "../../../../modules/marketing/components/tracking-id-form";
import { TrackingPageShell } from "../../../../modules/marketing/components/tracking-page-shell";
import { updateTrackingSectionAction } from "../../../../modules/marketing/marketing.actions";
import { getMarketingSettingsView } from "../../../../modules/marketing/marketing.service";
import { getStoreAccess } from "../../../../modules/stores/queries";

export default async function GoogleAnalyticsPage() {
  const access = await getStoreAccess();
  const settings = await getMarketingSettingsView(access.store.id);
  const action = updateTrackingSectionAction.bind(null, "google-analytics");

  return (
    <TrackingPageShell
      description="Connect Google Analytics 4 by measurement ID. We generate the official gtag snippet, so you never paste a script tag."
      storeSlug={access.store.slug}
      title="Google Analytics"
    >
      <TrackingIdForm
        action={action}
        canManage={access.canManage}
        fields={[
          {
            docHref: "https://support.google.com/analytics/answer/9539598",
            field: "ga4MeasurementId",
            helper: "Found in Google Analytics under Admin → Data streams.",
            label: "GA4 Measurement ID",
            value: settings.ga4MeasurementId
          },
          {
            docHref: "https://search.google.com/search-console",
            field: "googleSiteVerification",
            helper: "The content value only — paste the whole meta tag and we will pull it out.",
            label: "Google Site Verification",
            value: settings.googleSiteVerification
          }
        ]}
        icon={<Globe2 className="h-5 w-5" />}
        subtitle="GA4 and Search Console verification"
        title="Google Analytics"
      />
    </TrackingPageShell>
  );
}
