"use client";

import { cliCommand } from "@kits/schema";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

/**
 * The hero's 15-second loop: one command creates the project, then the agent already knows the
 * stack. A scripted terminal instead of a GIF: a few KB, crisp at any size, and it follows the
 * theme. With reduced motion it shows the last frame; off screen it pauses.
 */
const LOOP_MS = 15_500;
const TICK_MS = 40;

type Line =
  | { at: number; kind: "type"; prompt: string; text: string; ms: number }
  | { at: number; kind: "out"; text: string; tone?: "dim" | "ok" | "agent" }
  | { at: number; kind: "progress"; until: number };

const COMMAND = cliCommand("saas-next-better-auth my-app");

const SCRIPT: Line[] = [
  { at: 300, kind: "type", prompt: "$", text: COMMAND, ms: 1900 },
  { at: 2500, kind: "out", text: "┌  first-commit" },
  { at: 2800, kind: "out", text: "◇  SaaS with Next.js and Better Auth", tone: "dim" },
  { at: 3100, kind: "out", text: "◇  Next.js · Better Auth · Drizzle · Stripe · Resend", tone: "dim" },
  { at: 3400, kind: "progress", until: 6200 },
  { at: 6300, kind: "out", text: "✓  Dependencies installed", tone: "ok" },
  { at: 6600, kind: "out", text: "✓  29 skills for Claude Code", tone: "ok" },
  { at: 6900, kind: "out", text: "✓  MCP servers: shadcn, stripe", tone: "ok" },
  { at: 7200, kind: "out", text: "✓  AGENTS.md written · first commit made", tone: "ok" },
  { at: 7500, kind: "out", text: "└  Project ready" },
  { at: 8100, kind: "type", prompt: "$", text: "cd my-app && claude", ms: 800 },
  { at: 9300, kind: "type", prompt: ">", text: "add a billing page", ms: 1000 },
  { at: 10800, kind: "out", text: "●  Read AGENTS.md: Next.js App Router, Better Auth, Drizzle on Neon, Stripe.", tone: "agent" },
  { at: 11700, kind: "out", text: "●  Using the stripe skill and the Stripe MCP for checkout and webhooks.", tone: "agent" },
  { at: 12600, kind: "out", text: "●  Creating app/(app)/billing/page.tsx…", tone: "agent" },
];

const STEPS = 21;

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

export function TerminalDemo({ className }: { className?: string }) {
  const [tick, setT] = useState(0);
  const root = useRef<HTMLElement>(null);
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);
  const t = reduced ? LOOP_MS - 1 : tick;

  useEffect(() => {
    if (reduced) return;
    let visible = true;
    const observer = new IntersectionObserver(([entry]) => (visible = Boolean(entry?.isIntersecting)));
    if (root.current) observer.observe(root.current);
    const id = setInterval(() => {
      if (visible && !document.hidden) setT((prev) => (prev + TICK_MS) % LOOP_MS);
    }, TICK_MS);
    return () => {
      clearInterval(id);
      observer.disconnect();
    };
  }, [reduced]);

  const shown = SCRIPT.filter((line) => line.at <= t);
  const typing = shown.findLast((line) => line.kind === "type" && t < line.at + line.ms);

  return (
    <figure ref={root} className={cn("flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm", className)}>
      <div className="flex items-center gap-1.5 border-b px-4 py-2.5" aria-hidden>
        <span className="size-2.5 rounded-full border" />
        <span className="size-2.5 rounded-full border" />
        <span className="size-2.5 rounded-full border" />
        <span className="ml-3 font-mono text-xs text-muted-foreground">~/projects</span>
      </div>
      <figcaption className="sr-only">
        A terminal runs {COMMAND}. The project is created with its dependencies, 29 skills, MCP servers and an AGENTS.md. Then Claude Code opens and, asked to add a billing page,
        already knows the stack: Next.js, Better Auth, Drizzle on Neon and Stripe.
      </figcaption>
      <div aria-hidden className="flex h-[22rem] flex-col justify-end gap-1 overflow-hidden p-4 font-mono text-[12px] leading-relaxed sm:h-[24rem] sm:text-[13px]">
        {shown.map((line) => {
          if (line.kind === "type") {
            const chars = Math.min(line.text.length, Math.floor(((t - line.at) / line.ms) * line.text.length));
            return (
              <p key={line.at} className={cn("[overflow-wrap:anywhere]", line.prompt === ">" && "mt-2")}>
                <span className="text-muted-foreground select-none">{line.prompt} </span>
                {line.text.slice(0, chars)}
                {typing === line && <Cursor />}
              </p>
            );
          }
          if (line.kind === "progress") {
            const done = Math.min(STEPS, Math.max(1, Math.round(((t - line.at) / (line.until - line.at)) * STEPS)));
            const width = 18;
            const filled = Math.round((done / STEPS) * width);
            return (
              <p key={line.at} className="text-muted-foreground">
                │ <span className="text-foreground">{"█".repeat(filled)}</span>
                {"░".repeat(width - filled)} {done}/{STEPS} steps
              </p>
            );
          }
          return (
            <p
              key={line.at}
              className={cn("pl-[3ch] -indent-[3ch] [overflow-wrap:anywhere]", line.tone === "dim" ? "text-muted-foreground" : "text-foreground")}
            >
              {line.text}
            </p>
          );
        })}
        {!typing && <Cursor idle />}
      </div>
    </figure>
  );
}

function Cursor({ idle = false }: { idle?: boolean }) {
  return <span className={cn("inline-block h-[1.1em] w-[0.55em] translate-y-[0.15em] bg-foreground", idle && "animate-pulse motion-reduce:animate-none")} />;
}
