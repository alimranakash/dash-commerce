import {
  createAdminPlan,
  deleteAdminPlan,
  findPlanBySlug,
  getAdminPlanMetrics,
  getAdminPlans,
  setAdminPlanActive,
  setAdminPlanFeatured,
  updateAdminPlan
} from "./admin-plans.repository";
import { planInputSchema, type PlanInput } from "./admin-plans.schema";

export { getAdminPlanMetrics, getAdminPlans };

export async function createPlan(input: PlanInput) {
  const data = planInputSchema.parse(input);
  await assertSlugAvailable(data.slug);
  return createAdminPlan(data);
}

export async function updatePlan(planId: string, input: PlanInput) {
  const data = planInputSchema.parse(input);
  await assertSlugAvailable(data.slug, planId);
  return updateAdminPlan(planId, data);
}

export async function togglePlanActive(planId: string, isActive: boolean) {
  return setAdminPlanActive(planId, isActive);
}

export async function markPlanFeatured(planId: string) {
  return setAdminPlanFeatured(planId);
}

export async function removePlan(planId: string) {
  return deleteAdminPlan(planId);
}

async function assertSlugAvailable(slug: string, ignorePlanId?: string) {
  const existing = await findPlanBySlug(slug, ignorePlanId);

  if (existing) {
    throw new Error("A plan with this slug already exists.");
  }
}
