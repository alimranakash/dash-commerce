import { prisma, type Prisma } from "@dash/db";
import type { AssignableStaffRole } from "./staff.schema";

/**
 * Every query here is scoped by `organizationId`, not `storeId`: staff belong to
 * the organization, and a store is one of the things an organization owns. The
 * single exception is `findUserMembership`, which asks whether a *user* is in any
 * organization at all — the question invite acceptance has to answer before it
 * can safely add a second membership.
 */

/** Accepts the global client or a transaction client, like the billing helpers. */
type StaffClient = Prisma.TransactionClient | typeof prisma;

/**
 * A pending invite: not yet accepted, not revoked, not expired. Expressed as a
 * filter rather than a status column so a clock change or a late acceptance can
 * never leave a row disagreeing with itself.
 *
 * `now` is a parameter so a single request can evaluate every invite against one
 * instant instead of drifting mid-query.
 */
export function pendingStaffInviteFilter(now = new Date()) {
  return {
    acceptedAt: null,
    expiresAt: {
      gt: now
    },
    revokedAt: null
  } satisfies Prisma.StaffInviteWhereInput;
}

export async function listOrganizationMembers(organizationId: string) {
  return prisma.organizationMember.findMany({
    orderBy: {
      createdAt: "asc"
    },
    select: {
      createdAt: true,
      id: true,
      role: true,
      user: {
        select: {
          email: true,
          id: true,
          name: true
        }
      }
    },
    where: {
      organizationId
    }
  });
}

export async function countOrganizationMembers(
  organizationId: string,
  client: StaffClient = prisma
) {
  return client.organizationMember.count({
    where: {
      organizationId
    }
  });
}

export async function findOrganizationMemberById(params: {
  memberId: string;
  organizationId: string;
}) {
  return prisma.organizationMember.findFirst({
    select: {
      id: true,
      role: true,
      user: {
        select: {
          email: true,
          id: true,
          name: true
        }
      },
      userId: true
    },
    where: {
      id: params.memberId,
      organizationId: params.organizationId
    }
  });
}

/** How many OWNERs are left — the last-owner guard's only input. */
export async function countOrganizationOwners(organizationId: string) {
  return prisma.organizationMember.count({
    where: {
      organizationId,
      role: "OWNER"
    }
  });
}

/**
 * Whether this user already belongs to an organization — any organization, not
 * just the inviting one. `getCurrentOrganization()` resolves a user's org with
 * `findFirst` ordered by `createdAt`, so a second membership would silently put
 * them in whichever they joined first. Acceptance refuses rather than create that.
 */
export async function findUserMembership(userId: string, client: StaffClient = prisma) {
  return client.organizationMember.findFirst({
    select: {
      id: true,
      organizationId: true
    },
    where: {
      userId
    }
  });
}

export async function findMembershipByEmail(params: { email: string; organizationId: string }) {
  return prisma.organizationMember.findFirst({
    select: {
      id: true
    },
    where: {
      organizationId: params.organizationId,
      user: {
        email: params.email
      }
    }
  });
}

export async function listPendingStaffInvites(organizationId: string, now = new Date()) {
  return prisma.staffInvite.findMany({
    orderBy: {
      createdAt: "desc"
    },
    select: {
      createdAt: true,
      email: true,
      expiresAt: true,
      id: true,
      invitedBy: {
        select: {
          email: true,
          name: true
        }
      },
      role: true
    },
    where: {
      ...pendingStaffInviteFilter(now),
      organizationId
    }
  });
}

export async function countPendingStaffInvites(
  organizationId: string,
  client: StaffClient = prisma,
  now = new Date()
) {
  return client.staffInvite.count({
    where: {
      ...pendingStaffInviteFilter(now),
      organizationId
    }
  });
}

export async function findPendingStaffInviteByEmail(params: {
  email: string;
  organizationId: string;
  now?: Date;
}) {
  return prisma.staffInvite.findFirst({
    select: {
      email: true,
      expiresAt: true,
      id: true
    },
    where: {
      ...pendingStaffInviteFilter(params.now),
      email: params.email,
      organizationId: params.organizationId
    }
  });
}

/**
 * Looks an invite up by the hash of the token in the link. Returns the row in
 * any state — accepted, revoked, expired — so the accept page can explain what
 * happened instead of showing one "invalid link" for four different situations.
 */
export async function findStaffInviteByTokenHash(tokenHash: string, client: StaffClient = prisma) {
  return client.staffInvite.findUnique({
    select: {
      acceptedAt: true,
      email: true,
      expiresAt: true,
      id: true,
      organization: {
        select: {
          id: true,
          name: true
        }
      },
      organizationId: true,
      revokedAt: true,
      role: true
    },
    where: {
      tokenHash
    }
  });
}

export async function createStaffInvite(data: {
  email: string;
  expiresAt: Date;
  invitedById: string;
  organizationId: string;
  role: AssignableStaffRole;
  tokenHash: string;
}) {
  return prisma.staffInvite.create({
    data,
    select: {
      createdAt: true,
      email: true,
      expiresAt: true,
      id: true,
      role: true
    }
  });
}

/**
 * `updateMany` with the organization in the filter rather than `update` by id:
 * an id from another organization matches nothing and reports zero rows, so a
 * caller cannot revoke a row it does not own even if it passes a valid id.
 */
export async function revokeStaffInvite(params: { inviteId: string; organizationId: string }) {
  return prisma.staffInvite.updateMany({
    data: {
      revokedAt: new Date()
    },
    where: {
      acceptedAt: null,
      id: params.inviteId,
      organizationId: params.organizationId,
      revokedAt: null
    }
  });
}

/**
 * Consumes an invite and creates the membership in one transaction, with the
 * seat re-check the caller supplies running inside it. Both writes land or
 * neither does, so a failed membership insert cannot burn the invite.
 *
 * The invite is marked accepted with a conditional `updateMany` — it only
 * matches a row that is still pending — so two people opening the same link at
 * once produce one membership, not two.
 */
export async function acceptStaffInviteTransaction(params: {
  assertSeatAvailable: (client: Prisma.TransactionClient) => Promise<void>;
  inviteId: string;
  organizationId: string;
  role: AssignableStaffRole;
  userId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.staffInvite.updateMany({
      data: {
        acceptedAt: new Date(),
        acceptedById: params.userId
      },
      where: {
        acceptedAt: null,
        expiresAt: {
          gt: new Date()
        },
        id: params.inviteId,
        organizationId: params.organizationId,
        revokedAt: null
      }
    });

    if (claimed.count === 0) {
      return null;
    }

    // After the claim, so the invite this membership is spending is already off
    // the pending list and cannot be double-counted against the allowance.
    await params.assertSeatAvailable(tx);

    return tx.organizationMember.create({
      data: {
        organizationId: params.organizationId,
        role: params.role,
        userId: params.userId
      },
      select: {
        id: true,
        organizationId: true,
        role: true
      }
    });
  });
}

export async function updateOrganizationMemberRole(params: {
  memberId: string;
  organizationId: string;
  role: AssignableStaffRole;
}) {
  return prisma.organizationMember.updateMany({
    data: {
      role: params.role
    },
    where: {
      id: params.memberId,
      organizationId: params.organizationId
    }
  });
}

export async function deleteOrganizationMember(params: {
  memberId: string;
  organizationId: string;
}) {
  return prisma.organizationMember.deleteMany({
    where: {
      id: params.memberId,
      organizationId: params.organizationId
    }
  });
}
