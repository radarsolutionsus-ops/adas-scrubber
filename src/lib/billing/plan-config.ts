export interface BillingPlanConfig {
  id: string;
  displayName: string;
  monthlyVehicleLimit: number;
  overagePrice: number;
  pricePerMonth: number;
  stripePriceEnvVar: string;
}

export const BILLING_PLANS: Record<string, BillingPlanConfig> = {
  standard: {
    id: "standard",
    displayName: "Standard",
    monthlyVehicleLimit: 150,
    overagePrice: 5,
    pricePerMonth: 500,
    stripePriceEnvVar: "STRIPE_PRICE_STANDARD",
  },
};

export function resolvePlan(planId?: string | null): BillingPlanConfig {
  const normalized = (planId || "standard").trim().toLowerCase();
  return BILLING_PLANS[normalized] || BILLING_PLANS.standard;
}
