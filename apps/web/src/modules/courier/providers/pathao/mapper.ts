import { CourierError } from "../../courier-errors";
import type { CreateShipmentInput } from "../provider.types";

/**
 * Domain input → Pathao's `/orders` payload.
 *
 * Limits come from the published parameter table: address 10–220, phone 11
 * digits, weight 0.5–10 kg, `amount_to_collect` an integer.
 *
 * One exception, verified against the sandbox: the doc says `recipient_name` may
 * be 3–100 characters, but the API rejects anything over 64 with "The recipient
 * name must be between 3 and 64 characters." The tighter real limit wins.
 *
 * Address is sent as free text only. `recipient_city` / `recipient_zone` /
 * `recipient_area` are optional and Pathao resolves them from the address
 * itself, so the city→zone→area lookup is deliberately not implemented. If
 * precision ever matters (rural addresses, or price-plan quoting, which *does*
 * require city and zone ids), resolve them here via
 * `/city-list` → `/cities/{id}/zone-list` → `/zones/{id}/area-list` and add the
 * three fields below — nothing outside this mapper would need to change.
 */

const normalDelivery = 48;
const onDemandDelivery = 12;
const parcelItemType = 2;
const minimumWeightKg = 0.5;
const maximumWeightKg = 10;
/** Enforced by the API at 64, not the 100 the documentation claims. */
const maximumNameLength = 64;

export type PathaoOrderPayload = {
  amount_to_collect: number;
  delivery_type: number;
  item_description?: string;
  item_quantity: number;
  item_type: number;
  item_weight: string;
  merchant_order_id: string;
  recipient_address: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_secondary_phone?: string;
  special_instruction?: string;
  store_id: number;
};

export function toPathaoOrderPayload(
  input: CreateShipmentInput,
  storeId: number
): PathaoOrderPayload {
  const name = clampText(input.recipient.name, 3, maximumNameLength);

  if (!name) {
    throw new CourierError("VALIDATION", "Pathao needs a recipient name of at least 3 characters.");
  }

  const address = clampText(input.recipient.address, 10, 220);

  if (!address) {
    throw new CourierError(
      "VALIDATION",
      "Pathao needs a delivery address of at least 10 characters — this order's address is too short."
    );
  }

  const payload: PathaoOrderPayload = {
    // Integer per the spec; COD is already derived server-side and zeroed for
    // paid orders before it reaches any adapter.
    amount_to_collect: Math.max(0, Math.round(input.codAmount)),
    delivery_type: input.deliveryType === "HUB_PICKUP" ? onDemandDelivery : normalDelivery,
    item_quantity: Math.max(1, Math.round(input.quantity ?? 1)),
    item_type: parcelItemType,
    item_weight: weightKg(input.weightGrams).toFixed(1),
    merchant_order_id: input.reference,
    recipient_address: address,
    recipient_name: name,
    recipient_phone: input.recipient.phone,
    store_id: storeId
  };

  if (input.recipient.alternatePhone) {
    payload.recipient_secondary_phone = input.recipient.alternatePhone;
  }

  if (input.itemDescription) {
    payload.item_description = clampText(input.itemDescription, 0, 500);
  }

  if (input.note) {
    payload.special_instruction = clampText(input.note, 0, 500);
  }

  return payload;
}

/**
 * We do not track parcel weight, so this is a documented default rather than a
 * guess dressed up as data: the carrier minimum, clamped into the legal range
 * if a weight ever does arrive.
 */
function weightKg(weightGrams: number | undefined) {
  if (typeof weightGrams !== "number" || !Number.isFinite(weightGrams) || weightGrams <= 0) {
    return minimumWeightKg;
  }

  return Math.min(maximumWeightKg, Math.max(minimumWeightKg, weightGrams / 1000));
}

function clampText(value: string, min: number, max: number) {
  const trimmed = value.trim();

  if (trimmed.length < min) {
    return "";
  }

  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}
