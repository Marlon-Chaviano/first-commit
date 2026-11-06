import { ShieldAlertIcon, ShieldCheckIcon, ShieldXIcon, TriangleAlertIcon, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RISK_LABEL, RISKS, type Risk, type SkillAudit } from "@/lib/audits";

/** The level alone: the list has a "Risk" column title. The tooltip keeps the full wording. */
const LEVEL: Record<Risk, string> = { safe: "Safe", low: "Low", medium: "Medium", high: "High", critical: "Critical" };

/** Risk at a glance: green safe or low, amber medium, red high or critical (status colors, like the toasts). */
const TONE: Record<Risk, string> = {
  safe: "border-success/40 bg-success/10 text-success",
  low: "border-success/40 bg-success/10 text-success",
  medium: "border-warning/40 bg-warning/10 text-warning",
  high: "border-destructive/50 bg-destructive/10 text-destructive",
  critical: "border-destructive/50 bg-destructive/15 text-destructive",
};

/** The same colors, darkened: the tooltip is light, and the status tokens are tuned for the dark page. */
const ON_LIGHT: Record<Risk, string> = {
  safe: "text-[color-mix(in_oklch,var(--success),black_40%)]",
  low: "text-[color-mix(in_oklch,var(--success),black_40%)]",
  medium: "text-[color-mix(in_oklch,var(--warning),black_45%)]",
  high: "text-[color-mix(in_oklch,var(--destructive),black_25%)]",
  critical: "text-[color-mix(in_oklch,var(--destructive),black_25%)]",
};

const ICON: Record<Risk, LucideIcon> = { safe: ShieldCheckIcon, low: ShieldCheckIcon, medium: ShieldAlertIcon, high: ShieldXIcon, critical: ShieldXIcon };

/** What each level means for someone about to install the skill. */
const MEANING: Record<Risk, string> = {
  safe: "No scanner found anything worth flagging.",
  low: "Only minor findings. Fine to install.",
  medium: "Some findings worth a look before installing.",
  high: "Serious findings. Review the skill before installing it.",
  critical: "Dangerous findings. Don't install it without reviewing the code.",
};

const asRisk = (value: string): Risk | null => ((RISKS as readonly string[]).includes(value.toLowerCase()) ? (value.toLowerCase() as Risk) : null);

/** Worst skills.sh audit result for a skill; the tooltip explains it and lists each scanner. */
export function AuditBadge({ audit }: { audit: SkillAudit }) {
  const alarming = audit.risk === "high" || audit.risk === "critical";
  const Icon = ICON[audit.risk];
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge variant="outline" className={`ml-auto shrink-0 font-mono ${TONE[audit.risk]}`}>
            {alarming && <TriangleAlertIcon data-icon="inline-start" />}
            {LEVEL[audit.risk]}
          </Badge>
        }
      />
      <TooltipContent className="w-64 flex-col items-stretch gap-2.5 px-3.5 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Icon className={`size-4 shrink-0 ${ON_LIGHT[audit.risk]}`} />
          {RISK_LABEL[audit.risk]}
        </span>
        <span className="text-pretty opacity-75">{MEANING[audit.risk]}</span>
        <ul className="flex flex-col gap-1.5 border-t border-background/15 pt-2.5">
          {audit.providers.map((p) => {
            const risk = asRisk(p.risk);
            const ProviderIcon = risk ? ICON[risk] : ShieldAlertIcon;
            return (
              <li key={p.name} className="flex items-center justify-between gap-3">
                <span className="truncate">{p.name}</span>
                <span className={`flex shrink-0 items-center gap-1 font-mono font-medium ${risk ? ON_LIGHT[risk] : ""}`}>
                  <ProviderIcon className="size-3.5" />
                  {risk ? LEVEL[risk] : p.risk}
                </span>
              </li>
            );
          })}
        </ul>
        <span className="text-[11px] opacity-60">Security scans published by skills.sh</span>
      </TooltipContent>
    </Tooltip>
  );
}
