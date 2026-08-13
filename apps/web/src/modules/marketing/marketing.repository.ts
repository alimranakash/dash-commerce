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

/**
 * The order fields a Purchase event needs, and nothing more.
 *
 * Lives here rather than in the orders module so the checkout route can hand the
 * sender an id and stay out of the business of assembling marketing payloads —
 * and so this stays scoped by `storeId` like every other read in this file.
 */
export async function getOrderForMetaEvent(storeId: string, orderId: string) {
  return prisma.order.findFirst({
    where: {
      id: orderId,
      storeId
    },
    select: {
      currency: true,
      customerEmail: true,
      customerName: true,
      customerPhone: true,
      id: true,
      orderNumber: true,
      totalAmount: true,
      items: {
        select: {
          quantity: true,
          sku: true,
          title: true
        }
      },
      shippingAddress: {
        select: {
          country: true
        }
      }
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
