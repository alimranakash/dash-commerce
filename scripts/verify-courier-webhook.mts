/**
 * Courier webhook + Order Tracking check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * auto-sync path. Everything except the HTTP hop is exercised for real: it
 * creates a throwaway store, order, courier account and shipment, drives
 * `receiveCourierWebhook` exactly as the route handler would, asserts what
 * landed in the database, and deletes the fixture again on the way out.
 *
 * Covers:
 * - Steadfast and Pathao payload parsing, including their different auth schemes;
 * - a wrong secret and an unknown token both being refused;
 * - `applyShipmentStatus` guards holding on the webhook path (out-of-order
 *   updates dropped, terminal states final);
 * - a `tracking_update` recording a timeline entry without a status change;
 * - Order.fulfillmentStatus projecting only on a confirmed delivery;
 * - the naive Asia/Dhaka timestamps in both payloads landing as the right UTC;
 * - `trackShipmentByReference` finding a parcel by all four identifiers;
 * - the plan gate refusing when the store is not entitled to Order Tracking.
 *
 * Run with: npm run verify:courier-webhook
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@dash/db";
import { encryptCredentials } from "../apps/web/src/modules/courier/courier-credentials";
import { parseCarrierTimestamp } from "../apps/web/src/modules/courier/courier-time";
import { receiveCourierWebhook } from "../apps/web/src/modules/courier/courier-webhook.service";
import { trackShipmentByReference } from "../apps/web/src/modules/courier/courier.service";

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);

  if (!passed) {
    failures += 1;
  }
}

const suffix = Date.now().toString(36);

type Fixture = {
  organizationId: string;
  orderId: string;
  storeId: string;
};

async function createFixture(entitled: boolean): Promise<Fixture> {
  const organization = await prisma.organization.create({
    data: { name: `Webhook Check ${suffix}`, slug: `wh-org-${suffix}-${randomUUID().slice(0, 6)}` }
  });
  const store = await prisma.store.create({
    data: {
      currency: "BDT",
      name: `Webhook Check ${suffix}`,
      organizationId: organization.id,
      slug: `wh-store-${suffix}-${randomUUID().slice(0, 6)}`
    }
  });

  // Entitlement is the real gate, so the fixture subscribes to a real plan
  // rather than stubbing `hasPlanFeature`.
  const plan = await prisma.plan.findFirst({
    where: entitled ? { features: { some: { featureKey: "order_tracking" } } } : { slug: "free" }
  });

  if (plan) {
    await prisma.subscription.create({
      data: {
        currentPeriodEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        organizationId: organization.id,
        planId: plan.id,
        status: "ACTIVE",
        storeId: store.id
      }
    });
  }

  const order = await prisma.order.create({
    data: {
      currency: "BDT",
      customerName: "Webhook Customer",
      customerPhone: "01712345678",
      orderNumber: `WH-${suffix}-${randomUUID().slice(0, 6)}`,
      storeId: store.id,
      subtotalAmount: 1000,
      totalAmount: 1000
    }
  });

  return { orderId: order.id, organizationId: organization.id, storeId: store.id };
}

/** Organization cascades to the store, and the store to everything below it. */
async function destroyFixture(fixture: Fixture) {
  await prisma.organization.deleteMany({ where: { id: fixture.organizationId } });
}

async function createAccountAndShipment(
  fixture: Fixture,
  provider: string,
  shipment: { invoiceReference: string; providerShipmentId: string; trackingCode: string }
) {
  const token = `verify-${provider}-${suffix}-${randomUUID().slice(0, 8)}`;
  const secret = `secret-${randomUUID()}`;

  await prisma.courierAccount.create({
    data: {
      credentialsCipher: encryptCredentials({ apiKey: "x", secretKey: "y" }),
      isDefault: true,
      isEnabled: true,
      provider,
      storeId: fixture.storeId,
      webhookSecret: encryptCredentials({ secret }),
      webhookToken: token
    }
  });

  const row = await prisma.shipment.create({
    data: {
      codAmount: 1000,
      invoiceReference: shipment.invoiceReference,
      orderId: fixture.orderId,
      provider,
      providerShipmentId: shipment.providerShipmentId,
      status: "BOOKED",
      storeId: fixture.storeId,
      trackingCode: shipment.trackingCode
    }
  });

  return { secret, shipmentId: row.id, token };
}

function steadfastRequest(body: unknown, secret: string) {
  const rawBody = JSON.stringify(body);

  return { body, headers: { authorization: `Bearer ${secret}` }, rawBody };
}

function pathaoRequest(body: unknown, secret: string) {
  const rawBody = JSON.stringify(body);

  return { body, headers: { "x-pathao-signature": secret }, rawBody };
}

async function readShipment(shipmentId: string) {
  const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
  const events = await prisma.deliveryEvent.findMany({
    orderBy: { occurredAt: "desc" },
    where: { shipmentId }
  });
  const order = await prisma.order.findUniqueOrThrow({
    select: { fulfillmentStatus: true },
    where: { id: shipment.orderId }
  });

  return { events, order, shipment };
}

async function main() {
  console.log("=== Timestamp handling ===");
  {
    // "2025-03-02 12:45:30" in Dhaka is 06:45:30 UTC. Read as UTC it would be
    // six hours in the future, which trips the out-of-order guard forever after.
    const parsed = parseCarrierTimestamp("2025-03-02 12:45:30");
    check(
      "naive carrier timestamp is read as Asia/Dhaka",
      parsed?.toISOString() === "2025-03-02T06:45:30.000Z",
      parsed?.toISOString() ?? "unparsed"
    );
    check(
      "an explicit offset is left alone",
      parseCarrierTimestamp("2025-03-02T12:45:30Z")?.toISOString() === "2025-03-02T12:45:30.000Z"
    );
    check("garbage parses to undefined", parseCarrierTimestamp("not a date") === undefined);
  }

  console.log("\n=== Steadfast ===");
  const steadfast = await createFixture(true);

  try {
    const { secret, shipmentId, token } = await createAccountAndShipment(steadfast, "steadfast", {
      invoiceReference: `INV-${suffix}`,
      providerShipmentId: "1424107",
      trackingCode: `15Y2CT${suffix.slice(-4).toUpperCase()}`
    });

    {
      const result = await receiveCourierWebhook(
        token,
        steadfastRequest({ consignment_id: 1424107, delivery_status: "in_review" }, "the-wrong-secret")
      );
      check("a wrong Bearer is refused", result.status === 404, result.reason);
    }

    {
      const result = await receiveCourierWebhook(
        "no-such-token",
        steadfastRequest({ consignment_id: 1424107, delivery_status: "delivered" }, secret)
      );
      check("an unknown token is refused", result.status === 404, result.reason);
    }

    {
      const result = await receiveCourierWebhook(
        token,
        steadfastRequest(
          {
            consignment_id: 1424107,
            delivery_status: "pending",
            invoice: `INV-${suffix}`,
            notification_type: "delivery_status",
            updated_at: "2025-03-02 12:00:00"
          },
          secret
        )
      );
      const state = await readShipment(shipmentId);
      check("a valid delivery_status is applied", result.status === 200 && result.applied === 1, result.reason);
      check("status maps through the shared map", state.shipment.status === "IN_TRANSIT", state.shipment.status);
      check(
        "the carrier's own string is stored verbatim",
        state.shipment.providerStatus === "pending",
        state.shipment.providerStatus ?? "null"
      );
      check(
        "the event is attributed to the webhook",
        state.events[0]?.source === "PROVIDER_WEBHOOK",
        state.events[0]?.source ?? "none"
      );
      check(
        "order fulfillment projects to SHIPPED",
        state.order.fulfillmentStatus === "SHIPPED",
        state.order.fulfillmentStatus
      );
    }

    {
      const before = await readShipment(shipmentId);
      const result = await receiveCourierWebhook(
        token,
        steadfastRequest(
          {
            consignment_id: 1424107,
            notification_type: "tracking_update",
            tracking_message: "Parcel received at Dhaka hub.",
            updated_at: "2025-03-02 13:00:00"
          },
          secret
        )
      );
      const after = await readShipment(shipmentId);
      check("a tracking_update is accepted", result.status === 200 && result.applied === 1, result.reason);
      check(
        "a tracking_update adds a timeline entry",
        after.events.length === before.events.length + 1,
        `${before.events.length} -> ${after.events.length}`
      );
      check(
        "a tracking_update does not invent a status change",
        after.shipment.status === before.shipment.status,
        after.shipment.status
      );
      check(
        "the free-text message is kept verbatim",
        after.events[0]?.message === "Parcel received at Dhaka hub.",
        after.events[0]?.message ?? "none"
      );
    }

    {
      // An older update arriving after a newer one must not rewind the parcel.
      await receiveCourierWebhook(
        token,
        steadfastRequest(
          { consignment_id: 1424107, delivery_status: "in_review", updated_at: "2025-03-02 09:00:00" },
          secret
        )
      );
      const state = await readShipment(shipmentId);
      check(
        "an out-of-order update is dropped",
        state.shipment.status === "IN_TRANSIT",
        state.shipment.status
      );
    }

    {
      const result = await receiveCourierWebhook(
        token,
        steadfastRequest(
          { consignment_id: 1424107, delivery_status: "Delivered", updated_at: "2025-03-03 10:00:00" },
          secret
        )
      );
      const state = await readShipment(shipmentId);
      check("the title-cased webhook vocabulary maps too", result.applied === 1, result.reason);
      check("delivered is applied", state.shipment.status === "DELIVERED", state.shipment.status);
      check("deliveredAt is stamped", state.shipment.deliveredAt !== null);
      check(
        "a confirmed delivery fulfils the order",
        state.order.fulfillmentStatus === "FULFILLED",
        state.order.fulfillmentStatus
      );
    }

    {
      // Terminal is final: a late in-flight update cannot drag it back.
      await receiveCourierWebhook(
        token,
        steadfastRequest(
          { consignment_id: 1424107, delivery_status: "pending", updated_at: "2025-03-04 10:00:00" },
          secret
        )
      );
      const state = await readShipment(shipmentId);
      check(
        "a terminal shipment is not dragged back into transit",
        state.shipment.status === "DELIVERED",
        state.shipment.status
      );
    }

    {
      const result = await receiveCourierWebhook(token, steadfastRequest({ ping: true }, secret));
      check("an unrecognised payload is acknowledged, not errored", result.status === 200, result.reason);
    }

    {
      const account = await prisma.courierAccount.findFirstOrThrow({
        where: { provider: "steadfast", storeId: steadfast.storeId }
      });
      check("the carrier's last contact is recorded", account.webhookLastSeenAt !== null);
    }

    console.log("\n=== Order Tracking lookup ===");
    {
      const order = await prisma.order.findUniqueOrThrow({ where: { id: steadfast.orderId } });
      const byTracking = await trackShipmentByReference(
        steadfast.storeId,
        (await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } })).trackingCode ?? ""
      );
      const byConsignment = await trackShipmentByReference(steadfast.storeId, "1424107");
      const byInvoice = await trackShipmentByReference(steadfast.storeId, `INV-${suffix}`);
      const byOrderNumber = await trackShipmentByReference(steadfast.storeId, order.orderNumber);
      const byNonsense = await trackShipmentByReference(steadfast.storeId, "definitely-not-a-code");

      check("found by tracking code", byTracking?.id === shipmentId);
      check("found by consignment id", byConsignment?.id === shipmentId);
      check("found by invoice reference", byInvoice?.id === shipmentId);
      check("found by order number", byOrderNumber?.id === shipmentId);
      check("an unknown reference finds nothing", byNonsense === null);
      check(
        "the timeline comes back with the parcel",
        (byTracking?.events.length ?? 0) >= 3,
        String(byTracking?.events.length ?? 0)
      );
      check("auto-sync reads as enabled", byTracking?.autoSync.enabled === true);

      // Another store must never see this parcel, whatever it types.
      const other = await createFixture(true);

      try {
        check(
          "another store cannot look the parcel up",
          (await trackShipmentByReference(other.storeId, "1424107")) === null
        );
      } finally {
        await destroyFixture(other);
      }
    }
  } finally {
    await destroyFixture(steadfast);
  }

  console.log("\n=== Pathao ===");
  const pathao = await createFixture(true);

  try {
    const { secret, shipmentId, token } = await createAccountAndShipment(pathao, "pathao", {
      invoiceReference: `PIN-${suffix}`,
      providerShipmentId: `DR${suffix.toUpperCase()}`,
      trackingCode: `DR${suffix.toUpperCase()}`
    });

    {
      const result = await receiveCourierWebhook(
        token,
        pathaoRequest({ consignment_id: `DR${suffix.toUpperCase()}`, event: "order.delivered" }, "wrong")
      );
      check("a wrong signature is refused", result.status === 404, result.reason);
    }

    {
      const result = await receiveCourierWebhook(
        token,
        pathaoRequest({ event: "webhook.integration" }, secret)
      );
      check("the integration ping is acknowledged", result.status === 200 && result.applied === 0, result.reason);
      check(
        "the ack header Pathao requires is returned",
        result.ackHeaders["X-Pathao-Merchant-Webhook-Integration-Secret"] ===
          "f3992ab6-96ec-4e5c-b0b6-27d99e5d5d5f"
      );
    }

    {
      const result = await receiveCourierWebhook(
        token,
        pathaoRequest(
          {
            consignment_id: `DR${suffix.toUpperCase()}`,
            event: "order.pickup",
            order_status: "Picked",
            updated_at: "2025-03-02 11:00:00"
          },
          secret
        )
      );
      const state = await readShipment(shipmentId);
      check("a Pathao event is applied", result.applied === 1, result.reason);
      check("the event name drives the status", state.shipment.status === "PICKED_UP", state.shipment.status);
      check(
        "Pathao's own label is shown verbatim",
        state.shipment.providerStatus === "Picked",
        state.shipment.providerStatus ?? "null"
      );
    }

    {
      const result = await receiveCourierWebhook(
        token,
        pathaoRequest(
          {
            consignment_id: "DR-SOMEONE-ELSES-PARCEL",
            event: "order.delivered",
            updated_at: "2025-03-02 12:00:00"
          },
          secret
        )
      );
      check(
        "an event for an unknown parcel is acknowledged without writing",
        result.status === 200 && result.applied === 0,
        result.reason
      );
    }
  } finally {
    await destroyFixture(pathao);
  }

  console.log("\n=== Plan gate ===");
  const unentitled = await createFixture(false);

  try {
    const { secret, shipmentId, token } = await createAccountAndShipment(unentitled, "steadfast", {
      invoiceReference: `FREE-${suffix}`,
      providerShipmentId: "9999999",
      trackingCode: `FREE${suffix.slice(-4).toUpperCase()}`
    });

    const result = await receiveCourierWebhook(
      token,
      steadfastRequest({ consignment_id: 9999999, delivery_status: "delivered" }, secret)
    );
    const state = await readShipment(shipmentId);

    check(
      "a store without Order Tracking is acknowledged, not errored",
      result.status === 200 && result.applied === 0,
      result.reason
    );
    check(
      "no status is written for an unentitled store",
      state.shipment.status === "BOOKED",
      state.shipment.status
    );
  } finally {
    await destroyFixture(unentitled);
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
