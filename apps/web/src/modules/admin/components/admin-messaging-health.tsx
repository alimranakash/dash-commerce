import { AlertTriangle, CheckCircle2, Mail, MessageSquare } from "lucide-react";
import { getMessagingHealth } from "../admin-messaging.service";

/**
 * Rendered inside a Suspense boundary on the overview: reading the SMS balance
 * is an outbound HTTP call, and the rest of the page should not wait on a
 * gateway that may be slow or down.
 */
export async function AdminMessagingHealth() {
  const health = await getMessagingHealth();

  return (
    <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-sm">
      <h2 className="m-0 text-base font-semibold text-[#20212c]">Messaging</h2>
      <p className="m-0 mt-1 text-xs text-[#74758a]">
        Verification codes for sign-up go out through these. Last 24 hours.
      </p>

      <div className="mt-4 grid gap-2">
        <ChannelRow
          detail={health.email.configured ? (health.email.host ?? "SMTP") : "No SMTP host set"}
          icon={<Mail className="h-4 w-4" />}
          label="Email"
          ok={health.email.configured}
        />
        <ChannelRow
          detail={smsDetail(health.sms)}
          icon={<MessageSquare className="h-4 w-4" />}
          label={health.sms.label}
          ok={health.sms.configured && !health.sms.isLow && health.sms.statusError === null}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Total label="Sent" tone="green" value={health.totals.SENT} />
        <Total label="Failed" tone={health.totals.FAILED > 0 ? "red" : "gray"} value={health.totals.FAILED} />
        <Total label="Logged only" tone="gray" value={health.totals.SKIPPED} />
      </div>

      {health.recentFailures.length > 0 ? (
        <div className="mt-4 grid gap-2">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#74758a]">
            Recent failures
          </p>
          {health.recentFailures.map((failure) => (
            <div className="rounded-lg border border-[#f2d4dc] bg-[#fff8fa] px-3 py-2" key={failure.id}>
              <div className="text-xs font-semibold text-[#30313d]">
                {failure.recipient}
                {failure.errorCode ? ` · ${failure.errorCode}` : ""}
              </div>
              <div className="mt-0.5 text-[11px] leading-4 text-[#8a5563]">
                {failure.errorMessage ?? "No detail recorded."}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function AdminMessagingHealthSkeleton() {
  return (
    <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-sm">
      <h2 className="m-0 text-base font-semibold text-[#20212c]">Messaging</h2>
      <div className="mt-4 h-28 animate-pulse rounded-lg bg-[#f7f7fb]" />
    </section>
  );
}

function smsDetail(sms: Awaited<ReturnType<typeof getMessagingHealth>>["sms"]) {
  if (!sms.configured) {
    return "No API key set";
  }

  if (sms.statusError) {
    return `Account unreadable — ${sms.statusError}`;
  }

  const parts: string[] = [];

  if (sms.balance !== null) {
    parts.push(`${sms.balance.toFixed(2)} BDT left${sms.isLow ? " — recharge soon" : ""}`);
  }

  if (sms.validUntil) {
    parts.push(`valid to ${sms.validUntil.toISOString().slice(0, 10)}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "Configured";
}

function ChannelRow({
  detail,
  icon,
  label,
  ok
}: {
  detail: string;
  icon: React.ReactNode;
  label: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#eeecf7] bg-[#fbfaff] px-3 py-2.5">
      <span className={`mt-0.5 ${ok ? "text-[#1f9d6a]" : "text-[#c08a2b]"}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-[#30313d]">{label}</div>
        <div className="mt-0.5 break-words text-[11px] leading-4 text-[#74758a]">{detail}</div>
      </div>
      <span className={ok ? "text-[#1f9d6a]" : "text-[#c08a2b]"}>
        {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      </span>
    </div>
  );
}

function Total({ label, tone, value }: { label: string; tone: "gray" | "green" | "red"; value: number }) {
  const tones = {
    gray: "text-[#565762]",
    green: "text-[#1f9d6a]",
    red: "text-[#c02b52]"
  };

  return (
    <div className="rounded-lg border border-[#eeecf7] bg-[#fbfaff] px-3 py-2 text-center">
      <div className={`text-lg font-semibold ${tones[tone]}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-[#74758a]">{label}</div>
    </div>
  );
}
