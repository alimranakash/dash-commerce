"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "../../lib/auth";
import { assessOrdersForCustomerSafely } from "../fake-orders/fake-order.assessment";
import { StoreAccessError, requireStore, requireStoreManager } from "../stores/queries";
import {
  saveCourierAccount,
  setDefaultCourierAccount,
  testCourierConnection
} from "./courier-accounts.service";
import { courierErrorMessage, toCourierError } from "./courier-errors";
import { disableCourierWebhook, generateCourierWebhook } from "./courier-webhook.service";
import {
  checkCourierCustomerScore,
  getCourierBalance,
  type CourierScoreView
} from "./courier-insight.service";
import {
  bulkSendShipmentsSchema,
  customerScoreSchema,
  refreshShipmentSchema,
  sendShipmentSchema
} from "./courier.schema";
import {
  refreshActiveShipments,
  refreshShipmentStatus,
  sendOrderToCourier,
  sendOrdersToCourier,
  trackShipmentByReference,
  type BulkSendResult,
  type SendOrderToCourierResult,
  type TrackedShipmentView
} from "./courier.service";
import { requireCourierProvider } from "./providers/registry";
import { hasPlanFeature } from "../billing/subscription-limits";
import { PLAN_FEATURE_REGISTRY, type PlanFeatureKey } from "../billing/plan-features";

export type CourierActionState = {
  /** Set when the plan refused the action, so the UI can open an upgrade dialog. */
  lockedFeature?: PlanFeatureKey;
  message?: string;
  status: "error" | "idle" | "success" | "warning";
};

/**
 * Courier automation is a paid feature. The pages stay readable on every plan —
 * a seller can open Settings → Courier and see how it works — but every action
 * that talks to a courier or writes credentials is gated here.
 *
 * Returns the module's own error state rather than throwing, because these
 * actions are consumed by `useActionState` and an uncaught throw would surface
 * as an error boundary instead of an upgrade prompt.
 */
async function courierPlanGate(
  storeId: string,
  feature: PlanFeatureKey = "courier_api"
): Promise<CourierActionState | null> {
  if (await hasPlanFeature(storeId, feature)) {
    return null;
  }

  return {
    lockedFeature: feature,
    message: `${PLAN_FEATURE_REGISTRY[feature].label} is a paid feature. Upgrade your plan from Billing to use it.`,
    status: "error"
  };
}

/**
 * Manager check for the three credential actions, shaped like `courierPlanGate`:
 * a refusal comes back as this module's error state rather than throwing,
 * because these actions feed `useActionState` too.
 *
 * Booking parcels and refreshing their status deliberately stay on
 * `requireStore()` — that is the daily job of whoever packs orders. Only the
 * credentials, the default carrier, and the connection test are restricted.
 * `messageFor` is not used here: it routes everything through the courier error
 * vocabulary, which would rewrite a permission refusal into a carrier problem.
 */
async function requireCourierManagerStore() {
  try {
    const { store } = await requireStoreManager();

    return { ok: true as const, store };
  } catch (error) {
    return {
      ok: false as const,
      state: {
        message:
          error instanceof StoreAccessError
            ? error.message
            : "Could not verify your access. Sign in again.",
        status: "error" as const
      }
    };
  }
}

export async function sendOrderToCourierAction(
  orderId: string,
  provider?: string
): Promise<CourierActionState> {
  const store = await requireStore();
  const gate = await courierPlanGate(store.id);

  if (gate) {
    return gate;
  }

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

export type BulkSendActionState = CourierActionState & {
  result: BulkSendResult | null;
};

/**
 * The highest-risk action in the product: one call, many real parcels. Every
 * safety guarantee lives in the service; this wrapper only validates the shape
 * and enforces the 50-order product cap through the schema.
 */
export async function sendOrdersToCourierAction(
  orderIds: string[],
  provider?: string
): Promise<BulkSendActionState> {
  const store = await requireStore();
  const gate = await courierPlanGate(store.id);

  if (gate) {
    return { ...gate, result: null };
  }

  const user = await getCurrentUser();
  const parsed = bulkSendShipmentsSchema.safeParse({
    orderIds,
    ...(provider ? { provider } : {})
  });

  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "Select between 1 and 50 orders.",
      result: null,
      status: "error"
    };
  }

  try {
    const result = await sendOrdersToCourier({
      orderIds: parsed.data.orderIds,
      storeId: store.id,
      ...(parsed.data.provider ? { provider: parsed.data.provider } : {}),
      ...(user?.id ? { userId: user.id } : {})
    });

    revalidateCourierPaths(store.slug);

    return {
      message: `${result.sent.length} sent · ${result.skipped.length} skipped · ${result.failed.length} failed`,
      result,
      status:
        result.failed.length > 0 || result.needsReconciliation.length > 0 ? "warning" : "success"
    };
  } catch (error) {
    return { message: messageFor(error), result: null, status: "error" };
  }
}

export async function refreshActiveShipmentsAction(): Promise<CourierActionState> {
  const store = await requireStore();
  const gate = await courierPlanGate(store.id);

  if (gate) {
    return gate;
  }

  try {
    const { checked, failed, updated } = await refreshActiveShipments(store.id);

    revalidateCourierPaths(store.slug);

    if (checked === 0) {
      return { message: "No active shipments to check.", status: "warning" };
    }

    return {
      message: `Checked ${checked} shipment(s) — ${updated} updated${failed ? `, ${failed} could not be reached` : ""}.`,
      status: failed > 0 ? "warning" : "success"
    };
  } catch (error) {
    return { message: messageFor(error), status: "error" };
  }
}

export async function refreshShipmentStatusAction(
  shipmentId: string,
  orderId?: string
): Promise<CourierActionState> {
  const store = await requireStore();
  const gate = await courierPlanGate(store.id);

  if (gate) {
    return gate;
  }

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

export type CourierScoreActionState = CourierActionState & {
  score: CourierScoreView | null;
};

/** Read-only, so it never redirects and never throws into the page. */
export async function checkCourierScoreAction(
  phone: string,
  force = false
): Promise<CourierScoreActionState> {
  const store = await requireStore();
  // Customer risk history is its own entitlement, not part of courier automation.
  const gate = await courierPlanGate(store.id, "fraud_check");

  if (gate) {
    return { ...gate, score: null };
  }

  const parsed = customerScoreSchema.safeParse({ force, phone });

  if (!parsed.success) {
    return { message: "That phone number is not valid.", score: null, status: "error" };
  }

  const score = await checkCourierCustomerScore(store.id, parsed.data.phone, {
    force: parsed.data.force
  });

  // A refreshed delivery history feeds the "courier delivery history" risk
  // factor, so the stored scores for this customer's orders are brought back in
  // line here rather than drifting until the next order.
  if (!score.error) {
    await assessOrdersForCustomerSafely(store.id, { phone: parsed.data.phone });
    revalidatePath("/dashboard/orders/verification");
    revalidatePath("/dashboard/orders/fake");
  }

  return {
    score,
    status: score.error ? "warning" : "success",
    ...(score.error ? { message: score.error } : {})
  };
}

export async function refreshCourierBalanceAction(
  providerKey: string
): Promise<CourierActionState> {
  const store = await requireStore();
  const gate = await courierPlanGate(store.id);

  if (gate) {
    return gate;
  }

  const balance = await getCourierBalance(store.id, providerKey, { force: true });

  revalidateCourierPaths(store.slug);

  if (!balance) {
    return { message: "This courier does not report a balance.", status: "warning" };
  }

  if (balance.error) {
    return { message: balance.error, status: "warning" };
  }

  return {
    message: `Balance ৳${(balance.amount ?? 0).toLocaleString("en-BD")}.`,
    status: "success"
  };
}

export async function saveCourierAccountFormAction(
  _state: CourierActionState,
  formData: FormData
): Promise<CourierActionState> {
  const access = await requireCourierManagerStore();

  if (!access.ok) {
    return access.state;
  }

  const store = access.store;
  const gate = await courierPlanGate(store.id);

  if (gate) {
    return gate;
  }

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
  const access = await requireCourierManagerStore();

  if (!access.ok) {
    return access.state;
  }

  const store = access.store;
  const gate = await courierPlanGate(store.id);

  if (gate) {
    return gate;
  }

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
  const access = await requireCourierManagerStore();

  if (!access.ok) {
    return access.state;
  }

  const store = access.store;
  const gate = await courierPlanGate(store.id);

  if (gate) {
    return gate;
  }

  try {
    const result = await testCourierConnection(store.id, providerKey);

    revalidateCourierPaths(store.slug);

    return { message: result.message, status: result.ok ? "success" : "error" };
  } catch (error) {
    revalidateCourierPaths(store.slug);

    return { message: messageFor(error), status: "error" };
  }
}

export type TrackOrderActionState = CourierActionState & {
  reference: string;
  shipment: TrackedShipmentView | null;
};

/**
 * Order Tracking's lookup, gated on its own entitlement rather than on
 * `courier_api`: booking parcels and tracking them are sold separately, and a
 * seller can hold one without the other.
 *
 * Read-only, so it returns state instead of redirecting — the page keeps whatever
 * was already on screen when a code turns out to be wrong.
 */
export async function trackOrderAction(reference: string): Promise<TrackOrderActionState> {
  const store = await requireStore();
  const gate = await courierPlanGate(store.id, "order_tracking");
  const trimmed = reference.trim();

  if (gate) {
    return { ...gate, reference: trimmed, shipment: null };
  }

  if (!trimmed) {
    return {
      message: "Enter a tracking code, consignment id, or order number.",
      reference: trimmed,
      shipment: null,
      status: "error"
    };
  }

  const shipment = await trackShipmentByReference(store.id, trimmed);

  if (!shipment) {
    return {
      message: `No parcel found for "${trimmed}". Check the code, or search by order number instead.`,
      reference: trimmed,
      shipment: null,
      status: "warning"
    };
  }

  return { reference: trimmed, shipment, status: "success" };
}

export type CourierWebhookActionState = CourierActionState & {
  /** Shown once, so the seller can copy it into the carrier's panel. */
  secret: string | null;
  url: string | null;
};

/**
 * Issues the callback URL and secret for one carrier.
 *
 * Manager-only and doubly gated: the credentials it hangs off are a manager
 * concern, and auto-sync is what `order_tracking` actually sells. Regenerating
 * invalidates the previous pair immediately, which is why the copy says so.
 */
export async function generateCourierWebhookAction(
  providerKey: string
): Promise<CourierWebhookActionState> {
  const access = await requireCourierManagerStore();

  if (!access.ok) {
    return { ...access.state, secret: null, url: null };
  }

  const store = access.store;
  const gate = await courierPlanGate(store.id, "order_tracking");

  if (gate) {
    return { ...gate, secret: null, url: null };
  }

  try {
    const result = await generateCourierWebhook(store.id, providerKey);

    revalidateCourierPaths(store.slug);

    return {
      message: "Webhook URL created. Paste both values into the courier's panel.",
      secret: result.secret,
      status: "success",
      url: result.url
    };
  } catch (error) {
    return { message: messageFor(error), secret: null, status: "error", url: null };
  }
}

export async function disableCourierWebhookAction(
  providerKey: string
): Promise<CourierWebhookActionState> {
  const access = await requireCourierManagerStore();

  if (!access.ok) {
    return { ...access.state, secret: null, url: null };
  }

  const store = access.store;
  const gate = await courierPlanGate(store.id, "order_tracking");

  if (gate) {
    return { ...gate, secret: null, url: null };
  }

  try {
    await disableCourierWebhook(store.id, providerKey);

    revalidateCourierPaths(store.slug);

    return {
      message: "Webhook disabled. Remove the URL from the courier's panel too.",
      secret: null,
      status: "success",
      url: null
    };
  } catch (error) {
    return { message: messageFor(error), secret: null, status: "error", url: null };
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
  revalidatePath("/dashboard/orders/tracking");
  revalidatePath("/dashboard/settings/courier");
  revalidatePath(`/dashboard/settings/${storeSlug}`);

  if (orderId) {
    revalidatePath(`/dashboard/orders/${orderId}`);
  }
}
