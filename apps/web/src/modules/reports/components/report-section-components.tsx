import { CalendarDays, Ellipsis } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

export function DateRangeFilter() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="grid h-9 w-9 place-items-center rounded-md border border-[#e6e4f0] bg-white text-[#7650e8]"><CalendarDays className="h-4 w-4" /></span>
      <select aria-label="Report date range" className="h-9 rounded-md border border-[#e6e4f0] bg-white px-3 outline-none"><option>Last 30 days</option><option>Last 90 days</option><option>Last 12 months</option></select>
    </div>
  );
}

export function ReportMetricCard({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <article className="rounded-lg border border-[#ececf5] bg-white p-4 shadow-[0_6px_18px_rgba(62,54,114,0.035)]">
      <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-semibold"><span className="grid h-8 w-8 place-items-center rounded-md bg-[#f4f1ff] text-[#7650e8]"><Icon className="h-4 w-4" /></span>{label}</span><Ellipsis className="h-4 w-4 text-[#898a95]" /></div>
      <strong className="mt-5 block text-lg text-[#20212a]">{value}</strong>
    </article>
  );
}

export function ReportTable({ headers, rows, emptyMessage }: { emptyMessage: string; headers: string[]; rows: ReactNode[][] }) {
  if (!rows.length) return <ReportEmptyState message={emptyMessage} />;

  return (
    <div className="overflow-x-auto p-4">
      <table className="w-full min-w-[560px] border-collapse text-left text-xs">
        <thead className="bg-[#f7f7fa] text-[#656773]"><tr>{headers.map((header) => <th className="p-3 font-semibold" key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, rowIndex) => <tr className="border-b border-[#f0eff5]" key={rowIndex}>{row.map((cell, cellIndex) => <td className="p-3" key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function ReportEmptyState({ message }: { message: string }) {
  return <div className="grid min-h-56 place-items-center px-6 text-center text-xs text-[#858691]">{message}</div>;
}

export function ReportBarList({ items }: { items: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="grid min-h-56 content-center gap-4 p-5">
      {items.map((item, index) => (
        <div className="grid grid-cols-[110px_1fr_42px] items-center gap-3 text-xs" key={item.label}>
          <span className="truncate">{item.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-[#f0eff6]"><span className="block h-full rounded-full" style={{ backgroundColor: barColors[index % barColors.length], width: `${item.value ? Math.max(4, item.value / max * 100) : 0}%` }} /></span>
          <strong className="text-right">{formatNumber(item.value)}</strong>
        </div>
      ))}
    </div>
  );
}

const barColors = ["#7650e8", "#2789e8", "#20a66a", "#f2b84b", "#ef5b6a", "#a855f7"];

export function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}
