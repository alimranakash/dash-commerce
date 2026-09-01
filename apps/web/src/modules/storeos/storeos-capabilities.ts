import { STOREOS_AI_CAPABILITIES, type StoreOSAiCapability } from "@dash/storeos-sdk";

/**
 * The StoreIM AI capability map — the boundary, not the implementation.
 *
 * StoreIM AI is one connection with several surfaces hanging off it:
 *
 *     StoreIM AI
 *     ├── Chat            ai:chat        (live)
 *     ├── Product AI      ai:product     (live)
 *     ├── Marketing AI    ai:marketing   (planned)
 *     ├── Customer AI     ai:customer    (planned)
 *     ├── Order AI        ai:order       (planned)
 *     ├── Analytics AI    ai:analytics   (planned)
 *     └── Automation AI   ai:automation  (planned)
 *
 * They are declared together so that adding Product AI later is a matter of
 * flipping `available` and writing one service function — not of inventing a
 * second connection, a second credential path, or a second idea of what a
 * capability is. Every one of them will run on the *same* StoreOS connection and
 * the same central engine: none of the prompting, model selection, or provider
 * choice belongs on this side of the line. DashCommerce's job stops at
 * authenticated store context plus a connection to send it over.
 *
 * `available` is what DashCommerce has built. It is not permission: what a given
 * store may actually use is whatever StoreOS granted, which lands in
 * `StoreOSConnection.capabilities`.
 */
export type StoreOSCapabilityDefinition = {
  available: boolean;
  description: string;
  key: StoreOSAiCapability;
  label: string;
};

export const STOREOS_CAPABILITY_CATALOG: readonly StoreOSCapabilityDefinition[] = [
  {
    available: false,
    description: "Sales, stock, and store-health questions answered over time.",
    key: "ai:analytics",
    label: "Analytics AI"
  },
  {
    available: false,
    description: "Rules and follow-ups that run without the seller starting them.",
    key: "ai:automation",
    label: "Automation AI"
  },
  {
    available: true,
    description: "Ask operational questions about this store in the dashboard.",
    key: "ai:chat",
    label: "Chat"
  },
  {
    available: false,
    description: "Customer segments, retention, and support replies.",
    key: "ai:customer",
    label: "Customer AI"
  },
  {
    available: false,
    description: "Campaign copy, audiences, and offer suggestions.",
    key: "ai:marketing",
    label: "Marketing AI"
  },
  {
    available: false,
    description: "Order triage, fulfilment hints, and return handling.",
    key: "ai:order",
    label: "Order AI"
  },
  {
    available: true,
    description: "Product copy, SEO fields, and social captions written per product.",
    key: "ai:product",
    label: "Product AI"
  }
];

/**
 * What a connection asks StoreOS for.
 *
 * The whole catalog, deliberately, including the surfaces DashCommerce cannot
 * use yet: negotiating them at connect time means a store that connected today
 * does not have to reconnect the day Product AI ships. StoreOS decides what it
 * actually grants, and `readGrantedCapabilities` is what reads the answer back.
 */
export function requestedCapabilities(): StoreOSAiCapability[] {
  return [...STOREOS_AI_CAPABILITIES];
}

export function isCapabilityAvailable(key: StoreOSAiCapability) {
  return STOREOS_CAPABILITY_CATALOG.some(
    (capability) => capability.key === key && capability.available
  );
}
