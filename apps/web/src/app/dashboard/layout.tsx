import type { ReactNode } from "react";
import { FreeTrialProvider } from "../../modules/billing/components/free-trial-provider";
import { getStoreFreeTrialState } from "../../modules/billing/free-trial";
import { getCurrentStore } from "../../modules/stores/queries";

/**
 * Resolves the store's free year once per dashboard request and hands it to the
 * chrome.
 *
 * A layout rather than a prop on `DashboardShell`: the shell is a client
 * component rendered by every one of the dashboard's pages, so threading this
 * through would mean touching all of them and re-querying on each. Deliberately
 * uses `getCurrentStore()` — the non-redirecting read — because `requireStore()`
 * would bounce an expired store from its own layout before the page it is being
 * sent to could render.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const store = await getCurrentStore();
  const trial = store ? await getStoreFreeTrialState(store.id) : null;

  return (
    <FreeTrialProvider
      value={
        trial
          ? {
              daysRemaining: trial.daysRemaining,
              endsAtLabel: formatDate(trial.endsAt),
              isExpired: trial.isExpired,
              totalDays: trial.totalDays
            }
          : null
      }
    >
      {children}
    </FreeTrialProvider>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium"
  }).format(date);
}
