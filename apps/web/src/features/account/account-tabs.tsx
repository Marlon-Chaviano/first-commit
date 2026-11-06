"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ACCOUNT_TABS } from "@/lib/site-nav";
import { cn } from "@/lib/utils";

/** One tab per account page. Each is its own URL, so the user menu can link straight to a tab. */
export function AccountTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-6 border-b">
        {ACCOUNT_TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex h-10 items-center border-b-2 text-sm transition-colors",
                  active ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
