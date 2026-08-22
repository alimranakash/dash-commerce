"use server";

import { revalidatePath } from "next/cache";
import { normalizeBangladeshPhone } from "../courier/courier-phone";
import { requireStore } from "../stores/queries";
import { isNotificationError } from "./notifications-errors";
import { sendSms } from "./notifications.service";
import { saveStoreMessagingSettings } from "./store-messaging.service";
import { CUSTOM_ORDER_SMS_MAX_LENGTH } from "./templates";

export type StoreMessagingState = {
  message?: string;
  status: "idle" | "error" | "success";
};

export async function saveStoreMessagingAction(
  _state: StoreMessagingState,
  formData: FormData
): Promise<StoreMessagingState> {
  const store = await requireStore();
  const orderCustomEnabled = checked(formData, "orderCustomEnabled");
  const orderCustomMessage = value(formData, "orderCustomMessage");

  // Only a blocking error while the switch is on. A seller clearing the box to
  // turn the message off should not be stopped and told to write one.
  if (orderCustomEnabled && !orderCustomMessage) {
    return {
      message: "Write the message you want sent, or switch that option off.",
      status: "error"
    };
  }

  if (orderCustomMessage.length > CUSTOM_ORDER_SMS_MAX_LENGTH) {
    return {
      message: `Your message is ${orderCustomMessage.length} characters. Keep it to ${CUSTOM_ORDER_SMS_MAX_LENGTH} or fewer.`,
      status: "error"
    };
  }

  try {
    await saveStoreMessagingSettings(store.id, {
      checkoutOtpEnabled: checked(formData, "checkoutOtpEnabled"),
      orderConfirmEnabled: checked(formData, "orderConfirmEnabled"),
      orderCustomEnabled,
      orderCustomMessage: orderCustomMessage || null,
      smsEnabled: checked(formData, "smsEnabled")
    });
  } catch (error) {
    return { message: readMessage(error, "Those settings could not be saved."), status: "error" };
  }

  revalidatePath("/dashboard/settings/sms");
  // The storefront reads both switches while rendering checkout, so a stale
  // page would keep asking for codes after the seller turned them off.
  // The internal route on purpose: /s/<slug> is what Next serves, and a
  // storefront hostname is a rewrite onto it. Revalidating the clean
  // address would quietly revalidate nothing.
  revalidatePath(`/s/${store.slug}/checkout`);

  return { message: "Your SMS settings are saved.", status: "success" };
}

/**
 * One real message to a number the seller names.
 *
 * A gateway can accept a key and still refuse every message — a new Alpha SMS
 * account is locked to its own registered number until the first recharge — and
 * finding that out from a customer's failed order is the expensive way.
 */
export async function sendStoreTestSmsAction(
  _state: StoreMessagingState,
  formData: FormData
): Promise<StoreMessagingState> {
  const store = await requireStore();
  const phone = normalizeBangladeshPhone(value(formData, "recipient"));

  if (!phone) {
    return { message: "Enter a valid Bangladesh mobile number.", status: "error" };
  }

  try {
    const outcome = await sendSms({
      message: `Test message from ${store.name}. Your SMS setup is working.`,
      storeId: store.id,
      template: "order_confirmation",
      to: phone
    });

    if (outcome.status === "SENT") {
      return { message: `Sent to ${phone}. Check it arrived.`, status: "success" };
    }

    if (outcome.status === "BLOCKED") {
      return {
        message: "Your plan's monthly SMS allowance is used up, so nothing was sent.",
        status: "error"
      };
    }

    return {
      message: "Turn SMS on first, or ask support — the platform gateway is not set up yet.",
      status: "error"
    };
  } catch (error) {
    return { message: readMessage(error, "The test message could not be sent."), status: "error" };
  }
}

/**
 * Gateway and encryption failures already read as plain sentences a seller can
 * act on, so they are passed through. Anything else stays generic.
 */
function readMessage(error: unknown, fallback: string) {
  if (isNotificationError(error)) {
    return error.message;
  }

  if (error instanceof Error && error.name === "SecretBoxError") {
    return error.message;
  }

  console.error("Store messaging action failed", error);

  return fallback;
}

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}
