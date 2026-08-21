"use server";

import { revalidatePath } from "next/cache";
import { normalizeBangladeshPhone } from "../courier/courier-phone";
import { clearMessagingSecret, saveMessagingSettings } from "../notifications/messaging-settings.service";
import { isNotificationError } from "../notifications/notifications-errors";
import { sendEmail, sendSms } from "../notifications/notifications.service";
import { requirePlatformAdmin } from "./admin.auth";

export type MessagingSettingsState = {
  message?: string;
  status: "idle" | "error" | "success";
};

export async function saveMessagingSettingsAction(
  _state: MessagingSettingsState,
  formData: FormData
): Promise<MessagingSettingsState> {
  await requirePlatformAdmin();

  try {
    await saveMessagingSettings({
      emailEnabled: checked(formData, "emailEnabled"),
      emailFrom: value(formData, "emailFrom"),
      smsApiKey: value(formData, "smsApiKey"),
      smsEnabled: checked(formData, "smsEnabled"),
      smsProvider: value(formData, "smsProvider"),
      smsSenderId: value(formData, "smsSenderId"),
      smtpHost: value(formData, "smtpHost"),
      smtpPassword: value(formData, "smtpPassword"),
      smtpPort: value(formData, "smtpPort"),
      smtpSecure: checked(formData, "smtpSecure"),
      smtpUser: value(formData, "smtpUser")
    });
  } catch (error) {
    return { message: readMessage(error, "Those settings could not be saved."), status: "error" };
  }

  revalidatePath("/admin/messaging");
  revalidatePath("/admin");

  return { message: "Messaging settings saved.", status: "success" };
}

/**
 * Takes a channel, not form state: the button that calls it lives inside the
 * settings form — see `SecretField` — so it is called outright rather than
 * submitted. There is no second field to remove a key, and nothing about it
 * belongs in the settings the surrounding form saves.
 */
export async function clearMessagingSecretAction(
  channel: "EMAIL" | "SMS"
): Promise<MessagingSettingsState> {
  await requirePlatformAdmin();

  try {
    await clearMessagingSecret(channel);
  } catch (error) {
    return { message: readMessage(error, "That key could not be removed."), status: "error" };
  }

  revalidatePath("/admin/messaging");

  return {
    message:
      channel === "SMS"
        ? "The stored SMS API key was removed. The environment value, if any, applies again."
        : "The stored SMTP password was removed. The environment value, if any, applies again.",
    status: "success"
  };
}

/**
 * Sends one real message to an address the admin names.
 *
 * Worth its own button: an SMS gateway can accept a key and still refuse every
 * message — Alpha SMS answers 421 for any number but the account's own until
 * the first recharge — and finding that out from a customer's failed sign-up is
 * the expensive way. `storeId` is null because the platform is testing its own
 * plumbing, not sending on any seller's behalf.
 */
export async function sendTestMessageAction(
  _state: MessagingSettingsState,
  formData: FormData
): Promise<MessagingSettingsState> {
  await requirePlatformAdmin();
  const channel = value(formData, "channel") === "SMS" ? "SMS" : "EMAIL";
  const recipient = value(formData, "recipient");

  if (!recipient) {
    return { message: "Enter where the test should go.", status: "error" };
  }

  try {
    if (channel === "SMS") {
      const phone = normalizeBangladeshPhone(recipient);

      if (!phone) {
        return { message: "Enter a valid Bangladesh mobile number.", status: "error" };
      }

      const outcome = await sendSms({
        message: "Dash test message. Your SMS gateway is working.",
        storeId: null,
        template: "otp_code",
        to: phone
      });

      return outcomeMessage(outcome.status, `a text message to ${phone}`);
    }

    const outcome = await sendEmail({
      storeId: null,
      subject: "Dash test message",
      template: "otp_code",
      text: "Your mail relay is working. Nothing else to do.",
      to: recipient
    });

    return outcomeMessage(outcome.status, `an email to ${recipient}`);
  } catch (error) {
    return { message: readMessage(error, "The test message could not be sent."), status: "error" };
  }
}

function outcomeMessage(status: string, target: string): MessagingSettingsState {
  if (status === "SENT") {
    return { message: `Sent ${target}. Check it arrived.`, status: "success" };
  }

  return {
    message: `Nothing is configured to send ${target}, so it went to the server log instead.`,
    status: "error"
  };
}

/**
 * Gateway and encryption failures already read as plain sentences an admin can
 * act on, so they are passed through. Anything else stays generic.
 */
function readMessage(error: unknown, fallback: string) {
  if (isNotificationError(error)) {
    return error.message;
  }

  if (error instanceof Error && error.name === "SecretBoxError") {
    return error.message;
  }

  console.error("Messaging settings action failed", error);

  return fallback;
}

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}
