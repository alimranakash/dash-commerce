import { getStoreIdentityById } from "../stores/store.repository";
import { aiStoreContextSchema, type AiStoreContext } from "./ai.schema";

/**
 * What the AI is allowed to know about the store it is talking to.
 *
 * The read itself goes through the stores repository — this module never touches
 * Prisma for commerce data, so the existing store-scoped layer stays the single
 * source of truth and there is no second, subtly different way to load a store.
 *
 * The mapping below is written out field by field rather than spread. That is
 * the point of the file: adding a column to `Store` should require a deliberate
 * line here before it can ever reach an external caller. The result is then
 * parsed by the response schema, so a widened select fails loudly instead of
 * leaking quietly.
 */
export async function getAiStoreContext(storeId: string): Promise<AiStoreContext | null> {
  const store = await getStoreIdentityById(storeId);

  if (!store) {
    return null;
  }

  return aiStoreContextSchema.parse({
    businessType: store.businessType,
    country: store.country,
    currency: store.currency,
    slug: store.slug,
    storeId: store.id,
    storeName: store.name,
    timezone: store.timezone
  });
}
