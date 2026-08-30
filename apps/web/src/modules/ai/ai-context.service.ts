import { getStoreIdentityById } from "../stores/store.repository";
import { aiStoreContextSchema, type AiScope, type AiStoreContext } from "./ai.schema";

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
 *
 * `scopes` is passed in rather than looked up. It is `identity.scopes` from the
 * authenticated key — already resolved by `resolveApiKeyStore`, already filtered
 * through the scope vocabulary by `parseStoredScopes`, and the same array every
 * scope check on every other endpoint reads. Re-deriving it here would be a
 * second answer to a question the auth layer has already answered, and a second
 * answer is a chance for the two to disagree.
 */
export async function getAiStoreContext(
  storeId: string,
  scopes: AiScope[]
): Promise<AiStoreContext | null> {
  const store = await getStoreIdentityById(storeId);

  if (!store) {
    return null;
  }

  return aiStoreContextSchema.parse({
    businessType: store.businessType,
    country: store.country,
    currency: store.currency,
    scopes,
    slug: store.slug,
    storeId: store.id,
    storeName: store.name,
    timezone: store.timezone
  });
}
