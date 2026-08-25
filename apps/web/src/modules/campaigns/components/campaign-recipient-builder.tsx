"use client";

import { Loader2, ListPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { buildCampaignRecipientsAction } from "../campaign.actions";

type CampaignRecipientBuilderProps = {
  campaignId: string;
  hasRecipients: boolean;
};

export function CampaignRecipientBuilder({
  campaignId,
  hasRecipients
}: CampaignRecipientBuilderProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function build() {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await buildCampaignRecipientsAction(campaignId);

      if (result.status === "error") {
        setError(result.message ?? "The recipient list could not be built.");
        return;
      }

      setMessage(
        result.inserted === 0
          ? "The recipient list is already up to date."
          : `Added ${result.inserted?.toLocaleString("en")} recipients.`
      );
    });
  }

  return (
    <div className="grid gap-2">
      <button
        className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#7c3aed] px-4 py-2.5 text-sm font-medium text-[#6d3cf5] transition hover:bg-[#f7f3ff] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        onClick={build}
        type="button"
      >
        {pending ? (
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : (
          <ListPlus aria-hidden="true" className="h-4 w-4" />
        )}
        {hasRecipients ? "Refresh recipient list" : "Build recipient list"}
      </button>
      {message ? (
        <p aria-live="polite" className="m-0 text-xs text-[#119c73]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p aria-live="polite" className="m-0 text-xs text-[#b3273f]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
