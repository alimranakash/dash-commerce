import { prisma } from "@dash/db";

/** The only place that touches `prisma.marketingSetting`. Always scoped by storeId. */

export type MarketingSettingsWriteData = {
  customBodyCode: string | null;
  customEnabled: boolean;
  customFooterCode: string | null;
  customHeaderCode: string | null;
  ga4MeasurementId: string | null;
  googleAdsConversionId: string | null;
  googleSiteVerification: string | null;
  gtmContainerId: string | null;
  metaCapiEnabled: boolean;
  metaCapiTokenCipher: string | null;
  metaCapiTokenHint: string | null;
  metaDomainVerification: string | null;
  metaPixelId: string | null;
  tiktokPixelId: string | null;
  updatedById: string | null;
};

export async function getMarketingSettingsRecord(storeId: string) {
  return prisma.marketingSetting.findUnique({
    where: {
      storeId
    }
  });
}

export async function upsertMarketingSettingsRecord(
  storeId: string,
  data: MarketingSettingsWriteData
) {
  return prisma.marketingSetting.upsert({
    where: {
      storeId
    },
    update: data,
    create: {
      ...data,
      storeId
    }
  });
}
