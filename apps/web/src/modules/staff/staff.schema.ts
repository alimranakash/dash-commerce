import { z } from "zod";

/**
 * Roles an invite or a role change may name. `OWNER` is deliberately absent from
 * both: ownership is established at onboarding and transferring it is a separate
 * decision with its own consequences (billing, the last-owner guard), not
 * something a role dropdown should be able to do by accident.
 */
export const ASSIGNABLE_STAFF_ROLES = ["ADMIN", "MEMBER"] as const;

export type AssignableStaffRole = (typeof ASSIGNABLE_STAFF_ROLES)[number];
export type OrganizationRole = "OWNER" | AssignableStaffRole;

const assignableRoleSchema = z.enum(ASSIGNABLE_STAFF_ROLES);

/**
 * Emails are stored lowercase and trimmed because acceptance compares the
 * invite's address against the signed-in account's, and `Owner@shop.com` and
 * `owner@shop.com` are the same person.
 */
const staffEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter an email address.")
  .max(320, "That email address is too long.")
  .pipe(z.email("Enter a valid email address."));

export const inviteStaffSchema = z.object({
  email: staffEmailSchema,
  role: assignableRoleSchema
});

export const staffInviteRefSchema = z.object({
  inviteId: z.string().trim().min(1, "Select an invite.")
});

export const staffMemberRefSchema = z.object({
  memberId: z.string().trim().min(1, "Select a team member.")
});

export const changeStaffRoleSchema = staffMemberRefSchema.extend({
  role: assignableRoleSchema
});

export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;
export type StaffInviteRefInput = z.infer<typeof staffInviteRefSchema>;
export type StaffMemberRefInput = z.infer<typeof staffMemberRefSchema>;
export type ChangeStaffRoleInput = z.infer<typeof changeStaffRoleSchema>;

/** One row of the member list. */
export type StaffMemberView = {
  /** False for the viewer's own row and for a member they outrank no further. */
  canChangeRole: boolean;
  canRemove: boolean;
  /** Null for an account that signed up with a phone number instead. */
  email: string | null;
  id: string;
  isSelf: boolean;
  joinedAt: Date;
  name: string | null;
  phone: string | null;
  role: OrganizationRole;
};

/** One row of the pending-invite list. */
export type StaffInviteView = {
  createdAt: Date;
  email: string;
  expiresAt: Date;
  id: string;
  invitedByName: string | null;
  role: AssignableStaffRole;
};

/**
 * Seats the plan grants and how many are spoken for. `limit: null` means the
 * plan is unlimited — the `0 = unlimited` convention every other plan limit
 * uses, resolved here so no caller has to remember it.
 */
export type StaffSeatUsage = {
  limit: number | null;
  members: number;
  pendingInvites: number;
  /** Seats left, or `null` when unlimited. Never negative. */
  remaining: number | null;
  used: number;
};

export type TeamView = {
  /** False when seats are full, the plan grants none, or billing is missing. */
  canInvite: boolean;
  invites: StaffInviteView[];
  members: StaffMemberView[];
  /** Set when the org is already over its seat allowance after a downgrade. */
  overLimitBy: number;
  seats: StaffSeatUsage;
};
