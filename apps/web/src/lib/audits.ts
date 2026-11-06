export const RISKS = ["safe", "low", "medium", "high", "critical"] as const;
export type Risk = (typeof RISKS)[number];

export interface SkillAudit {
  /** Worst risk across providers. */
  risk: Risk;
  providers: { name: string; risk: string }[];
}

export const RISK_LABEL: Record<Risk, string> = {
  safe: "Safe",
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
  critical: "Critical risk",
};

export function worstRisk(risks: string[]): Risk {
  const known = risks.map((r) => r.toLowerCase()).filter((r): r is Risk => (RISKS as readonly string[]).includes(r));
  return known.reduce<Risk>((worst, r) => (RISKS.indexOf(r) > RISKS.indexOf(worst) ? r : worst), "safe");
}
