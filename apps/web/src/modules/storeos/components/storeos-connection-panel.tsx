"use client";

import { Button } from "@dash/ui";
import { useActionState } from "react";
import type { StoreOSReconnectActionState } from "../storeos.actions";

type StoreOSConnectionPanelProps = {
  action: (
    state: StoreOSReconnectActionState,
    formData: FormData
  ) => Promise<StoreOSReconnectActionState>;
  connection: {
    lastSyncedAt: string | null;
    status: string;
    storeosConnectionId: string | null;
  } | null;
  isConfigured: boolean;
};

const initialState: StoreOSReconnectActionState = {
  status: "idle"
};

export function StoreOSConnectionPanel({
  action,
  connection,
  isConfigured
}: StoreOSConnectionPanelProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <section className="storeos-panel">
      <div>
        <p className="eyebrow">StoreIM AI</p>
        <h2>Native AI connection</h2>
        <p>
          StoreIM connects to the AI service internally so sellers can use AI operations without a
          separate login.
        </p>
      </div>
      <dl className="order-totals">
        <dt>API configured</dt>
        <dd>{isConfigured ? "yes" : "no"}</dd>
        <dt>Status</dt>
        <dd>{connection?.status ?? "pending"}</dd>
        <dt>Connection ID</dt>
        <dd>{connection?.storeosConnectionId ?? "Not assigned"}</dd>
        <dt>Last synced</dt>
        <dd>{connection?.lastSyncedAt ?? "Never"}</dd>
      </dl>
      {state.message ? (
        <p className={state.status === "success" ? "success-message" : "form-error"}>
          {state.message}
        </p>
      ) : null}
      <form action={formAction}>
        <Button className="primary action-button" disabled={isPending} type="submit">
          {isPending ? "Connecting..." : "Connect / reconnect StoreIM AI"}
        </Button>
      </form>
    </section>
  );
}
