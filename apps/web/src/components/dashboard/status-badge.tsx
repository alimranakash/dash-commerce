import type { ReactNode } from "react";

type StatusBadgeProps = {
  children: ReactNode;
  tone?: "green" | "purple" | "amber" | "red" | "gray";
};

const tones = {
  amber: "bg-amber-50 text-amber-700",
  gray: "bg-gray-100 text-gray-600",
  green: "bg-emerald-50 text-emerald-700",
  purple: "bg-violet-50 text-violet-700",
  red: "bg-rose-50 text-rose-700"
};

export function StatusBadge({ children, tone = "purple" }: StatusBadgeProps) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${tones[tone]}`}>{children}</span>;
}
