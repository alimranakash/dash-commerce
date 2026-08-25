import { Megaphone } from "lucide-react";
import { TrackingIdForm } from "../../../../modules/marketing/components/tracking-id-form";
import { TrackingPageShell } from "../../../../modules/marketing/components/tracking-page-shell";
import { updateTrackingSectionAction } from "../../../../modules/marketing/marketing.actions";
import { getMarketingSettingsView } from "../../../../modules/marketing/marketing.service";
import { getStoreAccess } from "../../../../modules/stores/queries";

export default async function MetaPixelPage() {
  const access = await getStoreAccess();
  const settings = await getMarketingSettingsView(access.store.id);
  const action = updateTrackingSectionAction.bind(null, "meta-pixel");

  return (
    <TrackingPageShell
      description="Connect the Meta (Facebook and Instagram) pixel by ID, and verify your domain in Business Manager."
      storeSlug={access.store.slug}
      title="Meta Pixel"
    >
      <TrackingIdForm
        action={action}
        canManage={access.canManage}
        fields={[
          {
            docHref: "https://www.facebook.com/business/help/952192354843755",
            field: "metaPixelId",
            helper: "Events Manager → Data sources. Digits only.",
            label: "Pixel ID",
            value: settings.metaPixelId
          },
          {
            field: "metaDomainVerification",
            helper:
              "The content value only, from Business Manager → Brand safety → Domains.",
            label: "Domain Verification",
            value: settings.metaDomainVerification
          }
        ]}
        icon={<Megaphone className="h-5 w-5" />}
        subtitle="Pixel and domain verification"
        title="Meta"
      />
    </TrackingPageShell>
  );
}
