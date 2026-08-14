"use client";

import { useEffect, useState, type ReactNode } from "react";

type SettingsCardProps = {
  children: ReactNode;
  description?: string;
  id?: string;
  title: string;
};

export function SettingsCard({ children, description, id, title }: SettingsCardProps) {
  return (
    <section className="theme-settings-card" id={id}>
      <div className="theme-settings-card-header">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      <div className="theme-settings-card-body">{children}</div>
    </section>
  );
}

export function ColorPickerField({ label, name, value }: { label: string; name: string; value: string }) {
  const [color, setColor] = useState(value);

  // The picker is controlled, so without this it keeps showing the value it
  // mounted with after the saved settings change under it (a template apply,
  // a router refresh) and a later save would write the stale color back.
  useEffect(() => {
    setColor(value);
  }, [value]);

  return (
    <label className="theme-color-field">
      {label}
      <span>
        <input name={name} onChange={(event) => setColor(event.target.value)} type="color" value={color} />
        <input aria-label={`${label} hex`} onChange={(event) => setColor(event.target.value)} pattern="^#[0-9a-fA-F]{6}$" type="text" value={color} />
      </span>
    </label>
  );
}

export function ToggleField({ label, name, value }: { label: string; name: string; value: boolean }) {
  return (
    <label className="theme-toggle-field">
      <span>{label}</span>
      <input defaultChecked={value} name={name} type="checkbox" />
    </label>
  );
}
