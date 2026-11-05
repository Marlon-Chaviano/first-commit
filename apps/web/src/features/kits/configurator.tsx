"use client";

import {
  AGENTS,
  BRAND,
  buildInitCommand,
  defaultSelections,
  LIBRARY_OPTION_IDS,
  pruneSelections,
  requirementsMet,
  resolve,
  type Choice,
  type Kit,
  type Selections,
} from "@kits/schema";
import { PlusIcon, SearchIcon, SparklesIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";

import { Command } from "@/components/shared/command";
import { TechIcon } from "@/components/shared/tech-icon";
import { CopyButton } from "@/components/shared/copy-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SkillAudit } from "@/lib/audits";
import { formatCount } from "@/lib/format";
import type { SkillResult } from "@/app/api/v1/skills/route";

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
  const [brand, setBrand] = useState("");
  // When the install command scrolls out of view, a bar at the bottom keeps it one click away.
  const installRef = useRef<HTMLElement>(null);
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
  const validBrand = /^[a-z0-9-]+\/[a-z0-9-]+$/.test(brand.trim());
  const command = `${buildInitCommand(kitRef, kit, effective, /^[\w.-]+$/.test(name) ? name : undefined)}${validBrand ? ` --brand ${brand.trim()}` : ""}`;
  // Changing one option can invalidate others (Vue drops React libraries, HeroUI drops shadcn add-ons).
  const update = (patch: Partial<Selections>) => setSel((s) => pruneSelections(kit, { ...s, ...patch }));

  const workflow = kit.options.find((o) => o.id === LIBRARY_OPTION_IDS.workflow);
  const stackOptions = kit.options.filter((o) => o !== workflow);
  const projectName = /^[\w.-]+$/.test(name) ? name : kit.name;
  const counts = [
    [resolved.dependencies.length + resolved.devDependencies.length, "dependencias"],
    [resolved.skills.length, "skills"],
    [Object.keys(resolved.mcp).length, "MCP"],
  ] as const;

  const renderOption = (option: Kit["options"][number]) => (
    <div key={option.id} className="grid gap-3 border-b py-5 last:border-b-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">
          {option.label}
          {option.type === "multi" && <span className="ml-1.5 font-normal text-muted-foreground">· varios</span>}
        </p>
        {option.description && <p className="text-xs text-pretty text-muted-foreground">{option.description}</p>}
      </div>
      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={2}
        multiple={option.type === "multi"}
        value={sel.options[option.id] ?? []}
        onValueChange={(value: string[]) => {
          // A single-choice option can't be emptied by clicking the active item.
          if (option.type === "select" && !value.length) return;
          const added = value.filter((id) => !(sel.options[option.id] ?? []).includes(id));
          const { options, pulled } = withRequirements(kit, { ...sel.options, [option.id]: value }, option.id, added);
          if (pulled.length) toast.info(`Añadido también: ${pulled.join(", ")}`);
          update({ options });
        }}
        className="flex-wrap content-start justify-start"
      >
        {option.choices.map((choice) => {
          // Library requirements are added on click; only framework ones block the choice.
          const allowed = requirementsMet(choice, sel) || autoSatisfiable(choice);
          return (
            <ToggleGroupItem
              key={choice.id}
              value={choice.id}
              disabled={!allowed}
              title={allowed ? choice.description : requirementText(kit, choice)}
              className="font-mono text-xs"
            >
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
            <AlertTitle>Recomendado para tu proyecto</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Panel title="Proyecto" description="Cómo se llama, para qué agentes y con qué gestor de paquetes.">
          <div className="grid gap-4 py-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="project-name">Nombre</FieldLabel>
              <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={kit.name} className="font-mono" />
            </Field>
            <Field>
              <FieldLabel htmlFor="brand">Perfil de marca</FieldLabel>
              <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="cliente/web (opcional)" className="font-mono" />
              <FieldDescription>
                <Link href="/cuenta/marcas" className="underline underline-offset-4">Crear o detectar un perfil</Link>
              </FieldDescription>
            </Field>
          </div>
          <div className="grid gap-3 border-t py-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6">
            <p className="text-sm font-medium">Agentes</p>
            <ToggleGroup
              variant="outline"
              size="sm"
              spacing={2}
              multiple
              value={sel.agents}
              onValueChange={(agents: string[]) => agents.length && update({ agents })}
              className="flex-wrap justify-start"
            >
              {AGENTS.map((a) => (
                <ToggleGroupItem key={a.id} value={a.id} className="gap-1.5 font-mono text-xs">
                  <TechIcon id={a.id} label={a.label} className="size-3.5" />
                  {a.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          {kit.packageManagers.length > 1 && (
            <div className="grid gap-3 border-t py-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6">
              <p className="text-sm font-medium">Gestor de paquetes</p>
              <ToggleGroup
                variant="outline"
                size="sm"
                spacing={2}
                value={[sel.pm]}
                onValueChange={(value: string[]) => value[0] && update({ pm: value[0] as Selections["pm"] })}
                className="justify-start"
              >
                {kit.packageManagers.map((pm) => (
                  <ToggleGroupItem key={pm} value={pm} className="font-mono text-xs">
                    {pm}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}
        </Panel>

        {stackOptions.length > 0 && (
          <Panel title="Stack" description="Elige las piezas; tu agente recibe la regla de usar solo estas.">
            {stackOptions.map(renderOption)}
          </Panel>
        )}

        <Panel title="Skills" description={`${resolved.skills.length} se instalarán para ${sel.agents.length === 1 ? "tu agente" : `${sel.agents.length} agentes`}.`}>
          {workflow && renderOption(workflow)}
          <div className="flex flex-col py-3">
            {offered.map((ref) => (
              <Field key={ref} orientation="horizontal" className="border-b py-2.5 last:border-b-0">
                <Checkbox
                  id={`skill-${ref}`}
                  checked={!sel.removeSkills.includes(ref)}
                  onCheckedChange={(on) => update({ removeSkills: on ? sel.removeSkills.filter((s) => s !== ref) : [...sel.removeSkills, ref] })}
                />
                <FieldLabel htmlFor={`skill-${ref}`} className="min-w-0 font-normal">
                  <SkillName refName={ref} />
                </FieldLabel>
                {audits[ref] && <AuditBadge audit={audits[ref]} />}
              </Field>
            ))}
            {sel.addSkills.map((ref) => (
              <div key={ref} className="flex items-center gap-3 border-b py-2">
                <Badge variant="secondary" className="font-mono">añadido</Badge>
                <SkillName refName={ref} />
                <Button variant="ghost" size="icon-xs" className="ml-auto" aria-label={`Quitar ${ref}`} onClick={() => update({ addSkills: sel.addSkills.filter((s) => s !== ref) })}>
                  <XIcon />
                </Button>
              </div>
            ))}
          </div>
          <div className="pb-5">
            <SkillSearch exclude={[...offered, ...sel.addSkills]} onAdd={(ref) => update({ addSkills: [...sel.addSkills, ref] })} />
          </div>
        </Panel>

        <Panel title="Qué se ejecutará" description="Los pasos exactos del CLI con estas opciones, en orden. Nada se ejecuta sin que lo confirmes.">
          <div className="py-5">
            <PlanPreview kit={kit} sel={effective} name={projectName} />
          </div>
        </Panel>
      </div>

      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto">
        <section ref={installRef} className="flex flex-col gap-4 rounded-xl border bg-card p-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold">Instalar</h2>
            <p className="font-mono text-xs text-muted-foreground tabular-nums">
              {counts.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`).join(" · ")}
            </p>
          </div>
          <Tabs defaultValue="command" className="gap-3">
            <TabsList variant="line" className="font-mono">
              <TabsTrigger value="command" className="text-xs">Comando</TabsTrigger>
              <TabsTrigger value="prompt" className="text-xs">Prompt para tu agente</TabsTrigger>
            </TabsList>
            <TabsContent value="command" className="flex flex-col gap-2">
              <Command command={command} wrap />
              <p className="text-xs text-muted-foreground">
                Añade <code className="font-mono text-foreground">--dry-run</code> para ver el plan sin ejecutar nada.
              </p>
            </TabsContent>
            <TabsContent value="prompt" className="flex flex-col gap-2">
              <PromptBlock text={agentPrompt(kit, command)} />
              <p className="text-xs text-muted-foreground">Pégalo en Claude Code, Cursor o Codex, en una carpeta vacía.</p>
            </TabsContent>
          </Tabs>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border p-4">
          <h2 className="font-semibold">Qué incluye</h2>
          <dl className="flex flex-col gap-4">
            <Item
              label="Reglas en AGENTS.md"
              values={resolved.chosen
                .filter((c) => (Object.values(LIBRARY_OPTION_IDS) as string[]).includes(c.optionId))
                .flatMap((c) => c.choices.filter((choice) => choice.id !== "none").map((choice) => choice.label))}
            />
            <Item label="Dependencias" values={[...resolved.dependencies, ...resolved.devDependencies]} />
            <Item label="Servidores MCP" values={Object.keys(resolved.mcp)} />
            <Item label="Variables de entorno" values={Object.keys(resolved.env)} />
            <Item label="Archivos" values={[...new Set(resolved.writeFiles.map((f) => f.path))]} />
            {resolved.setupTasks.length > 0 && <Item label="Primeros pasos" values={[`${resolved.setupTasks.length} tareas para el agente`]} />}
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

/** "Requiere shadcn/ui" — names the choices a disabled choice is waiting for. */
const LIBRARY_OPTIONS = new Set<string>(Object.values(LIBRARY_OPTION_IDS));
const autoSatisfiable = (choice: Choice) => Object.keys(choice.requires ?? {}).every((id) => LIBRARY_OPTIONS.has(id));

/**
 * Picking Better Auth selects Drizzle, picking Kokonut UI selects shadcn/ui:
 * library requirements are filled in (first allowed choice) instead of making
 * the user find out why a button is disabled. Returns the labels it added.
 */
function withRequirements(kit: Kit, options: Selections["options"], optionId: string, added: string[]) {
  const next = { ...options };
  const pulled: string[] = [];
  const option = kit.options.find((o) => o.id === optionId);
  for (const id of added) {
    const choice = option?.choices.find((c) => c.id === id);
    for (const [reqId, allowedIds] of Object.entries(choice?.requires ?? {})) {
      const target = kit.options.find((o) => o.id === reqId);
      if (!target || !LIBRARY_OPTIONS.has(reqId) || (next[reqId] ?? []).some((v) => allowedIds.includes(v))) continue;
      const pick = allowedIds[0]!;
      next[reqId] = target.type === "select" ? [pick] : [...(next[reqId] ?? []).filter((v) => v !== "none"), pick];
      pulled.push(target.choices.find((c) => c.id === pick)?.label ?? pick);
    }
  }
  return { options: next, pulled };
}

function requirementText(kit: Kit, choice: Choice): string {
  const needs = Object.entries(choice.requires ?? {}).map(([optionId, ids]) => {
    const option = kit.options.find((o) => o.id === optionId);
    return ids.map((id) => option?.choices.find((c) => c.id === id)?.label ?? id).join(" o ");
  });
  return `Requiere ${needs.join(" y ")}`;
}

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

/** A labelled group of values; long ones show the first few and "+N más". */
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
                {open ? "ver menos" : `+${values.length - max} más`}
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
          placeholder="Añade cualquier skill de skills.sh…"
          className="font-mono text-sm"
          aria-label="Buscar skills"
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

/** What to paste into the agent instead of running the command yourself (like skills.sh's "Prompt"). */
function agentPrompt(kit: Kit, command: string): string {
  return `Crea un proyecto nuevo en esta carpeta con ${BRAND.name} (${kit.title}). Ejecuta:

${command} --dry-run

Enséñame el plan y, si te lo confirmo, ejecútalo sin --dry-run y con --yes. Cuando termine, lee el AGENTS.md del proyecto y sigue sus primeros pasos: completa las tareas de configuración que puedas hacer tú y dime cuáles tengo que hacer yo (claves, cuentas).`;
}

function PromptBlock({ text }: { text: string }) {
  return (
    <div className="relative flex items-start gap-2 rounded-lg bg-muted py-1.5 pr-1.5 pl-4 transition-colors hover:bg-muted/70">
      <p className="flex-1 py-1.5 font-mono text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</p>
      <CopyButton text={text} label="Copiar prompt" stretch />
    </div>
  );
}
