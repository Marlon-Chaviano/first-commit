import { BRAND, buildInitCommand, REPO_URL, resolve } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Command } from "@/components/shared/command";
import { JsonLd } from "@/components/shared/json-ld";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { recommendationHref } from "@/features/recommend/href";
import { formatCount } from "@/lib/format";
import { getStack, getStacks } from "@/server/stacks";

export async function generateStaticParams() {
  return (await getStacks()).map((p) => ({ slug: p.stack.slug }));
}

export async function generateMetadata({ params }: PageProps<"/stacks/[slug]">): Promise<Metadata> {
  const page = await getStack((await params).slug);
  return page ? { title: page.stack.title, description: page.stack.description, alternates: { canonical: `/stacks/${page.stack.slug}` } } : {};
}

// Popular stacks and new comparisons appear after the build, so params are request data for them.
export default function StackPage({ params }: PageProps<"/stacks/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 pt-12 sm:px-6"><Skeleton className="h-96" /></div>}>
      <StackContent slug={params.then((p) => p.slug)} />
    </Suspense>
  );
}

async function StackContent({ slug }: { slug: Promise<string> }) {
  const page = await getStack(await slug);
  if (!page) notFound();
  const { stack, kit, selections, installs } = page;
  const r = resolve(kit, selections);
  const command = buildInitCommand(kit.name, kit, selections);
  // Every chosen library, grouped by the option it belongs to.
  const chosen = kit.options
    .map((o) => ({ label: o.label, choices: (selections.options[o.id] ?? []).filter((id) => id !== "none").map((id) => o.choices.find((c) => c.id === id)!) }))
    .filter((g) => g.choices.length);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareSourceCode",
          name: stack.title,
          description: stack.description,
          url: `${BRAND.siteUrl}/stacks/${stack.slug}`,
          codeRepository: `${REPO_URL}/tree/${BRAND.branch}/registry/kits/${kit.name}`,
          programmingLanguage: kit.tags,
          runtimePlatform: kit.packageManagers,
          keywords: chosen.flatMap((g) => g.choices.map((c) => c.label)).join(", "),
        }}
      />
      <p className="label-mono text-muted-foreground">
        <Link href="/stacks" className="hover:text-foreground">stacks</Link> / {stack.slug}
      </p>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">{stack.title}</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{stack.description}</p>

      <section className="mt-10 flex flex-col gap-3">
        <h2 className="label-mono">Instalación</h2>
        <Command command={command} wrap />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={recommendationHref(kit.name, stack.options, [])} />}>
            Ajustar en el configurador
          </Button>
          <span className="font-mono text-xs text-muted-foreground">
            {formatCount(installs)} instalaciones con esta combinación · kit <Link className="underline underline-offset-4" href={`/kits/${kit.name}`}>{kit.name}</Link>
          </span>
        </div>
      </section>

      <div className="mt-12 grid gap-12 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="label-mono">Qué incluye</h2>
          <dl className="divide-y border-y">
            {chosen.map((g) => (
              <div key={g.label} className="grid grid-cols-[140px_1fr] gap-4 py-2.5 text-sm">
                <dt className="text-muted-foreground">{g.label}</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {g.choices.map((c) => (
                    <Badge key={c.id} variant="outline">{c.label}</Badge>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="label-mono">Para tu agente</h2>
          <ul className="flex flex-col gap-1 font-mono text-sm">
            {r.skills.map((s) => (
              <li key={s} className="truncate text-muted-foreground">skill · {s}</li>
            ))}
            {Object.keys(r.mcp).map((m) => (
              <li key={m} className="text-muted-foreground">mcp · {m}</li>
            ))}
            <li className="text-muted-foreground">AGENTS.md · reglas de cada biblioteca</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
