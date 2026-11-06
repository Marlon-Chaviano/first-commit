"use client";

import { ChevronDownIcon } from "lucide-react";
import { Children, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Shows `pageSize` items (already rendered, e.g. by a server page) and a "+N more" row like the
 * home ranking, which reveals the next page in place.
 */
export function LoadMoreList({
  children,
  pageSize,
  noun = ["item", "items"],
  className,
}: {
  children: React.ReactNode;
  pageSize: number;
  noun?: [singular: string, plural: string];
  className?: string;
}) {
  const items = Children.toArray(children);
  const [shown, setShown] = useState(pageSize);
  const remaining = items.length - shown;
  return (
    <div className="flex flex-col gap-3">
      <ul className={className}>{items.slice(0, shown)}</ul>
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setShown((n) => n + pageSize)}
          className={cn(
            "group flex h-12 w-full items-center gap-2 border-t px-2 font-mono text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
          )}
        >
          <ChevronDownIcon className="size-4 transition-transform group-hover:translate-y-0.5 motion-reduce:transition-none" />+
          {Math.min(pageSize, remaining)} more {remaining === 1 ? noun[0] : noun[1]}
          <span className="ml-auto text-xs tabular-nums">
            {shown} of {items.length}
          </span>
        </button>
      )}
    </div>
  );
}
