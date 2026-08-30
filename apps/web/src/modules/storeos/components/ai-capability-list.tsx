import type { StoreOSAiCapability } from "@dash/storeos-sdk";
import { StatusBadge } from "../../../components/dashboard/status-badge";
import { STOREOS_CAPABILITY_CATALOG } from "../storeos-capabilities";

/**
 * What Dash AI can do for this store, and what it will be able to do.
 *
 * Two different questions are answered per row, and conflating them is what
 * makes a roadmap page dishonest. `available` is what DashCommerce has built;
 * `granted` is what StoreOS actually handed this store's connection. A surface
 * that is built but not granted is not usable, and a seller reading "Active"
 * next to something that answers nothing would rightly stop trusting the page.
 *
 * Planned rows are listed rather than hidden. They are the reason the connection
 * negotiates every capability up front — a store that connects today does not
 * have to reconnect the day Product AI ships — and saying so is more useful than
 * a short list that looks finished.
 */
export function AiCapabilityList({ granted }: { granted: StoreOSAiCapability[] }) {
  const grantedSet = new Set<string>(granted);

  return (
    <div className="grid gap-2">
      {STOREOS_CAPABILITY_CATALOG.map((capability) => {
        const state = capabilityState(capability.available, grantedSet.has(capability.key));

        return (
          <div
            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-[#ececf5] bg-[#fcfcff] p-3"
            key={capability.key}
          >
            <div className="grid gap-0.5">
              <span className="text-[13px] font-semibold text-[#292a34]">{capability.label}</span>
              <span className="text-[11px] leading-5 text-[#858691]">{capability.description}</span>
              <span className="font-mono text-[10px] text-[#a2a3b0]">{capability.key}</span>
            </div>
            <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
          </div>
        );
      })}
    </div>
  );
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
