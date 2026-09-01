"use client";

import { Button } from "@dash/ui";
import { useActionState } from "react";
import { StatusBadge } from "../../../components/dashboard/status-badge";
import type { StoreOSConnectionPhase, StoreOSConnectionView } from "../storeos-connection-state";
import { storeOSPhaseLabel } from "../storeos-connection-state";
import type { StoreOSReconnectActionState } from "../storeos.actions";

type StoreOSConnectionPanelProps = {
  action: (
    state: StoreOSReconnectActionState,
    formData: FormData
  ) => Promise<StoreOSReconnectActionState>;
  /** Whether the viewer may reconnect. Members read the status; they do not act on it. */
  canManage: boolean;
  connection: StoreOSConnectionView;
};

const initialState: StoreOSReconnectActionState = {
  status: "idle"
};

/**
 * The platform connection panel.
 *
 * Everything shown here was decided on the server: `connection` arrives as a
 * phase and a sentence, so this component has no idea whether the platform link
 * exists and cannot leak it. While the action is in flight the phase is
 * `connecting`, which is the only state the browser owns.
 *
 * The three facts are a stat row rather than a definition list. On a wide
 * dashboard the old layout put each label at the far left and its value at the
 * far right, which is a long way for an eye to travel to read the word "Never".
 *
 * The button is withheld from a member rather than shown and refused.
 * `reconnectStoreOSAction` guards itself with `requireStoreManager()`, so this
 * is presentation: a control that always fails is worse than one that is
 * honestly absent, and the status beside it is still worth reading.
 */
export function StoreOSConnectionPanel({
  action,
  canManage,
  connection
}: StoreOSConnectionPanelProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const phase = isPending ? "connecting" : (state.phase ?? connection.phase);
  const detail = isPending
    ? "Connecting StoreIM AI to this store."
    : (state.detail ?? connection.detail);
  const failed = state.status === "error" && !isPending;

  return (
    <section className="aiset-section">
      <div className="aiset-head">
        <div className="aiset-head-text">
          <p className="aiset-eyebrow">Platform link</p>
          <h2>Native AI connection</h2>
          <p className="aiset-section-copy">
            StoreIM connects to the AI service internally, so sellers use AI operations without a
            separate login or a second bill.
          </p>
        </div>
        <StatusBadge tone={phaseTone(phase)}>{storeOSPhaseLabel(phase)}</StatusBadge>
      </div>

      <dl className="aiset-stats">
        <div className="aiset-stat">
          <dt>Status</dt>
          <dd>{storeOSPhaseLabel(phase)}</dd>
        </div>
        <div className="aiset-stat">
          <dt>Connection ID</dt>
          <dd>{connection.connectionId ?? "Not assigned"}</dd>
        </div>
        <div className="aiset-stat">
          <dt>Last synced</dt>
          <dd>{connection.lastSyncedAt ?? "Never"}</dd>
        </div>
      </dl>

      <p className={failed ? "form-error" : "aiset-section-copy"}>{detail}</p>

      <div className="aiset-footer">
        <p className="aiset-footer-note">
          {canManage
            ? "Reconnecting re-negotiates every capability below in one round trip."
            : "Only the store owner or an admin can connect or reconnect StoreIM AI."}
        </p>
        {canManage ? (
          <form action={formAction}>
            <Button className="primary action-button" disabled={isPending} type="submit">
              {isPending ? "Connecting..." : "Connect / reconnect"}
            </Button>
          </form>
        ) : null}
      </div>
    </section>
  );
}

/** One tone per phase. "Reconnect required" is amber: it is not broken yet. */
function phaseTone(phase: StoreOSConnectionPhase) {
  const tones = {
    connected: "green",
    connecting: "purple",
    failed: "red",
    "not-connected": "gray",
    "reconnect-required": "amber"
  } as const;

  return tones[phase];
}
