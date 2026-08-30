"use client";

import { Ban, Eye, EyeOff, KeyRound, Loader2, Plug, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { DashboardCard } from "../../../components/dashboard/dashboard-card";
import { DeleteConfirmationButton } from "../../../components/dashboard/delete-confirmation-button";
import { StatusBadge } from "../../../components/dashboard/status-badge";
import { ApiKeyRevealPanel, SecretValue } from "./api-key-reveal-panel";
import type { AiKeyActionState } from "../ai-key.actions";
import type { AiScope, ApiKeySummary } from "../ai.schema";
import { storeOSPhaseLabel } from "../../storeos/storeos-connection-state";
// One definition of "what state is this connection in", shared with the Dash AI
// settings page. Two summaries of the same row that disagree is worse than one.
import type { StoreOSConnectionView } from "../../storeos/storeos-connection-state";

type AiKeyFormAction = (state: AiKeyActionState, formData: FormData) => Promise<AiKeyActionState>;

type AiIntegrationSettingsProps = {
  canManage: boolean;
  connection: StoreOSConnectionView;
  createAction: AiKeyFormAction;
  deleteAction: AiKeyFormAction;
  /** Only the scopes that can actually be granted today. */
  grantableScopes: AiScope[];
  keys: ApiKeySummary[];
  revealAction: AiKeyFormAction;
  revokeAction: AiKeyFormAction;
};

const initialState: AiKeyActionState = { status: "idle" };

const inputClass =
  "h-11 w-full rounded-lg border border-[#dedcea] bg-white px-3.5 text-sm text-[#292a34] outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10 disabled:bg-[#f6f5fa] disabled:text-[#8b8c99]";
const primaryButtonClass =
  "inline-flex h-11 items-center gap-2 rounded-lg bg-[#6d3cf5] px-4 text-sm font-semibold text-white hover:bg-[#5c30d6] disabled:opacity-60";
const rowButtonClass =
  "inline-flex h-9 items-center gap-2 rounded-lg border border-[#dedcea] bg-white px-3 text-xs font-semibold text-[#4b4c59] hover:bg-[#f6f5fa] disabled:opacity-60";
const rowDangerButtonClass =
  "inline-flex h-9 items-center gap-2 rounded-lg border border-[#f2d4dc] bg-white px-3 text-xs font-semibold text-[#c02b52] hover:bg-[#fff5f7]";

/**
 * What each scope actually lets the AI read, in the seller's terms rather than
 * the API's. A seller ticking a box has to be able to tell what they are handing
 * over; "read:orders" on its own does not tell them that it includes what people
 * bought.
 */
const scopeCopy: Record<AiScope, { description: string; label: string }> = {
  "read:analytics": {
    description: "Sales totals, best sellers, and the dashboard reports.",
    label: "Analytics & reports"
  },
  "read:customers": {
    description:
      "Customer names in reports. Phone numbers and emails are always masked, never sent in full.",
    label: "Customers"
  },
  "read:orders": {
    description: "Orders, what was in them, and where they were going. Contact details are masked.",
    label: "Orders"
  },
  "read:products": {
    description: "Your catalogue: titles, prices, and stock. Your cost price is never shared.",
    label: "Products"
  },
  "read:store": {
    description: "Your store's name, currency, and timezone. Required for the key to work at all.",
    label: "Store profile"
  },
  "write:marketing": { description: "Not available yet.", label: "Marketing (coming soon)" },
  "write:orders": { description: "Not available yet.", label: "Edit orders (coming soon)" },
  "write:products": { description: "Not available yet.", label: "Edit products (coming soon)" }
};

export function AiIntegrationSettings({
  canManage,
  connection,
  createAction,
  deleteAction,
  grantableScopes,
  keys,
  revealAction,
  revokeAction
}: AiIntegrationSettingsProps) {
  const [createState, createFormAction, isCreating] = useActionState(createAction, initialState);
  const liveKeys = keys.filter((key) => statusOf(key) === "active");

  return (
    <div className="grid gap-5">
      <DashboardCard title="Connection">
        <ConnectionSummary connection={connection} liveKeyCount={liveKeys.length} />
      </DashboardCard>

      <DashboardCard title="Create an API key">
        <form action={createFormAction} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem] sm:items-start">
            <label className="grid gap-2 text-sm font-medium text-[#33343e]">
              Name
              <input
                autoComplete="off"
                className={inputClass}
                disabled={!canManage}
                maxLength={80}
                name="name"
                placeholder="StoreOS AI"
                spellCheck={false}
                type="text"
              />
              {createState.fieldErrors?.name ? (
                <span className="text-[11px] font-medium text-rose-600">
                  {createState.fieldErrors.name}
                </span>
              ) : (
                <span className="text-[11px] font-normal leading-5 text-[#858691]">
                  So you can tell your keys apart later. Only you ever see it.
                </span>
              )}
            </label>

            <label className="grid gap-2 text-sm font-medium text-[#33343e]">
              Expires (optional)
              <input className={inputClass} disabled={!canManage} name="expiresAt" type="date" />
              {createState.fieldErrors?.expiresAt ? (
                <span className="text-[11px] font-medium text-rose-600">
                  {createState.fieldErrors.expiresAt}
                </span>
              ) : (
                <span className="text-[11px] font-normal leading-5 text-[#858691]">
                  Leave blank and it works until you revoke it.
                </span>
              )}
            </label>
          </div>

          <fieldset className="grid gap-2 border-0 p-0">
            <legend className="mb-1 p-0 text-sm font-medium text-[#33343e]">
              What this key may read
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {grantableScopes.map((scope) => (
                <label
                  className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[#ececf5] bg-[#fcfcff] p-3 hover:border-[#cdbdf7]"
                  key={scope}
                >
                  <input
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#6d3cf5]"
                    defaultChecked={scope === "read:store"}
                    disabled={!canManage}
                    name="scopes"
                    type="checkbox"
                    value={scope}
                  />
                  <span className="grid gap-0.5">
                    <span className="text-[13px] font-semibold text-[#292a34]">
                      {scopeCopy[scope].label}
                    </span>
                    <span className="text-[11px] leading-5 text-[#858691]">
                      {scopeCopy[scope].description}
                    </span>
                    <span className="font-mono text-[10px] text-[#a2a3b0]">{scope}</span>
                  </span>
                </label>
              ))}
            </div>
            {createState.fieldErrors?.scopes ? (
              <span className="text-[11px] font-medium text-rose-600">
                {createState.fieldErrors.scopes}
              </span>
            ) : (
              <span className="text-[11px] leading-5 text-[#858691]">
                Tick only what StoreOS AI needs. You cannot change a key&apos;s scopes afterwards —
                create another and delete this one. Writing to your store is not available to any
                key yet.
              </span>
            )}
          </fieldset>

          <div>
            <button
              className={primaryButtonClass}
              disabled={!canManage || isCreating}
              type="submit"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              {isCreating ? "Creating..." : "Create API key"}
            </button>
          </div>

          {createState.status === "error" && createState.message ? (
            <ActionMessage state={createState} />
          ) : null}

          {createState.createdKey ? (
            <ApiKeyRevealPanel createdKey={createState.createdKey} />
          ) : null}
        </form>
      </DashboardCard>

      <DashboardCard title={`API keys (${keys.length})`}>
        {keys.length === 0 ? (
          <p className="m-0 rounded-lg border border-dashed border-[#dedceb] bg-[#fafaff] px-6 py-8 text-center text-sm text-[#858691]">
            No API keys yet. Create one above to let StoreOS AI read this store.
          </p>
        ) : (
          <div className="grid gap-3">
            {keys.map((key) => (
              <ApiKeyRow
                canManage={canManage}
                apiKey={key}
                deleteAction={deleteAction}
                key={key.id}
                revealAction={revealAction}
                revokeAction={revokeAction}
              />
            ))}
          </div>
        )}
      </DashboardCard>
    </div>
  );
}

function ConnectionSummary({
  connection,
  liveKeyCount
}: {
  connection: StoreOSConnectionView;
  liveKeyCount: number;
}) {
  const isConnected = connection.phase === "connected";

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Plug className="h-4 w-4 text-[#6d3cf5]" />
          <span className="text-sm font-semibold text-[#292a34]">StoreOS AI</span>
          {isConnected ? (
            <StatusBadge tone="green">Connected</StatusBadge>
          ) : connection.phase === "failed" ? (
            <StatusBadge tone="red">{storeOSPhaseLabel(connection.phase)}</StatusBadge>
          ) : (
            <StatusBadge tone="amber">{storeOSPhaseLabel(connection.phase)}</StatusBadge>
          )}
        </div>
        <a className="text-xs font-semibold text-[#6d3cf5] hover:underline" href="/dashboard/ai">
          Open Dash AI
        </a>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <SummaryStat
          label="Read API"
          value={
            liveKeyCount > 0
              ? `${liveKeyCount} active key${liveKeyCount === 1 ? "" : "s"}`
              : "No active keys"
          }
        />
        <SummaryStat label="Connection ID" value={connection.connectionId ?? "Not assigned"} />
        <SummaryStat
          label="Last synced"
          value={connection.lastSyncedAt ? formatDateTime(connection.lastSyncedAt) : "Never"}
        />
      </dl>

      <p className="m-0 text-[11px] leading-5 text-[#858691]">
        Two halves, and they are independent. The outbound connection is how this store talks to
        StoreOS AI; an API key is how StoreOS AI reads this store back. Keys are read-only — nothing
        can change your products, orders, or settings through them.
      </p>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-lg border border-[#ececf5] bg-[#fcfcff] p-3">
      <dt className="text-[11px] font-medium text-[#858691]">{label}</dt>
      <dd className="m-0 text-[13px] font-semibold text-[#292a34]">{value}</dd>
    </div>
  );
}

/**
 * One key in the list.
 *
 * Three actions, each with its own state because each has its own message and
 * more than one can have been used before the page next reloads. Reveal is a
 * plain form, so the row id travels in the request rather than being wired up in
 * an onClick; revoke and delete go through the shared confirmation dialog, which
 * hands back an empty FormData and so needs the id set for it.
 *
 * Revoke and delete are both offered because they answer different questions.
 * Revoking leaves the row in place as a record that the key existed and when it
 * was turned off; deleting removes it once the seller has decided it was a
 * mistake they do not want to keep looking at. Neither is weaker: authentication
 * reads the stored hash on every request, so a deleted key stops working for
 * exactly the same reason a revoked one does.
 */
function ApiKeyRow({
  apiKey,
  canManage,
  deleteAction,
  revealAction,
  revokeAction
}: {
  apiKey: ApiKeySummary;
  canManage: boolean;
  deleteAction: AiKeyFormAction;
  revealAction: AiKeyFormAction;
  revokeAction: AiKeyFormAction;
}) {
  const [revealState, revealFormAction, isRevealing] = useActionState(revealAction, initialState);
  const [revokeState, revokeFormAction] = useActionState(revokeAction, initialState);
  const [deleteState, deleteFormAction] = useActionState(deleteAction, initialState);
  const [dismissed, setDismissed] = useState(false);
  const status = statusOf(apiKey);
  const revealedKey = revealState.revealedKey;

  // A fresh reveal reopens the panel the seller closed a moment ago, rather than
  // appearing to do nothing because `dismissed` is still set from last time.
  useEffect(() => {
    setDismissed(false);
  }, [revealedKey?.key]);

  const showSecret = Boolean(revealedKey) && !dismissed;

  return (
    <div className="grid gap-3 rounded-lg border border-[#ececf5] bg-[#fcfcff] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[#292a34]">{apiKey.name}</span>
            <span className="rounded-md border border-[#dedcea] bg-white px-2 py-0.5 font-mono text-[11px] text-[#555762]">
              sk_live_…{apiKey.hint}
            </span>
            {status === "active" ? (
              <StatusBadge tone="green">Active</StatusBadge>
            ) : status === "revoked" ? (
              <StatusBadge tone="red">Revoked</StatusBadge>
            ) : (
              <StatusBadge tone="amber">Expired</StatusBadge>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {apiKey.scopes.map((scope) => (
              <span
                className="rounded-full bg-violet-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-violet-700"
                key={scope}
              >
                {scope}
              </span>
            ))}
          </div>

          <span className="text-[11px] leading-5 text-[#858691]">
            Created {formatDate(apiKey.createdAt)} · Last used{" "}
            {apiKey.lastUsedAt ? formatDateTime(apiKey.lastUsedAt) : "never"} ·{" "}
            {apiKey.revokedAt
              ? `Revoked ${formatDate(apiKey.revokedAt)}`
              : apiKey.expiresAt
                ? `Expires ${formatDate(apiKey.expiresAt)}`
                : "No expiry"}
          </span>
        </div>

        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            {apiKey.canReveal ? (
              showSecret ? (
                <button className={rowButtonClass} onClick={() => setDismissed(true)} type="button">
                  <Eye className="h-3.5 w-3.5" />
                  Close
                </button>
              ) : (
                <form action={revealFormAction}>
                  <input name="apiKeyId" type="hidden" value={apiKey.id} />
                  <button className={rowButtonClass} disabled={isRevealing} type="submit">
                    {isRevealing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                    {isRevealing ? "Opening..." : "Show key"}
                  </button>
                </form>
              )
            ) : (
              // Rendered disabled rather than omitted. A control that is simply
              // absent reads as a missing feature, and the seller is left
              // hunting for a copy button that was never going to be there.
              <button
                className={rowButtonClass}
                disabled
                title="This key was issued before the store kept a readable copy of it"
                type="button"
              >
                <EyeOff className="h-3.5 w-3.5" />
                Cannot show
              </button>
            )}

            {status !== "revoked" ? (
              <DeleteConfirmationButton
                // The confirmation dialog hands back an empty FormData, so the
                // row's id is filled in here rather than by a hidden input.
                action={(formData) => {
                  formData.set("apiKeyId", apiKey.id);
                  revokeFormAction(formData);
                }}
                ariaLabel={`Revoke the API key ${apiKey.name}`}
                className={rowDangerButtonClass}
                title={`Revoke ${apiKey.name} — it stops working but stays in this list`}
              >
                <Ban className="h-3.5 w-3.5" />
                Revoke
              </DeleteConfirmationButton>
            ) : null}

            <DeleteConfirmationButton
              action={(formData) => {
                formData.set("apiKeyId", apiKey.id);
                deleteFormAction(formData);
              }}
              ariaLabel={`Delete the API key ${apiKey.name}`}
              className={rowDangerButtonClass}
              title={`Delete ${apiKey.name} — it stops working and leaves this list`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </DeleteConfirmationButton>
          </div>
        ) : null}
      </div>

      {showSecret && revealedKey ? (
        <SecretValue defaultVisible label={`API key for ${apiKey.name}`} value={revealedKey.key} />
      ) : null}

      {canManage && !apiKey.canReveal ? (
        <p className="m-0 rounded-lg border border-[#f4e6d8] bg-[#fffaf4] px-3 py-2.5 text-[11px] leading-5 text-[#8a6134]">
          This key cannot be shown or copied. It was issued before this store kept a readable copy,
          so only a one-way hash of it exists — nobody, here or anywhere, can read it back. It still
          works. If you need the key itself, create a new one above and delete this one.
        </p>
      ) : null}

      {revealState.status === "error" && revealState.message ? (
        <ActionMessage state={revealState} />
      ) : null}
      {revokeState.status !== "idle" && revokeState.message ? (
        <ActionMessage state={revokeState} />
      ) : null}
      {deleteState.status !== "idle" && deleteState.message ? (
        <ActionMessage state={deleteState} />
      ) : null}
    </div>
  );
}

function ActionMessage({ state }: { state: AiKeyActionState }) {
  const isSuccess = state.status === "success";

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
 * Revoked beats expired: a key that was revoked and then also passed its expiry
 * is still, to the seller, the one they turned off.
 */
function statusOf(apiKey: ApiKeySummary): "active" | "expired" | "revoked" {
  if (apiKey.revokedAt) {
    return "revoked";
  }

  if (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now()) {
    return "expired";
  }

  return "active";
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}
