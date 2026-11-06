import { BRAND } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { Sparkline } from "@/components/shared/sparkline";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount } from "@/lib/format";
import { getKitHistory } from "@/server/accounts";
import { getKitStats } from "@/server/metrics/queries";
import { PriceForm } from "@/features/billing/buttons";
import { kitAccess, kitPlan } from "@/server/kit-access";
import { PLANS } from "@/server/plans";
import { billingEnabled } from "@/server/stripe";
import { findCommunityVersion } from "@/server/registry";
import { getViewer } from "@/server/session";

export const metadata: Metadata = { title: "Kit statistics" };

export default function KitStatsPage({ params }: PageProps<"/account/kits/[...slug]">) {
  return (
    <div className="flex flex-col gap-10">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Stats slug={params.then((p) => p.slug.join("/"))} />
      </Suspense>
    </div>
  );
}

async function Stats({ slug: slugPromise }: { slug: Promise<string> }) {
  const slug = await slugPromise;
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account");
  const kit = await findCommunityVersion(slug);
  // Detailed numbers are for whoever manages the kit; the public page shows totals.
  if (!kit || !(await kitAccess(kit, viewer)).manage) notFound();
  const plan = await kitPlan(kit, viewer.id);
  const days = PLANS[plan].historyDays;
  const [live, history] = await Promise.all([getKitStats(slug), getKitHistory(slug, days)]);
  const breakdown = Object.entries(live.breakdown).sort((a, b) => b[1] - a[1]);
  const group = (prefix: string) => breakdown.filter(([k]) => (prefix ? k.startsWith(prefix) : !k.startsWith("agent=") && !k.startsWith("pm=")));

  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="label-mono text-muted-foreground">Statistics</p>
        <h2 className="font-mono text-xl font-semibold tracking-tight">
          <Link href={`/kits/${slug}`} className="hover:underline">
            {slug}
          </Link>
        </h2>
      </header>

      {billingEnabled && kit.ownerId === viewer.id && kit.visibility === "public" && (
        <section className="flex flex-col gap-2">
          <h2 className="label-mono">Price</h2>
          <PriceForm slug={slug} priceCents={kit.priceCents} />
        </section>
      )}

      <section className="grid gap-6 sm:grid-cols-3">
        <Number label="Installs" value={live.installs} />
        <Number label="Unique users" value={live.unique} />
        <div className="flex flex-col gap-2">
          <h2 className="label-mono">Last 8 weeks</h2>
          <Sparkline values={live.weekly} className="h-10" />
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        <Number label="Updates" value={live.retention.update ?? 0} />
        <Number label="Libraries added" value={live.retention.add ?? 0} />
      </section>
      <Breakdown
        title={`Added later with ${BRAND.cli} add`}
        rows={Object.entries(live.retention)
          .filter(([k]) => k.startsWith("add:"))
          .map(([k, v]) => [k.slice(4), v] as [string, number])}
      />
      <Breakdown title="Chosen options" rows={group("")} />
      <Breakdown title="Agents" rows={group("agent=").map(([k, v]) => [k.slice(6), v])} />
      <Breakdown title="Package manager" rows={group("pm=").map(([k, v]) => [k.slice(3), v])} />
      <Breakdown title="Versions" rows={history.versions.map((v) => [v.version ?? "unknown", v.installs])} />
      <Breakdown title="Countries" rows={history.countries.map((c) => [c.country ?? "unknown", c.installs])} />
      <Breakdown title={`Last ${days} days`} rows={history.daily.map((d) => [d.day, d.installs])} />
      <p className="text-sm text-muted-foreground">
        {PLANS[plan].csvExport ? (
          <a className="underline underline-offset-4" href={`/api/v1/stats/${slug}`}>Descargar CSV</a>
        ) : (
          <>12-month history and CSV with the Pro plan (in <Link className="underline underline-offset-4" href="/account">your account</Link>).</>
        )}
      </p>
    </>
  );
}

function Number({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="label-mono">{label}</h2>
      <p className="font-mono text-xl font-semibold tracking-tight">{formatCount(value)}</p>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map(([, v]) => v));
  return (
    <section className="flex flex-col gap-3">
      <h2 className="label-mono">{title}</h2>
      <Separator />
      {rows.length ? (
        <ul className="flex flex-col gap-2">
          {rows.map(([label, value]) => (
            <li key={label} className="grid grid-cols-[minmax(0,12rem)_1fr_3rem] items-center gap-3 text-sm">
              <span className="truncate font-mono text-xs">{label}</span>
              <span className="h-1.5 rounded-full bg-foreground/80" style={{ width: `${(value / max) * 100}%` }} />
              <span className="text-right font-mono text-xs text-muted-foreground">{value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No data yet.</p>
      )}
    </section>
  );
}
