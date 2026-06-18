"use client";

import { Button } from "@dash/ui";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

const businessTypes = ["Fashion", "Beauty", "Electronics", "Food", "Home", "General"];
const countries = ["Bangladesh", "United States", "United Kingdom", "India", "Canada"];
const currencies = ["BDT", "USD", "GBP", "INR", "CAD"];
const timezones = ["Asia/Dhaka", "America/New_York", "Europe/London", "Asia/Kolkata", "UTC"];

export function OnboardingForm() {
  const router = useRouter();
  const [storeSlug, setStoreSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previewDomain = useMemo(() => `${storeSlug || "store"}.dash.com`, [storeSlug]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      organizationName: String(formData.get("organizationName") ?? ""),
      storeName: String(formData.get("storeName") ?? ""),
      storeSlug: String(formData.get("storeSlug") ?? ""),
      businessType: String(formData.get("businessType") ?? ""),
      country: String(formData.get("country") ?? ""),
      currency: String(formData.get("currency") ?? ""),
      timezone: String(formData.get("timezone") ?? "")
    };

    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Workspace setup failed.");
      setIsSubmitting(false);
      return;
    }

    router.refresh();
    setIsSubmitting(false);
  }

  return (
    <form className="onboarding-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          Organization name
          <input name="organizationName" placeholder="Dash Retail Ltd." required type="text" />
        </label>
        <label>
          Store name
          <input name="storeName" placeholder="Dash Store" required type="text" />
        </label>
      </div>
      <label>
        Store slug
        <input
          maxLength={40}
          minLength={3}
          name="storeSlug"
          onChange={(event) => setStoreSlug(event.target.value)}
          pattern="[a-z0-9-]{3,40}"
          placeholder="dash-store"
          required
          type="text"
        />
      </label>
      <p className="domain-preview">Primary domain: {previewDomain}</p>
      <div className="form-grid">
        <label>
          Business type
          <select defaultValue="General" name="businessType" required>
            {businessTypes.map((businessType) => (
              <option key={businessType} value={businessType}>
                {businessType}
              </option>
            ))}
          </select>
        </label>
        <label>
          Country
          <select defaultValue="Bangladesh" name="country" required>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </label>
        <label>
          Currency
          <select defaultValue="BDT" name="currency" required>
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
        <label>
          Timezone
          <select defaultValue="Asia/Dhaka" name="timezone" required>
            {timezones.map((timezone) => (
              <option key={timezone} value={timezone}>
                {timezone}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <Button className="primary action-button" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Creating workspace..." : "Create workspace"}
      </Button>
    </form>
  );
}
