import { courierProviderKeys, type CourierProviderKey } from "../courier.types";
import type { CourierProvider } from "./provider.types";
import { steadfastProvider } from "./steadfast";

/**
 * The single file a new provider is added to.
 *
 * Adding Pathao means three files under `providers/pathao/` plus one line here —
 * no change to the schema, repository, service, actions, order detail or the
 * settings form, because settings renders from `credentialFields` and every
 * button renders from `capabilities`.
 */

const implementedProviders: Partial<Record<CourierProviderKey, CourierProvider>> = {
  steadfast: steadfastProvider
};

/**
 * Every carrier the product names, implemented or not. Unimplemented ones are
 * shown as "Coming soon" rather than quietly collecting credentials that
 * nothing reads.
 */
const catalog: Record<CourierProviderKey, { label: string; tagline: string }> = {
  carrybee: { label: "Carry Bee", tagline: "Dhaka-focused same-day delivery" },
  paperfly: { label: "Paperfly", tagline: "Nationwide door-to-door coverage" },
  pathao: { label: "Pathao", tagline: "Nationwide courier and parcel delivery" },
  redx: { label: "RedX", tagline: "Nationwide parcel delivery" },
  steadfast: { label: "Steadfast", tagline: "Nationwide COD parcel delivery" }
};

export type CourierCatalogEntry = {
  implemented: boolean;
  key: CourierProviderKey;
  label: string;
  provider: CourierProvider | null;
  tagline: string;
};

export function getCourierProvider(key: string) {
  return implementedProviders[key as CourierProviderKey] ?? null;
}

export function requireCourierProvider(key: string) {
  const provider = getCourierProvider(key);

  if (!provider) {
    throw new Error(`Courier provider "${key}" is not implemented yet.`);
  }

  return provider;
}

export function isImplementedCourierProvider(key: string) {
  return getCourierProvider(key) !== null;
}

export function listCourierCatalog(): CourierCatalogEntry[] {
  return courierProviderKeys.map((key) => {
    const provider = getCourierProvider(key);
    const entry = catalog[key];

    return {
      implemented: provider !== null,
      key,
      label: provider?.label ?? entry.label,
      provider,
      tagline: entry.tagline
    };
  });
}
