import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportStatusButton } from "@/features/account/report-status-button";
import { AdminTabs, type AdminTab } from "@/features/admin/admin-tabs";
import { InstallsTable, KitsTable, SubscribersTable, UsersTable } from "@/features/admin/tables";
import { RefundButton } from "@/features/billing/buttons";
import { REPORT_REASONS } from "@/lib/reports";
import {
  getAdminOverview,
  INSTALL_TYPES,
  listAdminInstalls,
  listAdminKits,
  listAdminReports,
  listAdminSubscribers,
  listAdminUsers,
  SUBSCRIBER_FILTERS,
  USER_FILTERS,
} from "@/server/admin";
import { listPurchases } from "@/server/billing";
import { getViewer, isAdmin } from "@/server/session";
import { billingEnabled } from "@/server/stripe";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const formatDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const formatNumber = new Intl.NumberFormat("en");

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-12">
      <Suspense fallback={<AdminSkeleton />}>
        <Admin searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function AdminSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-16 w-64" />
      <Skeleton className="h-8 w-full max-w-xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}

type Params = Record<string, string | string[] | undefined>;
const text = (params: Params, key: string) => (typeof params[key] === "string" ? params[key] : "");
const pageOf = (params: Params, key: string) => Math.max(1, Math.min(10_000, Number.parseInt(text(params, key), 10) || 1));
/** A filter from the URL, or the first (default) one when it's missing or unknown. */
const oneOf = <T extends string>(params: Params, key: string, values: readonly T[]): T => (values.includes(text(params, key) as T) ? (text(params, key) as T) : values[0]!);

async function Admin({ searchParams }: { searchParams: Promise<Params> }) {
  const [viewer, params] = await Promise.all([getViewer(), searchParams]);
  if (!viewer || !isAdmin(viewer)) notFound();
  // Long lists are paginated on the server; each tab keeps its search, filter and page in the URL.
  const [overview, users, installs, kits, reports, newsletter, purchases] = await Promise.all([
    getAdminOverview(),
    listAdminUsers({ page: pageOf(params, "up"), q: text(params, "uq"), filter: oneOf(params, "uf", USER_FILTERS) }),
    listAdminInstalls({ page: pageOf(params, "ip"), q: text(params, "iq"), type: oneOf(params, "if", INSTALL_TYPES) }),
    listAdminKits(),
    listAdminReports(),
    listAdminSubscribers({ page: pageOf(params, "np"), q: text(params, "nq"), filter: oneOf(params, "nf", SUBSCRIBER_FILTERS) }),
    billingEnabled ? listPurchases() : Promise.resolve([]),
  ]);
  const openReports = reports.filter((r) => r.status === "open");

  const tabs: AdminTab[] = [
    { id: "overview", label: "Overview", content: <Overview overview={overview} kits={kits} openReports={openReports.length} /> },
    { id: "users", label: "Users", count: overview?.users, content: <UsersTable users={users} viewerId={viewer.id} /> },
    { id: "kits", label: "Kits", count: kits.length, content: <KitsTable kits={kits} /> },
    { id: "installs", label: "Installs", count: overview?.events, content: <InstallsTable installs={installs} /> },
    { id: "reports", label: "Reports", count: openReports.length, content: <Reports reports={reports} /> },
    { id: "newsletter", label: "Newsletter", count: overview?.subscribers, content: <Newsletter {...newsletter} overview={overview} /> },
    ...(billingEnabled ? [{ id: "purchases", label: "Purchases", count: purchases.length, content: <Purchases purchases={purchases} /> }] : []),
  ];

  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="label-mono text-muted-foreground">Admin</p>
        <h1 className="text-3xl font-semibold tracking-tight">Administration</h1>
        <p className="text-muted-foreground">Users, kits, installs, verification, moderation and the newsletter.</p>
      </header>
      <AdminTabs tabs={tabs} />
    </>
  );
}

function Stat({ label, value, hint, href }: { label: string; value: number; hint?: string; href?: string }) {
  const body = (
    <>
      <span className="label-mono text-muted-foreground">{label}</span>
      <span className="text-3xl font-semibold tracking-tight tabular-nums">{formatNumber.format(value)}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </>
  );
  const className = "flex flex-col gap-2 rounded-xl border p-4 sm:p-5";
  return href ? (
    <Link href={href} className={`${className} transition-colors hover:bg-muted/50`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function Overview({ overview, kits, openReports }: { overview: Awaited<ReturnType<typeof getAdminOverview>>; kits: Awaited<ReturnType<typeof listAdminKits>>; openReports: number }) {
  if (!overview) return <p className="text-sm text-muted-foreground">No database configured: there&apos;s nothing to administer.</p>;
  const unverified = kits.filter((k) => !k.verified && k.status === "active");
  const top = [...kits].sort((a, b) => b.installs - a.installs).slice(0, 5);

  return (
    <div className="flex flex-col gap-10">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Users" value={overview.users} hint={`+${overview.newUsers} this week`} href="/admin?tab=users" />
        <Stat label="Installs" value={overview.installs} hint={`${formatNumber.format(overview.installsWeek)} in the last 7 days`} href="/admin?tab=installs" />
        <Stat label="Official kits" value={overview.officialKits} href="/admin?tab=kits" />
        <Stat label="Community kits" value={overview.communityKits} hint={overview.hiddenKits ? `${overview.hiddenKits} hidden` : undefined} href="/admin?tab=kits" />
        <Stat label="Verified" value={kits.filter((k) => k.verified).length} hint={`of ${kits.length} kits`} href="/admin?tab=kits" />
        <Stat label="Open reports" value={openReports} href="/admin?tab=reports" />
        <Stat label="Subscribers" value={overview.subscribers} hint={overview.pendingSubscribers ? `${overview.pendingSubscribers} pending confirmation` : undefined} href="/admin?tab=newsletter" />
        <Stat label="Need review" value={unverified.length} hint="active kits without a passing verification" href="/admin?tab=kits" />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="label-mono">Most installed</h2>
        {top.some((k) => k.installs > 0) ? (
          <ol className="flex flex-col divide-y rounded-xl border">
            {top.map((k, i) => (
              <li key={k.slug} className="flex items-center gap-4 px-4 py-3">
                <span className="w-4 font-mono text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <Link href={`/kits/${k.slug}`} className="flex-1 truncate font-mono text-sm hover:underline">
                  {k.slug}
                </Link>
                <span className="font-mono text-sm tabular-nums">{formatNumber.format(k.installs)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">No installs counted yet.</p>
        )}
      </section>
    </div>
  );
}

function Reports({ reports }: { reports: Awaited<ReturnType<typeof listAdminReports>> }) {
  if (!reports.length) return <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">No reports. Nothing to moderate.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="label-mono text-muted-foreground">Kit</TableHead>
          <TableHead className="label-mono text-muted-foreground">Reason</TableHead>
          <TableHead className="label-mono text-muted-foreground">Details</TableHead>
          <TableHead className="label-mono text-muted-foreground">Date</TableHead>
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
            <TableCell className="max-w-80 text-xs whitespace-normal text-muted-foreground">
              {r.details}
              {r.contact && <span className="mt-1 block font-mono">{r.contact}</span>}
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">{formatDate.format(r.createdAt)}</TableCell>
            <TableCell>
              <Badge variant={r.status === "open" ? "default" : "outline"}>{r.status}</Badge>
            </TableCell>
            <TableCell className="text-right">
              {r.status === "open" ? (
                <>
                  <ReportStatusButton id={r.id} to="resolved">
                    Resolved
                  </ReportStatusButton>
                  <ReportStatusButton id={r.id} to="dismissed">
                    Dismiss
                  </ReportStatusButton>
                </>
              ) : (
                <ReportStatusButton id={r.id} to="open">
                  Reopen
                </ReportStatusButton>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Newsletter({ subscribers, issues, overview }: Awaited<ReturnType<typeof listAdminSubscribers>> & { overview: Awaited<ReturnType<typeof getAdminOverview>> }) {
  return (
    <div className="flex flex-col gap-10">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Confirmed" value={overview?.subscribers ?? 0} />
        <Stat label="Pending" value={overview?.pendingSubscribers ?? 0} hint="haven't clicked the link yet" />
        <Stat label="Unsubscribed" value={overview?.unsubscribed ?? 0} />
        <Stat label="Issues sent" value={issues.length} hint="every Monday, 09:00 UTC" />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="label-mono">Subscribers</h2>
        <SubscribersTable subscribers={subscribers} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="label-mono">Sent issues</h2>
        {issues.length ? (
          <Table>
            <TableBody>
              {issues.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-sm">{i.week}</TableCell>
                  <TableCell className="text-sm">{i.subject}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">{i.recipients} recipients</TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatDate.format(i.sentAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">The first issue goes out next Monday.</p>
        )}
      </section>
    </div>
  );
}

function Purchases({ purchases }: { purchases: Awaited<ReturnType<typeof listPurchases>> }) {
  if (!purchases.length) return <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">No purchases yet.</p>;
  return (
    <Table>
      <TableBody>
        {purchases.map(({ license, kit, buyer }) => (
          <TableRow key={license.id}>
            <TableCell className="font-mono">{kit}</TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {buyer} · {(license.amountCents / 100).toFixed(2)} € (fee {(license.feeCents / 100).toFixed(2)} €) · {formatDate.format(license.createdAt)}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{license.status}</Badge>
            </TableCell>
            <TableCell className="text-right">{license.status === "active" && <RefundButton licenseId={license.id} />}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
