/**
 * Staff seat and invite check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * staff layer, mirroring `verify-plan-features.mts`.
 *
 * Unlike that script this one writes, because the behaviour worth proving —
 * a seat being spent, returned by a revoke, and re-checked when an invite is
 * redeemed — only exists across writes. It never touches existing data: it
 * builds one throwaway organization with its own store, subscription and users,
 * and deletes them in a `finally`. Deleting the organization cascades to the
 * store, subscription, members and invites, so a crashed run leaves at most the
 * two fixture users, which the next run removes by email before it starts.
 *
 * Covers:
 * - token minting and hashing;
 * - fail-closed seat math when a subscription is missing;
 * - the Starter allowance counting members *and* pending invites;
 * - invite rejection for a full plan, a duplicate invite and an existing member;
 * - revoking an invite returning its seat;
 * - every `describeStaffInvite` failure state;
 * - acceptance creating the membership exactly once;
 * - the role-change and removal guards.
 *
 * Run with: npm run verify:staff-seats
 */
import { prisma } from "@dash/db";
import { ensureDefaultPlans } from "../apps/web/src/modules/admin/admin-plans.repository";
import { getBillingStoreUsage } from "../apps/web/src/modules/billing/billing.repository";
import {
  canAddStaffSeat,
  getStaffSeatUsage
} from "../apps/web/src/modules/billing/subscription-limits";
import {
  createStaffInviteToken,
  hashStaffInviteToken
} from "../apps/web/src/modules/staff/staff-token";
import {
  StaffError,
  StaffInviteError,
  acceptStaffInvite,
  changeStaffRole,
  describeStaffInvite,
  getTeamView,
  inviteStaff,
  removeStaffMember,
  revokeStaffInviteForOrganization,
  type StaffInviteProblem
} from "../apps/web/src/modules/staff/staff.service";

const FIXTURE_PREFIX = "staff-seat-verify";
const OWNER_EMAIL = `${FIXTURE_PREFIX}.owner@invalid.test`;
const STAFF_EMAIL = `${FIXTURE_PREFIX}.staff@invalid.test`;

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);

  if (!passed) {
    failures += 1;
  }
}

/** Asserts the call rejects with a `StaffError`, and reports the message it gave. */
async function expectStaffError(label: string, run: () => Promise<unknown>, expectIn?: string) {
  try {
    await run();
    check(label, false, "no error thrown");
  } catch (error) {
    if (!(error instanceof StaffError)) {
      check(label, false, `threw ${(error as Error).name}: ${(error as Error).message}`);
      return;
    }

    const matches = !expectIn || error.message.toLowerCase().includes(expectIn.toLowerCase());
    check(label, matches, error.message);
  }
}

/** Asserts the call rejects with a `StaffInviteError` carrying `problem`. */
async function expectInviteProblem(
  label: string,
  run: () => Promise<unknown>,
  problem: StaffInviteProblem
) {
  try {
    await run();
    check(label, false, "no error thrown");
  } catch (error) {
    if (!(error instanceof StaffInviteError)) {
      check(label, false, `threw ${(error as Error).name}: ${(error as Error).message}`);
      return;
    }

    check(label, error.problem === problem, `${error.problem}: ${error.message}`);
  }
}

async function main() {
  console.log("=== Invite tokens ===");
  const minted = createStaffInviteToken();
  const second = createStaffInviteToken();

  check("raw token is never the stored value", minted.token !== minted.tokenHash);
  check("hash is 64 hex characters", /^[0-9a-f]{64}$/.test(minted.tokenHash), minted.tokenHash);
  check("hashing round-trips", hashStaffInviteToken(minted.token) === minted.tokenHash);
  check("two mints differ", minted.token !== second.token);

  await ensureDefaultPlans();

  const starterPlan = await prisma.plan.findUnique({
    select: { id: true, staffLimit: true },
    where: { slug: "starter" }
  });

  if (!starterPlan) {
    check("starter plan exists", false, "run npm run db:backfill-plans");
    return;
  }

  check(
    "starter grants 2 seats",
    starterPlan.staffLimit === 2,
    `staffLimit=${starterPlan.staffLimit}`
  );

  // Left over from a crashed run, if any. Membership rows cascade with the org,
  // so only the users can survive.
  await prisma.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, STAFF_EMAIL] } } });

  const owner = await prisma.user.create({
    data: { email: OWNER_EMAIL, name: "Seat Check Owner" },
    select: { email: true, id: true }
  });
  const staff = await prisma.user.create({
    data: { email: STAFF_EMAIL, name: "Seat Check Staff" },
    select: { email: true, id: true }
  });
  const organization = await prisma.organization.create({
    data: {
      members: { create: { role: "OWNER", userId: owner.id } },
      name: "Seat Check Workspace",
      slug: `${FIXTURE_PREFIX}-${Date.now()}`
    },
    select: { id: true }
  });
  const scope = { organizationId: organization.id, role: "OWNER" as const, userId: owner.id };

  try {
    console.log("\n=== Fail-closed without a subscription ===");
    const unbilled = await getStaffSeatUsage(organization.id);

    check("limit is 0", unbilled.limit === 0, JSON.stringify(unbilled));
    check("no seat available", (await canAddStaffSeat(organization.id)) === false);
    await expectStaffError(
      "invite is refused",
      () => inviteStaff(scope, { email: "someone@invalid.test", role: "MEMBER" }),
      "no staff seats left"
    );

    const store = await prisma.store.create({
      data: {
        name: "Seat Check Store",
        organizationId: organization.id,
        slug: `${FIXTURE_PREFIX}-store-${Date.now()}`
      },
      select: { id: true }
    });

    await prisma.subscription.create({
      data: {
        organizationId: organization.id,
        planId: starterPlan.id,
        status: "ACTIVE",
        storeId: store.id
      }
    });

    console.log("\n=== Starter allowance (2 seats, 1 owner) ===");
    const start = await getStaffSeatUsage(organization.id);

    check("limit is 2", start.limit === 2, JSON.stringify(start));
    check("owner counts as a seat", start.members === 1 && start.used === 1);
    check("one seat remains", start.remaining === 1);

    const first = await inviteStaff(scope, { email: STAFF_EMAIL, role: "MEMBER" });

    check("invite created", Boolean(first.invite.id) && first.token.length > 20);

    const afterInvite = await getStaffSeatUsage(organization.id);

    check(
      "pending invite spends the seat",
      afterInvite.pendingInvites === 1 && afterInvite.used === 2 && afterInvite.remaining === 0,
      JSON.stringify(afterInvite)
    );

    await expectStaffError(
      "second invite is refused when full",
      () => inviteStaff(scope, { email: "another@invalid.test", role: "MEMBER" }),
      "no staff seats left"
    );
    await expectStaffError(
      "duplicate invite is named as a duplicate, not a seat problem",
      () => inviteStaff(scope, { email: STAFF_EMAIL, role: "ADMIN" }),
      "already pending"
    );
    await expectStaffError(
      "inviting an existing member is refused",
      () => inviteStaff(scope, { email: OWNER_EMAIL, role: "MEMBER" }),
      "already on your team"
    );

    console.log("\n=== Revoking returns the seat ===");
    await revokeStaffInviteForOrganization(scope, { inviteId: first.invite.id });

    const afterRevoke = await getStaffSeatUsage(organization.id);

    check(
      "seat is back",
      afterRevoke.pendingInvites === 0 && afterRevoke.remaining === 1,
      JSON.stringify(afterRevoke)
    );
    await expectInviteProblem(
      "revoked link reports itself revoked",
      () => describeStaffInvite(first.token, null),
      "revoked"
    );
    await expectStaffError(
      "revoking twice is refused",
      () => revokeStaffInviteForOrganization(scope, { inviteId: first.invite.id }),
      "already been used or revoked"
    );

    console.log("\n=== Reading an invite link ===");
    const live = await inviteStaff(scope, { email: STAFF_EMAIL, role: "MEMBER" });
    const described = await describeStaffInvite(live.token, null);

    check(
      "signed-out visitor sees who invited them",
      described.organizationName === "Seat Check Workspace" && described.role === "MEMBER",
      JSON.stringify(described)
    );
    await expectInviteProblem(
      "unknown token is not found",
      () => describeStaffInvite("not-a-real-token", null),
      "not_found"
    );
    await expectInviteProblem(
      "wrong signed-in account is refused",
      () => describeStaffInvite(live.token, { email: OWNER_EMAIL, id: owner.id }),
      "wrong_email"
    );
    // Right email, but the account behind it already owns a workspace — the
    // membership check has to fire even when the address matches.
    await expectInviteProblem(
      "an account that already has a store is refused",
      () => describeStaffInvite(live.token, { email: STAFF_EMAIL, id: owner.id }),
      "already_in_organization"
    );

    const expired = createStaffInviteToken();

    await prisma.staffInvite.create({
      data: {
        email: STAFF_EMAIL,
        expiresAt: new Date(Date.now() - 60_000),
        invitedById: owner.id,
        organizationId: organization.id,
        role: "MEMBER",
        tokenHash: expired.tokenHash
      }
    });
    await expectInviteProblem(
      "expired link reports itself expired",
      () => describeStaffInvite(expired.token, null),
      "expired"
    );

    const expiredUsage = await getStaffSeatUsage(organization.id);

    check(
      "an expired invite holds no seat",
      expiredUsage.pendingInvites === 1,
      JSON.stringify(expiredUsage)
    );

    console.log("\n=== Accepting ===");
    const accepted = await acceptStaffInvite(live.token, staff);

    check(
      "membership created with the invited role",
      accepted.organizationId === organization.id && accepted.role === "MEMBER",
      JSON.stringify(accepted)
    );

    const afterAccept = await getStaffSeatUsage(organization.id);

    check(
      "seat moves from invite to member",
      afterAccept.members === 2 && afterAccept.pendingInvites === 0 && afterAccept.used === 2,
      JSON.stringify(afterAccept)
    );
    await expectInviteProblem(
      "the same link cannot be used twice",
      () => acceptStaffInvite(live.token, staff),
      "already_accepted"
    );
    await expectStaffError(
      "the team is full again",
      () => inviteStaff(scope, { email: "third@invalid.test", role: "MEMBER" }),
      "no staff seats left"
    );

    console.log("\n=== Billing usage agrees with the team page ===");
    const usage = await getBillingStoreUsage({
      organizationId: organization.id,
      storeId: store.id
    });
    const teamNow = await getTeamView(scope);

    check(
      "billing staff count matches the team page",
      usage.staff === teamNow.seats.used,
      `billing=${usage.staff}, team=${teamNow.seats.used}`
    );
    check(
      "the hard-coded 1 is gone",
      usage.staff === 2,
      `two members on the team, billing reports ${usage.staff}`
    );
    check(
      "the seat breakdown travels with it",
      usage.staffSeats.members === 2 && usage.staffSeats.limit === 2,
      JSON.stringify(usage.staffSeats)
    );

    console.log("\n=== Downgrading never removes anyone ===");
    const freePlan = await prisma.plan.findUnique({
      select: { id: true, staffLimit: true },
      where: { slug: "free" }
    });

    if (!freePlan) {
      check("free plan exists", false, "run npm run db:backfill-plans");
    } else {
      await prisma.subscription.update({
        data: { planId: freePlan.id },
        where: { storeId: store.id }
      });

      const downgraded = await getTeamView(scope);

      check(
        "both members are still there",
        downgraded.members.length === 2,
        `${downgraded.members.length} member(s)`
      );
      check(
        "the team is reported as over limit",
        downgraded.overLimitBy === 1,
        `overLimitBy=${downgraded.overLimitBy}`
      );
      check("inviting is off", downgraded.canInvite === false);
      await expectStaffError(
        "and a new invite is refused",
        () => inviteStaff(scope, { email: "post-downgrade@invalid.test", role: "MEMBER" }),
        "no staff seats left"
      );

      await prisma.subscription.update({
        data: { planId: starterPlan.id },
        where: { storeId: store.id }
      });
    }

    console.log("\n=== Team view and member guards ===");
    const team = await getTeamView(scope);
    const ownerRow = team.members.find((member) => member.email === OWNER_EMAIL);
    const staffRow = team.members.find((member) => member.email === STAFF_EMAIL);

    check("both members listed", team.members.length === 2);
    check(
      "owner cannot manage themselves",
      ownerRow?.canRemove === false && ownerRow?.isSelf === true
    );
    check(
      "owner can manage the member",
      staffRow?.canRemove === true && staffRow?.canChangeRole === true
    );
    check("invite button is off when full", team.canInvite === false);
    check("not over limit", team.overLimitBy === 0);

    if (!ownerRow || !staffRow) {
      check("member rows resolved", false);
      return;
    }

    await expectStaffError(
      "owner cannot change their own role",
      () => changeStaffRole(scope, { memberId: ownerRow.id, role: "ADMIN" }),
      "your own role"
    );
    await expectStaffError(
      "a member cannot remove the owner",
      () =>
        removeStaffMember(
          { organizationId: organization.id, role: "MEMBER", userId: staff.id },
          { memberId: ownerRow.id }
        ),
      "do not have permission"
    );

    await changeStaffRole(scope, { memberId: staffRow.id, role: "ADMIN" });

    const promoted = await prisma.organizationMember.findUnique({
      select: { role: true },
      where: { id: staffRow.id }
    });

    check("owner can promote a member to admin", promoted?.role === "ADMIN");

    await expectStaffError(
      "an admin cannot remove the owner either",
      () =>
        removeStaffMember(
          { organizationId: organization.id, role: "ADMIN", userId: staff.id },
          { memberId: ownerRow.id }
        ),
      "do not have permission"
    );

    await removeStaffMember(scope, { memberId: staffRow.id });

    const afterRemoval = await getStaffSeatUsage(organization.id);

    check(
      "removing a member returns the seat",
      afterRemoval.members === 1 && afterRemoval.remaining === 1,
      JSON.stringify(afterRemoval)
    );
  } finally {
    // Cascades to the store, subscription, memberships and invites.
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, STAFF_EMAIL] } } });
    console.log("\nFixtures removed.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    failures += 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
    process.exit(failures === 0 ? 0 : 1);
  });
