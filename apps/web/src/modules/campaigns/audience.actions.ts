"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requirePlanFeature } from "../billing/subscription-limits";
import { requireStore } from "../stores/queries";
import { audienceRulesSchema, type AudienceRules } from "./audience.schema";
import {
  createAudience,
  deleteAudience,
  refreshAudienceCount,
  updateAudience
} from "./audience.service";
import { CampaignError } from "./campaign.service";
import {
  createTemplate,
  deleteTemplate,
  updateTemplate
} from "./template.service";
import type { TemplateFormInput } from "./template.schema";

export type MarketingActionState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "error" | "idle";
};

/**
 * Two Starter features live in this file, and they are sold separately: saved
 * segments (`audiences`) and reusable message bodies (`marketing_templates`).
 * Sending to either is Campaigns, a tier up.
 *
 * As everywhere else, the entitlement buys authoring. Deleting is left ungated
 * so a lapsed store can still tidy up what it built while it was paying.
 */
const AUDIENCE_FEATURE = "audiences" as const;
const TEMPLATE_FEATURE = "marketing_templates" as const;

/* ------------------------------- Audiences -------------------------------- */

export async function createAudienceFormAction(
  _state: MarketingActionState,
  formData: FormData
): Promise<MarketingActionState> {
  const store = await requireStore();
  let audienceId: string;

  try {
    await requirePlanFeature(store.id, AUDIENCE_FEATURE);

    const audience = await createAudience(store.id, audienceInputFromFormData(formData));

    audienceId = audience.id;
  } catch (error) {
    return errorState(error);
  }

  revalidatePath("/dashboard/marketing/audiences");
  redirect(`/dashboard/marketing/audiences/${audienceId}?created=1`);
}

export async function updateAudienceFormAction(
  audienceId: string,
  _state: MarketingActionState,
  formData: FormData
): Promise<MarketingActionState> {
  const store = await requireStore();

  try {
    await requirePlanFeature(store.id, AUDIENCE_FEATURE);

    const audience = await updateAudience(store.id, audienceId, audienceInputFromFormData(formData));

    if (!audience) {
      return { message: "Audience not found.", status: "error" };
    }
  } catch (error) {
    return errorState(error);
  }

  revalidatePath("/dashboard/marketing/audiences");
  revalidatePath(`/dashboard/marketing/audiences/${audienceId}`);
  redirect(`/dashboard/marketing/audiences/${audienceId}?updated=1`);
}

export async function deleteAudienceAction(audienceId: string): Promise<MarketingActionState> {
  const store = await requireStore();

  try {
    const audience = await deleteAudience(store.id, audienceId);

    if (!audience) {
      return { message: "Audience not found.", status: "error" };
    }
  } catch (error) {
    // An audience in use refuses with a message worth reading, so this returns
    // rather than redirecting to a generic failure page.
    return errorState(error);
  }

  revalidatePath("/dashboard/marketing/audiences");
  redirect("/dashboard/marketing/audiences?deleted=1");
}

export async function refreshAudienceCountAction(audienceId: string) {
  const store = await requireStore();
  const count = await refreshAudienceCount(store.id, audienceId);

  revalidatePath("/dashboard/marketing/audiences");
  revalidatePath(`/dashboard/marketing/audiences/${audienceId}`);

  return count;
}

function audienceInputFromFormData(formData: FormData) {
  return {
    description: optionalValue(formData.get("description")),
    name: stringValue(formData.get("name")),
    rules: parseRules(formData.get("rules"))
  };
}

/**
 * Rules travel as a JSON string in a hidden field — they are a structure and
 * FormData carries only strings.
 *
 * Unparseable input becomes an empty array rather than `undefined`, so the
 * schema reports "these rules are not valid" instead of quietly defaulting the
 * segment to everyone.
 */
function parseRules(value: FormDataEntryValue | null): AudienceRules {
  const raw = stringValue(value);

  if (!raw) {
    return [];
  }

  try {
    const parsed = audienceRulesSchema.safeParse(JSON.parse(raw));

    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/* ------------------------------- Templates -------------------------------- */

export async function createTemplateFormAction(
  _state: MarketingActionState,
  formData: FormData
): Promise<MarketingActionState> {
  const store = await requireStore();

  try {
    await requirePlanFeature(store.id, TEMPLATE_FEATURE);
    await createTemplate(store.id, templateInputFromFormData(formData));
  } catch (error) {
    return errorState(error);
  }

  revalidatePath("/dashboard/marketing/templates");
  redirect("/dashboard/marketing/templates?created=1");
}

export async function updateTemplateFormAction(
  templateId: string,
  _state: MarketingActionState,
  formData: FormData
): Promise<MarketingActionState> {
  const store = await requireStore();

  try {
    await requirePlanFeature(store.id, TEMPLATE_FEATURE);

    const template = await updateTemplate(store.id, templateId, templateInputFromFormData(formData));

    if (!template) {
      return { message: "Template not found.", status: "error" };
    }
  } catch (error) {
    return errorState(error);
  }

  revalidatePath("/dashboard/marketing/templates");
  revalidatePath(`/dashboard/marketing/templates/${templateId}`);
  redirect(`/dashboard/marketing/templates/${templateId}?updated=1`);
}

export async function deleteTemplateAction(templateId: string): Promise<MarketingActionState> {
  const store = await requireStore();

  try {
    const template = await deleteTemplate(store.id, templateId);

    if (!template) {
      return { message: "Template not found.", status: "error" };
    }
  } catch (error) {
    return errorState(error);
  }

  revalidatePath("/dashboard/marketing/templates");
  redirect("/dashboard/marketing/templates?deleted=1");
}

function templateInputFromFormData(formData: FormData): TemplateFormInput {
  return {
    body: stringValue(formData.get("body")),
    channel: "SMS",
    name: stringValue(formData.get("name")),
    subject: optionalValue(formData.get("subject"))
  };
}

/* --------------------------------- Shared --------------------------------- */

function stringValue(value: FormDataEntryValue | null | undefined) {
  return String(value ?? "").trim();
}

function optionalValue(value: FormDataEntryValue | null | undefined) {
  const next = stringValue(value);
  return next || undefined;
}

function errorState(error: unknown): MarketingActionState {
  if (error instanceof ZodError) {
    return {
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [
          issue.path.length ? String(issue.path[0]) : "form",
          issue.message
        ])
      ),
      message: "Please fix the highlighted fields.",
      status: "error"
    };
  }

  if (error instanceof CampaignError) {
    return {
      fieldErrors: { [error.field]: error.message },
      message: error.message,
      status: "error"
    };
  }

  return {
    message: error instanceof Error ? error.message : "That did not work.",
    status: "error"
  };
}
