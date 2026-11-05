"use client";

import { LANGUAGES, type RegistryEntry } from "@kits/schema";
import { BadgeCheckIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Sparkline } from "@/components/shared/sparkline";
import { TechIcon } from "@/components/shared/tech-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORIES } from "@/lib/categories";
import { formatCount } from "@/lib/format";
import type { Leaderboard } from "@/server/metrics/queries";

type View = "all" | "trending";
type Source = "all" | "official" | "community" | "verified";

const SOURCES: [Source, string][] = [
  ["all", "Todos los orígenes"],
  ["official", "Oficiales"],
  ["community", "Comunidad"],
  ["verified", "Verificados"],
];

export function KitLeaderboard({
  kits,
  stats,
  verified,
}: {
  kits: RegistryEntry[];
  stats: Leaderboard;
  /** kit → its current version passed `create-first-commit test` */
  verified: Record<string, boolean>;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("all");
  const [source, setSource] = useState<Source>("all");
  const [category, setCategory] = useState<string>("all");
  const [language, setLanguage] = useState<string>("all");

  // "/" focuses search, like skills.sh.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const counts = view === "all" ? stats.allTime : stats.trending;
  const q = query.trim().toLowerCase();
  const categories = [...new Set(kits.map((k) => k.category))];
  // Only languages that have kits, in the catalog's order.
  const languages = LANGUAGES.filter((l) => kits.some((k) => (k.language ?? "typescript") === l.id));
  const filtered = Boolean(q) || source !== "all" || category !== "all" || language !== "all";
  const clear = () => {
    setQuery("");
    setSource("all");
    setCategory("all");
    setLanguage("all");
  };
  const rows = kits
    .filter((k) => !q || [k.name, k.title, k.description, ...k.tags, ...(k.libraries ?? [])].some((t) => t.toLowerCase().includes(q)))
    .filter((k) =>
      source === "official" ? k.official : source === "community" ? !k.official : source === "verified" ? verified[k.name] : true,
    )
    .filter((k) => category === "all" || k.category === category)
    .filter((k) => language === "all" || (k.language ?? "typescript") === language)
    .sort((a, b) => (counts[b.name] ?? 0) - (counts[a.name] ?? 0) || a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-4">
      <InputGroup className="h-11 rounded-none border-x-0 border-t-0 border-b-foreground/40 bg-transparent! shadow-none has-[[data-slot=input-group-control]:focus-visible]:border-b-foreground has-[[data-slot=input-group-control]:focus-visible]:ring-0">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          ref={input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar kits o bibliotecas (stripe, sentry, motion…)"
          className="font-mono text-sm"
          aria-label="Buscar kits"
        />
        <InputGroupAddon align="inline-end">
          <Kbd>/</Kbd>
        </InputGroupAddon>
      </InputGroup>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList variant="line" className="font-mono">
            <TabsTrigger value="all" className="text-xs">
              Todos <span className="text-muted-foreground tabular-nums">· {formatCount(stats.total)} instalaciones</span>
            </TabsTrigger>
            <TabsTrigger value="trending" className="text-xs">Tendencia (24h)</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="Origen"
            value={source}
            onChange={(v) => setSource(v as Source)}
            options={SOURCES.map(([value, label]) => ({ value, label }))}
          />
          <FilterSelect
            label="Categoría"
            value={category}
            onChange={setCategory}
            options={[{ value: "all", label: "Todas las categorías" }, ...categories.map((c) => ({ value: c, label: CATEGORIES[c] ?? c }))]}
          />
          {languages.length > 1 && (
            <FilterSelect
              label="Lenguaje"
              value={language}
              onChange={setLanguage}
              options={[
                { value: "all", label: "Todos los lenguajes" },
                ...languages.map((l) => ({ value: l.id, label: l.label, icon: <TechIcon id={l.id} label={l.label} className="size-3.5" /> })),
              ]}
            />
          )}
        </div>
      </div>

      {filtered && (
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground" aria-live="polite">
          <span className="tabular-nums">
            {rows.length} {rows.length === 1 ? "kit" : "kits"}
          </span>
          {q && <FilterChip label={`“${query.trim()}”`} onRemove={() => setQuery("")} />}
          {source !== "all" && <FilterChip label={SOURCES.find(([v]) => v === source)![1]} onRemove={() => setSource("all")} />}
          {category !== "all" && <FilterChip label={CATEGORIES[category] ?? category} onRemove={() => setCategory("all")} />}
          {language !== "all" && <FilterChip label={LANGUAGES.find((l) => l.id === language)?.label ?? language} onRemove={() => setLanguage("all")} />}
          <button type="button" onClick={clear} className="underline-offset-4 hover:text-foreground hover:underline">
            Quitar filtros
          </button>
        </div>
      )}

      {rows.length ? (
        <Table className="mt-2">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="label-mono w-12 text-muted-foreground">#</TableHead>
              <TableHead className="label-mono text-muted-foreground">Kit</TableHead>
              <TableHead className="label-mono hidden w-40 text-muted-foreground sm:table-cell">Actividad 8S</TableHead>
              <TableHead className="label-mono w-24 text-right text-muted-foreground">Instalaciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((kit, i) => (
              <TableRow key={kit.name} className="h-14 cursor-pointer" onClick={() => router.push(`/kits/${kit.name}`)}>
                <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="max-w-0">
                  <Link href={`/kits/${kit.name}`} className="flex min-w-0 items-center gap-2.5">
                    <TechIcon
                      id={kit.language ?? "typescript"}
                      label={LANGUAGES.find((l) => l.id === (kit.language ?? "typescript"))?.label ?? "TypeScript"}
                      className="text-muted-foreground"
                    />
                    <span className="flex shrink-0 items-center gap-1.5 font-semibold">
                      {kit.name}
                      {verified[kit.name] && <BadgeCheckIcon aria-label="Verificado" className="size-3.5 text-muted-foreground" />}
                    </span>
                    <span className="truncate font-mono text-xs text-muted-foreground">{kit.title}</span>
                  </Link>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Sparkline values={stats.weekly[kit.name] ?? []} />
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{formatCount(counts[kit.name] ?? 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Sin resultados</EmptyTitle>
            <EmptyDescription>{q ? `Ningún kit coincide con “${query}” con estos filtros.` : "Ningún kit coincide con estos filtros."}</EmptyDescription>
          </EmptyHeader>
          {filtered && (
            <Button variant="outline" size="sm" onClick={clear}>
              Quitar filtros
            </Button>
          )}
        </Empty>
      )}
    </div>
  );
}

interface FilterOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

/** A compact dropdown for one filter; the trigger shows the current value with its icon. */
function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: FilterOption[] }) {
  const current = options.find((o) => o.value === value);
  return (
    <Select items={options} value={value} onValueChange={(v) => v && onChange(v as string)}>
      <SelectTrigger size="sm" aria-label={label} data-active={value !== "all"} className="font-mono text-xs data-[active=true]:border-foreground/40">
        <SelectValue>
          {() => (
            <>
              {current?.icon}
              {current?.label ?? label}
            </>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="font-mono text-xs">
            {o.icon}
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="outline" className="gap-1 pr-1 font-mono">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Quitar ${label}`} className="rounded-sm p-0.5 hover:bg-muted">
        <XIcon className="size-3" />
      </button>
    </Badge>
  );
}
