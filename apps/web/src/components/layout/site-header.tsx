import { BRAND } from "@kits/schema";
import Link from "next/link";

import { Separator } from "@/components/ui/separator";

import { BrandMark } from "./pixel-wordmark";
import { MobileNav, NavLinks } from "./nav-links";
import { StarButton } from "./star-button";
import { UserMenu } from "./user-menu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 bg-background/80 backdrop-blur">
      {/* Same width and gutters as the pages (max-w-5xl, px-4 sm:px-6), so the logo lines up with the content below. */}
      <nav aria-label="Main" className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* The horizontal logo: the symbol, then the name in Geist Mono Medium, as in public/brand/. */}
        <Link href="/" aria-label={`${BRAND.name}, home`} className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
          <BrandMark className="size-7" />
          <span className="font-mono text-[17px] font-medium tracking-tight">{BRAND.name}</span>
        </Link>
        <div className="flex items-center gap-4 text-sm whitespace-nowrap text-muted-foreground sm:gap-5">
          <NavLinks />
          {/* Actions sit apart from the links: the GitHub star, then the account. */}
          <div className="flex items-center gap-2">
            <Separator orientation="vertical" className="mr-1 hidden h-5 data-vertical:self-center sm:block" />
            <span className="hidden md:contents">
              <StarButton />
            </span>
            <UserMenu />
            <MobileNav />
          </div>
        </div>
      </nav>
    </header>
  );
}
