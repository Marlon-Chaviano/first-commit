import { BadgeCheckIcon, LayersIcon, ShieldCheckIcon, UsersIcon, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Where a kit comes from (and whether it passed `test`): one icon per origin, used everywhere the word appears. */
export const ORIGINS = {
  all: { label: "All origins", icon: LayersIcon },
  official: { label: "Official", icon: ShieldCheckIcon },
  verified: { label: "Verified", icon: BadgeCheckIcon },
  community: { label: "Community", icon: UsersIcon },
} satisfies Record<string, { label: string; icon: LucideIcon }>;

export type Origin = keyof typeof ORIGINS;

export function OriginIcon({ origin, className, label }: { origin: Origin; className?: string; label?: boolean }) {
  const { icon: Icon, label: text } = ORIGINS[origin];
  return <Icon aria-label={label ? text : undefined} aria-hidden={!label} className={cn("size-3.5 shrink-0", className)} />;
}
