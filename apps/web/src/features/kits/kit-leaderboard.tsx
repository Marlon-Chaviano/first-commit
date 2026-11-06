"use client";

import { CATEGORY_LABELS, entryLanguage, languageLabel, type KitCategory, type LanguageId, type RegistryEntry } from "@kits/schema";
import { ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { OriginIcon, ORIGINS, type Origin } from "@/components/shared/origin-icon";
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
import { facets, queryKits, searchIndex } from "@/lib/kit-query";
import { formatCount } from "@/lib/format";
import { logosFor } from "@/lib/logos";
import type { Leaderboard } from "@/server/metrics/queries";

type View = "all" | "trending";
type Source = Origin;

const SOURCES: [Source, string][] = [
  ["all", ORIGINS.all.label],
  ["official", "Official"],
  ["verified", "Verified"],
  ["community", "Community"],
];

/** Rows shown per page; the "+N more" row adds another page. */
const PAGE_SIZE = 20;
/** Typing pause before the list is filtered again. */
const SEARCH_DEBOUNCE_MS = 150;

/** `value`, updated only after it stops changing for `ms`. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

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
  // The input updates at once; filtering waits for a pause and runs at low priority.
  const search = useDeferredValue(useDebounced(query, SEARCH_DEBOUNCE_MS));
  // Lowercased text to search in, computed once per kit instead of on every keystroke.
  const index = useMemo(() => searchIndex(kits), [kits]);
  // Pages loaded for the current search and filters: changing any of them starts again at page 1.
  const filterKey = [search, view, source, category, language].join("\u0000");
  const [paging, setPaging] = useState({ key: filterKey, pages: 1 });
  const pages = paging.key === filterKey ? paging.pages : 1;

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
  const q = search.trim();
  const { categories, languages: allLanguages } = useMemo(() => facets(kits), [kits]);
  // Only languages that have kits.
  const languages = allLanguages.filter((l) => l.count > 0);
  const filtered = Boolean(q) || source !== "all" || category !== "all" || language !== "all";
  const clear = () => {
    setQuery("");
    setSource("all");
    setCategory("all");
    setLanguage("all");
  };
  const rows = queryKits(kits, { q, origin: source, category: category as KitCategory | "all", language }, { counts, verified }, index);
  const shown = rows.slice(0, pages * PAGE_SIZE);

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
          placeholder="Search kits or libraries (stripe, sentry, motion…)"
          className="font-mono text-sm"
          aria-label="Search kits"
        />
        <InputGroupAddon align="inline-end">
          <Kbd>/</Kbd>
        </InputGroupAddon>
      </InputGroup>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList variant="line" className="font-mono">
            <TabsTrigger value="all" className="text-xs">
              All <span className="text-muted-foreground tabular-nums">· {formatCount(stats.total)} installs</span>
            </TabsTrigger>
            <TabsTrigger value="trending" className="text-xs">Trending (24h)</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="Origin"
            value={source}
            onChange={(v) => setSource(v as Source)}
            options={SOURCES.map(([value, label]) => ({ value, label, icon: <OriginIcon origin={value} /> }))}
          />
          <FilterSelect
            label="Category"
            value={category}
            onChange={setCategory}
            options={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))]}
          />
          {languages.length > 1 && (
            <FilterSelect
              label="Language"
              value={language}
              onChange={setLanguage}
              options={[
                { value: "all", label: "All languages" },
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
          {source !== "all" && (
            <FilterChip label={SOURCES.find(([v]) => v === source)![1]} icon={<OriginIcon origin={source} className="size-3" />} onRemove={() => setSource("all")} />
          )}
          {category !== "all" && <FilterChip label={CATEGORY_LABELS[category as KitCategory]} onRemove={() => setCategory("all")} />}
          {language !== "all" && <FilterChip label={languageLabel(language as LanguageId)} onRemove={() => setLanguage("all")} />}
          <button type="button" onClick={clear} className="underline-offset-4 hover:text-foreground hover:underline">
            Clear filters
          </button>
        </div>
      )}

      {rows.length ? (
        <Table className="mt-2">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="label-mono w-12 text-muted-foreground">#</TableHead>
              <TableHead className="label-mono text-muted-foreground">Kit</TableHead>
              <TableHead className="label-mono hidden w-40 text-muted-foreground sm:table-cell">Activity 8W</TableHead>
              <TableHead className="label-mono w-24 text-right text-muted-foreground">Installs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((kit, i) => (
              <TableRow key={kit.name} className="h-14 cursor-pointer" onClick={() => router.push(`/kits/${kit.name}`)}>
                <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="max-w-0">
                  <Link href={`/kits/${kit.name}`} className="flex min-w-0 items-center gap-2.5">
                    <TechIcon
                      id={entryLanguage(kit)}
                      label={languageLabel(entryLanguage(kit))}
                      className="text-muted-foreground"
                    />
                    <span className="flex shrink-0 items-center gap-1.5 font-semibold">
                      {kit.name}
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <OriginIcon origin={kit.official ? "official" : "community"} label />
                        {verified[kit.name] && <OriginIcon origin="verified" label />}
                      </span>
                    </span>
                    <span className="truncate font-mono text-xs text-muted-foreground">{kit.title}</span>
                    <span className="ml-auto hidden shrink-0 items-center gap-2 pr-2 text-muted-foreground md:flex" aria-hidden>
                      {logosFor(kit.tags, 4).map(({ key, icon }) => (
                        <svg key={key} viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
                          <path d={icon.path} />
                        </svg>
                      ))}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Sparkline values={stats.weekly[kit.name] ?? []} />
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{formatCount(counts[kit.name] ?? 0)}</TableCell>
              </TableRow>
            ))}
            {rows.length > shown.length && (
              // Like skills.sh: the list goes on with a "+N more" row in its own typography, not a separate button.
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="p-0">
                  <button
                    type="button"
                    onClick={() => setPaging({ key: filterKey, pages: pages + 1 })}
                    className="group flex h-12 w-full items-center gap-2 px-2 font-mono text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <ChevronDownIcon className="size-4 transition-transform group-hover:translate-y-0.5 motion-reduce:transition-none" />
                    +{Math.min(PAGE_SIZE, rows.length - shown.length)} more {rows.length - shown.length === 1 ? "kit" : "kits"}
                    <span className="ml-auto text-xs tabular-nums">
                      {shown.length} of {rows.length}
                    </span>
                  </button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      ) : null}
      {!rows.length && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No results</EmptyTitle>
            <EmptyDescription>{q ? `No kit matches “${query}” with these filters.` : "No kit matches these filters."}</EmptyDescription>
          </EmptyHeader>
          {filtered && (
            <Button variant="outline" size="sm" onClick={clear}>
              Clear filters
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

function FilterChip({ label, icon, onRemove }: { label: string; icon?: React.ReactNode; onRemove: () => void }) {
  return (
    <Badge variant="outline" className="gap-1 pr-1 font-mono">
      {icon}
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="rounded-sm p-0.5 hover:bg-muted">
        <XIcon className="size-3" />
      </button>
    </Badge>
  );
}
