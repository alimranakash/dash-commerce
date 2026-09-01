"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { ZodError } from "zod";
import { readClientIp } from "../../lib/request-ip";
import { saveShoppingAgentSettings } from "../ai-provider/ai-provider.service";
import type { AiSettingsView } from "../ai-provider/ai-provider.schema";
import type { PlanFeatureKey } from "../billing/plan-features";
import { PlanFeatureError, requirePlanFeature } from "../billing/subscription-limits";
import { storefrontBasePath } from "../storefront/base-path";
import { getStorefrontBySlug } from "../storefront/resolver";
import { requireStoreManager } from "../stores/queries";
import {
  askShoppingAgent,
  getShoppingAgentCapability,
  runShoppingAgentAction,
  type ShoppingAgentCapability,
  type ShoppingAgentStore
} from "./shopping-agent.service";
import {
  shoppingAgentActionSchema,
  type ShoppingAgentActionResult,
  type ShoppingAgentAskInput,
  type ShoppingAgentReply
} from "./shopping-agent.schema";

/**
 * The three entry points behind the AI Shopping Agent.
 *
 * Two of them are the only server actions in this codebase called by people who
 * are not signed in, so the tenancy story is worth stating plainly.
 *
 * A shopper has no session, so the store cannot come from one. It comes from the
 * **slug the storefront was rendered for**, resolved here through
 * `getStorefrontBySlug` — the same public resolver `/api/cart` and
 * `/api/checkout` use, which matches only a live store and returns only its
 * public row. A slug is therefore not a capability: naming another shop's slug
 * reads that shop's public catalogue and writes that shop's own cart cookie,
 * which is exactly what visiting its storefront would have done. There is no
 * cross-tenant read here because there is nothing private on the other side.
 *
 * What the browser cannot do is choose a *store id*. Nothing in the payload is
 * an id, and every downstream call is scoped by the id the resolver returned.
 *
 * `saveShoppingAgentSettingsAction` is the odd one out and is guarded the other
 * way: `requireStoreManager()`, matching `saveAiProviderSettingsAction`, because
 * switching on a public assistant that spends the shop's API allowance is the
 * same class of act as configuring the credential it spends.
 */

export async function askShoppingAgentAction(input: {
  ask: ShoppingAgentAskInput;
  storeSlug: string;
}): Promise<ShoppingAgentReply> {
  const store = await resolveAgentStore(input.storeSlug);

  if (!store) {
    return {
      action: null,
      actionPreview: null,
      answer: "This shop is not available right now.",
      comparison: null,
      followUps: [],
      products: [],
      source: "guided",
      warnings: []
    };
  }

  try {
    return await askShoppingAgent({
      basePath: await storefrontBasePath(store.slug),
      clientIp: readClientIp(await headers()),
      input: input.ask,
      store
    });
  } catch (error) {
    // A turn never fails into a red box in front of a customer. The service
    // already falls back to the guided assistant for anything a provider did;
    // what reaches here is a malformed message or a database that is down, and
    // both read better as a sentence inside the conversation.
    console.error("[shopping-agent] ask failed:", error);

    return {
      action: null,
      actionPreview: null,
      answer:
        error instanceof ZodError
          ? (error.issues[0]?.message ?? "Could you say that another way?")
          : "Something went wrong looking that up. Try asking again.",
      comparison: null,
      followUps: [],
      products: [],
      source: "guided",
      warnings: []
    };
  }
}

/**
 * Run the change the shopper pressed Confirm on.
 *
 * The proposal arrives from the browser and is re-parsed by
 * `shoppingAgentActionSchema` here — never trusted as the object the model
 * produced a moment ago. That matters less than it looks: the schema narrows
 * `checkoutSchema`, and the services behind it are the ones the storefront's own
 * buttons call, so the worst a hand-edited payload can do is exactly what that
 * shopper could already do on the product, cart and checkout pages. What the
 * re-parse buys is that it cannot do anything *else*.
 *
 * Both gates are re-checked before the write, so a shop that switched the agent
 * off — or lost its plan — between the proposal and the Confirm does not get the
 * change through a stale browser tab.
 */
export async function runShoppingAgentActionAction(input: {
  action: unknown;
  storeSlug: string;
}): Promise<ShoppingAgentActionResult> {
  const store = await resolveAgentStore(input.storeSlug);

  if (!store) {
    return { error: "This shop is not available right now.", handoffHref: null, ok: false };
  }

  const capability = await getShoppingAgentCapability(store.id);

  if (!capability.enabled || !capability.entitled) {
    return {
      error: "The shopping assistant is not available on this shop right now.",
      handoffHref: null,
      ok: false
    };
  }

  const parsed = shoppingAgentActionSchema.safeParse(input.action);
  const basePath = await storefrontBasePath(store.slug);

  if (!parsed.success) {
    return {
      error: "I could not do that from here — use the shop pages instead.",
      handoffHref: `${basePath}/cart`,
      ok: false
    };
  }

  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const result = await runShoppingAgentAction({
    action: parsed.data,
    basePath,
    clientIp: readClientIp(requestHeaders),
    gaCookie: cookieStore.get("_ga")?.value,
    store
  });

  if (result.ok) {
    // Internal routes on purpose: `/s/<slug>` is what Next serves, and the clean
    // address is a rewrite onto it — revalidating that would revalidate nothing.
    // The header's cart count is rendered on every one of these.
    revalidatePath(`/s/${store.slug}`);
    revalidatePath(`/s/${store.slug}/cart`);
    revalidatePath(`/s/${store.slug}/checkout`);
  }

  return result;
}

/**
 * The store this conversation belongs to, from its slug and nothing else.
 *
 * Only the four fields the agent needs are carried forward, so no part of the
 * store row — settings, domains, theme — can reach a prompt by being spread.
 */
async function resolveAgentStore(storeSlug: string): Promise<ShoppingAgentStore | null> {
  const slug = String(storeSlug ?? "")
    .trim()
    .slice(0, 120);

  if (!slug) {
    return null;
  }

  const store = await getStorefrontBySlug(slug);

  return store
    ? { currency: store.currency, id: store.id, name: store.name, slug: store.slug }
    : null;
}

/* -------------------------------------------------------------------------- */
/*                              The seller's switch                           */
/* -------------------------------------------------------------------------- */

/**
 * What comes back from a save, and why it carries the whole picture.
 *
 * `capability` is here rather than left to the page to re-read. The status
 * header — the badge, the headline, the storefront link — is decided by the same
 * three facts the switch changes, and a page that rendered them on the server
 * and left them there showed a seller "Switched off" directly above a toggle
 * they had just turned on. Returning the recomputed capability lets the one
 * client component that owns the form own the whole panel, so every part of the
 * page agrees the moment the server answers, with no reload and no dependence on
 * when a revalidation happens to land.
 */
export type ShoppingAgentSettingsState = {
  /** The store's live standing after the save, recomputed on the server. */
  capability?: ShoppingAgentCapability;
  /** Set when the plan refused the save, so the page can open the upgrade dialog. */
  lockedFeature?: PlanFeatureKey;
  message?: string;
  status: "idle" | "success" | "error";
  /** The saved settings, so the form re-renders from the server's word for it. */
  view?: AiSettingsView;
};

/**
 * Switching the assistant on is a **write to the storefront**, so the plan is
 * checked here and not merely reflected in the panel.
 *
 * The previous version saved whatever the switch said and told an unentitled
 * seller "Saved, but nothing will answer" — which stored a `true` the storefront
 * would honour the moment the store was entitled again, and read as though the
 * plan were a delivery delay rather than a gate. `requirePlanFeature` refuses
 * instead, and `PlanFeatureError` is turned into `lockedFeature` so the seller
 * gets the upgrade dialog every other gated form in the dashboard opens.
 *
 * Switching it **off** is deliberately left ungated, the same line
 * `coupon.actions.ts` draws on deactivating a coupon: a public assistant that is
 * answering customers has to be stoppable by the seller whose shop it is
 * standing in, whatever has happened to their billing.
 */
export async function saveShoppingAgentSettingsAction(
  _state: ShoppingAgentSettingsState,
  formData: FormData
): Promise<ShoppingAgentSettingsState> {
  try {
    const { store } = await requireStoreManager();
    const enabled = formData.get("shoppingAgentEnabled") === "on";

    if (enabled) {
      await requirePlanFeature(store.id, "ai_shopping_agent");
    }

    const view = await saveShoppingAgentSettings(store.id, { enabled });
    // Read back rather than assumed from `enabled`: a store switched on whose
    // plan has since lapsed is not live, and the panel has to say so instead of
    // congratulating the seller.
    const capability = await getShoppingAgentCapability(store.id);

    revalidatePath("/dashboard/ai/shopping-agent");
    // The storefront layout decides whether to mount the widget, so switching
    // the agent off has to take it off the shop's pages rather than waiting for
    // them to go stale on their own.
    revalidatePath(`/s/${store.slug}`, "layout");

    return {
      capability,
      message: capability.enabled
        ? "The shopping assistant is live on your storefront."
        : "The shopping assistant is switched off.",
      status: "success",
      view
    };
  } catch (error) {
    if (error instanceof PlanFeatureError) {
      return { lockedFeature: error.featureKey, message: error.message, status: "error" };
    }

    return {
      message: error instanceof Error ? error.message : "That setting could not be saved.",
      status: "error"
    };
  }
}
