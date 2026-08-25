"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireStore } from "../stores/queries";
import { BlockedIpError, blockIp, blockIpFromOrder, unblockIp } from "./blocked-ip.service";
import type { BlockedIpFormInput } from "./blocked-ip.schema";

const BLOCKED_IPS_PATH = "/dashboard/orders/blocked-ips";

export type BlockedIpActionState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "error" | "idle" | "success";
};

export async function blockIpFormAction(
  _state: BlockedIpActionState,
  formData: FormData
): Promise<BlockedIpActionState> {
  const store = await requireStore();
  const ipAddress = stringValue(formData.get("ipAddress"));

  try {
    await blockIp(store.id, {
      duration: stringValue(formData.get("duration")) as BlockedIpFormInput["duration"],
      ipAddress,
      reason: optionalValue(formData.get("reason"))
    });
  } catch (error) {
    return blockedIpErrorState(error);
  }

  revalidatePath(BLOCKED_IPS_PATH);

  return { message: `${ipAddress} is now blocked from placing orders.`, status: "success" };
}

/**
 * One-click block from the suggestion list.
 *
 * Permanent with a stock reason on purpose: the seller is acting on evidence the
 * row is already showing them, and making them fill in a form to agree with it
 * would only cost them the click. The block is editable afterwards like any other.
 */
export async function blockSuggestedIpAction(ipAddress: string): Promise<BlockedIpActionState> {
  const store = await requireStore();

  try {
    await blockIp(store.id, {
      duration: "permanent",
      ipAddress,
      reason: "Repeat fake orders"
    });
  } catch (error) {
    return blockedIpErrorState(error);
  }

  revalidatePath(BLOCKED_IPS_PATH);

  return { message: `${ipAddress} is now blocked from placing orders.`, status: "success" };
}

export async function blockOrderIpAction(orderId: string): Promise<BlockedIpActionState> {
  const store = await requireStore();

  try {
    await blockIpFromOrder(store.id, orderId, {
      duration: "permanent",
      reason: "Blocked from order review"
    });
  } catch (error) {
    return blockedIpErrorState(error);
  }

  revalidatePath(BLOCKED_IPS_PATH);
  revalidatePath(`/dashboard/orders/fake/${orderId}`);
  revalidatePath(`/dashboard/orders/${orderId}`);

  return { message: "This address is now blocked from placing orders.", status: "success" };
}

export async function unblockIpAction(blockedIpId: string): Promise<BlockedIpActionState> {
  const store = await requireStore();

  if (!(await unblockIp(store.id, blockedIpId))) {
    return { message: "That block no longer exists.", status: "error" };
  }

  revalidatePath(BLOCKED_IPS_PATH);

  return { message: "Unblocked.", status: "success" };
}

function stringValue(value: FormDataEntryValue | null | undefined) {
  return String(value ?? "").trim();
}

function optionalValue(value: FormDataEntryValue | null | undefined) {
  const next = stringValue(value);
  return next || undefined;
}

function blockedIpErrorState(error: unknown): BlockedIpActionState {
  if (error instanceof ZodError) {
    return {
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [
          issue.path.length ? String(issue.path[0]) : "form",
          issue.message
        ])
      ),
      message: "Please fix the highlighted fields.",
      status: "error"
    };
  }

  if (error instanceof BlockedIpError) {
    return {
      fieldErrors: { [error.field]: error.message },
      message: error.message,
      status: "error"
    };
  }

  return {
    message: error instanceof Error ? error.message : "Could not update the blocklist.",
    status: "error"
  };
}
