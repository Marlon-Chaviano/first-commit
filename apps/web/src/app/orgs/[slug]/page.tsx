import { cliCommand } from "@kits/schema";
import type { Metadata } from "next";
import { ArrowLeftIcon, BadgeCheckIcon } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { Command } from "@/components/shared/command";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BillingPanel } from "@/features/billing/billing-panel";
import { KitActions } from "@/features/account/kit-actions";
import { AddMemberForm, DeleteOrgButton, PolicyForm, RemoveMemberButton } from "@/features/orgs/org-forms";
import { formatCount } from "@/lib/format";
import { getKitStats } from "@/server/metrics/queries";
import { kitAccess } from "@/server/kit-access";
import { getOrg, listMembers, listOrgKits, orgCapabilities, type OrgRole } from "@/server/orgs";
import { PLANS, planOf } from "@/server/plans";
import { getViewer } from "@/server/session";
import { billingEnabled } from "@/server/stripe";

export const metadata: Metadata = { title: "Organization", robots: { index: false } };

export default function OrgPage({ params }: PageProps<"/orgs/[slug]">) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-12 px-4 py-12">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Org slug={params.then((p) => p.slug)} />
      </Suspense>
    </div>
  );
}

async function Org({ slug: slugPromise }: { slug: Promise<string> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account/orgs");
  const org = await getOrg(await slugPromise);
  // Non-members get the same 404 as a missing org.
  const can = org ? await orgCapabilities(org, viewer) : null;
  if (!org || !can?.isMember) notFound();
  const role = can.role!;
  const [members, kits] = await Promise.all([listMembers(org.id), listOrgKits(org.id)]);
  const [stats, access] = await Promise.all([
    Promise.all(kits.map((k) => getKitStats(k.slug))),
    Promise.all(kits.map((k) => kitAccess({ ...k, kitId: k.id }, viewer))),
  ]);
  const plan = PLANS[planOf(org.plan)];

  return (
    <>
      <Link href="/account/orgs" className="-mb-6 flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-3.5" />
        Your organizations
      </Link>
      <header className="flex flex-col gap-1">
        <p className="label-mono text-muted-foreground">Organization · {role}</p>
        <h1 className="font-mono text-3xl font-semibold">{org.slug}</h1>
        <p className="text-muted-foreground">
          {org.name}
          {org.verifiedDomain && (
            <span className="ml-2 inline-flex items-center gap-1 text-sm">
              <BadgeCheckIcon className="size-3.5 text-foreground" />
              {org.verifiedDomain}
            </span>
          )}
          {billingEnabled && (
            <>
              {" "}· plan <Badge variant="outline">{plan.label}</Badge>
            </>
          )}
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="label-mono">Private kits</h2>
        <Separator />
        {kits.length ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="label-mono text-muted-foreground">Kit</TableHead>
                <TableHead className="label-mono text-right text-muted-foreground">Installs</TableHead>
                <TableHead className="label-mono text-right text-muted-foreground">People</TableHead>
                <TableHead className="label-mono text-right text-muted-foreground">Updates</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {kits.map((k, i) => (
                <TableRow key={k.id}>
                  <TableCell>
                    <Link href={`/kits/${k.slug}`} className="font-mono hover:underline">{k.slug}</Link>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">v{k.latestVersion}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCount(stats[i]!.installs)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCount(stats[i]!.unique)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCount(stats[i]!.retention.update ?? 0)}</TableCell>
                  <TableCell className="w-10 text-right">{access[i]!.manage && <KitActions slug={k.slug} status={k.status} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No kits yet. Publish one from the kit&apos;s folder:</p>
        )}
        <Command command={cliCommand(`publish --org ${org.slug}`)} />
        <p className="text-sm text-muted-foreground">
          Members install it after <code className="font-mono">{cliCommand("login")}</code> with{" "}
          <code className="font-mono">{cliCommand(`${org.slug}/<kit>`)}</code>. Nobody outside can see or download it.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="label-mono">Members ({members.length})</h2>
        <Separator />
        <Table>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.userId}>
                <TableCell className="font-mono">{m.handle ?? m.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{m.role}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {can.canRemove({ userId: m.userId, role: m.role as OrgRole }) && (
                    <RemoveMemberButton org={org.slug} userId={m.userId} self={m.userId === viewer.id} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {can.canAddMembers && <AddMemberForm org={org.slug} canAddOwners={can.canAddOwners} />}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="label-mono">Library policy</h2>
        <Separator />
        <PolicyForm org={org.slug} required={org.policy.required} forbidden={org.policy.forbidden} editable={can.canEditPolicy} />
        <p className="text-sm text-muted-foreground">In CI, with a member&apos;s token:</p>
        <Command command={`KITS_TOKEN=\${{ secrets.KITS_TOKEN }} ${cliCommand("doctor")}`} />
      </section>

      {billingEnabled && (
        <section className="flex flex-col gap-4">
          <h2 className="label-mono">Plan</h2>
          <Separator />
          <BillingPanel subject={{ kind: "org", slug: org.slug }} plan={planOf(org.plan)} canManage={can.canManageBilling} seats={members.length} />
        </section>
      )}

      {can.canDelete && (
        <section className="flex flex-col gap-4">
          <h2 className="label-mono">Danger zone</h2>
          <DeleteOrgButton org={org.slug} />
        </section>
      )}
    </>
  );
}
