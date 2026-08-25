import { Megaphone, Plus } from "lucide-react";
import Link from "next/link";

export type CampaignListRow = {
  audienceName: string | null;
  channel: "EMAIL" | "SMS";
  couponCode: string | null;
  createdAt: Date;
  failedCount: number;
  id: string;
  name: string;
  sentCount: number;
  status: string;
  totalCount: number;
};

type CampaignListProps = {
  campaigns: CampaignListRow[];
};

const statusBadges: Record<string, { className: string; label: string }> = {
  CANCELLED: { className: "bg-[#f0f0f3] text-[#555762]", label: "Cancelled" },
  DRAFT: { className: "bg-[#f0f0f3] text-[#555762]", label: "Draft" },
  FAILED: { className: "bg-[#ffe8ed] text-[#f05268]", label: "Failed" },
  PAUSED: { className: "bg-[#fdf3e4] text-[#a9741c]", label: "Paused" },
  SCHEDULED: { className: "bg-[#eef2ff] text-[#4f56d3]", label: "Scheduled" },
  SENDING: { className: "bg-[#eef2ff] text-[#4f56d3]", label: "Sending" },
  SENT: { className: "bg-[#e5f8f2] text-[#119c73]", label: "Sent" }
};

export function CampaignList({ campaigns }: CampaignListProps) {
  if (campaigns.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mb-6 grid h-28 w-28 place-items-center rounded-2xl bg-[#f3efff] text-[#7950f2]">
          <Megaphone aria-hidden="true" className="h-14 w-14" />
        </div>
        <h2 className="m-0 text-xl font-semibold text-[#20212a]">No campaigns yet</h2>
        <p className="mt-4 max-w-sm text-sm leading-6 text-[#85869a]">
          Write a message, pick who it goes to, and reach your customers where they already are.
        </p>
        <Link
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-[#7c3aed] px-4 py-2.5 text-sm font-medium text-[#6d3cf5] hover:bg-[#f7f3ff]"
          href="/dashboard/marketing/campaigns/new"
        >
          <Plus aria-hidden="true" className="h-4 w-4" /> Create Campaign
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[#eeeef5] text-[11px] uppercase tracking-wide text-[#85869a]">
            <th className="py-3 pr-4 font-medium">Campaign</th>
            <th className="py-3 pr-4 font-medium">Channel</th>
            <th className="py-3 pr-4 font-medium">Audience</th>
            <th className="py-3 pr-4 font-medium">Progress</th>
            <th className="py-3 pr-4 font-medium">Status</th>
            <th className="py-3 pl-4 text-right font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => {
            const badge = statusBadges[campaign.status] ?? {
              className: "bg-[#f0f0f3] text-[#555762]",
              label: campaign.status
            };

            return (
              <tr className="border-b border-[#f4f4f9] align-middle" key={campaign.id}>
                <td className="py-4 pr-4">
                  <Link
                    className="font-semibold text-[#6d3cf5] hover:underline"
                    href={`/dashboard/marketing/campaigns/${campaign.id}`}
                  >
                    {campaign.name}
                  </Link>
                  {campaign.couponCode ? (
                    <p className="m-0 mt-0.5 text-xs text-[#85869a]">
                      Coupon {campaign.couponCode}
                    </p>
                  ) : null}
                </td>
                <td className="py-4 pr-4 text-[#30313d]">{campaign.channel}</td>
                <td className="py-4 pr-4 text-[#30313d]">
                  {campaign.audienceName ?? "Custom rules"}
                </td>
                <td className="py-4 pr-4 text-[#30313d]">
                  {campaign.totalCount === 0
                    ? "—"
                    : `${campaign.sentCount} / ${campaign.totalCount}`}
                  {campaign.failedCount > 0 ? (
                    <span className="ml-1.5 text-xs text-[#f05268]">
                      {campaign.failedCount} failed
                    </span>
                  ) : null}
                </td>
                <td className="py-4 pr-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </td>
                <td className="py-4 pl-4 text-right text-xs text-[#555762]">
                  {formatDate(campaign.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}
