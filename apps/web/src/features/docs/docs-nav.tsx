"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DOCS_SECTIONS } from "@/lib/site-nav";
import { cn } from "@/lib/utils";

/** Docs sidebar: sections with a mono title, like skills.sh. On phones, one scrollable row. */
export function DocsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Documentation" className="flex gap-6 overflow-x-auto md:flex-col md:gap-7">
      {DOCS_SECTIONS.map((section) => (
        <div key={section.title} className="flex shrink-0 gap-4 md:flex-col md:gap-2.5">
          <p className="label-mono hidden text-foreground md:block">{section.title}</p>
          {section.pages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              aria-current={pathname === page.href ? "page" : undefined}
              className={cn("shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground", pathname === page.href && "text-foreground")}
            >
              {page.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
