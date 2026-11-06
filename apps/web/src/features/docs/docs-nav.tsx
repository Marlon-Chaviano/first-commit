"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { DOCS_SECTIONS } from "@/lib/site-nav";
import { cn } from "@/lib/utils";

/**
 * Docs sidebar: sections with a mono title, like skills.sh. On phones, one scrollable row of pills
 * that fades at the edges and keeps the current page in view.
 */
export function DocsNav() {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const row = nav.current;
    const current = row?.querySelector<HTMLElement>("[aria-current=page]");
    // Only the phone row scrolls sideways; the sidebar never needs to.
    if (row && current && row.scrollWidth > row.clientWidth) row.scrollLeft = current.offsetLeft - (row.clientWidth - current.offsetWidth) / 2;
  }, [pathname]);
  return (
    <nav
      ref={nav}
      aria-label="Documentation"
      className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] mask-x-from-[calc(100%-2rem)] mask-x-to-100% sm:-mx-6 sm:px-6 md:mx-0 md:flex-col md:gap-7 md:overflow-visible md:px-0 md:mask-none"
    >
      {DOCS_SECTIONS.map((section) => (
        <div key={section.title} className="flex shrink-0 gap-1 md:flex-col md:gap-2.5">
          <p className="label-mono hidden text-foreground md:block">{section.title}</p>
          {section.pages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              aria-current={pathname === page.href ? "page" : undefined}
              className={cn(
                "flex h-9 shrink-0 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:text-foreground md:h-auto md:rounded-none md:px-0",
                pathname === page.href && "bg-muted text-foreground md:bg-transparent",
              )}
            >
              {page.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
