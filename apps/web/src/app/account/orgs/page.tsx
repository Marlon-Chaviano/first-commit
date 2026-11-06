import type { Metadata } from "next";
import { BadgeCheckIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { TabHeader } from "@/features/account/tab-header";
import { listUserOrgs } from "@/server/orgs";
import { getViewer } from "@/server/session";

export const metadata: Metadata = { title: "Organizations", robots: { index: false } };

export default function AccountOrgsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      <Orgs />
    </Suspense>
  );
}

async function Orgs() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account/orgs");
  const orgs = await listUserOrgs(viewer.id);
  return (
    <div className="flex flex-col gap-6">
      <TabHeader
        title="Organizations"
        description="A private registry for your team: kits, brand profiles and a library policy for members only."
        newHref={orgs.length ? "/account/orgs/new" : undefined}
        newLabel="New organization"
      />
      {orgs.length ? <OrgList orgs={orgs} /> : <NoOrgs />}
    </div>
  );
}

function NoOrgs() {
  return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>No organizations yet</EmptyTitle>
          <EmptyDescription>Create one with your work email: we send you a code to verify your company&apos;s domain.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button nativeButton={false} render={<Link href="/account/orgs/new" />}>
            Create an organization
          </Button>
        </EmptyContent>
      </Empty>
  );
}

function OrgList({ orgs }: { orgs: Awaited<ReturnType<typeof listUserOrgs>> }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {orgs.map(({ org, role }) => (
        <li key={org.id}>
          <Link href={`/orgs/${org.slug}`} className="flex h-full flex-col gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/40">
            <span className="flex items-center justify-between gap-3">
              <span className="font-mono font-medium">{org.slug}</span>
              <Badge variant="outline" className="font-mono">{role}</Badge>
            </span>
            <span className="text-sm text-muted-foreground">{org.name}</span>
            {org.verifiedDomain ? (
              <span className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <BadgeCheckIcon className="size-3.5 text-foreground" />
                {org.verifiedDomain} verified
              </span>
            ) : (
              <span className="mt-auto text-xs text-muted-foreground">Domain not verified</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
