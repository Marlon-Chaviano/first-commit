"use client";

import { CheckIcon, CopyIcon, FolderPlusIcon, PackageIcon, PaletteIcon, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { TechIcon } from "@/components/shared/tech-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { brandPrompt, createKitPrompt, newProjectPrompt } from "@/lib/agent-prompts";
import { cn } from "@/lib/utils";

export type AgentTask = "project" | "kit" | "brand";

interface Item {
  icon: LucideIcon;
  title: string;
  hint: string;
  prompt: string;
}

function itemFor(task: AgentTask, kit?: { title: string; command: string }): Item {
  if (task === "project") {
    return kit
      ? { icon: FolderPlusIcon, title: `Create a project with ${kit.title}`, hint: "With the options you picked. It shows the plan and asks before installing.", prompt: newProjectPrompt(kit) }
      : { icon: FolderPlusIcon, title: "Create a project", hint: "It asks what you're building, recommends a kit, shows the plan and creates it when you say yes.", prompt: newProjectPrompt() };
  }
  if (task === "kit") {
    return { icon: PackageIcon, title: "Create a kit", hint: "Turns your project into a kit so the next ones start the same way and, if you like, publishes it.", prompt: createKitPrompt() };
  }
  return { icon: PaletteIcon, title: "Apply my brand", hint: "Finds your company's colors, fonts and rules, reviews them with you and applies them.", prompt: brandPrompt() };
}

/**
 * "Agent setup": the instructions for people who'd rather let their agent do it. Each item copies
 * its prompt to the clipboard; the prompt itself isn't shown, there's nothing to read, only to paste.
 */
export function AgentSetup({
  tasks = ["project", "kit", "brand"],
  kit,
  label = "Set up with your agent",
  className,
  variant = "outline",
}: {
  tasks?: AgentTask[];
  kit?: { title: string; command: string };
  label?: string;
  className?: string;
  variant?: "outline" | "default" | "ghost" | "link";
}) {
  const items = tasks.map((task) => itemFor(task, kit));
  return (
    <Dialog>
      <DialogTrigger render={<Button variant={variant} className={className} />}>
        <AgentStack />
        {label}
      </DialogTrigger>
      <DialogContent className="gap-5 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Let your agent do it</DialogTitle>
          <DialogDescription>Copy an instruction and paste it into your agent, in an empty folder. It runs the commands, explains each step and asks before installing anything.</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.title}>
              <CopyItem item={item} />
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 border-t pt-4 text-muted-foreground">
          {(["claude-code", "cursor", "codex", "gemini-cli", "github-copilot"] as const).map((id) => (
            <TechIcon key={id} id={id} label={id} className="size-4" />
          ))}
          <span className="text-xs">and any agent with a terminal</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Claude Code, Codex and Cursor overlapping like an avatar group: "works with your agent" at a glance. */
function AgentStack() {
  return (
    <span className="mr-0.5 flex items-center" aria-hidden>
      {(["claude-code", "codex", "cursor"] as const).map((id, i) => (
        <span key={id} className={cn("grid size-6 place-items-center rounded-full border bg-background text-foreground ring-2 ring-background", i > 0 && "-ml-1.5")}>
          <TechIcon id={id} label="" className="size-3.5" />
        </span>
      ))}
    </span>
  );
}

function CopyItem({ item }: { item: Item }) {
  const [copied, setCopied] = useState(false);
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(item.prompt);
          setCopied(true);
          toast.success("Copied to your clipboard", { description: "Paste it into your agent." });
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("Couldn't copy: your browser blocked the clipboard");
        }
      }}
      className={cn(
        "group flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
        copied && "border-foreground/40",
      )}
    >
      <Icon className="size-6 shrink-0" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">{item.title}</span>
        <span className="text-xs text-pretty text-muted-foreground">{item.hint}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 font-mono text-xs text-muted-foreground group-hover:text-foreground">
        {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}
