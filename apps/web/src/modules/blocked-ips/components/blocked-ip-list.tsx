import { ShieldOff } from "lucide-react";
import { SHARED_ADDRESS_PHONE_COUNT, type BlockedIpView } from "../blocked-ip.service";
import { UnblockButton } from "./blocked-ip-buttons";

export function BlockedIpList({ blocked }: { blocked: BlockedIpView[] }) {
  if (blocked.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#dedcf0] bg-[#fbfaff] px-5 py-14 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#f3f0ff] text-[#7c3aed]">
          <ShieldOff className="h-7 w-7" />
        </div>
        <h2 className="m-0 mt-4 text-base font-semibold text-[#20212c]">No blocked addresses</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#74758a]">
          Addresses you block stop being able to place orders. Browsing your storefront is never
          affected.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#efeff5] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-left text-xs">
          <thead className="bg-[#f7f7fa] text-[#565762]">
            <tr>
              <th className="px-4 py-3 font-semibold">IP Address</th>
              <th className="px-4 py-3 font-semibold">Reason</th>
              <th className="px-4 py-3 font-semibold">Orders</th>
              <th className="px-4 py-3 font-semibold">Phone Numbers</th>
              <th className="px-4 py-3 font-semibold">Marked Fake</th>
              <th className="px-4 py-3 font-semibold">Blocked</th>
              <th className="px-4 py-3 font-semibold">Expires</th>
              <th className="px-4 py-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#efeff5]">
            {blocked.map((row) => (
              <tr className="transition hover:bg-[#fbfaff]" key={row.id}>
                <td className="whitespace-nowrap px-4 py-4 font-semibold text-[#20212c]">
                  {row.ipAddress}
                  {row.state === "EXPIRED" ? (
                    <span className="ml-2 rounded-full bg-[#f0eef8] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#565762]">
                      Expired
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-4 text-[#565762]">{row.reason ?? "—"}</td>
                <td className="px-4 py-4 text-[#30313d]">{row.orderCount}</td>
                <td className="px-4 py-4">
                  <PhoneCount count={row.phoneCount} />
                </td>
                <td className="px-4 py-4 text-[#30313d]">{row.fakeOrderCount}</td>
                <td className="whitespace-nowrap px-4 py-4 text-[#565762]">
                  {formatDate(row.createdAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-[#565762]">
                  {row.expiresAt ? formatDate(row.expiresAt) : "Never"}
                </td>
                <td className="px-4 py-4 text-right">
                  <UnblockButton blockedIpId={row.id} ipAddress={row.ipAddress} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * The number that decides whether a block is safe, styled to be read as such.
 * A high count is not proof of anything either way, so it is coloured as a
 * caution rather than an error.
 */
export function PhoneCount({ count }: { count: number }) {
  if (count < SHARED_ADDRESS_PHONE_COUNT) {
    return <span className="text-[#30313d]">{count}</span>;
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700"
      title={`${count} different phone numbers have ordered from this address — it may be a shared connection.`}
    >
      {count} · shared?
    </span>
  );
}

export function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}
