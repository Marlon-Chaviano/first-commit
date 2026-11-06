"use client";

import { BotIcon } from "lucide-react";

import { PromptBlock } from "@/components/shared/prompt-block";
import { TechIcon } from "@/components/shared/tech-icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brandPrompt, createKitPrompt, newProjectPrompt } from "@/lib/agent-prompts";

const TASKS = [
  { id: "project", label: "Create a project", hint: "Recommends a kit, shows you the plan and creates it when you say yes.", prompt: newProjectPrompt() },
  { id: "kit", label: "Create a kit", hint: "Turns your project into a kit so your next ones start the same way and, if you like, publishes it.", prompt: createKitPrompt() },
  { id: "brand", label: "Apply my brand", hint: "Detects your company's colors, fonts and rules and applies them to the project.", prompt: brandPrompt() },
] as const;

const STEPS = ["Open your agent in a folder", "Paste the prompt", "Answer its questions"];

/**
 * "Sin terminal": ready-made prompts the agent follows on its own, for people
 * who don't use a terminal. Two columns: what to do, and the prompt to copy.
 */
export function AgentHelp({ defaultTask = "project" }: { defaultTask?: (typeof TASKS)[number]["id"] }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-xl border md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="flex flex-col gap-6 border-b bg-muted/30 p-5 sm:p-6 md:border-r md:border-b-0">
        <div className="flex flex-col gap-3">
          <div className="grid size-10 place-items-center rounded-lg border bg-background">
            <BotIcon className="size-5" />
          </div>
          <h2 className="text-xl font-semibold text-balance">Don&apos;t use the terminal? Let your agent do it</h2>
          <p className="text-sm text-pretty text-muted-foreground">Copy a prompt and paste it into your agent: it runs the commands and explains each step.</p>
        </div>
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-3 text-sm">
              <span className="grid size-6 shrink-0 place-items-center rounded-full border bg-background font-mono text-xs tabular-nums">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <div className="mt-auto flex items-center gap-2 text-muted-foreground">
          {(["claude-code", "cursor", "codex", "gemini-cli", "github-copilot"] as const).map((id) => (
            <TechIcon key={id} id={id} label={id} className="size-4" />
          ))}
          <span className="text-xs">and any agent with a terminal</span>
        </div>
      </div>
      <Tabs defaultValue={defaultTask} className="gap-4 p-5 sm:p-6">
        <TabsList variant="line" className="font-mono">
          {TASKS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="text-xs">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TASKS.map((t) => (
          <TabsContent
            key={t.id}
            value={t.id}
            // Each panel mounts when its tab opens: a short fade and lift makes the switch read as a change.
            className="flex flex-col gap-3 duration-300 animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
          >
            <p className="text-sm text-pretty text-muted-foreground">{t.hint}</p>
            <PromptBlock text={t.prompt} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
