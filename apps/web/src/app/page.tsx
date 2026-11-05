import { AGENTS, BRAND, cliCommand, LANGUAGES } from "@kits/schema";
import Link from "next/link";

import { PixelWordmark } from "@/components/layout/pixel-wordmark";
import { Command } from "@/components/shared/command";
import { Marquee } from "@/components/shared/marquee";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TechIcon } from "@/components/shared/tech-icon";
import { KitLeaderboard } from "@/features/kits/kit-leaderboard";
import { DescribeProject } from "@/features/recommend/describe-project";
import { getLeaderboard } from "@/server/metrics/queries";
import { getAllEntries, getFeaturedEntries } from "@/server/registry";
import { getVerification } from "@/server/verifications/queries";

export default async function Home() {
  const [kits, featured] = await Promise.all([getAllEntries(), getFeaturedEntries()]);
  // Every language, with kits first: the carousel also invites people to publish the missing ones.
  const languages = LANGUAGES.map((l) => ({ ...l, count: kits.filter((k) => (k.language ?? "typescript") === l.id).length })).sort(
    (a, b) => Number(b.count > 0) - Number(a.count > 0),
  );
  const [stats, verified] = await Promise.all([
    getLeaderboard(kits.map((k) => k.name)),
    Promise.all(kits.map(async (k) => [k.name, (await getVerification(k.name, k.version)).verified] as const)),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-20 px-4 pt-8 sm:px-6 sm:pt-12">
      <section className="flex flex-col gap-12">
        <div className="flex flex-col gap-5">
          <h1 className="sr-only">{BRAND.name}: de carpeta vacía a primer commit</h1>
          <PixelWordmark text={BRAND.name} layout="inline" animated className="hidden w-full md:block" />
          <PixelWordmark text={BRAND.name} layout="stacked" animated className="w-full max-w-[420px] md:hidden" />
          <p className="font-mono text-sm tracking-wider text-muted-foreground uppercase">De carpeta vacía a primer commit</p>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-14">
          {/* Left: what it does and how to try it, right under the title. */}
          <div className="flex flex-col gap-8">
            <p className="text-2xl leading-snug text-balance sm:text-[28px]">
              Un comando y tu proyecto arranca con dependencias, skills y MCP listos para tu agente.
            </p>
            <div className="flex flex-col gap-3">
              <h2 className="label-mono">Pruébalo ahora</h2>
              <Command command={cliCommand()} />
            </div>
          </div>

          {/* Right: what it works with, agents and languages stacked. */}
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <h2 className="label-mono">Funciona con estos agentes</h2>
              <Marquee label="Agentes compatibles" seconds={22}>
                {(copy) =>
                  AGENTS.map((a) => (
                    <li key={a.id} className="px-1.5">
                      <Tooltip>
                        <TooltipTrigger
                          render={<span tabIndex={copy ? -1 : 0} />}
                          className="flex size-12 items-center justify-center rounded-lg border text-foreground transition-colors hover:bg-muted/50"
                        >
                          <TechIcon id={a.id} label={a.label} className="size-6" />
                        </TooltipTrigger>
                        <TooltipContent>{a.label}</TooltipContent>
                      </Tooltip>
                    </li>
                  ))
                }
              </Marquee>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="label-mono">Por lenguaje</h2>
                <Link href="/stacks" className="font-mono text-xs text-muted-foreground hover:text-foreground">
                  Ver stacks →
                </Link>
              </div>
              <Marquee label="Lenguajes" seconds={40}>
                {(copy) =>
                  languages.map((l) => (
                    <li key={l.id} className="px-1.5">
                      <Tooltip>
                        <TooltipTrigger
                          render={<Link href={`/stacks/lenguaje/${l.id}`} tabIndex={copy ? -1 : undefined} />}
                          data-empty={l.count === 0}
                          className="flex size-12 items-center justify-center rounded-lg border text-foreground transition-colors hover:bg-muted/50 data-[empty=true]:text-muted-foreground"
                        >
                          <TechIcon id={l.id} label={l.label} className="size-6" />
                        </TooltipTrigger>
                        <TooltipContent>
                          {l.label} · {l.count ? `${l.count} ${l.count === 1 ? "kit" : "kits"}` : "sin kits todavía"}
                        </TooltipContent>
                      </Tooltip>
                    </li>
                  ))
                }
              </Marquee>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="label-mono">Describe tu proyecto</h2>
        <DescribeProject />
      </section>

      {featured.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="label-mono">Destacados de la comunidad</h2>
          <ul className="grid gap-4 sm:grid-cols-3">
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
        <h2 className="label-mono">Ranking de kits</h2>
        <KitLeaderboard kits={kits} stats={stats} verified={Object.fromEntries(verified)} />
      </section>
    </div>
  );
}
