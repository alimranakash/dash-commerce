"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "../../lib/auth";
import { requireStore } from "../stores/queries";
import {
  saveCourierAccount,
  setDefaultCourierAccount,
  testCourierConnection
} from "./courier-accounts.service";
import { courierErrorMessage, toCourierError } from "./courier-errors";
import { refreshShipmentSchema, sendShipmentSchema } from "./courier.schema";
import {
  refreshShipmentStatus,
  sendOrderToCourier,
  type SendOrderToCourierResult
} from "./courier.service";
import { requireCourierProvider } from "./providers/registry";

export type CourierActionState = {
  message?: string;
  status: "error" | "idle" | "success" | "warning";
};

export async function sendOrderToCourierAction(
  orderId: string,
  provider?: string
): Promise<CourierActionState> {
  const store = await requireStore();
  const user = await getCurrentUser();
  const parsed = sendShipmentSchema.safeParse({ orderId, ...(provider ? { provider } : {}) });

  if (!parsed.success) {
    return { message: "That order could not be identified.", status: "error" };
  }

  const result = await sendOrderToCourier({
    orderId: parsed.data.orderId,
    storeId: store.id,
    ...(parsed.data.provider ? { provider: parsed.data.provider } : {}),
    ...(user?.id ? { userId: user.id } : {})
  });

  revalidateCourierPaths(store.slug, parsed.data.orderId);

  return toActionState(result);
}

export async function refreshShipmentStatusAction(
  shipmentId: string,
  orderId?: string
): Promise<CourierActionState> {
  const store = await requireStore();
  const user = await getCurrentUser();
  const parsed = refreshShipmentSchema.safeParse({ shipmentId });

  if (!parsed.success) {
    return { message: "That shipment could not be identified.", status: "error" };
  }

  const result = await refreshShipmentStatus({
    shipmentId: parsed.data.shipmentId,
    storeId: store.id,
    ...(user?.id ? { userId: user.id } : {})
  });

  revalidateCourierPaths(store.slug, orderId);

  if (result.kind === "UPDATED") {
    return { message: result.message, status: "success" };
  }

  if (result.kind === "FAILED") {
    return { message: result.message, status: "error" };
  }

  return { message: result.message, status: "warning" };
}

export async function saveCourierAccountFormAction(
  _state: CourierActionState,
  formData: FormData
): Promise<CourierActionState> {
  const store = await requireStore();
  const providerKey = String(formData.get("provider") ?? "");

  try {
    const provider = requireCourierProvider(providerKey);
    const values = Object.fromEntries(
      provider.credentialFields.map((field) => [field.name, String(formData.get(field.name) ?? "")])
    );

    await saveCourierAccount(store.id, {
      isDefault: formData.get("isDefault") === "on",
      isEnabled: formData.get("isEnabled") === "on",
      provider: provider.key,
      values
    });
  } catch (error) {
    return { message: messageFor(error), status: "error" };
  }

  revalidateCourierPaths(store.slug);

  return { message: "Courier credentials saved.", status: "success" };
}

export async function setDefaultCourierAccountAction(
  providerKey: string
): Promise<CourierActionState> {
  const store = await requireStore();

  try {
    await setDefaultCourierAccount(store.id, providerKey);
  } catch (error) {
    return { message: messageFor(error), status: "error" };
  }

  revalidateCourierPaths(store.slug);

  return { message: "Default courier updated.", status: "success" };
}

export async function testCourierConnectionAction(
  providerKey: string
): Promise<CourierActionState> {
  const store = await requireStore();

  try {
    const result = await testCourierConnection(store.id, providerKey);

    revalidateCourierPaths(store.slug);

    return { message: result.message, status: result.ok ? "success" : "error" };
  } catch (error) {
    revalidateCourierPaths(store.slug);

    return { message: messageFor(error), status: "error" };
  }
}

function toActionState(result: SendOrderToCourierResult): CourierActionState {
  switch (result.kind) {
    case "SENT":
      return {
        message: result.trackingCode
          ? `Booked. Tracking code ${result.trackingCode}.`
          : "Booked with the courier.",
        status: "success"
      };
    case "SKIPPED":
      return { message: result.message, status: "warning" };
    case "UNRESOLVED":
      return { message: result.message, status: "warning" };
    default:
      return { message: result.message, status: "error" };
  }
}

function messageFor(error: unknown) {
  return courierErrorMessage(toCourierError(error));
}

function revalidateCourierPaths(storeSlug: string, orderId?: string) {
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/settings/courier");
  revalidatePath(`/dashboard/settings/${storeSlug}`);

  if (orderId) {
    revalidatePath(`/dashboard/orders/${orderId}`);
  }
}
