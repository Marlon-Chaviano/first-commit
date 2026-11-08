"use client";

import { REPO_URL } from "@kits/schema";
import { ArrowUpRightIcon, MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { TechIcon } from "@/components/shared/tech-icon";

import { SectionLink } from "./section-link";

// From md up they sit in the header; on phones they open from the menu button (MobileNav).
const NAV = [
  { href: "/#leaderboard", label: "Kits", match: ["/", "/kits"] },
  { href: "/stacks", label: "Stacks", match: ["/stacks"] },
  { href: "/brands", label: "Brands", match: ["/brands"] },
  { href: "/docs", label: "Docs", match: ["/docs"] },
  { href: "/changelog", label: "Changelog", match: ["/changelog"] },
];

/** Is `pathname` this item's page or one below it? "/" only matches itself. */
const isActive = (pathname: string, match: string[]) => match.some((m) => (m === "/" ? pathname === "/" : pathname === m || pathname.startsWith(`${m}/`)));

function Links({ pathname, className }: { pathname: string | null; className: (active: boolean) => string }) {
  return NAV.map((item) => {
    const active = pathname !== null && isActive(pathname, item.match);
    const current = active ? ("page" as const) : undefined;
    // Home sections scroll smoothly instead of jumping.
    return item.href.startsWith("/#") ? (
      <SectionLink key={item.href} href={item.href as `/#${string}`} className={className(active)} aria-current={current}>
        {item.label}
      </SectionLink>
    ) : (
      <Link key={item.href} href={item.href as "/"} className={className(active)} aria-current={current}>
        {item.label}
      </Link>
    );
  });
}

const inline = (active: boolean) => cn("hidden py-2 transition-colors hover:text-foreground md:inline", active && "text-foreground");
const stacked = (active: boolean) =>
  cn("flex h-12 items-center border-b text-base transition-colors last:border-b-0 hover:text-foreground", active ? "font-medium text-foreground" : "text-muted-foreground");

function ActiveLinks({ className }: { className: (active: boolean) => string }) {
  return <Links pathname={usePathname()} className={className} />;
}

/**
 * The header's links, the current section in white. The path is URL data, so it's read under its own
 * <Suspense>: the header (on every page) still prerenders, with the plain links until the path arrives.
 */
export function NavLinks() {
  return (
    <Suspense fallback={<Links pathname={null} className={inline} />}>
      <ActiveLinks className={inline} />
    </Suspense>
  );
}

/** Phones: every section behind one menu button, as full-width rows that are easy to tap. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="-mr-2 md:hidden" aria-label="Open menu" />}>
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="top" className="px-4 pt-3 pb-6">
        <SheetTitle className="label-mono h-8 content-center text-muted-foreground">Menu</SheetTitle>
        {/* A tap on any link navigates and closes the menu. */}
        <nav aria-label="Sections" className="flex flex-col" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
          <Suspense fallback={<Links pathname={null} className={stacked} />}>
            <ActiveLinks className={stacked} />
          </Suspense>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className={cn(stacked(false), "flex items-center gap-2")}>
            <TechIcon id="github" label="GitHub" className="size-4" />
            Star on GitHub
            <ArrowUpRightIcon className="size-3.5" />
          </a>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
