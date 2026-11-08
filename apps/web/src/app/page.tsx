import { AGENTS, BRAND, cliCommand, REPO_URL } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";

import { PixelWordmark } from "@/components/layout/pixel-wordmark";
import { JsonLd } from "@/components/shared/json-ld";
import { Command } from "@/components/shared/command";
import { Marquee } from "@/components/shared/marquee";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TechIcon } from "@/components/shared/tech-icon";
import { KitLeaderboard } from "@/features/kits/kit-leaderboard";
import { AgentSetup } from "@/features/agent-help/agent-setup";
import { TerminalDemo } from "@/features/home/terminal-demo";
import { DescribeProject } from "@/features/recommend/describe-project";
import { getLeaderboard } from "@/server/metrics/queries";
import { getAllEntries, getFeaturedEntries } from "@/server/registry";
import { getVerification } from "@/server/verifications/queries";
import { facets, RANKING_MIN_INSTALLS } from "@/lib/kit-query";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const [kits, featured] = await Promise.all([getAllEntries(), getFeaturedEntries()]);
  // Every language, with kits first: the carousel also invites people to publish the missing ones.
  const languages = facets(kits).languages.sort((a, b) => Number(b.count > 0) - Number(a.count > 0));
  const [stats, verified] = await Promise.all([
    getLeaderboard(kits.map((k) => k.name)),
    Promise.all(kits.map(async (k) => [k.name, (await getVerification(k.name, k.version)).verified] as const)),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-20 px-4 pt-8 sm:px-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "WebSite", "@id": `${BRAND.siteUrl}/#website`, name: BRAND.name, url: BRAND.siteUrl, description: "Project starters for AI coding agents." },
            { "@type": "Organization", "@id": `${BRAND.siteUrl}/#org`, name: BRAND.name, url: BRAND.siteUrl, logo: `${BRAND.siteUrl}/icon.svg`, sameAs: [REPO_URL, `https://www.npmjs.com/package/${BRAND.cli}`] },
            {
              "@type": "SoftwareApplication",
              name: BRAND.cli,
              alternateName: BRAND.name,
              applicationCategory: "DeveloperApplication",
              operatingSystem: "macOS, Linux, Windows",
              description: "A CLI that creates a project from a kit with its dependencies, agent skills, MCP servers and AGENTS.md set up.",
              url: BRAND.siteUrl,
              downloadUrl: `https://www.npmjs.com/package/${BRAND.cli}`,
              installUrl: `https://www.npmjs.com/package/${BRAND.cli}`,
              softwareHelp: `${BRAND.siteUrl}/docs`,
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              publisher: { "@id": `${BRAND.siteUrl}/#org` },
            },
            {
              "@type": "ItemList",
              name: "Kits",
              numberOfItems: kits.length,
              itemListElement: kits.slice(0, 30).map((k, i) => ({ "@type": "ListItem", position: i + 1, name: k.title, url: `${BRAND.siteUrl}/kits/${k.name}` })),
            },
          ],
        }}
      />
      <section className="flex flex-col gap-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <h1 className="sr-only">{BRAND.name}: from empty folder to first commit</h1>
          <PixelWordmark text={BRAND.name} layout="inline" animated className="hidden w-full max-w-4xl md:block" />
          <PixelWordmark text={BRAND.name} layout="stacked" animated className="mx-auto w-full max-w-[420px] md:hidden" />
          <p className="font-mono text-base tracking-[0.2em] text-muted-foreground uppercase sm:text-lg">From empty folder to first commit</p>
        </div>

        <div className="flex flex-col items-center gap-8">
          {/* What it does and how to try it, centered over the demo. */}
          <div className="flex flex-col items-center gap-6 text-center">
            <p className="max-w-2xl text-2xl leading-snug text-balance sm:text-[28px]">
              One command and your project starts with dependencies, skills and{" "}
              <Tooltip>
                <TooltipTrigger render={<span tabIndex={0} />} className="cursor-help underline decoration-muted-foreground decoration-dotted underline-offset-[6px]">
                  MCP
                </TooltipTrigger>
                <TooltipContent className="max-w-64 text-pretty">Model Context Protocol: servers that give your agent tools, like your database, Stripe or your UI library.</TooltipContent>
              </Tooltip>{" "}
              ready for your agent.
            </p>
            <div className="flex max-w-full flex-wrap items-center justify-center gap-3">
              {/* As wide as the command plus its copy button, not the whole row. */}
              <Command command={cliCommand().trim()} className="w-fit max-w-full" />
              <AgentSetup className="hidden h-11 sm:inline-flex" />
            </div>
            <p className="-mt-3 text-sm text-pretty text-muted-foreground">It asks for a kit and a name, or pass them directly. No account needed.</p>
            <AgentSetup variant="link" className="-mt-4 h-auto p-0 text-foreground sm:hidden" />
          </div>

          {/* The 15-second demo: from the command to an agent that already knows the stack. */}
          <TerminalDemo className="w-full max-w-3xl" />
        </div>
      </section>

      {/* Right under the hero: the most useful thing for someone who doesn't know which kit they need. */}
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="label-mono">Describe your project</h2>
          <p className="text-sm text-pretty text-muted-foreground">Tell it what you&apos;re building. You get the kit that fits, with its options chosen and the exact command to run.</p>
        </div>
        <DescribeProject />
      </section>

      <section aria-label="What it works with" className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-2 md:gap-14">
        <div className="flex flex-col gap-3">
          <h2 className="label-mono">Works with these agents</h2>
          <Marquee label="Supported agents" seconds={30}>
            {(copy) =>
              AGENTS.map((a) => (
                <li key={a.id} className="px-1">
                  {/* Named, not a bare glyph: the label says which agent it is. */}
                  <span className="flex h-11 items-center gap-2 rounded-lg border px-3 text-sm whitespace-nowrap" tabIndex={copy ? -1 : undefined}>
                    <TechIcon id={a.id} label={a.label} className="size-4" />
                    {a.label}
                  </span>
                </li>
              ))
            }
          </Marquee>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="label-mono">By language</h2>
            <Link href="/stacks" className="-my-2 py-2 font-mono text-xs text-muted-foreground hover:text-foreground">
              See stacks →
            </Link>
          </div>
          <Marquee label="Languages" seconds={50}>
            {(copy) =>
              languages.map((l) => (
                <li key={l.id} className="px-1">
                  <Link
                    href={`/stacks/language/${l.id}`}
                    tabIndex={copy ? -1 : undefined}
                    aria-label={`${l.label}: ${l.count ? `${l.count} ${l.count === 1 ? "kit" : "kits"}` : "no kits yet"}`}
                    data-empty={l.count === 0}
                    className="flex h-11 items-center gap-2 rounded-lg border px-3 text-sm whitespace-nowrap transition-colors hover:bg-muted/50 data-[empty=true]:text-muted-foreground"
                  >
                    <TechIcon id={l.id} label={l.label} className="size-4" />
                    {l.label}
                    {l.count > 0 && <span className="font-mono text-xs text-muted-foreground tabular-nums">{l.count}</span>}
                  </Link>
                </li>
              ))
            }
          </Marquee>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="label-mono">Community highlights</h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {featured.map((k) => (
              <li key={k.name}>
                <Link href={`/kits/${k.name}`} className="flex h-full flex-col gap-1.5 rounded-lg border p-4 hover:bg-muted/50">
                  <span className="font-mono text-sm">{k.name}</span>
                  <span className="text-sm text-muted-foreground">{k.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="leaderboard" className="flex scroll-mt-20 flex-col gap-4">
        <h2 className="label-mono">{stats.total >= RANKING_MIN_INSTALLS ? "Kit ranking" : "Kits"}</h2>
        <KitLeaderboard kits={kits} stats={stats} verified={Object.fromEntries(verified)} />
      </section>
    </div>
  );
}
