import type { CreateShipmentInput } from "../provider.types";

/**
 * Domain input → the official `create_order` parameter set.
 *
 * Field limits come straight from the published parameter table: name ≤ 100,
 * address ≤ 250, phone exactly 11 digits, cod_amount ≥ 0 "including all
 * charges". Phone normalization happens upstream in the service so an invalid
 * number fails as a local validation error before any dispatch — by the time a
 * draft reaches this mapper its phone fields are already canonical.
 *
 * Optional fields are omitted entirely rather than sent empty: a malformed
 * secondary phone must never be the reason a parcel goes unbooked.
 */

export type SteadfastCreateOrderPayload = {
  alternative_phone?: string;
  cod_amount: number;
  delivery_type?: number;
  invoice: string;
  item_description?: string;
  note?: string;
  recipient_address: string;
  recipient_email?: string;
  recipient_name: string;
  recipient_phone: string;
  total_lot?: number;
};

export function toSteadfastCreateOrderPayload(input: CreateShipmentInput) {
  const payload: SteadfastCreateOrderPayload = {
    cod_amount: roundAmount(input.codAmount),
    invoice: input.reference,
    recipient_address: truncate(input.recipient.address, 250),
    recipient_name: truncate(input.recipient.name, 100),
    recipient_phone: input.recipient.phone
  };

  if (input.recipient.alternatePhone) {
    payload.alternative_phone = input.recipient.alternatePhone;
  }

  if (input.recipient.email) {
    payload.recipient_email = truncate(input.recipient.email, 100);
  }

  if (input.note) {
    payload.note = truncate(input.note, 400);
  }

  if (input.itemDescription) {
    payload.item_description = truncate(input.itemDescription, 400);
  }

  if (typeof input.quantity === "number" && input.quantity > 0) {
    payload.total_lot = Math.round(input.quantity);
  }

  if (input.deliveryType) {
    payload.delivery_type = input.deliveryType === "HUB_PICKUP" ? 1 : 0;
  }

  return payload;
}

/** Flattens our address parts into the single line the carrier accepts. */
export function toSteadfastAddressLine(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

function truncate(value: string, max: number) {
  const trimmed = value.trim();

  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function roundAmount(value: number) {
  return Math.max(0, Math.round(value * 100) / 100);
}
