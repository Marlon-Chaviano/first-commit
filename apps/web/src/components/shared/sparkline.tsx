import { useId } from "react";

import { cn } from "@/lib/utils";

/** Minimal activity line with a fading fill. Flat when there is no data. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const id = useId();
  const w = 100;
  const h = 24;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const points = values.map((v, i) => [i * step, h - 2 - (v / max) * (h - 6)] as const);
  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-6 w-full text-foreground", className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity={0.18} />
          <stop offset="1" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeOpacity={0.55} strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
