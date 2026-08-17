import { cache } from "react";
import { createSystemLog } from "../../lib/system-log";
import { encryptSecret, isSecretEncryptionConfigured, secretHintFor } from "../../lib/secret-box";
import { validateCustomTrackingCode } from "./marketing-code";
import { buildMarketingTags, emptyMarketingTagPlan, type MarketingTagPlan } from "./marketing-tags";
import {
  getMarketingSettingsRecord,
  upsertMarketingSettingsRecord,
  type MarketingSettingsWriteData
} from "./marketing.repository";
import {
  marketingIdPatterns,
  marketingSettingsSchema,
  type MarketingSettingsFormInput,
  type MarketingSettingsView
} from "./marketing.schema";

export class MarketingSettingsError extends Error {
  fieldErrors: Record<string, string>;

  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "MarketingSettingsError";
    this.fieldErrors = fieldErrors;
  }
}

const emptyView: MarketingSettingsView = {
  customBodyCode: "",
  customEnabled: false,
  customFooterCode: "",
  customHeaderCode: "",
  ga4ApiSecretHint: null,
  ga4MeasurementId: "",
  ga4MpEnabled: false,
  googleAdsConversionId: "",
  googleSiteVerification: "",
  gtmContainerId: "",
  hasCapiToken: false,
  hasGa4ApiSecret: false,
  metaCapiEnabled: false,
  metaCapiTokenHint: null,
  metaDomainVerification: "",
  metaPixelId: "",
  tiktokPixelId: ""
};

/** Safe to hand to a client component: IDs and secret hints, never the secrets. */
export async function getMarketingSettingsView(storeId: string): Promise<MarketingSettingsView> {
  const record = await getMarketingSettingsRecord(storeId);

  if (!record) {
    return emptyView;
  }

  return {
    customBodyCode: record.customBodyCode ?? "",
    customEnabled: record.customEnabled,
    customFooterCode: record.customFooterCode ?? "",
    customHeaderCode: record.customHeaderCode ?? "",
    ga4ApiSecretHint: record.ga4ApiSecretHint,
    ga4MeasurementId: record.ga4MeasurementId ?? "",
    ga4MpEnabled: record.ga4MpEnabled,
    googleAdsConversionId: record.googleAdsConversionId ?? "",
    googleSiteVerification: record.googleSiteVerification ?? "",
    gtmContainerId: record.gtmContainerId ?? "",
    hasCapiToken: Boolean(record.metaCapiTokenCipher),
    hasGa4ApiSecret: Boolean(record.ga4ApiSecretCipher),
    metaCapiEnabled: record.metaCapiEnabled,
    metaCapiTokenHint: record.metaCapiTokenHint,
    metaDomainVerification: record.metaDomainVerification ?? "",
    metaPixelId: record.metaPixelId ?? "",
    tiktokPixelId: record.tiktokPixelId ?? ""
  };
}

export async function updateMarketingSettings(params: {
  input: MarketingSettingsFormInput;
  organizationId?: string | undefined;
  storeId: string;
  userId?: string | undefined;
}) {
  const parsed = marketingSettingsSchema.safeParse(params.input);

  if (!parsed.success) {
    throw new MarketingSettingsError(
      "Please fix the highlighted marketing settings.",
      toFieldErrors(parsed.error.issues)
    );
  }

  const next = parsed.data;
  const existing = await getMarketingSettingsRecord(params.storeId);

  // Blank secret means "keep what is stored"; clearing is an explicit action.
  const tokenAction = resolveTokenAction({
    cleared: next.metaCapiTokenCleared,
    hadToken: Boolean(existing?.metaCapiTokenCipher),
    submitted: next.metaCapiToken
  });
  const ga4SecretAction = resolveTokenAction({
    cleared: next.ga4ApiSecretCleared,
    hadToken: Boolean(existing?.ga4ApiSecretCipher),
    submitted: next.ga4ApiSecret
  });

  if (tokenAction === "set" && !isSecretEncryptionConfigured()) {
    throw new MarketingSettingsError(
      "Set COURIER_CREDENTIALS_KEY in the root .env before saving a Conversions API token — it is stored encrypted.",
      { metaCapiToken: "Encryption key is not configured on this server." }
    );
  }

  if (ga4SecretAction === "set" && !isSecretEncryptionConfigured()) {
    throw new MarketingSettingsError(
      "Set COURIER_CREDENTIALS_KEY in the root .env before saving a Measurement Protocol API secret — it is stored encrypted.",
      { ga4ApiSecret: "Encryption key is not configured on this server." }
    );
  }

  if (next.metaCapiEnabled && tokenAction === "clear") {
    throw new MarketingSettingsError("Please fix the highlighted marketing settings.", {
      metaCapiToken: "Add an access token, or turn the Conversions API off."
    });
  }

  if (next.metaCapiEnabled && tokenAction === "keep" && !existing?.metaCapiTokenCipher) {
    throw new MarketingSettingsError("Please fix the highlighted marketing settings.", {
      metaCapiToken: "An access token is required to enable the Conversions API."
    });
  }

  if (next.ga4MpEnabled && ga4SecretAction === "clear") {
    throw new MarketingSettingsError("Please fix the highlighted marketing settings.", {
      ga4ApiSecret: "Add an API secret, or turn server-side tracking off."
    });
  }

  if (next.ga4MpEnabled && ga4SecretAction === "keep" && !existing?.ga4ApiSecretCipher) {
    throw new MarketingSettingsError("Please fix the highlighted marketing settings.", {
      ga4ApiSecret: "An API secret is required to enable server-side tracking."
    });
  }

  const data: MarketingSettingsWriteData = {
    customBodyCode: next.customBodyCode ?? null,
    customEnabled: next.customEnabled,
    customFooterCode: next.customFooterCode ?? null,
    customHeaderCode: next.customHeaderCode ?? null,
    ga4ApiSecretCipher:
      ga4SecretAction === "set"
        ? encryptSecret(next.ga4ApiSecret as string)
        : ga4SecretAction === "clear"
          ? null
          : (existing?.ga4ApiSecretCipher ?? null),
    ga4ApiSecretHint:
      ga4SecretAction === "set"
        ? secretHintFor(next.ga4ApiSecret)
        : ga4SecretAction === "clear"
          ? null
          : (existing?.ga4ApiSecretHint ?? null),
    ga4MeasurementId: next.ga4MeasurementId ?? null,
    ga4MpEnabled: next.ga4MpEnabled,
    googleAdsConversionId: next.googleAdsConversionId ?? null,
    googleSiteVerification: next.googleSiteVerification ?? null,
    gtmContainerId: next.gtmContainerId ?? null,
    metaCapiEnabled: next.metaCapiEnabled,
    metaCapiTokenCipher:
      tokenAction === "set"
        ? encryptSecret(next.metaCapiToken as string)
        : tokenAction === "clear"
          ? null
          : (existing?.metaCapiTokenCipher ?? null),
    metaCapiTokenHint:
      tokenAction === "set"
        ? secretHintFor(next.metaCapiToken)
        : tokenAction === "clear"
          ? null
          : (existing?.metaCapiTokenHint ?? null),
    metaDomainVerification: next.metaDomainVerification ?? null,
    metaPixelId: next.metaPixelId ?? null,
    tiktokPixelId: next.tiktokPixelId ?? null,
    updatedById: params.userId ?? null
  };

  const changes = describeChanges(existing, data, tokenAction, ga4SecretAction);

  await upsertMarketingSettingsRecord(params.storeId, data);

  if (changes.length > 0) {
    await createSystemLog({
      level: "INFO",
      message: `Marketing settings updated (${changes.map((change) => change.field).join(", ")})`,
      metadata: { changes },
      source: "STORE",
      storeId: params.storeId,
      ...(params.organizationId ? { organizationId: params.organizationId } : {}),
      ...(params.userId ? { userId: params.userId } : {})
    });
  }

  return { changed: changes.length };
}

/**
 * Re-runs the allowlist on stored code, so a row edited directly in the
 * database still cannot ship arbitrary markup. `buildMarketingTags` applies the
 * same check per slot; this stays for callers that need a single field.
 */
export function readSafeCustomCode(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  return validateCustomTrackingCode(value).length === 0 ? value : null;
}

/**
 * What the storefront renders. Deliberately its own read path: it never touches
 * the token columns, so a marketing secret cannot leak into a public page even
 * by accident.
 *
 * Cached per request — the layout builds the tag plan and `generateMetadata`
 * reads the verification tags out of it, which would otherwise be two queries
 * for the same row on every storefront render.
 */
export const getMarketingTagPlan = cache(async (storeId: string): Promise<MarketingTagPlan> => {
  const record = await getMarketingSettingsRecord(storeId);

  if (!record) {
    return emptyMarketingTagPlan;
  }

  return buildMarketingTags({
    customBodyCode: record.customBodyCode,
    customEnabled: record.customEnabled,
    customFooterCode: record.customFooterCode,
    customHeaderCode: record.customHeaderCode,
    ga4MeasurementId: record.ga4MeasurementId,
    googleAdsConversionId: record.googleAdsConversionId,
    googleSiteVerification: record.googleSiteVerification,
    gtmContainerId: record.gtmContainerId,
    metaDomainVerification: record.metaDomainVerification,
    metaPixelId: record.metaPixelId,
    tiktokPixelId: record.tiktokPixelId
  });
});

/** The validated pixel id, for surfaces that fire their own browser events. */
export async function getMetaPixelId(storeId: string) {
  const record = await getMarketingSettingsRecord(storeId);
  const pixelId = record?.metaPixelId?.trim();

  return pixelId && marketingIdPatterns.metaPixelId.test(pixelId) ? pixelId : null;
}

/** `generateMetadata`-shaped verification tags, or undefined when there are none. */
export async function getMarketingMetaTags(storeId: string) {
  const plan = await getMarketingTagPlan(storeId);

  if (plan.meta.length === 0) {
    return undefined;
  }

  return Object.fromEntries(plan.meta.map((entry) => [entry.name, entry.content]));
}

function resolveTokenAction(params: {
  cleared: boolean;
  hadToken: boolean;
  submitted: string | undefined;
}) {
  if (params.submitted) {
    return "set" as const;
  }

  if (params.cleared && params.hadToken) {
    return "clear" as const;
  }

  return "keep" as const;
}

/** JSON-serialisable, because this lands in `SystemLog.metadata`. */
type MarketingChange = {
  field: string;
  from: boolean | string | null;
  to: boolean | string | null;
};

/**
 * Field-level audit trail. IDs are logged before/after because they are already
 * visible to the seller; the CAPI token and GA4 API secret never are — only that
 * they moved.
 */
function describeChanges(
  existing: Awaited<ReturnType<typeof getMarketingSettingsRecord>>,
  next: MarketingSettingsWriteData,
  tokenAction: "clear" | "keep" | "set",
  ga4SecretAction: "clear" | "keep" | "set"
) {
  const changes: MarketingChange[] = [];
  const trackedFields = [
    "customEnabled",
    "ga4MeasurementId",
    "ga4MpEnabled",
    "googleAdsConversionId",
    "googleSiteVerification",
    "gtmContainerId",
    "metaCapiEnabled",
    "metaDomainVerification",
    "metaPixelId",
    "tiktokPixelId"
  ] as const;

  for (const field of trackedFields) {
    const before = existing ? existing[field] : null;
    const after = next[field];

    if (before !== after) {
      changes.push({ field, from: before ?? null, to: after ?? null });
    }
  }

  for (const field of ["customHeaderCode", "customBodyCode", "customFooterCode"] as const) {
    const before = existing?.[field] ?? null;
    const after = next[field];

    if (before !== after) {
      changes.push({
        field,
        from: truncate(before),
        to: truncate(after)
      });
    }
  }

  if (tokenAction !== "keep") {
    changes.push({
      field: "metaCapiToken",
      from: null,
      to: tokenAction === "set" ? `rotated (${next.metaCapiTokenHint ?? "set"})` : "removed"
    });
  }

  if (ga4SecretAction !== "keep") {
    changes.push({
      field: "ga4ApiSecret",
      from: null,
      to: ga4SecretAction === "set" ? `rotated (${next.ga4ApiSecretHint ?? "set"})` : "removed"
    });
  }

  return changes;
}

function truncate(value: string | null) {
  if (!value) {
    return null;
  }

  return value.length > 2000 ? `${value.slice(0, 2000)}… (${value.length} chars)` : value;
}

function toFieldErrors(issues: { message: string; path: PropertyKey[] }[]) {
  const fieldErrors: Record<string, string> = {};

  for (const issue of issues) {
    const key = issue.path[0];
    const field = typeof key === "string" ? key : "form";

    fieldErrors[field] ??= issue.message;
  }

  return fieldErrors;
}
