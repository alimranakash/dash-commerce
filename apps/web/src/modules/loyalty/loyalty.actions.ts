"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import type { PlanFeatureKey } from "../billing/plan-features";
import { PlanFeatureError } from "../billing/subscription-limits";
import { requireStoreManager, StoreAccessError } from "../stores/queries";
import { LoyaltyError } from "./loyalty.rules";
import type { LoyaltySettings } from "./loyalty.schema";
import {
  adjustLoyaltyPoints,
  getLoyaltyCapability,
  resolveLoyaltyConflict,
  saveLoyaltySettings,
  setLoyaltyMembershipSuspended,
  type LoyaltyCapability
} from "./loyalty.service";

/**
 * Every loyalty write a seller can make: the programme's settings, manual
 * adjustments, suspending and resuming a membership, and resolving an
 * enrolment conflict.
 *
 * All of them `requireStoreManager()`: how many points a sale is worth, and
 * whose balance moves by hand, are promises the shop makes to its customers —
 * the same class of decision as a payment method. A MEMBER may read the
 * members pages, not change them.
 *
 * The store and the acting person are the session's. Nothing posted can name a
 * store, a user or a balance: a form names at most a member or conflict id,
 * which the service re-checks against the session's store. The plan checks
 * live in the service, so they hold for any caller, and a refusal comes back
 * as `lockedFeature` for the shared upgrade dialog.
 */
export type LoyaltySettingsState = {
  /** Recomputed on the server so the page cannot disagree with what it saved. */
  capability?: LoyaltyCapability;
  fieldErrors?: Record<string, string>;
  /** Set when the plan refused the save, so the form opens the upgrade dialog. */
  lockedFeature?: PlanFeatureKey;
  message?: string;
  /** The saved settings, so the form re-renders from the server's word for it. */
  settings?: LoyaltySettings;
  status: "error" | "idle" | "saved";
};

export async function saveLoyaltySettingsAction(
  _state: LoyaltySettingsState,
  formData: FormData
): Promise<LoyaltySettingsState> {
  let storeId: string;

  // Outside the try below: the guard redirects a visitor with no store, and a
  // redirect is a thrown signal that must reach Next rather than be reported
  // as a failed save.
  try {
    storeId = (await requireStoreManager()).store.id;
  } catch (error) {
    if (error instanceof StoreAccessError) {
      return { message: error.message, status: "error" };
    }

    throw error;
  }

  try {
    const settings = await saveLoyaltySettings(storeId, {
      amountPerPoint: String(formData.get("amountPerPoint") ?? ""),
      // The boxes are always rendered, so nothing posted can only mean off.
      enabled: formData.get("enabled") === "on",
      maxRedeemPercent: String(formData.get("maxRedeemPercent") ?? ""),
      minRedeemPoints: String(formData.get("minRedeemPoints") ?? ""),
      pointValue: String(formData.get("pointValue") ?? ""),
      programName: String(formData.get("programName") ?? ""),
      redemptionEnabled: formData.get("redemptionEnabled") === "on"
    });
    const capability = await getLoyaltyCapability(storeId, settings);

    revalidatePath("/dashboard/marketing/loyalty");

    return {
      capability,
      message: capability.live ? "Loyalty settings saved." : "Saved. The programme is switched off.",
      settings,
      status: "saved"
    };
  } catch (error) {
    if (error instanceof PlanFeatureError) {
      return { lockedFeature: error.featureKey, message: error.message, status: "error" };
    }

    if (error instanceof ZodError) {
      return {
        fieldErrors: Object.fromEntries(
          error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])
        ),
        message: "Please fix the highlighted fields.",
        status: "error"
      };
    }

    return {
      message: error instanceof Error ? error.message : "Those settings could not be saved.",
      status: "error"
    };
  }
}

/** What the members pages' forms are told back. */
export type LoyaltyMemberActionState = {
  /** The balance the adjustment left, read from the committed ledger row. */
  balance?: number;
  fieldErrors?: Record<string, string>;
  /** Set when the plan refused, so the form opens the upgrade dialog. */
  lockedFeature?: PlanFeatureKey;
  memberStatus?: "ACTIVE" | "SUSPENDED";
  message?: string;
  /**
   * A fresh key for the next adjustment. Handed out only once the last one has
   * landed (or been refused for using a spent key), so a resubmitted form
   * carries the old key and is recognised as the same adjustment.
   */
  nextRequestId?: string;
  status: "error" | "idle" | "saved";
};

/**
 * The store and the acting person, both from the session. A member is told
 * why they cannot; a visitor with no store is redirected, which is a thrown
 * signal Next must receive rather than a failure to report.
 */
async function managerContext(): Promise<{ storeId: string; userId: string } | { error: string }> {
  try {
    const access = await requireStoreManager();

    return access.userId
      ? { storeId: access.store.id, userId: access.userId }
      : { error: "Sign in again to make this change." };
  } catch (error) {
    if (error instanceof StoreAccessError) {
      return { error: error.message };
    }

    throw error;
  }
}

export async function adjustLoyaltyPointsAction(
  _state: LoyaltyMemberActionState,
  formData: FormData
): Promise<LoyaltyMemberActionState> {
  const context = await managerContext();

  if ("error" in context) {
    return { message: context.error, status: "error" };
  }

  try {
    const { applied, transaction } = await adjustLoyaltyPoints(context.storeId, context.userId, {
      memberId: String(formData.get("memberId") ?? ""),
      points: String(formData.get("points") ?? ""),
      reason: String(formData.get("reason") ?? ""),
      requestId: String(formData.get("requestId") ?? "")
    });

    revalidateMemberPaths(transaction.memberId);

    return applied
      ? {
          balance: transaction.balanceAfter,
          message: `Adjustment recorded. The balance is now ${transaction.balanceAfter.toLocaleString("en")} points.`,
          nextRequestId: randomUUID(),
          status: "saved"
        }
      : {
          message: "That adjustment was already recorded; it was not applied twice.",
          nextRequestId: randomUUID(),
          status: "saved"
        };
  } catch (error) {
    return memberActionError(error);
  }
}

export async function setLoyaltyMemberSuspendedAction(
  _state: LoyaltyMemberActionState,
  formData: FormData
): Promise<LoyaltyMemberActionState> {
  const context = await managerContext();

  if ("error" in context) {
    return { message: context.error, status: "error" };
  }

  const intent = formData.get("intent");

  if (intent !== "suspend" && intent !== "resume") {
    return { message: "Choose whether to suspend or resume the membership.", status: "error" };
  }

  try {
    const memberId = String(formData.get("memberId") ?? "");
    const result = await setLoyaltyMembershipSuspended(
      context.storeId,
      context.userId,
      memberId,
      intent === "suspend"
    );

    revalidateMemberPaths(memberId);

    return {
      memberStatus: result.status,
      message: result.changed
        ? intent === "suspend"
          ? "Membership suspended. The balance and history are unchanged."
          : "Membership resumed."
        : `Nothing changed: the membership was already ${result.status === "SUSPENDED" ? "suspended" : "active"}.`,
      status: "saved"
    };
  } catch (error) {
    return memberActionError(error);
  }
}

export async function resolveLoyaltyConflictAction(
  _state: LoyaltyMemberActionState,
  formData: FormData
): Promise<LoyaltyMemberActionState> {
  const context = await managerContext();

  if ("error" in context) {
    return { message: context.error, status: "error" };
  }

  try {
    const result = await resolveLoyaltyConflict(
      context.storeId,
      context.userId,
      String(formData.get("conflictId") ?? "")
    );

    revalidatePath("/dashboard/marketing/loyalty/conflicts");
    revalidatePath("/dashboard/marketing/loyalty/members");

    return {
      message: result.changed ? "Marked resolved." : "It was already resolved.",
      status: "saved"
    };
  } catch (error) {
    return memberActionError(error);
  }
}

function revalidateMemberPaths(memberId: string) {
  revalidatePath("/dashboard/marketing/loyalty/members");
  revalidatePath(`/dashboard/marketing/loyalty/members/${memberId}`);
}

function memberActionError(error: unknown): LoyaltyMemberActionState {
  if (error instanceof PlanFeatureError) {
    return { lockedFeature: error.featureKey, message: error.message, status: "error" };
  }

  if (error instanceof ZodError) {
    return {
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])
      ),
      message: error.issues[0]?.message ?? "Please check the form.",
      status: "error"
    };
  }

  if (error instanceof LoyaltyError) {
    if (error.code === "INSUFFICIENT_POINTS") {
      return {
        message: "That would take the balance below zero. Deduct no more than the member holds.",
        status: "error"
      };
    }

    if (error.code === "IDEMPOTENCY_CONFLICT") {
      return {
        message: "This form was already used for a different adjustment. Try again.",
        nextRequestId: randomUUID(),
        status: "error"
      };
    }

    return { message: error.message, status: "error" };
  }

  return {
    message: error instanceof Error ? error.message : "That could not be saved.",
    status: "error"
  };
}
