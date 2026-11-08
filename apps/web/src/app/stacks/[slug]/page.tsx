import { BRAND, buildInitCommand, kitLanguage, LANGUAGES, LIBRARY_OPTION_IDS, REPO_URL, resolve } from "@kits/schema";
import { ArrowUpRightIcon, BoxIcon, FileTextIcon, KeyRoundIcon, PackageIcon, PaletteIcon, PlugIcon, SlidersHorizontalIcon, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Command } from "@/components/shared/command";
import { AgentSetup } from "@/features/agent-help/agent-setup";
import { JsonLd } from "@/components/shared/json-ld";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LOGOS } from "@/lib/logos";
import { recommendationHref } from "@/features/recommend/href";
import { StackCard, StackLogos, stackLogoKeys } from "@/features/stacks/stack-card";
import { TechIcon, TechLogo } from "@/components/shared/tech-icon";
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
  const language = kitLanguage(kit);
  const languageLabel = LANGUAGES.find((l) => l.id === language)?.label ?? language;
  // Every chosen library, with the option it belongs to.
  const chosen = kit.options.flatMap((o) =>
    (selections.options[o.id] ?? []).filter((id) => id !== "none").map((id) => ({ optionId: o.id, option: o.label, choice: o.choices.find((c) => c.id === id)! })),
  );
  // Skills grouped by the repository they come from: one row per source, its skills as chips.
  const skillSources = Object.entries(
    Object.groupBy(r.skills, (ref) => ref.slice(0, ref.lastIndexOf("@"))) as Record<string, string[]>,
  ).map(([source, refs]) => ({ source, skills: refs.map((ref) => ref.slice(ref.lastIndexOf("@") + 1)) }));
  // Same kit first, then same language.
  const related = (await getStacks())
    .filter((p) => p.stack.slug !== stack.slug && (p.kit.name === kit.name || kitLanguage(p.kit) === language))
    .sort((a, b) => Number(b.kit.name === kit.name) - Number(a.kit.name === kit.name))
    .slice(0, 4);

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
          keywords: chosen.map((c) => c.choice.label).join(", "),
        }}
      />
      <p className="font-mono text-xs text-muted-foreground">
        <Link href="/stacks" className="hover:text-foreground">stacks</Link> / {stack.slug}
      </p>

      <header className="mt-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-5">
          <StackLogos keys={stackLogoKeys(kit.tags, stack.options)} max={5} size="lg" />
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{stack.title}</h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{stack.description}</p>
        </div>
        {/* The page's two ways forward: change the stack, or see the kit it's built on. */}
        <div className="flex shrink-0 gap-2">
          <Button nativeButton={false} render={<Link href={recommendationHref(kit.name, stack.options, [])} />}>
            <SlidersHorizontalIcon data-icon="inline-start" />
            Customize
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href={`/kits/${kit.name}`} />}>
            Kit page
            <ArrowUpRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </header>

      <dl className="mt-8 grid grid-cols-2 overflow-hidden rounded-xl border sm:grid-cols-4 [&>div]:border-border [&>div:nth-child(2n)]:border-l sm:[&>div]:border-l sm:[&>div:first-child]:border-l-0 [&>div:nth-child(n+3)]:border-t sm:[&>div:nth-child(n+3)]:border-t-0">
        <Stat label="Installs">
          <span className="font-mono text-2xl font-semibold tabular-nums">{formatCount(installs)}</span>
        </Stat>
        <Stat label="Kit">
          <Link href={`/kits/${kit.name}`} className="truncate font-mono text-sm underline-offset-4 hover:underline">
            {kit.name}
          </Link>
        </Stat>
        <Stat label="Language">
          <span className="flex items-center gap-2 text-sm">
            <TechIcon id={language} label={languageLabel} className="size-4" />
            {languageLabel}
          </span>
        </Stat>
        <Stat label="For your agent">
          <span className="font-mono text-sm tabular-nums">
            {r.skills.length} skills · {Object.keys(r.mcp).length} MCP
          </span>
        </Stat>
      </dl>

      <section className="mt-12 flex flex-col gap-4">
        <h2 className="label-mono">Install</h2>
        <Command command={command} wrap className="w-fit max-w-full" />
        <AgentSetup tasks={["project"]} kit={{ title: stack.title, command }} className="w-fit" />
      </section>

      {chosen.length > 0 && (
        <section className="mt-14 flex flex-col gap-4">
          <h2 className="label-mono">What&apos;s included</h2>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {chosen.map(({ optionId, option, choice }) => {
              const PackIcon = PACK_ICONS[optionId];
              return (
                <li key={`${optionId}-${choice.id}`} className="flex h-full flex-col gap-3 rounded-xl border p-4">
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex shrink-0 items-center">
                      {PackIcon ? <PackIcon className="size-5" /> : (LOGOS[choice.id] ? <TechLogo id={choice.id} label="" className="size-5" /> : <BoxIcon className="size-5 text-muted-foreground" />)}
                    </span>
                    {choice.skills.length > 0 && (
                      <Badge variant="outline" className="font-mono tabular-nums">
                        {choice.skills.length} {choice.skills.length === 1 ? "skill" : "skills"}
                      </Badge>
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">{option}</span>
                    <span className="font-medium">{choice.label}</span>
                    {choice.description && <span className="line-clamp-3 text-sm text-pretty text-muted-foreground">{choice.description}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-14 grid grid-cols-[minmax(0,1fr)] gap-10 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          <h2 className="label-mono">
            Skills <span className="text-muted-foreground">· {r.skills.length}</span>
          </h2>
          <ul className="flex flex-col divide-y rounded-xl border">
            {skillSources.map(({ source, skills }) => (
              <li key={source} className="flex flex-col gap-2.5 p-4">
                <a
                  href={`https://github.com/${source}`}
                  className="flex w-fit items-center gap-2 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <TechIcon id="github" label="" className="size-3.5" />
                  {source}
                </a>
                <span className="flex flex-wrap gap-1.5">
                  {skills.map((name) => (
                    <Badge key={name} variant="secondary" className="font-mono font-normal">
                      {name}
                    </Badge>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-4">
          <h2 className="label-mono">MCP and rules</h2>
          <ul className="flex flex-col divide-y rounded-xl border">
            {Object.entries(r.mcp).map(([name, server]) => (
              <li key={name} className="flex items-center gap-3 p-4">
                <span className="flex shrink-0">
                  <PlugIcon className="size-4" />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">{name}</span>
                  <span className="truncate font-mono text-xs text-muted-foreground">{"url" in server ? server.url : [server.command, ...server.args].join(" ")}</span>
                </span>
              </li>
            ))}
            <li className="flex items-center gap-3 p-4">
              <span className="flex shrink-0">
                <FileTextIcon className="size-4" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-mono text-sm font-medium">AGENTS.md</span>
                <span className="text-xs text-pretty text-muted-foreground">The rules of each library, so your agent uses only this stack.</span>
              </span>
            </li>
            {Object.keys(r.env).length > 0 && (
              <li className="flex items-center gap-3 p-4">
                <span className="flex shrink-0">
                  <KeyRoundIcon className="size-4" />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-mono text-sm font-medium">.env.example</span>
                  <span className="truncate font-mono text-xs text-muted-foreground">{Object.keys(r.env).join(", ")}</span>
                </span>
              </li>
            )}
          </ul>
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-16 flex flex-col gap-4">
          <h2 className="label-mono">More stacks</h2>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
            {related.map((p) => (
              <li key={p.stack.slug}>
                <StackCard
                  slug={p.stack.slug}
                  title={p.stack.title}
                  description={p.stack.description}
                  kit={p.kit.name}
                  installs={p.installs}
                  popular={p.popular}
                  logoKeys={stackLogoKeys(p.kit.tags, p.stack.options)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Curated skill packs have no logo: the same icons as in the configurator. */
const PACK_ICONS: Record<string, LucideIcon> = { [LIBRARY_OPTION_IDS.design]: PaletteIcon, [LIBRARY_OPTION_IDS.workflow]: PackageIcon };

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 p-4">
      <dt className="label-mono text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
