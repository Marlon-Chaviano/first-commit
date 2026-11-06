"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { DOCS_PAGES } from "@/lib/site-nav";

/** Previous and next page in sidebar order, so no docs page is a dead end. */
export function DocsPager() {
  const pathname = usePathname();
  const index = DOCS_PAGES.findIndex((p) => p.href === pathname);
  if (index === -1) return null;
  const prev = DOCS_PAGES[index - 1];
  const next = DOCS_PAGES[index + 1];
  return (
    <nav aria-label="Previous and next page" className="mt-16 grid grid-cols-1 gap-3 border-t pt-8 sm:grid-cols-2">
      {prev && (
        <Link href={prev.href} className="group flex flex-col gap-1.5 rounded-lg border p-4 transition-colors hover:bg-muted/50">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowLeftIcon className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            Previous
          </span>
          <span className="font-medium">{prev.label}</span>
        </Link>
      )}
      {next && (
        <Link href={next.href} className="group flex flex-col items-end gap-1.5 rounded-lg border p-4 text-right transition-colors hover:bg-muted/50 sm:col-start-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Next
            <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
          <span className="font-medium">{next.label}</span>
        </Link>
      )}
    </nav>
  );
}
