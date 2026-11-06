/**
 * Plans and what they unlock. Limits are checked on the server (API and
 * actions), never only in the UI. Stripe prices are mapped in env
 * (STRIPE_PRICE_PRO, STRIPE_PRICE_TEAM); the webhook sets `plan`.
 */
export const PLANS = {
  free: {
    label: "Free",
    price: "€0",
    features: ["Unlimited public kits", "Statistics for the last 30 days", "The full MCP, skill and CLI"],
    privateKits: false,
    historyDays: 30,
    csvExport: false,
  },
  pro: {
    label: "Pro",
    price: "€8/month",
    features: ["Everything in Free", "12-month history", "Export statistics as CSV"],
    privateKits: false,
    historyDays: 365,
    csvExport: true,
  },
  team: {
    label: "Teams",
    price: "€6 per member/month",
    features: ["A private registry for the organization", "Library policies checked in CI", "Adoption per team", "12-month history"],
    privateKits: true,
    historyDays: 365,
    csvExport: true,
  },
} as const;

export type PlanId = keyof typeof PLANS;

/**
 * Anti-spam, not a paywall: kits a single account can have published (retired
 * ones don't count). Admins have no limit.
 */
export const MAX_KITS_PER_ACCOUNT = 20;
type Feature = "privateKits" | "csvExport";

export function planOf(value: string | null | undefined): PlanId {
  return value && value in PLANS ? (value as PlanId) : "free";
}

export function planAllows(plan: string | null | undefined, feature: Feature): boolean {
  return PLANS[planOf(plan)][feature];
}

/**
 * While billing is off (no STRIPE_SECRET_KEY) everything is free: every
 * account gets every feature. With billing on, the stored plan decides.
 */
export function effectivePlan(plan: string | null | undefined, billing: boolean): PlanId {
  return billing ? planOf(plan) : "team";
}
