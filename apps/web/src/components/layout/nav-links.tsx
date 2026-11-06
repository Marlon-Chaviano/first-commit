"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { cn } from "@/lib/utils";

import { SectionLink } from "./section-link";

const NAV = [
  // On phones only the first two fit; the rest are also in the footer.
  { href: "/#leaderboard", label: "Kits", mobile: true, match: ["/", "/kits"] },
  { href: "/stacks", label: "Stacks", match: ["/stacks"] },
  { href: "/brands", label: "Brands", match: ["/brands"] },
  { href: "/docs", label: "Docs", mobile: true, match: ["/docs"] },
  { href: "/changelog", label: "Changelog", match: ["/changelog"] },
];

/** Is `pathname` this item's page or one below it? "/" only matches itself. */
const isActive = (pathname: string, match: string[]) => match.some((m) => (m === "/" ? pathname === "/" : pathname === m || pathname.startsWith(`${m}/`)));

function Links({ pathname }: { pathname: string | null }) {
  return NAV.map((item) => {
    const active = pathname !== null && isActive(pathname, item.match);
    const className = cn("transition-colors hover:text-foreground", active && "text-foreground", !item.mobile && "hidden md:inline");
    const current = active ? ("page" as const) : undefined;
    // Home sections scroll smoothly instead of jumping.
    return item.href.startsWith("/#") ? (
      <SectionLink key={item.href} href={item.href as `/#${string}`} className={className} aria-current={current}>
        {item.label}
      </SectionLink>
    ) : (
      <Link key={item.href} href={item.href as "/"} className={className} aria-current={current}>
        {item.label}
      </Link>
    );
  });
}

function ActiveLinks() {
  return <Links pathname={usePathname()} />;
}

/**
 * The header's links, the current section in white. The path is URL data, so it's read under its own
 * <Suspense>: the header (on every page) still prerenders, with the plain links until the path arrives.
 */
export function NavLinks() {
  return (
    <Suspense fallback={<Links pathname={null} />}>
      <ActiveLinks />
    </Suspense>
  );
}
