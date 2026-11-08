"use client";

import { CATEGORY_LABELS, entryLanguage, languageLabel, type KitCategory, type LanguageId, type RegistryEntry } from "@kits/schema";
import { ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState, ViewTransition } from "react";

import { OriginIcon, ORIGINS, type Origin } from "@/components/shared/origin-icon";
import { Sparkline } from "@/components/shared/sparkline";
import { TechIcon } from "@/components/shared/tech-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { facets, queryKits, RANKING_MIN_INSTALLS, searchIndex, suggestKits } from "@/lib/kit-query";
import { formatCount } from "@/lib/format";
import { logosFor } from "@/lib/logos";
import { kitTransitionName } from "@/lib/view-transition";
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

type Props = {
  kits: RegistryEntry[];
  stats: Leaderboard;
  /** kit → its current version passed `create-first-commit test` */
  verified: Record<string, boolean>;
};

/** Search and filters as they travel in the URL: /?q=stripe&category=saas#leaderboard. */
interface ListState {
  q: string;
  view: View;
  origin: Source;
  category: string;
  language: string;
}
const DEFAULT_STATE: ListState = { q: "", view: "all", origin: "all", category: "all", language: "all" };

function stateFromParams(params: URLSearchParams): ListState {
  const origin = params.get("origin");
  return {
    q: (params.get("q") ?? "").slice(0, 100),
    view: params.get("view") === "trending" ? "trending" : "all",
    origin: SOURCES.some(([v]) => v === origin) ? (origin as Source) : "all",
    category: params.get("category") ?? "all",
    language: params.get("language") ?? "all",
  };
}

/**
 * The list with its search and filters in the URL, so a search can be shared. Rendered inside
 * <Suspense> with the plain list as fallback: the prerendered page keeps every kit link in its HTML.
 */
export function KitLeaderboardFromUrl(props: Props) {
  const params = useSearchParams();
  return <KitLeaderboard {...props} initial={stateFromParams(new URLSearchParams(params))} syncUrl />;
}

export function KitLeaderboard({ kits, stats, verified, initial = DEFAULT_STATE, syncUrl = false }: Props & { initial?: ListState; syncUrl?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initial.q);
  const [view, setView] = useState<View>(initial.view);
  const [source, setSource] = useState<Source>(initial.origin);
  const [category, setCategory] = useState<string>(initial.category);
  const [language, setLanguage] = useState<string>(initial.language);
  // The input updates at once; filtering waits for a pause and runs at low priority.
  const search = useDeferredValue(useDebounced(query, SEARCH_DEBOUNCE_MS));
  // Lowercased text to search in, computed once per kit instead of on every keystroke.
  const index = useMemo(() => searchIndex(kits), [kits]);
  // Pages loaded for the current search and filters: changing any of them starts again at page 1.
  const filterKey = [search, view, source, category, language].join("\u0000");
  const [paging, setPaging] = useState({ key: filterKey, pages: 1 });
  const pages = paging.key === filterKey ? paging.pages : 1;
  // After the first "Show more", the next pages load on their own as the list reaches the bottom.
  const [autoLoad, setAutoLoad] = useState(false);
  const more = useRef<HTMLTableRowElement>(null);

  // The search and filters live in the URL (replaceState: no navigation, no scroll jump).
  useEffect(() => {
    if (!syncUrl) return;
    const url = new URL(window.location.href);
    const next: Record<keyof ListState, string> = { q: search.trim(), view, origin: source, category, language };
    for (const [key, value] of Object.entries(next)) {
      if (value && value !== DEFAULT_STATE[key as keyof ListState]) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    // A shared search opens on the list, not on the hero.
    if (url.searchParams.size) url.hash = "leaderboard";
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [syncUrl, search, view, source, category, language]);

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

  // With few installs a ranking says "nobody uses it": show a catalog until the numbers help.
  const ranked = stats.total >= RANKING_MIN_INSTALLS;
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
  const rows = queryKits(kits, { q, origin: source, category: category as KitCategory | "all", language, sort: ranked ? "installs" : "catalog" }, { counts, verified }, index);
  const shown = rows.slice(0, pages * PAGE_SIZE);
  const hasMore = rows.length > shown.length;

  useEffect(() => {
    const row = more.current;
    if (!autoLoad || !hasMore || !row) return;
    const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && setPaging({ key: filterKey, pages: pages + 1 }), { rootMargin: "200px" });
    observer.observe(row);
    return () => observer.disconnect();
  }, [autoLoad, hasMore, filterKey, pages]);

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
        {ranked ? (
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList variant="line" className="font-mono">
              <TabsTrigger value="all" className="text-xs">
                All time
              </TabsTrigger>
              <TabsTrigger value="trending" className="text-xs">Trending (24h)</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : (
          <p className="font-mono text-xs text-muted-foreground tabular-nums">
            {kits.length} kits · by category
          </p>
        )}
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
              {ranked && <TableHead className="label-mono w-12 text-muted-foreground">#</TableHead>}
              <TableHead className="label-mono text-muted-foreground">Kit</TableHead>
              {ranked && <TableHead className="label-mono hidden w-40 text-muted-foreground md:table-cell">Activity 8W</TableHead>}
              {ranked && <TableHead className="label-mono hidden w-24 text-right text-muted-foreground sm:table-cell">Installs</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((kit, i) => (
              <TableRow key={kit.name} className="h-14 cursor-pointer" onClick={() => router.push(`/kits/${kit.name}`)}>
                {ranked && <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>}
                <TableCell className="max-w-0 py-2.5">
                  <Link href={`/kits/${kit.name}`} className="flex min-w-0 items-center gap-2.5">
                    <ViewTransition name={kitTransitionName("icon", kit.name)}>
                      <TechIcon id={entryLanguage(kit)} label={languageLabel(entryLanguage(kit))} className="shrink-0 text-muted-foreground" />
                    </ViewTransition>
                    {/* Phones: the description goes under the name instead of being cut off next to it. */}
                    <span className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2.5">
                      <span className="flex shrink-0 items-center gap-1.5 font-semibold">
                        <ViewTransition name={kitTransitionName("name", kit.name)}>
                          <span>{kit.name}</span>
                        </ViewTransition>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <OriginBadge origin={kit.official ? "official" : "community"} />
                          {verified[kit.name] && <OriginBadge origin="verified" />}
                        </span>
                      </span>
                      <span className="font-mono text-xs text-pretty text-muted-foreground sm:truncate">{kit.title}</span>
                    </span>
                    <span className="ml-auto hidden shrink-0 items-center gap-2 pr-2 text-muted-foreground md:flex" aria-hidden>
                      {logosFor(kit.tags, 4).map(({ key, icon }) => (
                        <svg key={key} viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
                          <path d={icon.path} />
                        </svg>
                      ))}
                    </span>
                  </Link>
                </TableCell>
                {ranked && (
                  <TableCell className="hidden md:table-cell">
                    <Sparkline values={stats.weekly[kit.name] ?? []} />
                  </TableCell>
                )}
                {ranked && <TableCell className="hidden text-right font-mono tabular-nums sm:table-cell">{formatCount(counts[kit.name] ?? 0)}</TableCell>}
              </TableRow>
            ))}
            {hasMore && (
              // Like skills.sh: the list goes on with a "+N more" row in its own typography, not a separate button.
              <TableRow ref={more} className="hover:bg-transparent">
                <TableCell colSpan={ranked ? 4 : 1} className="p-0">
                  <button
                    type="button"
                    onClick={() => {
                      setPaging({ key: filterKey, pages: pages + 1 });
                      setAutoLoad(true);
                    }}
                    className="group flex h-12 w-full items-center gap-2 px-2 font-mono text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <ChevronDownIcon className="size-4 transition-transform group-hover:translate-y-0.5 motion-reduce:transition-none" />
                    Show {Math.min(PAGE_SIZE, rows.length - shown.length)} more
                    <span className="text-xs tabular-nums">({rows.length - shown.length} remaining)</span>
                  </button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      ) : null}
      {!rows.length && (
        <NoResults
          kits={kits}
          q={q}
          index={index}
          filters={source !== "all" || category !== "all" || language !== "all"}
          onClearFilters={() => {
            setSource("all");
            setCategory("all");
            setLanguage("all");
          }}
          onClear={clear}
        />
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

const ORIGIN_HINTS = {
  official: "Official kit, maintained in the first-commit repo",
  community: "Community kit, published by its author",
  verified: "Verified: the current version installs and passes its checks in CI",
  all: "",
} as const;

/** Official / community / verified icon with what it means, on hover or focus. */
function OriginBadge({ origin }: { origin: "official" | "community" | "verified" }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} />} className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <OriginIcon origin={origin} label />
      </TooltipTrigger>
      <TooltipContent>{ORIGIN_HINTS[origin]}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Nothing matched: say why and offer a way out. With filters on, how many kits match the search
 * without them; for a typo, the closest kits ("Looking for Supabase? Try saas-next-supabase").
 */
function NoResults({ kits, q, index, filters, onClearFilters, onClear }: { kits: RegistryEntry[]; q: string; index: Map<string, string>; filters: boolean; onClearFilters: () => void; onClear: () => void }) {
  const withoutFilters = filters && q ? queryKits(kits, { q }, { counts: {}, verified: {} }, index).length : 0;
  const suggestions = q ? suggestKits(kits, q) : [];
  const word = suggestions[0]?.word;
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>{q ? `No kit matches “${q}”` : "No kit matches these filters"}</EmptyTitle>
        <EmptyDescription>
          {withoutFilters
            ? `${withoutFilters} ${withoutFilters === 1 ? "kit matches" : "kits match"} it without the filters.`
            : suggestions.length && word
              ? `Looking for ${word[0]!.toUpperCase()}${word.slice(1)}? Try ${suggestions.length === 1 ? "this kit" : "one of these"}:`
              : "Try a framework (Next.js, Expo, FastAPI), a library (Stripe, Supabase) or what you're building (SaaS, API, landing)."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center">
        {!withoutFilters &&
          suggestions.map(({ kit }) => (
            <Button key={kit.name} variant="outline" size="sm" className="font-mono" nativeButton={false} render={<Link href={`/kits/${kit.name}`} />}>
              {kit.name}
            </Button>
          ))}
        {withoutFilters > 0 && (
          <Button size="sm" onClick={onClearFilters}>
            Show them
          </Button>
        )}
        {(filters || q) && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear search
          </Button>
        )}
      </EmptyContent>
    </Empty>
  );
}
