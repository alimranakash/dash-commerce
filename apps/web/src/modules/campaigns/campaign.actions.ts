"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { PlanFeatureError, requirePlanFeature } from "../billing/subscription-limits";
import type { PlanFeatureKey } from "../billing/plan-features";
import { requireStore } from "../stores/queries";
import { audienceRulesSchema, type AudienceRules } from "./audience.schema";
import { recoverStalledRecipients, runCampaignBatch } from "./campaign-delivery.service";
import { getCampaignRecipientCounts } from "./campaign.repository";
import {
  CampaignError,
  cancelCampaign,
  createCampaign,
  deleteCampaign,
  getCampaignByIdForStore,
  materialiseCampaignRecipients,
  pauseCampaign,
  previewAudienceReach,
  resolveCampaignRules,
  scheduleCampaign,
  startCampaign,
  unscheduleCampaign,
  updateCampaign
} from "./campaign.service";
import type { CampaignFormInput } from "./campaign.schema";

export type CampaignActionState = {
  fieldErrors?: Record<string, string>;
  /** Set when the plan refused the save, so the UI can open the upgrade dialog. */
  lockedFeature?: PlanFeatureKey;
  message?: string;
  status: "error" | "idle";
};

/** The gate for a channel. Sending costs the store money; drafting does not. */
function featureForChannel(channel: string): PlanFeatureKey {
  return channel === "EMAIL" ? "email_automation" : "sms_automation";
}

export async function createCampaignFormAction(
  _state: CampaignActionState,
  formData: FormData
): Promise<CampaignActionState> {
  const store = await requireStore();
  let campaignId: string;

  try {
    const input = campaignInputFromFormData(formData);

    await requirePlanFeature(store.id, featureForChannel(input.channel ?? "SMS"));
    const campaign = await createCampaign(store.id, input);

    campaignId = campaign.id;
  } catch (error) {
    return campaignErrorState(error);
  }

  revalidatePath("/dashboard/marketing/campaigns");
  redirect(`/dashboard/marketing/campaigns/${campaignId}?created=1`);
}

export async function updateCampaignFormAction(
  campaignId: string,
  _state: CampaignActionState,
  formData: FormData
): Promise<CampaignActionState> {
  const store = await requireStore();

  try {
    const input = campaignInputFromFormData(formData);

    await requirePlanFeature(store.id, featureForChannel(input.channel ?? "SMS"));
    const campaign = await updateCampaign(store.id, campaignId, input);

    if (!campaign) {
      return { message: "Campaign not found.", status: "error" };
    }
  } catch (error) {
    return campaignErrorState(error);
  }

  revalidatePath("/dashboard/marketing/campaigns");
  revalidatePath(`/dashboard/marketing/campaigns/${campaignId}`);
  redirect(`/dashboard/marketing/campaigns/${campaignId}?updated=1`);
}

export async function deleteCampaignAction(campaignId: string): Promise<CampaignActionState> {
  const store = await requireStore();

  try {
    const campaign = await deleteCampaign(store.id, campaignId);

    if (!campaign) {
      return { message: "Campaign not found.", status: "error" };
    }
  } catch (error) {
    return campaignErrorState(error);
  }

  revalidatePath("/dashboard/marketing/campaigns");
  redirect("/dashboard/marketing/campaigns?deleted=1");
}

/**
 * Freezes the campaign's audience into its recipient ledger, without sending.
 *
 * Separate from sending deliberately: a seller about to spend their SMS
 * allowance on several thousand people should be able to see the actual list
 * first, not a projection of it. Running it again tops the list up rather than
 * duplicating it, so it is safe to press twice.
 */
export async function buildCampaignRecipientsAction(
  campaignId: string
): Promise<CampaignActionState & { inserted?: number }> {
  const store = await requireStore();

  try {
    const campaign = await getCampaignByIdForStore(store.id, campaignId);

    if (!campaign) {
      return { message: "Campaign not found.", status: "error" };
    }

    if (campaign.status !== "DRAFT" && campaign.status !== "PAUSED") {
      return {
        message: `${campaign.name} has already started sending — its recipient list is fixed.`,
        status: "error"
      };
    }

    const { inserted } = await materialiseCampaignRecipients(
      store.id,
      campaignId,
      resolveCampaignRules(campaign),
      campaign.channel
    );

    revalidatePath(`/dashboard/marketing/campaigns/${campaignId}`);

    return { inserted, status: "idle" };
  } catch (error) {
    return campaignErrorState(error);
  }
}

export async function startCampaignAction(campaignId: string): Promise<CampaignActionState> {
  const store = await requireStore();

  try {
    const campaign = await getCampaignByIdForStore(store.id, campaignId);

    if (!campaign) {
      return { message: "Campaign not found.", status: "error" };
    }

    // Gated here rather than at draft time: writing a campaign costs nothing,
    // and refusing to let a seller compose one they cannot yet afford to send
    // would hide the upgrade prompt behind a blank page.
    await requirePlanFeature(store.id, featureForChannel(campaign.channel));
    await startCampaign(store.id, campaignId);
  } catch (error) {
    return campaignErrorState(error);
  }

  revalidatePath("/dashboard/marketing/campaigns");
  revalidatePath(`/dashboard/marketing/campaigns/${campaignId}`);

  return { status: "idle" };
}

/**
 * `scheduledAt` arrives from `<input type="datetime-local">`, which has no
 * timezone in it — the browser hands back the wall-clock time the seller typed.
 * It is parsed here in the server's zone, which is the same assumption the rest
 * of the dashboard makes about dates.
 */
export async function scheduleCampaignAction(
  campaignId: string,
  scheduledAt: string
): Promise<CampaignActionState> {
  const store = await requireStore();

  try {
    const campaign = await getCampaignByIdForStore(store.id, campaignId);

    if (!campaign) {
      return { message: "Campaign not found.", status: "error" };
    }

    await requirePlanFeature(store.id, featureForChannel(campaign.channel));
    await scheduleCampaign(store.id, campaignId, new Date(scheduledAt));
  } catch (error) {
    return campaignErrorState(error);
  }

  revalidatePath("/dashboard/marketing/campaigns");
  revalidatePath(`/dashboard/marketing/campaigns/${campaignId}`);

  return { status: "idle" };
}

export async function unscheduleCampaignAction(campaignId: string): Promise<CampaignActionState> {
  const store = await requireStore();

  try {
    await unscheduleCampaign(store.id, campaignId);
  } catch (error) {
    return campaignErrorState(error);
  }

  revalidatePath("/dashboard/marketing/campaigns");
  revalidatePath(`/dashboard/marketing/campaigns/${campaignId}`);

  return { status: "idle" };
}

export async function pauseCampaignAction(campaignId: string): Promise<CampaignActionState> {
  const store = await requireStore();

  try {
    await pauseCampaign(store.id, campaignId);
  } catch (error) {
    return campaignErrorState(error);
  }

  revalidatePath(`/dashboard/marketing/campaigns/${campaignId}`);

  return { status: "idle" };
}

export async function cancelCampaignAction(campaignId: string): Promise<CampaignActionState> {
  const store = await requireStore();

  try {
    await cancelCampaign(store.id, campaignId);
  } catch (error) {
    return campaignErrorState(error);
  }

  revalidatePath("/dashboard/marketing/campaigns");
  revalidatePath(`/dashboard/marketing/campaigns/${campaignId}`);

  return { status: "idle" };
}

export type CampaignProgress = {
  blocked: number;
  done: boolean;
  errorMessage: string | null;
  failed: number;
  pending: number;
  sent: number;
  skipped: number;
  status: string;
  total: number;
};

/**
 * Sends one batch and reports where the campaign has got to.
 *
 * The progress screen calls this on a timer, which is what actually drives a
 * send today. It is the same `runCampaignBatch` the scheduler will call, so
 * when campaigns start running unattended nothing about the sending path
 * changes — only who is asking for the next batch.
 */
export async function advanceCampaignAction(campaignId: string): Promise<CampaignProgress | null> {
  const store = await requireStore();
  const owned = await getCampaignByIdForStore(store.id, campaignId);

  if (!owned) {
    return null;
  }

  if (owned.status === "SENDING") {
    // Rows a crashed batch left claimed come back first, or they would sit in
    // SENDING for good and the campaign would never reach zero pending.
    await recoverStalledRecipients(campaignId);
    await runCampaignBatch(campaignId);
  }

  const [campaign, counts] = await Promise.all([
    getCampaignByIdForStore(store.id, campaignId),
    getCampaignRecipientCounts(campaignId)
  ]);

  revalidatePath(`/dashboard/marketing/campaigns/${campaignId}`);

  return {
    blocked: counts.blocked,
    done: campaign?.status !== "SENDING",
    errorMessage: campaign?.errorMessage ?? null,
    failed: counts.failed,
    pending: counts.pending,
    sent: counts.sent,
    skipped: counts.skipped,
    status: campaign?.status ?? "MISSING",
    total: counts.total
  };
}

/**
 * Live reach for the audience the seller is building.
 *
 * Read-only and ungated: seeing how many people a segment covers is how you
 * decide whether the campaign is worth sending, so it should not be the part
 * that demands an upgrade.
 */
export async function previewAudienceReachAction(rules: unknown, channel: "EMAIL" | "SMS" = "SMS") {
  const store = await requireStore();
  const parsed = audienceRulesSchema.safeParse(rules);

  if (!parsed.success) {
    return { matched: 0, optedOut: 0, reachable: 0, unreachable: 0 };
  }

  return previewAudienceReach(store.id, parsed.data, channel);
}

function campaignInputFromFormData(formData: FormData): CampaignFormInput {
  return {
    body: stringValue(formData.get("body")),
    channel: (stringValue(formData.get("channel")) || "SMS") as CampaignFormInput["channel"],
    couponId: optionalValue(formData.get("couponId")),
    name: stringValue(formData.get("name")),
    rules: parseRules(formData.get("rules")),
    subject: optionalValue(formData.get("subject"))
  };
}

/**
 * Rules travel as a JSON string in a hidden field — they are a structure, not a
 * value, and FormData only carries strings. Anything unparseable is dropped so
 * the campaign falls back to its stored audience rather than failing to save.
 */
function parseRules(value: FormDataEntryValue | null): AudienceRules | undefined {
  const raw = stringValue(value);

  if (!raw) {
    return undefined;
  }

  try {
    const parsed = audienceRulesSchema.safeParse(JSON.parse(raw));

    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function stringValue(value: FormDataEntryValue | null | undefined) {
  return String(value ?? "").trim();
}

function optionalValue(value: FormDataEntryValue | null | undefined) {
  const next = stringValue(value);
  return next || undefined;
}

function campaignErrorState(error: unknown): CampaignActionState {
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
    message: error instanceof Error ? error.message : "Campaign operation failed.",
    status: "error",
    ...(error instanceof PlanFeatureError ? { lockedFeature: error.featureKey } : {})
  };
}
