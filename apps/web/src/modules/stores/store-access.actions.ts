"use server";

import { getViewerCanManageStore } from "./queries";

/**
 * Whether the signed-in person may change store settings, for client components
 * that draw their own UI — the dashboard sidebar being the only caller today.
 *
 * Mirrors `getEntitledFeaturesAction`: read-only, and it swallows failures
 * rather than throwing so a sidebar cannot break a page. It returns `true` on
 * failure because every page and action behind these links checks for itself and
 * fails closed; hiding an owner's whole settings menu over a transient error
 * would be the worse mistake.
 */
export async function getViewerCanManageStoreAction(): Promise<boolean> {
  try {
    return await getViewerCanManageStore();
  } catch {
    return true;
  }
}
