import { BRAND } from "@kits/schema";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { KitsMark } from "./pixel-wordmark";
import { StarButton } from "./star-button";
import { UserMenu } from "./user-menu";

const NAV = [
  // On phones only the first two fit; the rest are also in the footer.
  { href: "/#leaderboard", label: "Kits", mobile: true },
  { href: "/stacks", label: "Stacks", mobile: true },
  { href: "/novedades", label: "Novedades" },
  { href: "/docs", label: "Crear un kit" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 bg-background/80 backdrop-blur">
      <nav className="flex h-14 items-center justify-between px-4 sm:px-5">
        <Link href="/" className="flex items-center gap-3 text-[17px]">
          <KitsMark className="size-4.5" />
          <span className="text-muted-foreground">/</span>
          <span>{BRAND.name}</span>
        </Link>
        <div className="flex items-center gap-4 text-sm whitespace-nowrap text-muted-foreground sm:gap-5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn("transition-colors hover:text-foreground", !("mobile" in item) && "hidden md:inline")}
            >
              {item.label}
            </Link>
          ))}
          <StarButton />
          <UserMenu />
        </div>
      </nav>
    </header>
  );
}
