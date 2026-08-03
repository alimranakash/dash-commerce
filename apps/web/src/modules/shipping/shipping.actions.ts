"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireStore } from "../stores/queries";
import type {
  ShippingRateInput,
  ShippingSettingsInput,
  ShippingZoneInput
} from "./shipping.schema";
import { updateShippingSettings } from "./shipping.service";

export type ShippingSettingsActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function updateShippingSettingsFormAction(
  _state: ShippingSettingsActionState,
  formData: FormData
): Promise<ShippingSettingsActionState> {
  const store = await requireStore();

  try {
    await updateShippingSettings(store.id, settingsFromFormData(formData));
  } catch (error) {
    return shippingErrorState(error);
  }

  revalidatePath("/dashboard/shipping");
  revalidatePath(`/s/${store.slug}/checkout`);
  redirect("/dashboard/shipping?updated=1");
}

function settingsFromFormData(formData: FormData): ShippingSettingsInput {
  const zones = getAll(formData, "zoneId").map((id) => zoneFromFormData(formData, id));
  const deleteRateIds = getAll(formData, "deleteRateId");
  const rates = getAll(formData, "rateId")
    .filter((id) => !deleteRateIds.includes(id))
    .map((id) => rateFromFormData(formData, id));
  const newRate = newRateFromFormData(formData);

  return {
    zones,
    rates,
    deleteRateIds,
    ...(newRate ? { newRate } : {})
  };
}

function zoneFromFormData(formData: FormData, id: string): ShippingZoneInput {
  return {
    id,
    description: getValue(formData, `zone.${id}.description`),
    isEnabled: formData.get(`zone.${id}.isEnabled`) === "on",
    sortOrder: Number(getValue(formData, `zone.${id}.sortOrder`) || 0)
  };
}

function rateFromFormData(formData: FormData, id: string): ShippingRateInput {
  return {
    id,
    zoneId: getValue(formData, `rate.${id}.zoneId`),
    name: getValue(formData, `rate.${id}.name`),
    district: getValue(formData, `rate.${id}.district`),
    city: getValue(formData, `rate.${id}.city`),
    area: getValue(formData, `rate.${id}.area`),
    amount: getValue(formData, `rate.${id}.amount`),
    isEnabled: formData.get(`rate.${id}.isEnabled`) === "on",
    sortOrder: Number(getValue(formData, `rate.${id}.sortOrder`) || 0)
  };
}

function newRateFromFormData(formData: FormData): ShippingRateInput | undefined {
  const name = getValue(formData, "newRate.name");
  const amount = getValue(formData, "newRate.amount");

  if (!name && !amount) {
    return undefined;
  }

  return {
    zoneId: getValue(formData, "newRate.zoneId"),
    name,
    district: getValue(formData, "newRate.district"),
    city: getValue(formData, "newRate.city"),
    area: getValue(formData, "newRate.area"),
    amount,
    isEnabled: getAll(formData, "newRate.isEnabled").includes("on"),
    sortOrder: Number(getValue(formData, "newRate.sortOrder") || 100)
  };
}

function getAll(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => String(value).trim()).filter(Boolean);
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function shippingErrorState(error: unknown): ShippingSettingsActionState {
  if (error instanceof ZodError) {
    const fieldErrors = Object.fromEntries(
      error.issues.map((issue) => [issue.path.map(String).join("."), issue.message])
    );

    return {
      status: "error",
      // The form renders rates dynamically, so surface the concrete messages instead
      // of a generic "highlighted fields" prompt that highlights nothing.
      message: [...new Set(Object.values(fieldErrors))].join(" "),
      fieldErrors
    };
  }

  return {
    status: "error",
    message: error instanceof Error ? error.message : "Shipping settings update failed."
  };
}
