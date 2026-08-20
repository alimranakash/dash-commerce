import { AdminPageHeader } from "../../../components/admin/admin-ui";
import {
  clearMessagingSecretAction,
  saveMessagingSettingsAction,
  sendTestMessageAction
} from "../../../modules/admin/admin-messaging.actions";
import { AdminMessagingSettings } from "../../../modules/admin/components/admin-messaging-settings";
import { getMessagingSettingsView } from "../../../modules/notifications/messaging-settings.service";

export default async function AdminMessagingPage() {
  const settings = await getMessagingSettingsView();

  return (
    <section className="mx-auto grid max-w-[1080px] gap-5">
      <AdminPageHeader
        description="The platform's own SMS gateway and mail relay. Verification codes for sign-up, password resets and cash-on-delivery checkout all go out through these."
        title="Messaging"
      />
      <AdminMessagingSettings
        clearAction={clearMessagingSecretAction}
        saveAction={saveMessagingSettingsAction}
        settings={settings}
        testAction={sendTestMessageAction}
      />
    </section>
  );
}
