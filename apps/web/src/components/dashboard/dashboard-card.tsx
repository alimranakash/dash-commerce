import type { ReactNode } from "react";

type DashboardCardProps = {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  title?: string;
};

export function DashboardCard({ action, children, className = "", title }: DashboardCardProps) {
  return (
    <section className={`rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)] ${className}`}>
      {title || action ? (
        <div className="mb-5 flex items-center justify-between gap-4">
          {title ? <h2 className="text-[15px] font-semibold text-[#1f2029]">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
