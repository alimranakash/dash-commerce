import type { ReactNode } from "react";
import Link from "next/link";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { FeatureGate } from "../../billing/components/feature-gate";
import { TRACKING_SECTIONS, type TrackingSectionKey } from "../tracking-sections";

/**
 * Chrome shared by every Analytics & Tracking page: title, description, and a
 * link back to the overview so the seven pages read as one section rather than
 * seven unrelated screens.
 *
 * The tier badge is drawn here rather than on each page for the same reason: the
 * seven are priced differently — Starter for the storefront pixels, Growth for
 * the wider tags, Pro for server-side — and reading which is which off one
 * component is what stops them drifting apart. The key comes from
 * `TRACKING_SECTIONS`, the same record the save action gates on.
 */
export function TrackingPageShell({
  children,
  description,
  section,
  storeId,
  storeSlug,
  title
}: {
  children: ReactNode;
  description: string;
  section: TrackingSectionKey;
  storeId: string;
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
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="m-0 text-[1.65rem] font-semibold leading-tight">{title}</h1>
            <FeatureGate feature={TRACKING_SECTIONS[section].feature} storeId={storeId} />
          </span>
          <p className="mt-2 max-w-2xl text-sm text-[#737582]">{description}</p>
        </div>
        {children}
      </section>
    </DashboardShell>
  );
}
