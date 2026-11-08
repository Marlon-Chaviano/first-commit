import { cliCommand } from "@kits/schema";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Command } from "@/components/shared/command";
import { Skeleton } from "@/components/ui/skeleton";
import { PublishForm } from "@/features/account/publish-form";
import { LinkGithub } from "@/features/account/link-github";
import { hasGithubAccount } from "@/server/accounts";
import { devLogin, githubLogin } from "@/server/env";
import { listUserOrgs } from "@/server/orgs";
import { getViewer } from "@/server/session";

export const metadata: Metadata = {
  robots: { index: false }, title: "Publish a kit" };

export default function PublishPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <p className="label-mono text-muted-foreground">Publish</p>
        <h1 className="text-3xl font-semibold tracking-tight">Publish your kit</h1>
        <p className="text-muted-foreground">
          It&apos;s validated exactly as the CLI will read it and becomes available as <code className="font-mono">your-user/kit-name</code>. From
          the terminal, inside the repo:
        </p>
        <Command command={cliCommand("publish ./kit")} />
      </header>
      <Suspense fallback={<Skeleton className="h-80" />}>
        <Gate />
      </Suspense>
    </div>
  );
}

async function Gate() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const [orgs, github] = await Promise.all([listUserOrgs(viewer.id), hasGithubAccount(viewer.id)]);
  return (
    <>
      {!github && !devLogin && <LinkGithub enabled={githubLogin} back="/publish" />}
      <PublishForm dev={devLogin} orgs={orgs.map((o) => o.org.slug)} />
    </>
  );
}
