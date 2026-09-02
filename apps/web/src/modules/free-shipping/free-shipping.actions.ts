"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireStoreManager } from "../stores/queries";
import { saveFreeShippingSettings } from "./free-shipping.service";
import {
  FREE_SHIPPING_DEFAULTS,
  freeShippingSettingsSchema,
  type FreeShippingSettings
} from "./free-shipping.schema";

/**
 * The seller's free-shipping rule, and the only write in this module.
 *
 * `requireStoreManager()` rather than `requireStore()`, and for a heavier reason
 * than the other storefront widgets: this one decides what the shop charges. A
 * MEMBER may read what the threshold is; changing it changes every future
 * order's total.
 *
 * Deliberately **not** gated by a plan. Every other bar on this storefront is —
 * but a plan that could stop a seller from setting what they bill for delivery
 * would be a plan holding their pricing hostage, and the ungated half of every
 * other gate in this codebase exists for the same reason: a shop must always be
 * able to change what it is doing to its own customers.
 */
export type FreeShippingSettingsState = {
  message?: string;
  /** The saved settings, so the form re-renders from the server's word for it. */
  settings?: FreeShippingSettings;
  status: "idle" | "success" | "error";
};

export async function saveFreeShippingAction(
  _state: FreeShippingSettingsState,
  formData: FormData
): Promise<FreeShippingSettingsState> {
  try {
    const { store } = await requireStoreManager();
    const input = freeShippingSettingsSchema.parse({
      barEnabled: checkboxField(formData, "barEnabled"),
      barSuccessText: textField(formData, "barSuccessText"),
      barText: textField(formData, "barText"),
      enabled: checkboxField(formData, "enabled"),
      surfaces: listField(formData, "surfaces"),
      threshold: textField(formData, "threshold") || "0",
      zoneIds: listField(formData, "zoneIds")
    });

    const settings = await saveFreeShippingSettings(store.id, input);

    revalidatePath("/dashboard/shipping");
    // The rule changes what every cart, mini cart and checkout says and charges,
    // so the whole storefront has to be re-rendered rather than left to go
    // stale. Internal route on purpose: `/s/<slug>` is what Next serves.
    revalidatePath(`/s/${store.slug}`, "layout");

    return {
      message: settings.enabled
        ? settings.barEnabled
          ? "Free shipping is on, and shoppers can see how close they are."
          : "Free shipping is on. The progress bar is hidden."
        : "Free shipping is off. Every order pays your normal delivery rate.",
      settings,
      status: "success"
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        message: error.issues[0]?.message ?? "Those settings could not be saved.",
        status: "error"
      };
    }

    return {
      message: error instanceof Error ? error.message : "Those settings could not be saved.",
      status: "error"
    };
  }
}

/**
 * The console posts every switch as an explicit `on`/`off` hidden field, so
 * "absent" is a malformed submission rather than "unchecked" — which is what
 * lets the defaults stand in without silently switching something off.
 */
function checkboxField(formData: FormData, name: string) {
  const value = formData.get(name);

  if (value === null) {
    return FREE_SHIPPING_DEFAULTS[name as keyof FreeShippingSettings] === true;
  }

  return value === "on" || value === "true";
}

function textField(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

/**
 * A comma-separated field, left exactly as submitted.
 *
 * Unknown values are not filtered out here, so the schema refuses the whole save
 * rather than quietly storing a narrower set than the seller ticked.
 */
function listField(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
