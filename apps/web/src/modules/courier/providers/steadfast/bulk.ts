import type { CreateShipmentInput } from "../provider.types";
import { toSteadfastCreateOrderPayload } from "./mapper";

/**
 * Encoding and result correlation for `POST /create_order/bulk-order`.
 *
 * Two quirks in the published spec drive everything here:
 *
 * 1. The body is `{ data: "<json string>" }`. The vendor's own PHP example
 *    passes `json_encode($data)` into a field that is then posted as a scalar,
 *    so `data` is a JSON-encoded *string*, not a nested array.
 *
 * 2. Bulk does not enforce invoice uniqueness. The spec's own success example
 *    returns four different consignments all carrying `"invoice": "230822-1"`,
 *    which means the echoed invoice is not a trustworthy key. Correlation below
 *    is therefore strict rather than clever: anything we cannot confidently
 *    match is reported as unmatched and sent to reconciliation, never guessed.
 */

/** Only the six keys documented for bulk; the optional extras are single-send only. */
type SteadfastBulkItem = {
  cod_amount: number;
  invoice: string;
  note?: string;
  recipient_address: string;
  recipient_name: string;
  recipient_phone: string;
};

export type SteadfastBulkItemOutcome = {
  consignmentId: string | null;
  providerStatus: string | null;
  raw: unknown;
  success: boolean;
  trackingCode: string | null;
};

export function toSteadfastBulkBody(inputs: CreateShipmentInput[]) {
  const items: SteadfastBulkItem[] = inputs.map((input) => {
    const payload = toSteadfastCreateOrderPayload(input);
    const item: SteadfastBulkItem = {
      cod_amount: payload.cod_amount,
      invoice: payload.invoice,
      recipient_address: payload.recipient_address,
      recipient_name: payload.recipient_name,
      recipient_phone: payload.recipient_phone
    };

    if (payload.note) {
      item.note = payload.note;
    }

    return item;
  });

  return { data: JSON.stringify(items) };
}

export type SteadfastBulkParse = {
  matched: Map<string, SteadfastBulkItemOutcome>;
  /** Invoices the carrier echoed that we cannot safely attribute. */
  unmatchedInvoices: string[];
};

/**
 * @param sentInvoices the invoices we actually dispatched, in this chunk only.
 */
export function parseSteadfastBulkResponse(
  data: unknown,
  sentInvoices: string[]
): SteadfastBulkParse {
  const items = extractItems(data);
  const expected = new Set(sentInvoices);
  const matched = new Map<string, SteadfastBulkItemOutcome>();
  const unmatchedInvoices: string[] = [];

  for (const entry of items) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const invoice = toStringOrNull(record.invoice);

    // Unknown invoice, or a duplicate of one we already matched: the carrier is
    // telling us about something we cannot pin to a single reserved shipment.
    if (!invoice || !expected.has(invoice) || matched.has(invoice)) {
      if (invoice) {
        unmatchedInvoices.push(invoice);
      }

      continue;
    }

    const status = toStringOrNull(record.status);

    matched.set(invoice, {
      consignmentId: toStringOrNull(record.consignment_id),
      providerStatus: status,
      raw: record,
      success: status?.toLowerCase() === "success",
      trackingCode: toStringOrNull(record.tracking_code)
    });
  }

  return { matched, unmatchedInvoices };
}

/**
 * The docs show a bare array for success and `{ "data": [...] }` for errors, so
 * both shapes have to be accepted.
 */
function extractItems(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === "object") {
    const nested = (data as Record<string, unknown>).data;

    if (Array.isArray(nested)) {
      return nested;
    }
  }

  return [];
}

function toStringOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return typeof value === "string" ? value : null;
}
