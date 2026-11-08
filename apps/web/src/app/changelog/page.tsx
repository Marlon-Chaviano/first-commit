import { BRAND, slugify } from "@kits/schema";
import { LinkIcon, RssIcon } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { SubscribeForm } from "@/features/newsletter/subscribe-form";
import { NEWSLETTER_COOKIE, parseNewsletterStatus } from "@/features/newsletter/status";
import { getChangelog, newsletterStatus, type ChangelogEntry } from "@/server/newsletter";
import { getViewer } from "@/server/session";
import { BrandName } from "@/components/shared/brand-name";

export const metadata: Metadata = {
  alternates: { canonical: "/changelog" },
  title: "Changelog",
  description: `What's new in ${BRAND.name}: catalog, official kits, CLI and website. Plus the weekly newsletter.`,
  alternates: { types: { "application/rss+xml": "/changelog/rss.xml" } },
};

const formatDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function ChangelogPage() {
  const entries = await getChangelog();
  // One timeline stop per day; a day with several releases lists them under the same date.
  const days = Object.entries(Object.groupBy(entries, (e) => e.date) as Record<string, ChangelogEntry[]>);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Changelog</h1>
          <p className="max-w-xl text-lg text-pretty text-muted-foreground">New kits, libraries and features in <BrandName />, newest first.</p>
        </div>
        <Button variant="outline" size="sm" className="w-fit" nativeButton={false} render={<a href="/changelog/rss.xml" />}>
          <RssIcon data-icon="inline-start" />
          RSS
        </Button>
      </header>

      <div className="mt-10">
        <Suspense fallback={<SubscribeForm />}>
          <Newsletter />
        </Suspense>
      </div>

      {days.length === 0 && (
        <Empty className="mt-16 border">
          <EmptyHeader>
            <EmptyTitle>Nothing here yet</EmptyTitle>
            <EmptyDescription>The first release notes land here. Subscribe above or follow the RSS feed to hear about them.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <ol className="changelog-rail relative mt-16">
        {days.map(([date, group], i) => (
          <li key={date} className="relative grid grid-cols-1 gap-4 pb-14 last:pb-0 md:grid-cols-[180px_minmax(0,1fr)] md:gap-10">
            <div className="md:sticky md:top-24 md:self-start">
              <time dateTime={date} className="flex items-center gap-2 font-mono text-sm">
                {formatDate.format(new Date(`${date}T00:00:00Z`))}
                {i === 0 && <Badge variant="secondary">Latest</Badge>}
              </time>
            </div>
            <div className="relative flex flex-col gap-10 pl-6 md:pl-10">
              {group.map((entry) => {
                const id = `${date}-${slugify(entry.title)}`;
                return (
                  <article key={id} id={id} className="changelog-entry relative z-10 scroll-mt-24">
                    <span aria-hidden className="changelog-dot absolute top-1.5 -left-[calc(1.5rem+3.5px)] size-2 rounded-full border border-foreground bg-foreground md:-left-[calc(2.5rem+3.5px)]" />
                    <h2 className="group text-lg font-semibold tracking-tight text-balance">
                      <a href={`#${id}`} className="inline-flex items-center gap-2 outline-none focus-visible:underline">
                        {entry.title}
                        <LinkIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
                      </a>
                    </h2>
                    <ul className="mt-3 flex flex-col gap-2 text-pretty text-muted-foreground">
                      {entry.items.map((item) => (
                        <li key={item} className="relative pl-5 before:absolute before:top-[0.7em] before:left-0 before:h-px before:w-2.5 before:bg-muted-foreground/60">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A signed-in subscriber sees "you're subscribed" on any device; anyone else, what this browser remembers. */
async function Newsletter() {
  const [viewer, jar] = await Promise.all([getViewer(), cookies()]);
  const remembered = parseNewsletterStatus(jar.get(NEWSLETTER_COOKIE)?.value);
  const stored = viewer?.email ? await newsletterStatus(viewer.email).catch(() => null) : null;
  return <SubscribeForm initial={stored ?? remembered} email={viewer?.email ?? undefined} />;
}
