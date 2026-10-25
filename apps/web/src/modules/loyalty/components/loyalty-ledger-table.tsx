import Link from "next/link";
import type { getLoyaltyMemberLedger } from "../loyalty.service";

type LedgerEntry = Awaited<ReturnType<typeof getLoyaltyMemberLedger>>["entries"][number];

const TYPE_LABELS: Record<LedgerEntry["type"], string> = {
  ADJUSTMENT: "Manual adjustment",
  EARN: "Earned",
  EARN_REVERSAL: "Earning reversed",
  REDEEM: "Redeemed",
  REDEEM_REVERSAL: "Redemption returned"
};

/**
 * A member's history, newest first in commit order. Read-only by design: the
 * ledger is the record, and a correction is a new row, never an edit.
 */
export function LoyaltyLedgerTable({ entries }: { entries: LedgerEntry[] }) {
  if (!entries.length) {
    return (
      <p className="m-0 rounded-lg bg-[#f6f3ff] px-4 py-3 text-sm text-[#3d2279]">
        No points have moved for this member yet.
      </p>
    );
  }

  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-left text-xs">
        <thead className="bg-[#f7f7fa] text-[#5f616d]">
          <tr>
            {["#", "When", "Type", "Points", "Balance after", "Source", "Reason"].map((header) => (
              <th className="p-3 font-semibold" key={header}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr className="border-b border-[#efeff5]" key={entry.id}>
              <td className="p-3 text-[#77748a]">{entry.sequence}</td>
              <td className="p-3">{formatDateTime(entry.createdAt)}</td>
              <td className="p-3 font-medium">{TYPE_LABELS[entry.type]}</td>
              <td
                className={`p-3 font-semibold ${entry.points < 0 ? "text-rose-600" : "text-emerald-700"}`}
              >
                {entry.points > 0 ? "+" : ""}
                {formatNumber(entry.points)}
              </td>
              <td className="p-3">{formatNumber(entry.balanceAfter)}</td>
              <td className="p-3">
                {entry.sourceType === "ORDER" && entry.sourceId ? (
                  <Link
                    className="font-semibold text-[#6d3cf5]"
                    href={`/dashboard/orders/${entry.sourceId}`}
                  >
                    Order
                  </Link>
                ) : entry.sourceType === "SALE" && entry.sourceId ? (
                  <Link
                    className="font-semibold text-[#6d3cf5]"
                    href={`/dashboard/sales/${entry.sourceId}`}
                  >
                    Sale
                  </Link>
                ) : (
                  <span>{entry.actorName ? `By ${entry.actorName}` : "Manual"}</span>
                )}
              </td>
              <td className="p-3 text-[#77748a]">{entry.note ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value);
}
