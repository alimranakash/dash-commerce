import type { ReactNode } from "react";

export function ReportCard({ action, children, className = "", title }: { action?: ReactNode; children: ReactNode; className?: string; title: string }) {
  return (
    <section className={`overflow-hidden rounded-lg border border-[#ececf5] bg-white shadow-[0_6px_18px_rgba(62,54,114,0.035)] ${className}`}>
      <header className="flex min-h-12 items-center justify-between gap-4 border-b border-[#efeff5] px-4 py-3">
        <h2 className="m-0 text-[13px] font-semibold text-[#2a2b34]">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
