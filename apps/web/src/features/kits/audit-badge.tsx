import { TriangleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RISK_LABEL, type SkillAudit } from "@/lib/audits";

/** Worst skills.sh audit result for a skill; the tooltip lists each provider. */
export function AuditBadge({ audit }: { audit: SkillAudit }) {
  const alarming = audit.risk === "high" || audit.risk === "critical";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge variant={alarming ? "default" : "outline"} className="ml-auto shrink-0 font-mono">
            {alarming && <TriangleAlertIcon data-icon="inline-start" />}
            {RISK_LABEL[audit.risk]}
          </Badge>
        }
      />
      <TooltipContent>
        {audit.providers.map((p) => `${p.name}: ${p.risk}`).join(" · ")}
      </TooltipContent>
    </Tooltip>
  );
}
