import { BarChart3, Boxes, Code2, Globe2, Megaphone, Music2, ServerCog } from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { hasPlanFeature } from "../../../modules/billing/subscription-limits";
import { getMarketingSettingsView } from "../../../modules/marketing/marketing.service";
import {
  isTrackingSectionConfigured,
  type TrackingSectionKey
} from "../../../modules/marketing/tracking-sections";
import { getStoreAccess } from "../../../modules/stores/queries";

type OverviewEntry = {
  description: string;
  icon: ComponentType<{ className?: string }>;
  section: TrackingSectionKey;
  title: string;
};

const entries: OverviewEntry[] = [
  {
    description: "GA4 measurement ID and Search Console verification.",
    icon: Globe2,
    section: "google-analytics",
    title: "Google Analytics"
  },
  {
    description: "Facebook and Instagram pixel, plus domain verification.",
    icon: Megaphone,
    section: "meta-pixel",
    title: "Meta Pixel"
  },
  {
    description: "Conversion tracking for your Google Ads campaigns.",
    icon: BarChart3,
    section: "google-ads",
    title: "Google Ads"
  },
  {
    description: "TikTok Ads pixel for attribution on TikTok campaigns.",
    icon: Music2,
    section: "tiktok-pixel",
    title: "TikTok Pixel"
  },
  {
    description: "Load Tag Manager and run your other tags from inside it.",
    icon: Boxes,
    section: "gtm",
    title: "GTM"
  },
  {
    description: "Purchases sent from our server, not just the browser.",
    icon: ServerCog,
    section: "server-side",
    title: "Server-Side Tracking"
  },
  {
    description: "Raw tracking markup, for anything without a page here.",
    icon: Code2,
    section: "custom",
    title: "Custom Tracking"
  }
];

export default async function AnalyticsOverviewPage() {
  const access = await getStoreAccess();
  const [settings, serverSideEntitled] = await Promise.all([
    getMarketingSettingsView(access.store.id),
    hasPlanFeature(access.store.id, "server_side_tracking")
  ]);

  const connected = entries.filter((entry) =>
    isTrackingSectionConfigured(entry.section, settings)
  ).length;

  return (
    <DashboardShell storeSlug={access.store.slug}>
      <section className="resource-page">
        <div>
          <h1 className="m-0 text-[1.65rem] font-semibold leading-tight">Analytics &amp; Tracking</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#737582]">
            Connect analytics and ad platforms by ID. We generate the official snippet for each one,
            so you never have to paste a script tag. {connected} of {entries.length} connected.
          </p>
          {!access.canManage ? (
            <p className="mt-3 rounded-lg border border-[#f4e6d8] bg-[#fffaf4] px-4 py-3 text-sm text-[#8a6134]">
              You can view these settings, but only the store owner or an admin can change them.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => {
            const active = isTrackingSectionConfigured(entry.section, settings);
            // A locked plan is reported as its own state rather than "Not set up":
            // the seller may have it configured and simply paused.
            const paused = entry.section === "server-side" && active && !serverSideEntitled;

            return (
              <Link
                className="flex flex-col gap-3 rounded-xl border border-[#ececf5] bg-white px-5 py-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)] transition hover:border-[#d9cffb]"
                href={`/dashboard/analytics/${entry.section}`}
                key={entry.section}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#f0ebff] text-[#7548f5]">
                    <entry.icon className="h-5 w-5" />
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${paused ? "bg-[#fdf1e3] text-[#a4651c]" : active ? "bg-emerald-50 text-emerald-700" : "bg-[#f2f1f7] text-[#7c7d8b]"}`}
                  >
                    {paused ? "Paused" : active ? "Connected" : "Not set up"}
                  </span>
                </div>
                <strong className="text-sm font-semibold text-[#20212a]">{entry.title}</strong>
                <span className="text-xs leading-5 text-[#85869a]">{entry.description}</span>
              </Link>
            );
          })}
        </div>

        <aside className="flex items-start gap-3 rounded-xl border border-[#e5e0f7] bg-[#f7f4ff] px-4 py-3 text-xs leading-5 text-[#655d78]">
          These tags load on your storefront only — never on your dashboard, so your own admin
          activity is not tracked. Changes go live on the next page load, and every change is
          recorded in the store activity log with who made it.
        </aside>
      </section>
    </DashboardShell>
  );
}
