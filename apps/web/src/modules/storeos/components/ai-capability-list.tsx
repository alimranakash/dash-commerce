import type { StoreOSAiCapability } from "@dash/storeos-sdk";
import { StatusBadge } from "../../../components/dashboard/status-badge";
import { STOREOS_CAPABILITY_CATALOG } from "../storeos-capabilities";

/**
 * What StoreIM AI can do for this store, and what it will be able to do.
 *
 * Two different questions are answered per row, and conflating them is what
 * makes a roadmap page dishonest. `available` is what the platform has built;
 * `granted` is what the AI service actually handed this store's connection. A
 * surface that is built but not granted is not usable, and a seller reading
 * "Active" next to something that answers nothing would rightly stop trusting
 * the page.
 *
 * Planned rows are listed rather than hidden. They are the reason the connection
 * negotiates every capability up front — a store that connects today does not
 * have to reconnect the day Product AI ships — and saying so is more useful than
 * a short list that looks finished.
 *
 * A grid rather than a stack of full-width bars: seven near-identical rows read
 * as a wall on a wide screen, while three columns of small cards read as a
 * catalog, which is what this is.
 */
export function AiCapabilityList({ granted }: { granted: StoreOSAiCapability[] }) {
  const grantedSet = new Set<string>(granted);

  return (
    <div className="aiset-caps">
      {STOREOS_CAPABILITY_CATALOG.map((capability) => {
        const state = capabilityState(capability.available, grantedSet.has(capability.key));

        return (
          <article className="aiset-cap" key={capability.key}>
            <header className="aiset-cap-head">
              <strong>{capability.label}</strong>
              <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
            </header>
            <p>{capability.description}</p>
            <code>{capability.key}</code>
          </article>
        );
      })}
    </div>
  );
}

/** How many of the built surfaces this store can actually use, for the heading. */
export function capabilityCounts(granted: StoreOSAiCapability[]) {
  const grantedSet = new Set<string>(granted);
  const available = STOREOS_CAPABILITY_CATALOG.filter((entry) => entry.available);

  return {
    active: available.filter((entry) => grantedSet.has(entry.key)).length,
    available: available.length,
    total: STOREOS_CAPABILITY_CATALOG.length
  };
}

function capabilityState(available: boolean, isGranted: boolean) {
  if (!available) {
    return { label: "Planned", tone: "gray" } as const;
  }

  // Built, but this store's connection has not been granted it — usually just
  // "not connected yet", which the panel above already explains in a sentence.
  if (!isGranted) {
    return { label: "Not granted", tone: "amber" } as const;
  }

  return { label: "Active", tone: "green" } as const;
}
