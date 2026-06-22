import type { ComponentType } from "react";

export function SummaryMetricCard({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <article className="rounded-xl border border-[#ececf5] bg-white p-4 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <span className="flex items-center gap-2 text-xs font-semibold text-[#4f505b]"><span className="grid h-8 w-8 place-items-center rounded-md bg-[#f0ebff] text-[#7548f5]"><Icon className="h-4 w-4" /></span>{label}</span>
      <strong className="mt-4 block text-xl text-[#20212a]">{value}</strong>
    </article>
  );
}
