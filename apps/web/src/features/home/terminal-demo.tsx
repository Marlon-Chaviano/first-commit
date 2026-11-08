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
const FIRST_FRAME = 1_600;
const AGENT_AT = 9_200;

// The same short command as the hero's button: the CLI asks for the kit and the name.
const COMMAND = cliCommand();
const SPINNER = ["◒", "◐", "◓", "◑"];

const ANSWERS = [
  { label: "Kit", value: "saas-next-better-auth", at: 1_900, ms: 700 },
  { label: "Name", value: "my-app", at: 2_800, ms: 400 },
];

const STEPS = [
  { label: "Create the base project", from: 3_500, to: 4_100 },
  { label: "Install dependencies", from: 4_100, to: 5_600, progress: true },
  { label: "Add 29 skills and 2 MCP servers", from: 5_600, to: 6_500 },
  { label: "Write AGENTS.md and the first commit", from: 6_500, to: 7_200 },
];

const TOOLS = [
  { at: 11_300, name: "Read", arg: "AGENTS.md", result: "Next.js 16 · Better Auth · Drizzle on Neon · Stripe · shadcn/ui" },
  { at: 12_200, name: "Skill", arg: "stripe-best-practices", result: "Checkout + webhooks, customer linked to the Better Auth user" },
  { at: 13_100, name: "Write", arg: "app/(app)/billing/page.tsx", result: null, until: 14_300 },
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
  // Starts with the command typed and the CLI open, so the first paint is never an empty window.
  const [tick, setTick] = useState(FIRST_FRAME);
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
        A terminal runs {COMMAND}, picks the saas-next-better-auth kit and names the project my-app. It&apos;s created with its dependencies, 29 skills, 2 MCP servers, an AGENTS.md and a first commit. Then Claude Code opens and, asked to add a
        billing page, already knows the stack: Next.js, Better Auth, Drizzle on Neon and Stripe.
      </figcaption>
      <div
        aria-hidden
        className={cn("h-[20rem] px-4 py-3.5 font-mono text-[12px] leading-[1.6] transition-opacity sm:h-[18rem] sm:px-5 sm:py-4 sm:text-[13px]", fading ? "opacity-0" : "opacity-100")}
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
  const typingCommand = t >= 400 && t < 1_300;
  return (
    <div className="flex flex-col">
      <div className="[overflow-wrap:anywhere]">
        <span className="text-muted-foreground">❯ </span>
        {typed(COMMAND, t, 400, 900)}
        {t < 1_500 && <Cursor blink={!typingCommand} />}
      </div>

      {t >= 1_500 && (
        <Line className="mt-3 mb-1">
          <span className="text-muted-foreground">┌ </span>
          <span className="rounded-sm bg-foreground px-1.5 font-semibold text-background">first-commit</span>
        </Line>
      )}

      {ANSWERS.filter((a) => t >= a.at).map((a) => {
        const answering = t < a.at + a.ms + 200;
        return (
          <Line key={a.label} className="flex gap-2">
            <span className={cn("w-[1ch] shrink-0", !answering && "text-muted-foreground")}>{answering ? "◆" : "◇"}</span>
            <span className="w-[5ch] shrink-0 text-muted-foreground">{a.label}</span>
            <span className="truncate">
              {typed(a.value, t, a.at, a.ms)}
              {answering && <Cursor />}
            </span>
          </Line>
        );
      })}

      {STEPS.filter((s) => t >= s.from).map((step) => {
        const running = t < step.to;
        const pct = step.progress ? Math.min(1, (t - step.from) / (step.to - step.from)) : 0;
        return (
          <Line key={step.label} className="flex items-center gap-2">
            <span className={cn("w-[1ch] shrink-0", !running && "text-muted-foreground")}>{running ? spinner(t) : "◇"}</span>
            <span className={cn("truncate", !running && "text-muted-foreground")}>{step.label}</span>
            {step.progress && running && (
              <span className="ml-auto flex shrink-0 items-center gap-2">
                <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block sm:w-28">
                  <span className="block h-full rounded-full bg-foreground" style={{ width: `${Math.round(pct * 100)}%` }} />
                </span>
                <span className="w-[4ch] text-right text-muted-foreground tabular-nums">{Math.round(pct * 100)}%</span>
              </span>
            )}
            {!running && <span className="ml-auto text-muted-foreground">✓</span>}
          </Line>
        );
      })}

      {t >= 7_400 && (
        <Line className="mt-1">
          <span className="text-muted-foreground">└ </span>
          <span className="font-semibold">✓ Ready.</span>
          <span className="text-muted-foreground"> cd my-app and open your agent</span>
        </Line>
      )}

      {t >= 7_900 && (
        <Line className="mt-3">
          <span className="text-muted-foreground">❯ </span>
          {typed("cd my-app && claude", t, 8_000, 700)}
          <Cursor blink={t >= 8_700} />
        </Line>
      )}
    </div>
  );
}

function AgentScene({ t }: { t: number }) {
  const typingPrompt = t < 10_900;
  return (
    <div className="flex flex-col gap-2.5">
      <Line className="truncate rounded-lg border px-3.5 py-1.5">
        <span className="font-semibold">✻ Claude Code</span>
        <span className="text-muted-foreground"> · ~/projects/my-app · AGENTS.md loaded</span>
      </Line>

      {t >= 9_700 && (
        <Line className="rounded-lg border px-3.5 py-1.5">
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
              {!running && tool.result && <div className="truncate pl-[2ch] text-muted-foreground">⎿ {tool.result}</div>}
            </Line>
          );
        })}
      </div>

      {t >= 14_500 && (
        <Line className="pl-[2ch] -indent-[2ch]">
          ⏺ Done: /billing with Stripe Checkout, tied to the signed-in user.
        </Line>
      )}
    </div>
  );
}
