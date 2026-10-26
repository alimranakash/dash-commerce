import { getStoreSettingsRecord } from "../settings/settings.repository";
import { buildSaleReceipt, type ReceiptStoreRecord } from "./sale-receipt";
import { getSaleByIdForStore } from "./sale.repository";

/**
 * One sale's receipt, for the store the session resolved and no other.
 *
 * The sale is read by organization *and* store, exactly as the sale page reads
 * it, so an id from another shop — guessed, pasted, or left in a bookmark —
 * resolves to nothing; the header comes from this store's own settings. Both
 * are reads, and nothing on the receipt's path writes: printing, refreshing
 * and reprinting cannot move stock, payment, the customer or loyalty.
 */
export async function getSaleReceiptForStore(
  store: ReceiptStoreRecord & { id: string; organizationId: string },
  saleId: string
) {
  const [sale, settings] = await Promise.all([
    getSaleByIdForStore(store.organizationId, store.id, saleId),
    getStoreSettingsRecord(store.id)
  ]);

  if (!sale) {
    return null;
  }

  return { receipt: buildSaleReceipt(sale, store, settings), saleId: sale.id };
}
