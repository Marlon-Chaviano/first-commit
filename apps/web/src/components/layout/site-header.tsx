import { BRAND } from "@kits/schema";
import Link from "next/link";

import { Separator } from "@/components/ui/separator";

import { KitsMark } from "./pixel-wordmark";
import { NavLinks } from "./nav-links";
import { StarButton } from "./star-button";
import { UserMenu } from "./user-menu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 bg-background/80 backdrop-blur">
      {/* Same width and gutters as the pages (max-w-5xl, px-4 sm:px-6), so the logo lines up with the content below. */}
      <nav aria-label="Main" className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3 text-[17px]">
          <KitsMark className="size-4.5" />
          <span className="text-muted-foreground">/</span>
          <span>{BRAND.name}</span>
        </Link>
        <div className="flex items-center gap-4 text-sm whitespace-nowrap text-muted-foreground sm:gap-5">
          <NavLinks />
          {/* Actions sit apart from the links: the GitHub star, then the account. */}
          <div className="flex items-center gap-2">
            <Separator orientation="vertical" className="mr-1 hidden h-5 data-vertical:self-center sm:block" />
            <StarButton />
            <UserMenu />
          </div>
        </div>
      </nav>
    </header>
  );
}
