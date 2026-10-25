import { FileSearch } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "../../../components/dashboard/status-badge";
import type { LoyaltyMemberRow } from "../loyalty.service";

/**
 * The members list. Server-rendered from one page of rows; it never holds
 * more of the store's members than the page it was given.
 */
export function LoyaltyMembersTable({
  members,
  searching
}: {
  members: LoyaltyMemberRow[];
  searching: boolean;
}) {
  return (
    <section className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] min-w-0 overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)] sm:w-full sm:max-w-full">
      {members.length ? (
        <div className="max-w-full overflow-x-auto p-4">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs">
            <thead className="bg-[#f7f7fa] text-[#5f616d]">
              <tr>
                {["Customer", "Phone", "Points", "Status", "Enrolled", "Action"].map((header) => (
                  <th className="p-3 font-semibold" key={header}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr className="border-b border-[#efeff5]" key={member.id}>
                  <td className="p-3">
                    <span className="block font-medium">{member.customerName}</span>
                    {member.customerEmail ? (
                      <span className="block text-[#77748a]">{member.customerEmail}</span>
                    ) : null}
                  </td>
                  <td className="p-3">{member.customerPhone}</td>
                  <td className={`p-3 font-semibold ${member.pointsBalance < 0 ? "text-rose-600" : ""}`}>
                    {formatNumber(member.pointsBalance)}
                  </td>
                  <td className="p-3">
                    {member.status === "ACTIVE" ? (
                      <StatusBadge tone="green">Active</StatusBadge>
                    ) : (
                      <StatusBadge tone="gray">Suspended</StatusBadge>
                    )}
                  </td>
                  <td className="p-3">{formatDate(member.enrolledAt)}</td>
                  <td className="p-3">
                    <Link
                      className="font-semibold text-[#6d3cf5]"
                      href={`/dashboard/marketing/loyalty/members/${member.id}`}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex min-h-80 flex-col items-center justify-center px-6 py-14 text-center">
          <span className="mb-4 grid h-20 w-20 place-items-center rounded-xl bg-[#f4f1ff] text-[#7650e8]">
            <FileSearch className="h-12 w-12" />
          </span>
          <h2 className="m-0 text-lg font-semibold">
            {searching ? "No members match that search" : "No members yet"}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#858691]">
            {searching
              ? "Try a name, an email or part of a phone number."
              : "Customers join by ticking the box at checkout while the programme is switched on."}
          </p>
        </div>
      )}
    </section>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}
