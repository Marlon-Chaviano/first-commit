import { BRAND, buildInitCommand, cliCommand, defaultSelections, LANGUAGES } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Command } from "@/components/shared/command";
import { TechIcon } from "@/components/shared/tech-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getAllEntries, getKit } from "@/server/registry";
import { getStacks } from "@/server/stacks";

export function generateStaticParams() {
  return LANGUAGES.map((l) => ({ lang: l.id }));
}

export async function generateMetadata({ params }: PageProps<"/stacks/lenguaje/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const language = LANGUAGES.find((l) => l.id === lang);
  if (!language) return {};
  const count = (await getAllEntries()).filter((k) => (k.language ?? "typescript") === language.id).length;
  return {
    title: `Kits de ${language.label}`,
    description: `Plantillas de proyecto en ${language.label} con dependencias, skills para tu agente y MCP ya configurados. ${language.description}`,
    // A language without kits is a placeholder, not content.
    robots: count ? undefined : { index: false },
  };
}

export default function LanguagePage({ params }: PageProps<"/stacks/lenguaje/[lang]">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 pt-12 sm:px-6"><Skeleton className="h-96" /></div>}>
      <LanguageContent lang={params.then((p) => p.lang)} />
    </Suspense>
  );
}

async function LanguageContent({ lang: langPromise }: { lang: Promise<string> }) {
  const lang = await langPromise;
  const language = LANGUAGES.find((l) => l.id === lang);
  if (!language) notFound();
  const entries = (await getAllEntries()).filter((k) => (k.language ?? "typescript") === language.id);
  const kits = (await Promise.all(entries.map(async (e) => ({ entry: e, kit: await getKit(e.name) })))).filter((k) => k.kit);
  const names = new Set(entries.map((e) => e.name));
  const stacks = (await getStacks()).filter((s) => names.has(s.kit.name));

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
      <p className="label-mono text-muted-foreground">
        <Link href="/stacks" className="hover:text-foreground">stacks</Link> / lenguaje
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
            <EmptyTitle>Aún no hay kits de {language.label}</EmptyTitle>
            <EmptyDescription>Convierte tu proyecto en un kit con {BRAND.cli} create y publícalo: será el primero.</EmptyDescription>
          </EmptyHeader>
          <Button nativeButton={false} render={<Link href="/docs" />}>Crear un kit</Button>
        </Empty>
      ) : (
        <section className="mt-10 flex flex-col gap-4">
          <h2 className="label-mono">Kits ({kits.length})</h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {kits.map(({ entry, kit }) => (
              <li key={entry.name} className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <Link href={`/kits/${entry.name}`} className="font-semibold hover:underline">{entry.title}</Link>
                    <span className="font-mono text-xs text-muted-foreground">{entry.name}</span>
                  </div>
                  {entry.official && <Badge variant="outline">oficial</Badge>}
                </div>
                <p className="text-sm text-pretty text-muted-foreground">{entry.description}</p>
                <Command command={buildInitCommand(entry.name, kit!, defaultSelections(kit!))} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {stacks.length > 0 && (
        <section className="mt-12 flex flex-col gap-4">
          <h2 className="label-mono">Stacks</h2>
          <ul className="divide-y border-y">
            {stacks.map(({ stack }) => (
              <li key={stack.slug}>
                <Link href={`/stacks/${stack.slug}`} className="flex flex-col gap-1 py-3 hover:bg-muted/50 sm:flex-row sm:items-baseline sm:gap-6 sm:px-2">
                  <span className="font-medium">{stack.title}</span>
                  <span className="flex-1 text-sm text-muted-foreground">{stack.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-12 text-sm text-muted-foreground">
        ¿Echas en falta un framework? <code className="font-mono">{cliCommand("create")}</code> convierte tu proyecto en un kit.
      </p>
    </div>
  );
}
