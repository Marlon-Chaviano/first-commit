import { cn } from "@/lib/utils";

/**
 * Infinite horizontal carousel, CSS only. The items are rendered twice and the
 * track slides half its width, so the loop has no seam. It pauses on hover and
 * keyboard focus, fades at the edges, and stands still (wrapping) for people
 * who prefer reduced motion.
 */
export function Marquee({
  children,
  label,
  seconds = 30,
  className,
}: {
  /** Rendered twice; the copy is hidden from assistive tech and keyboard. */
  children: (copy: boolean) => React.ReactNode;
  label: string;
  /** Time for one full loop. */
  seconds?: number;
  className?: string;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      className={cn(
        "group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] motion-reduce:[mask-image:none]",
        className,
      )}
    >
      <div
        className="flex w-max animate-[marquee_var(--marquee-duration)_linear_infinite] group-focus-within:[animation-play-state:paused] group-hover:[animation-play-state:paused] motion-reduce:w-full motion-reduce:animate-none motion-reduce:flex-wrap"
        style={{ "--marquee-duration": `${seconds}s` } as React.CSSProperties}
      >
        <ul className="flex shrink-0 items-center motion-reduce:flex-wrap">{children(false)}</ul>
        <ul aria-hidden className="flex shrink-0 items-center motion-reduce:hidden">
          {children(true)}
        </ul>
      </div>
    </div>
  );
}
