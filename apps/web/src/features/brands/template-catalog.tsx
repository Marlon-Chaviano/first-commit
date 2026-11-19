"use client";

import { ArrowUpRightIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { CATALOG_PAGE_SIZE } from "@/lib/catalog-page";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

import { BrandPreview } from "./brand-preview";
import { BrandSkeletons } from "./brand-skeletons";
import type { BrandTemplatePage } from "./templates";

export function TemplateCatalog({ initial }: { initial: BrandTemplatePage }) {
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();

  return (
    <section id="templates" aria-labelledby="templates-title" className="flex scroll-mt-20 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="templates-title" className="label-mono">Brand templates</h2>
          <p className="text-sm text-muted-foreground">Explore a palette, typography and logo. Fork a template to make it yours.</p>
        </div>
        <InputGroup className="w-full sm:w-64">
          <InputGroupAddon><SearchIcon /></InputGroupAddon>
          <InputGroupInput type="search" aria-label="Search brand templates" placeholder="Search brands or fonts" value={query} onChange={(e) => setQuery(e.target.value)} />
        </InputGroup>
      </div>
      <CatalogResults key={term} query={term} initial={initial} clearSearch={() => setQuery("")} />
    </section>
  );
}

type ResultsProps = {
  query: string;
  initial: BrandTemplatePage;
  clearSearch: () => void;
};

function CatalogResults({ query, initial, clearSearch }: ResultsProps) {
  const [results, setResults] = useState<BrandTemplatePage | null>(query ? null : initial);
  const [requestedPage, requestPage] = useState<number | null>(query ? 1 : null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (requestedPage === null) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const params = new URLSearchParams({ page: String(requestedPage) });
        if (query) params.set("q", query);
        const response = await fetch(`/api/v1/brand-templates?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Catalog request failed");
        const page: BrandTemplatePage = await response.json();
        if (controller.signal.aborted) return;
        setResults((previous) => previous ? { ...page, items: [...previous.items, ...page.items] } : page);
      } catch {
        if (controller.signal.aborted) return;
        setFailed(true);
      }
      requestPage(null);
    };
    const timer = window.setTimeout(load, query && requestedPage === 1 ? 200 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, requestedPage]);

  const nextPage = results ? results.nextPage : 1;
  const remaining = results ? results.total - results.items.length : 0;
  const status = failed ? "Couldn’t load these templates. Try again." : !results ? "Searching…" : results.total === 0 ? "No matching templates. Try another brand or font." : null;

  return (
    <>
      <ul aria-busy={requestedPage !== null} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {results?.items.map(({ id, href, title, colors, fonts, radius }) => (
          <li key={id}>
            <Link href={href} prefetch={false} aria-label={`View ${title} template`}
              className="group block h-full rounded-xl hover:ring-1 hover:ring-foreground/40 focus-visible:outline-2 focus-visible:outline-ring">
              <BrandPreview
                profile={{ title, colors, fonts, radius, assets: { logo: `/brand-templates/${id}.svg` } }}
                action={<ArrowUpRightIcon aria-hidden="true" className="size-4 text-muted-foreground group-hover:text-foreground" />}
              />
            </Link>
          </li>
        ))}
        {requestedPage !== null && <BrandSkeletons count={results ? Math.min(CATALOG_PAGE_SIZE, remaining) : CATALOG_PAGE_SIZE} />}
      </ul>
      {nextPage !== null && (results || failed) && (
        <Button
          variant="ghost"
          disabled={requestedPage !== null}
          onClick={() => {
            setFailed(false);
            requestPage(nextPage);
          }}
          className="group h-12 w-full justify-start gap-2 rounded-none border-x-0 border-t border-b-0 border-border px-2 font-mono text-sm font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <ChevronDownIcon className="size-4 transition-transform group-hover:translate-y-0.5 motion-reduce:transition-none" />
          {failed ? "Retry" : requestedPage !== null ? "Loading…" : `Show ${Math.min(CATALOG_PAGE_SIZE, remaining)} more`}
          {remaining > 0 && <span className="text-xs tabular-nums">({remaining} remaining)</span>}
        </Button>
      )}
      {(status || query) && (
        <div className="flex flex-wrap items-center gap-3">
          {status && <p role="status" className="text-xs text-muted-foreground">{status}</p>}
          {query && <Button variant="ghost" size="sm" className="ml-auto" onClick={clearSearch}>Clear search</Button>}
        </div>
      )}
    </>
  );
}
