"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireStore } from "../stores/queries";
import {
  addSearchBoost,
  addSearchRedirect,
  addSynonymGroup,
  removeSearchBoost,
  removeSearchRedirect,
  removeSynonymGroup
} from "./search-admin.service";

const SEARCH_SETTINGS_PATH = "/dashboard/storefront/search";

export async function createSynonymGroupFormAction(formData: FormData) {
  const store = await requireStore();

  await runAndReport(() => addSynonymGroup(store.id, { terms: formData.get("terms") }), "synonym");

  finish(store.slug, "synonym-saved");
}

export async function deleteSynonymGroupFormAction(id: string) {
  const store = await requireStore();

  await removeSynonymGroup(store.id, id);

  finish(store.slug, "synonym-removed");
}

export async function createSearchBoostFormAction(formData: FormData) {
  const store = await requireStore();

  await runAndReport(
    () =>
      addSearchBoost(store.id, {
        productId: formData.get("productId"),
        query: formData.get("query")
      }),
    "boost"
  );

  finish(store.slug, "boost-saved");
}

export async function deleteSearchBoostFormAction(id: string) {
  const store = await requireStore();

  await removeSearchBoost(store.id, id);

  finish(store.slug, "boost-removed");
}

export async function createSearchRedirectFormAction(formData: FormData) {
  const store = await requireStore();

  await runAndReport(
    () =>
      addSearchRedirect(store.id, {
        query: formData.get("query"),
        targetUrl: formData.get("targetUrl")
      }),
    "redirect"
  );

  finish(store.slug, "redirect-saved");
}

export async function deleteSearchRedirectFormAction(id: string) {
  const store = await requireStore();

  await removeSearchRedirect(store.id, id);

  finish(store.slug, "redirect-removed");
}

/**
 * Turns a validation failure into a message on the page rather than an error
 * screen, since every one of these forms is a small piece of free text a seller
 * can easily get wrong.
 */
async function runAndReport(work: () => Promise<unknown>, scope: string) {
  try {
    await work();
  } catch (error) {
    const message =
      error instanceof ZodError
        ? (error.issues[0]?.message ?? "That input is not valid.")
        : error instanceof Error
          ? error.message
          : "Something went wrong.";

    redirect(`${SEARCH_SETTINGS_PATH}?error=${encodeURIComponent(`${scope}: ${message}`)}`);
  }
}

function finish(storeSlug: string, status: string) {
  revalidatePath(SEARCH_SETTINGS_PATH);
  // Storefront results change the moment a rule does, so drop their cache too.
  // The internal route on purpose: /s/<slug> is what Next serves, and a
  // storefront hostname is a rewrite onto it. Revalidating the clean
  // address would quietly revalidate nothing.
  revalidatePath(`/s/${storeSlug}/search`);
  redirect(`${SEARCH_SETTINGS_PATH}?status=${status}`);
}
