import { LOGOS } from "@/lib/logos";
import { TECH_ICONS } from "@/lib/tech-icons";
import { cn } from "@/lib/utils";

/** A library or framework logo, or nothing if there isn't one (no placeholder icon). */
export function TechLogo({ id, label, className }: { id: string; label: string; className?: string }) {
  const icon = LOGOS[id] ?? TECH_ICONS[id];
  if (!icon) return null;
  return (
    <svg role="img" aria-label={label} viewBox="0 0 24 24" fill="currentColor" className={cn("size-4 shrink-0", className)}>
      <title>{label}</title>
      <path d={icon.path} />
    </svg>
  );
}
