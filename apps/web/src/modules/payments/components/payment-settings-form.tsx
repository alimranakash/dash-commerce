"use client";

import { Button } from "@dash/ui";
import { useActionState, type ReactNode } from "react";
import type { PaymentSettingsActionState } from "../payment.actions";
import { paymentMethodTypes, type PaymentMethodTypeValue } from "../payment.schema";

export type PaymentSettingsFormMethod = {
  type: PaymentMethodTypeValue;
  name: string;
  description?: string | null;
  instructions?: string | null;
  accountNumber?: string | null;
  accountType?: string | null;
  isEnabled: boolean;
};

type PaymentSettingsFormProps = {
  action: (
    state: PaymentSettingsActionState,
    formData: FormData
  ) => Promise<PaymentSettingsActionState>;
  methods: PaymentSettingsFormMethod[];
};

const initialState: PaymentSettingsActionState = {
  status: "idle"
};

const labels: Record<PaymentMethodTypeValue, string> = {
  COD: "Cash on delivery",
  BKASH_MANUAL: "Manual bKash",
  NAGAD_MANUAL: "Manual Nagad",
  ROCKET_MANUAL: "Manual Rocket"
};

export function PaymentSettingsForm({ action, methods }: PaymentSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="resource-form payment-settings-form">
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      {paymentMethodTypes.map((type) => {
        const method = methods.find((entry) => entry.type === type);

        return (
          <section className="payment-method-panel" key={type}>
            <div className="payment-method-heading">
              <div>
                <h2>{labels[type]}</h2>
                <p>{type === "COD" ? "Let customers pay on delivery." : "Display manual payment details at checkout."}</p>
              </div>
              <label className="toggle-row">
                <input defaultChecked={method?.isEnabled ?? false} name={`${type}.isEnabled`} type="checkbox" />
                Enabled
              </label>
            </div>
            <div className="form-grid">
              <FieldError errors={state.fieldErrors} name={`methods.${type}.name`}>
                <label>
                  Display name
                  <input defaultValue={method?.name ?? labels[type]} name={`${type}.name`} required type="text" />
                </label>
              </FieldError>
              <FieldError errors={state.fieldErrors} name={`methods.${type}.accountNumber`}>
                <label>
                  Account number
                  <input defaultValue={method?.accountNumber ?? ""} name={`${type}.accountNumber`} type="text" />
                </label>
              </FieldError>
              <FieldError errors={state.fieldErrors} name={`methods.${type}.accountType`}>
                <label>
                  Account type
                  <input defaultValue={method?.accountType ?? ""} name={`${type}.accountType`} type="text" />
                </label>
              </FieldError>
              <FieldError errors={state.fieldErrors} name={`methods.${type}.description`}>
                <label>
                  Description
                  <input defaultValue={method?.description ?? ""} name={`${type}.description`} type="text" />
                </label>
              </FieldError>
            </div>
            <FieldError errors={state.fieldErrors} name={`methods.${type}.instructions`}>
              <label>
                Payment instructions
                <textarea defaultValue={method?.instructions ?? ""} name={`${type}.instructions`} rows={4} />
              </label>
            </FieldError>
          </section>
        );
      })}
      <div className="form-actions">
        <Button className="primary action-button" disabled={isPending} type="submit">
          {isPending ? "Saving..." : "Save payment settings"}
        </Button>
      </div>
    </form>
  );
}

function FieldError({
  children,
  errors,
  name
}: {
  children: ReactNode;
  errors?: Record<string, string> | undefined;
  name: string;
}) {
  return (
    <div className="field-shell">
      {children}
      {errors?.[name] ? <span className="field-error">{errors[name]}</span> : null}
    </div>
  );
}
