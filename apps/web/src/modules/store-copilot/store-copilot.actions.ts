"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentUser } from "../../lib/auth";
import type { AiActor } from "../ai/ai-actions.service";
import { requireStore } from "../stores/queries";
import {
  askStoreCopilot,
  executeStoreCopilotAction,
  getStoreCopilotCapability,
  STORE_COPILOT_LOCKED_MESSAGE,
  StoreCopilotActionError
} from "./store-copilot.service";
import {
  storeCopilotActionSchema,
  type StoreCopilotActionResult,
  type StoreCopilotActionType,
  type StoreCopilotAskInput,
  type StoreCopilotReply
} from "./store-copilot.schema";

/**
 * The two entry points behind the AI Store Copilot page.
 *
 * Both begin with `requireStore()`, and that call is the whole tenancy
 * guarantee: the store is resolved from the session, so nothing the browser
 * sends — not a hidden field, not a `storeId` smuggled into the action payload,
 * not a query string on the action URL — changes which store is read or written.
 * The only things the browser supplies are a question and, on the second action,
 * a proposal that is re-parsed here before it goes anywhere.
 *
 * `requireStore()` rather than `requireStoreManager()` on both, deliberately.
 * The changes this page can make are creating a coupon, editing a product and
 * moving an order's status, and `coupon.actions.ts`, `product.actions.ts` and
 * `order.actions.ts` all guard those with `requireStore()`. Asking the assistant
 * to do a thing must need exactly the authority as doing it by hand — no more,
 * and no less.
 */

/** Which page a confirmed change makes stale. */
const REVALIDATE_PATHS: Record<StoreCopilotActionType, string[]> = {
  create_coupon: ["/dashboard/coupons"],
  update_order_status: ["/dashboard/orders"],
  update_product: ["/dashboard/products"]
};

export async function askStoreCopilotAction(
  input: StoreCopilotAskInput
): Promise<StoreCopilotReply> {
  const store = await requireStore();

  try {
    return await askStoreCopilot(store.id, input);
  } catch (error) {
    // A turn never fails into a red box. The service already falls back to the
    // deterministic briefing for anything a provider did; what reaches here is a
    // malformed question or a database that is down, and both are better said in
    // a sentence inside the conversation than thrown at the component.
    console.error("[store-copilot] ask failed:", error);

    return {
      action: null,
      actionPreview: null,
      answer:
        error instanceof ZodError
          ? (error.issues[0]?.message ?? "Please rephrase that question.")
          : "Something went wrong reading your store just then. Try asking again.",
      followUps: [],
      source: "offline",
      used: [],
      warnings: []
    };
  }
}

/**
 * Run the change the merchant pressed Confirm on.
 *
 * The proposal arrives from the browser and is re-parsed by
 * `storeCopilotActionSchema` here — never trusted as the object the model
 * produced a moment ago. That matters less than it looks: the schema is built
 * from the AI API's own body schemas, and the services behind it are the ones
 * the dashboard's buttons call, so the worst a hand-edited payload can do is
 * exactly what that merchant could already do on the coupons, products or orders
 * page. What the re-parse buys is that it cannot do anything *else*.
 */
export async function runStoreCopilotActionAction(
  input: unknown
): Promise<StoreCopilotActionResult> {
  const store = await requireStore();

  // Fail closed on the entitlement as well as on the payload. A store that lost
  // its plan between being offered a proposal and confirming it must not get the
  // write through a stale browser tab.
  if ((await getStoreCopilotCapability(store.id)).locked) {
    return { error: STORE_COPILOT_LOCKED_MESSAGE, ok: false };
  }

  const parsed = storeCopilotActionSchema.safeParse(input);

  if (!parsed.success) {
    return {
      error: "That change is not one this assistant can make.",
      ok: false
    };
  }

  try {
    const message = await executeStoreCopilotAction({
      action: parsed.data,
      actor: await dashboardActor(),
      storeId: store.id
    });

    for (const path of REVALIDATE_PATHS[parsed.data.type]) {
      revalidatePath(path);
    }

    // The home page quotes revenue, pending orders and low stock, all of which
    // any of these three changes can move.
    revalidatePath("/dashboard");

    return { message, ok: true };
  } catch (error) {
    return {
      error:
        error instanceof StoreCopilotActionError ? error.message : "That change could not be made.",
      ok: false
    };
  }
}

/**
 * Who the audit line names.
 *
 * `AiActor` was shaped for an API key, and the mapping is stated rather than
 * left to be guessed: `keyId` carries the signed-in user, `keyHint` their email,
 * and `via` says this came from the dashboard rather than from a key. A change
 * made here is therefore attributable to a person, which is the point — an
 * assistant that can create coupons is only acceptable if the record says who
 * approved each one.
 */
async function dashboardActor(): Promise<AiActor> {
  const user = await getCurrentUser();

  return {
    keyHint: user?.email ?? "unknown",
    keyId: user?.id ?? "unknown",
    keyName: "AI Store Copilot",
    via: "store-copilot"
  };
}
