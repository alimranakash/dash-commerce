import { BarChart3 } from "lucide-react";
import type { ReactNode } from "react";

export function AdminPageHeader({ description, title }: { description: string; title: string }) {
  return (
    <div className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7c3aed]">Platform Admin</p>
      <h2 className="m-0 mt-2 text-2xl font-semibold tracking-tight text-[#20212a]">{title}</h2>
      <p className="m-0 mt-2 text-sm text-[#74758a]">{description}</p>
    </div>
  );
}

export function AdminMetricCard({
  icon,
  label,
  tone = "purple",
  value
}: {
  icon: ReactNode;
  label: string;
  tone?: "amber" | "blue" | "green" | "purple";
  value: string;
}) {
  const toneClass = {
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    purple: "bg-violet-50 text-violet-700"
  }[tone];

  return (
    <div className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="m-0 text-xs font-medium text-[#74758a]">{label}</p>
          <strong className="mt-2 block text-2xl font-semibold tracking-tight text-[#20212c]">{value}</strong>
        </div>
        <div className={`inline-flex shrink-0 rounded-xl p-2 ${toneClass}`}>{icon}</div>
      </div>
    </div>
  );
}

export function AdminPlaceholderCard({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-[#ececf5] bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#f3f0ff] text-[#7c3aed]">
        <BarChart3 className="h-6 w-6" />
      </div>
      <h3 className="m-0 text-lg font-semibold text-[#20212c]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#74758a]">
        This admin workspace is ready for the next build phase. Full management tools will be connected here.
      </p>
    </div>
  );
}
