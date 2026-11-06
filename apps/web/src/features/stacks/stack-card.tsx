import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

import { Badge } from "@/components/ui/badge";
import { formatCount } from "@/lib/format";
import { logosFor } from "@/lib/logos";
import { cn } from "@/lib/utils";

/** What a stack is made of, as logos: the kit's own tech first, then the libraries the stack picks. */
export function stackLogoKeys(kitTags: readonly string[], options: Record<string, string[]>): string[] {
  return [...kitTags, ...Object.values(options).flat()].filter((id) => id !== "none");
}

/** "Next ＋ Supabase ＋ Stripe" as logos: the stack reads like a recipe. */
export function StackLogos({ keys, max = 4, size = "sm" }: { keys: readonly string[]; max?: number; size?: "sm" | "lg" }) {
  const logos = logosFor(keys, max);
  return (
    <span className="flex items-center gap-1.5" aria-hidden>
      {logos.map(({ key, icon }, i) => (
        <Fragment key={key}>
          {i > 0 && <span className={cn("font-mono text-muted-foreground/60", size === "lg" ? "text-base" : "text-xs")}>+</span>}
          <span className={cn("grid place-items-center rounded-md border bg-background", size === "lg" ? "size-12" : "size-8")}>
            <svg viewBox="0 0 24 24" fill="currentColor" className={size === "lg" ? "size-6" : "size-4"}>
              <path d={icon.path} />
            </svg>
          </span>
        </Fragment>
      ))}
    </span>
  );
}

export function StackCard({
  slug,
  title,
  description,
  kit,
  installs,
  popular,
  logoKeys,
}: {
  slug: string;
  title: string;
  description: string;
  kit: string;
  installs: number;
  popular: boolean;
  logoKeys: readonly string[];
}) {
  return (
    <Link
      href={`/stacks/${slug}`}
      className="group flex h-full flex-col gap-4 rounded-xl border p-5 transition-colors hover:border-foreground/30 hover:bg-muted/30"
    >
      <span className="flex items-start justify-between gap-3">
        <StackLogos keys={logoKeys} />
        <ArrowUpRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      </span>
      <span className="flex flex-1 flex-col gap-1.5">
        <span className="font-medium text-balance">{title}</span>
        <span className="line-clamp-2 text-sm text-pretty text-muted-foreground">{description}</span>
      </span>
      <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <span className="truncate">{kit}</span>
        {popular && (
          <Badge variant="outline" className="font-mono text-[10px]">
            popular
          </Badge>
        )}
        <span className="ml-auto tabular-nums">{formatCount(installs)} installs</span>
      </span>
    </Link>
  );
}
