import type { ReactNode } from "react";
import { DashboardNav } from "./dashboard-nav";

type DashboardShellProps = {
  children: ReactNode;
  storeSlug: string;
};

export function DashboardShell({ children, storeSlug }: DashboardShellProps) {
  return (
    <main className="seller-app">
      <DashboardNav storeSlug={storeSlug} />
      <section className="seller-content">{children}</section>
    </main>
  );
}
