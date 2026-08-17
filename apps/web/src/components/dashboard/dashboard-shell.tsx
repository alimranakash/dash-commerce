"use client";

import { useState, type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { DashboardNav } from "./dashboard-nav";
import { DashboardTopbar } from "./dashboard-topbar";
import { DeleteConfirmationProvider } from "./delete-confirmation-provider";
import { PlanUpgradeProvider } from "../../modules/billing/components/plan-upgrade-provider";

type DashboardShellProps = {
  children: ReactNode;
  storeSlug: string;
};

export function DashboardShell({ children, storeSlug }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <SessionProvider>
      <PlanUpgradeProvider>
      <DeleteConfirmationProvider>
        <main className="dash-dashboard min-h-screen bg-[#f5f6ff] text-[#18181b]">
          <DashboardNav
            onClose={() => setSidebarOpen(false)}
            open={sidebarOpen}
            storeSlug={storeSlug}
          />
          {sidebarOpen ? (
            <button
              aria-label="Close navigation"
              className="fixed inset-0 z-40 bg-black/20 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              type="button"
            />
          ) : null}
          <div className="min-h-screen lg:pl-[248px]">
            <DashboardTopbar onMenuClick={() => setSidebarOpen(true)} />
            <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-7 lg:py-6">{children}</section>
          </div>
        </main>
      </DeleteConfirmationProvider>
      </PlanUpgradeProvider>
    </SessionProvider>
  );
}
