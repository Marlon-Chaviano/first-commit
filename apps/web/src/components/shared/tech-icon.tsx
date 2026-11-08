import { TerminalIcon } from "lucide-react";

import { TECH_ICONS } from "@/lib/tech-icons";
import { cn } from "@/lib/utils";

/**
 * Logo for an agent, a language or a package manager (a small set, safe on every page). Agents
 * without a public logo (Codex) get a neutral terminal icon. Library logos: TechLogo.
 */
export function TechIcon({ id, label, className }: { id: string; label: string; className?: string }) {
  const icon = TECH_ICONS[id];
  if (!icon) return <TerminalIcon role="img" aria-label={label} className={cn("size-4 shrink-0", className)} />;
  return (
    <svg role="img" aria-label={label} viewBox="0 0 24 24" fill="currentColor" className={cn("size-4 shrink-0", className)}>
      <title>{label}</title>
      <path d={icon.path} />
    </svg>
  );
}
