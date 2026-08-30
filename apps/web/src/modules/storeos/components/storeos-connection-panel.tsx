"use client";

import { Button } from "@dash/ui";
import { useActionState } from "react";
import type { StoreOSConnectionView } from "../storeos-connection-state";
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
 * The connection panel.
 *
 * Everything shown here was decided on the server: `connection` arrives as a
 * phase and a sentence, so this component has no idea whether the platform link
 * exists and cannot leak it. While the action is in flight the phase is
 * `connecting`, which is the only state the browser owns.
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
    ? "Connecting Dash AI to this store."
    : (state.detail ?? connection.detail);

  return (
    <section className="storeos-panel">
      <div>
        <p className="eyebrow">Dash AI</p>
        <h2>Native AI connection</h2>
        <p>
          StoreIM connects to the AI service internally so sellers can use AI operations without a
          separate login.
        </p>
      </div>
      <dl className="order-totals">
        <dt>Status</dt>
        <dd>{storeOSPhaseLabel(phase)}</dd>
        <dt>Connection ID</dt>
        <dd>{connection.connectionId ?? "Not assigned"}</dd>
        <dt>Last synced</dt>
        <dd>{connection.lastSyncedAt ?? "Never"}</dd>
      </dl>
      <p className={state.status === "error" && !isPending ? "form-error" : undefined}>{detail}</p>
      {canManage ? (
        <form action={formAction}>
          <Button className="primary action-button" disabled={isPending} type="submit">
            {isPending ? "Connecting..." : "Connect / reconnect Dash AI"}
          </Button>
        </form>
      ) : (
        <p>Only the store owner or an admin can connect or reconnect Dash AI.</p>
      )}
    </section>
  );
}
