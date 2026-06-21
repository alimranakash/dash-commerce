import type { ReactNode } from "react";
import { DashboardCard } from "./dashboard-card";

type DataTableCardProps = {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  title: string;
};

export function DataTableCard({ action, children, className = "", title }: DataTableCardProps) {
  return (
    <DashboardCard action={action} className={`overflow-hidden ${className}`} title={title}>
      <div className="overflow-x-auto">{children}</div>
    </DashboardCard>
  );
}
