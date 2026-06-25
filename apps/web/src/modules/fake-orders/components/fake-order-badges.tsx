import type { CustomerFlagStatus, RiskLevel, VerificationStatus } from "../fake-order.types";
import type { ReactNode } from "react";

const riskStyles: Record<RiskLevel, string> = {
  HIGH: "bg-red-50 text-red-700 ring-red-100",
  LOW: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  MEDIUM: "bg-amber-50 text-amber-700 ring-amber-100"
};

const verificationStyles: Record<VerificationStatus, string> = {
  FAKE: "bg-red-50 text-red-700 ring-red-100",
  NORMAL: "bg-slate-50 text-slate-700 ring-slate-200",
  QUEUED: "bg-blue-50 text-blue-700 ring-blue-100",
  VERIFIED: "bg-emerald-50 text-emerald-700 ring-emerald-100"
};

const flagStyles: Record<CustomerFlagStatus, string> = {
  BLOCKED: "bg-red-50 text-red-700 ring-red-100",
  NORMAL: "bg-slate-50 text-slate-700 ring-slate-200",
  WATCHLIST: "bg-amber-50 text-amber-700 ring-amber-100"
};

export function RiskLevelBadge({ level }: { level: RiskLevel }) {
  return <Badge className={riskStyles[level]}>{titleCase(level)}</Badge>;
}

export function VerificationStatusBadge({ status }: { status: VerificationStatus }) {
  return <Badge className={verificationStyles[status]}>{titleCase(status)}</Badge>;
}

export function CustomerFlagBadge({ status }: { status: CustomerFlagStatus }) {
  return <Badge className={flagStyles[status]}>{titleCase(status)}</Badge>;
}

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${className}`}>
      {children}
    </span>
  );
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
