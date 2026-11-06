import { BRAND, buildInitCommand, cliCommand, defaultSelections, entryLanguage, LANGUAGES } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Command } from "@/components/shared/command";
import { TechIcon, TechLogo } from "@/components/shared/tech-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getAllEntries, getKit } from "@/server/registry";
import { getStacks } from "@/server/stacks";
import { StackCard, stackLogoKeys } from "@/features/stacks/stack-card";
import { LoadMoreList } from "@/components/shared/load-more-list";

export function generateStaticParams() {
  return LANGUAGES.map((l) => ({ lang: l.id }));
}

export async function generateMetadata({ params }: PageProps<"/stacks/language/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const language = LANGUAGES.find((l) => l.id === lang);
  if (!language) return {};
  const count = (await getAllEntries()).filter((k) => entryLanguage(k) === language.id).length;
  return {
    title: `${language.label} kits`,
    description: `${language.label} project templates with dependencies, skills for your agent and MCP already set up. ${language.description}`,
    // A language without kits is a placeholder, not content.
    robots: count ? undefined : { index: false },
  };
}

export default function LanguagePage({ params }: PageProps<"/stacks/language/[lang]">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 pt-12 sm:px-6"><Skeleton className="h-96" /></div>}>
      <LanguageContent lang={params.then((p) => p.lang)} />
    </Suspense>
  );
}

/** Kit cards are large (each one has its command): a short first page. */
const KITS_PER_PAGE = 6;

async function LanguageContent({ lang: langPromise }: { lang: Promise<string> }) {
  const lang = await langPromise;
  const language = LANGUAGES.find((l) => l.id === lang);
  if (!language) notFound();
  const entries = (await getAllEntries()).filter((k) => entryLanguage(k) === language.id);
  const kits = (await Promise.all(entries.map(async (e) => ({ entry: e, kit: await getKit(e.name) })))).filter((k) => k.kit);
  const names = new Set(entries.map((e) => e.name));
  const stacks = (await getStacks()).filter((s) => names.has(s.kit.name));

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
      <p className="label-mono text-muted-foreground">
        <Link href="/stacks" className="hover:text-foreground">stacks</Link> / language
      </p>
      <header className="mt-6 flex items-center gap-4">
        <TechIcon id={language.id} label={language.label} className="size-10" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{language.label}</h1>
          <p className="mt-1 text-pretty text-muted-foreground">{language.description}</p>
        </div>
      </header>

      {kits.length === 0 ? (
        <Empty className="mt-10 border">
          <EmptyHeader>
            <EmptyTitle>No {language.label} kits yet</EmptyTitle>
            <EmptyDescription>Turn your project into a kit with {BRAND.cli} create and publish it: it&apos;ll be the first.</EmptyDescription>
          </EmptyHeader>
          <Button nativeButton={false} render={<Link href="/docs/create-kit" />}>Create a kit</Button>
        </Empty>
      ) : (
        <section className="mt-10 flex flex-col gap-4">
          <h2 className="label-mono">Kits ({kits.length})</h2>
          <LoadMoreList pageSize={KITS_PER_PAGE} noun={["kit", "kits"]} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {kits.map(({ entry, kit }) => (
              <li key={entry.name} className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <Link href={`/kits/${entry.name}`} className="font-semibold hover:underline">{entry.title}</Link>
                    <span className="font-mono text-xs text-muted-foreground">{entry.name}</span>
                  </div>
                  {entry.official && <Badge variant="outline">official</Badge>}
                </div>
                <p className="text-sm text-pretty text-muted-foreground">{entry.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {entry.tags.slice(0, 5).map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1.5 font-mono font-normal">
                      <TechLogo id={t} label="" className="size-3" />
                      {t}
                    </Badge>
                  ))}
                </div>
                <Command command={buildInitCommand(entry.name, kit!, defaultSelections(kit!))} />
              </li>
            ))}
          </LoadMoreList>
        </section>
      )}

      {stacks.length > 0 && (
        <section className="mt-12 flex flex-col gap-4">
          <h2 className="label-mono">Stacks</h2>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
            {stacks.map(({ stack, kit, installs, popular }) => (
              <li key={stack.slug}>
                <StackCard
                  slug={stack.slug}
                  title={stack.title}
                  description={stack.description}
                  kit={kit.name}
                  installs={installs}
                  popular={popular}
                  logoKeys={stackLogoKeys(kit.tags, stack.options)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-12 text-sm text-muted-foreground">
        Missing a framework? <code className="font-mono">{cliCommand("create")}</code> turns your project into a kit.
      </p>
    </div>
  );
}
