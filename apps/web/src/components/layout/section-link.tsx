"use client";

import Link from "next/link";

/**
 * A link to a section of the home page ("/#leaderboard"). From another page it navigates there;
 * on the home page it scrolls smoothly to the section, even when the URL already has that hash.
 * The path is read on click, not with usePathname(): this link is in the header of every page, and
 * reading URL data while rendering would block prerendering of routes with params (/u/[handle]).
 */
export function SectionLink({ href, className, children, ...rest }: { href: `/#${string}`; className?: string; children: React.ReactNode } & Pick<React.ComponentProps<"a">, "aria-current">) {
  return (
    <Link
      href={href}
      className={className}
      {...rest}
      onClick={(e) => {
        if (window.location.pathname !== "/") return;
        const target = document.getElementById(href.slice(2));
        if (!target) return;
        e.preventDefault();
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        history.replaceState(null, "", href);
      }}
    >
      {children}
    </Link>
  );
}
