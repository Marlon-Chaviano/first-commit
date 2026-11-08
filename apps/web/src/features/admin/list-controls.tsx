"use client";

import { SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const formatNumber = new Intl.NumberFormat("en");

/** Search box and filter toggles; the caller decides where the values live (state or URL). */
export function Toolbar<F extends string>({ query, onQuery, placeholder, filters, filter, onFilter }: {
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  filters: Record<F, string>;
  filter: F;
  onFilter: (f: F) => void;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <InputGroup className="md:max-w-xs">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      </InputGroup>
      <ToggleGroup value={[filter]} onValueChange={(v) => v[0] && onFilter(v[0] as F)} variant="outline" size="sm" className="flex-wrap">
        {(Object.entries(filters) as [F, string][]).map(([id, label]) => (
          <ToggleGroupItem key={id} value={id}>
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

/**
 * The toolbar for lists paginated on the server: search (debounced) and filter go to the URL as
 * `<prefix>q` and `<prefix>f`, and any change goes back to page 1.
 */
export function UrlToolbar<F extends string>({ prefix, placeholder, filters }: { prefix: string; placeholder: string; filters: Record<F, string> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const first = Object.keys(filters)[0] as F;
  const filter = ((params.get(`${prefix}f`) as F | null) ?? first) in filters ? ((params.get(`${prefix}f`) as F | null) ?? first) : first;
  const [query, setQuery] = useState(params.get(`${prefix}q`) ?? "");

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete(`${prefix}p`);
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (query === (params.get(`${prefix}q`) ?? "")) return;
    const timer = setTimeout(() => update({ [`${prefix}q`]: query.trim() || null }), 300);
    return () => clearTimeout(timer);
    // `update` reads the latest params; re-running only when the text changes is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <Toolbar
      query={query}
      onQuery={setQuery}
      placeholder={placeholder}
      filters={filters}
      filter={filter}
      onFilter={(f) => update({ [`${prefix}f`]: f === first ? null : f })}
    />
  );
}

/** 1 … 4 5 6 … 20: the first, the last and the neighbours of the current page. */
function pageList(page: number, pages: number): (number | "gap")[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...keep].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1]! > 1 ? ["gap" as const, p] : [p]));
}

interface PagerProps {
  page: number;
  pageSize: number;
  total: number;
}

/** "51–100 of 1,234" and the page links. `link` turns a page number into an href or a click. */
function PagerView({ page, pageSize, total, link }: PagerProps & { link: (page: number) => React.ComponentProps<"a"> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="font-mono text-xs text-muted-foreground tabular-nums">
        {formatNumber.format(from)}–{formatNumber.format(to)} of {formatNumber.format(total)}
      </p>
      {pages > 1 && (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious {...(page > 1 ? link(page - 1) : { "aria-disabled": true, className: "pointer-events-none opacity-50" })} />
            </PaginationItem>
            {pageList(page, pages).map((p, i) =>
              p === "gap" ? (
                <PaginationItem key={`gap-${i}`} className="hidden sm:block">
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p} className={p === page ? undefined : "hidden sm:block"}>
                  <PaginationLink isActive={p === page} className="font-mono tabular-nums" {...link(p)}>
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext {...(page < pages ? link(page + 1) : { "aria-disabled": true, className: "pointer-events-none opacity-50" })} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

/** Pages of a list paginated on the server: links that set `<prefix>p` and keep everything else. */
export function UrlPager({ prefix, ...props }: PagerProps & { prefix: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const href = (page: number) => {
    const next = new URLSearchParams(params);
    if (page > 1) next.set(`${prefix}p`, String(page));
    else next.delete(`${prefix}p`);
    return next.size ? `${pathname}?${next}` : pathname;
  };
  return (
    <PagerView
      {...props}
      link={(page) => ({
        href: href(page),
        onClick: (e) => {
          // The server renders the new page; keep the scroll where the table is.
          e.preventDefault();
          router.push(href(page), { scroll: false });
        },
      })}
    />
  );
}

/** Pages of a list that is already in the browser. */
export function StatePager({ onPage, ...props }: PagerProps & { onPage: (page: number) => void }) {
  return (
    <PagerView
      {...props}
      link={(page) => ({
        href: "#",
        onClick: (e) => {
          e.preventDefault();
          onPage(page);
        },
      })}
    />
  );
}

/** Slices a client-side list into pages, back to page 1 whenever the list changes. */
export function usePages<T>(items: T[], pageSize: number) {
  const [state, setState] = useState({ items, page: 1 });
  const page = state.items === items ? state.page : 1;
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pages);
  return {
    rows: items.slice((current - 1) * pageSize, current * pageSize),
    pager: { page: current, pageSize, total: items.length, onPage: (p: number) => setState({ items, page: p }) },
  };
}
