import { AGENTS, buildInitCommand, resolve } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { Suspense } from "react";

import { Command } from "@/components/shared/command";
import { TechIcon } from "@/components/shared/tech-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentSetup } from "@/features/agent-help/agent-setup";
import { ShareButtons } from "@/features/kits/share-buttons";
import { StackLogos, stackLogoKeys } from "@/features/stacks/stack-card";
import { pageMetadata } from "@/lib/seo";
import { getKitPage } from "@/server/registry";
import { countOpen, getSharedConfig, SHARE_PARAM } from "@/server/share";

/** A shared configuration and everything the page shows about it, or null. */
async function load(id: string) {
  const shared = await getSharedConfig(id);
  if (!shared) return null;
  const page = await getKitPage(shared.kit);
  if (!page || page.meta.visibility !== "public") return null;
  const resolved = resolve(page.kit, shared.selections);
  const command = buildInitCommand(shared.kit, page.kit, shared.selections, shared.name ?? undefined);
  return { shared, kit: page.kit, resolved, command };
}

export async function generateMetadata({ params }: PageProps<"/k/[id]">): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);
  if (!data) return { robots: { index: false } };
  const picks = data.resolved.chosen.flatMap((c) => c.choices.filter((ch) => ch.id !== "none").map((ch) => ch.label));
  return {
    ...pageMetadata({
      title: `${data.kit.title} setup`,
      description: `${picks.length ? `${picks.slice(0, 6).join(", ")}. ` : ""}One command: ${data.command}`,
      path: `/k/${id}`,
      image: { url: `/og/k/${id}`, alt: `${data.kit.title}: ${data.command}` },
    }),
    // A copy of a kit page with other defaults: worth sharing, not worth indexing.
    robots: { index: false, follow: true },
  };
}

export default function SharedPage({ params }: PageProps<"/k/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><Skeleton className="h-96" /></div>}>
      <Shared id={params.then((p) => p.id)} />
    </Suspense>
  );
}

async function Shared({ id: idPromise }: { id: Promise<string> }) {
  const id = await idPromise;
  const data = await load(id);
  if (!data) notFound();
  const { shared, kit, resolved, command } = data;
  after(() => countOpen(id));
  const chosen = resolved.chosen.filter((c) => c.choices.some((ch) => ch.id !== "none"));
  const agents = AGENTS.filter((a) => shared.selections.agents.includes(a.id));
  const configurator = `/kits/${shared.kit}?${SHARE_PARAM}=${id}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-4">
        <p className="label-mono text-muted-foreground">Shared setup</p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{kit.title}</h1>
          <StackLogos keys={stackLogoKeys(kit.tags, shared.selections.options)} size="lg" />
        </div>
        <p className="text-pretty text-muted-foreground">
          {kit.description}{" "}
          <Link href={`/kits/${shared.kit}`} className="font-mono text-foreground underline-offset-4 hover:underline">
            {shared.kit}
          </Link>
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <Command command={command} wrap />
        <div className="flex flex-wrap items-center gap-2">
          <Button nativeButton={false} render={<Link href={configurator} />}>
            Open in the configurator
          </Button>
          <AgentSetup tasks={["project"]} kit={{ title: kit.title, command }} />
          <ShareButtons url={`/k/${id}`} title={kit.title} command={command} />
        </div>
      </section>

      {chosen.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="label-mono">What&apos;s chosen</h2>
          <dl className="grid grid-cols-[minmax(0,1fr)] divide-y rounded-xl border sm:grid-cols-[minmax(0,1fr)]">
            {chosen.map(({ optionId, choices }) => (
              <div key={optionId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <dt className="text-sm text-muted-foreground">{kit.options.find((o) => o.id === optionId)?.label ?? optionId}</dt>
                <dd className="flex flex-wrap justify-end gap-1.5">
                  {choices
                    .filter((ch) => ch.id !== "none")
                    .map((ch) => (
                      <Badge key={ch.id} variant="outline" className="font-mono">
                        {ch.label}
                      </Badge>
                    ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label="Skills" value={String(resolved.skills.length)} />
        <Fact label="MCP" value={String(Object.keys(resolved.mcp).length)} />
        <Fact label="Package manager" value={shared.selections.pm} />
        <div className="flex flex-col gap-1.5 rounded-xl border p-4">
          <span className="label-mono text-muted-foreground">Agents</span>
          <span className="flex flex-wrap gap-2">
            {agents.map((a) => (
              <TechIcon key={a.id} id={a.id} label={a.label} className="size-4" />
            ))}
          </span>
        </div>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border p-4">
      <span className="label-mono text-muted-foreground">{label}</span>
      <span className="font-mono text-lg tabular-nums">{value}</span>
    </div>
  );
}

