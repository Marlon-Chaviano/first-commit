"use client";

import { buildPlan, type Kit, type PlanBrand, type Selections, type Step } from "@kits/schema";
import { ChevronDownIcon, FileTextIcon, FolderInputIcon, GitCommitHorizontalIcon, PaletteIcon, TerminalIcon, type LucideIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type RunStep = Extract<Step, { kind: "run" }>;
type WriteStep = Extract<Step, { kind: "write" }>;
/** Consecutive file writes read as one step ("Write 6 files"), and so do skill installs ("from 16 repositories"). */
type Item = { kind: "step"; step: Step } | { kind: "files"; steps: WriteStep[] } | { kind: "skills"; steps: RunStep[] };

const SKILLS_FROM = /^Install skills from (.+)$/;

const ICONS: Record<Step["kind"], LucideIcon> = { run: TerminalIcon, write: FileTextIcon, copy: FolderInputIcon, git: GitCommitHorizontalIcon, brand: PaletteIcon };
/** Steps shown before "Show all": enough to see the shape of the plan without a wall of steps. */
const FIRST = 6;

/**
 * The same steps `--dry-run` prints, computed with the shared planner: what
 * will run on the user's machine, before they copy the command.
 */
export function PlanPreview({ kit, sel, name, brand }: { kit: Kit; sel: Selections; name: string; brand?: PlanBrand | null }) {
  const [all, setAll] = useState(false);
  const steps = buildPlan({ kit, kitDir: "kit", sel, parentDir: ".", name, git: true, brand });
  const project = `./${name}/`;
  const rel = (path: string) => (path.startsWith(project) ? path.slice(project.length) : path);

  const items: Item[] = [];
  for (const step of steps) {
    const last = items.at(-1);
    if (step.kind === "write" && last?.kind === "files") last.steps.push(step);
    else if (step.kind === "write") items.push({ kind: "files", steps: [step] });
    else if (step.kind === "run" && SKILLS_FROM.test(step.title) && last?.kind === "skills") last.steps.push(step);
    else if (step.kind === "run" && SKILLS_FROM.test(step.title)) items.push({ kind: "skills", steps: [step] });
    else items.push({ kind: "step", step });
  }
  const commands = steps.filter((s) => s.kind === "run").length;
  const files = steps.filter((s) => s.kind === "write").length;
  const shown = all ? items : items.slice(0, FIRST);

  return (
    <div className="flex flex-col gap-4 py-5">
      <p className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground tabular-nums">
        <span className="flex items-center gap-1.5">
          <TerminalIcon className="size-3.5" />
          {commands} {commands === 1 ? "command" : "commands"}
        </span>
        <span className="flex items-center gap-1.5">
          <FileTextIcon className="size-3.5" />
          {files} {files === 1 ? "file" : "files"}
        </span>
        <span className="flex items-center gap-1.5">
          <GitCommitHorizontalIcon className="size-3.5" />
          first commit
        </span>
      </p>

      <ol className="relative flex flex-col">
        {shown.map((item, i) => (
          <li key={i} className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 pb-4 last:pb-0">
            {/* The timeline: a line from each icon to the next one. */}
            {i < shown.length - 1 && <span aria-hidden className="absolute top-7 bottom-0 left-[0.8125rem] w-px bg-border" />}
            <span className="relative grid size-7 place-items-center rounded-full border bg-background">
              {(() => {
                const Icon = ICONS[item.kind === "files" ? "write" : item.kind === "skills" ? "run" : item.step.kind];
                return <Icon className="size-3.5 text-muted-foreground" />;
              })()}
            </span>
            <div className="flex min-w-0 flex-col gap-1.5 pt-1">
              {item.kind === "files" ? <Files steps={item.steps} rel={rel} /> : item.kind === "skills" ? <Skills steps={item.steps} rel={rel} /> : <StepRow step={item.step} rel={rel} />}
            </div>
          </li>
        ))}
      </ol>

      {items.length > FIRST && (
        <button
          type="button"
          onClick={() => setAll(!all)}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          aria-expanded={all}
        >
          <ChevronDownIcon className={cn("size-4 transition-transform", all && "rotate-180")} />
          {all ? "Show fewer steps" : `Show all ${items.length} steps`}
        </button>
      )}
    </div>
  );
}

function StepRow({ step, rel }: { step: Step; rel: (p: string) => string }) {
  const optional = "optional" in step && step.optional;
  return (
    <>
      <span className="flex flex-wrap items-center gap-2 text-sm">
        {step.title}
        {optional && <Badge variant="outline" className="font-mono text-[10px]">optional</Badge>}
      </span>
      {step.kind === "run" && (
        <code className="block rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs [overflow-wrap:anywhere] text-muted-foreground">
          <span className="select-none">$ </span>
          {step.command}
        </code>
      )}
      {step.kind === "copy" && <code className="font-mono text-xs text-muted-foreground">{rel(step.to)}</code>}
      {step.kind === "brand" && (
        <span className="flex flex-wrap gap-1.5">
          {["docs/brand", "CSS variables", "AGENTS.md rules"].map((part) => (
            <Badge key={part} variant="outline" className="font-mono text-[11px] font-normal">
              {part}
            </Badge>
          ))}
          {step.images.length > 0 && (
            <span className="w-full text-xs text-muted-foreground">Download brand images: {step.images.join(", ").toLowerCase()}</span>
          )}
        </span>
      )}
    </>
  );
}

/** "Write 12 files": the first few paths, the rest one click away. */
function Files({ steps, rel }: { steps: Extract<Step, { kind: "write" }>[]; rel: (p: string) => string }) {
  const [open, setOpen] = useState(false);
  if (steps.length === 1) return <StepRow step={steps[0]!} rel={rel} />;
  const paths = steps.map((s) => rel(s.path));
  const shown = open ? paths : paths.slice(0, 3);
  return (
    <>
      <span className="text-sm">Write {steps.length} files</span>
      <ul className="flex flex-wrap gap-1.5">
        {shown.map((p, i) => (
          <li key={`${i}-${p}`}>
            <Badge variant="outline" className="max-w-full truncate font-mono text-[11px] font-normal">
              {p}
            </Badge>
          </li>
        ))}
        {paths.length > 3 && (
          <li>
            <button type="button" onClick={() => setOpen(!open)} className="font-mono text-xs text-muted-foreground hover:text-foreground" aria-expanded={open}>
              {open ? "show less" : `+${paths.length - 3} more`}
            </button>
          </li>
        )}
      </ul>
    </>
  );
}

/** "Install skills from 16 repositories": the repositories as chips, each command one click away. */
function Skills({ steps, rel }: { steps: RunStep[]; rel: (p: string) => string }) {
  const [open, setOpen] = useState(false);
  if (steps.length === 1) return <StepRow step={steps[0]!} rel={rel} />;
  return (
    <>
      <span className="text-sm">
        Install skills from {steps.length} repositories
      </span>
      <ul className="flex flex-wrap gap-1.5">
        {steps.map((s, i) => (
          <li key={i}>
            <Badge variant="outline" className="max-w-full truncate font-mono text-[11px] font-normal">
              {SKILLS_FROM.exec(s.title)?.[1]}
            </Badge>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-fit items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground" aria-expanded={open}>
        <ChevronDownIcon className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        {open ? "hide the commands" : "see the commands"}
      </button>
      {open && (
        <div className="flex flex-col gap-1">
          {steps.map((s, i) => (
            <code key={i} className="block rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs [overflow-wrap:anywhere] text-muted-foreground">
              <span className="select-none">$ </span>
              {s.command}
            </code>
          ))}
        </div>
      )}
    </>
  );
}
