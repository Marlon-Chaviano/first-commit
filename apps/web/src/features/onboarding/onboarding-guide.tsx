"use client";

import { CheckIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { dismissGuide, serverSnapshot, snapshot, STEPS, subscribe, type Step } from "./progress";

const COPY: Record<Step, { title: string; hint: string }> = {
  pick: { title: "Pick a kit", hint: "Search the list or describe your project." },
  configure: { title: "Configure it", hint: "Choose libraries, agents and package manager." },
  copy: { title: "Copy the command", hint: "Run it in a terminal, or let your agent do it." },
};

/**
 * First visit: a small card in the corner with the three steps, checked off as they happen (a kit
 * page opened, an option changed, the command copied). Floating, so it never moves the page;
 * gone for good once dismissed or done.
 */
export function OnboardingGuide() {
  const pathname = usePathname();
  const progress = JSON.parse(useSyncExternalStore(subscribe, snapshot, serverSnapshot)) as { done: Step[]; dismissed: boolean };
  // Only where the steps happen, and never on account, admin or docs pages.
  const relevant = pathname === "/" || pathname.startsWith("/kits/") || pathname.startsWith("/stacks");
  const finished = STEPS.every((s) => progress.done.includes(s));
  if (progress.dismissed || finished || !relevant) return null;
  const current = STEPS.find((s) => !progress.done.includes(s));

  return (
    <aside
      aria-label="Getting started"
      className="fixed bottom-4 left-4 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg duration-300 animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="label-mono text-muted-foreground">Get started</p>
        <Button variant="ghost" size="icon-xs" aria-label="Dismiss the guide" onClick={dismissGuide}>
          <XIcon />
        </Button>
      </div>
      <ol className="flex flex-col gap-3">
        {STEPS.map((step, i) => {
          const done = progress.done.includes(step);
          return (
            <li key={step} className="flex gap-3">
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border font-mono text-xs tabular-nums",
                  done && "border-foreground bg-foreground text-background",
                  step === current && "border-foreground",
                )}
                aria-hidden
              >
                {done ? <CheckIcon className="size-3.5" /> : i + 1}
              </span>
              <span className="flex flex-col">
                <span className={cn("text-sm font-medium", done && "text-muted-foreground line-through")}>
                  {step === "pick" && !done && pathname !== "/" ? <Link href="/#leaderboard" className="underline-offset-4 hover:underline">{COPY[step].title}</Link> : COPY[step].title}
                  <span className="sr-only">{done ? " (done)" : ""}</span>
                </span>
                {step === current && <span className="text-xs text-pretty text-muted-foreground">{COPY[step].hint}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <Button variant="outline" size="sm" className="mt-4 w-full" onClick={dismissGuide}>
        Got it
      </Button>
    </aside>
  );
}
