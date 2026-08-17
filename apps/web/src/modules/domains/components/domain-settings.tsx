"use client";

import { ArrowUpRight, Check, Copy, Globe2, Loader2, RefreshCw, Star, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useUpgradePrompt } from "../../billing/components/plan-upgrade-provider";
import { DeleteConfirmationButton } from "../../../components/dashboard/delete-confirmation-button";
import { DashboardCard } from "../../../components/dashboard/dashboard-card";
import { StatusBadge } from "../../../components/dashboard/status-badge";
import type { DomainActionState } from "../domains.actions";
import type { DomainDnsInstruction, StoreDomainView, StoreDomainsView } from "../domains.schema";

type DomainFormAction = (
  state: DomainActionState,
  formData: FormData
) => Promise<DomainActionState>;

type DomainSettingsProps = {
  addAction: DomainFormAction;
  canManage: boolean;
  removeAction: DomainFormAction;
  setPrimaryAction: DomainFormAction;
  verifyAction: DomainFormAction;
  view: StoreDomainsView;
};

const initialState: DomainActionState = { status: "idle" };

const inputClass =
  "h-11 w-full rounded-lg border border-[#dedcea] bg-white px-3.5 font-mono text-sm text-[#292a34] outline-none placeholder:font-sans placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10 disabled:bg-[#f6f5fa] disabled:text-[#8b8c99]";
const primaryButtonClass =
  "inline-flex h-11 items-center gap-2 rounded-lg bg-[#6d3cf5] px-4 text-sm font-semibold text-white hover:bg-[#5c30d6] disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex h-9 items-center gap-2 rounded-lg border border-[#dcd9e8] bg-white px-3 text-xs font-semibold text-[#555762] hover:bg-[#f8f7fc] disabled:opacity-60";

export function DomainSettings({
  addAction,
  canManage,
  removeAction,
  setPrimaryAction,
  verifyAction,
  view
}: DomainSettingsProps) {
  const [addState, addFormAction, isAdding] = useActionState(addAction, initialState);

  return (
    <div className="grid gap-5">
      {!view.planAllowsCustomDomain ? (
        <DashboardCard title="Custom domains">
          <div className="grid gap-3 rounded-lg border border-[#e5e0f7] bg-[#f7f4ff] p-5">
            <p className="m-0 text-sm font-semibold text-[#33343e]">
              Your plan does not include custom domains.
            </p>
            <p className="m-0 text-sm leading-6 text-[#655d78]">
              Your storefront stays reachable at{" "}
              <span className="font-mono text-[13px]">
                {view.platformDomain ?? "your store address"}
              </span>
              . Upgrade to connect a domain you own, like worzen.com.
            </p>
            <a className={`${primaryButtonClass} w-fit`} href="/dashboard/billing">
              See plans
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </DashboardCard>
      ) : (
        <DashboardCard title="Add a custom domain">
          <form action={addFormAction} className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
              <label className="grid gap-2 text-sm font-medium text-[#33343e]">
                Domain
                <input
                  autoComplete="off"
                  className={inputClass}
                  disabled={!canManage || !view.canAddCustomDomain}
                  name="domain"
                  placeholder="worzen.com"
                  spellCheck={false}
                />
                {addState.fieldErrors?.domain ? (
                  <span className="text-[11px] font-medium text-rose-600">
                    {addState.fieldErrors.domain}
                  </span>
                ) : (
                  <span className="text-[11px] font-normal leading-5 text-[#858691]">
                    Enter the domain you already own. Buy it from a registrar first — we do not sell
                    domains. {view.customDomainCount} of {view.maxCustomDomains} used.
                  </span>
                )}
              </label>
              <button
                className={`${primaryButtonClass} sm:mt-[26px]`}
                disabled={!canManage || !view.canAddCustomDomain || isAdding}
                type="submit"
              >
                {isAdding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Globe2 className="h-4 w-4" />
                )}
                {isAdding ? "Adding..." : "Add domain"}
              </button>
            </div>

            <label className="flex items-center gap-2.5 text-xs text-[#655d78]">
              <input
                className="h-4 w-4 accent-[#7548f5]"
                defaultChecked
                disabled={!canManage || !view.canAddCustomDomain}
                name="addSibling"
                type="checkbox"
              />
              Also add the www version, so both worzen.com and www.worzen.com work.
            </label>

            {addState.status !== "idle" && addState.message ? (
              <ActionMessage state={addState} />
            ) : null}

            {!view.canAddCustomDomain ? (
              <p className="m-0 rounded-lg border border-[#f4e6d8] bg-[#fffaf4] px-4 py-3 text-sm text-[#8a6134]">
                You have reached the limit of {view.maxCustomDomains} custom domains. Remove one to
                add another.
              </p>
            ) : null}

            {!view.platformDnsConfigured ? (
              <p className="m-0 rounded-lg border border-[#f4e6d8] bg-[#fffaf4] px-4 py-3 text-sm text-[#8a6134]">
                This server has no public address configured yet, so we cannot show DNS records or
                verify a domain. Set{" "}
                <span className="font-mono text-[12px]">PLATFORM_DOMAIN_IPV4</span> in the root{" "}
                <span className="font-mono text-[12px]">.env</span>.
              </p>
            ) : null}
          </form>
        </DashboardCard>
      )}

      <DashboardCard title="Your store addresses">
        <div className="grid gap-3">
          {view.domains.map((domain) => (
            <DomainRow
              canManage={canManage}
              domain={domain}
              key={domain.id}
              removeAction={removeAction}
              setPrimaryAction={setPrimaryAction}
              verifyAction={verifyAction}
            />
          ))}
        </div>
      </DashboardCard>
    </div>
  );
}

function DomainRow({
  canManage,
  domain,
  removeAction,
  setPrimaryAction,
  verifyAction
}: {
  canManage: boolean;
  domain: StoreDomainView;
  removeAction: DomainFormAction;
  setPrimaryAction: DomainFormAction;
  verifyAction: DomainFormAction;
}) {
  const [verifyState, verifyFormAction, isVerifying] = useActionState(verifyAction, initialState);
  const [primaryState, primaryFormAction, isPromoting] = useActionState(
    setPrimaryAction,
    initialState
  );
  const [removeState, removeFormAction] = useActionState(removeAction, initialState);
  const status = describeStatus(domain);

  return (
    <div className="grid gap-3 rounded-lg border border-[#ececf5] bg-[#fcfcff] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-[#292a34]">{domain.domain}</span>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            {domain.isPrimary ? <StatusBadge tone="purple">Primary</StatusBadge> : null}
          </div>
          <span className="text-[11px] leading-5 text-[#858691]">
            {domain.isPlatformDomain
              ? "Built in, always available. This address cannot be removed."
              : (domain.lastCheckDetail ??
                "Not checked yet. Add the DNS records below, then verify.")}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {domain.isVerified ? (
            <a
              className={secondaryButtonClass}
              href={`https://${domain.domain}`}
              rel="noreferrer"
              target="_blank"
            >
              Visit
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          ) : null}

          {!domain.isPlatformDomain ? (
            <form action={verifyFormAction}>
              <input name="domainId" type="hidden" value={domain.id} />
              <button className={secondaryButtonClass} disabled={!canManage || isVerifying}>
                {isVerifying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {isVerifying ? "Checking DNS..." : domain.isVerified ? "Re-check" : "Verify"}
              </button>
            </form>
          ) : null}

          {domain.canSetPrimary ? (
            <form action={primaryFormAction}>
              <input name="domainId" type="hidden" value={domain.id} />
              <button className={secondaryButtonClass} disabled={!canManage || isPromoting}>
                <Star className="h-3.5 w-3.5" />
                {isPromoting ? "Saving..." : "Make primary"}
              </button>
            </form>
          ) : null}

          {!domain.isPlatformDomain && canManage ? (
            <DeleteConfirmationButton
              // The confirmation dialog hands back an empty FormData, so the row's
              // id is filled in here rather than by a hidden input.
              action={(formData) => {
                formData.set("domainId", domain.id);
                removeFormAction(formData);
              }}
              ariaLabel={`Remove ${domain.domain}`}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#f2d4dc] bg-white px-3 text-xs font-semibold text-[#c02b52] hover:bg-[#fff5f7]"
              title={`Remove ${domain.domain}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </DeleteConfirmationButton>
          ) : null}
        </div>
      </div>

      {verifyState.status !== "idle" && verifyState.message ? (
        <ActionMessage state={verifyState} />
      ) : null}
      {primaryState.status !== "idle" && primaryState.message ? (
        <ActionMessage state={primaryState} />
      ) : null}
      {removeState.status !== "idle" && removeState.message ? (
        <ActionMessage state={removeState} />
      ) : null}

      {!domain.isPlatformDomain && !domain.isVerified && domain.dnsInstructions.length > 0 ? (
        <DnsInstructions instructions={domain.dnsInstructions} />
      ) : null}
    </div>
  );
}

/**
 * The copy-paste part. Registrar panels all ask for the same three things — record
 * type, name, and value — so that is exactly what this shows, with `@` spelled out
 * because it trips people up.
 */
function DnsInstructions({ instructions }: { instructions: DomainDnsInstruction[] }) {
  return (
    <div className="grid gap-2 rounded-lg border border-[#e5e0f7] bg-[#faf9ff] p-4">
      <p className="m-0 text-xs font-semibold text-[#33343e]">
        Add these records at your domain registrar
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-left">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-[#858691]">
              <th className="pb-2 pr-4 font-semibold">Type</th>
              <th className="pb-2 pr-4 font-semibold">Name</th>
              <th className="pb-2 font-semibold">Value</th>
            </tr>
          </thead>
          <tbody>
            {instructions.map((instruction) => (
              <tr className="align-top" key={`${instruction.type}-${instruction.value}`}>
                <td className="py-1.5 pr-4 font-mono text-xs text-[#292a34]">{instruction.type}</td>
                <td className="py-1.5 pr-4 font-mono text-xs text-[#292a34]">
                  <CopyValue value={instruction.name} />
                </td>
                <td className="py-1.5 font-mono text-xs text-[#292a34]">
                  <CopyValue value={instruction.value} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-[11px] leading-5 text-[#655d78]">
        A name of <span className="font-mono">@</span> means the domain itself. DNS changes usually
        appear within minutes but can take up to 24 hours — press Verify once they are in. HTTPS is
        issued automatically the first time a verified domain is visited.
      </p>
    </div>
  );
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="inline-flex items-center gap-1.5 rounded-md border border-[#dedcea] bg-white px-2 py-1 font-mono text-xs text-[#292a34] hover:bg-[#f8f7fc]"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      title="Copy"
      type="button"
    >
      {value}
      {copied ? (
        <Check className="h-3 w-3 text-emerald-600" />
      ) : (
        <Copy className="h-3 w-3 text-[#858691]" />
      )}
    </button>
  );
}

function ActionMessage({ state }: { state: DomainActionState }) {
  const { openUpgrade } = useUpgradePrompt();

  // Shared by every domain action, so one hook here covers add, verify, set
  // primary, and remove.
  useEffect(() => {
    openUpgrade(state.lockedFeature);
  }, [openUpgrade, state]);

  const isSuccess = state.status === "success";

  if (state.lockedFeature) {
    return null;
  }

  return (
    <p
      className={`m-0 rounded-lg border px-4 py-3 text-sm font-medium ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {state.message}
    </p>
  );
}

/**
 * The badge vocabulary the seller sees. "Misconfigured" is deliberately distinct
 * from "Pending": one means we found records pointing somewhere else, which needs
 * an edit, the other means there is nothing to see yet, which just needs time.
 */
function describeStatus(domain: StoreDomainView): {
  label: string;
  tone: "amber" | "gray" | "green" | "purple" | "red";
} {
  if (domain.isPlatformDomain) {
    return { label: "Built in", tone: "gray" };
  }

  if (domain.isVerified) {
    return { label: "Verified", tone: "green" };
  }

  if (domain.lastCheckStatus === "misconfigured") {
    return { label: "Misconfigured", tone: "red" };
  }

  if (domain.lastCheckStatus === "lookup-failed") {
    return { label: "Check failed", tone: "amber" };
  }

  return { label: "Pending", tone: "amber" };
}
