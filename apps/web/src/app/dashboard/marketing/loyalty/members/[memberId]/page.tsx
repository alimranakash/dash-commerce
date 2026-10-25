import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../../../components/dashboard/dashboard-shell";
import { StatusBadge } from "../../../../../../components/dashboard/status-badge";
import { LoyaltyLedgerTable } from "../../../../../../modules/loyalty/components/loyalty-ledger-table";
import { LoyaltyMemberActions } from "../../../../../../modules/loyalty/components/loyalty-member-actions";
import {
  getLoyaltyMemberDetail,
  getLoyaltyMemberLedger
} from "../../../../../../modules/loyalty/loyalty.service";
import { getStoreAccess } from "../../../../../../modules/stores/queries";

type LoyaltyMemberPageProps = {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<{ before?: string | string[] | undefined }>;
};

/**
 * One membership: who, how many points, and every movement of them.
 *
 * The member is read through the session's store, so an id from another store
 * is a 404 here exactly as it would be in the actions. The adjustment form is
 * handed a fresh request id on every render; that id is what makes a double
 * submission one adjustment.
 */
export default async function LoyaltyMemberPage({ params, searchParams }: LoyaltyMemberPageProps) {
  const access = await getStoreAccess();
  const { memberId } = await params;
  const { before } = await searchParams;
  const member = await getLoyaltyMemberDetail(access.store.id, memberId);

  if (!member) {
    notFound();
  }

  const ledger = await getLoyaltyMemberLedger(
    access.store.id,
    member.id,
    Array.isArray(before) ? before[0] : before
  );
  const basePath = `/dashboard/marketing/loyalty/members/${member.id}`;

  return (
    <DashboardShell storeSlug={access.store.slug}>
      <section className="resource-page w-full max-w-full min-w-0 grid-cols-[minmax(0,1fr)]">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Loyalty member</p>
            <h1>{member.customer.name}</h1>
            <p className="auth-copy">
              {member.customer.phone}
              {member.customer.email ? ` · ${member.customer.email}` : ""} · Joined{" "}
              {formatDate(member.enrolledAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link className="secondary link-button" href="/dashboard/marketing/loyalty/members">
              Back
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#ececf5] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
            <p className="m-0 text-xs font-medium uppercase tracking-wide text-[#85869a]">Balance</p>
            <p
              className={`m-0 mt-1.5 text-2xl font-semibold ${member.pointsBalance < 0 ? "text-rose-600" : "text-[#20212a]"}`}
            >
              {formatNumber(member.pointsBalance)} points
            </p>
          </div>
          <div className="rounded-xl border border-[#ececf5] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
            <p className="m-0 text-xs font-medium uppercase tracking-wide text-[#85869a]">Status</p>
            <p className="m-0 mt-2.5">
              {member.status === "ACTIVE" ? (
                <StatusBadge tone="green">Active</StatusBadge>
              ) : (
                <StatusBadge tone="gray">Suspended</StatusBadge>
              )}
            </p>
            {member.suspendedAt ? (
              <p className="m-0 mt-1.5 text-xs text-[#85869a]">
                Since {formatDate(member.suspendedAt)}
              </p>
            ) : null}
          </div>
          <div className="rounded-xl border border-[#ececf5] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
            <p className="m-0 text-xs font-medium uppercase tracking-wide text-[#85869a]">
              Ledger entries
            </p>
            <p className="m-0 mt-1.5 text-2xl font-semibold text-[#20212a]">
              {formatNumber(member.ledgerSequence)}
            </p>
          </div>
        </div>

        {member.pointsBalance < 0 ? (
          <p className="m-0 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            This balance is below zero: points were reversed after they had been spent. It cannot
            redeem until it is back above zero.
          </p>
        ) : null}

        {access.canManage ? (
          <LoyaltyMemberActions
            memberId={member.id}
            requestId={randomUUID()}
            status={member.status}
          />
        ) : (
          <p className="m-0 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Only the store owner or an admin can adjust points or suspend a membership.
          </p>
        )}

        <section className="grid gap-4 rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
          <header className="grid gap-1">
            <h2 className="m-0 text-base font-semibold text-[#252238]">Points history</h2>
            <p className="m-0 text-xs leading-relaxed text-[#77748a]">
              Newest first, in the order each entry was recorded. Entries are never edited or
              removed; a correction is a new entry.
            </p>
          </header>
          <LoyaltyLedgerTable entries={ledger.entries} />
          {before || ledger.nextBefore ? (
            <div className="flex flex-wrap items-center gap-2">
              {before ? (
                <Link className="secondary link-button" href={basePath}>
                  Newest
                </Link>
              ) : null}
              {ledger.nextBefore ? (
                <Link className="secondary link-button" href={`${basePath}?before=${ledger.nextBefore}`}>
                  Older entries
                </Link>
              ) : null}
            </div>
          ) : null}
        </section>
      </section>
    </DashboardShell>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}
