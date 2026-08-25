import type { IpOrderStats } from "../blocked-ip.service";
import { BlockSuggestionButton } from "./blocked-ip-buttons";
import { PhoneCount, formatDate } from "./blocked-ip-list";

/**
 * Addresses this store has already marked orders fake from, and has not blocked.
 *
 * Suggestions, never actions: the engine can see that twelve orders from one
 * address were marked fake, but not whether they came from one abuser or from a
 * shared office connection that also carries real customers. Both counts are on
 * the row so that call can actually be made before the button is pressed.
 */
export function BlockedIpSuggestions({ suggestions }: { suggestions: IpOrderStats[] }) {
  if (suggestions.length === 0) {
    return (
      <p className="m-0 mt-4 rounded-xl border border-dashed border-[#dedcf0] bg-[#fbfaff] p-5 text-sm text-[#74758a]">
        Nothing to suggest yet. Addresses show up here once orders from them are marked fake in the
        Fake Orders queue.
      </p>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-[#efeff5] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead className="bg-[#f7f7fa] text-[#565762]">
            <tr>
              <th className="px-4 py-3 font-semibold">IP Address</th>
              <th className="px-4 py-3 font-semibold">Marked Fake</th>
              <th className="px-4 py-3 font-semibold">Orders</th>
              <th className="px-4 py-3 font-semibold">Phone Numbers</th>
              <th className="px-4 py-3 font-semibold">Last Order</th>
              <th className="px-4 py-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#efeff5]">
            {suggestions.map((row) => (
              <tr className="transition hover:bg-[#fbfaff]" key={row.ipAddress}>
                <td className="whitespace-nowrap px-4 py-4 font-semibold text-[#20212c]">
                  {row.ipAddress}
                </td>
                <td className="px-4 py-4 font-semibold text-[#b3273f]">{row.fakeOrderCount}</td>
                <td className="px-4 py-4 text-[#30313d]">{row.orderCount}</td>
                <td className="px-4 py-4">
                  <PhoneCount count={row.phoneCount} />
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-[#565762]">
                  {row.lastOrderAt ? formatDate(row.lastOrderAt) : "—"}
                </td>
                <td className="px-4 py-4 text-right">
                  <BlockSuggestionButton ipAddress={row.ipAddress} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
