import { Music2 } from "lucide-react";
import { TrackingIdForm } from "../../../../modules/marketing/components/tracking-id-form";
import { TrackingPageShell } from "../../../../modules/marketing/components/tracking-page-shell";
import { updateTrackingSectionAction } from "../../../../modules/marketing/marketing.actions";
import { getMarketingSettingsView } from "../../../../modules/marketing/marketing.service";
import { getStoreAccess } from "../../../../modules/stores/queries";

export default async function TikTokPixelPage() {
  const access = await getStoreAccess();
  const settings = await getMarketingSettingsView(access.store.id);
  const action = updateTrackingSectionAction.bind(null, "tiktok-pixel");

  return (
    <TrackingPageShell
      description="Connect the TikTok Ads pixel by ID so TikTok can attribute the orders your campaigns bring in."
      section="tiktok-pixel"
      storeId={access.store.id}
      storeSlug={access.store.slug}
      title="TikTok Pixel"
    >
      <TrackingIdForm
        action={action}
        canManage={access.canManage}
        fields={[
          {
            docHref: "https://ads.tiktok.com/help/article/get-started-pixel",
            field: "tiktokPixelId",
            helper: "TikTok Ads Manager → Assets → Events. 20 characters.",
            label: "Pixel ID",
            value: settings.tiktokPixelId
          }
        ]}
        icon={<Music2 className="h-5 w-5" />}
        subtitle="TikTok Ads pixel"
        title="TikTok"
      />
    </TrackingPageShell>
  );
}
