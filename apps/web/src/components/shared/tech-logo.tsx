import { LOGOS } from "@/lib/logos";
import { LIBRARY_ICON_FALLBACKS } from "@/lib/library-icon-fallbacks";
import { TECH_ICONS } from "@/lib/tech-icons";
import { cn } from "@/lib/utils";
import { ActivityIcon, BlocksIcon, BotIcon, BracesIcon, CreditCardIcon, DatabaseIcon, FormInputIcon, GitBranchIcon, LanguagesIcon, LayoutIcon, ListChecksIcon, MailIcon, PaletteIcon, RocketIcon, ShieldCheckIcon, SparklesIcon, TestTubeIcon, WorkflowIcon, type LucideIcon } from "lucide-react";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  components: LayoutIcon, addon: BlocksIcon, animation: SparklesIcon, styling: PaletteIcon,
  state: WorkflowIcon, data: GitBranchIcon, forms: FormInputIcon, auth: ShieldCheckIcon,
  database: DatabaseIcon, payments: CreditCardIcon, email: MailIcon, i18n: LanguagesIcon,
  ai: BotIcon, observability: ActivityIcon, testing: TestTubeIcon, quality: ListChecksIcon,
  ci: WorkflowIcon, deploy: RocketIcon, security: ShieldCheckIcon, design: PaletteIcon, workflow: BracesIcon,
};

/** A real publisher mark when available, otherwise a semantic category icon. */
export function TechLogo({ id, label, className }: { id: string; label: string; className?: string }) {
  const icon = LOGOS[id] ?? TECH_ICONS[id];
  if (!icon) {
    const Icon = CATEGORY_ICONS[LIBRARY_ICON_FALLBACKS[id] ?? ""] ?? BlocksIcon;
    return <Icon role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={!label || undefined} className={cn("size-4 shrink-0", className)}>{label && <title>{label}</title>}</Icon>;
  }
  return (
    <svg role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={!label || undefined} viewBox="0 0 24 24" fill="currentColor" className={cn("size-4 shrink-0", className)}>
      {label && <title>{label}</title>}
      <path d={icon.path} />
    </svg>
  );
}
