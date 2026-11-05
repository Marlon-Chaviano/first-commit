/**
 * Plans and what they unlock. Limits are checked on the server (API and
 * actions), never only in the UI. Stripe prices are mapped in env
 * (STRIPE_PRICE_PRO, STRIPE_PRICE_TEAM); the webhook sets `plan`.
 */
export const PLANS = {
  free: {
    label: "Gratis",
    price: "0 €",
    features: ["Kits públicos ilimitados", "Estadísticas de los últimos 30 días", "MCP, skill y CLI completos"],
    privateKits: false,
    historyDays: 30,
    csvExport: false,
  },
  pro: {
    label: "Pro",
    price: "8 €/mes",
    features: ["Todo lo de Gratis", "Historial de 12 meses", "Exportar estadísticas en CSV"],
    privateKits: false,
    historyDays: 365,
    csvExport: true,
  },
  team: {
    label: "Equipos",
    price: "6 € por miembro/mes",
    features: ["Registro privado para la organización", "Políticas de bibliotecas comprobadas en CI", "Adopción por equipo", "Historial de 12 meses"],
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
