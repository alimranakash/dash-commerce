import { z } from "zod";
import { courierProviderKeys } from "./courier.types";

/** A single bulk run may never book more than this many real parcels. */
export const BULK_SEND_MAX_ORDERS = 50;

export const courierProviderKeySchema = z.enum(courierProviderKeys);

export const sendShipmentSchema = z.object({
  orderId: z.string().trim().min(1, "Order is required."),
  provider: courierProviderKeySchema.optional()
});

export const bulkSendShipmentsSchema = z.object({
  orderIds: z
    .array(z.string().trim().min(1))
    .min(1, "Select at least one order.")
    .max(BULK_SEND_MAX_ORDERS, `Send at most ${BULK_SEND_MAX_ORDERS} orders at a time.`),
  provider: courierProviderKeySchema.optional()
});

export const refreshShipmentSchema = z.object({
  shipmentId: z.string().trim().min(1, "Shipment is required.")
});

export const customerScoreSchema = z.object({
  force: z.boolean().default(false),
  phone: z.string().trim().min(6, "A valid phone number is required.").max(20),
  provider: courierProviderKeySchema.optional()
});

export const courierAccountSchema = z.object({
  credentials: z.record(z.string().trim().min(1).max(60), z.string().trim().max(400)),
  isDefault: z.boolean().default(false),
  isEnabled: z.boolean().default(false),
  label: z.string().trim().max(80).optional(),
  provider: courierProviderKeySchema
});

export type BulkSendShipmentsInput = z.infer<typeof bulkSendShipmentsSchema>;
export type CourierAccountInput = z.infer<typeof courierAccountSchema>;
export type CustomerScoreInput = z.infer<typeof customerScoreSchema>;
export type RefreshShipmentInput = z.infer<typeof refreshShipmentSchema>;
export type SendShipmentInput = z.infer<typeof sendShipmentSchema>;
