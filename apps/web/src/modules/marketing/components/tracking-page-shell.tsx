import type { ReactNode } from "react";
import Link from "next/link";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";

/**
 * Chrome shared by every Analytics & Tracking page: title, description, and a
 * link back to the overview so the seven pages read as one section rather than
 * seven unrelated screens.
 */
export function TrackingPageShell({
  children,
  description,
  storeSlug,
  title
}: {
  children: ReactNode;
  description: string;
  storeSlug: string;
  title: string;
}) {
  return (
    <DashboardShell storeSlug={storeSlug}>
      <section className="resource-page max-w-none">
        <div>
          <Link
            className="text-xs font-medium text-[#6d3cf5] hover:underline"
            href="/dashboard/analytics"
          >
            ← Analytics &amp; Tracking
          </Link>
          <h1 className="m-0 mt-2 text-[1.65rem] font-semibold leading-tight">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#737582]">{description}</p>
        </div>
        {children}
      </section>
    </DashboardShell>
  );
}
