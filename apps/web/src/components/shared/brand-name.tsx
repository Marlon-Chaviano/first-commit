import { BRAND } from "@kits/schema";

import { cn } from "@/lib/utils";

/**
 * The product's name in running text, set like the logo's wordmark (Geist Mono Medium, full
 * contrast), so it reads as a name and not as an ordinary word. Plain-text places (titles,
 * metadata, commands) keep the name as plain text.
 */
export function BrandName({ className }: { className?: string }) {
  return <span className={cn("font-mono font-medium tracking-tight text-foreground", className)}>{BRAND.name}</span>;
}
