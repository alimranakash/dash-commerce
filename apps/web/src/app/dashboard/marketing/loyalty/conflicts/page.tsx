import Link from "next/link";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { LoyaltyConflictResolve } from "../../../../../modules/loyalty/components/loyalty-conflict-resolve";
import { getUnresolvedLoyaltyConflicts } from "../../../../../modules/loyalty/loyalty.service";
import { getStoreAccess } from "../../../../../modules/stores/queries";

/**
 * Dashboard → Loyalty → Conflicts.
 *
 * A customer record that opted in with a number another member already holds
 * was not enrolled. This lists those, unresolved, for owners and admins: the
 * page fetches nothing for anyone else, and the service refuses them anyway.
 * Nothing here merges anybody — resolving records that the owner dealt with
 * it, typically by adjusting the existing member's points by hand.
 */
export default async function LoyaltyConflictsPage() {
  const access = await getStoreAccess();

  if (!access.canManage) {
    return (
      <DashboardShell storeSlug={access.store.slug}>
        <section className="resource-page">
          <div className="resource-header">
            <div>
              <p className="eyebrow">Loyalty</p>
              <h1>Enrolment conflicts</h1>
            </div>
          </div>
          <p className="m-0 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Only the store owner or an admin can review enrolment conflicts.
          </p>
        </section>
      </DashboardShell>
    );
  }

  const conflicts = await getUnresolvedLoyaltyConflicts(access, access.store.id);

  return (
    <DashboardShell storeSlug={access.store.slug}>
      <section className="resource-page w-full max-w-full min-w-0 grid-cols-[minmax(0,1fr)]">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Loyalty</p>
            <h1>Enrolment conflicts</h1>
            <p className="auth-copy">
              These customers ticked the loyalty box with a phone number that already belongs to
              another member, so they were not enrolled and their orders earned nothing. Nobody was
              merged. If they are the same person, adjust the member&apos;s points by hand, then mark
              the conflict resolved.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link className="secondary link-button" href="/dashboard/marketing/loyalty/members">
              Back
            </Link>
          </div>
        </div>

        <section className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] min-w-0 overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)] sm:w-full sm:max-w-full">
          {conflicts.length ? (
            <div className="max-w-full overflow-x-auto p-4">
              <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                <thead className="bg-[#f7f7fa] text-[#5f616d]">
                  <tr>
                    {["Opted in as", "Number already held by", "Latest order", "Times", "Last seen", "Action"].map(
                      (header) => (
                        <th className="p-3 font-semibold" key={header}>
                          {header}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {conflicts.map((conflict) => (
                    <tr className="border-b border-[#efeff5]" key={conflict.id}>
                      <td className="p-3">
                        <span className="block font-medium">{conflict.customer.name}</span>
                        <span className="block text-[#77748a]">{conflict.customer.phone}</span>
                      </td>
                      <td className="p-3">
                        <Link
                          className="block font-semibold text-[#6d3cf5]"
                          href={`/dashboard/marketing/loyalty/members/${conflict.member.id}`}
                        >
                          {conflict.member.customer.name}
                        </Link>
                        <span className="block text-[#77748a]">{conflict.member.customer.phone}</span>
                      </td>
                      <td className="p-3">
                        <Link
                          className="font-semibold text-[#6d3cf5]"
                          href={`/dashboard/orders/${conflict.orderId}`}
                        >
                          View order
                        </Link>
                      </td>
                      <td className="p-3">{conflict.occurrences}</td>
                      <td className="p-3">{formatDate(conflict.updatedAt)}</td>
                      <td className="p-3">
                        <LoyaltyConflictResolve conflictId={conflict.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="m-0 px-6 py-10 text-center text-sm text-[#858691]">
              No unresolved conflicts.
            </p>
          )}
        </section>
      </section>
    </DashboardShell>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}
