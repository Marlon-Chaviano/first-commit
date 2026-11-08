"use client";

import { AGENTS, buildInitCommand, defaultSelections, LIBRARY_OPTION_IDS, pruneSelections, requirementsMet, requirementText, resolve, selectionsFrom, type Choice, type Kit, type Selections, isProjectName } from "@kits/schema";
import { BanIcon, PackageIcon, PaletteIcon, PlusIcon, SearchIcon, SparklesIcon, XIcon, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";

import { Command } from "@/components/shared/command";
import { TechIcon, TechLogo } from "@/components/shared/tech-icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SkillAudit } from "@/lib/audits";
import { formatCount } from "@/lib/format";
import { SKILL_BLURBS } from "@/lib/skill-blurbs";
import type { SkillResult } from "@/app/api/v1/skills/route";

import { AgentSetup } from "../agent-help/agent-setup";
import type { BrandChoice } from "../brands/actions";
import { BrandPicker } from "./brand-picker";
import { PlanPreview } from "./plan-preview";
import { AuditBadge } from "./audit-badge";

export function Configurator({
  kit,
  kitRef = kit.name,
  audits = {},
  initial,
  reasons = [],
  details,
}: {
  kit: Kit;
  /** How the CLI installs it: "mobile-expo" or "ana/landing". */
  kitRef?: string;
  audits?: Record<string, SkillAudit>;
  /** Selections to start from (a recommendation) instead of the kit's defaults. */
  initial?: Selections;
  /** Why those selections, shown above the command. */
  reasons?: string[];
  /** Server-rendered extras for the sticky column (stats, author, badge…). */
  details?: React.ReactNode;
}) {
  const [sel, setSel] = useState<Selections>(() => initial ?? defaultSelections(kit));
  const [name, setName] = useState("");
  const [brand, setBrand] = useState<BrandChoice | null>(null);
  // When the install command scrolls out of view, a bar at the bottom keeps it one click away.
  const installRef = useRef<HTMLElement>(null);
  const asideRef = useStickyColumn();
  const [installVisible, setInstallVisible] = useState(true);
  useEffect(() => {
    const el = installRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInstallVisible(entry!.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Skills the kit offers for the current choices, before the user's removals.
  const offered = resolve(kit, { ...sel, removeSkills: [], addSkills: [] }).skills;
  // Ignore removals of skills whose choice is no longer selected.
  const effective = { ...sel, removeSkills: sel.removeSkills.filter((s) => offered.includes(s)) };
  const resolved = resolve(kit, effective);
  const command = buildInitCommand(kitRef, kit, effective, isProjectName(name) ? name : undefined, brand?.slug);
  // Changing one option can invalidate others (Vue drops React libraries, HeroUI drops shadcn add-ons).
  const update = (patch: Partial<Selections>) => setSel((s) => pruneSelections(kit, { ...s, ...patch }));

  // Curated skill packs get their own cards; their skills aren't repeated in the list below.
  const packs = kit.options.filter((o) => o.id === LIBRARY_OPTION_IDS.design || o.id === LIBRARY_OPTION_IDS.workflow);
  const stackOptions = kit.options.filter((o) => !packs.includes(o));
  const packSkills = new Set(packs.flatMap((o) => o.choices.flatMap((c) => c.skills)));
  const toggleSkill = (ref: string, on: boolean) =>
    update({ removeSkills: on ? sel.removeSkills.filter((s) => s !== ref) : [...sel.removeSkills, ref] });
  const projectName = isProjectName(name) ? name : kit.name;
  const counts = [
    [resolved.dependencies.length + resolved.devDependencies.length, "dependencies"],
    [resolved.skills.length, "skills"],
    [Object.keys(resolved.mcp).length, "MCP"],
  ] as const;

  const renderOption = (option: Kit["options"][number]) => (
    <div key={option.id} className="grid grid-cols-1 gap-3 border-b py-5 last:border-b-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6">
      <p className="pt-1.5 text-sm font-medium">{option.label}</p>
      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={2}
        multiple={option.type === "multi"}
        value={sel.options[option.id] ?? []}
        onValueChange={(value: string[]) => {
          // A single-choice option can't be emptied by clicking the active item.
          if (option.type === "select" && !value.length) return;
          // Picking Better Auth selects Drizzle, picking Kokonut UI selects shadcn/ui (instead of a disabled button).
          try {
            const { selections, added } = selectionsFrom(kit, { base: sel, options: { [option.id]: value } }, { requirements: "autofill" });
            if (added.length) toast.info(`Also added: ${added.map((a) => a.label).join(", ")}`);
            update({ options: selections.options });
          } catch (error) {
            toast.error((error as Error).message);
          }
        }}
        className="w-full flex-wrap content-start justify-start sm:justify-end"
      >
        {option.choices.map((choice) => {
          // Library requirements are added on click; only framework ones block the choice.
          const allowed = requirementsMet(choice, sel) || autoSatisfiable(choice);
          // "None" is an icon: the empty choice reads at a glance, and it's the same in every language.
          if (choice.id === "none") {
            return (
              <Tooltip key={choice.id}>
                <TooltipTrigger render={<ToggleGroupItem value={choice.id} aria-label={`No ${lowerFirst(option.label)}`} className="size-7 p-0" />}>
                  <BanIcon className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>No {lowerFirst(option.label)}</TooltipContent>
              </Tooltip>
            );
          }
          return (
            <ToggleGroupItem
              key={choice.id}
              value={choice.id}
              disabled={!allowed}
              title={allowed ? choice.description : requirementText(kit, choice)}
              className="gap-1.5 font-mono text-xs"
            >
              <TechLogo id={choice.id} label="" className="size-3.5" />
              {choice.label}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </div>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        {reasons.length > 0 && (
          <Alert>
            <SparklesIcon />
            <AlertTitle>Recommended for your project</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Panel title="Project" description="Its name, which agents, and which package manager.">
          <div className="grid grid-cols-1 gap-4 py-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="project-name">Name</FieldLabel>
              <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={kit.name} className="font-mono" />
            </Field>
            <BrandPicker value={brand?.slug ?? ""} onChange={setBrand} />
          </div>
          <div className="grid grid-cols-1 gap-3 border-t py-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6">
            <p className="pt-1.5 text-sm font-medium">Agents</p>
            <ToggleGroup
              variant="outline"
              size="sm"
              spacing={2}
              multiple
              value={sel.agents}
              onValueChange={(agents: string[]) => agents.length && update({ agents })}
              className="w-full flex-wrap justify-start sm:justify-end"
            >
              {AGENTS.map((a) => (
                <ToggleGroupItem key={a.id} value={a.id} className="gap-1.5 font-mono text-xs">
                  <TechIcon id={a.id} label="" className="size-3.5" />
                  {a.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          {kit.packageManagers.length > 1 && (
            <div className="grid grid-cols-1 gap-3 border-t py-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6">
              <p className="pt-1.5 text-sm font-medium">Package manager</p>
              <ToggleGroup
                variant="outline"
                size="sm"
                spacing={2}
                value={[sel.pm]}
                onValueChange={(value: string[]) => value[0] && update({ pm: value[0] as Selections["pm"] })}
                className="w-full flex-wrap justify-start sm:justify-end"
              >
                {kit.packageManagers.map((pm) => (
                  <ToggleGroupItem key={pm} value={pm} className="gap-1.5 font-mono text-xs">
                    <TechIcon id={pm} label="" className="size-3.5" />
                    {pm}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}
        </Panel>

        {stackOptions.length > 0 && (
          <Panel title="Stack" description="Pick the pieces; your agent gets the rule to use only these.">
            {stackOptions.map(renderOption)}
          </Panel>
        )}

        <Panel title="Skills" description={`${resolved.skills.length} will be installed for ${sel.agents.length === 1 ? "your agent" : `${sel.agents.length} agents`}.`}>
          {/* First: adding a skill is the most common change here, and the list below can be long. */}
          <div className="pt-5 pb-2">
            <SkillSearch exclude={[...offered, ...sel.addSkills]} onAdd={(ref) => update({ addSkills: [...sel.addSkills, ref] })} />
          </div>
          <div className="flex flex-col py-3">
            {/* Column titles, so each row only needs the level ("Low", "Medium"…), not "… risk" again and again. */}
            {offered.some((ref) => !packSkills.has(ref)) && (
              <div className="flex items-center justify-between border-b pb-2 label-mono text-muted-foreground">
                <span>Skill</span>
                {offered.some((ref) => !packSkills.has(ref) && audits[ref]) && <span>Risk</span>}
              </div>
            )}
            {offered.filter((ref) => !packSkills.has(ref)).map((ref) => (
              <Field key={ref} orientation="horizontal" className="border-b py-2.5 last:border-b-0">
                <Checkbox
                  id={`skill-${ref}`}
                  checked={!sel.removeSkills.includes(ref)}
                  onCheckedChange={(on) => toggleSkill(ref, on)}
                />
                <FieldLabel htmlFor={`skill-${ref}`} className="min-w-0 font-normal">
                  <SkillName refName={ref} />
                </FieldLabel>
                {audits[ref] && <AuditBadge audit={audits[ref]} />}
              </Field>
            ))}
            {sel.addSkills.map((ref) => (
              <div key={ref} className="flex items-center gap-3 border-b py-2">
                <Badge variant="secondary" className="font-mono">added</Badge>
                <SkillName refName={ref} />
                <Button variant="ghost" size="icon-xs" className="ml-auto" aria-label={`Remove ${ref}`} onClick={() => update({ addSkills: sel.addSkills.filter((s) => s !== ref) })}>
                  <XIcon />
                </Button>
              </div>
            ))}
          </div>
          {packs.length > 0 && (
            <div className="flex flex-col gap-3 border-t py-5">
              {packs.flatMap((option) =>
                option.choices
                  .filter((c) => c.id !== "none")
                  .map((choice) => (
                    <PackCard
                      key={choice.id}
                      choice={choice}
                      // One pack per category: the category title reads better than the library name.
                      title={option.choices.filter((c) => c.id !== "none").length === 1 ? option.label : choice.label}
                      icon={option.id === LIBRARY_OPTION_IDS.design ? PaletteIcon : PackageIcon}
                      on={(sel.options[option.id] ?? []).includes(choice.id)}
                      onToggle={(on) => {
                        const current = sel.options[option.id] ?? [];
                        update({ options: { ...sel.options, [option.id]: on ? [...current, choice.id] : current.filter((id) => id !== choice.id) } });
                      }}
                      isRemoved={(ref) => sel.removeSkills.includes(ref)}
                      onSkill={toggleSkill}
                    />
                  )),
              )}
            </div>
          )}
        </Panel>

        <Panel title="What will run" description="The CLI's exact steps with these options, in order. It shows them again and waits for your yes before running anything.">
          <PlanPreview kit={kit} sel={effective} name={projectName} brand={brand && { ref: brand.slug, title: brand.title, images: brand.images }} />
        </Panel>
      </div>

      {/* Sticky as a whole, never scrolling on its own (see useStickyColumn). */}
      <aside ref={asideRef} className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <section ref={installRef} className="flex flex-col gap-4 rounded-xl border bg-card p-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold">Install</h2>
            <p className="font-mono text-xs text-muted-foreground tabular-nums">
              {counts.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`).join(" · ")}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Command command={command} wrap />
            <p className="text-xs text-muted-foreground">
              Add <code className="font-mono text-foreground">--dry-run</code> to see the plan without running anything.
            </p>
          </div>
          <AgentSetup tasks={["project"]} kit={{ title: kit.title, command }} className="w-full" />
        </section>

        <section className="flex flex-col gap-4 rounded-xl border p-4">
          <h2 className="font-semibold">What&apos;s included</h2>
          <dl className="flex flex-col gap-4">
            <Item
              label="Rules in AGENTS.md"
              values={resolved.chosen
                .filter((c) => (Object.values(LIBRARY_OPTION_IDS) as string[]).includes(c.optionId))
                .flatMap((c) => c.choices.filter((choice) => choice.id !== "none").map((choice) => choice.label))}
            />
            <Item label="Dependencies" values={[...resolved.dependencies, ...resolved.devDependencies]} />
            <Item label="MCP servers" values={Object.keys(resolved.mcp)} />
            <Item label="Environment variables" values={Object.keys(resolved.env)} />
            <Item label="Files" values={[...new Set(resolved.writeFiles.map((f) => f.path))]} />
            {resolved.setupTasks.length > 0 && <Item label="First steps" values={[`${resolved.setupTasks.length} tasks for the agent`]} />}
          </dl>
        </section>

        {details}
      </aside>

      <div
        aria-hidden={installVisible}
        data-visible={!installVisible}
        className="pointer-events-none fixed inset-x-0 bottom-0 z-10 translate-y-full border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] opacity-0 transition-[transform,opacity] duration-200 ease-out data-[visible=true]:pointer-events-auto data-[visible=true]:translate-y-0 data-[visible=true]:opacity-100 motion-reduce:transition-none lg:hidden"
      >
        <div className="mx-auto max-w-5xl">
          <Command command={command} />
        </div>
      </div>
    </div>
  );
}

/** An icon-only toggle (agents, package managers): the name shows on hover and is read by screen readers. */
/** Space between the sticky column and the header (5rem) or the window's bottom edge. */
const STICKY_TOP = 80;
const STICKY_BOTTOM = 16;

/**
 * A sticky column with no scrollbar of its own. When it fits in the window it stays at the top;
 * when it's taller (the prompt tab, a long "What's included"), it scrolls with the page until its
 * bottom edge reaches the window's and stays there, so every part of it can be reached. It measures
 * itself again when its content or the window changes size.
 */
function useStickyColumn() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = () => {
      el.style.top = `${Math.min(STICKY_TOP, window.innerHeight - el.offsetHeight - STICKY_BOTTOM)}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(el);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, []);
  return ref;
}

/** "Database" → "database", but "UI components" keeps its acronym. */
const lowerFirst = (text: string) => (/^[A-Z]{2}/.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1));

/**
 * A curated skill pack: what it is, an on/off switch, and each skill with what
 * it does (each one can still be left out).
 */
function PackCard({
  choice,
  title,
  icon: Icon,
  on,
  onToggle,
  isRemoved,
  onSkill,
}: {
  choice: Choice;
  title: string;
  icon: LucideIcon;
  on: boolean;
  onToggle: (on: boolean) => void;
  isRemoved: (ref: string) => boolean;
  onSkill: (ref: string, on: boolean) => void;
}) {
  const kept = choice.skills.filter((ref) => !isRemoved(ref)).length;
  return (
    <div data-on={on} className="flex flex-col rounded-lg border transition-colors data-[on=true]:border-foreground/30">
      <label className="flex cursor-pointer items-start gap-3 p-4">
        <span className="grid shrink-0 place-items-center self-center">
          <Icon className="size-6" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{title}</span>
            <Badge variant="outline" className="font-mono tabular-nums">
              {on ? `${kept}/${choice.skills.length}` : choice.skills.length} skills
            </Badge>
          </span>
          {choice.description && <span className="text-sm text-pretty text-muted-foreground">{choice.description}</span>}
        </span>
        <Switch checked={on} onCheckedChange={onToggle} aria-label={`Include ${title}`} />
      </label>
      {on && (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-px overflow-hidden rounded-b-lg border-t bg-border sm:grid-cols-2">
          {choice.skills.map((ref) => {
            const name = ref.slice(ref.lastIndexOf("@") + 1);
            const id = `pack-${choice.id}-${name}`;
            return (
              <li key={ref} className="flex items-start gap-2.5 bg-background px-4 py-3">
                <Checkbox id={id} checked={!isRemoved(ref)} onCheckedChange={(v) => onSkill(ref, v)} className="mt-0.5" />
                <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
                  <span className="truncate font-mono text-sm">{name}</span>
                  <span className="text-xs text-pretty text-muted-foreground">{SKILL_BLURBS[name] ?? ref.slice(0, ref.lastIndexOf("@"))}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** A card of the configurator: title, one line of context, then rows. */
function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col rounded-xl border px-4 sm:px-5">
      <div className="flex flex-col gap-1 border-b py-4">
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-sm text-pretty text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** "Requires shadcn/ui" — names the choices a disabled choice is waiting for. */
const LIBRARY_OPTIONS = new Set<string>(Object.values(LIBRARY_OPTION_IDS));
const autoSatisfiable = (choice: Choice) => Object.keys(choice.requires ?? {}).every((id) => LIBRARY_OPTIONS.has(id));

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="label-mono">{children}</h2>
      <Separator />
    </div>
  );
}

function SkillName({ refName }: { refName: string }) {
  const at = refName.lastIndexOf("@");
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span className="shrink-0 font-mono text-sm">{refName.slice(at + 1)}</span>
      <span className="truncate font-mono text-xs text-muted-foreground">{refName.slice(0, at)}</span>
    </span>
  );
}

/** A labelled group of values; long ones show the first few and "+N more". */
function Item({ label, values, max = 6 }: { label: string; values: string[]; max?: number }) {
  const [open, setOpen] = useState(false);
  const shown = open ? values : values.slice(0, max);
  return (
    <div className="flex flex-col gap-2">
      <dt className="label-mono text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap gap-1.5">
        {values.length ? (
          <>
            {shown.map((v) => (
              <Badge key={v} variant="outline" className="max-w-full truncate font-mono">
                {v}
              </Badge>
            ))}
            {values.length > max && (
              <button type="button" onClick={() => setOpen(!open)} className="font-mono text-xs text-muted-foreground hover:text-foreground">
                {open ? "show less" : `+${values.length - max} more`}
              </button>
            )}
          </>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </dd>
    </div>
  );
}

function SkillSearch({ exclude, onAdd }: { exclude: string[]; onAdd: (ref: string) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SkillResult[]>([]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/skills?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        setResults(await res.json());
      } catch {
        // Aborted or offline: keep previous results.
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const visible = q.trim().length < 2 ? [] : results.filter((r) => !exclude.includes(r.ref));

  return (
    <div className="flex flex-col gap-1">
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Add any skill from skills.sh…"
          className="font-mono text-sm"
          aria-label="Search skills"
        />
      </InputGroup>
      {visible.map((r) => (
        <Button
          key={r.ref}
          variant="ghost"
          className="h-auto justify-start py-2"
          onClick={() => {
            onAdd(r.ref);
            setQ("");
          }}
        >
          <PlusIcon data-icon="inline-start" />
          <SkillName refName={r.ref} />
          <span className="ml-auto font-mono text-xs text-muted-foreground">{formatCount(r.installs)}</span>
        </Button>
      ))}
    </div>
  );
}

