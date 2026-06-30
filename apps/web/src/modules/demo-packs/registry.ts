import { beautyDemoPack } from "./beauty";
import { electronicsDemoPack } from "./electronics";
import { fashionDemoPack } from "./fashion";
import { generalDemoPack } from "./general";
import type { DemoPack, DemoPackBusinessType } from "./types";

export const DEFAULT_DEMO_PACK_ID = "general-demo-v1";

export const businessTypeDemoPackMap = {
  "Cosmetics & Beauty": beautyDemoPack.id,
  Electronics: electronicsDemoPack.id,
  Fashion: fashionDemoPack.id,
  "General Store": generalDemoPack.id
} as const satisfies Record<DemoPackBusinessType, string>;

export const demoPackRegistry = {
  [beautyDemoPack.id]: beautyDemoPack,
  [electronicsDemoPack.id]: electronicsDemoPack,
  [fashionDemoPack.id]: fashionDemoPack,
  [generalDemoPack.id]: generalDemoPack
} satisfies Record<string, DemoPack>;

export function getDemoPackById(demoPackId: string | null | undefined) {
  if (!demoPackId) {
    return generalDemoPack;
  }

  return demoPackRegistry[demoPackId] ?? generalDemoPack;
}

export function getDemoPackIdForBusinessType(businessType: string | null | undefined) {
  return businessType && businessType in businessTypeDemoPackMap
    ? businessTypeDemoPackMap[businessType as DemoPackBusinessType]
    : DEFAULT_DEMO_PACK_ID;
}

export function getDemoPackForBusinessType(businessType: string | null | undefined) {
  return getDemoPackById(getDemoPackIdForBusinessType(businessType));
}

export function getAvailableDemoPacks() {
  return Object.values(demoPackRegistry);
}
