"use client";

import { cliCommand } from "@kits/schema";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

/**
 * The hero's 16-second loop in two scenes, like the real thing: the CLI creates the project, then
 * Claude Code takes over the screen and already knows the stack. A scripted terminal instead of a
 * GIF: a few KB, crisp at any size, and it follows the theme. It pauses off screen and shows the
 * last frame with reduced motion.
 */
const LOOP_MS = 16_000;
const FADE_MS = 450;
const AGENT_AT = 9_200;

const COMMAND = cliCommand("saas-next-better-auth my-app");
const SPINNER = ["◒", "◐", "◓", "◑"];

const STEPS = [
  { label: "Create the base project", from: 2_900, to: 3_700 },
  { label: "Install dependencies", from: 3_700, to: 5_300, progress: true },
  { label: "Install 29 skills for Claude Code", from: 5_300, to: 6_300 },
  { label: "Configure MCP · shadcn, stripe", from: 6_300, to: 6_800 },
  { label: "Write AGENTS.md", from: 6_800, to: 7_200 },
  { label: "Initial commit", from: 7_200, to: 7_600 },
];

const TOOLS = [
  { at: 11_300, name: "Read", arg: "AGENTS.md", result: "Next.js 16 · Better Auth · Drizzle on Neon · Stripe · shadcn/ui" },
  { at: 12_200, name: "Skill", arg: "stripe-best-practices", result: "Checkout + webhooks, customer linked to the Better Auth user" },
  { at: 13_100, name: "Write", arg: "app/(app)/billing/page.tsx", result: "Stripe Checkout with your session", until: 14_300 },
];

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/** The part of `text` typed by time `t`, typing from `at` for `ms`. */
const typed = (text: string, t: number, at: number, ms: number) => text.slice(0, Math.max(0, Math.min(text.length, Math.floor(((t - at) / ms) * text.length))));
const spinner = (t: number) => SPINNER[Math.floor(t / 110) % SPINNER.length];

export function TerminalDemo({ className }: { className?: string }) {
  const [tick, setTick] = useState(0);
  const root = useRef<HTMLElement>(null);
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);
  const t = reduced ? 15_000 : tick;

  useEffect(() => {
    if (reduced) return;
    let visible = true;
    const observer = new IntersectionObserver(([entry]) => (visible = Boolean(entry?.isIntersecting)));
    if (root.current) observer.observe(root.current);
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const delta = Math.min(now - last, 100);
      last = now;
      if (visible && !document.hidden) setTick((prev) => (prev + delta) % LOOP_MS);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [reduced]);

  const agent = t >= AGENT_AT;
  const fading = t > LOOP_MS - FADE_MS;

  return (
    <figure ref={root} className={cn("overflow-hidden rounded-xl border bg-card text-left shadow-2xl shadow-foreground/5", className)}>
      <div className="relative flex items-center border-b bg-muted/40 px-4 py-3" aria-hidden>
        <div className="flex gap-2">
          <span className="size-3 rounded-full bg-muted-foreground/25" />
          <span className="size-3 rounded-full bg-muted-foreground/25" />
          <span className="size-3 rounded-full bg-muted-foreground/25" />
        </div>
        <span className="absolute inset-x-0 text-center font-mono text-xs text-muted-foreground">{agent ? "my-app — claude" : "~/projects — zsh"}</span>
      </div>
      <figcaption className="sr-only">
        A terminal runs {COMMAND}. The project is created with its dependencies, 29 skills, MCP servers, an AGENTS.md and a first commit. Then Claude Code opens and, asked to add a
        billing page, already knows the stack: Next.js, Better Auth, Drizzle on Neon and Stripe.
      </figcaption>
      <div
        aria-hidden
        className={cn("h-[25rem] p-4 font-mono text-[12px] leading-[1.7] transition-opacity sm:h-[24rem] sm:p-5 sm:text-[13px]", fading ? "opacity-0" : "opacity-100")}
        style={{ transitionDuration: `${FADE_MS}ms` }}
      >
        {agent ? <AgentScene t={t} /> : <InstallScene t={t} />}
      </div>
    </figure>
  );
}

function Line({ children, className }: { children: React.ReactNode; className?: string }) {
  // Each line mounts when its time comes: a short fade and lift reads as output arriving.
  return <div className={cn("duration-300 animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none", className)}>{children}</div>;
}

function Cursor({ blink = false }: { blink?: boolean }) {
  return <span className={cn("ml-px inline-block h-[1.15em] w-[0.6em] translate-y-[0.2em] bg-foreground", blink && "animate-pulse motion-reduce:animate-none")} />;
}

function InstallScene({ t }: { t: number }) {
  const typingCommand = t >= 400 && t < 2_300;
  return (
    <div className="flex flex-col">
      <div className="[overflow-wrap:anywhere]">
        <span className="text-muted-foreground">❯ </span>
        {typed(COMMAND, t, 400, 1_900)}
        {t < 2_500 && <Cursor blink={!typingCommand} />}
      </div>

      {t >= 2_500 && (
        <Line className="mt-3 mb-1">
          <span className="text-muted-foreground">┌ </span>
          <span className="rounded-sm bg-foreground px-1.5 font-semibold text-background">first-commit</span>
          <span className="text-muted-foreground"> saas-next-better-auth</span>
        </Line>
      )}

      {STEPS.filter((s) => t >= s.from).map((step) => {
        const running = t < step.to;
        const pct = step.progress ? Math.min(1, (t - step.from) / (step.to - step.from)) : 0;
        return (
          <Line key={step.label} className="flex items-center gap-2">
            <span className={cn("w-[1ch] shrink-0", !running && "text-muted-foreground")}>{running ? spinner(t) : "◇"}</span>
            <span className={cn("truncate", !running && "text-muted-foreground")}>{step.label}</span>
            {step.progress && running && (
              <span className="ml-auto flex shrink-0 items-center gap-2">
                <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:w-28">
                  <span className="block h-full rounded-full bg-foreground" style={{ width: `${Math.round(pct * 100)}%` }} />
                </span>
                <span className="w-[4ch] text-right text-muted-foreground tabular-nums">{Math.round(pct * 100)}%</span>
              </span>
            )}
            {!running && <span className="ml-auto text-muted-foreground">✓</span>}
          </Line>
        );
      })}

      {t >= 7_800 && (
        <Line className="mt-1">
          <span className="text-muted-foreground">└ </span>
          <span className="font-semibold">Project ready</span>
          <span className="text-muted-foreground"> · 29 skills · 2 MCP · AGENTS.md</span>
        </Line>
      )}

      {t >= 8_100 && (
        <Line className="mt-3">
          <span className="text-muted-foreground">❯ </span>
          {typed("cd my-app && claude", t, 8_200, 700)}
          <Cursor blink={t >= 8_900} />
        </Line>
      )}
    </div>
  );
}

function AgentScene({ t }: { t: number }) {
  const typingPrompt = t < 10_900;
  return (
    <div className="flex flex-col gap-3">
      <Line className="rounded-lg border px-3.5 py-2.5">
        <div className="font-semibold">✻ Claude Code</div>
        <div className="text-muted-foreground">cwd: ~/projects/my-app · AGENTS.md loaded</div>
      </Line>

      {t >= 9_700 && (
        <Line className="rounded-lg border px-3.5 py-2">
          <span className="text-muted-foreground">❯ </span>
          {typed("add a billing page", t, 9_800, 1_000)}
          {typingPrompt && <Cursor />}
        </Line>
      )}

      <div className="flex flex-col gap-1.5">
        {TOOLS.filter((tool) => t >= tool.at).map((tool) => {
          const running = tool.until !== undefined && t < tool.until;
          return (
            <Line key={tool.name}>
              <div className="truncate">
                <span className={cn(!running && "text-muted-foreground")}>{running ? spinner(t) : "⏺"} </span>
                <span className="font-semibold">{tool.name}</span>
                <span className="text-muted-foreground">({tool.arg})</span>
              </div>
              {!running && <div className="truncate pl-[2ch] text-muted-foreground">⎿ {tool.result}</div>}
            </Line>
          );
        })}
      </div>

      {t >= 14_500 && (
        <Line className="pl-[2ch] -indent-[2ch]">
          ⏺ Billing page ready. It uses your Better Auth session and saves the Stripe customer in Drizzle.
        </Line>
      )}
    </div>
  );
}
