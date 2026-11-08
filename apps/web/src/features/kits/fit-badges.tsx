"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * As many badges as fit in the box's height, then "+N more". The box takes no height from its
 * content (`contain: size`): the card's siblings decide it, so a kit with 40 skills doesn't
 * stretch the row.
 */
export function FitBadges({ names, variant = "secondary", className }: { names: string[]; variant?: "secondary" | "outline"; className?: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const [shown, setShown] = useState(names.length);
  const [size, setSize] = useState(0);

  // A new size (or a new list) starts over from every badge, then trims below.
  const listKey = names.join("\n");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reset = () => {
      setShown(names.length);
      setSize((n) => n + 1);
    };
    reset();
    const observer = new ResizeObserver(reset);
    observer.observe(el);
    return () => observer.disconnect();
    // listKey stands for `names`, whose identity changes on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const items = [...el.children] as HTMLElement[];
    const overflows = (li: HTMLElement) => li.offsetTop + li.offsetHeight > el.clientHeight + 1;
    if (!items.some(overflows)) return;
    // First pass: keep what fits; then trim one at a time until "+N more" fits too.
    if (shown === names.length) setShown(items.filter((li) => !overflows(li)).length);
    else if (shown > 0) setShown(shown - 1);
  }, [shown, size, names.length]);

  const hidden = names.length - shown;
  return (
    <ul ref={ref} className={cn("relative flex flex-wrap content-start gap-1.5 overflow-hidden [contain:size]", className)}>
      {names.slice(0, shown).map((name) => (
        <li key={name}>
          <Badge variant={variant} className="font-mono">
            {name}
          </Badge>
        </li>
      ))}
      {hidden > 0 && (
        <li>
          <Badge variant="outline" className="font-mono text-muted-foreground" title={names.slice(shown).join(", ")}>
            +{hidden} more
          </Badge>
        </li>
      )}
    </ul>
  );
}
