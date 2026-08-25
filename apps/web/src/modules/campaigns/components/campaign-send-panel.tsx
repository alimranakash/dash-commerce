"use client";

import { AlertTriangle, CalendarClock, Loader2, Pause, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useUpgradePrompt } from "../../billing/components/plan-upgrade-provider";
import {
  advanceCampaignAction,
  cancelCampaignAction,
  pauseCampaignAction,
  scheduleCampaignAction,
  startCampaignAction,
  unscheduleCampaignAction,
  type CampaignProgress
} from "../campaign.actions";

type CampaignSendPanelProps = {
  allowanceRemaining: number | null;
  blockers: string[];
  campaignId: string;
  initial: CampaignProgress;
  requiredSegments: number;
  /** Set when the campaign is queued. Rendered, not editable, while it waits. */
  scheduledAt: string | null;
  /** Null when the scheduler looks healthy; otherwise what is wrong with it. */
  schedulerWarning: string | null;
};

/** How often a running campaign asks for the next batch. */
const POLL_MS = 1200;

export function CampaignSendPanel({
  allowanceRemaining,
  blockers,
  campaignId,
  initial,
  requiredSegments,
  scheduledAt,
  schedulerWarning
}: CampaignSendPanelProps) {
  const router = useRouter();
  const { openUpgrade } = useUpgradePrompt();
  const [progress, setProgress] = useState<CampaignProgress>(initial);
  const [error, setError] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [pending, startAction] = useTransition();
  // Guards against a slow batch overlapping the next tick, which would claim
  // two batches at once and report progress out of order.
  const inFlight = useRef(false);

  const running = progress.status === "SENDING";

  const advance = useCallback(async () => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;

    try {
      const next = await advanceCampaignAction(campaignId);

      if (next) {
        setProgress(next);
      }
    } catch {
      setError("Lost contact with the server while sending. It will resume when you reload.");
    } finally {
      inFlight.current = false;
    }
  }, [campaignId]);

  useEffect(() => {
    if (!running) {
      return;
    }

    const timer = setInterval(() => void advance(), POLL_MS);

    // Fires immediately too, so pressing Send does not sit still for a second
    // before the first batch goes out.
    void advance();

    return () => clearInterval(timer);
  }, [advance, running]);

  // Once it stops, pull the rest of the page back in sync — the status badge,
  // the counters and the recipient table are all server-rendered.
  useEffect(() => {
    if (!running && progress.status !== initial.status) {
      router.refresh();
    }
  }, [initial.status, progress.status, router, running]);

  function run(action: () => Promise<{ lockedFeature?: string; message?: string; status: string }>) {
    setError(null);
    startAction(async () => {
      const result = await action();

      if (result.status === "error") {
        if (result.lockedFeature) {
          openUpgrade(result.lockedFeature as never);
          return;
        }

        setError(result.message ?? "That did not work.");
        return;
      }

      const next = await advanceCampaignAction(campaignId);

      if (next) setProgress(next);
      router.refresh();
    });
  }

  function formatWhen(value: string) {
    return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(value)
    );
  }

  const attempted = progress.sent + progress.failed + progress.skipped + progress.blocked;
  const percent = progress.total === 0 ? 0 : Math.round((attempted / progress.total) * 100);
  // A queued campaign is deliberately not sendable from here. `startCampaign`
  // only accepts DRAFT and PAUSED, so offering the button would be offering an
  // error — the seller unschedules first, which says what is happening.
  const canSend =
    blockers.length === 0 && !running && progress.status !== "SCHEDULED" && progress.pending > 0;

  return (
    <div className="grid gap-4">
      {blockers.length > 0 ? (
        <ul className="m-0 grid list-none gap-2 p-0">
          {blockers.map((blocker) => (
            <li
              className="flex items-start gap-2 rounded-lg border border-[#f0e3c4] bg-[#fdf8ec] px-4 py-3 text-sm text-[#8a6a1f]"
              key={blocker}
            >
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {blocker}
            </li>
          ))}
        </ul>
      ) : null}

      {progress.errorMessage ? (
        <p className="m-0 rounded-lg border border-[#f0e3c4] bg-[#fdf8ec] px-4 py-3 text-sm text-[#8a6a1f]">
          {progress.errorMessage}
        </p>
      ) : null}

      {error ? (
        <p aria-live="polite" className="m-0 rounded-lg border border-[#f5c9d0] bg-[#fdf2f4] px-4 py-3 text-sm text-[#b3273f]">
          {error}
        </p>
      ) : null}

      {progress.total > 0 ? (
        <div className="grid gap-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#f0f0f7]">
            <div
              className="h-full rounded-full bg-[#7548f5] transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div
            aria-live="polite"
            className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#555762]"
          >
            <span>
              {attempted.toLocaleString("en")} of {progress.total.toLocaleString("en")} ({percent}%)
            </span>
            <span className="text-[#119c73]">{progress.sent.toLocaleString("en")} sent</span>
            {progress.failed > 0 ? <span className="text-[#f05268]">{progress.failed.toLocaleString("en")} failed</span> : null}
            {progress.skipped > 0 ? <span>{progress.skipped.toLocaleString("en")} skipped</span> : null}
            {progress.blocked > 0 ? <span className="text-[#a9741c]">{progress.blocked.toLocaleString("en")} blocked</span> : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2.5">
        {running ? (
          <>
            <span className="inline-flex items-center gap-2 rounded-lg bg-[#f3f0ff] px-4 py-2.5 text-sm font-medium text-[#6d3cf5]">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Sending…
            </span>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-[#e5e3f1] px-4 py-2.5 text-sm font-medium text-[#555762] transition hover:bg-[#f7f7fb] disabled:opacity-60"
              disabled={pending}
              onClick={() => run(() => pauseCampaignAction(campaignId))}
              type="button"
            >
              <Pause aria-hidden="true" className="h-4 w-4" /> Pause
            </button>
          </>
        ) : progress.status === "SCHEDULED" ? null : (
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-[#7548f5] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6436e8] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSend || pending}
            onClick={() => run(() => startCampaignAction(campaignId))}
            type="button"
          >
            <Send aria-hidden="true" className="h-4 w-4" />
            {progress.status === "PAUSED" ? "Resume sending" : "Send now"}
          </button>
        )}

        {progress.pending > 0 && progress.status !== "CANCELLED" ? (
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-[#f5c9d0] px-4 py-2.5 text-sm font-medium text-[#f05268] transition hover:bg-[#fdf2f4] disabled:opacity-60"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Cancel this campaign? Recipients not yet reached will be skipped.")) {
                run(() => cancelCampaignAction(campaignId));
              }
            }}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" /> Cancel
          </button>
        ) : null}
      </div>

      {canSend ? (
        <p className="m-0 text-xs text-[#85869a]">
          This will send {progress.pending.toLocaleString("en")} messages, using about{" "}
          {requiredSegments.toLocaleString("en")} SMS segments
          {allowanceRemaining === null
            ? "."
            : ` of the ${allowanceRemaining.toLocaleString("en")} left on this plan this month.`}
        </p>
      ) : null}

      {progress.status === "SCHEDULED" ? (
        <div className="grid gap-2 rounded-lg border border-[#e5e3f1] bg-[#fafaff] px-4 py-4">
          {/* Flex on the wrapper, not the sentence: as a flex parent the <p>
              would make "Scheduled for", the date, and the full stop three
              separate items with a gap between each. */}
          <div className="flex items-center gap-2 text-sm text-[#30313d]">
            <CalendarClock aria-hidden="true" className="h-4 w-4 shrink-0 text-[#6d3cf5]" />
            <p className="m-0">
              Scheduled for {scheduledAt ? formatWhen(scheduledAt) : "a set time"}.
            </p>
          </div>
          <button
            className="w-fit rounded-lg border border-[#e5e3f1] px-3.5 py-2 text-xs font-medium text-[#555762] transition hover:bg-[#f7f7fb] disabled:opacity-60"
            disabled={pending}
            onClick={() => run(() => unscheduleCampaignAction(campaignId))}
            type="button"
          >
            Unschedule
          </button>
        </div>
      ) : canSend ? (
        <div className="grid gap-2 rounded-lg border border-[#e5e3f1] bg-[#fafaff] px-4 py-4">
          <label className="grid gap-2 text-sm font-medium text-[#292a34]">
            Or send it later
            <input
              className="h-11 w-full max-w-xs rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none focus:border-[#8b5cf6]"
              onChange={(event) => setScheduleAt(event.target.value)}
              type="datetime-local"
              value={scheduleAt}
            />
          </label>
          <button
            className="w-fit rounded-lg border border-[#7c3aed] px-4 py-2 text-xs font-medium text-[#6d3cf5] transition hover:bg-[#f7f3ff] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!scheduleAt || pending}
            onClick={() => run(() => scheduleCampaignAction(campaignId, scheduleAt))}
            type="button"
          >
            Schedule
          </button>
          {/* Said plainly rather than discovered at 9am: without something
              calling the cron endpoint, a queued campaign just sits there. */}
          {schedulerWarning ? (
            <p className="m-0 text-xs text-[#8a6a1f]">{schedulerWarning}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
