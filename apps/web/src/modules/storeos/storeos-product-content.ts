import {
  createStoreOSClientFromEnv,
  isStoreOSLinkProvisioned,
  type StoreOSProductContentField,
  type StoreOSProductContentResponse,
  type StoreOSProductContentSource,
  type StoreOSProductContentTone
} from "@dash/storeos-sdk";
import { ensureStoreOSConnectionForStore } from "./storeos.service";

export type StoreOSProductContentRequest = {
  fields: readonly StoreOSProductContentField[];
  instructions?: string | null;
  locale: string;
  product: StoreOSProductContentSource;
  tone: StoreOSProductContentTone;
};

/**
 * The `ai:product` capability, wired the same way `sendStoreOSAssistantMessage`
 * wires `ai:chat`.
 *
 * Returns `null` rather than throwing on every unusable path — no platform
 * link, no connected store, a remote error, a transport failure. The caller
 * composes an offline draft instead and tells the seller which of the two they
 * are reading, so a store whose connection is not up still gets a first draft
 * rather than an error page.
 *
 * No prompt, no model choice, and no provider call lives here. What this side
 * contributes is an authenticated store, a product envelope derived from that
 * store's own row, and a connection to send them over.
 */
export async function requestStoreOSProductContent(
  storeId: string,
  request: StoreOSProductContentRequest
): Promise<StoreOSProductContentResponse | null> {
  if (!isStoreOSLinkProvisioned()) {
    return null;
  }

  const connection = await ensureStoreOSConnectionForStore(storeId);

  if (!connection.storeosConnectionId || connection.status !== "connected") {
    return null;
  }

  try {
    return await createStoreOSClientFromEnv().generateProductContent({
      connectionId: connection.storeosConnectionId,
      context: {
        platformType: "dash",
        storeId
      },
      fields: [...request.fields],
      ...(request.instructions ? { instructions: request.instructions } : {}),
      locale: request.locale,
      product: request.product,
      tone: request.tone
    });
  } catch {
    // The reason is an integration detail — a URL, a status code, sometimes a
    // remote error body. None of it helps a seller whose only useful next step
    // is to edit the offline draft or try again.
    return null;
  }
}
