import type { ReactNode } from "react";

type FakeOrderSummaryCardProps = {
  icon: ReactNode;
  label: string;
  tone?: "blue" | "green" | "purple" | "red" | "amber";
  value: string;
};

export function FakeOrderSummaryCard({ icon, label, tone = "purple", value }: FakeOrderSummaryCardProps) {
  const toneClass = {
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    purple: "bg-violet-50 text-violet-700",
    red: "bg-red-50 text-red-700"
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
