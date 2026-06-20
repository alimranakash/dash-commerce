"use client";

import { Button } from "@dash/ui";
import { useActionState, type ReactNode } from "react";
import type { ShippingSettingsActionState } from "../shipping.actions";

type ShippingRateFormData = {
  id: string;
  zoneId: string;
  name: string;
  district: string | null;
  city: string | null;
  area: string | null;
  amount: string;
  isEnabled: boolean;
  sortOrder: number;
};

type ShippingZoneFormData = {
  id: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  sortOrder: number;
  rates: ShippingRateFormData[];
};

type ShippingSettingsFormProps = {
  action: (
    state: ShippingSettingsActionState,
    formData: FormData
  ) => Promise<ShippingSettingsActionState>;
  zones: ShippingZoneFormData[];
};

const initialState: ShippingSettingsActionState = {
  status: "idle"
};

export function ShippingSettingsForm({ action, zones }: ShippingSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="resource-form shipping-settings-form">
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      {zones.map((zone) => (
        <section className="shipping-zone-panel" key={zone.id}>
          <input name="zoneId" type="hidden" value={zone.id} />
          <input name={`zone.${zone.id}.sortOrder`} type="hidden" value={zone.sortOrder} />
          <div className="payment-method-heading">
            <div>
              <h2>{zone.name}</h2>
              <p>{zone.description ?? "Manual delivery zone for this store."}</p>
            </div>
            <label className="toggle-row">
              <input
                defaultChecked={zone.isEnabled}
                name={`zone.${zone.id}.isEnabled`}
                type="checkbox"
              />
              Enabled
            </label>
          </div>
          <label>
            Zone note
            <input
              defaultValue={zone.description ?? ""}
              name={`zone.${zone.id}.description`}
              type="text"
            />
          </label>
          <div className="shipping-rate-list">
            {zone.rates.length === 0 ? (
              <p className="auth-copy">No rates in this zone yet.</p>
            ) : (
              zone.rates.map((rate) => (
                <RateEditor
                  key={rate.id}
                  rate={rate}
                  zones={zones}
                />
              ))
            )}
          </div>
        </section>
      ))}
      <section className="shipping-zone-panel">
        <div className="payment-method-heading">
          <div>
            <h2>Add delivery rate</h2>
            <p>Create a flat rate for a district, city, area, or a broad delivery route.</p>
          </div>
        </div>
        <div className="form-grid">
          <label>
            Zone
            <select name="newRate.zoneId">
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rate name
            <input name="newRate.name" placeholder="Mirpur delivery" type="text" />
          </label>
          <label>
            District
            <input name="newRate.district" placeholder="Dhaka" type="text" />
          </label>
          <label>
            City
            <input name="newRate.city" placeholder="Dhaka" type="text" />
          </label>
          <label>
            Area
            <input name="newRate.area" placeholder="Mirpur" type="text" />
          </label>
          <label>
            Amount
            <input inputMode="decimal" name="newRate.amount" placeholder="70.00" type="text" />
          </label>
          <input name="newRate.sortOrder" type="hidden" value="100" />
          <input name="newRate.isEnabled" type="hidden" value="off" />
          <label className="toggle-row">
            <input defaultChecked name="newRate.isEnabled" type="checkbox" />
            Enabled
          </label>
        </div>
      </section>
      <div className="form-actions">
        <Button className="primary action-button" disabled={isPending} type="submit">
          {isPending ? "Saving..." : "Save shipping settings"}
        </Button>
      </div>
    </form>
  );
}

function RateEditor({
  rate,
  zones
}: {
  rate: ShippingRateFormData;
  zones: ShippingZoneFormData[];
}) {
  return (
    <div className="shipping-rate-card">
      <input name="rateId" type="hidden" value={rate.id} />
      <input name={`rate.${rate.id}.sortOrder`} type="hidden" value={rate.sortOrder} />
      <div className="shipping-rate-heading">
        <strong>{rate.name}</strong>
        <label className="toggle-row">
          <input defaultChecked={rate.isEnabled} name={`rate.${rate.id}.isEnabled`} type="checkbox" />
          Enabled
        </label>
      </div>
      <div className="form-grid">
        <label>
          Zone
          <select defaultValue={rate.zoneId} name={`rate.${rate.id}.zoneId`}>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </label>
        <FieldShell>
          <label>
            Rate name
            <input defaultValue={rate.name} name={`rate.${rate.id}.name`} required type="text" />
          </label>
        </FieldShell>
        <label>
          District
          <input defaultValue={rate.district ?? ""} name={`rate.${rate.id}.district`} type="text" />
        </label>
        <label>
          City
          <input defaultValue={rate.city ?? ""} name={`rate.${rate.id}.city`} type="text" />
        </label>
        <label>
          Area
          <input defaultValue={rate.area ?? ""} name={`rate.${rate.id}.area`} type="text" />
        </label>
        <label>
          Amount
          <input
            defaultValue={formatAmount(rate.amount)}
            inputMode="decimal"
            name={`rate.${rate.id}.amount`}
            required
            type="text"
          />
        </label>
      </div>
      <label className="delete-row">
        <input name="deleteRateId" type="checkbox" value={rate.id} />
        Delete this rate
      </label>
    </div>
  );
}

function FieldShell({ children }: { children: ReactNode }) {
  return <div className="field-shell">{children}</div>;
}

function formatAmount(value: string) {
  return Number(value).toFixed(2);
}
