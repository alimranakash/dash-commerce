import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { CampaignRecipientBuilder } from "../../../../../modules/campaigns/components/campaign-recipient-builder";
import { CampaignSendPanel } from "../../../../../modules/campaigns/components/campaign-send-panel";
import { getSchedulerHealth } from "../../../../../modules/campaigns/campaign-delivery.service";
import {
  estimateCampaignCost,
  getCampaignByIdForStore,
  getCampaignRecipientCounts,
  getCampaignRecipients,
  preflightCampaign,
  previewAudienceReach,
  resolveCampaignRules
} from "../../../../../modules/campaigns/campaign.service";
import { describeAudienceRules } from "../../../../../modules/campaigns/audience.schema";
import { requireStore } from "../../../../../modules/stores/queries";

type CampaignPageProps = {
  params: Promise<{ campaignId: string }>;
};

export default async function CampaignDetailPage({ params }: CampaignPageProps) {
  const store = await requireStore();
  const { campaignId } = await params;
  const campaign = await getCampaignByIdForStore(store.id, campaignId);

  if (!campaign) {
    notFound();
  }

  const rules = resolveCampaignRules(campaign);
  const [counts, recipients, reach, preflight] = await Promise.all([
    getCampaignRecipientCounts(campaign.id),
    getCampaignRecipients(campaign.id, { take: 50 }),
    previewAudienceReach(store.id, rules, campaign.channel),
    preflightCampaign(store.id, campaign.id)
  ]);
  // Once the list exists it is the truth about size; before that, the live reach
  // is the best available guess.
  const cost = estimateCampaignCost(campaign.body, counts.total || reach.reachable);
  const editable = campaign.status === "DRAFT" || campaign.status === "PAUSED";

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="flex flex-wrap items-center gap-4">
          <div className="catalog-page-heading">
            <h1>{campaign.name}</h1>
          </div>
          <span className="rounded-full bg-[#f0f0f3] px-2.5 py-1 text-[11px] font-semibold text-[#555762]">
            {campaign.status}
          </span>
          {editable ? (
            <Link
              className="inline-flex items-center rounded-lg border border-[#7c3aed] bg-white px-3.5 py-2.5 text-sm font-medium text-[#6d3cf5] hover:bg-[#f7f3ff]"
              href={`/dashboard/marketing/campaigns/${campaign.id}/edit`}
            >
              Edit
            </Link>
          ) : null}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Message">
            <p className="m-0 whitespace-pre-wrap rounded-lg bg-[#fafaff] px-4 py-3 text-sm leading-6 text-[#30313d]">
              {campaign.body}
            </p>
            <Row label="Channel" value={campaign.channel} />
            <Row label="Coupon" value={campaign.coupon?.code ?? "None"} />
            <Row
              label="Cost per message"
              value={`${cost.segmentsPerMessage} ${cost.segmentsPerMessage === 1 ? "segment" : "segments"}${cost.unicode ? " (non-Latin)" : ""}`}
            />
            <Row
              label="Estimated total"
              value={`${cost.totalSegments.toLocaleString("en")} SMS segments`}
            />
          </Card>

          <Card title="Audience">
            <Row label="Segment" value={campaign.audience?.name ?? describeAudienceRules(rules)} />
            <Row label="Matching customers" value={reach.matched.toLocaleString("en")} />
            <Row label="Opted out" value={reach.optedOut.toLocaleString("en")} />
            <Row label="No phone number" value={reach.unreachable.toLocaleString("en")} />
            <Row label="Reachable now" value={reach.reachable.toLocaleString("en")} />
            {editable ? (
              <CampaignRecipientBuilder campaignId={campaign.id} hasRecipients={counts.total > 0} />
            ) : null}
          </Card>
        </div>

        {campaign.status === "CANCELLED" ? null : (
          <Card title="Send">
            <CampaignSendPanel
              allowanceRemaining={preflight?.allowance.remaining ?? null}
              blockers={preflight?.blockers ?? []}
              campaignId={campaign.id}
              initial={{
                blocked: counts.blocked,
                done: campaign.status !== "SENDING",
                errorMessage: campaign.errorMessage,
                failed: counts.failed,
                pending: counts.pending,
                sent: counts.sent,
                skipped: counts.skipped,
                status: campaign.status,
                total: counts.total
              }}
              requiredSegments={preflight?.allowance.required ?? 0}
              scheduledAt={campaign.scheduledAt?.toISOString() ?? null}
              schedulerWarning={schedulerWarning(getSchedulerHealth())}
            />
          </Card>
        )}

        <Card title={`Recipients (${counts.total.toLocaleString("en")})`}>
          {counts.total === 0 ? (
            <p className="m-0 text-sm text-[#85869a]">
              No recipient list yet. Build it to freeze exactly who this campaign will reach.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-4 text-xs text-[#555762]">
                <span>{counts.pending.toLocaleString("en")} pending</span>
                <span>{counts.sent.toLocaleString("en")} sent</span>
                <span>{counts.failed.toLocaleString("en")} failed</span>
                <span>{counts.skipped.toLocaleString("en")} skipped</span>
                <span>{counts.blocked.toLocaleString("en")} blocked</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#eeeef5] text-[11px] uppercase tracking-wide text-[#85869a]">
                      <th className="py-2.5 pr-4 font-medium">Recipient</th>
                      <th className="py-2.5 pr-4 font-medium">Name</th>
                      <th className="py-2.5 pr-4 font-medium">Status</th>
                      <th className="py-2.5 font-medium">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((recipient) => (
                      <tr className="border-b border-[#f4f4f9]" key={recipient.id}>
                        <td className="py-2.5 pr-4 text-[#30313d]">{recipient.recipient}</td>
                        <td className="py-2.5 pr-4 text-[#555762]">{recipient.name ?? "—"}</td>
                        <td className="py-2.5 pr-4 text-[#555762]">{recipient.status}</td>
                        <td className="py-2.5 text-xs text-[#85869a]">
                          {recipient.errorMessage ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {counts.total > recipients.length ? (
                <p className="m-0 text-xs text-[#85869a]">
                  Showing the first {recipients.length.toLocaleString("en")} of{" "}
                  {counts.total.toLocaleString("en")}.
                </p>
              ) : null}
            </>
          )}
        </Card>
      </section>
    </DashboardShell>
  );
}

/**
 * Turns scheduler liveness into something worth showing a seller, or nothing.
 *
 * Two different problems, deliberately worded differently. A missing secret is
 * a definite fact — scheduled campaigns cannot send. A secret with no recent
 * tick is a suspicion: it also looks like this for the first minute after a
 * restart, so it is phrased as something to check rather than something broken.
 */
function schedulerWarning(health: ReturnType<typeof getSchedulerHealth>) {
  if (!health.configured) {
    return "CRON_SECRET is not set on this server, so a scheduled campaign will wait until someone opens this page and sends it. See deploy/campaign-scheduler.md.";
  }

  if (!health.seenRecently) {
    return "No scheduler has called in recently. If this server was just restarted you can ignore this; otherwise check the campaign scheduler timer.";
  }

  return null;
}

function Card({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <header className="border-b border-[#ececf5] px-5 py-4">
        <h2 className="m-0 text-base font-semibold">{title}</h2>
      </header>
      <div className="grid gap-3 p-5">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-[#85869a]">{label}</span>
      <strong className="text-right font-medium text-[#20212a]">{value}</strong>
    </div>
  );
}
