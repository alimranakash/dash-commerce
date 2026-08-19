import type { Prisma } from "@dash/db";
import { canAddStaffSeat, getStaffSeatUsage } from "../billing/subscription-limits";
import {
  acceptStaffInviteTransaction,
  countOrganizationOwners,
  createStaffInvite,
  deleteOrganizationMember,
  findMembershipByEmail,
  findOrganizationMemberById,
  findPendingStaffInviteByEmail,
  findStaffInviteByTokenHash,
  findUserMembership,
  listOrganizationMembers,
  listPendingStaffInvites,
  revokeStaffInvite,
  updateOrganizationMemberRole
} from "./staff.repository";
import { createStaffInviteToken, getStaffInviteExpiry, hashStaffInviteToken } from "./staff-token";
import {
  changeStaffRoleSchema,
  inviteStaffSchema,
  staffInviteRefSchema,
  staffMemberRefSchema,
  type AssignableStaffRole,
  type OrganizationRole,
  type StaffInviteView,
  type StaffMemberView,
  type TeamView
} from "./staff.schema";

/**
 * Every rejection a seller can cause. Carries `fieldErrors` in the shape the
 * dashboard forms already render, following `DomainError`.
 */
export class StaffError extends Error {
  fieldErrors: Record<string, string>;

  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "StaffError";
    this.fieldErrors = fieldErrors;
  }
}

/** Why an invite link cannot be used, for the accept page to render. */
export type StaffInviteProblem =
  | "already_accepted"
  | "already_in_organization"
  | "expired"
  | "not_found"
  | "revoked"
  | "seats_full"
  | "wrong_email";

export class StaffInviteError extends Error {
  readonly problem: StaffInviteProblem;

  constructor(problem: StaffInviteProblem, message: string) {
    super(message);
    this.name = "StaffInviteError";
    this.problem = problem;
  }
}

type ActorScope = {
  organizationId: string;
  /** The acting member's org role, from `getStoreAccess()`. */
  role: OrganizationRole;
  userId: string;
};

/**
 * Whether `actor` outranks `target`. OWNER outranks everyone; ADMIN outranks
 * only MEMBER. Used for both role changes and removals so the two cannot drift
 * apart — an ADMIN who could not demote an OWNER but could remove one would be
 * the same hole twice.
 */
function outranks(actor: OrganizationRole, target: OrganizationRole) {
  if (actor === "OWNER") {
    return target !== "OWNER";
  }

  return actor === "ADMIN" && target === "MEMBER";
}

export async function getTeamView(scope: {
  organizationId: string;
  role: OrganizationRole;
  userId: string;
}): Promise<TeamView> {
  const [members, invites, seats, ownerCount] = await Promise.all([
    listOrganizationMembers(scope.organizationId),
    listPendingStaffInvites(scope.organizationId),
    getStaffSeatUsage(scope.organizationId),
    countOrganizationOwners(scope.organizationId)
  ]);

  const memberViews: StaffMemberView[] = members.map((member) => {
    const role = member.role as OrganizationRole;
    const isSelf = member.user.id === scope.userId;
    // The last OWNER is frozen: demoting or removing them would leave the
    // organization — and its store, billing and domains — with nobody able to
    // manage it, and nothing else in the app can undo that.
    const isLastOwner = role === "OWNER" && ownerCount <= 1;
    const manageable = !isSelf && !isLastOwner && outranks(scope.role, role);

    return {
      canChangeRole: manageable,
      canRemove: manageable,
      email: member.user.email,
      id: member.id,
      isSelf,
      joinedAt: member.createdAt,
      name: member.user.name,
      phone: member.user.phone,
      role
    };
  });

  const inviteViews: StaffInviteView[] = invites.map((invite) => ({
    createdAt: invite.createdAt,
    email: invite.email,
    expiresAt: invite.expiresAt,
    id: invite.id,
    invitedByName: invite.invitedBy.name ?? invite.invitedBy.email,
    role: invite.role as AssignableStaffRole
  }));

  return {
    canInvite: seats.remaining === null || seats.remaining > 0,
    invites: inviteViews,
    members: memberViews,
    // A downgrade never removes anyone, so a plan can end up smaller than the
    // team already on it. The page says so rather than pretending it fits.
    overLimitBy: seats.limit === null ? 0 : Math.max(0, seats.used - seats.limit),
    seats
  };
}

/**
 * Creates an invite and returns the raw token alongside it. That token is the
 * only copy — it is not stored and cannot be recovered — so the caller has to
 * show it to the seller immediately.
 */
export async function inviteStaff(scope: ActorScope, input: unknown) {
  const data = inviteStaffSchema.parse(input);

  const existingMember = await findMembershipByEmail({
    email: data.email,
    organizationId: scope.organizationId
  });

  if (existingMember) {
    throw new StaffError("That person is already on your team.", {
      email: "That person is already on your team."
    });
  }

  const existingInvite = await findPendingStaffInviteByEmail({
    email: data.email,
    organizationId: scope.organizationId
  });

  if (existingInvite) {
    throw new StaffError("An invite is already pending for that email.", {
      email: "An invite is already pending for that email. Revoke it first to send a new one."
    });
  }

  // Checked last so the seller sees the specific problem — already a member,
  // already invited — before the generic seat message.
  if (!(await canAddStaffSeat(scope.organizationId))) {
    throw new StaffError(
      "Your plan has no staff seats left. Upgrade from Billing to add more people."
    );
  }

  const { token, tokenHash } = createStaffInviteToken();
  const invite = await createStaffInvite({
    email: data.email,
    expiresAt: getStaffInviteExpiry(),
    invitedById: scope.userId,
    organizationId: scope.organizationId,
    role: data.role,
    tokenHash
  });

  return {
    invite,
    token
  };
}

export async function revokeStaffInviteForOrganization(scope: ActorScope, input: unknown) {
  const data = staffInviteRefSchema.parse(input);
  const result = await revokeStaffInvite({
    inviteId: data.inviteId,
    organizationId: scope.organizationId
  });

  if (result.count === 0) {
    throw new StaffError("That invite has already been used or revoked.");
  }
}

/**
 * Reads an invite by the token from the link, without consuming it. The accept
 * page calls this to render "join {org} as {role}" before the person commits,
 * and to explain a dead link precisely.
 *
 * `viewer` is the signed-in account, or `null` when nobody is signed in yet —
 * in which case the email and membership checks are skipped, because the page's
 * job is then to send them to sign in, not to reject them.
 */
export async function describeStaffInvite(
  token: string,
  viewer: { email: string | null | undefined; id: string } | null
) {
  const invite = await findStaffInviteByTokenHash(hashStaffInviteToken(token));

  if (!invite) {
    throw new StaffInviteError("not_found", "This invite link is not valid.");
  }

  const details = {
    email: invite.email,
    id: invite.id,
    organizationId: invite.organizationId,
    organizationName: invite.organization.name,
    role: invite.role as AssignableStaffRole
  };

  if (invite.revokedAt) {
    throw new StaffInviteError("revoked", "This invite has been revoked.");
  }

  if (invite.acceptedAt) {
    throw new StaffInviteError("already_accepted", "This invite has already been used.");
  }

  if (invite.expiresAt.getTime() <= Date.now()) {
    throw new StaffInviteError("expired", "This invite has expired. Ask for a new link.");
  }

  if (!viewer) {
    return details;
  }

  assertInviteMatchesViewer(invite.email, viewer.email);

  if (await findUserMembership(viewer.id)) {
    throw new StaffInviteError(
      "already_in_organization",
      "This account already belongs to a store. Sign in with the invited email instead."
    );
  }

  return details;
}

/**
 * Redeems an invite. Re-runs every check `describeStaffInvite` makes, because
 * the gap between rendering the page and clicking the button is unbounded — the
 * invite can be revoked and the last seat taken in the meantime.
 */
export async function acceptStaffInvite(
  token: string,
  viewer: { email: string | null | undefined; id: string }
) {
  const invite = await describeStaffInvite(token, viewer);
  const membership = await acceptStaffInviteTransaction({
    assertSeatAvailable: async (tx: Prisma.TransactionClient) => {
      if (!(await canAddStaffSeat(invite.organizationId, tx))) {
        throw new StaffInviteError(
          "seats_full",
          "This store has no staff seats left. Ask the owner to upgrade their plan."
        );
      }
    },
    inviteId: invite.id,
    organizationId: invite.organizationId,
    role: invite.role,
    userId: viewer.id
  });

  if (!membership) {
    throw new StaffInviteError("already_accepted", "This invite has already been used.");
  }

  return {
    organizationId: invite.organizationId,
    organizationName: invite.organizationName,
    role: invite.role
  };
}

export async function changeStaffRole(scope: ActorScope, input: unknown) {
  const data = changeStaffRoleSchema.parse(input);
  const member = await requireManageableMember(scope, data.memberId);

  if (member.role === data.role) {
    return;
  }

  await updateOrganizationMemberRole({
    memberId: member.id,
    organizationId: scope.organizationId,
    role: data.role
  });
}

export async function removeStaffMember(scope: ActorScope, input: unknown) {
  const data = staffMemberRefSchema.parse(input);
  const member = await requireManageableMember(scope, data.memberId);

  await deleteOrganizationMember({
    memberId: member.id,
    organizationId: scope.organizationId
  });
}

/**
 * The shared gate for both member writes. Mirrors the flags `getTeamView` sets
 * on each row — the page disables the controls, and this re-decides the same
 * question on the server, because a disabled button is not a permission check.
 */
async function requireManageableMember(scope: ActorScope, memberId: string) {
  const member = await findOrganizationMemberById({
    memberId,
    organizationId: scope.organizationId
  });

  if (!member) {
    throw new StaffError("That team member is no longer on your team.");
  }

  if (member.userId === scope.userId) {
    throw new StaffError("You cannot change your own role or remove yourself.");
  }

  const targetRole = member.role as OrganizationRole;

  if (!outranks(scope.role, targetRole)) {
    throw new StaffError("You do not have permission to manage that team member.");
  }

  if (targetRole === "OWNER" && (await countOrganizationOwners(scope.organizationId)) <= 1) {
    throw new StaffError("A store must always have one owner.");
  }

  return member;
}

/**
 * An invite is bound to the address it was sent to. Without this, a link
 * forwarded to a group chat would let whoever opens it first join the store.
 */
function assertInviteMatchesViewer(inviteEmail: string, viewerEmail: string | null | undefined) {
  // Invites are keyed by email, and an account that signed up with a phone
  // number has none yet. That is fixable from their own profile, so say so
  // rather than leaving them at a door with no handle.
  if (!viewerEmail) {
    throw new StaffInviteError(
      "wrong_email",
      `This invite was sent to ${inviteEmail}, and your account has no email address on it yet. Add ${inviteEmail} to your account under Profile, then open this link again.`
    );
  }

  if (viewerEmail.trim().toLowerCase() !== inviteEmail) {
    throw new StaffInviteError(
      "wrong_email",
      `This invite was sent to ${inviteEmail}. Sign in with that account to accept it.`
    );
  }
}
