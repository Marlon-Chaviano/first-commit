import { AUTHOR, BRAND } from "@kits/schema";
import { HeartIcon } from "lucide-react";
import Link from "next/link";

import { Separator } from "@/components/ui/separator";
import { EXPLORE_LINKS, FOOTER_DOCS, PROJECT_LINKS } from "@/lib/site-nav";
import { billingEnabled } from "@/server/stripe";

import { BrandMark } from "./pixel-wordmark";

interface FooterLink {
  href: string;
  label: string;
  external?: boolean;
}

/** Like skills.sh: the product on the left, link columns with a mono title on the right. */
export function SiteFooter() {
  const columns: { title: string; links: FooterLink[] }[] = [
    { title: "Explore", links: EXPLORE_LINKS },
    { title: "Docs", links: FOOTER_DOCS },
    { title: "Project", links: [...PROJECT_LINKS, ...(billingEnabled ? [{ href: "/pricing", label: "Pricing" }] : [])] },
  ];
  return (
    <footer className="mx-auto mt-24 w-full max-w-5xl px-4 pb-10 sm:px-6">
      <Separator />
      <div className="grid gap-10 pt-10 grid-cols-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:gap-14">
        <div className="col-span-2 flex max-w-xs flex-col gap-3 sm:col-span-1">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark className="size-6" />
            <span className="font-mono font-medium tracking-tight">{BRAND.name}</span>
          </Link>
          <p className="text-sm text-pretty text-muted-foreground">Projects ready for your agent from the first commit.</p>
          <p className="text-sm text-muted-foreground">
            Skills come from{" "}
            <a href="https://skills.sh" className="underline underline-offset-4 hover:text-foreground">
              skills.sh
            </a>
          </p>
          <p className="mt-auto flex flex-wrap items-center gap-1 pt-2 font-mono text-xs text-muted-foreground">
            Made with <HeartIcon aria-label="love" className="size-3.5 fill-foreground text-foreground" /> by{" "}
            <a href={AUTHOR.github} className="text-foreground underline underline-offset-4">
              {AUTHOR.name}
            </a>
          </p>
        </div>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col gap-3">
            <p className="label-mono">{column.title}</p>
            <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
              {column.links.map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a href={link.href} className="transition-colors hover:text-foreground">
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className="transition-colors hover:text-foreground">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
