import { cliCommand } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Command } from "@/components/shared/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { KitActions } from "@/features/account/kit-actions";
import { TabHeader } from "@/features/account/tab-header";
import { LinkGithub } from "@/features/account/link-github";
import { formatCount } from "@/lib/format";
import { getUserKits, hasGithubAccount } from "@/server/accounts";
import { githubLogin } from "@/server/env";
import { getKitStats } from "@/server/metrics/queries";
import { MAX_KITS_PER_ACCOUNT } from "@/server/plans";
import { getViewer } from "@/server/session";

export const metadata: Metadata = { title: "Your kits", robots: { index: false } };

const STATUS: Record<string, string> = { active: "Active", retired: "Retired", hidden: "Hidden by moderation" };

export default function AccountKitsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-72" />}>
      <Kits />
    </Suspense>
  );
}

async function Kits() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account/kits");
  const [owned, github] = await Promise.all([getUserKits(viewer.id), hasGithubAccount(viewer.id)]);
  const stats = await Promise.all(owned.map((k) => getKitStats(k.slug)));
  const counted = owned.filter((k) => k.status !== "retired").length;

  return (
    <div className="flex flex-col gap-6">
      {!github && <LinkGithub enabled={githubLogin} />}
      <TabHeader
        title="Your kits"
        description={`${counted} of ${MAX_KITS_PER_ACCOUNT} published. Retired kits don't count.`}
        newHref={owned.length ? "/publish" : undefined}
        newLabel="Publish a new kit"
      />

      {owned.length ? (
        <ul className="flex flex-col divide-y rounded-xl border">
          {owned.map((k, i) => (
            <li key={k.id} className="flex items-start gap-4 p-4 sm:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/kits/${k.slug}`} className="font-mono text-sm font-medium hover:underline">
                    {k.slug}
                  </Link>
                  <span className="font-mono text-xs text-muted-foreground">v{k.latestVersion}</span>
                  {k.status !== "active" && <Badge variant="secondary">{STATUS[k.status] ?? k.status}</Badge>}
                  {k.visibility === "org" && <Badge variant="outline">Organization only</Badge>}
                </div>
                {k.description && <p className="line-clamp-1 text-sm text-muted-foreground">{k.description}</p>}
              </div>
              <Link href={`/account/kits/${k.slug}`} className="hidden shrink-0 flex-col items-end text-right sm:flex" aria-label={`Statistics for ${k.slug}`}>
                <span className="font-mono text-sm tabular-nums">{formatCount(stats[i]!.installs)}</span>
                <span className="text-xs text-muted-foreground">installs</span>
              </Link>
              <KitActions slug={k.slug} status={k.status} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No kits yet</EmptyTitle>
            <EmptyDescription>Turn a project you like into a kit: the CLI reads it and writes the kit.json for you.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="max-w-md">
            <Command command={cliCommand("create")} className="w-full" />
            <Button nativeButton={false} render={<Link href="/publish" />}>
              Publish a kit
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </div>
  );
}
