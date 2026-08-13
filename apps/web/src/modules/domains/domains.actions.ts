"use server";

import { revalidatePath } from "next/cache";
import { StoreAccessError, requireStoreManager } from "../stores/queries";
import {
  DomainError,
  addCustomDomain,
  removeCustomDomain,
  setPrimaryDomain,
  verifyCustomDomain
} from "./domains.service";

export type DomainActionState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "error" | "idle" | "success";
};

export async function addCustomDomainAction(
  _state: DomainActionState,
  formData: FormData
): Promise<DomainActionState> {
  try {
    // Re-checked here on purpose: the page renders a read-only view for members,
    // but a disabled input is not a permission check.
    const access = await requireStoreManager();
    const result = await addCustomDomain(scopeFrom(access), {
      addSibling: checkbox(formData, "addSibling"),
      domain: text(formData, "domain")
    });

    revalidateDomains();

    return {
      message: result.skipped.length
        ? `${result.created.join(" and ")} added. Add ${result.skipped.join(", ")} separately — it is already in use or not a valid pair.`
        : `${result.created.join(" and ")} added. Point your DNS at us, then verify.`,
      status: "success"
    };
  } catch (error) {
    return toErrorState(error, "Could not add that domain.");
  }
}

export async function removeCustomDomainAction(
  _state: DomainActionState,
  formData: FormData
): Promise<DomainActionState> {
  try {
    const access = await requireStoreManager();
    const result = await removeCustomDomain(scopeFrom(access), {
      domainId: text(formData, "domainId")
    });

    revalidateDomains();

    return { message: `${result.removed} removed.`, status: "success" };
  } catch (error) {
    return toErrorState(error, "Could not remove that domain.");
  }
}

/**
 * Runs the DNS check. Reports the outcome as `success` only when the domain
 * really points here — the other statuses are things the seller has to act on, so
 * they surface as errors even though the check itself worked.
 */
export async function verifyCustomDomainAction(
  _state: DomainActionState,
  formData: FormData
): Promise<DomainActionState> {
  try {
    const access = await requireStoreManager();
    const { check } = await verifyCustomDomain(scopeFrom(access), {
      domainId: text(formData, "domainId")
    });

    revalidateDomains();

    return {
      message: check.detail,
      status: check.status === "verified" ? "success" : "error"
    };
  } catch (error) {
    return toErrorState(error, "Could not check that domain's DNS.");
  }
}

export async function setPrimaryDomainAction(
  _state: DomainActionState,
  formData: FormData
): Promise<DomainActionState> {
  try {
    const access = await requireStoreManager();
    const result = await setPrimaryDomain(scopeFrom(access), {
      domainId: text(formData, "domainId")
    });

    revalidateDomains();

    return { message: `${result.primary} is now the primary address.`, status: "success" };
  } catch (error) {
    return toErrorState(error, "Could not change the primary domain.");
  }
}

function scopeFrom(access: Awaited<ReturnType<typeof requireStoreManager>>) {
  return {
    bypassPlanGate: access.isPlatformAdmin,
    storeId: access.store.id,
    ...(access.organizationId ? { organizationId: access.organizationId } : {}),
    ...(access.userId ? { userId: access.userId } : {})
  };
}

function revalidateDomains() {
  revalidatePath("/dashboard/settings/domains");
}

function toErrorState(error: unknown, fallback: string): DomainActionState {
  if (error instanceof StoreAccessError) {
    return { message: error.message, status: "error" };
  }

  if (error instanceof DomainError) {
    return { fieldErrors: error.fieldErrors, message: error.message, status: "error" };
  }

  return { message: error instanceof Error ? error.message : fallback, status: "error" };
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}
