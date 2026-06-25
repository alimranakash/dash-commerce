import { Mail, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

type ConnectedAccountsCardProps = {
  emailLoginEnabled: boolean;
  googleConnected: boolean;
};

export function ConnectedAccountsCard({ emailLoginEnabled, googleConnected }: ConnectedAccountsCardProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <AccountRow
        description={googleConnected ? "Google OAuth is connected to this account." : "Google OAuth is not connected yet."}
        icon={<ShieldCheck className="h-4 w-4" />}
        label="Google Account"
        status={googleConnected ? "Connected" : "Not connected"}
        tone={googleConnected ? "green" : "gray"}
      />
      <AccountRow
        description={emailLoginEnabled ? "Email and password login is enabled." : "This account does not have a password login."}
        icon={<Mail className="h-4 w-4" />}
        label="Email Login"
        status={emailLoginEnabled ? "Enabled" : "Unavailable"}
        tone={emailLoginEnabled ? "green" : "gray"}
      />
    </div>
  );
}

function AccountRow({
  description,
  icon,
  label,
  status,
  tone
}: {
  description: string;
  icon: ReactNode;
  label: string;
  status: string;
  tone: "gray" | "green";
}) {
  return (
    <div className="rounded-xl border border-[#efeff5] bg-[#fbfaff] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#f3f0ff] text-[#7c3aed]">{icon}</div>
          <div>
            <h3 className="m-0 text-sm font-semibold text-[#20212c]">{label}</h3>
            <p className="m-0 mt-1 text-xs leading-5 text-[#74758a]">{description}</p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone === "green" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
          {status}
        </span>
      </div>
    </div>
  );
}
