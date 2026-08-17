"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireUser } from "../../lib/auth";
import { StoreAccessError, requireStoreManager } from "../stores/queries";
import {
  StaffError,
  StaffInviteError,
  acceptStaffInvite,
  changeStaffRole,
  inviteStaff,
  removeStaffMember,
  revokeStaffInviteForOrganization
} from "./staff.service";
import type { AssignableStaffRole, OrganizationRole } from "./staff.schema";

export type StaffActionState = {
  fieldErrors?: Record<string, string>;
  /**
   * Set only by a successful invite. `path` is relative because the raw token
   * exists for one render and the browser already knows which host it is on —
   * building the absolute link there beats threading the app hostname through
   * the server for a value that is correct by construction.
   */
  invite?: {
    email: string;
    path: string;
    role: AssignableStaffRole;
  };
  message?: string;
  status: "error" | "idle" | "success";
};

export async function inviteStaffAction(
  _state: StaffActionState,
  formData: FormData
): Promise<StaffActionState> {
  try {
    // Re-checked here rather than trusted from the page: the member view renders
    // the form disabled, and a disabled input is not a permission check.
    const scope = await staffScope();
    const { invite, token } = await inviteStaff(scope, {
      email: text(formData, "email"),
      role: text(formData, "role")
    });

    revalidateTeam();

    return {
      invite: {
        email: invite.email,
        path: `/invite/${token}`,
        role: invite.role as AssignableStaffRole
      },
      message: `Invite ready for ${invite.email}. Copy the link below and send it to them.`,
      status: "success"
    };
  } catch (error) {
    return toErrorState(error, "Could not create that invite.");
  }
}

export async function revokeStaffInviteAction(
  _state: StaffActionState,
  formData: FormData
): Promise<StaffActionState> {
  try {
    const scope = await staffScope();

    await revokeStaffInviteForOrganization(scope, { inviteId: text(formData, "inviteId") });
    revalidateTeam();

    return { message: "Invite revoked. That link no longer works.", status: "success" };
  } catch (error) {
    return toErrorState(error, "Could not revoke that invite.");
  }
}

export async function changeStaffRoleAction(
  _state: StaffActionState,
  formData: FormData
): Promise<StaffActionState> {
  try {
    const scope = await staffScope();

    await changeStaffRole(scope, {
      memberId: text(formData, "memberId"),
      role: text(formData, "role")
    });
    revalidateTeam();

    return { message: "Role updated.", status: "success" };
  } catch (error) {
    return toErrorState(error, "Could not change that role.");
  }
}

export async function removeStaffMemberAction(
  _state: StaffActionState,
  formData: FormData
): Promise<StaffActionState> {
  try {
    const scope = await staffScope();

    await removeStaffMember(scope, { memberId: text(formData, "memberId") });
    revalidateTeam();

    return { message: "Removed from the team. Their seat is free again.", status: "success" };
  } catch (error) {
    return toErrorState(error, "Could not remove that team member.");
  }
}

/**
 * Redeems an invite for the signed-in account.
 *
 * The only staff action not gated by `requireStoreManager` — by definition the
 * person accepting is not yet in the organization. `acceptStaffInvite` does the
 * gating instead: it re-checks the token, the email match and the seat count
 * inside the transaction that creates the membership.
 */
export async function acceptStaffInviteAction(
  _state: StaffActionState,
  formData: FormData
): Promise<StaffActionState> {
  // Outside the try: this redirects a signed-out visitor to /login, and a
  // redirect signals by throwing.
  const user = await requireUser();

  try {
    await acceptStaffInvite(text(formData, "token"), { email: user.email, id: user.id });
  } catch (error) {
    return toErrorState(error, "Could not accept this invite.");
  }

  // Also outside the try, for the same reason — catching the redirect here would
  // turn a successful join into an error message.
  redirect("/dashboard");
}

/**
 * The manager check and the organization scope in one place, so no action can
 * accidentally run without either.
 *
 * Platform admins are not bypassed. These actions only exist on the seller
 * dashboard, which always resolves the signed-in user's own organization, so
 * there is nothing for a bypass to unlock — and the platform owner is a seller
 * on their own store like anyone else.
 */
async function staffScope(): Promise<{
  organizationId: string;
  role: OrganizationRole;
  userId: string;
}> {
  const access = await requireStoreManager();

  if (!access.organizationId || !access.userId) {
    throw new StaffError("Sign in again to manage your team.");
  }

  return {
    organizationId: access.organizationId,
    role: access.role as OrganizationRole,
    userId: access.userId
  };
}

function revalidateTeam() {
  revalidatePath("/dashboard/settings/team");
}

function toErrorState(error: unknown, fallback: string): StaffActionState {
  if (error instanceof StaffError) {
    return { fieldErrors: error.fieldErrors, message: error.message, status: "error" };
  }

  // Raised when an invite is revoked, expires, or loses the last seat between
  // the page rendering and the button being pressed. Its message already says
  // which of those happened.
  if (error instanceof StaffInviteError) {
    return { message: error.message, status: "error" };
  }

  if (error instanceof StoreAccessError) {
    return { message: error.message, status: "error" };
  }

  // Bad email, missing role — the schema's own wording is what the seller needs.
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};

    for (const issue of error.issues) {
      const field = issue.path[0];

      if (typeof field === "string" && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }

    return {
      fieldErrors,
      message: Object.values(fieldErrors)[0] ?? fallback,
      status: "error"
    };
  }

  return { message: error instanceof Error ? error.message : fallback, status: "error" };
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}
