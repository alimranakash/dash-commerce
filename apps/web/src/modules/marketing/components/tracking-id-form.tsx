"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { PlanUpgradeDialog } from "../../billing/components/plan-upgrade-dialog";
import type { PlanFeatureKey } from "../../billing/plan-features";
import type { MarketingActionState } from "../marketing.actions";
import type { MarketingIdField } from "../marketing.schema";
import {
  IdField,
  TrackingCard,
  TrackingReadOnlyNotice,
  TrackingSaveBar,
  TrackingStatusBanner
} from "./tracking-fields";

export type TrackingIdFieldSpec = {
  docHref?: string;
  field: MarketingIdField;
  helper: string;
  label: string;
  value: string;
};

/**
 * The shape five of the seven pages take: one platform, one card, a handful of
 * IDs that end up in a public script tag.
 *
 * Google Analytics, Meta, Google Ads, TikTok and GTM differ only in which
 * fields they list, so they share a component rather than five near-identical
 * files that would each have to be found and fixed the next time the save bar
 * or the plan gate changes.
 */
export function TrackingIdForm({
  action,
  canManage,
  fields,
  icon,
  subtitle,
  title
}: {
  action: (state: MarketingActionState, formData: FormData) => Promise<MarketingActionState>;
  canManage: boolean;
  fields: TrackingIdFieldSpec[];
  /** A rendered element — every caller is a server component. See `TrackingCard`. */
  icon: ReactNode;
  subtitle: string;
  title: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(action, {
    status: "idle"
  } as MarketingActionState);
  const [lockedFeature, setLockedFeature] = useState<PlanFeatureKey | null>(null);

  // `useActionState` hands back a fresh object per submit, so re-submitting
  // after dismissing the dialog re-opens it.
  useEffect(() => {
    if (state.lockedFeature) {
      setLockedFeature(state.lockedFeature);
    }
  }, [state]);

  return (
    <form action={formAction} className="grid max-w-2xl gap-5" ref={formRef}>
      <PlanUpgradeDialog feature={lockedFeature} onClose={() => setLockedFeature(null)} />
      {!canManage ? <TrackingReadOnlyNotice /> : null}
      {state.lockedFeature ? null : (
        <TrackingStatusBanner message={state.message} status={state.status} />
      )}

      <TrackingCard icon={icon} subtitle={subtitle} title={title}>
        {fields.map((spec) => (
          <IdField
            disabled={!canManage}
            {...(spec.docHref ? { docHref: spec.docHref } : {})}
            error={state.fieldErrors?.[spec.field]}
            field={spec.field}
            helper={spec.helper}
            key={spec.field}
            label={spec.label}
            value={spec.value}
          />
        ))}
      </TrackingCard>

      {canManage ? (
        <TrackingSaveBar isPending={isPending} onReset={() => formRef.current?.reset()} />
      ) : null}
    </form>
  );
}
