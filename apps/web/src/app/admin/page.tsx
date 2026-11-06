import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FeaturedButton } from "@/features/account/featured-button";
import { KitStatusButton } from "@/features/account/kit-status-button";
import { RefundButton } from "@/features/billing/buttons";
import { listPurchases } from "@/server/billing";
import { ReportStatusButton } from "@/features/account/report-status-button";
import { REPORT_REASONS } from "@/lib/reports";
import { getAdminData } from "@/server/accounts";
import { getViewer, isAdmin } from "@/server/session";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default function AdminPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-12">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Admin />
      </Suspense>
    </div>
  );
}

async function Admin() {
  if (!isAdmin(await getViewer())) notFound();
  const [{ reports, kits }, purchases] = await Promise.all([getAdminData(), listPurchases()]);
  const open = reports.filter((r) => r.status === "open");

  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="label-mono text-muted-foreground">Admin</p>
        <h1 className="text-3xl font-semibold tracking-tight">Moderation</h1>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="label-mono">Open reports ({open.length})</h2>
        <Separator />
        {reports.length ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="label-mono text-muted-foreground">Kit</TableHead>
                <TableHead className="label-mono text-muted-foreground">Reason</TableHead>
                <TableHead className="label-mono text-muted-foreground">Details</TableHead>
                <TableHead className="label-mono text-muted-foreground">Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/kits/${r.kit}`} className="font-mono hover:underline">
                      {r.kit}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">{REPORT_REASONS[r.reason as keyof typeof REPORT_REASONS] ?? r.reason}</TableCell>
                  <TableCell className="max-w-72 text-xs whitespace-normal text-muted-foreground">
                    {r.details}
                    {r.contact && <span className="block font-mono">{r.contact}</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "open" ? "default" : "outline"}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "open" ? (
                      <>
                        <ReportStatusButton id={r.id} to="resolved">Resolved</ReportStatusButton>
                        <ReportStatusButton id={r.id} to="dismissed">Dismiss</ReportStatusButton>
                      </>
                    ) : (
                      <ReportStatusButton id={r.id} to="open">Reopen</ReportStatusButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No hay denuncias.</p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="label-mono">Community kits ({kits.length})</h2>
        <Separator />
        <Table>
          <TableBody>
            {kits.map(({ kit, handle }) => (
              <TableRow key={kit.id}>
                <TableCell>
                  <Link href={`/kits/${kit.slug}`} className="font-mono hover:underline">
                    {kit.slug}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {handle} · {kit.repo} · v{kit.latestVersion}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{kit.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {kit.status === "active" && <FeaturedButton slug={kit.slug} featured={Boolean(kit.featuredAt)} />}
                  {kit.status === "hidden" ? (
                    <KitStatusButton slug={kit.slug} to="active">Show</KitStatusButton>
                  ) : (
                    <KitStatusButton slug={kit.slug} to="hidden">Hide</KitStatusButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="label-mono">Paid kit purchases ({purchases.length})</h2>
        <Separator />
        {purchases.length ? (
          <Table>
            <TableBody>
              {purchases.map(({ license, kit, buyer }) => (
                <TableRow key={license.id}>
                  <TableCell className="font-mono">{kit}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {buyer} · {(license.amountCents / 100).toFixed(2)} € (fee {(license.feeCents / 100).toFixed(2)} €) · {license.createdAt.toISOString().slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{license.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{license.status === "active" && <RefundButton licenseId={license.id} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No purchases yet.</p>
        )}
      </section>
    </>
  );
}
